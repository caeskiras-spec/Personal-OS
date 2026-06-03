// ─── Finance selectors ────────────────────────────────────────────────────────

/**
 * All categories come from DB (seeded via financeCategoriesRepo.ensureDefaults).
 * No fake slug IDs — every category has a real uuid.
 */

/** Look up a category by id */
export function findCategory(categories, id) {
  if (!id) return null
  return categories.find(c => c.id === id) ?? null
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function getMonthRange(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` }
}

function getWeekRange(date = new Date()) {
  const d   = new Date(date)
  const dow = d.getDay()
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow))   // Monday
  const from = localStr(d)
  d.setDate(d.getDate() + 6)                              // Sunday
  const to   = localStr(d)
  return { from, to }
}

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

/**
 * Compute summary for a period.
 * Returns { income, expense, net, from, to, transactions[] }
 */
export function getPeriodSummary(transactions, period = 'month', refDate = new Date()) {
  const range = period === 'week' ? getWeekRange(refDate) : getMonthRange(refDate)
  const filtered = transactions.filter(t => t.date >= range.from && t.date <= range.to)

  const income  = filtered.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0)
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return { income, expense, net: income - expense, ...range, transactions: filtered }
}

/**
 * Group expense transactions by categoryId, return array sorted by total desc.
 * [{ categoryId, total, count, pct }]
 */
export function getExpenseByCategory(transactions, totalExpense) {
  const map = {}
  for (const t of transactions) {
    if (t.type !== 'expense') continue
    const key = t.categoryId ?? 'default-other'
    if (!map[key]) map[key] = { categoryId: key, total: 0, count: 0 }
    map[key].total += t.amount
    map[key].count++
  }
  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .map(item => ({
      ...item,
      pct: totalExpense > 0 ? Math.min(item.total / totalExpense, 1) : 0,
    }))
}

/**
 * Calculate budget usage for a category in current month.
 * Returns { spent, limit, pct, over }
 */
export function getBudgetUsage(transactions, budgets, categoryId) {
  const budget  = budgets.find(b => b.categoryId === categoryId)
  const { from, to } = getMonthRange()
  const spent   = transactions
    .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date >= from && t.date <= to)
    .reduce((s, t) => s + t.amount, 0)
  const limit   = budget?.monthlyLimit ?? 0
  const pct     = limit > 0 ? Math.min(spent / limit, 1.2) : 0   // cap at 120% visually
  return { spent, limit, pct, over: limit > 0 && spent > limit }
}

/**
 * Sort transactions: date DESC, createdAt DESC.
 */
export function sortTransactions(arr) {
  return [...arr].sort((a, b) => {
    if (b.date !== a.date) return (b.date ?? '').localeCompare(a.date ?? '')
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
}

/**
 * Group sorted transactions by date.
 * Returns [{ date, transactions[] }]
 */
export function groupTransactionsByDate(transactions) {
  const map = new Map()
  for (const t of transactions) {
    if (!t.date) continue
    if (!map.has(t.date)) map.set(t.date, [])
    map.get(t.date).push(t)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, txns]) => ({ date, transactions: txns }))
}

/**
 * Anti-duplicate hash (for future statement import).
 * Hash: date + amount + description → base64-like string.
 * Not a cryptographic hash — used only for deduplication.
 */
export function buildImportHash(date, amount, description) {
  const raw = `${date}|${amount}|${(description ?? '').trim().toLowerCase()}`
  // Simple djb2-like hash (no crypto needed for dedup)
  let h = 5381
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h) + raw.charCodeAt(i)
    h = h & 0x7fffffff   // keep positive 31-bit
  }
  return h.toString(36)
}
