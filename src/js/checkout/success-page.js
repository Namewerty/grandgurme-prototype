/* ============================================================================
   Страница /order-success?n=<номер заказа>&r=<номер заявки>.

   Номера берутся из адреса, а не из памяти вкладки: страницу можно
   перезагрузить, открыть из письма или прислать ссылкой менеджеру.
   Любого из параметров может не быть:
     только n  — «Заказ №… принят», шаги заказа и состав;
     n и r     — то же, а ниже отдельный блок «Заявка №… у менеджера»;
     только r  — «Заявка №… отправлена», шаги заявки и её состав.
   Нет ни того, ни другого — содержимое /404, как у карточки товара
   с несуществующим слагом: «Заказ № принят» без номера — это поломка.

   Документ из другого браузера (или номер, набранный руками) страница
   тоже не роняет: показывает номер и шаги, но без состава, который ей
   неоткуда взять.

   ⚠ ЧТО МЕНЕДЖЕР ДЕЛАЕТ С ЗАЯВКОЙ ДАЛЬШЕ, МЫ НЕ ЗНАЕМ. Поэтому у заявки
   два шага — «свяжется» и «уточнит цену и срок», без обещаний про оплату.
   ============================================================================ */

import { checkoutCopy } from '../../data/checkout-copy.js'
import { contacts } from '../../data/nav.js'
import { ROUTES, staticPages } from '../../data/routes.js'
import { formatDayMonth, fromIsoDay, isSameDay } from '../../data/fulfillment.js'
import { escapeHtml } from '../catalog/model.js'
import { boxNote, fillText, lineSumLabel, sumLabel } from '../cart/summary.js'
import { getOrder, getRequest } from './submit.js'
import { accountCopy } from '../../data/account-copy.js'
import { currentUser } from '../account/session.js'

const copy = checkoutCopy.success
const accCopy = accountCopy.success

/**
 * Кабинет на странице «Заказ принят» (17.09.2026).
 *   Вошедший — кнопка «Мои заказы» ведёт на этот заказ в кабинете, при одной
 *   заявке — на заявку.
 *   Гость — кнопки нет; под шагами блок «Следите за заказом в кабинете»
 *   со входом: номер из заказа подставится в поле, после входа заказ
 *   привяжется к кабинету по этому номеру и откроется (back).
 */
function accountBlock({ n, r, order, request }) {
  const isOrder = Boolean(n)
  const record = isOrder ? order : request
  const phone = record?.contact?.phone || ''
  const back = isOrder ? ROUTES.accountOrder(n) : ROUTES.accountRequest(r)
  const params = new URLSearchParams(isOrder ? { from: 'order', n, back } : { from: 'request', r, back })

  const text = isOrder
    ? phone
      ? fillText(accCopy.orderText, { phone })
      : accCopy.orderTextNoPhone
    : phone
      ? fillText(accCopy.requestText, { phone })
      : accCopy.requestTextNoPhone

  return `
    <section class="order-done__block order-done__account" aria-labelledby="order-account">
      <h2 class="co-label" id="order-account">${isOrder ? accCopy.orderTitle : accCopy.requestTitle}</h2>
      <p class="order-done__account-text">${escapeHtml(text)}</p>
      <a class="btn" href="${ROUTES.accountLogin}?${params}">${accCopy.login}</a>
    </section>`
}

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

const numberParam = (params, key) => {
  const value = params.get(key)
  return value && /^\d+$/.test(value) ? value : null
}

/** «По телефону», «в WhatsApp» — как способ связи пишется в тексте. */
const wayText = (value) => checkoutCopy.request.contactWays.find((way) => way.value === value)?.how || ''

const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text)

/** «23 сентября, 10:00–14:00 · Тверская, 1». */
function whenWhere(shipment, order) {
  const date = fromIsoDay(shipment?.date)
  const when = [date && formatDayMonth(date), shipment?.interval].filter(Boolean).join(', ')
  const where = order.receive?.method === 'pickup' ? order.receive.point?.address : order.receive?.street
  return [when, where].filter(Boolean).join(' · ')
}

/** Шаги заказа. Две отгрузки — два шага доставки, у каждой свои дата и адрес. */
function orderSteps(order) {
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

  const pickup = order.receive?.method === 'pickup'
  const shipments = order.shipments || []

  if (shipments.length === 2) {
    const [stock, preorder] = shipments
    list.push(
      { title: (pickup ? s.pickupStock : s.deliveryStock).title, text: whenWhere(stock, order) },
      { title: (pickup ? s.pickupPreorder : s.deliveryPreorder).title, text: whenWhere(preorder, order) },
    )
  } else {
    list.push({ title: (pickup ? s.pickup : s.delivery).title, text: whenWhere(shipments[0], order) })
  }

  return list
}

