/* ============================================================================
   Страница категории. Один шаблон на все разделы каталога.

   ЧТО ЗАДАЁТ КАТЕГОРИЯ, А ЧТО ШАБЛОН
     категория  название, описание, набор фасет (src/data/facets.js)
                и сами товары (src/data/catalog-products.js);
     шаблон     всё остальное: порядок блоков, вёрстка, поведение фильтров,
                сортировки, боттом-шит, пустые состояния.

   Ни одного условия по названию раздела в коде нет — иначе «один шаблон»
   продержался бы ровно до второй категории.

   ПОИСКА ПО РАЗДЕЛУ ЗДЕСЬ БОЛЬШЕ НЕТ. Поле стояло первой строкой блока
   управления, и на одном экране с поиском в шапке оно читалось как дубль:
   два одинаковых на вид инструмента заставляли выбирать между ними, хотя
   правильный ответ — верхний, он ищет по всему сайту. Убрано целиком, а не
   спрятано: модуль catalog/search.js удалён, параметр ?q= из состояния тоже.
   Поиск внутри поповера пилюли (длинные списки значений) — другой инструмент,
   он остался.

   ПОРЯДОК БЛОКОВ

     хлебные крошки                Главная · Каталог · Рыба
     H1 + описание                 чистый текстовый блок
     строка капсул (главная ось)   ВИД РЫБЫ  · множественный выбор
     строка табов (вторая ось)     ОБРАБОТКА · одиночный выбор
     строка наличия                НАЛИЧИЕ · в наличии + капсула «и под заказ»
     панель пилюль                 остальные фасеты │ Сортировка
     золотая линия с индикатором   доля показанного от всего раздела
     «4 в наличии, ещё 48 под заказ» + сброс
     снятие применённых фильтров
     сетка карточек, по 12

   Липкая полоса появляется, когда панель пилюль уходит вверх: на десктопе
   под шапкой, на мобильном — снизу, под большой палец.
   ============================================================================ */

import { categories, subHref } from '../../data/catalog.js'
import { categoryCopy, fill } from '../../data/category-copy.js'
import { PAGE_SIZE, getSchema } from '../../data/facets.js'
import { getProducts } from '../../data/catalog-products.js'
import { ROUTES } from '../../data/routes.js'
import { cartCopy } from '../../data/cart-copy.js'
import { kindOf } from '../../data/fulfillment.js'
import { addWithToast } from '../cart/add.js'
import { createProductCard } from '../components/product-card.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import {
  buildIndex,
  debounce,
  escapeHtml,
  filterAll,
  filterPool,
  formatPrice,
  foundLabel,
  hasAnyActive,
  sortProducts,
  stockFirst,
  stockView,
  totalActive,
} from './model.js'
import { cloneState, defaultState, stateFromUrl, syncUrl } from './state.js'
import * as filters from './filters.js'
import * as sheet from './sheet.js'

const copy = categoryCopy

/* ------------------------------------------------------------- разметка */

