/* ============================================================================
   Метка вида позиции: «В наличии», «Под заказ · 7 дней», «По заявке».

   ОДНА НА ВЕСЬ САЙТ. Раньше «под заказ» была мелкой серой припиской
   к фасовке, и её не было видно. Теперь это капсула с обводкой и знаком:
   сетка каталога, карточка товара, ленты, витрина главной. Серверная
   разметка Битрикса повторяет эту до класса (gg_stock_tag в include/catalog.php).

   Вид считает kindOf (src/data/fulfillment.js), тексты — cart-copy.js → kinds.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { icons } from '../icons.js'

const ICONS = { stock: 'check', preorder: 'clock', request: 'dialog' }

/** Разметка метки строкой: карточки собираются шаблонными строками. */
export const stockTagHtml = (kind) => `
  <span class="stock-tag stock-tag--${kind}">
    <span class="stock-tag__icon" aria-hidden="true">${icons[ICONS[kind]]}</span><span class="stock-tag__text">${cartCopy.kinds[kind]}</span>
  </span>`

/** Знак вида без капсулы — строка под заголовком группы в корзине. */
export const kindIcon = (kind) => icons[ICONS[kind]]
