/* ============================================================================
   Каталожная панель альтернативы. Копия src/js/nav/catalog-panel.js
   с тремя правками. ЧЕРНОВИК НА ВЫБРОС.

   ЗАЧЕМ КОПИЯ. Правки — это другая разметка левой зоны и другая константа
   обрезки, а не другие строки в данных. Параметризовать оригинал под оба
   варианта значило бы править основной код ради черновика.

   ЧТО ИЗМЕНИЛОСЬ

   1. СПРАВА ОДИН РЯД КАРТОЧЕК ВМЕСТО ДВУХ. Своя константа PANEL_MAX_CARDS = 4;
      импортированная из data/catalog.js не тронута. Побочная польза: список
      кадров под съёмку панели сокращается с 31 до 24 — фотографировать то,
      что панель не показывает, незачем.

   2. СЛЕВА ДВА ПОДСТОЛБЦА С ГРУППИРОВКОЙ. Десять категорий одной колонкой
      держали высоту панели: убрать ряд карточек и не тронуть левый столбец
      было бы бессмысленно — высоту после этого держал бы он, а панель вдобавок
      стала бы кривой. Названия групп и распределение — src/alt/nav.js,
      названия самих категорий по-прежнему из src/data/catalog.js.

   3. СПРАВА ОДНА ПОДБОРКА ВМЕСТО ДВУХ. Вторая вела на «Подарочные наборы» —
      категорию, которая и так стоит в списке слева. Панель предлагала один
      и тот же вход дважды.

   ЧТО ОСТАЛОСЬ НЕПРИКОСНОВЕННЫМ

   • Все панели подкатегорий лежат в ОДНОЙ ячейке грида друг на друге,
     скрытые — visibility: hidden, а не display: none. Именно это держит
     высоту постоянной при переборе категорий (см. megamenu.css).
   • У категорий без подкатегорий («Крабы и морепродукты», «Подарочные
     наборы») правую зону занимает описание раздела, а не пустая сетка.
   • preventScroll: true у focus(). Без него браузер подкручивает страницу,
     а прокрутка закрывает панель (см. megamenu.js).

   ЧЕГО ЗДЕСЬ СОЗНАТЕЛЬНО НЕТ — карточек с категориями вместо подкатегорий.
   Категорий десять, а карточек четыре: представить весь ассортимент четырьмя
   кадрами нельзя, пришлось бы выбирать «главные» произвольно. Панель заодно
   потеряла бы второй уровень целиком — Белуга, Осётр, Холодного копчения,
   Оливки и маслины исчезли бы из навигации. А решётка категорий с кадрами
   на сайте уже есть: секция «Не только икра» на главной. Резать надо
   количество карточек, а не их уровень.
   ============================================================================ */

import {
  NAV_CARD_RATIO,
  catalogPanelFooter,
  categories,
  collections,
  defaultCategorySlug,
  navImage,
  subHref,
} from '../data/catalog.js'
import { groupedCategories } from './nav.js'

const PANEL_ID = 'megapanel-catalog'

/**
 * Один ряд из четырёх карточек вместо двух рядов по четыре.
 * Локальная константа: PANEL_MAX_CARDS из data/catalog.js не трогаем —
 * по нему живут основная панель и перечень кадров под съёмку.
 */
const PANEL_MAX_CARDS = 4

/** Единственная подборка: «Хиты продаж». См. п. 3 в шапке файла. */
const PANEL_COLLECTIONS = collections.filter((collection) => collection.slug === 'hits')

/* ------------------------------------------------------------- разметка */

/**
 * Левая зона: два подстолбца с надзаголовками групп.
 *
 * data-col — номер подстолбца, он нужен клавиатуре: стрелки вверх-вниз ходят
 * внутри своего столбца по визуальному порядку, влево-вправо на краю
 * переносят в соседний.
 */
function categoryList() {
  return `
    <nav class="megapanel__cats megapanel__cats--split" aria-label="Категории каталога">
      ${groupedCategories()
        .map(
          (group, col) => `
        <div class="megacat-group" data-col="${col}">
          <p class="megacat-group__title eyebrow">${group.title}</p>
          ${group.items
            .map(
              (category) => `
            <a class="megacat" href="/catalog/${category.slug}"
               data-cat="${category.slug}" data-col="${col}"
               aria-controls="pane-${category.slug}">
              <span class="megacat__name">${category.name}</span>
            </a>`,
            )
            .join('')}
        </div>`,
        )
        .join('')}
    </nav>
  `
}

function subcategoryCard(category, sub) {
  return `
    <li class="megagrid__cell">
      <a class="navcard" href="${subHref(category.slug, sub.slug)}">
        <span class="navcard__media"
              data-media="image"
              data-src="${navImage(category.slug, sub.slug)}"
              data-ratio="${NAV_CARD_RATIO}"
              data-class="navcard__frame"
              data-alt="${category.name} — ${sub.name}"></span>
        <span class="navcard__name">${sub.name}</span>
      </a>
    </li>
  `
}

function panes() {
  return `
    <div class="megapanel__panes">
      ${categories
        .map(
          (category) => `
        <section class="megapane" id="pane-${category.slug}" data-pane="${category.slug}"
                 aria-label="${category.name}">
          ${
            category.subs.length
              ? `<ul class="megagrid">
            ${category.subs
              .slice(0, PANEL_MAX_CARDS)
              .map((sub) => subcategoryCard(category, sub))
              .join('')}
          </ul>`
              : `<p class="megapane__lead">${category.lead}</p>`
          }
          <a class="megapane__all" href="/catalog/${category.slug}">
            Все товары раздела «${category.name}»
          </a>
        </section>`,
        )
        .join('')}
    </div>
  `
}

