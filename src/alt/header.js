/* ============================================================================
   Шапка альтернативной версии. Копия src/js/sections/header.js.
   ЧЕРНОВИК НА ВЫБРОС.

   ЗАЧЕМ КОПИЯ. Эксперимент с шапкой — это в первую очередь другая разметка,
   а не другие строки в данных: правая группа перестала быть одним пунктом
   и стала тремя, у неё появился свой типографический вес и разделитель,
   а сам состав пересобирается при смене брейкпоинта. Параметризовать
   оригинал под все варианты значило бы править основной код ради черновика.

   ЧТО ИЗМЕНИЛОСЬ ПРОТИВ ОСНОВНОЙ ШАПКИ

     полоса  Доставка и оплата · Бутики · Контакты  |  телефон · Мессенджеры
     слева   [КАТАЛОГ] · Подарки
     центр   логотип
     справа  Покупателям · Компания · Партнёрам │ [Поиск] · аккаунт · корзина

   1. «Икра» убрана, панель «Компания» разобрана на три пункта — состав
      в src/alt/nav.js, там же и мотивировки.

   2. Группы разведены по смыслу и по сторонам: слева то, где выбирают
      и покупают, справа то, где отвечают на вопросы. Это уже не пять равных
      пунктов в ряд, а две группы по разные стороны логотипа.

   3. Три информационных пункта — на ступень мельче товарных (класс
      .nav--info, оформление в alt.css). ЭТО ГЛАВНЫЙ ПРИЁМ ПРОТИВ
      НАГРОМОЖДЕНИЯ: три слова читаются как одна служебная строка, а не как
      три конкурента каталогу, и ни один пункт при этом не удалён.

   4. Волосяной вертикальный разделитель между группой ссылок и группой
      иконок справа — тот же приём, что разделители в верхней полосе.
      Отделяет «навигацию» от «действий» и успокаивает правый край.

   5. Иконка «Избранное» убрана — см. src/alt/nav.js.

   ПОВЕДЕНИЕ НА УЗКИХ ЭКРАНАХ

     ≥ 1360px      три пункта: Покупателям · Компания · Партнёрам;
     1024–1359px   три пункта схлопываются обратно в один «Компания»
                   с прежней трёхколоночной панелью — содержимое не теряется
                   ни на строку, данные те же, меняется только раскладка входа;
     < 1024px      как в основной версии: бургер и полноэкранная панель меню.

   Схлопывание сделано НА ДАННЫХ: шапка спрашивает у matchMedia, сколько
   пунктов собирать, и пересобирает правую группу при смене брейкпоинта.
   Прятать лишние пункты через display: none нельзя — они остались бы
   в дереве доступности и в табуляции, и скринридер объявил бы четыре пункта
   вместо одного.

   Всё остальное — верхняя полоса с поповерами, состояние «после hero»,
   мобильная панель, взаимное гашение поиска и панелей — перенесено как есть.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { brandName, cart, navCatalog, navCompany, topbar } from '../data/nav.js'
import { companyPanel } from '../data/company.js'
import { ROUTES } from '../data/routes.js'
import { brand } from '../data/media.js'
import { createLogo, hydrateMedia } from '../js/media.js'
import { icons } from '../js/icons.js'
import { getLenis } from '../js/scroll.js'
import { initMegamenu } from '../js/nav/megamenu.js'
import { initSearch } from '../js/nav/search.js'
import { hasPanel, isMiniPanel, panelRegistry } from './panels.js'
import { positionMiniPanel } from './info-panel.js'
import { altNavActions, altNavPrimary, infoItems } from './nav.js'

gsap.registerPlugin(ScrollTrigger)

/** Граница, на которой три информационных пункта схлопываются в один. */
const wideMQ = window.matchMedia('(min-width: 1360px)')

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
 * а разворачивает строку прямо в шапке (см. nav/search.js).
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

/**
 * Состав правой текстовой группы для текущей ширины.
 *
 * Широкий режим — три пункта из src/alt/nav.js. Узкий — один «Компания»
 * с исходной трёхколоночной панелью: ключ панели company, сборщик
 * переиспользован из основного кода.
 */
const infoNavItems = () =>
  wideMQ.matches
    ? infoItems.map(({ label, href, panel }) => ({ label, href, panel }))
    : [{ label: navCompany.label, href: navCompany.href, panel: 'company' }]

function renderInfoNav(header) {
  const nav = header?.querySelector('[data-info-nav]')
  if (!nav) return
  nav.innerHTML = infoNavItems().map(navLink).join('')
}

