/* ============================================================================
   Тема. Всё завязано на data-theme у <html>:
     light — основное направление «Перламутр и жесть»
     dark  — альтернатива для сравнения заказчиком
   Первичная установка — инлайн-скриптом в <head>, чтобы не мигало.
   ============================================================================ */

const KEY = 'gg-theme'
const THEMES = ['light', 'dark']

export const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light'

export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : 'light'
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(KEY, next)
  } catch (e) {
    /* приватный режим — просто не запоминаем */
  }
  return next
}

export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark')

export const themeLabel = (theme = getTheme()) => (theme === 'dark' ? 'Тёмная' : 'Светлая')
