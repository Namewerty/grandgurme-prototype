/* ============================================================================
   Состояние корзины и её API.

   О хранилище этот файл знает только одно: есть load и save (storage.js).
   Страницы и кнопки знают только этот файл. Поэтому на Битриксе меняется
   storage.js, а всё, что выше, остаётся как есть.

   ИЗМЕНЕНИЯ РАССЫЛАЮТСЯ СОБЫТИЕМ cart:change на document. Счётчик в шапке,
   страница корзины и сводка оформления подписываются на него сами. Раньше
   каждая кнопка «в корзину» дёргала счётчик руками, и любая новая кнопка
   была шансом забыть это сделать.

   ПОЗИЦИЯ ХРАНИТСЯ СНИМКОМ, А НЕ ССЫЛКОЙ НА КАТАЛОГ. В корзину попадают
   название, подпись, кадр, цена, наличие, раздел и ВИД на момент добавления.
   Витрина главной кладёт позиции, которых в каталоге нет вовсе (пате, краб,
   наборы — выгрузки по ним нет), и искать их по id было бы негде.

   ОДНА КОРЗИНА НА ТРИ ВИДА (src/data/fulfillment.js). Заказ — позиции
   stock и preorder, заявка — request. В прототипе вид не пересчитывается:
   это снимок. На Битриксе вид считается при каждой отрисовке по живому
   остатку и цене, и позиция переезжает между корзиной и заявкой сама.
   ============================================================================ */

import { ROUTES } from '../../data/routes.js'
import { KINDS, isOrderKind, kindOf, readyDateFor } from '../../data/fulfillment.js'
import { loadCart, onExternalCartChange, saveCart } from './storage.js'

export const MAX_QTY = 99

const clampQty = (qty) => Math.max(0, Math.min(MAX_QTY, Math.round(Number(qty) || 0)))

/**
 * Позиция корзины из товара каталога или из готового снимка.
 * Цена — число или null («цена по запросу»): строку «1 290 ₽» сюда не кладём,
 * иначе сумму пришлось бы разбирать обратно из текста.
 */
function toLine(product, qty) {
  const slug = product.slug ?? null
  const line = {
    id: String(product.id ?? slug),
    slug,
    name: product.name,
    note: product.note ?? product.weightLabel ?? '',
    href: product.href ?? (slug ? ROUTES.product(slug) : ROUTES.catalog),
    image: product.image ?? product.photo ?? null,
    price: typeof product.price === 'number' ? product.price : null,
    qty,
    inStock: product.inStock !== false,
    categorySlug: product.categorySlug ?? null,
  }
  return { ...line, kind: kindOf(line) }
}

/** Запись из хранилища могла быть поправлена руками или другой версией кода. */
const isValidLine = (line) =>
  line &&
  typeof line.id === 'string' &&
  typeof line.name === 'string' &&
  KINDS.includes(line.kind) &&
  clampQty(line.qty) > 0

let state = sanitize(loadCart())

function sanitize({ items, promo }) {
  return {
    items: items.filter(isValidLine).map((line) => ({ ...line, qty: clampQty(line.qty) })),
    promo,
  }
}

function commit() {
  saveCart(state)
  document.dispatchEvent(
    new CustomEvent('cart:change', { detail: { items: getItems(), totals: getTotals() } }),
  )
}

onExternalCartChange((next) => {
  state = sanitize(next)
  commit()
})

/* -------------------------------------------------------------------- API */

/** Копия состава: снаружи состояние не правится мимо API. */
export const getItems = () => state.items.map((line) => ({ ...line }))

export function add(product, qty = 1) {
  const amount = clampQty(qty)
  if (!product || !amount) return

  const id = String(product.id ?? product.slug)
  const existing = state.items.find((line) => line.id === id)

  if (existing) existing.qty = clampQty(existing.qty + amount)
  else state.items.push(toLine(product, amount))

  commit()
}

/** qty === 0 удаляет позицию: степпер на единице и крестик — одно действие. */
export function setQty(id, qty) {
  const next = clampQty(qty)
  const line = state.items.find((item) => item.id === id)
  if (!line) return

  if (!next) {
    remove(id)
    return
  }
  if (line.qty === next) return
  line.qty = next
  commit()
}

export function remove(id) {
  const before = state.items.length
  state.items = state.items.filter((line) => line.id !== id)
  if (state.items.length !== before) commit()
}

export function clear() {
  state = { items: [], promo: '' }
  commit()
}

/**
 * Заменить состав целиком. Нужен только демонстрационному наполнению
 * корзины (src/js/cart/demo.js); кнопки сайта кладут позиции через add.
 */
export function replace(products) {
  state = { items: products.map(({ product, qty }) => toLine(product, clampQty(qty) || 1)), promo: '' }
  commit()
}

/**
 * Промокод. Проверки в прототипе нет: код уезжает в заказ как есть,
 * и решение по нему принимает менеджер.
 */
export const getPromo = () => state.promo

export function setPromo(code) {
  const next = String(code || '').trim()
  if (next === state.promo) return
  state.promo = next
  commit()
}

/**
 * Итоги.
 *   count      штук товара всех видов — бейдж шапки: всё это лежит на
 *              странице корзины;
 *   positions  строк всех видов — «5 позиций» под заголовком;
 *   byKind     { stock, preorder, request } — строк каждого вида;
 *   order      заказ (stock + preorder): count, positions, sum, hasStock,
 *              hasPreorder, readyAt. Сумма точная: без цены в заказ не попасть;
 *   request    заявка: count, positions.
 */
export function getTotals() {
  const { items } = state
  const orderItems = items.filter((line) => isOrderKind(line.kind))
  const requestItems = items.filter((line) => line.kind === 'request')
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, items.filter((line) => line.kind === kind).length]))

  return {
    count: items.reduce((n, line) => n + line.qty, 0),
    positions: items.length,
    byKind,
    order: {
      count: orderItems.reduce((n, line) => n + line.qty, 0),
      positions: orderItems.length,
      sum: orderItems.reduce((n, line) => n + line.price * line.qty, 0),
      hasStock: byKind.stock > 0,
      hasPreorder: byKind.preorder > 0,
      readyAt: readyDateFor(orderItems),
    },
    request: {
      count: requestItems.reduce((n, line) => n + line.qty, 0),
      positions: requestItems.length,
    },
  }
}

/** Подписка на изменения. Возвращает отписку. */
export function subscribe(fn) {
  const handler = (event) => fn(event.detail)
  document.addEventListener('cart:change', handler)
  return () => document.removeEventListener('cart:change', handler)
}
