/* ============================================================================
   Добавить позицию и сказать об этом тостом.

   Одна функция на все кнопки «в корзину»: сетка каталога, карточка товара,
   ленты на карточке, витрина главной. Текст тоста зависит от вида позиции
   (src/data/fulfillment.js): «Добавлено в корзину», «… · привезём к 23
   сентября», «Добавлено в заявку менеджеру». Раньше каждая кнопка звала
   store и тост сама, и новый вид пришлось бы разносить по четырём местам.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { formatDayMonth, kindOf, preorderDate } from '../../data/fulfillment.js'
import { fillText } from './summary.js'
import { add } from './store.js'
import { showToast } from './toast.js'

/** Текст тоста для вида позиции. */
export const toastText = (kind, now = new Date()) =>
  fillText(cartCopy.toast[kind], { date: formatDayMonth(preorderDate(now)) })

/**
 * @param {object} product позиция каталога или снимок витрины; categorySlug
 *   обязателен у позиций каталога — от раздела зависит, под заказ это или заявка
 * @param {number} [qty]
 */
export function addWithToast(product, qty = 1) {
  add(product, qty)
  showToast(toastText(kindOf(product)), cartCopy.toast.action)
}
