/* ============================================================================
   Тексты сводки заказа: общие для корзины, оформления и страницы «Заказ
   принят». Чистые функции от итогов — ни DOM, ни хранилища.

   Главное, что здесь решается, — корзина из одних позиций «по запросу».
   По чёрной икре цен в выгрузке нет, поэтому такая корзина самая частая,
   и «Сумма 0 ₽ · Итого 0 ₽ · Оформить заказ» на ней читалось бы как поломка.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { formatReadyDate } from '../../data/fulfillment.js'
import { formatPrice, plural } from '../catalog/model.js'

const copy = cartCopy.summary

export const fillText = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

export const positionsLabel = (n) => `${n} ${plural(n, 'позиция', 'позиции', 'позиций')}`

/** В наличии — наверх, под заказ — вниз; внутри групп порядок добавления. */
export const inStockFirst = (items) => [
  ...items.filter((line) => line.inStock),
  ...items.filter((line) => !line.inStock),
]

export const lineSumLabel = (line) =>
  line.price == null ? cartCopy.line.priceOnRequest : formatPrice(line.price * line.qty)

/** «Банка стекло, 113 г · в наличии». */
export const lineNote = (line) =>
  [line.note, line.inStock ? cartCopy.line.inStock : cartCopy.line.preorder].filter(Boolean).join(' · ')

/**
 * Всё, что сводка пишет словами, одним объектом.
 * @param {object} totals результат getTotals()
 */
export function summaryTexts(totals) {
  const allOnRequest = totals.positions > 0 && totals.onRequestCount === totals.positions

  let note = ''
  if (allOnRequest) note = copy.noteAll
  else if (totals.onRequestCount === 1) note = copy.noteOne
  else if (totals.onRequestCount > 1) note = fillText(copy.noteMany, { n: totals.onRequestCount })

  return {
    allOnRequest,
    count: String(totals.count),
    sum: allOnRequest ? copy.sumOnRequestOnly : formatPrice(totals.sum),
    total: allOnRequest ? copy.totalOnRequestOnly : formatPrice(totals.sum),
    onRequest: totals.onRequestCount ? String(totals.onRequestCount) : '',
    note,
    checkout: allOnRequest ? copy.checkoutOnRequestOnly : copy.checkout,
    ready: totals.hasPreorder
      ? fillText(cartCopy.ready.later, { date: formatReadyDate(totals.readyAt) })
      : cartCopy.ready.today,
  }
}
