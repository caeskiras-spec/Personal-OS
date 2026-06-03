const KEY = 'pos_device_user_id'

export function getDeviceUserId() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