function skeleton(category, lead) {
  return `
    <div class="catalog">
      <div class="container">
        <nav class="crumbs" aria-label="Хлебные крошки">
          <a href="${ROUTES.home}">Главная</a>
          <span class="crumbs__sep" aria-hidden="true"></span>
          <a href="${ROUTES.catalog}">Каталог</a>
          <span class="crumbs__sep" aria-hidden="true"></span>
          <span class="crumbs__current" aria-current="page">${escapeHtml(category.name)}</span>
        </nav>

        <!-- Надзаголовка «КАТАЛОГ» здесь нет намеренно: ровно это слово
             стоит строкой выше в хлебных крошках, и два одинаковых слова
             подряд читаются как сбой сборки. -->
        <div class="catalog__head">
          <h1 class="catalog__title">${escapeHtml(category.name)}</h1>
          <p class="catalog__lead">${escapeHtml(lead)}</p>
        </div>

        <!-- Блок управления: подписи осей слева одной колонкой, само
             управление справа. Поля поиска в первой строке больше нет —
             см. шапку файла. -->
        <div class="facets" data-facets>
          <div class="facets__row" data-chips-row hidden>
            <span class="facets__label" data-chips-label></span>
            <div class="facets__rail chips" data-chips></div>
          </div>

          <div class="facets__row" data-tabs-row hidden>
            <span class="facets__label" data-tabs-label></span>
            <div class="facets__rail tabs" data-tabs></div>
          </div>

          <div class="facets__row" data-stock-row hidden>
            <span class="facets__label">${copy.stock.label}</span>
            <div class="facets__rail chips" data-stock></div>
          </div>

          <div class="facets__row facets__row--bar">
            <span class="facets__label">${copy.filters.groupLabel}</span>
            <div class="facets__bar" data-bar></div>
          </div>

          <button type="button" class="pill pill--filters facets__mobile" data-action="open-filters">
            ${copy.sheet.open}<span class="pill__count" data-mobile-count hidden>0</span>
          </button>
        </div>

        <div class="catalog__rule" aria-hidden="true"><span data-indicator></span></div>

        <div class="catalog__status">
          <p class="catalog__found" data-found aria-live="polite"></p>
          <div data-reset></div>
        </div>

        <div class="catalog__applied is-empty" data-applied></div>

        <div class="catalog__grid" data-grid></div>
        <div class="catalog__more" data-more></div>
      </div>
    </div>

    <div class="catalog-sticky" data-sticky></div>
    <div id="catalog-popover" role="dialog" aria-modal="false" aria-label="Фильтр"></div>

    <div class="sheet-scrim" data-scrim></div>
    <div class="sheet" data-sheet role="dialog" aria-modal="true" aria-label="${copy.sheet.title}">
      <div class="sheet__head">
        <span class="sheet__handle" aria-hidden="true"></span>
        <h2 class="sheet__title">${copy.sheet.title}</h2>
        <button type="button" class="icon-btn" data-action="close-sheet">
          ${icons.close}<span class="visually-hidden">${copy.sheet.close}</span>
        </button>
      </div>
      <div class="sheet__body" data-sheet-body></div>
      <div class="sheet__footer">
        <button type="button" class="link-btn" data-action="sheet-reset">${copy.sheet.reset}</button>
        <button type="button" class="btn btn--solid" data-action="sheet-apply" data-sheet-apply></button>
      </div>
    </div>`
}

/** Раздел без выгрузки товаров: честный текст и вход в подкатегории. */
function pendingMarkup(category) {
  return `
    <div class="catalog">
      <div class="container">
        <nav class="crumbs" aria-label="Хлебные крошки">
          <a href="${ROUTES.home}">Главная</a>
          <span class="crumbs__sep" aria-hidden="true"></span>
          <a href="${ROUTES.catalog}">Каталог</a>
          <span class="crumbs__sep" aria-hidden="true"></span>
          <span class="crumbs__current" aria-current="page">${escapeHtml(category.name)}</span>
        </nav>

        <div class="catalog__head">
          <h1 class="catalog__title">${escapeHtml(category.name)}</h1>
          <p class="catalog__lead">${escapeHtml(category.lead)}</p>
        </div>

        <p class="catalog__pending">${copy.pending.text}</p>

        <div class="catalog__subs">
          ${category.subs
            .map(
              (sub) =>
                `<a class="chip" href="${subHref(category.slug, sub.slug)}">${escapeHtml(sub.name)}</a>`,
            )
            .join('')}
        </div>
      </div>
    </div>`
}

/* ------------------------------------------------------------- контекст */

function createContext(category, mount) {
  const products = getProducts(category.slug)
  const schema = getSchema(category.slug)
  const index = buildIndex(products, schema)

  const els = {
    chipsRow: mount.querySelector('[data-chips-row]'),
    chips: mount.querySelector('[data-chips]'),
    tabsRow: mount.querySelector('[data-tabs-row]'),
    tabs: mount.querySelector('[data-tabs]'),
    stockRow: mount.querySelector('[data-stock-row]'),
    stock: mount.querySelector('[data-stock]'),
    bar: mount.querySelector('[data-bar]'),
    mobileCount: mount.querySelector('[data-mobile-count]'),
    indicator: mount.querySelector('[data-indicator]'),
    found: mount.querySelector('[data-found]'),
    reset: mount.querySelector('[data-reset]'),
    applied: mount.querySelector('[data-applied]'),
    grid: mount.querySelector('[data-grid]'),
    more: mount.querySelector('[data-more]'),
    facets: mount.querySelector('[data-facets]'),
    sticky: mount.querySelector('[data-sticky]'),
    sheet: mount.querySelector('[data-sheet]'),
    sheetBody: mount.querySelector('[data-sheet-body]'),
    sheetApply: mount.querySelector('[data-sheet-apply]'),
    scrim: mount.querySelector('[data-scrim]'),
  }

  const ctx = {
    category,
    slug: category.slug,
    products,
    schema,
    index,
    els,
    favorites: new Set(),
    lenis: getLenis(),
    state: null,
  }

  ctx.state = stateFromUrl(schema, index, category.slug)

  /** Точечная замена состояния целиком — ею пользуется боттом-шит. */
  ctx.replaceState = (next) => {
    ctx.state = next
    syncUrl(ctx.state, ctx.index)
    render(ctx)
  }

  ctx.setState = (patch, { keepPage = false } = {}) => {
    ctx.state = { ...cloneState(ctx.state), ...patch }
    if (!keepPage) ctx.state.page = 1
    syncUrl(ctx.state, ctx.index)
    render(ctx)
  }

  ctx.setValues = (key, values) => {
    const next = cloneState(ctx.state)
    next.values[key] = values
    ctx.setState({ values: next.values })
  }

  ctx.toggleValue = (key, value) => {
    const list = ctx.state.values[key].slice()
    const at = list.indexOf(value)
    if (at === -1) list.push(value)
    else list.splice(at, 1)
    ctx.setValues(key, list)
  }

  ctx.setRange = (key, min, max) => {
    const ranges = { ...ctx.state.ranges, [key]: { min, max } }
    ctx.setState({ ranges })
  }

  ctx.resetAll = () => {
    const next = defaultState(ctx.schema, ctx.index)
    next.sort = ctx.state.sort
    ctx.replaceState(next)
  }

  return ctx
}

