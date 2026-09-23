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
import { isBox, nearerTo, pickPacks } from '../../data/boxes.js'
import { KINDS, isOrderKind, kindOf, readyDateFor } from '../../data/fulfillment.js'
import { currentUserId } from '../account/session.js'
import { peekFreeCount, peekFreePacks } from './boxes.js'
import { MAX_QTY, loadCart, onExternalCartChange, saveCart } from './storage.js'
import { lineSum } from './summary.js'

export { MAX_QTY }

const clampQty = (qty) => Math.max(0, Math.min(MAX_QTY, Math.round(Number(qty) || 0)))

/**
 * КОРОБКИ (22.09.2026, выбор в карточке с 23.09.2026, src/data/boxes.js).
 * У позиции в коробках в снимке поле boxes: { nominalG, pricePerKg, packIds }:
 * packIds — выбранные коробки В ПОРЯДКЕ ВЫБОРА. У строки в наличии их
 * всегда ровно qty: карточка кладёт то, что человек отметил, «в корзину»
 * из сетки — коробку по умолчанию, а недостающее стор подбирает сам,
 * ближайшее к номиналу (fitPacks): «+» добавляет ближайшую свободную,
 * «−» убирает последнюю добавленную. У коробки под заказ packIds пусто —
 * на складе её нет. У обычной позиции boxes: null. Количество коробочной
 * позиции в наличии не больше числа свободных коробок (peekFreeCount),
 * add и setQty обрезают сами.
 */
const boxesOf = (product) =>
  isBox(product) ? { nominalG: product.nominalG, pricePerKg: product.pricePerKg, packIds: [] } : null

/** Запись boxes из хранилища приводится к форме выше; чужое — null. */
function sanitizeBoxes(boxes) {
  if (!boxes || typeof boxes !== 'object') return null
  return {
    nominalG: Number(boxes.nominalG) || 0,
    pricePerKg: Number(boxes.pricePerKg) || 0,
    packIds: Array.isArray(boxes.packIds) ? boxes.packIds.filter((id) => typeof id === 'string') : [],
  }
}

/** Предел количества строки: у коробок в наличии — свободные коробки. */
const limitOf = (line) =>
  line.boxes && line.kind === 'stock' && line.slug ? Math.min(MAX_QTY, peekFreeCount(line.slug)) : MAX_QTY

/**
 * Выбранных коробок ровно qty: лишние (с конца) убираются, недостающие
 * подбираются ближайшими к номиналу из свободных, не выбранных в строке;
 * коробки, которых на складе больше нет, выпадают. Под заказ — пусто.
 * Возвращает ту же строку с новым boxes.
 */
function fitPacks(line) {
  if (!line.boxes) return line
  if (line.kind !== 'stock' || !line.slug) return { ...line, boxes: { ...line.boxes, packIds: [] } }
  const free = peekFreePacks(line.slug)
  const freeIds = new Set(free.map((pack) => pack.id))
  let ids = [...new Set(line.boxes.packIds)].filter((id) => freeIds.has(id)).slice(0, line.qty)
  if (ids.length < line.qty) {
    // Дополняем в порядке близости к номиналу: уменьшат количество —
    // уйдут самые далёкие от него.
    const add = pickPacks(free, line.qty - ids.length, line.boxes.nominalG, ids).sort(nearerTo(line.boxes.nominalG))
    ids = ids.concat(add.map((pack) => pack.id))
  }
  return { ...line, boxes: { ...line.boxes, packIds: ids } }
}

/**
 * Позиция корзины из товара каталога или из готового снимка.
 * Цена — число или null («цена по запросу»): строку «1 290 ₽» сюда не кладём,
 * иначе сумму пришлось бы разбирать обратно из текста.
 */
function toLine(product, qty, packIds = []) {
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
    boxes: boxesOf(product),
  }
  if (line.boxes) line.boxes.packIds = packIds.filter((id) => typeof id === 'string')
  return fitPacks({ ...line, kind: kindOf(line) })
}

/** Запись из хранилища могла быть поправлена руками или другой версией кода. */
const isValidLine = (line) =>
  line && typeof line.id === 'string' && typeof line.name === 'string' && clampQty(line.qty) > 0

let state = sanitize(loadCart())

/**
 * Вид не доверяем записи — считаем из снимка (см. шапку файла). Коробки
 * тоже: у строки в наличии выбранных ровно qty (fitPacks) — запись другой
 * версии кода или другой вкладки не оставит строку без коробок.
 */
