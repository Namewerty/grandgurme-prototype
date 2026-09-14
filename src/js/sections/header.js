/* ============================================================================
   Верхняя полоса, шапка, выпадающие панели и мобильное меню.

   Полоса не sticky: уезжает вверх вместе с потоком и не возвращается.
   Шапка sticky: над hero прозрачная и светлая, после hero — фон --pearl,
   нижняя золотая волосяная линия и тёмное содержимое, переход 400 мс.

   Состав шапки зафиксирован заказчиком и держится намеренно скудным:

     полоса  Доставка и оплата · Бутики · Контакты   |   телефон · Мессенджеры
     слева   [КАТАЛОГ] · ИКРА · ПОДАРКИ
     центр   логотип
     справа  КОМПАНИЯ · [ПОИСК ПО КАТАЛОГУ] · избранное · аккаунт · корзина

   Текстовых пунктов ровно четыре, пятый добавлять нельзя — всё остальное
   раскрывается внутри выпадающих панелей. «Каталог» оформлен капсулой
   с тремя линиями: это главная точка входа в ассортимент, и она должна
   отличаться от соседей, а не стоять с ними в один ряд.

   ШЕВРОН — ОБЕЩАНИЕ, А НЕ УКРАШЕНИЕ. Заказчик просил различать пункты,
   которые ведут на страницу, и пункты, которые раскрывают панель. Шеврон
   ставится ТОЛЬКО там, где панель действительно есть, и вопрос «есть ли»
   задаётся реестру сборщиков (hasPanel из nav/panels.js), а не полю panel
   в данных: поле — заявка на будущее, реестр — факт. Сейчас панели две,
   каталог и компания; появится панель «Икры» — шеврон у неё возникнет сам,
   без правок здесь.

   СЕЛЕКТОРА РЕГИОНА В ШАПКЕ НЕТ. Заказчик отказался явно; города живут
   на странице бутиков и в блоке «Офлайн» на главной.

   Плотное состояние шапки складывается из двух причин — ушёл hero ИЛИ
   открыта панель. Полупрозрачная шапка поверх раскрытой панели выглядит
   грязно, поэтому открытие панели переводит её в плотное состояние
   принудительно. Обе причины сведены в applyHeaderSkin(), иначе они
   перетирали бы друг друга.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  brandName,
  cart,
  navActions,
  navCatalog,
  navPrimary,
  navSecondary,
  topbar,
} from '../../data/nav.js'
import { companyPanel } from '../../data/company.js'
import { ROUTES } from '../../data/routes.js'
import { brand } from '../../data/media.js'
import { createLogo, hydrateMedia } from '../media.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import { hasPanel, panelRegistry } from '../nav/panels.js'
import { initMegamenu } from '../nav/megamenu.js'
import { initSearch } from '../nav/search.js'
import { getTotals, subscribe as onCartChange } from '../cart/store.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Причины плотной шапки. Складываются по ИЛИ. */
const skin = { pastHero: false, panelOpen: false }
let headerEl = null

function applyHeaderSkin() {
  if (!headerEl) return

  const solid = skin.pastHero || skin.panelOpen
  headerEl.classList.toggle('is-solid', solid)

  // Логотип в прозрачной шапке белый, в плотной — тёмный.
  // Если svg не подгрузился, media.js заменил его вордмарком — тогда img нет.
  const logoImg = headerEl.querySelector('.header__logo img')
  if (logoImg) logoImg.src = solid ? brand.logo : brand.logoWhite
}

/* ------------------------------------------------------------ полоса */

const topbarLink = ({ label, href, external }) =>
  `<a class="topbar__link" href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`

/**
 * Пункт полосы с поповером («Мессенджеры»). Это ссылка, а не кнопка: без JS
 * и на мобильном она уходит на запасной адрес из данных, а не в никуда.
 * На десктопе клик перехватывается и раскрывает список.
 */
