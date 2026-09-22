/* ============================================================================
   Избранное /favorites.

   Работает без входа: у гостя избранное лежит в браузере, страница идёт
   во всю ширину контейнера с плашкой «Войдите…». У вошедшего — каркас
   кабинета, сетка в колонках 4–12. Откуда берутся позиции, решает стор
   (src/js/favorites/store.js); страница о хранилище не знает.

   Капсулы по виду позиции — только виды, которые есть, и только если их два
   и больше; выбор в адресе ?kind=stock|preorder|request. Порядок — новые
   сверху. Убрали сердцем — карточка сворачивается за 250 мс, тост с «Вернуть»
   ставит её на прежнее место.

   Вход или выход в соседней вкладке перерисовывает страницу целиком:
   гостевая и кабинетная — разные каркасы.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { cartCopy } from '../../../data/cart-copy.js'
import { KINDS } from '../../../data/fulfillment.js'
import { ROUTES } from '../../../data/routes.js'
import { addWithToast } from '../../cart/add.js'
import { priceText } from '../../catalog/model.js'
import { createProductCard } from '../../components/product-card.js'
import * as favorites from '../../favorites/store.js'
import { favoriteFor } from '../../favorites/toggle.js'
import { accountTrail, emptyState, fill, goodsLabel, loginUrl, renderFrame, setTitle } from '../layout.js'
import { currentUser, onChange } from '../session.js'

const copy = accountCopy.favorites
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const COLLAPSE_MS = 250

/** Короткие названия видов для капсул: «Под заказ», без срока. */
const KIND_LABELS = {
  stock: cartCopy.groups.stock.title,
  preorder: cartCopy.groups.preorder.title,
  request: cartCopy.kinds.request,
}

/** Карточка позиции избранного — общий компонент каталога. Нужна и обзору кабинета. */
export function favoriteCard(item) {
  const card = createProductCard({
    name: item.name,
    note: item.note,
    href: item.href,
    price: priceText(item) ?? cartCopy.line.priceOnRequest,
    image: { src: item.image || '', ratio: '1:1' },
    favorite: favoriteFor(item),
    add: { label: cartCopy.addLabel[item.kind], onAdd: () => addWithToast(item) },
    kind: item.kind,
  })
  card.dataset.favCard = item.id
  return card
}

const kindFromUrl = () => {
  const value = new URLSearchParams(location.search).get('kind')
  return KINDS.includes(value) ? value : null
}

export function initFavoritesPage(mount) {
  setTitle(copy.pageTitle)

  // Строка о снятых позициях живёт, пока страница открыта; из хранилища они
  // уходят сразу после первого показа.
  const droppedCount = favorites.dropped()
  if (droppedCount) favorites.confirmDropped()

  let kind = kindFromUrl()
  let root = null

  function frame() {
    const user = currentUser()
    if (user) {
      root = renderFrame(mount, {
        page: 'favorites',
        trail: accountTrail({ label: copy.pageTitle }),
        user,
      })
      root.classList.add('fav', 'fav--account')
    } else {
      mount.className = 'page-account page-favorites'
      mount.innerHTML = `
        <div class="container">
          <nav class="crumbs" aria-label="Хлебные крошки">
            <a href="${ROUTES.home}">${accountCopy.crumbs.home}</a>
            <span class="crumbs__sep" aria-hidden="true"></span>
            <span class="crumbs__current" aria-current="page">${copy.pageTitle}</span>
          </nav>
          <div class="fav" data-fav-root></div>
        </div>`
      root = mount.querySelector('[data-fav-root]')
    }
    paint()
  }

  function paint() {
    const items = favorites.list()
    const guest = !currentUser()
    const kinds = KINDS.filter((k) => items.some((item) => item.kind === k))
    if (kind && !kinds.includes(kind)) kind = null
    const shown = kind ? items.filter((item) => item.kind === kind) : items

    root.innerHTML = `
      <h1 class="acc-title">${copy.pageTitle}</h1>
      ${items.length ? `<p class="acc-sub" data-fav-count>${goodsLabel(items.length)}</p>` : ''}
      ${
        guest && items.length
          ? `<div class="fav__guest">
               <p>${copy.guest.text}</p>
               <a class="btn" href="${loginUrl(ROUTES.favorites)}">${copy.guest.action}</a>
             </div>`
          : ''
      }
      ${
        droppedCount
          ? `<p class="fav__dropped">${fill(droppedCount === 1 ? copy.droppedOne : copy.dropped, {
              n: goodsLabel(droppedCount),
            })}</p>`
          : ''
      }
      ${
        kinds.length >= 2
          ? `<nav class="caps fav__caps" aria-label="${copy.filterLabel}">
               ${[null, ...kinds]
                 .map(
                   (k) => `
                 <a class="cap${k === kind ? ' is-active' : ''}" href="${ROUTES.favorites}${k ? `?kind=${k}` : ''}"
                    data-kind="${k || ''}"${k === kind ? ' aria-current="true"' : ''}>
                   <span class="cap__face">${k ? KIND_LABELS[k] : copy.filterAll}</span>
                 </a>`,
                 )
                 .join('')}
             </nav>`
          : ''
      }
      <div class="fav__grid" data-fav-grid></div>`

    if (!items.length) {
      root.querySelector('[data-fav-grid]').replaceWith(
        emptyState({ icon: 'heart', title: copy.empty.title, text: copy.empty.text, action: copy.empty.action }),
      )
      return
    }

    const grid = root.querySelector('[data-fav-grid]')
    shown.forEach((item) => grid.appendChild(favoriteCard(item)))
  }

  /** Капсулы — ссылки с настоящим адресом; без перезагрузки меняем на месте. */
  mount.addEventListener('click', (event) => {
    const cap = event.target.closest('.fav__caps .cap')
    if (!cap || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    kind = cap.dataset.kind || null
    history.replaceState(history.state, '', cap.getAttribute('href'))
    paint()
    root.querySelector('.fav__caps .cap.is-active')?.focus()
  })

  /**
   * Состав поменялся. Убранная карточка сворачивается и только потом
   * страница перерисовывается; всё остальное (вернули, соседняя вкладка) —
   * перерисовка сразу.
   */
  favorites.subscribe(({ items }) => {
    const ids = new Set(items.map((item) => item.id))
    const gone = [...root.querySelectorAll('[data-fav-card]')].filter((card) => !ids.has(card.dataset.favCard))
    const visible = kind ? items.filter((item) => item.kind === kind) : items
    const appeared = visible.some((item) => !root.querySelector(`[data-fav-card="${CSS.escape(item.id)}"]`))

    if (!gone.length || appeared || REDUCED) {
      paint()
      return
    }
    gone.forEach((card) => card.classList.add('is-leaving'))
    setTimeout(paint, COLLAPSE_MS)
  })

  // Вход или выход в другой вкладке: гостевая страница и каркас кабинета.
  onChange(frame)

  frame()
}