function renderHeader(mount) {
  if (!mount) return

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
            ${altNavPrimary.map(navLink).join('')}
          </nav>
        </div>

        <div class="header__logo-slot"></div>

        <div class="header__side header__side--end">
          <nav class="nav nav--info" aria-label="Информация" data-info-nav></nav>

          <span class="header__divider" aria-hidden="true"></span>

          <div class="header__actions">
            ${altNavActions.map(actionLink).join('')}
            <a class="icon-btn cart-btn" href="${cart.href}">
              ${icons.cart}
              <span class="cart-btn__count" data-count="${cart.count}">${cart.count}</span>
              <span class="visually-hidden">Корзина, товаров: ${cart.count}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `

  renderInfoNav(mount)

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

/**
 * Затемнение, поднятое предыдущим megamenu. Держим ссылку именно на свой
 * узел: класс .nav-scrim носит ещё и затемнение строки поиска (search.js),
 * и снести все подряд значило бы сломать поиск при первой же смене
 * брейкпоинта. Своего опознавательного знака megamenu.js затемнению не
 * ставит, поэтому вычисляем его как узел, появившийся после initMegamenu.
 */
let ownScrim = null

/**
 * Собирает панели под пункты шапки и поднимает общий megamenu.
 *
 * Зовётся заново при смене брейкпоинта 1360px: правая группа пересобрана,
 * значит старые панели относятся к пунктам, которых больше нет. Поэтому
 * сначала снимаем прежние — иначе они остались бы висеть в шапке мёртвым
 * DOM, а их затемнение — вторым слоем поверх страницы.
 */
function mountPanels(header, onToggle) {
  header.querySelectorAll('.megapanel').forEach((panel) => panel.remove())
  ownScrim?.remove()
  ownScrim = null
  document.documentElement.classList.remove('has-megapanel')

  const items = []

  header.querySelectorAll('[data-panel-trigger]').forEach((trigger) => {
    const key = trigger.dataset.panelTrigger
    const factory = panelRegistry[key]
    // Панели ещё нет — пункт остаётся обычной ссылкой.
    if (!factory) return

    const panel = factory.build()
    header.appendChild(panel)
    hydrateMedia(panel)

    // Узкую панель надо поставить под её пунктом: базовая .megapanel
    // растянута на всю ширину шапки, а позиция пункта известна только
    // в рантайме. Считаем перед открытием — и по наведению, и по фокусу,
    // и по клику: любой из трёх способов открывает панель.
    if (isMiniPanel(key)) {
      const place = () => positionMiniPanel(header, trigger, panel)
      ;['mouseenter', 'focus', 'click'].forEach((type) =>
        trigger.addEventListener(type, place),
      )
      requestAnimationFrame(place)
    }

    items.push({ key, trigger, panel, api: factory.init?.(panel) })
  })

  if (!items.length) return null

  const before = new Set(document.querySelectorAll('.nav-scrim'))

  const api = initMegamenu({
    header,
    items,
    onToggle: (isOpen) => {
      skin.panelOpen = isOpen
      applyHeaderSkin()
      onToggle?.(isOpen)
    },
  })

  ownScrim = [...document.querySelectorAll('.nav-scrim')].find((node) => !before.has(node)) || null

  return api
}

/* ------------------------------------------------- мобильная панель */

function renderNavPanel(mount) {
  if (!mount) return

  // Крупными строками — только товарные входы. Информационные страницы идут
  // ниже колонками: на мобильном выпадающих панелей нет, и без этого блока
  // содержимое «Компании» было бы доступно только из подвала.
  //
  // Правки под альтернативу этот блок не потребовал: колонки он собирает
  // из companyPanel.columns, то есть ровно из того же, что три новых пункта
  // шапки. Из крупных строк ушла «Икра» — вместе с пунктом.
  const links = [navCatalog, ...altNavPrimary]

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
          ${altNavActions
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

export function initHeader() {
  const header = document.querySelector('[data-header]')
  const panel = document.querySelector('#nav-panel')

  renderTopbar(document.querySelector('#topbar'))
  renderHeader(header)
  renderNavPanel(panel)

  if (!header) return

  headerEl = header
  wireNavPanel(header, panel)
  watchHeaderState(header)

  /* Поиск и выпадающие панели гасят друг друга: строка поиска занимает место
     содержимого шапки, и оставшаяся под ней раскрытая панель висела бы
     непонятно от чего. Ссылка на поиск объявлена заранее — панели поднимаются
     первыми, а в их onToggle он уже нужен. */
  let search = null
  let megamenu = mountPanels(header, (isOpen) => {
    if (isOpen) search?.close()
  })

  search = initSearch({
    header,
    triggers: [...header.querySelectorAll('[data-search-trigger]')],
    // megamenu пересобирается при смене брейкпоинта, поэтому читаем
    // переменную в момент вызова, а не захватываем значение при подписке.
    onOpen: () => megamenu?.close(),
  })

  // Открытая строка поиска переводит шапку в плотное состояние по той же
  // причине, что и панель: полупрозрачная шапка поверх раскрытой панели
  // подсказок выглядит грязно.
  header.addEventListener('search:toggle', (event) => {
    skin.panelOpen = event.detail.open
    applyHeaderSkin()
  })

  /* Смена брейкпоинта: три пункта ↔ один. Пересобираем правую группу
     и панели под неё, а не прячем лишнее стилями — см. шапку файла. */
  let wide = wideMQ.matches

  const applyWideMode = () => {
    wide = wideMQ.matches
    megamenu?.close()
    renderInfoNav(header)
    megamenu = mountPanels(header, (isOpen) => {
      if (isOpen) search?.close()
    })
    markCurrentLinks()
  }

  wideMQ.addEventListener('change', applyWideMode)

  /**
   * Ширина отслеживается ещё и ResizeObserver'ом, а не только событием
   * matchMedia. Причина та же, что у syncMode() в src/js/sections/why.js:
   * под эмуляцией устройства (инструменты разработчика, CDP) ни change,
   * ни window.resize до страницы не доходят, и шапка остаётся в чужом
   * режиме — на 1024 висят три пункта вместо одного. ResizeObserver
   * измеряет саму шапку и срабатывает в любом случае.
   *
   * Здесь же пересчитывается привязка узких панелей: она считается от
   * позиции пункта, а пункт ездит вместе с раскладкой шапки, и панель
   * в этот момент может быть уже открыта.
   */
  const syncWideMode = () => {
    if (wideMQ.matches !== wide) applyWideMode()

    header.querySelectorAll('.megapanel--mini').forEach((mini) => {
      const trigger = header.querySelector(`[data-panel-trigger="${mini.dataset.panel}"]`)
      positionMiniPanel(header, trigger, mini)
    })
  }

  if ('ResizeObserver' in window) new ResizeObserver(syncWideMode).observe(header)
  window.addEventListener('resize', syncWideMode, { passive: true })

  markCurrentLinks()
}