const topbarMenu = ({ label, href, menu }) => `
  <span class="topbar__menu" data-topbar-menu>
    <a class="topbar__link topbar__link--menu" href="${href}"
       aria-haspopup="menu" aria-expanded="false">
      ${label}<span class="topbar__caret" aria-hidden="true">${icons.chevronDown}</span>
    </a>
    <span class="topbar__pop" role="menu" hidden>
      ${menu
        .map(
          ({ label: item, href: to, external }) =>
            `<a class="topbar__pop-link" role="menuitem" href="${to}"${
              external ? ' target="_blank" rel="noopener"' : ''
            }>${item}</a>`,
        )
        .join('')}
    </span>
  </span>
`

const topbarItem = (item) => (item.menu ? topbarMenu(item) : topbarLink(item))

/**
 * Поповеры полосы. Открыт всегда один; закрывается повторным нажатием, Esc
 * и кликом вне. Стрелки ходят по пунктам списка — их всего два, но
 * клавиатурный контракт role="menu" обещает именно это.
 */
function initTopbarMenus(root) {
  const menus = [...root.querySelectorAll('[data-topbar-menu]')].map((wrap) => ({
    wrap,
    trigger: wrap.querySelector('.topbar__link--menu'),
    pop: wrap.querySelector('.topbar__pop'),
    items: [...wrap.querySelectorAll('.topbar__pop-link')],
  }))
  if (!menus.length) return

  const setOpen = (menu, open) => {
    menu.wrap.classList.toggle('is-open', open)
    menu.trigger.setAttribute('aria-expanded', String(open))
    menu.pop.hidden = !open
  }

  const closeAll = (except) => menus.forEach((m) => m !== except && setOpen(m, false))

  menus.forEach((menu) => {
    menu.trigger.addEventListener('click', (event) => {
      event.preventDefault()
      const open = !menu.wrap.classList.contains('is-open')
      closeAll(menu)
      setOpen(menu, open)
      if (open) menu.items[0]?.focus()
    })

    menu.wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(menu, false)
        menu.trigger.focus()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return

      const step = event.key === 'ArrowDown' ? 1 : -1
      const at = menu.items.indexOf(document.activeElement)
      if (at === -1 && document.activeElement !== menu.trigger) return

      event.preventDefault()
      if (!menu.wrap.classList.contains('is-open')) setOpen(menu, true)
      const next = at === -1 ? 0 : (at + step + menu.items.length) % menu.items.length
      menu.items[next].focus()
    })
  })

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-topbar-menu]')) closeAll()
  })
  // Уход табом за пределы поповера закрывает его: висящий список над уехавшей
  // полосой читается как мусор на странице.
  document.addEventListener('focusin', (event) => {
    if (!event.target.closest('[data-topbar-menu]')) closeAll()
  })
}

function renderTopbar(mount) {
  if (!mount) return

  mount.className = 'topbar'
  mount.innerHTML = `
    <div class="container">
      <div class="topbar__inner">
        <p class="topbar__item">${topbar.start.map(topbarLink).join('<span class="topbar__sep" aria-hidden="true"></span>')}</p>
        <p class="topbar__item topbar__item--end">${topbar.end.map(topbarItem).join('<span class="topbar__sep" aria-hidden="true"></span>')}</p>
      </div>
    </div>
  `

  initTopbarMenus(mount)
}

/* ------------------------------------------------------------- шапка */

/** Шеврон рисуем только у пунктов, у которых панель действительно есть. */
const chevron = `<span class="nav__chevron" aria-hidden="true">${icons.chevronDown}</span>`

const navLink = ({ label, href, panel }) => {
  const opens = hasPanel(panel)
  return `
    <a class="nav__link${opens ? ' nav__link--panel' : ''}" href="${href}"${
      opens ? ` data-panel-trigger="${panel}"` : ''
    }>${label}${opens ? chevron : ''}</a>
  `
}

