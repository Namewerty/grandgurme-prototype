/* ============================================================================
   Каталожная панель.

   Устройство — две зоны, композиционный ориентир: панель «SMOKED FISH & SEA»
   у Petrossian. Слева простой вертикальный список категорий верхнего уровня,
   справа сетка карточек подкатегорий с фотографиями, у правого края —
   подборки. Колонок с фильтрами по вкусу и грейду здесь нет намеренно:
   такой вариант (каверная панель Petrossian) заказчиком отклонён.

   Категорий будет много и число их не зафиксировано, поэтому вход в
   ассортимент единый — «Каталог», а выбор категории уже внутри панели.

   Три вещи, которые здесь важнее красоты:

   1. ВСЁ — НАСТОЯЩИЕ ССЫЛКИ. Ни одного «пункта», который оживает скриптом:
      разметка индексируется как есть, панель работает без JS хотя бы как
      список ссылок.

   2. ВЫСОТА НЕ ПРЫГАЕТ. Все панели подкатегорий лежат в одной ячейке грида
      друг на друге, поэтому высота блока равна самой высокой из них и не
      меняется при переборе категорий. Скрытые панели — visibility: hidden,
      а не display: none: так они не участвуют в табуляции, но продолжают
      держать высоту.

   3. ПО УМОЛЧАНИЮ — ЧЁРНАЯ ИКРА. Флагманский продукт встречает первым,
      до того как курсор дошёл до списка.
   ============================================================================ */

import {
  NAV_CARD_RATIO,
  PANEL_MAX_CARDS,
  catalogPanelFooter,
  categories,
  collections,
  defaultCategorySlug,
  navImage,
  subHref,
} from '../../data/catalog.js'
import { createImage } from '../media.js'

const PANEL_ID = 'megapanel-catalog'

/* ------------------------------------------------------------- разметка */

function categoryList() {
  return `
    <nav class="megapanel__cats" aria-label="Категории каталога">
      ${categories
        .map(
          (category) => `
        <a class="megacat" href="/catalog/${category.slug}"
           data-cat="${category.slug}" aria-controls="pane-${category.slug}">
          <span class="megacat__name">${category.name}</span>
        </a>`,
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

/*
   Описания категорий (category.lead) в панель НЕ выводим, хотя они есть
   в данных и стоят на страницах разделов. Строка описания у одних категорий
   умещается в строку, у других переносится на две — и сетка карточек
   съезжала бы вниз при переборе. Панель должна стоять как вкопанная.

   ЕДИНСТВЕННОЕ ИСКЛЮЧЕНИЕ — раздел без подкатегорий. После выгрузки из 1С
   такие появились: у «Крабов и морепродуктов» (7 позиций) и «Подарочных
   наборов» (2) подразделов в учёте нет, и выдумывать их нельзя. Пустая
   правая зона читается как несобравшаяся панель, поэтому там, где сетки
   нет вовсе, её место занимает описание раздела. Высоту это не колеблет:
   у категорий с карточками описание не выводится по-прежнему.
*/
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
      ${collections
        .map(
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
        )
        .join('')}
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
 * @param {HTMLElement} panel
 * @returns {{reset: () => void, focusFirst: () => void}}
 */
export function initCatalogPanel(panel) {
  const cats = [...panel.querySelectorAll('.megacat')]
  const paneList = [...panel.querySelectorAll('.megapane')]

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
  const focusCat = (index) => {
    const cat = cats[(index + cats.length) % cats.length]
    activate(cat.dataset.cat)
    cat.focus({ preventScroll: true })
  }

  cats.forEach((cat, index) => {
    // Наведение переключает правую зону, но не мешает уйти по самой ссылке.
    cat.addEventListener('mouseenter', () => activate(cat.dataset.cat))

    // С клавиатуры — то же самое по фокусу: табом идём по списку и видим,
    // что справа. Иначе фокус ушёл бы на карточки чужой категории.
    // Стрелки переключают категорию сами, не полагаясь на это событие.
    cat.addEventListener('focus', () => activate(cat.dataset.cat))

    cat.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        focusCat(event.key === 'ArrowDown' ? index + 1 : index - 1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        panel.querySelector('.megapane.is-active .navcard')?.focus({ preventScroll: true })
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
    focusFirst: () => focusCat(0),
  }
}
