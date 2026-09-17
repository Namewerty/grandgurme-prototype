/* ============================================================================
   Заказы и заявки /account/orders.

   Капсулы «Все», «Заказы», «Заявки» — только если есть оба типа; выбор
   в адресе: ?type=orders или ?type=requests. Строки — order-row.js, новые
   сверху, по 20; ниже кнопка «Показать ещё».

   Вызывает api.js: getHistory({ type, page }) при открытии, при смене
   капсулы и по «Показать ещё».
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { ROUTES } from '../../../data/routes.js'
import { getHistory } from '../api.js'
import { accountTrail, emptyState, renderFrame, requireUser, setTitle, watchSession } from '../layout.js'
import { createOrderRow } from '../order-row.js'

const copy = accountCopy.orders
const TYPES = ['all', 'orders', 'requests']

const typeFromUrl = () => {
  const value = new URLSearchParams(location.search).get('type')
  return TYPES.includes(value) ? value : 'all'
}

const hrefFor = (type) => (type === 'all' ? ROUTES.accountOrders : `${ROUTES.accountOrders}?type=${type}`)

export async function initOrdersPage(mount) {
  const user = requireUser()
  if (!user) return

  setTitle(copy.pageTitle)
  const main = renderFrame(mount, { page: 'orders', trail: accountTrail({ label: copy.pageTitle }), user })
  watchSession(user.id, mount)

  let type = typeFromUrl()
  let page = 1

  main.innerHTML = `
    <h1 class="acc-title">${copy.pageTitle}</h1>
    <nav class="caps acc-caps" aria-label="${copy.filterLabel}" data-caps hidden></nav>
    <div class="order-rows" data-list></div>
    <p class="acc-more" data-more hidden>
      <button type="button" class="btn" data-more-btn>${copy.more}</button>
    </p>`

  const caps = main.querySelector('[data-caps]')
  const list = main.querySelector('[data-list]')
  const more = main.querySelector('[data-more]')
  const moreBtn = main.querySelector('[data-more-btn]')

  function paintCaps(show) {
    caps.hidden = !show
    caps.innerHTML = TYPES.map(
      (key) => `
      <a class="cap${key === type ? ' is-active' : ''}" href="${hrefFor(key)}" data-type="${key}"${
        key === type ? ' aria-current="true"' : ''
      }><span class="cap__face">${copy.filters[key]}</span></a>`,
    ).join('')
  }

  async function load({ append = false } = {}) {
    const { items, total, hasOrders, hasRequests } = await getHistory({ type, page })

    if (!append) list.replaceChildren()
    paintCaps(hasOrders && hasRequests)

    if (!total && !append) {
      more.hidden = true
      list.appendChild(
        emptyState({ icon: 'receipt', title: copy.empty.title, text: copy.empty.text, action: copy.empty.action }),
      )
      return
    }

    const first = items.map(createOrderRow)
    first.forEach((row) => list.appendChild(row))
    more.hidden = list.children.length >= total
    // После «Показать ещё» фокус уходит на первую из новых строк, а не теряется.
    if (append) first[0]?.focus()
  }

  caps.addEventListener('click', (event) => {
    const cap = event.target.closest('.cap')
    if (!cap || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    type = cap.dataset.type
    page = 1
    history.replaceState(history.state, '', cap.getAttribute('href'))
    load().then(() => caps.querySelector('.cap.is-active')?.focus())
  })

  moreBtn.addEventListener('click', () => {
    page += 1
    load({ append: true })
  })

  await load()
}
