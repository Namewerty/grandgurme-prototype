/* ============================================================================
   Обзор кабинета /account.

   Блоки сверху вниз: приветствие и телефон · строка «Поступили товары
   из листа ожидания: {n}» (только если такие есть) · «Сейчас в работе»
   (до трёх записей) либо последняя запись, либо пустое состояние ·
   «Избранное» (до четырёх карточек; пустое — блока нет) · пункты кабинета
   списком строк (только уже 1024px, где бокового меню нет) · строка связи.

   Вызывает api.js: getHistory({ type: 'all', page: 1 }) при открытии,
   reorder(n) по кнопке «Повторить заказ», getWaitlist при открытии и по
   waitlist:change. Избранное — из стора.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { ROUTES } from '../../../data/routes.js'
import { escapeHtml } from '../../catalog/model.js'
import * as favorites from '../../favorites/store.js'
import { getHistory, getWaitlist, onWaitlistChange, waitlistStatus } from '../api.js'
import {
  accountTrail,
  contactLinksHtml,
  emptyState,
  fill,
  phoneLabel,
  renderFrame,
  requireUser,
  sectionLinks,
  setTitle,
  watchSession,
} from '../layout.js'
import { createOrderRow } from '../order-row.js'
import { favoriteCard } from './favorites.js'
import { reorderWithToast } from './order.js'

const copy = accountCopy.overview

const ACTIVE_LIMIT = 3
const FAVORITES_LIMIT = 4

const isActive = (row) =>
  row.type === 'order' ? !['done', 'canceled'].includes(row.status) : row.status !== 'closed'

export async function initOverviewPage(mount) {
  const user = requireUser()
  if (!user) return

  setTitle(copy.pageTitle)
  const main = renderFrame(mount, { page: 'overview', trail: accountTrail().slice(0, 1), user })
  watchSession(user.id, mount)

  const name = user.name?.trim()
  main.innerHTML = `
    <h1 class="acc-title" data-hello>${name ? escapeHtml(fill(copy.hello, { name })) : copy.helloNoName}</h1>
    <p class="acc-sub">${phoneLabel(user.phone)}</p>
    <p class="acc-notice" data-wait-notice hidden></p>
    <section class="acc-block" data-work></section>
    <section class="acc-block" data-favs hidden></section>
    <div data-rows></div>
    <p class="acc-contact"><span>${copy.contact}</span> ${contactLinksHtml()}</p>`

  /* ---- поступившие из листа ожидания ------------------------------------- */

  const notice = main.querySelector('[data-wait-notice]')
  async function paintWaitNotice() {
    const items = await getWaitlist()
    const arrived = items.filter((entry) => waitlistStatus(entry) === 'arrived').length
    notice.hidden = !arrived
    if (!arrived) return
    notice.innerHTML = `
      <span>${fill(copy.waitlistNotice, { n: arrived })}</span>
      <a class="link-btn" href="${ROUTES.accountWaitlist}">${copy.waitlistNoticeAction}</a>`
  }
  paintWaitNotice()
  onWaitlistChange(paintWaitNotice)

  /* ---- в работе / последняя запись / пусто ------------------------------- */

  const work = main.querySelector('[data-work]')
  const { items: history, total } = await getHistory({ type: 'all', page: 1 })
  const active = history.filter(isActive).slice(0, ACTIVE_LIMIT)

  const allLink = `<p class="acc-more"><a class="link-btn" href="${ROUTES.accountOrders}">${copy.allHistory}</a></p>`

  if (active.length) {
    work.innerHTML = `<h2 class="acc-block__title">${copy.active}</h2><div class="order-rows" data-list></div>`
    active.forEach((row) => work.querySelector('[data-list]').appendChild(createOrderRow(row)))
    if (total > active.length) work.insertAdjacentHTML('beforeend', allLink)
  } else if (history.length) {
    const last = history[0]
    const isOrder = last.type === 'order'
    work.innerHTML = `
      <h2 class="acc-block__title">${isOrder ? copy.lastOrder : copy.lastRequest}</h2>
      <div class="order-rows" data-list></div>
      <div class="acc-actions">
        ${isOrder ? `<button type="button" class="btn" data-reorder>${copy.reorder}</button>` : ''}
        <a class="link-btn" href="${ROUTES.accountOrders}">${copy.allHistory}</a>
      </div>`
    work.querySelector('[data-list]').appendChild(createOrderRow(last))
    work.querySelector('[data-reorder]')?.addEventListener('click', (event) =>
      reorderWithToast(last.number, event.currentTarget),
    )
  } else {
    work.appendChild(
      emptyState({ icon: 'receipt', title: copy.empty.title, text: copy.empty.text, action: copy.empty.action }),
    )
  }

  /* ---- избранное --------------------------------------------------------- */

  const favs = main.querySelector('[data-favs]')
  function paintFavorites() {
    const items = favorites.list()
    favs.hidden = !items.length
    if (!items.length) return
    favs.innerHTML = `
      <div class="acc-block__head">
        <h2 class="acc-block__title">${copy.favorites}</h2>
        <a class="link-btn" href="${ROUTES.favorites}">${fill(copy.allFavorites, { n: items.length })}</a>
      </div>
      <div class="fav__grid fav__grid--row" data-grid></div>`
    items.slice(0, FAVORITES_LIMIT).forEach((item) => favs.querySelector('[data-grid]').appendChild(favoriteCard(item)))
  }
  paintFavorites()
  favorites.subscribe(paintFavorites)

  main.querySelector('[data-rows]').replaceWith(sectionLinks())
}