function promo() {
  return `
    <aside class="megapanel__promo" aria-label="Подборки">
      ${PANEL_COLLECTIONS.map(
        (collection) => `
        <a class="promocard" href="${collection.href}">
          <span class="promocard__media"
                data-media="image"
                data-src="${collection.image}"
                data-ratio="${collection.ratio}"
                data-class="promocard__frame"
                data-alt="${collection.title}"></span>
          <span class="promocard__title">${collection.title}</span>
          <span class="promocard__text">${collection.text}</span>
        </a>`,
      ).join('')}
    </aside>
  `
}

function foot() {
  const { main, quick } = catalogPanelFooter
  return `
    <div class="megapanel__foot">
      <a class="megapanel__all" href="${main.href}">
        ${main.label}
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>
        </svg>
      </a>
      <p class="megapanel__quick">
        ${quick.map((link) => `<a href="${link.href}">${link.label}</a>`).join('')}
      </p>
    </div>
  `
}

/**
 * Собирает панель. Медиа поднимает вызывающая сторона (hydrateMedia),
 * как и во всех секциях страницы.
 *
 * @returns {HTMLElement}
 */
export function buildCatalogPanel() {
  const panel = document.createElement('div')
  panel.className = 'megapanel megapanel--catalog'
  panel.id = PANEL_ID
  panel.dataset.panel = 'catalog'

  panel.innerHTML = `
    <div class="megapanel__scroll">
      <div class="container">
        <div class="megapanel__inner">
          ${categoryList()}
          ${panes()}
          ${promo()}
        </div>
        ${foot()}
      </div>
    </div>
  `

  return panel
}

/* ---------------------------------------------------------- поведение */

/**
 * Внутренняя механика: переключение категорий наведением, фокусом и стрелками.
 * Открытие и закрытие самой панели — не здесь, этим занимается megamenu.js.
 *
 * КЛАВИАТУРА ПРИ ДВУХ ПОДСТОЛБЦАХ
 *   вверх/вниз — внутри своего подстолбца, по визуальному порядку, с закольцовкой;
 *   вправо     — из левого подстолбца в правый, из правого — в карточки;
 *   влево      — из правого подстолбца в левый, из карточек — назад в список.
 * Переход между столбцами держит строку: со второй строки левого уходим
 * на вторую строку правого, а не на первую. Если в соседнем столбце строк
 * меньше — встаём на последнюю.
 *
 * @param {HTMLElement} panel
 * @returns {{reset: () => void, focusFirst: () => void}}
 */
export function initCatalogPanel(panel) {
  const cats = [...panel.querySelectorAll('.megacat')]
  const paneList = [...panel.querySelectorAll('.megapane')]

  /** Категории по подстолбцам — в том же визуальном порядке, что на экране. */
  const columns = []
  cats.forEach((cat) => {
    const col = Number(cat.dataset.col || 0)
    if (!columns[col]) columns[col] = []
    columns[col].push(cat)
  })

  const activate = (slug) => {
    cats.forEach((cat) => {
      const on = cat.dataset.cat === slug
      cat.classList.toggle('is-active', on)
      // aria-current, а не aria-selected: это ссылки, а не вкладки таб-панели.
      if (on) cat.setAttribute('aria-current', 'true')
      else cat.removeAttribute('aria-current')
    })

    paneList.forEach((pane) => {
      pane.classList.toggle('is-active', pane.dataset.pane === slug)
    })
  }

  /**
   * preventScroll обязателен. Без него браузер подкручивает страницу к
   * элементу, на который ушёл фокус, а прокрутка закрывает панель
   * (см. megamenu.js) — стрелки в списке гасили бы её на середине.
   */
  const focusCat = (cat) => {
    if (!cat) return
    activate(cat.dataset.cat)
    cat.focus({ preventScroll: true })
  }

  cats.forEach((cat) => {
    const col = Number(cat.dataset.col || 0)
    const row = columns[col].indexOf(cat)

    // Наведение переключает правую зону, но не мешает уйти по самой ссылке.
    cat.addEventListener('mouseenter', () => activate(cat.dataset.cat))

    // С клавиатуры — то же самое по фокусу: табом идём по списку и видим,
    // что справа. Иначе фокус ушёл бы на карточки чужой категории.
    // Стрелки переключают категорию сами, не полагаясь на это событие.
    cat.addEventListener('focus', () => activate(cat.dataset.cat))

    cat.addEventListener('keydown', (event) => {
      const own = columns[col]

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        focusCat(own[(row + step + own.length) % own.length])
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        const next = columns[col + 1]
        if (next) focusCat(next[Math.min(row, next.length - 1)])
        else panel.querySelector('.megapane.is-active .navcard')?.focus({ preventScroll: true })
        return
      }

      if (event.key === 'ArrowLeft') {
        const prev = columns[col - 1]
        if (!prev) return
        event.preventDefault()
        focusCat(prev[Math.min(row, prev.length - 1)])
      }
    })
  })

  // Из карточек стрелкой влево возвращаемся в список категорий.
  panel.querySelectorAll('.navcard').forEach((card) => {
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft') return
      event.preventDefault()
      panel.querySelector('.megacat.is-active')?.focus({ preventScroll: true })
    })
  })

  activate(defaultCategorySlug)

  return {
    /** Каждое открытие начинается с флагманской категории. */
    reset: () => activate(defaultCategorySlug),
    focusFirst: () => focusCat(cats[0]),
  }
}
