/* ============================================================================
   Строка заказа или заявки и метка статуса.

   Одна строка на обзоре кабинета и в списке «Заказы и заявки». Вся строка —
   ОДНА ссылка и один табстоп, внутри h3 с номером. Данные — HistoryRow
   из account/api.js: страница не знает, откуда они взялись.

   .status-tag — компонент того же вида, что .stock-tag: строка со знаком,
   без рамки. Словарь статусов один — accountCopy.statuses.
   ============================================================================ */

import { accountCopy } from '../../data/account-copy.js'
import { formatDate, formatDayMonth, fromIsoDay } from '../../data/fulfillment.js'
import { ROUTES } from '../../data/routes.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { icons } from '../icons.js'
import { createImage } from '../media.js'
import { fill, positionsLabel } from './layout.js'

const copy = accountCopy

/**
 * Метка статуса заказа, отгрузки или заявки. Словарь можно подменить —
 * лист ожидания передаёт свой (accountCopy.waitlist.statuses), вид тот же.
 */
export function statusTagHtml(code, dictionary = copy.statuses) {
  const status = dictionary[code]
  if (!status) return ''
  return `
    <span class="status-tag status-tag--tone-${status.tone} status-tag--mark-${status.mark}">
      <span class="status-tag__icon" aria-hidden="true">${icons[status.icon]}</span><span class="status-tag__text">${status.label}</span>
    </span>`
}

/** «17 сентября 2026» из ISO-строки записи. */
export const createdLabel = (iso) => (iso ? formatDate(new Date(iso)) : '')

/**
 * Строка получения.
 *   одна доставка  «Привезём 18 сентября, 10:00–14:00»
 *   самовывоз      «Самовывоз 18 сентября, 12:00–16:00»
 *   две отгрузки   «Две доставки: 17 и 24 сентября» / «Два визита: …»
 * У отменённого заказа и у записи без дат строки нет.
 */
export function receiveLine({ method, dates }, status) {
  if (status === 'canceled' || !method || !dates?.length) return ''
  const days = dates.map(({ date }) => fromIsoDay(date)).filter(Boolean)
  if (!days.length) return ''

  const pickup = method === 'pickup'
  if (days.length >= 2) {
    const [first, second] = days
    const sameMonth = first.getMonth() === second.getMonth() && first.getFullYear() === second.getFullYear()
    return fill(pickup ? copy.row.twoVisits : copy.row.twoDeliveries, {
      from: sameMonth ? String(first.getDate()) : formatDayMonth(first),
      to: formatDayMonth(second),
    })
  }

  const interval = dates[0].interval
  const template = pickup
    ? interval
      ? copy.row.pickup
      : copy.row.pickupNoInterval
    : interval
      ? copy.row.delivery
      : copy.row.deliveryNoInterval
  return fill(template, { date: formatDayMonth(days[0]), interval })
}

/** @param {import('./api.js').HistoryRow} row */
export function createOrderRow(row) {
  const isOrder = row.type === 'order'
  const link = document.createElement('a')
  link.className = 'order-row'
  link.href = isOrder ? ROUTES.accountOrder(row.number) : ROUTES.accountRequest(row.number)

  const line = isOrder
    ? receiveLine(row.receive, row.status)
    : fill(copy.row.requestPositions, { n: positionsLabel(row.positions) })
  const rest = row.positions - row.previews.length

  link.innerHTML = `
    <div class="order-row__head">
      <h3 class="order-row__title">${fill(isOrder ? copy.row.order : copy.row.request, {
        n: row.number,
        r: row.number,
      })}</h3>
      <span class="order-row__date">${createdLabel(row.createdAt)}</span>
    </div>
    <div class="order-row__state">
      ${statusTagHtml(row.status)}
      ${line ? `<span class="order-row__receive">${escapeHtml(line)}</span>` : ''}
    </div>
    ${row.total == null ? '' : `<span class="order-row__sum">${formatPrice(row.total)}</span>`}
    <span class="order-row__thumbs" data-thumbs></span>
    <span class="order-row__chevron" aria-hidden="true">${icons.chevronRight}</span>`

  const thumbs = link.querySelector('[data-thumbs]')
  row.previews.forEach(({ src }) => {
    // alt пустой: строка уже названа номером заказа, четыре подписи к кадрам
    // скринридер читал бы до самого номера.
    thumbs.appendChild(createImage({ src, alt: '', ratio: '1:1', className: 'media--compact order-row__thumb' }))
  })
  if (rest > 0) {
    const more = document.createElement('span')
    more.className = 'order-row__more'
    more.textContent = fill(copy.row.more, { n: rest })
    thumbs.appendChild(more)
  }

  return link
}
