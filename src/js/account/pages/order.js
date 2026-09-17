/* ============================================================================
   Заказ /account/order?n=<номер>.

   Слева — отгрузки (одна или две): шаги, строка получения, состав; ниже
   «Получение», «Оплата» и ссылка на заявку, ушедшую вместе с заказом.
   Справа — сводка .summary (компонент оформления) с «Повторить заказ»
   и связью с менеджером; уже 1024px она стоит под содержимым.

   ОТМЕНИТЬ ИЛИ ИЗМЕНИТЬ ЗАКАЗ ИЗ КАБИНЕТА НЕЛЬЗЯ — для этого связь
   с менеджером. Статуса оплаты и кнопки «Оплатить» нет: онлайн-оплата
   не подтверждена (см. account-copy.js → order.paymentTitle).

   Нет n, n не из цифр, заказ чужой или не найден — «Заказ не найден».

   Вызывает api.js: getOrder(n) при открытии, reorder(n) по кнопке,
   logout() по «Войти с другим номером».
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { checkoutCopy } from '../../../data/checkout-copy.js'
import { ROUTES } from '../../../data/routes.js'
import { showToast } from '../../cart/toast.js'
import { lineSumLabel } from '../../cart/summary.js'
import { escapeHtml, formatPrice } from '../../catalog/model.js'
import { icons } from '../../icons.js'
import { createImage } from '../../media.js'
import { getOrder, logout, reorder } from '../api.js'
import {
  accountTrail,
  contactLinksHtml,
  countLabel,
  fill,
  loginUrl,
  markLeaving,
  positionsLabel,
  renderFrame,
  requireUser,
  setTitle,
  watchSession,
} from '../layout.js'
import { createdLabel, receiveLine, statusTagHtml } from '../order-row.js'

const copy = accountCopy.order

/** «Повторить заказ» с тостом. Кнопка выключена, пока запрос не вернулся. */
export async function reorderWithToast(number, button) {
  if (button) button.disabled = true
  const { added, skipped } = await reorder(number)
  if (button) button.disabled = false

  if (!added) {
    showToast(copy.reorderNone)
    return
  }
  // «Добавили 1 позицию»: после глагола — винительный падеж.
  const n = countLabel(added, accountCopy.plurals.positionsAdded)
  const text = skipped.length
    ? fill(copy.reorderPartial, { n, m: skipped.length })
    : fill(copy.reorderDone, { n })
  showToast(text, copy.reorderAction)
}

/** «Заказ не найден» и «Заявка не найдена» — один вид, разные тексты. */
export function renderNotFound(main, texts) {
  main.innerHTML = `
    <div class="acc-empty acc-empty--left">
      <h1 class="acc-empty__title">${texts.title}</h1>
      <p class="acc-empty__text">${texts.text}</p>
      <div class="acc-actions">
        <a class="btn btn--solid" href="${ROUTES.accountOrders}">${texts.all}</a>
        <button type="button" class="btn" data-relogin>${texts.relogin}</button>
      </div>
    </div>`
  // Выход и вход с возвратом на этот же заказ.
  main.querySelector('[data-relogin]').addEventListener('click', async () => {
    markLeaving()
    await logout()
    location.assign(loginUrl())
  })
}

/** Строка состава: кадр, название ссылкой, фасовка, количество, сумма. */
export function lineRow(line, { sum }) {
  const li = document.createElement('li')
  li.className = 'acc-line'
  li.innerHTML = `
    <span class="acc-line__shot" data-shot></span>
    <span class="acc-line__text">
      <a class="acc-line__name" href="${line.href || ROUTES.catalog}">${escapeHtml(line.name)}</a>
      <span class="acc-line__note">${escapeHtml([line.note, `× ${line.qty}`].filter(Boolean).join(' '))}</span>
    </span>
    ${sum ? `<span class="acc-line__sum${sum.muted ? ' is-estimate' : ''}">${sum.text}</span>` : ''}`
  li.querySelector('[data-shot]').appendChild(
    createImage({ src: line.image || '', alt: '', ratio: '1:1', className: 'media--compact' }),
  )
  return li
}

/** Шаги отгрузки: пройденный, текущий, будущий. */
function stepsHtml(shipment, method) {
  const base = copy.steps[method === 'pickup' ? 'pickup' : 'delivery']
  const codes = shipment.kind === 'preorder' ? [base[0], copy.steps.preorderExtra, ...base.slice(1)] : base
  const at = Math.max(0, codes.indexOf(shipment.status))
  const finished = shipment.status === 'done'

  return `
    <ol class="ship-steps" aria-label="${copy.stepsLabel}">
      ${codes
        .map((code, i) => {
          const state = i < at || finished ? 'done' : i === at ? 'current' : 'next'
          const note = state === 'done' ? copy.stepDone : state === 'current' ? copy.stepCurrent : ''
          return `
          <li class="ship-steps__item is-${state}"${state === 'current' ? ' aria-current="step"' : ''}>
            <span class="ship-steps__dot" aria-hidden="true">${state === 'done' ? icons.check : ''}</span>
            <span class="ship-steps__label">${accountCopy.statuses[code].label}</span>
            ${note ? `<span class="visually-hidden"> — ${note}</span>` : ''}
          </li>`
        })
        .join('')}
    </ol>`
}

