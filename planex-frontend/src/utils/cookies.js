const COOKIE_EXPIRY_DAYS = 30

// Only use Secure flag when page is served over HTTPS; otherwise
// browsers may reject the cookie entirely, breaking auth persistence.
const SECURE_FLAG = window.location.protocol === 'https:' ? ';Secure' : ''

export function setCookie(name, value, days = COOKIE_EXPIRY_DAYS) {
  const expires = new Date()
  expires.setDate(expires.getDate() + days)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/${SECURE_FLAG}`
}

export function getCookie(name) {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(name + '='))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

export function removeCookie(name) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/${SECURE_FLAG}`
}

export function saveFilterPreference(filter) {
  setCookie('planex_filter', filter)
}

export function loadFilterPreference() {
  return getCookie('planex_filter') || 'active'
}

export function saveLastViewedTask(taskId) {
  setCookie('planex_last_task', String(taskId))
}

export function loadLastViewedTask() {
  return getCookie('planex_last_task')
}