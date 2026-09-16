/* ============================================================================
   Тексты сводки: общие для корзины, оформления и страницы «Заказ принят».
   Чистые функции от итогов — ни DOM, ни хранилища.

   С 16.09.2026 в заказе нет позиций «по запросу» (src/data/fulfillment.js):
   всё без цены — заявка менеджеру, в итог она не входит. Поэтому сводка
   заказа всегда пишет точную сумму, а заявка — только число позиций.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { KINDS, formatDayMonth } from '../../data/fulfillment.js'
import { formatPrice, plural } from '../catalog/model.js'

const copy = cartCopy.summary

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

/**
 * Сумма строки. У заявки сумма пишется, только если цена известна, —
 * приглушённо (is-estimate): в итог она не входит.
 */
export const lineSumLabel = (line) =>
  line.price == null ? cartCopy.line.priceOnRequest : formatPrice(line.price * line.qty)

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

  return {
    mode,
    showOrder: mode !== 'request',
    showRequest: mode !== 'order',
    count: String(order.count),
    sum: formatPrice(order.sum),
    total: formatPrice(order.sum),
    splitHint: order.hasStock && order.hasPreorder ? copy.splitHint : '',
    requestNote:
      mode === 'request' ? copy.requestOnly : fillText(copy.requestNote, { n: requestCount }),
    checkout: copy.checkout[mode],
    bar: {
      label: mode === 'request' ? cartCopy.bar.request : cartCopy.bar.total,
      value: mode === 'request' ? requestCount : formatPrice(order.sum),
      isText: mode === 'request',
    },
  }
}