/* -------------------------------------------------------------- карточка */

function badgeFor(product) {
  if (product.isNew) return { kind: 'new', label: copy.card.badgeNew }
  if (product.isSale) return { kind: 'sale', label: copy.card.badgeSale }
  if (product.oldPrice) {
    return { kind: 'discount', label: `−${Math.round((1 - product.price / product.oldPrice) * 100)}%` }
  }
  return null
}

function buildCard(ctx, product) {
  // Раздел у позиции берётся из страницы: от него зависит, под заказ это
  // или заявка (kindOf в src/data/fulfillment.js).
  const item = { ...product, categorySlug: ctx.category.slug }
  const kind = kindOf(item)

  return createProductCard({
    name: product.name,
    note: product.weightLabel,
    // У каждой позиции свой адрес: карточка открывает именно её, а не общий
    // шаблон. Страницы по этим слагам генерируются из тех же данных
    // (см. productPages в src/data/routes.js).
    href: ROUTES.product(product.slug),
    // Цены может не быть вовсе: в выгрузке 1С по чёрной икре её нет.
    price: product.price == null ? copy.card.priceOnRequest : formatPrice(product.price),
    oldPrice: product.oldPrice ? formatPrice(product.oldPrice) : null,
    image: { src: product.photo, ratio: '1:1' },
    badge: badgeFor(product),
    favorite: {
      active: ctx.favorites.has(product.id),
      label: copy.card.fav,
      onToggle: (on) => (on ? ctx.favorites.add(product.id) : ctx.favorites.delete(product.id)),
    },
    add: {
      label: cartCopy.addLabel[kind],
      onAdd: () => addWithToast(item),
    },
    kind,
  })
}

/* ----------------------------------------------------------------- сетка */

function renderGrid(ctx) {
  const filtered = filterAll(ctx.products, ctx.state, ctx.index)
  // Под заказ — после наличия при любой сортировке: сначала то, что привезут
  // сегодня, потом то, что через неделю.
  const sorted = stockFirst(sortProducts(filtered, ctx.state.sort))
  const visible = sorted.slice(0, ctx.state.page * PAGE_SIZE)

  ctx.els.grid.innerHTML = ''
  ctx.els.more.innerHTML = ''

  if (!filtered.length) {
    renderEmpty(ctx)
  } else {
    const fragment = document.createDocumentFragment()
    visible.forEach((product) => fragment.appendChild(buildCard(ctx, product)))
    ctx.els.grid.appendChild(fragment)

    if (visible.length < sorted.length) {
      const rest = Math.min(PAGE_SIZE, sorted.length - visible.length)
      ctx.els.more.innerHTML = `
        <button type="button" class="btn" data-action="load-more">
          ${copy.results.loadMore} ${rest}
        </button>`
    }
  }

  return filtered.length
}

/** Первый снятый фильтр — подсказка «попробуйте убрать…». */
function firstActiveLabel(ctx) {
  for (const [, list] of Object.entries(ctx.state.values)) {
    if (list.length) return list[0]
  }
  return null
}

