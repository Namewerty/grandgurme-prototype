/* ============================================================================
   Избранное: состояние в памяти и его API.

   Устроено как корзина (src/js/cart/store.js): страницы и сердца знают только
   этот файл, он сохраняет через account/api.js. У гостя избранное лежит
   в браузере, у вошедшего — в кабинете; где именно, решает api.js.

   НИЧЕГО НЕ ДЕЛАЕТ ПРИ ИМПОРТЕ. Состояние читается при первом вызове любой
   функции, тогда же включаются подписки. Модуль попадает в сборку Битрикса
   через шапку, а шапка в режиме ssr его не вызывает.

   ПОЗИЦИЯ — СНИМОК, как в корзине: id, slug, name, note, href, image, price,
   inStock, categorySlug, fulfillment, addedAt. Вид (в наличии, под заказ,
   через менеджера) считает kindOf при чтении, в снимке его нет.

   КАТАЛОГ ГЛАВНЕЕ СНИМКА. Позиция, найденная в каталоге по слагу, берёт цену,
   наличие и кадр оттуда. Позиция со слагом, которого в каталоге нет, снята
   с продажи: при чтении она выбрасывается, а стор помнит, сколько таких было
   (dropped). Из хранилища они уходят, когда страница избранного показала
   строку о них и подтвердила это (confirmDropped), — иначе строку съедала бы
   первая же страница сайта, где шапка считает счётчик.

   ИЗМЕНЕНИЯ РАССЫЛАЮТСЯ СОБЫТИЕМ favorites:change на document. Соседние
   вкладки узнают через событие storage; по account:change стор перечитывает
   избранное — у вошедшего оно другое.
   ============================================================================ */

import { findProductBySlug } from '../../data/catalog-products.js'
import { ROUTES } from '../../data/routes.js'
import { kindOf } from '../../data/fulfillment.js'
import { addFavorite, peekFavorites, removeFavorite } from '../account/api.js'
import { GUEST_FAVORITES_KEY, USERS_KEY, onExternalChange } from '../account/storage.js'

let state = null
let droppedIds = []

/** Снимок позиции каталога или витрины. */
function toSnapshot(product) {
  const slug = product.slug ?? null
  return {
    id: String(product.id ?? slug),
    slug,
    name: product.name,
    note: product.note ?? product.weightLabel ?? '',
    href: product.href ?? (slug ? ROUTES.product(slug) : ROUTES.catalog),
    image: product.image ?? product.photo ?? null,
    price: typeof product.price === 'number' ? product.price : null,
    inStock: product.inStock !== false,
    categorySlug: product.categorySlug ?? null,
    fulfillment: product.fulfillment === 'preorder' ? 'preorder' : null,
    // Коробки (src/data/boxes.js): по sale карточка пишет «≈ 2 580 ₽»,
    // по nominalG и pricePerKg корзина собирает строку.
    ...boxFields(product),
    addedAt: new Date().toISOString(),
  }
}

const boxFields = (product) =>
  product?.sale === 'box'
    ? { sale: 'box', nominalG: product.nominalG, pricePerKg: product.pricePerKg }
    : { sale: null, nominalG: null, pricePerKg: null }

/** Свежие цена, наличие и кадр из каталога; null — позиция снята с продажи. */
function refresh(snapshot) {
  if (!snapshot || typeof snapshot.id !== 'string' || typeof snapshot.name !== 'string') return null
  if (!snapshot.slug) return snapshot

  const product = findProductBySlug(snapshot.slug)
  if (!product) return null
  return {
    ...snapshot,
    price: typeof product.price === 'number' ? product.price : null,
    inStock: product.inStock !== false,
    image: product.photo ?? snapshot.image,
    categorySlug: product.categorySlug ?? snapshot.categorySlug,
    fulfillment: product.fulfillment === 'preorder' ? 'preorder' : null,
    // Позиция стала коробочной после того, как попала в избранное:
    // подпись и поля коробки — из каталога.
    note: product.weightLabel ?? snapshot.note,
    ...boxFields(product),
  }
}

function read() {
  const raw = peekFavorites()
  const fresh = raw.map(refresh)
  droppedIds = raw.filter((item, i) => item?.slug && !fresh[i]).map((item) => item.id)
  state = fresh.filter(Boolean)
}

function announce() {
  document.dispatchEvent(new CustomEvent('favorites:change', { detail: { items: list(), count: state.length } }))
}

function reload() {
  read()
  announce()
}

function ensure() {
  if (state) return
  read()
  onExternalChange([GUEST_FAVORITES_KEY, USERS_KEY], reload)
  document.addEventListener('account:change', reload)
}

/* -------------------------------------------------------------------- API */

/** Снимки с видом позиции, новые сверху. Копия: состояние правится только через API. */
export function list() {
  ensure()
  return state.map((item) => ({ ...item, kind: kindOf(item) }))
}

export function has(id) {
  ensure()
  return state.some((item) => item.id === String(id))
}

export function count() {
  ensure()
  return state.length
}

/** Сколько позиций выброшено при чтении как снятые с продажи. */
export function dropped() {
  ensure()
  return droppedIds.length
}

/** Страница избранного показала строку о снятых позициях — убираем их из хранилища. */
export function confirmDropped() {
  ensure()
  const ids = droppedIds
  droppedIds = []
  ids.forEach((id) => removeFavorite(id))
}

/**
 * Переключить. @returns {boolean} новое состояние: true — в избранном.
 * Место убранной позиции возвращает indexOf — оно нужно «Вернуть».
 */
export function toggle(product) {
  ensure()
  const id = String(product.id ?? product.slug)
  if (has(id)) {
    remove(id)
    return false
  }
  const snapshot = toSnapshot(product)
  state.unshift(snapshot)
  addFavorite(snapshot, 0)
  announce()
  return true
}

export function indexOf(id) {
  ensure()
  return state.findIndex((item) => item.id === String(id))
}

export function remove(id) {
  ensure()
  const at = indexOf(id)
  if (at === -1) return null
  const [snapshot] = state.splice(at, 1)
  removeFavorite(snapshot.id)
  announce()
  return { snapshot, index: at }
}

/** Вернуть позицию на прежнее место. */
export function restore(snapshot, index) {
  ensure()
  if (!snapshot || has(snapshot.id)) return
  const at = Math.max(0, Math.min(index, state.length))
  state.splice(at, 0, snapshot)
  addFavorite(snapshot, at)
  announce()
}

/** Подписка на изменения. Возвращает отписку. */
export function subscribe(fn) {
  ensure()
  const handler = (event) => fn(event.detail)
  document.addEventListener('favorites:change', handler)
  return () => document.removeEventListener('favorites:change', handler)
}
