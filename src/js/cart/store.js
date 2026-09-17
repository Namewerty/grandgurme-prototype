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
   stock и preorder, заявка — request. Снимок хранит всё, от чего зависит
   вид (цена, наличие, раздел, fulfillment), а сам вид считается заново из
   снимка при каждой загрузке — так запись, сделанная другой версией кода,
   не может принести с собой чужой вид. Первая версия хранила вид, но не
   fulfillment, и «под заказ» у помеченной так позиции уезжало в заявку.
   На Битриксе вид считается при каждой отрисовке по живому остатку и цене,
   и позиция переезжает между корзиной и заявкой сама.

   КОРЗИНА ПО ПОЛЬЗОВАТЕЛЮ (17.09.2026). Какой ключ читать, решает storage.js.
   Стор перечитывает состояние по событию account:change (вход, выход — в этой
   вкладке или в соседней) и рассылает cart:change. Внешнее изменение корзины
   (событие storage) только обновляет состояние и рассылает cart:change,
   ОБРАТНО В ХРАНИЛИЩЕ НЕ ПИШЕТ: при входе в соседней вкладке корзина кабинета
   иначе могла бы записаться в чужой ключ. Оформление просит стор не следить
   за сменой входа (holdAccount): там корзину под человеком менять нельзя.
   ============================================================================ */

import { ROUTES } from '../../data/routes.js'
import { KINDS, isOrderKind, kindOf, readyDateFor } from '../../data/fulfillment.js'
import { currentUserId } from '../account/session.js'
import { MAX_QTY, loadCart, onExternalCartChange, saveCart } from './storage.js'

export { MAX_QTY }

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
    fulfillment: product.fulfillment === 'preorder' ? 'preorder' : null,
  }
  return { ...line, kind: kindOf(line) }
}

/** Запись из хранилища могла быть поправлена руками или другой версией кода. */
const isValidLine = (line) =>
  line && typeof line.id === 'string' && typeof line.name === 'string' && clampQty(line.qty) > 0

let state = sanitize(loadCart())

/** Вид не доверяем записи — считаем из снимка (см. шапку файла). */
function sanitize({ items, promo }) {
  return {
    items: items
      .filter(isValidLine)
      .map((line) => ({ ...line, qty: clampQty(line.qty), kind: kindOf(line) })),
    promo,
  }
}

function announce() {
  document.dispatchEvent(
    new CustomEvent('cart:change', { detail: { items: getItems(), totals: getTotals() } }),
  )
}

function commit() {
  saveCart(state)
  announce()
}

/** Оформление держит корзину того, кто его открыл (см. holdAccount). */
let held = false
let heldUserId = null

/** Вход сменился под удерживаемой страницей — чужую корзину не подставляем. */
const switchedUnderHold = () => held && currentUserId() !== heldUserId

onExternalCartChange((next) => {
  if (switchedUnderHold()) return
  state = sanitize(next)
  announce()
})

// Вход или выход: у корзины другой ключ — перечитываем, в хранилище не пишем.
document.addEventListener('account:change', () => {
  if (held) return
  state = sanitize(loadCart())
  announce()
})

/**
 * Не переключать корзину при смене входа в соседней вкладке. Нужно оформлению:
 * подменить состав под заполненной формой нельзя, страница просит обновиться.
 * Пока вход прежний, состав по-прежнему следует за соседней вкладкой.
 */
export function holdAccount() {
  held = true
  heldUserId = currentUserId()
}

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