/**
 * Иконка справа. Поиск — кнопка, а не ссылка: он не уводит со страницы,
 * а разворачивает строку прямо в шапке (см. nav/search.js). Остальные —
 * настоящие ссылки на избранное и личный кабинет.
 *
 * ПОИСК — КАПСУЛА, А НЕ ЛУПА. Заказчик просил выделить его явно, возможно
 * словом; пятым пунктом меню слово стоять не может, поэтому поиск оформлен
 * как инструмент — компактное «поле», зеркальное капсуле «Каталог» слева.
 * Это по-прежнему <button> с data-search-trigger: механика раскрытия строки
 * (nav/search.js) не тронута вовсе, сменилась только точка входа. Настоящий
 * <input> здесь стоять не может — по нажатию поле в шапке разворачивается
 * во всю ширину, и два поля подряд читались бы как подмена.
 *
 * Обе видимые подписи скрыты от скринридера, имя кнопке даёт одна
 * visually-hidden строка: иначе она озвучивалась бы дважды.
 */
const actionLink = ({ key, label, href, action, field, short }) =>
  action === 'search'
    ? `<button class="search-btn" type="button" data-search-trigger aria-haspopup="dialog">
         <span class="search-btn__icon" aria-hidden="true">${icons[key]}</span>
         <span class="search-btn__text search-btn__text--full" aria-hidden="true">${field}</span>
         <span class="search-btn__text search-btn__text--short" aria-hidden="true">${short}</span>
         <span class="visually-hidden">${label}</span>
       </button>`
    : `<a class="icon-btn" href="${href}">
         ${icons[key]}
         <span class="visually-hidden">${label}</span>
       </a>`

function renderHeader(mount) {
  if (!mount) return

  const cartCount = getTotals().count

  mount.innerHTML = `
    <div class="container">
      <div class="header__inner">
        <div class="header__side header__side--start">
          <button class="icon-btn burger" type="button"
                  aria-expanded="false" aria-controls="nav-panel">
            <span class="burger__box" aria-hidden="true"></span>
            <span class="visually-hidden">Открыть меню</span>
          </button>

          <a class="catalog-btn" href="${navCatalog.href}"
             data-panel-trigger="${navCatalog.panel}">
            <span class="catalog-btn__icon" aria-hidden="true">${icons.menuLines}</span>
            <span class="catalog-btn__label">${navCatalog.label}</span>
            <span class="catalog-btn__chevron" aria-hidden="true">${icons.chevronDown}</span>
          </a>

          <nav class="nav" aria-label="Разделы">
            ${navPrimary.map(navLink).join('')}
          </nav>
        </div>

        <div class="header__logo-slot"></div>

        <div class="header__side header__side--end">
          <nav class="nav" aria-label="О компании">
            ${navSecondary.map(navLink).join('')}
          </nav>

          <div class="header__actions">
            ${navActions.map(actionLink).join('')}
            <a class="icon-btn cart-btn" href="${cart.href}">
              ${icons.cart}
              <span class="cart-btn__count" data-count="${cartCount}" aria-hidden="true">${cartCount}</span>
              <span class="visually-hidden" aria-live="polite">Корзина, товаров: ${cartCount}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `

  // На главной логотип уводит к первому экрану через Lenis, на остальных
  // страницах — обычной ссылкой на корень.
  const logo = createLogo({
    src: brand.logoWhite,
    name: brandName.name,
    num: brandName.num,
    className: 'header__logo',
    href: document.querySelector('#hero') ? '#hero' : ROUTES.home,
  })
  mount.querySelector('.header__logo-slot').replaceWith(logo)
}

/* ------------------------------------------------------ счётчик корзины */

/**
 * Бейдж корзины слушает cart:change сам. Раньше каждая кнопка «в корзину»
 * дёргала его руками, и любая новая кнопка была шансом забыть.
 *
 * Стартовое число здесь НЕ перерисовывается: в прототипе шапку только что
 * собрали с числом из хранилища, а на Битриксе число пришло с сервера
 * из sale.basket и правдивее того, что лежит в браузере.
 */
