/** Compact tag chips. max=2 by default; shows "+N" for overflow. */
export default function TagChips({ tags, max = 2 }) {
  if (!tags || tags.length === 0) return null
  const visible = tags.slice(0, max)
  const extra   = tags.length - max
  return (
    <>
      {visible.map(tag => (
        <span key={tag} className="px-1.5 py-0.5 bg-muted/40 rounded text-[10px] text-subtle">
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-subtle">+{extra}</span>
      )}
    </>
  )
}