function sanitize({ items, promo }) {
  return {
    items: items
      .filter(isValidLine)
      .map((line) => {
        const next = { ...line, qty: clampQty(line.qty), boxes: sanitizeBoxes(line.boxes) }
        next.kind = kindOf(next)
        next.qty = Math.max(1, Math.min(next.qty, limitOf(next)))
        return fitPacks(next)
      }),
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

/**
 * Положить позицию. Возвращает, сколько добавилось на самом деле и предел
 * строки: у коробок в наличии он равен числу свободных коробок, и кнопка
 * «в корзину» по нему различает обычный тост и «больше положить нельзя».
 * @param {{ packIds?: string[] }} [options] коробки, отмеченные в карточке;
 *   без них — подбор ближайших к номиналу (fitPacks)
 * @returns {{ added: number, max: number }}
 */
export function add(product, qty = 1, { packIds = [] } = {}) {
  const amount = clampQty(qty)
  if (!product || !amount) return { added: 0, max: MAX_QTY }

  const id = String(product.id ?? product.slug)
  const at = state.items.findIndex((line) => line.id === id)
  const existing = at >= 0 ? state.items[at] : null
  const line = existing || toLine(product, amount, packIds)
  const max = limitOf(line)
  const before = existing ? existing.qty : 0
  const next = Math.min(max, before + amount)
  const added = next - before
  if (added <= 0) return { added: 0, max }

  if (existing) {
    // Уже лежит: к выбранным добавляются отмеченные сейчас, остальное подбор.
    const merged = existing.boxes ? { ...existing.boxes, packIds: existing.boxes.packIds.concat(packIds) } : null
    state.items[at] = fitPacks({ ...existing, qty: next, boxes: merged })
  } else {
    state.items.push(fitPacks({ ...line, qty: next }))
  }

  commit()
  return { added, max }
}

/** qty === 0 удаляет позицию: степпер на единице и крестик — одно действие. */
export function setQty(id, qty) {
  const at = state.items.findIndex((item) => item.id === id)
  if (at < 0) return
  const line = state.items[at]
  const next = Math.min(clampQty(qty), limitOf(line))

  if (!next) {
    remove(id)
    return
  }
  if (line.qty === next) return
  state.items[at] = fitPacks({ ...line, qty: next })
  commit()
}

/** Предел количества строки — степперу карточки и корзины. */
export const maxQtyOf = (id) => {
  const line = state.items.find((item) => item.id === id)
  return line ? limitOf(line) : MAX_QTY
}

/**
 * Выбранные коробки строки — окно выбора в корзине и замена купленной
 * коробки перед отправкой. Количество строки следует за списком: сколько
 * коробок отмечено, столько и в строке.
 * @param {string} id
 * @param {string[]} packIds
 */
export function setPacks(id, packIds) {
  const at = state.items.findIndex((item) => item.id === id)
  const line = state.items[at]
  if (!line?.boxes) return
  const ids = [...new Set(packIds)]
  const qty = Math.min(clampQty(ids.length) || line.qty, limitOf(line))
  state.items[at] = fitPacks({ ...line, qty, boxes: { ...line.boxes, packIds: ids } })
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
  state = sanitize({ items: products.map(({ product, qty }) => toLine(product, clampQty(qty) || 1)), promo: '' })
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
 *   order      заказ (stock + preorder): count, positions, sum, approx,
 *              hasStock, hasPreorder, readyAt. Без цены в заказ не попасть;
 *              approx — есть ли в заказе хоть одна приблизительная строка
 *              (коробки под заказ, см. lineSum в summary.js);
 *   request    заявка: count, positions.
 */
export function getTotals() {
  const { items } = state
  const orderItems = items.filter((line) => isOrderKind(line.kind))
  const requestItems = items.filter((line) => line.kind === 'request')
  const byKind = Object.fromEntries(KINDS.map((kind) => [kind, items.filter((line) => line.kind === kind).length]))
  const sums = orderItems.map((line) => lineSum(line))

  return {
    count: items.reduce((n, line) => n + line.qty, 0),
    positions: items.length,
    byKind,
    order: {
      count: orderItems.reduce((n, line) => n + line.qty, 0),
      positions: orderItems.length,
      sum: Math.round(sums.reduce((n, sum) => n + (sum.value || 0), 0) * 100) / 100,
      approx: sums.some((sum) => sum.approx),
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
