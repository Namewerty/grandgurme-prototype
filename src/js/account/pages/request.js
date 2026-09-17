/* ============================================================================
   Заявка /account/request?r=<номер>.

   Заголовок, дата и статус · «Что дальше» — два шага со страницы «Заказ
   принят» (у закрытой заявки блока нет) · состав: цена каталога приглушённо
   или «Цена по запросу» · вопрос менеджеру, если был · ссылка на заказ, если
   заявка ушла вместе с ним · связь с менеджером.

   ⚠ Что менеджер делает с заявкой дальше, мы не знаем (см. checkout-copy.js →
   success.request): обещаний про оплату здесь нет.

   Вызывает api.js: getRequest(r) при открытии.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { checkoutCopy } from '../../../data/checkout-copy.js'
import { ROUTES } from '../../../data/routes.js'
import { escapeHtml, formatPrice } from '../../catalog/model.js'
import { icons } from '../../icons.js'
import { getRequest } from '../api.js'
import {
  accountTrail,
  contactLinksHtml,
  fill,
  renderFrame,
  requireUser,
  setTitle,
  watchSession,
} from '../layout.js'
import { createdLabel, statusTagHtml } from '../order-row.js'
import { lineRow, renderNotFound } from './order.js'

const copy = accountCopy.request
const next = checkoutCopy.success.request

const capitalize = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text)

export async function initRequestPage(mount) {
  const user = requireUser()
  if (!user) return

  const raw = new URLSearchParams(location.search).get('r')
  const number = raw && /^\d+$/.test(raw) ? raw : null
  const title = number ? fill(copy.pageTitle, { r: number }) : copy.notFound.title

  setTitle(title)
  const main = renderFrame(mount, {
    page: 'orders',
    trail: accountTrail({ label: accountCopy.orders.pageTitle, href: ROUTES.accountOrders }, { label: title }),
    user,
  })
  watchSession(user.id, mount)

  const request = number ? await getRequest(number) : null
  if (!request) {
    setTitle(copy.notFound.title)
    renderNotFound(main, copy.notFound)
    return
  }

  const way = checkoutCopy.request.contactWays.find((item) => item.value === request.contactWay)?.how || ''
  const steps = [
    { title: next.contact.title, text: way ? fill(next.contact.text, { Way: capitalize(way) }) : '' },
    { title: next.clarify.title },
  ]

  main.innerHTML = `
    <h1 class="acc-title">${title}</h1>
    <p class="acc-sub acc-sub--row">
      <span>${fill(copy.from, { date: createdLabel(request.createdAt) })}</span>
      ${statusTagHtml(request.status)}
    </p>

    ${
      request.status === 'closed'
        ? ''
        : `<section class="acc-block">
             <h2 class="co-label">${copy.nextTitle}</h2>
             <ol class="order-steps">
               ${steps
                 .map(
                   (step, i) => `
                 <li class="order-steps__item">
                   <span class="order-steps__num" aria-hidden="true">${i + 1}</span>
                   <span class="order-steps__body">
                     <span class="order-steps__title">${step.title}</span>
                     ${step.text ? `<span class="order-steps__text">${escapeHtml(step.text)}</span>` : ''}
                   </span>
                 </li>`,
                 )
                 .join('')}
             </ol>
           </section>`
    }

    <section class="acc-block">
      <h2 class="co-label">${copy.itemsTitle}</h2>
      <ul class="acc-lines" data-lines></ul>
    </section>

    ${
      request.question
        ? `<section class="acc-block acc-block--plain">
             <h2 class="co-label">${copy.questionTitle}</h2>
             <p>${escapeHtml(request.question)}</p>
           </section>`
        : ''
    }

    ${
      request.orderNumber
        ? `<p class="acc-order__request">
             <a class="acc-rows__row" href="${ROUTES.accountOrder(request.orderNumber)}">
               <span class="acc-rows__label">${fill(copy.withOrder, { n: request.orderNumber })}</span>
               <span class="acc-rows__chevron" aria-hidden="true">${icons.chevronRight}</span>
             </a>
           </p>`
        : ''
    }

    <section class="acc-block acc-block--plain">
      <h2 class="co-label">${copy.contactTitle}</h2>
      <p class="acc-contact">${contactLinksHtml()}</p>
    </section>`

  const list = main.querySelector('[data-lines]')
  request.items.forEach((line) =>
    list.appendChild(
      lineRow(line, {
        // Цена каталога — приглушённо: это ориентир, а не сумма к оплате.
        sum:
          line.price == null
            ? { text: copy.priceOnRequest, muted: true }
            : { text: formatPrice(line.price * line.qty), muted: true },
      }),
    ),
  )
}
