/* ============================================================================
   Лист ожидания /account/waitlist (22.09.2026).

   Позиции, о поступлении которых человек просил сообщить СМС («Сообщить
   о поступлении» на карточке товара). Только у вошедшего: СМС уходит на
   номер кабинета, гостевого листа нет.

   Строки в стиле ul.acc-lines страницы заказа: кадр, название ссылкой,
   подпись, справа статус (.status-tag) и действия. Статус считается
   по каталогу при показе (waitlistStatus в api.js), не хранится:
     Поступил             главная кнопка по виду позиции — «В корзину» или
                          «Добавить в заявку»; после нажатия позиция кладётся
                          в корзину и уходит из листа; рядом «Не сообщать»;
     Ждём поступления     «В листе с {date}», действие «Не сообщать»;
     Больше не продаётся  только «Убрать».
   Порядок: сначала поступившие, потом ожидаемые, последними снятые; внутри
   групп новые сверху. «Не сообщать» и «Убрать» — строка уходит, тост
   с «Вернуть» ставит её на прежнее место.

   Вызывает api.js: getWaitlist при открытии и по waitlist:change,
   removeFromWaitlist, restoreToWaitlist; корзину — addWithToast.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { productCopy } from '../../../data/product-copy.js'
import { findProductBySlug } from '../../../data/catalog-products.js'
import { formatDate, kindOf } from '../../../data/fulfillment.js'
import { addWithToast } from '../../cart/add.js'
import { showToast } from '../../cart/toast.js'
import { escapeHtml } from '../../catalog/model.js'
import { createImage } from '../../media.js'
import { getWaitlist, onWaitlistChange, removeFromWaitlist, restoreToWaitlist, waitlistStatus } from '../api.js'
import { accountTrail, emptyState, fill, phoneLabel, renderFrame, requireUser, setTitle, watchSession } from '../layout.js'
import { statusTagHtml } from '../order-row.js'

const copy = accountCopy.waitlist
const ORDER = ['arrived', 'waiting', 'gone']

/** Убрать с тостом «Вернуть» — одно действие для «Не сообщать» и «Убрать». */
async function removeWithToast(id) {
  const removed = await removeFromWaitlist(id)
  showToast(copy.toastRemoved, {
    label: copy.toastUndo,
    onClick: () => removed && restoreToWaitlist(removed.entry, removed.index),
  })
}

function lineRow(entry) {
  const status = waitlistStatus(entry)
  const product = status === 'gone' ? null : findProductBySlug(entry.slug)
  const kind = product ? kindOf(product) : null

  const li = document.createElement('li')
  li.className = `acc-line acc-line--wait is-${status}`
  li.dataset.waitId = entry.id

  const actions =
    status === 'arrived'
      ? `<button type="button" class="btn btn--solid" data-wait-add>${
          kind === 'request' ? productCopy.buy.addRequest : productCopy.buy.add
        }</button>
         <button type="button" class="link-btn" data-wait-off>${copy.off}</button>`
      : status === 'waiting'
        ? `<button type="button" class="link-btn" data-wait-off>${copy.off}</button>`
        : `<button type="button" class="link-btn" data-wait-off>${copy.remove}</button>`

  const since = status === 'waiting' && entry.addedAt ? fill(copy.since, { date: formatDate(new Date(entry.addedAt)) }) : ''

  li.innerHTML = `
    <span class="acc-line__shot" data-shot></span>
    <span class="acc-line__text">
      <a class="acc-line__name" href="${entry.href}">${escapeHtml(entry.name)}</a>
      ${entry.note ? `<span class="acc-line__note">${escapeHtml(entry.note)}</span>` : ''}
      ${since ? `<span class="acc-line__note">${escapeHtml(since)}</span>` : ''}
    </span>
    <span class="acc-line__side">
      ${statusTagHtml(status, copy.statuses)}
      <span class="acc-line__actions">${actions}</span>
    </span>`

  li.querySelector('[data-shot]').appendChild(
    createImage({ src: entry.image || '', alt: '', ratio: '1:1', className: 'media--compact' }),
  )

  li.querySelector('[data-wait-off]').addEventListener('click', () => removeWithToast(entry.id))
  li.querySelector('[data-wait-add]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true
    // Позиция из каталога — с разделом, ценой и наличием на сегодня.
    addWithToast(product)
    await removeFromWaitlist(entry.id)
  })

  return li
}

export async function initWaitlistPage(mount) {
  const user = requireUser()
  if (!user) return

  setTitle(copy.pageTitle)
  const main = renderFrame(mount, { page: 'waitlist', trail: accountTrail({ label: copy.pageTitle }), user })
  watchSession(user.id, mount)

  main.innerHTML = `
    <h1 class="acc-title">${copy.pageTitle}</h1>
    <p class="acc-sub">${escapeHtml(fill(copy.lead, { phone: phoneLabel(user.phone) }))}</p>
    <div data-list></div>`

  const host = main.querySelector('[data-list]')

  async function paint() {
    const items = await getWaitlist()
    host.replaceChildren()

    if (!items.length) {
      host.appendChild(emptyState({ icon: 'bell', title: copy.empty.title, text: copy.empty.text, action: copy.empty.action }))
      return
    }

    // Стабильная сортировка: внутри группы порядок листа (новые сверху) сохраняется.
    const sorted = items
      .map((entry) => ({ entry, rank: ORDER.indexOf(waitlistStatus(entry)) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ entry }) => entry)

    const list = document.createElement('ul')
    list.className = 'acc-lines acc-lines--wait'
    list.setAttribute('aria-label', copy.itemsLabel)
    sorted.forEach((entry) => list.appendChild(lineRow(entry)))
    host.appendChild(list)
  }

  await paint()
  onWaitlistChange(paint)
}