/** Шаги заявки: без обещаний про оплату — порядок работы не подтверждён. */
function requestSteps(request) {
  const r = copy.request
  const way = wayText(request?.contactWay)
  return [
    { title: r.contact.title, text: way ? fillText(r.contact.text, { Way: capitalize(way) }) : '' },
    { title: r.clarify.title },
  ]
}

const stepsList = (steps) => `
  <ol class="order-steps">
    ${steps
      .map(
        ({ title, text }, i) => `
      <li class="order-steps__item">
        <span class="order-steps__num" aria-hidden="true">${i + 1}</span>
        <span class="order-steps__body">
          <span class="order-steps__title">${title}</span>
          ${text ? `<span class="order-steps__text">${escapeHtml(text)}</span>` : ''}
        </span>
      </li>`,
      )
      .join('')}
  </ol>`

/** Подпись строки: у коробок — веса («Коробки 204 и 206 г») или «взвесим при фасовке». */
export const lineNote = (line) => boxNote(line) ?? [line.note, `× ${line.qty}`].filter(Boolean).join(' ')

const linesList = (items, { sums }) => `
  <ul class="order-lines">
    ${items
      .map(
        (line) => `
      <li class="order-lines__row">
        <span class="order-lines__name">${escapeHtml(line.name)}
          <span class="order-lines__note">${escapeHtml(lineNote(line))}</span>
        </span>
        ${sums ? `<span class="order-lines__sum">${lineSumLabel(line)}</span>` : ''}
      </li>`,
      )
      .join('')}
  </ul>`

function orderItemsBlock(order) {
  if (!order?.items?.length) return ''
  const approx = Boolean(order.totals.approx)
  return `
    <section class="order-done__block" aria-labelledby="order-items">
      <h2 class="co-label" id="order-items">${copy.itemsTitle}</h2>
      ${linesList(order.items, { sums: true })}
      <p class="order-lines__total"><span>${copy.total}</span><span>${sumLabel({ value: order.totals.sum, approx })}</span></p>
      ${approx ? `<p class="order-lines__approx">${copy.approxNote}</p>` : ''}
    </section>`
}

function requestItemsBlock(request) {
  if (!request?.items?.length) return ''
  return `
    <section class="order-done__block" aria-labelledby="request-items">
      <h2 class="co-label" id="request-items">${copy.request.itemsTitle}</h2>
      ${linesList(request.items, { sums: false })}
    </section>`
}

export function initOrderSuccess(mount) {
  if (!mount) return

  const params = new URLSearchParams(location.search)
  const n = numberParam(params, 'n')
  const r = numberParam(params, 'r')

  if (!n && !r) {
    renderNotFound(mount)
    return
  }

  const order = n ? getOrder(n) : null
  const request = r ? getRequest(r) : null

  const title = n ? fillText(copy.title, { n }) : fillText(copy.request.title, { r })
  document.title = `${title} — №1 Гранд Гурмэ`

  // Подводка: у заказа — про подтверждение, у одной заявки — способ связи.
  // Способ неизвестен (заявка из другого браузера) — подводки нет, чем
  // писать «свяжется с вами:» с пустым хвостом.
  const way = wayText(request?.contactWay)
  const lead = n ? copy.lead : way ? fillText(copy.request.lead, { way }) : ''

  const orderPart = n
    ? `
      <section class="order-done__block" aria-labelledby="order-next">
        <h2 class="co-label" id="order-next">${copy.nextTitle}</h2>
        ${stepsList(orderSteps(order))}
      </section>
      ${orderItemsBlock(order)}`
    : ''

  // Заявка вместе с заказом — отдельный блок со своим заголовком; одна
  // заявка — те же шаги под общим «Что дальше».
  const requestPart = r
    ? n
      ? `
      <section class="order-done__block order-done__request" aria-labelledby="request-next">
        <h2 class="order-done__subtitle" id="request-next">${fillText(copy.request.blockTitle, { r })}</h2>
        ${stepsList(requestSteps(request))}
      </section>
      ${requestItemsBlock(request)}`
      : `
      <section class="order-done__block" aria-labelledby="request-next">
        <h2 class="co-label" id="request-next">${copy.nextTitle}</h2>
        ${stepsList(requestSteps(request))}
      </section>
      ${requestItemsBlock(request)}`
    : ''

  // Вошедший: «Мои заказы» ведёт прямо на этот заказ, при одной заявке — на неё.
  const loggedIn = Boolean(currentUser())
  const accountHref = n ? ROUTES.accountOrder(n) : ROUTES.accountRequest(r)

  mount.className = 'page-order'
  mount.innerHTML = `
    <div class="container">
      <div class="order-done">
        <h1 class="order-done__title">${title}</h1>
        ${lead ? `<p class="order-done__lead">${escapeHtml(lead)}</p>` : ''}

        ${orderPart}
        ${requestPart}
        ${loggedIn ? '' : accountBlock({ n, r, order, request })}

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
          ${loggedIn ? `<a class="btn" href="${accountHref}">${accCopy.account}</a>` : ''}
        </div>
      </div>
    </div>`
}