function shipmentBlock(order, shipment, { titled }) {
  const section = document.createElement('section')
  section.className = 'ship'
  const items = (shipment.items || []).map((id) => order.items.find((line) => line.id === id)).filter(Boolean)
  const lines = items.length ? items : order.items

  const title =
    titled && shipment.kind !== 'all'
      ? fill(shipment.kind === 'preorder' ? copy.preorderTitle : copy.stockTitle, { n: positionsLabel(lines.length) })
      : ''
  const canceled = order.status === 'canceled'
  const receive = receiveLine(
    { method: order.receive?.method, dates: [{ date: shipment.date, interval: shipment.interval }] },
    order.status,
  )

  section.innerHTML = `
    ${title ? `<h2 class="acc-block__title">${title}</h2>` : ''}
    ${canceled ? '' : stepsHtml(shipment, order.receive?.method)}
    ${receive ? `<p class="ship__receive">${escapeHtml(receive)}</p>` : ''}
    <ul class="acc-lines" aria-label="${copy.itemsLabel}" data-lines></ul>`

  const list = section.querySelector('[data-lines]')
  lines.forEach((line) => list.appendChild(lineRow(line, { sum: { text: lineSumLabel(line) } })))
  return section
}

function receiveText(order) {
  const r = order.receive || {}
  if (r.method === 'pickup') {
    return [copy.receivePickup, [r.point?.name, r.point?.address].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  }
  const address = [
    r.city,
    r.street,
    r.apartment && fill(copy.apartment, { value: r.apartment }),
    r.intercom && fill(copy.intercom, { value: r.intercom }),
  ]
    .filter(Boolean)
    .join(', ')
  return [copy.receiveDelivery, address].filter(Boolean).join(' · ')
}

function deliveryValue(order) {
  const s = checkoutCopy.summary
  if (order.receive?.method === 'pickup') return s.pickupValue
  return (order.shipments || []).length === 2 ? s.deliveryTwo : s.deliveryValue
}

export async function initOrderPage(mount) {
  const user = requireUser()
  if (!user) return

  const raw = new URLSearchParams(location.search).get('n')
  const number = raw && /^\d+$/.test(raw) ? raw : null
  const title = number ? fill(copy.pageTitle, { n: number }) : copy.notFound.title

  setTitle(title)
  const main = renderFrame(mount, {
    page: 'orders',
    trail: accountTrail({ label: accountCopy.orders.pageTitle, href: ROUTES.accountOrders }, { label: title }),
    user,
  })
  watchSession(user.id, mount)

  const order = number ? await getOrder(number) : null
  if (!order) {
    setTitle(copy.notFound.title)
    renderNotFound(main, copy.notFound)
    return
  }

  const payment = checkoutCopy.payment.options.find((option) => option.value === order.payment)?.label || ''
  const canceled = order.status === 'canceled'

  main.innerHTML = `
    <div class="acc-order">
      <div class="acc-order__main">
        <h1 class="acc-title">${title}</h1>
        <p class="acc-sub acc-sub--row">
          <span>${fill(copy.from, { date: createdLabel(order.createdAt) })}</span>
          ${statusTagHtml(order.status)}
        </p>
        ${canceled ? `<p class="acc-order__canceled">${copy.canceled}</p>` : ''}

        <div data-shipments></div>

        <section class="acc-block acc-block--plain">
          <h2 class="co-label">${copy.receiveTitle}</h2>
          <p>${escapeHtml(receiveText(order))}</p>
        </section>

        ${
          payment
            ? `<section class="acc-block acc-block--plain">
                 <h2 class="co-label">${copy.paymentTitle}</h2>
                 <p>${payment}</p>
               </section>`
            : ''
        }

        ${
          order.requestNumber
            ? `<p class="acc-order__request">
                 <a class="acc-rows__row" href="${ROUTES.accountRequest(order.requestNumber)}">
                   <span class="acc-rows__label">${fill(copy.withRequest, { r: order.requestNumber })}</span>
                   <span class="acc-rows__chevron" aria-hidden="true">${icons.chevronRight}</span>
                 </a>
               </p>`
            : ''
        }
      </div>

      <aside class="acc-order__aside summary-sticky" aria-label="${copy.summaryTitle}">
        <div class="summary">
          <h2 class="summary__title">${copy.summaryTitle}</h2>
          <dl class="summary__rows">
            <div class="summary__row"><dt>${copy.count}</dt><dd>${order.totals?.count ?? ''}</dd></div>
            <div class="summary__row"><dt>${copy.sum}</dt><dd>${formatPrice(order.totals?.sum ?? 0)}</dd></div>
            <div class="summary__row"><dt>${copy.delivery}</dt><dd>${deliveryValue(order)}</dd></div>
          </dl>
          <p class="summary__total">
            <span>${copy.total}</span>
            <span class="summary__total-value">${formatPrice(order.totals?.sum ?? 0)}</span>
          </p>
          <button type="button" class="btn btn--solid summary__action" data-reorder>${copy.reorder}</button>
          <p class="summary__note">${copy.change}</p>
          <p class="acc-contact acc-contact--stack">${contactLinksHtml()}</p>
        </div>
      </aside>
    </div>`

  const shipments = order.shipments?.length ? order.shipments : [{ kind: 'all', items: [], status: order.status }]
  const host = main.querySelector('[data-shipments]')
  shipments.forEach((shipment) => host.appendChild(shipmentBlock(order, shipment, { titled: shipments.length > 1 })))

  main
    .querySelector('[data-reorder]')
    .addEventListener('click', (event) => reorderWithToast(order.number, event.currentTarget))
}