function watchCartBadge(header) {
  const badge = header.querySelector('.cart-btn__count')
  if (!badge) return

  const label = badge.parentElement?.querySelector('.visually-hidden')

  onCartChange(({ totals }) => {
    const count = totals.count
    if (badge.dataset.count === String(count)) return

    badge.textContent = String(count)
    badge.dataset.count = String(count)
    if (label) label.textContent = `Корзина, товаров: ${count}`

    if (REDUCED || !count) return
    gsap.fromTo(
      badge,
      { scale: 1 },
      { scale: 1.35, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 },
    )
  })
}

/* ------------------------------------------- состояние «после hero» */

function watchHeaderState(header) {
  const hero = document.querySelector('#hero')
  if (!hero) {
    // Внутренняя страница: hero нет, шапка сразу плотная.
    skin.pastHero = true
    applyHeaderSkin()
    return
  }

  ScrollTrigger.create({
    trigger: hero,
    start: () => `bottom top+=${header.offsetHeight}`,
    onEnter: () => {
      skin.pastHero = true
      applyHeaderSkin()
    },
    onLeaveBack: () => {
      skin.pastHero = false
      applyHeaderSkin()
    },
  })
}

/* --------------------------------------------- текущая страница в меню */

/**
 * Помечает ссылки на текущую страницу — в шапке, в панелях и в подвале.
 * Раньше активный пункт вычислялся по секции под курсором прокрутки;
 * теперь пункты меню ведут на настоящие адреса, и правда о «текущем»
 * одна — location.pathname.
 */
function markCurrentLinks() {
  const here = location.pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')
  if (here === '/') return

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || !href.startsWith('/')) return
    if (href.split('?')[0] !== here) return

    link.classList.add('is-active')
    link.setAttribute('aria-current', 'page')
  })
}

/* ------------------------------------------------- выпадающие панели */

function initPanels(header, onToggle, ssr = false) {
  const items = []

  header.querySelectorAll('[data-panel-trigger]').forEach((trigger) => {
    const key = trigger.dataset.panelTrigger
    const factory = panelRegistry[key]
    // Панели ещё нет — пункт остаётся обычной ссылкой.
    if (!factory) return

    /* На Битриксе панель уже отрисована сервером: её содержимое должно быть
       в исходном html, иначе меню каталога не видит поисковик. Здесь мы её
       только находим и оживляем. В прототипе — собираем на месте. */
    const panel = ssr ? header.querySelector(`[data-panel="${key}"]`) : factory.build()
    if (!panel) return
    if (!ssr) header.appendChild(panel)
    hydrateMedia(panel)

    items.push({ key, trigger, panel, api: factory.init?.(panel) })
  })

  if (!items.length) return null

  return initMegamenu({
    header,
    items,
    onToggle: (isOpen) => {
      skin.panelOpen = isOpen
      applyHeaderSkin()
      onToggle?.(isOpen)
    },
  })
}

/* ------------------------------------------------- мобильная панель */

