/* ============================================================================
   Сердце избранного: переключение с тостом и синхронизация всех сердец
   на странице.

   ОДНО СОСТОЯНИЕ НА ВСЕ СЕРДЦА. У каждой кнопки-сердца есть data-fav-id.
   По событию favorites:change обновляются ВСЕ кнопки с этим id: класс
   is-active, aria-pressed и подпись. Так одна позиция в сетке и в ленте,
   после «Вернуть» и после изменения в соседней вкладке показывает одно и то же.
   Кнопку может отрисовать и сервер — достаточно data-fav-id и data-fav-name.

   Где сердце есть: сетка раздела каталога, карточка товара, ленты карточки
   товара, обзор кабинета, /favorites. На витрине главной (#shop) сердец нет —
   решение в шапке src/js/sections/shop.js.
   ============================================================================ */

import { accountCopy } from '../../data/account-copy.js'
import { icons } from '../icons.js'
import { showToast } from '../cart/toast.js'
import * as favorites from './store.js'

const copy = accountCopy.favorites

const labelFor = (active, name) => `${active ? copy.remove : copy.add}: ${name}`

function paint(button, active) {
  button.classList.toggle('is-active', active)
  button.setAttribute('aria-pressed', String(active))
  button.setAttribute('aria-label', labelFor(active, button.dataset.favName || ''))
}

/** Привести все сердца страницы к состоянию стора. */
export function syncHearts(root = document) {
  root.querySelectorAll('[data-fav-id]').forEach((button) => paint(button, favorites.has(button.dataset.favId)))
}

let watching = false

/** Подписка на стор — один раз на страницу, сколько бы сердец ни было. */
function watch() {
  if (watching) return
  watching = true
  favorites.subscribe(() => syncHearts())
}

/** Переключить и сказать об этом тостом. «Вернуть» ставит позицию на прежнее место. */
export function toggleWithToast(product) {
  const id = String(product.id ?? product.slug)
  if (favorites.has(id)) {
    const removed = favorites.remove(id)
    showToast(copy.toastRemoved, {
      label: copy.toastUndo,
      onClick: () => removed && favorites.restore(removed.snapshot, removed.index),
    })
    return false
  }
  favorites.toggle(product)
  showToast(copy.toastAdded, copy.toastAddedAction)
  return true
}

/**
 * Поле favorite для createProductCard (src/js/components/product-card.js).
 * @param {object} product позиция каталога с categorySlug или снимок избранного
 */
export function favoriteFor(product) {
  watch()
  const id = String(product.id ?? product.slug)
  return {
    id,
    active: favorites.has(id),
    label: (active, name) => labelFor(active, name),
    onToggle: () => toggleWithToast(product),
  }
}

/** Отдельная кнопка-сердце — карточка товара, рядом с «В корзину». */
export function createHeartButton(product, className) {
  watch()
  const id = String(product.id ?? product.slug)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.dataset.favId = id
  button.dataset.favName = product.name
  button.innerHTML = icons.heart
  paint(button, favorites.has(id))
  button.addEventListener('click', () => toggleWithToast(product))
  return button
}
