import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import BookingClient from './BookingClient'

export const dynamic = 'force-dynamic'

/**
 * Server component: pre-fetch link metadata so the client gets a title
 * immediately without an extra round-trip. If the link doesn't exist or
 * is inactive we still render the client component — it will handle 404.
 */
export async function generateMetadata({ params }) {
  try {
    const { data } = await supabaseAdmin
      .from('booking_links')
      .select('title')
      .eq('slug', params.slug)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.title) return { title: `${data.title} — Запись на встречу` }
  } catch { /* silent */ }
  return { title: 'Запись на встречу' }
}

export default async function BookPage({ params }) {
  let linkMeta = null
  try {
    const { data } = await supabaseAdmin
      .from('booking_links')
      .select('title, duration_minutes, timezone, is_active')
      .eq('slug', params.slug)
      .maybeSingle()
    linkMeta = data ?? null
  } catch { /* client will show error */ }

  return <BookingClient slug={params.slug} initialMeta={linkMeta} />
}
