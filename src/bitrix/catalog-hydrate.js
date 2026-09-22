/* ============================================================================
   Сетка и фильтры каталога на серверной разметке Битрикса (22.09.2026).

   Без скрипта всё работает формами и ссылками. Скрипт делает так же, как
   в прототипе:

     1. «В корзину» в углу кадра не перезагружает страницу. Форма
        .cart-add (gg_cart_add_button, include/cart.php) уходит запросом
        с gg_cart_ajax=Y, сервер отвечает JSON: вид позиции, текст тоста,
        число для шапки. Тост и «Перейти» — те же, что у addWithToast
        прототипа (src/js/cart/add.js). Запрос не прошёл — форма уходит
        обычным способом и отвечает редиректом с тостом.

     2. Выпадающие фильтры (details.drop) открыты по одному. В прототипе
        это один поповер на все пилюли (src/js/catalog/filters.js): открыл
        «Линейку» — «Фасовка» закрылась. Родные <details> этого не умеют,
        и два списка ложились друг на друга. Клик мимо и Escape закрывают
        открытый список, как поповер прототипа.
   ============================================================================ */

import gsap from 'gsap'
import { cartCopy } from '../data/cart-copy.js'
import { showToast } from '../js/cart/toast.js'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------ «в корзину» */

/** Число в шапке — та же подпись и тот же «пульс», что у watchCartBadge. */
function paintCartCount(n) {
  const badge = document.querySelector('.header .cart-btn__count')
  if (!badge || !Number.isFinite(n)) return
  if (badge.dataset.count === String(n)) return

  badge.textContent = String(n)
  badge.dataset.count = String(n)
  const label = badge.parentElement?.querySelector('.visually-hidden')
  if (label) label.textContent = `Корзина, товаров: ${n}`

  if (REDUCED || !n) return
  gsap.fromTo(badge, { scale: 1 }, { scale: 1.35, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 })
}

async function sendAdd(form) {
  const body = new FormData(form)
  body.set('gg_cart_ajax', 'Y')
  const response = await fetch(form.action || location.href, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`cart-add: ${response.status}`)
  return response.json()
}

function hydrateQuickAdd(root) {
  root.addEventListener('submit', async (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.matches('.cart-add')) return
    event.preventDefault()

    const button = form.querySelector('button')
    // Двойной клик не кладёт две штуки: пока идёт запрос, кнопка занята.
    if (button?.getAttribute('aria-busy') === 'true') return
    button?.setAttribute('aria-busy', 'true')

    let result
    try {
      result = await sendAdd(form)
    } catch {
      button?.removeAttribute('aria-busy')
      form.submit()
      return
    }
    button?.removeAttribute('aria-busy')

    if (!result?.ok) {
      // Сервер ответил, но позицию не принял (заявка полна, товар снят):
      // повторять тем же запросом бессмысленно, ведём в карточку.
      const href = form.closest('.product')?.querySelector('.product__name a')?.href
      showToast('Не получилось добавить', href ? { label: 'Открыть', href } : undefined)
      return
    }

    paintCartCount(Number(result.count))
    showToast(result.toast, { label: cartCopy.toast.action.label, href: result.href || cartCopy.toast.action.href })
  })
}

/* ------------------------------------------------------------ фильтры */

function hydrateDrops(root) {
  const drops = [...root.querySelectorAll('details.drop')]
  if (!drops.length) return

  drops.forEach((drop) => {
    drop.addEventListener('toggle', () => {
      if (!drop.open) return
      drops.forEach((other) => {
        if (other !== drop && other.open) other.open = false
      })
    })
  })

  document.addEventListener('pointerdown', (event) => {
    drops.forEach((drop) => {
      if (drop.open && !drop.contains(event.target)) drop.open = false
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const open = drops.find((drop) => drop.open)
    if (!open) return
    open.open = false
    open.querySelector('summary')?.focus()
  })
}

export function hydrateCatalog(root = document) {
  hydrateQuickAdd(root)
  hydrateDrops(root)
}
