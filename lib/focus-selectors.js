import { getTodayStr } from './tasks-selectors'

export function getSessionsToday(sessions) {
  const today = getTodayStr()
  return sessions.filter(s => s.date === today && s.type === 'focus')
}

export function getSessionsThisWeek(sessions) {
  const today = new Date()
  const dow   = today.getDay() === 0 ? 6 : today.getDay() - 1 // Mon = 0
  const mon   = new Date(today)
  mon.setDate(today.getDate() - dow)
  mon.setHours(0, 0, 0, 0)
  const monStr = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`
  return sessions.filter(s => s.date >= monStr && s.type === 'focus')
}

export function sumMinutes(sessions) {
  return sessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0)
}
