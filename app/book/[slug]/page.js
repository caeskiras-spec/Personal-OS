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
    const { slug } = await params               // Next.js 15+: params is a Promise
    const { data } = await supabaseAdmin
      .from('booking_links')
      .select('title')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.title) return { title: `${data.title} — Запись на встречу` }
  } catch { /* silent */ }
  return { title: 'Запись на встречу' }
}

export default async function BookPage({ params }) {
  const { slug } = await params                 // Next.js 15+: params is a Promise

  // Optimistic pre-fetch: gives client a title + duration immediately.
  // If this fails for any reason (missing env, network) the client will
  // probe /api/book/[slug] on mount and resolve correctly.
  let linkMeta = null
  try {
    const { data } = await supabaseAdmin
      .from('booking_links')
      .select('title, duration_minutes, timezone')
      .eq('slug', slug)
      .eq('is_active', true)   // only expose active links server-side
      .maybeSingle()
    // Pass only public-safe fields — never expose user_id
    if (data) {
      linkMeta = {
        title:             data.title,
        duration_minutes:  data.duration_minutes,
        timezone:          data.timezone,
        is_active:         true,
      }
    }
  } catch { /* client probe will handle */ }

  return <BookingClient slug={slug} initialMeta={linkMeta} />
}
