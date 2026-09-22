/* ============================================================================
   Тексты сводки: общие для корзины, оформления и страницы «Заказ принят».
   Чистые функции от итогов — ни DOM, ни хранилища.

   С 16.09.2026 в заказе нет позиций «по запросу» (src/data/fulfillment.js):
   всё без цены — заявка менеджеру, в итог она не входит.

   КОРОБКИ (22.09.2026, src/data/boxes.js). Сумма строки бывает
   приблизительной: у коробок без ручного выбора и у коробок под заказ это
   price × qty с пометкой approx, у ручного выбора и у строки заказа
   с выбранными коробками — сумма цен коробок, точно. Одна функция lineSum
   на корзину, оформление, заказ и кабинет; всё, что показывает суммы,
   берёт её. Сводка с approx пишет «≈ 11 780 ₽».
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { boxLabel, packPrice, packsWord, weightsText } from '../../data/boxes.js'
import { KINDS, formatDayMonth } from '../../data/fulfillment.js'
import { approxLabel, formatPrice, plural } from '../catalog/model.js'
import { findPack } from './boxes.js'

const copy = cartCopy.summary
const boxCopy = cartCopy.boxes

export const fillText = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

export const positionsLabel = (n) => `${n} ${plural(n, 'позиция', 'позиции', 'позиций')}`

/** Позиции, разложенные по видам в порядке групп: наличие, под заказ, заявка. */
export const groupByKind = (items) =>
  KINDS.map((kind) => ({ kind, items: items.filter((line) => line.kind === kind) })).filter(
    (group) => group.items.length,
  )

/** Тот же порядок плоским списком — для свёрнутого состава и страницы успеха. */
export const kindOrder = (items) => groupByKind(items).flatMap((group) => group.items)

/* ---------------------------------------------------------------- коробки */

const round2 = (value) => Math.round(value * 100) / 100

/** Выбранные коробки строки корзины — веса из каталога по id. */
const cartPacks = (line) => (line.boxes?.packIds || []).map((id) => findPack(line.slug, id)).filter(Boolean)

/**
 * Сумма строки: { value, approx }. value null — цены нет.
 *   ручной выбор коробок или строка заказа с выбранными коробками —
 *     сумма цен коробок, точно;
 *   коробки без ручного выбора и коробки под заказ — price × qty, approx;
 *   обычная позиция — price × qty, точно.
 * @param {{ autoIsExact?: boolean }} [options] выбор 'auto' считать точным
 *   (оформление: подбор по номиналу уже сделан)
 */
export function lineSum(line, { autoIsExact = false } = {}) {
  if (line.price == null) return { value: null, approx: false }
  const b = line.boxes
  if (!b) return { value: round2(line.price * line.qty), approx: false }

  // Строка заказа: коробки с ценами уже записаны.
  if (Array.isArray(b.packs)) {
    if (!b.approx && b.packs.length) return { value: round2(b.packs.reduce((n, p) => n + p.price, 0)), approx: false }
    return { value: round2(line.price * line.qty), approx: true }
  }

  const exact = b.picked === 'manual' || (autoIsExact && b.picked === 'auto')
  const packs = exact ? cartPacks(line) : []
  if (exact && packs.length === line.qty) {
    return { value: round2(packs.reduce((n, p) => n + packPrice(b.pricePerKg, p.weightG), 0)), approx: false }
  }
  return { value: round2(line.price * line.qty), approx: true }
}

/** «5 289 ₽» или «≈ 5 160 ₽». */
export const sumLabel = ({ value, approx }) => (approx ? approxLabel(value) : formatPrice(value))

/**
 * Сумма строки словами. У заявки сумма пишется, только если цена известна, —
 * приглушённо (is-estimate): в итог она не входит.
 */
export function lineSumLabel(line, options) {
  const sum = lineSum(line, options)
  return sum.value == null ? cartCopy.line.priceOnRequest : sumLabel(sum)
}

const chosenText = (weights) =>
  fillText(weights.length === 1 ? boxCopy.chosenOne : boxCopy.chosen, { weights: weightsText(weights) })

/**
 * Подпись коробочной строки под названием; null у обычной позиции.
 *   1 коробка, выбор не ручной      «Коробка ≈ 200 г»
 *   n коробок, выбор не ручной      «2 коробки по ≈ 200 г»
 *   ручной выбор (на оформлении)    «Коробки 204 и 206 г» / «Коробка 204 г»
 *   строка заказа с коробками       то же по записанным весам
 *   коробки под заказ в заказе      «… · взвесим при фасовке»
 * Выбор, сделанный системой ('auto'), в корзине не показывается: до
 * оформления человек видит только приблизительное.
 */
export function boxNote(line) {
  const b = line.boxes
  if (!b) return null
  const approx =
    line.qty === 1
      ? boxLabel(b.nominalG)
      : fillText(boxCopy.many, { n: line.qty, word: packsWord(line.qty), g: b.nominalG })

  if (Array.isArray(b.packs)) {
    if (!b.approx && b.packs.length) return chosenText(b.packs.map((p) => p.weightG))
    return `${approx} · ${boxCopy.weighLater}`
  }
  if (b.picked === 'manual') {
    const packs = cartPacks(line)
    if (packs.length) return chosenText(packs.map((p) => p.weightG))
  }
  return approx
}

/** Строка под заголовком группы. */
export const groupLead = (kind, readyAt) =>
  fillText(cartCopy.groups[kind].lead, { date: formatDayMonth(readyAt) })

/**
 * Режим корзины и оформления:
 *   order    только заказ (stock и/или preorder);
 *   both     заказ и заявка;
 *   request  только заявка.
 */
export function modeOf(totals) {
  const hasOrder = totals.order.positions > 0
  const hasRequest = totals.request.positions > 0
  if (hasOrder && hasRequest) return 'both'
  return hasRequest ? 'request' : 'order'
}

/**
 * Всё, что сводка корзины пишет словами, одним объектом.
 * @param {object} totals результат getTotals()
 */
export function summaryTexts(totals) {
  const mode = modeOf(totals)
  const order = totals.order
  const requestCount = positionsLabel(totals.request.positions)
  const orderSum = sumLabel({ value: order.sum, approx: Boolean(order.approx) })

  return {
    mode,
    showOrder: mode !== 'request',
    showRequest: mode !== 'order',
    count: String(order.count),
    sum: orderSum,
    total: orderSum,
    approxNote: order.approx ? copy.approxNote : '',
    splitHint: order.hasStock && order.hasPreorder ? copy.splitHint : '',
    requestNote:
      mode === 'request' ? copy.requestOnly : fillText(copy.requestNote, { n: requestCount }),
    checkout: copy.checkout[mode],
    bar: {
      label: mode === 'request' ? cartCopy.bar.request : cartCopy.bar.total,
      value: mode === 'request' ? requestCount : orderSum,
      isText: mode === 'request',
    },
  }
}
