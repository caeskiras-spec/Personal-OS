import { getTodayStr } from './tasks-selectors'

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Завтрак',  emoji: '🌅' },
  { id: 'lunch',     label: 'Обед',     emoji: '☀️' },
  { id: 'dinner',    label: 'Ужин',     emoji: '🌙' },
  { id: 'snack',     label: 'Перекус',  emoji: '🍎' },
]

export function getMealLabel(id) {
  return MEAL_TYPES.find(m => m.id === id)?.label ?? id
}

export function getMealEmoji(id) {
  return MEAL_TYPES.find(m => m.id === id)?.emoji ?? '🍽️'
}

/** Group entries by meal_type, preserving order of MEAL_TYPES */
export function groupByMeal(entries) {
  const groups = {}
  for (const mt of MEAL_TYPES) groups[mt.id] = []
  for (const e of entries) {
    const key = e.mealType in groups ? e.mealType : 'snack'
    groups[key].push(e)
  }
  return groups
}

/** Sum macros for a list of entries */
export function sumMacros(entries) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein:  acc.protein  + (Number(e.protein)  ?? 0),
      carbs:    acc.carbs    + (Number(e.carbs)    ?? 0),
      fat:      acc.fat      + (Number(e.fat)      ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

/** Build a 35-day heatmap: { 'YYYY-MM-DD': { calories, goal, ratio } } */
export function buildCalorieHeatmap(allEntries, calorieGoal, days = 35) {
  const today     = getTodayStr()
  const todayDate = new Date(today + 'T00:00:00')
  const map = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() - i)
    const s = localStr(d)
    map[s] = { calories: 0, goal: calorieGoal, ratio: 0 }
  }
  for (const e of allEntries) {
    if (e.date in map) map[e.date].calories += e.calories ?? 0
  }
  for (const s in map) {
    const goal = map[s].goal
    map[s].ratio = goal > 0 ? Math.min(map[s].calories / goal, 1) : (map[s].calories > 0 ? 0.5 : 0)
  }
  return map
}

/** Returns dates that have at least one entry (Set<string>) */
export function getDatesWithEntries(allEntries) {
  return new Set(allEntries.map(e => e.date))
}

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