function renderNavPanel(mount) {
  if (!mount) return

  // Крупными строками — только товарные входы. Информационные страницы идут
  // ниже колонками: на мобильном выпадающих панелей нет, и без этого блока
  // содержимое «Компании» было бы доступно только из подвала.
  const links = [navCatalog, ...navPrimary]

  mount.id = 'nav-panel'
  mount.className = 'nav-panel'
  mount.setAttribute('aria-hidden', 'true')
  mount.innerHTML = `
    <div class="container">
      <div class="nav-panel__head">
        <span class="wordmark">
          <span class="wordmark__num">${brandName.num}</span><span>${brandName.name}</span>
        </span>
        <button class="icon-btn" type="button" data-nav-close>
          ${icons.close}
          <span class="visually-hidden">Закрыть меню</span>
        </button>
      </div>

      <div class="nav-panel__body">
        <nav class="nav-panel__list" aria-label="Разделы">
          ${links
            .map(({ label, href }) => `<a class="nav-panel__link" href="${href}">${label}</a>`)
            .join('')}
        </nav>

        <nav class="nav-panel__cols" aria-label="Информация">
          ${companyPanel.columns
            .map(
              ({ title, links: items }) => `
            <div class="nav-panel__col">
              <h2 class="nav-panel__col-title eyebrow">${title}</h2>
              ${items
                .map(({ label, href }) => `<a class="nav-panel__sublink" href="${href}">${label}</a>`)
                .join('')}
            </div>`,
            )
            .join('')}
        </nav>

        <div class="nav-panel__meta">
          ${topbar.start.map(({ label, href }) => `<a href="${href}">${label}</a>`).join('')}
          ${navActions
            .filter((item) => item.action !== 'search')
            .map(({ label, href }) => `<a href="${href}">${label}</a>`)
            .join('')}
          ${topbar.end
            .flatMap((item) => item.menu ?? [item])
            .map(
              ({ label, href, external }) =>
                `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`,
            )
            .join('')}
        </div>
      </div>
    </div>
  `
}

function wireNavPanel(header, panel) {
  const burger = header.querySelector('.burger')
  if (!burger || !panel) return

  const close = panel.querySelector('[data-nav-close]')

  const setOpen = (open) => {
    panel.classList.toggle('is-open', open)
    panel.setAttribute('aria-hidden', String(!open))
    burger.setAttribute('aria-expanded', String(open))
    document.body.classList.toggle('is-locked', open)

    const lenis = getLenis()
    if (lenis) open ? lenis.stop() : lenis.start()

    if (open) close?.focus()
    else burger.focus()
  }

  burger.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')))
  close?.addEventListener('click', () => setOpen(false))

  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) setOpen(false)
  })

  // Ушли на десктоп с открытой панелью — закрываем, иначе останется блокировка.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
    if (event.matches && panel.classList.contains('is-open')) setOpen(false)
  })
}

/* ------------------------------------------------------------- init */

/**
 * @param {{ ssr?: boolean }} [options] ssr — разметка шапки уже пришла
 *   с сервера (шаблон Битрикса): рисовать заново нельзя, нужно только
 *   поднять поведение.
 */
export function initHeader({ ssr = false } = {}) {
  const header = document.querySelector('[data-header]')
  const panel = document.querySelector('#nav-panel')

  if (ssr) {
    const topbarEl = document.querySelector('#topbar')
    if (topbarEl) initTopbarMenus(topbarEl)
  } else {
    renderTopbar(document.querySelector('#topbar'))
    renderHeader(header)
    renderNavPanel(panel)
  }

  if (!header) return

  headerEl = header
  wireNavPanel(header, panel)
  watchHeaderState(header)
  watchCartBadge(header)

  /* Поиск и выпадающие панели гасят друг друга: строка поиска занимает место
     содержимого шапки, и оставшаяся под ней раскрытая панель висела бы
     непонятно от чего. Ссылка на поиск объявлена заранее — панели поднимаются
     первыми, а в их onToggle он уже нужен. */
  let search = null
  const megamenu = initPanels(
    header,
    (isOpen) => {
      if (isOpen) search?.close()
    },
    ssr,
  )

  search = initSearch({
    header,
    triggers: [...header.querySelectorAll('[data-search-trigger]')],
    onOpen: () => megamenu?.close(),
  })

  // Открытая строка поиска переводит шапку в плотное состояние по той же
  // причине, что и панель: полупрозрачная шапка поверх раскрытой панели
  // подсказок выглядит грязно.
  header.addEventListener('search:toggle', (event) => {
    skin.panelOpen = event.detail.open
    applyHeaderSkin()
  })

  markCurrentLinks()
}
