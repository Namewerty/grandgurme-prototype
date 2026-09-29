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
import { categoryCopy } from '../../../data/category-copy.js'
import { bounds, escapeHtml, formatPrice, perKgText, priceText } from '../../catalog/model.js'
import { idlePillMarkup, rangeMarkup, rangeUsable, wireRange } from '../../catalog/range.js'
import { icons } from '../../icons.js'
import { createProductCard } from '../../components/product-card.js'
import * as favorites from '../../favorites/store.js'
import { favoriteFor } from '../../favorites/toggle.js'
import { accountTrail, emptyState, fill, goodsLabel, loginUrl, renderFrame, setTitle } from '../layout.js'
import { currentUser, onChange } from '../session.js'

const copy = accountCopy.favorites
const filtersCopy = categoryCopy.filters
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
    perKg: perKgText(item),
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

/* ------------------------------------------------------------ цена «от — до»

   Тот же диапазон, что у пилюли «Цена» в каталоге (src/js/catalog/range.js):
   разметка, формат чисел и правило «цен мало» общие. Поповер — <details
   class="drop">, как у серверного каталога: отдельного движка поповеров
   ради одной пилюли здесь не заводим. В адресе — ?price=5000-20000, как
   в каталоге. Позиции без цены уходят из выдачи, как только диапазон сужен. */

const priceFromUrl = () => {
  const raw = new URLSearchParams(location.search).get('price')
  if (!raw) return null
  const [min, max] = raw.split('-').map(Number)
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
}

const clampPrice = (value, bound) => {
  if (!value) return { ...bound }
  const min = Math.max(bound.min, Math.min(value.min, bound.max))
  return { min, max: Math.min(bound.max, Math.max(value.max, min)) }
}

const rangeText = (value) => `${formatPrice(value.min)} — ${formatPrice(value.max)}`

const priceActive = (value, bound) => value.min > bound.min || value.max < bound.max

const inPrice = (value) => (item) =>
  typeof item.price === 'number' && item.price >= value.min && item.price <= value.max

/** Адрес избранного с видом и ценой; пустые параметры не пишутся. */
function favoritesUrl(kind, price, bound) {
  const params = new URLSearchParams()
  if (kind) params.set('kind', kind)
  if (price && bound && priceActive(price, bound)) params.set('price', `${price.min}-${price.max}`)
  const query = params.toString()
  return `${ROUTES.favorites}${query ? `?${query}` : ''}`
}

export function initFavoritesPage(mount) {
  setTitle(copy.pageTitle)

  // Строка о снятых позициях живёт, пока страница открыта; из хранилища они
  // уходят сразу после первого показа.
  const droppedCount = favorites.dropped()
  if (droppedCount) favorites.confirmDropped()

  let kind = kindFromUrl()
  let price = priceFromUrl()
  let priceOpen = false
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
    const byKind = kind ? items.filter((item) => item.kind === kind) : items

    // Границы — по всему избранному, выборка для правила «цен мало» — по виду.
    const bound = bounds(items, 'price')
    const range = clampPrice(price, bound)
    const narrowed = priceActive(range, bound)
    const shown = narrowed ? byKind.filter(inPrice(range)) : byKind
    const withPrice = items.length >= 2

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
        kinds.length >= 2 || withPrice
          ? `<div class="fav__filters">
               ${
                 kinds.length >= 2
                   ? `<nav class="caps fav__caps" aria-label="${copy.filterLabel}">
                        ${[null, ...kinds]
                          .map(
                            (k) => `
                          <a class="cap${k === kind ? ' is-active' : ''}" href="${favoritesUrl(k, range, bound)}"
                             data-kind="${k || ''}"${k === kind ? ' aria-current="true"' : ''}>
                            <span class="cap__face">${k ? KIND_LABELS[k] : copy.filterAll}</span>
                          </a>`,
                          )
                          .join('')}
                      </nav>`
                   : ''
               }
               ${withPrice ? pricePill(byKind, bound, range, narrowed) : ''}
             </div>`
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
    if (!shown.length) grid.insertAdjacentHTML('beforeend', `<p class="fav__none">${copy.priceNone}</p>`)

    wirePrice(bound)
  }

  /** Пилюля «Цена»: рабочая — <details> с диапазоном, «цен мало» — неактивная. */
  function pricePill(list, bound, range, narrowed) {
    const label = narrowed ? `${filtersCopy.priceLabel}: ${rangeText(range)}` : filtersCopy.priceLabel
    if (!rangeUsable(list, 'price', bound)) {
      return idlePillMarkup({ id: 'fav-price', key: 'price', label: escapeHtml(label), count: narrowed ? 1 : 0 })
    }
    return `
      <details class="drop fav__price" data-fav-price${priceOpen ? ' open' : ''}>
        <summary class="pill${narrowed ? ' is-active' : ''}">
          ${escapeHtml(label)}
          <span class="pill__chevron">${icons.chevronDown}</span>
        </summary>
        <div class="drop__pop drop__pop--wide">
          ${rangeMarkup({ bound, value: range, unit: '₽', presets: true, key: 'price' })}
          <div class="pop__footer">
            <button type="button" class="link-btn" data-fav-price-reset>${filtersCopy.reset}</button>
          </div>
        </div>
      </details>`
  }

  function setPrice(next, bound) {
    price = next
    history.replaceState(history.state, '', favoritesUrl(kind, clampPrice(price, bound), bound))
    paint()
  }

  function wirePrice(bound) {
    const drop = root.querySelector('[data-fav-price]')
    if (!drop) return
    drop.addEventListener('toggle', () => {
      priceOpen = drop.open
    })
    wireRange(drop, bound, (min, max) => setPrice({ min, max }, bound))
    drop.querySelectorAll('[data-action="preset"]').forEach((button) =>
      button.addEventListener('click', () =>
        setPrice({ min: Number(button.dataset.min), max: Number(button.dataset.max) }, bound),
      ),
    )
    drop.querySelector('[data-fav-price-reset]')?.addEventListener('click', () => setPrice(null, bound))
  }

  // Поповер цены закрывается кликом мимо и Escape — как поповер каталога.
  document.addEventListener('click', (event) => {
    const drop = root?.querySelector('[data-fav-price][open]')
    if (drop && !drop.contains(event.target)) {
      drop.open = false
      priceOpen = false
    }
  })
  document.addEventListener('keydown', (event) => {
    const drop = root?.querySelector('[data-fav-price][open]')
    if (event.key !== 'Escape' || !drop) return
    drop.open = false
    priceOpen = false
    drop.querySelector('summary')?.focus()
  })

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
