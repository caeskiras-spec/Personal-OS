/**
 * app/api/book/[slug]/route.js
 *
 * Public API for the booking flow — uses service-role key (supabaseAdmin),
 * never exposes any owner's private data to the guest.
 *
 * GET  /api/book/[slug]?date=YYYY-MM-DD
 *   → { link: { title, duration_minutes, timezone }, slots: [{startISO, endISO}] }
 *
 * POST /api/book/[slug]
 *   body: { date, startISO, endISO, guestName, guestPhone?, guestTelegram? }
 *   → 200 { meeting: { id, start_at, end_at, guest_name } }
 *   → 409 if slot is taken
 *   → 400/404 on validation errors
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { generateSlots, getWeekday } from '../../../../lib/booking/slots'

// ─── helpers ──────────────────────────────────────────────────────────────────

function err(status, message) {
  return NextResponse.json({ error: message }, { status })
}

/** Fetch link + owner's timezone — fails with 404 if inactive or missing */
async function getActiveLink(slug) {
  const { data, error } = await supabaseAdmin
    .from('booking_links')
    .select('id, user_id, title, duration_minutes, buffer_minutes, timezone, is_active')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data)           return null
  if (!data.is_active) return null
  return data
}

/** Fetch availability rules for link and weekday */
async function getRulesForDay(linkId, weekday) {
  const { data, error } = await supabaseAdmin
    .from('availability_rules')
    .select('start_time, end_time')
    .eq('link_id', linkId)
    .eq('weekday', weekday)
    .order('start_time')
  if (error) throw error
  return data ?? []
}

/**
 * Fetch confirmed meetings for an owner that overlap [dayStart, dayEnd).
 * We look ±1 day around the target date to catch any edge-of-day timezone issues.
 */
async function getBusyRanges(userId, dateStr) {
  const d    = new Date(dateStr + 'T00:00:00Z')
  const from = new Date(d.getTime() - 86400000).toISOString()
  const to   = new Date(d.getTime() + 2 * 86400000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('meetings')
    .select('start_at, end_at')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('start_at', from)
    .lt('start_at', to)
  if (error) throw error
  return data ?? []
}

// ─── GET /api/book/[slug] ─────────────────────────────────────────────────────
//
//   Without ?date  → { link: { title, duration_minutes, timezone } }
//   With ?date=YYYY-MM-DD → { link: {...}, slots: [{startISO, endISO}] }

export async function GET(request, context) {
  const { slug } = await context.params          // Next.js 15+: params is a Promise
  const { searchParams } = new URL(request.url)
  const dateStr = searchParams.get('date')

  try {
    const link = await getActiveLink(slug)
    if (!link) return err(404, 'Ссылка записи не найдена или неактивна')

    // Without date — just return link meta (used by client for initial probe)
    if (!dateStr) {
      return NextResponse.json({
        link: { title: link.title, duration_minutes: link.duration_minutes, timezone: link.timezone },
      })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return err(400, 'Некорректный формат даты (YYYY-MM-DD)')
    }

    const weekday    = getWeekday(dateStr)
    const rules      = await getRulesForDay(link.id, weekday)
    const busyRanges = await getBusyRanges(link.user_id, dateStr)

    const slots = generateSlots({
      dateStr,
      rules,
      durationMin:  link.duration_minutes,
      bufferMin:    link.buffer_minutes ?? 0,
      tz:           link.timezone,
      busyRanges,
      now:          new Date(),
    })

    return NextResponse.json({
      link:  { title: link.title, duration_minutes: link.duration_minutes, timezone: link.timezone },
      slots,
    })
  } catch (e) {
    console.error('[GET /api/book]', e?.message)
    return err(500, 'Ошибка сервера')
  }
}

// ─── POST /api/book/[slug] ────────────────────────────────────────────────────

export async function POST(request, context) {
  const { slug } = await context.params          // Next.js 15+: params is a Promise

  let body
  try { body = await request.json() } catch { return err(400, 'Некорректный JSON') }

  const { date, startISO, endISO, guestName, guestPhone, guestTelegram } = body

  // Validate required fields
  if (!date || !startISO || !endISO)        return err(400, 'date, startISO и endISO обязательны')
  if (!guestName?.trim())                   return err(400, 'Укажите имя')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))   return err(400, 'Некорректный формат даты')

  const startAt = new Date(startISO)
  const endAt   = new Date(endISO)
  if (isNaN(startAt) || isNaN(endAt) || endAt <= startAt) return err(400, 'Некорректный диапазон времени')
  if (startAt < new Date()) return err(400, 'Нельзя записаться на прошедшее время')

  try {
    const link = await getActiveLink(slug)
    if (!link) return err(404, 'Ссылка записи не найдена или неактивна')

    // Re-validate: slot must still be in availability rules
    const weekday = getWeekday(date)
    const rules   = await getRulesForDay(link.id, weekday)
    if (rules.length === 0) return err(400, 'В этот день запись недоступна')

    // Re-check that the slot is still free (race condition guard)
    const busyRanges = await getBusyRanges(link.user_id, date)
    const slotsNow = generateSlots({
      dateStr: date,
      rules,
      durationMin:  link.duration_minutes,
      bufferMin:    link.buffer_minutes ?? 0,
      tz:           link.timezone,
      busyRanges,
      now: new Date(),
    })

    const isValidSlot = slotsNow.some(
      s => s.startISO === startAt.toISOString() && s.endISO === endAt.toISOString()
    )
    if (!isValidSlot) {
      return err(409, 'Этот слот только что заняли — выберите другое время')
    }

    // Insert meeting using service-role (bypasses RLS — guest has no auth)
    const { data: meeting, error: insertErr } = await supabaseAdmin
      .from('meetings')
      .insert({
        user_id:        link.user_id,
        link_id:        link.id,
        guest_name:     guestName.trim(),
        guest_phone:    guestPhone?.trim()    || null,
        guest_telegram: guestTelegram?.trim() || null,
        start_at:       startAt.toISOString(),
        end_at:         endAt.toISOString(),
        status:         'confirmed',
      })
      .select('id, start_at, end_at, guest_name')
      .single()

    if (insertErr) {
      // PostgreSQL exclusion constraint violation = 23P01
      if (insertErr.code === '23P01' || insertErr.message?.includes('overlap')) {
        return err(409, 'Этот слот только что заняли — выберите другое время')
      }
      throw insertErr
    }

    return NextResponse.json({ meeting })
  } catch (e) {
    console.error('[POST /api/book]', e?.message)
    return err(500, 'Ошибка сервера — попробуйте ещё раз')
  }
}