function renderEmpty(ctx) {
  const label = firstActiveLabel(ctx)
  const hint = label
    ? fill(copy.results.emptyHintWithFilter, { filter: label })
    : copy.results.emptyHint

  const often = ctx.products.slice().sort((a, b) => b.popularity - a.popularity).slice(0, 4)

  ctx.els.grid.classList.add('is-empty')
  ctx.els.grid.innerHTML = `
    <div class="empty">
      <span class="empty__mark" aria-hidden="true">${icons.emptyFish}</span>
      <h2 class="empty__title">${copy.results.emptyTitle}</h2>
      <p class="empty__hint">${escapeHtml(hint)}</p>
      <button type="button" class="btn" data-action="reset-all">${copy.results.emptyAction}</button>
      <div class="empty__often">
        <p class="eyebrow">${copy.results.oftenPicked}</p>
        <div class="catalog__grid" data-often></div>
      </div>
    </div>`

  const often_mount = ctx.els.grid.querySelector('[data-often]')
  often.forEach((product) => often_mount.appendChild(buildCard(ctx, product)))
}

/**
 * Счётчик над сеткой. Пишет обе цифры, пока есть что сказать про заказ:
 * «4 в наличии, ещё 48 под заказ» — и когда позиции под заказ скрыты, и
 * когда показаны. Иначе человек не узнает, что за четырьмя банками стоит
 * ещё полсотни позиций.
 */
function foundText(ctx, found) {
  const stock = copy.stock
  const view = stockView(filterPool(ctx.products, ctx.state, ctx.index), ctx.state)

  if (ctx.schema.stock === false || !found || !view.preorder) {
    return `${copy.results.found} <b>${foundLabel(found)}</b>`
  }
  if (!view.inStock) return `<b>${fill(stock.foundPreorderOnly, view)}</b>`
  return `<b>${fill(stock.found, view)}</b>, ${fill(stock.foundRest, view)}`
}

/* ---------------------------------------------------------------- рендер */

export function render(ctx) {
  ctx.els.grid.classList.remove('is-empty')
  const found = renderGrid(ctx)

  // Число найденного считается ДО перерисовки полос управления: липкая полоса
  // показывает его же, а собирается она заново и при открытии поповера тоже.
  ctx.found = found

  filters.renderChipsRow(ctx)
  filters.renderTabsRow(ctx)
  filters.renderStockRow(ctx)
  filters.renderBar(ctx)
  filters.renderAppliedChips(ctx)
  filters.renderSticky(ctx)

  ctx.els.found.innerHTML = foundText(ctx, found)
  ctx.els.reset.innerHTML = hasAnyActive(ctx.state, ctx.index, ctx.schema)
    ? `<button type="button" class="link-btn" data-action="reset-all">${copy.filters.resetAll}</button>`
    : ''

  // Индикатор — доля показанного от всего раздела. Тот же приём, что кольцо
  // прогресса на главной: волосяная линия, по ней золотой отрезок.
  const share = ctx.products.length ? (found / ctx.products.length) * 100 : 0
  ctx.els.indicator.style.width = `${Math.max(0, Math.min(100, share))}%`

  const active = totalActive(ctx.state, ctx.index, ctx.schema)
  ctx.els.mobileCount.textContent = String(active)
  ctx.els.mobileCount.hidden = active === 0

  if (filters.isPopoverOpen()) {
    filters.renderPopover(ctx)
    filters.positionPopover()
  }
  if (sheet.isSheetOpen()) sheet.renderSheet(ctx)
}

/* -------------------------------------------------------------- действия */

