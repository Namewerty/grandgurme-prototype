/* ============================================================================
   Страница /order-success?n=<номер>.

   Номер берётся из адреса, а не из памяти вкладки: страницу можно
   перезагрузить, открыть из письма или прислать ссылкой менеджеру.
   Номера нет — показывается содержимое /404, как у карточки товара
   с несуществующим слагом: «Заказ № принят» без номера — это поломка.

   Заказ из другого браузера (или номер, набранный руками) страница
   тоже не роняет: показывает номер и шаги, но без состава, который ей
   неоткуда взять.
   ============================================================================ */

import { checkoutCopy } from '../../data/checkout-copy.js'
import { contacts } from '../../data/nav.js'
import { ROUTES, staticPages } from '../../data/routes.js'
import { formatDayMonth, fromIsoDay, isSameDay } from '../../data/fulfillment.js'
import { escapeHtml } from '../catalog/model.js'
import { fillText, inStockFirst, lineSumLabel, summaryTexts } from '../cart/summary.js'
import { getOrder } from './submit.js'

const copy = checkoutCopy.success

function renderNotFound(mount) {
  const page = staticPages.find((item) => item.path === ROUTES.notFound)
  document.title = `${page.title} — №1 Гранд Гурмэ`

  mount.className = 'page'
  mount.innerHTML = `
    <div class="page__inner">
      <p class="eyebrow">ОШИБКА 404</p>
      <h1 class="page__title">${page.title}</h1>
      <p class="page__p page__lead">${page.lead}</p>
      <ul class="page__links">
        <li><a href="${ROUTES.catalog}">Каталог</a></li>
        <li><a href="${ROUTES.cart}">Корзина</a></li>
        <li><a href="${ROUTES.contacts}">Контакты</a></li>
        <li><a href="${ROUTES.home}">На главную</a></li>
      </ul>
    </div>`
}

/** Шаги «что дальше». Шаг с оплатой — только если сумма уточняется. */
function stepsOf(order) {
  const s = copy.steps
  const list = [{ title: s.confirm.title, text: s.confirm.text }]

  if (!order) {
    list.push({ title: s.assemble.title }, { title: s.delivery.title })
    return list
  }

  const ready = fromIsoDay(order.totals.readyAt)
  const created = order.createdAt ? new Date(order.createdAt) : new Date()
  list.push({
    title: s.assemble.title,
    text: isSameDay(ready, created) ? s.assemble.today : fillText(s.assemble.later, { date: formatDayMonth(ready) }),
  })

  if (order.totals.onRequestCount) list.push({ title: s.payment.title, text: s.payment.text })

  const date = fromIsoDay(order.when?.date)
  const when = [date && formatDayMonth(date), order.when?.interval].filter(Boolean).join(', ')

  if (order.receive?.method === 'pickup') {
    list.push({ title: s.pickup.title, text: [when, order.receive.point?.address].filter(Boolean).join(' · ') })
  } else {
    list.push({ title: s.delivery.title, text: [when, order.receive?.street].filter(Boolean).join(' · ') })
  }

  return list
}

function itemsBlock(order) {
  if (!order?.items?.length) return ''

  const totals = { ...order.totals, readyAt: fromIsoDay(order.totals.readyAt) }
  const t = summaryTexts(totals)

  return `
    <section class="order-done__block" aria-labelledby="order-items">
      <h2 class="co-label" id="order-items">${copy.itemsTitle}</h2>
      <ul class="order-lines">
        ${inStockFirst(order.items)
          .map(
            (line) => `
          <li class="order-lines__row">
            <span class="order-lines__name">${escapeHtml(line.name)}
              <span class="order-lines__note">${escapeHtml(line.note)} × ${line.qty}</span>
            </span>
            <span class="order-lines__sum">${lineSumLabel(line)}</span>
          </li>`,
          )
          .join('')}
      </ul>
      <p class="order-lines__total"><span>${copy.total}</span><span>${t.total}</span></p>
      ${t.note ? `<p class="summary__note">${t.note}</p>` : ''}
    </section>`
}

export function initOrderSuccess(mount) {
  if (!mount) return

  const number = new URLSearchParams(location.search).get('n')
  if (!number || !/^\d+$/.test(number)) {
    renderNotFound(mount)
    return
  }

  const order = getOrder(number)
  const title = fillText(copy.title, { n: number })
  document.title = `${title} — №1 Гранд Гурмэ`

  mount.className = 'page-order'
  mount.innerHTML = `
    <div class="container">
      <div class="order-done">
        <h1 class="order-done__title">${title}</h1>
        <p class="order-done__lead">${copy.lead}</p>

        <section class="order-done__block" aria-labelledby="order-next">
          <h2 class="co-label" id="order-next">${copy.nextTitle}</h2>
          <ol class="order-steps">
            ${stepsOf(order)
              .map(
                ({ title: stepTitle, text }, i) => `
              <li class="order-steps__item">
                <span class="order-steps__num" aria-hidden="true">${i + 1}</span>
                <span class="order-steps__body">
                  <span class="order-steps__title">${stepTitle}</span>
                  ${text ? `<span class="order-steps__text">${escapeHtml(text)}</span>` : ''}
                </span>
              </li>`,
              )
              .join('')}
          </ol>
        </section>

        ${itemsBlock(order)}

        <section class="order-done__block" aria-labelledby="order-contacts">
          <h2 class="co-label" id="order-contacts">${copy.contactsTitle}</h2>
          <p class="order-done__contacts">
            <a href="${contacts.phoneHref}">${contacts.phone}</a>
            <a href="${contacts.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
            <a href="${contacts.telegram}" target="_blank" rel="noopener">Telegram</a>
          </p>
        </section>

        <div class="order-done__actions">
          <a class="btn btn--solid" href="${copy.actions.catalog.href}">${copy.actions.catalog.label}</a>
          <a class="btn" href="${copy.actions.account.href}">${copy.actions.account.label}</a>
        </div>
      </div>
    </div>`
}
