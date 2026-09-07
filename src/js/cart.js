/* ============================================================================
   Фиктивная корзина прототипа.

   Бэкенда нет: держим счётчик в памяти, рисуем его в бейдже шапки и показываем
   тост. Тост ОДИН на всё приложение — повторный клик не добавляет второй, а
   перезапускает таймер и подсказку, поэтому тосты не копятся стопкой.

   Живёт в body, а не внутри секции: при уходе секции на .section__layer стоит
   transform, а он создаёт containing block — position: fixed внутри слоя
   считался бы от него, а не от экрана.
   ============================================================================ */

import gsap from 'gsap'
import { cart } from '../data/nav.js'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Сколько тост держится на экране. */
const TOAST_LIFETIME = 2500

let count = cart.count
let toast = null
let hideTimer = null

/* ------------------------------------------------------------------- тост */

function ensureToast() {
  if (toast) return toast

  toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  document.body.appendChild(toast)

  return toast
}

export function showToast(text) {
  const el = ensureToast()

  el.textContent = text
  el.classList.add('is-visible')

  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => el.classList.remove('is-visible'), TOAST_LIFETIME)
}

/* ---------------------------------------------------------------- счётчик */

function paintBadge() {
  const badge = document.querySelector('.cart-btn__count')
  if (!badge) return

  badge.textContent = String(count)
  badge.dataset.count = String(count)

  const label = badge.parentElement?.querySelector('.visually-hidden')
  if (label) label.textContent = `Корзина, товаров: ${count}`

  if (REDUCED) return
  gsap.fromTo(
    badge,
    { scale: 1 },
    { scale: 1.35, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 },
  )
}

/**
 * Добавление товара. Логика фиктивная: растёт счётчик и показывается тост.
 * @param {string} [message] текст тоста
 */
export function addToCart(message = 'Добавлено в корзину') {
  count += 1
  paintBadge()
  showToast(message)
}

export const getCartCount = () => count