function handleAction(ctx, action, el) {
  const key = el.dataset.key
  const value = el.dataset.value

  if (sheet.handleSheetAction(ctx, action, el)) return

  switch (action) {
    case 'chip':
      ctx.toggleValue(ctx.schema.chips.key, value)
      return
    case 'chip-all':
      ctx.setValues(ctx.schema.chips.key, [])
      return
    case 'tab': {
      const current = ctx.state.values[ctx.schema.tabs.key][0] || ''
      ctx.setValues(ctx.schema.tabs.key, !value || value === current ? [] : [value])
      return
    }
    case 'pill':
      if (filters.isMobile()) sheet.openSheet(ctx)
      else filters.openPopover(ctx, key, el)
      return
    case 'stock-preorder':
      ctx.setState({ withPreorder: !ctx.state.withPreorder })
      return
    case 'toggle-facet':
      ctx.toggleValue(key, value)
      filters.renderPopover(ctx)
      filters.positionPopover()
      return
    case 'toggle-benefit': {
      const list = ctx.state.benefits.includes(value)
        ? ctx.state.benefits.filter((item) => item !== value)
        : [...ctx.state.benefits, value]
      ctx.setState({ benefits: list })
      filters.renderPopover(ctx)
      filters.positionPopover()
      return
    }
    case 'reset-facet':
      ctx.setValues(key, [])
      filters.renderPopover(ctx)
      return
    case 'reset-benefit':
      ctx.setState({ benefits: [] })
      filters.renderPopover(ctx)
      return
    case 'reset-range': {
      const bound = ctx.index.ranges[key]
      ctx.setRange(key, bound.min, bound.max)
      filters.renderPopover(ctx)
      return
    }
    case 'preset':
      ctx.setRange(key, Number(el.dataset.min), Number(el.dataset.max))
      filters.renderPopover(ctx)
      return
    case 'sort':
      ctx.setState({ sort: value })
      if (filters.isPopoverOpen()) filters.closePopover(ctx)
      return
    case 'clear-facet':
      ctx.setValues(key, ctx.state.values[key].filter((item) => item !== value))
      return
    case 'clear-benefit':
      ctx.setState({ benefits: ctx.state.benefits.filter((item) => item !== value) })
      return
    case 'clear-range': {
      const bound = ctx.index.ranges[key]
      ctx.setRange(key, bound.min, bound.max)
      return
    }
    case 'reset-all':
      ctx.resetAll()
      return
    case 'load-more':
      ctx.setState({ page: ctx.state.page + 1 }, { keepPage: true })
      return
    case 'open-filters':
      if (filters.isMobile()) sheet.openSheet(ctx)
      else {
        ctx.els.facets.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    case 'close-sheet':
      sheet.closeSheet(ctx)
      return
    case 'sheet-reset':
      sheet.resetSheet(ctx)
      return
    case 'sheet-apply':
      sheet.applySheet(ctx)
      return
    default:
  }
}

/* ------------------------------------------------------------ подписки */

function wire(ctx) {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]')

    if (!target) {
      if (!event.target.closest('#catalog-popover') && !event.target.closest('.pill')) {
        if (filters.isPopoverOpen()) filters.closePopover(ctx, { restoreFocus: false })
      }
      return
    }

    // Ссылки-подсказки уводят на другую страницу — обработчик им не нужен.
    if (target.tagName === 'A') return

    handleAction(ctx, target.dataset.action, target)
  })

  ctx.els.scrim.addEventListener('click', () => sheet.closeSheet(ctx))

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (filters.isPopoverOpen()) filters.closePopover(ctx)
    if (sheet.isSheetOpen()) sheet.closeSheet(ctx)
  })

  /* Липкая полоса. Появляется, когда панель фильтров ушла вверх; поповер
     при этом либо едет за своей пилюлей, либо закрывается, если она
     уехала с экрана. */
  const header = document.querySelector('[data-header]')

  // Считаем прямо в обработчике, без requestAnimationFrame: в фоновой вкладке
  // rAF не вызывается, и полоса замирала бы в том положении, в каком её застал
  // уход со страницы. Замер дешёвый — два getBoundingClientRect.
  const onScroll = () => {
    const rect = ctx.els.facets.getBoundingClientRect()
    ctx.els.sticky.classList.toggle('is-visible', rect.bottom < (header ? header.offsetHeight : 0))
    filters.keepPopoverInPlace(ctx)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', debounce(() => filters.positionPopover(), 100))
  onScroll()
}

/* ------------------------------------------------------------------ init */

/** Категория по адресу /catalog/<slug>. */
export function findCategory(pathname = location.pathname) {
  const clean = pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')
  const slug = clean.startsWith('/catalog/') ? clean.slice('/catalog/'.length) : null
  return categories.find((category) => category.slug === slug) || null
}

export function initCategoryPage(mount) {
  const category = findCategory()
  if (!mount || !category) return null

  const products = getProducts(category.slug)
  document.title = `${category.name} — №1 Гранд Гурмэ`

  if (!products.length) {
    mount.className = 'page-catalog'
    mount.innerHTML = pendingMarkup(category)
    return null
  }

  mount.className = 'page-catalog'
  mount.innerHTML = skeleton(category, category.lead)

  const ctx = createContext(category, mount)

  // Строки главных осей рисуются только если они у раздела есть: у бакалеи
  // их не будет вовсе, и пустая подпись «ВИД» над пустой строкой выглядела бы
  // недоделкой, а не отсутствием фасеты.
  if (ctx.schema.chips) {
    ctx.els.chipsRow.hidden = false
    mount.querySelector('[data-chips-label]').textContent = ctx.schema.chips.label
  }
  if (ctx.schema.tabs) {
    ctx.els.tabsRow.hidden = false
    mount.querySelector('[data-tabs-label]').textContent = ctx.schema.tabs.label
  }

  render(ctx)
  syncUrl(ctx.state, ctx.index)
  wire(ctx)

  return ctx
}
