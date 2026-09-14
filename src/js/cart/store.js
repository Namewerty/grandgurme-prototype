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
   название, подпись, кадр, цена и наличие на момент добавления. Витрина
   главной кладёт позиции, которых в каталоге нет вовсе (пате, краб, наборы —
   выгрузки по ним нет), и искать их по id было бы негде. На Битриксе
   актуальную цену и остаток всё равно пересчитает sale.basket.
   ============================================================================ */

import { ROUTES } from '../../data/routes.js'
import { readyDateFor } from '../../data/fulfillment.js'
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
  return {
    id: String(product.id ?? slug),
    slug,
    name: product.name,
    note: product.note ?? product.weightLabel ?? '',
    href: product.href ?? (slug ? ROUTES.product(slug) : ROUTES.catalog),
    image: product.image ?? product.photo ?? null,
    price: typeof product.price === 'number' ? product.price : null,
    qty,
    inStock: product.inStock !== false,
  }
}

/** Запись из хранилища могла быть поправлена руками или другой версией кода. */
const isValidLine = (line) =>
  line && typeof line.id === 'string' && typeof line.name === 'string' && clampQty(line.qty) > 0

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
 *   count          штук товара — «Товаров 3» в сводке и бейдж шапки;
 *   positions      строк в корзине — «2 позиции» под заголовком;
 *   sum            сумма по позициям с известной ценой;
 *   onRequestCount позиций без цены;
 *   hasPreorder    есть ли позиции под заказ;
 *   readyAt        дата готовности заказа целиком.
 */
export function getTotals() {
  const { items } = state
  return {
    count: items.reduce((n, line) => n + line.qty, 0),
    positions: items.length,
    sum: items.reduce((n, line) => n + (line.price == null ? 0 : line.price * line.qty), 0),
    onRequestCount: items.filter((line) => line.price == null).length,
    hasPreorder: items.some((line) => !line.inStock),
    readyAt: readyDateFor(items),
  }
}

/** Подписка на изменения. Возвращает отписку. */
export function subscribe(fn) {
  const handler = (event) => fn(event.detail)
  document.addEventListener('cart:change', handler)
  return () => document.removeEventListener('cart:change', handler)
}
