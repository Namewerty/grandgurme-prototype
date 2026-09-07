/* ============================================================================
   Панель «Компания» — информационный хаб шапки.

   Устройство проще каталожной: три колонки текстовых ссылок и кадр справа.
   Переключаемых зон здесь нет, поэтому нет и своей механики — панель
   статична, всё поведение (открытие по наведению и клику, Esc, кольцо
   фокуса) приходит из megamenu.js, общего для всех панелей.

   ПОЧЕМУ БЕЗ КАРТОЧЕК С ФОТОГРАФИЯМИ. В каталожной панели карточки уместны:
   там выбирают товар глазами. Здесь ищут конкретный ответ — «как вернуть»,
   «где документы», — и кадр рядом с каждой ссылкой только замедляет чтение.
   Один кадр на всю панель оставлен, чтобы она не выглядела списком
   из служебного меню.

   ПОРЯДОК КОЛОНОК ЗАФИКСИРОВАН ЗАКАЗЧИКОМ и живёт в данных, а не здесь:
   «Покупателям» → «Компания» → «Сотрудничество», от пользы посетителю
   к рассказу о себе (см. src/data/company.js).

   Заголовки колонок — <h3>, а не <p class="eyebrow">: это настоящая
   иерархия внутри панели, и скринридер должен уметь по ней прыгать.
   Класс .eyebrow при этом остаётся: оформление то же, что у надзаголовков
   секций на главной — мелкие прописные с разрядкой, золотые.
   ============================================================================ */

import { companyPanel } from '../../data/company.js'

const PANEL_ID = 'megapanel-company'

const column = ({ title, links }) => `
  <div class="infocol">
    <h3 class="infocol__title eyebrow">${title}</h3>
    <ul class="infocol__list">
      ${links
        .map(({ label, href }) => `<li><a class="infocol__link" href="${href}">${label}</a></li>`)
        .join('')}
    </ul>
  </div>
`

function feature() {
  const { image, title, text, action } = companyPanel.feature

  return `
    <aside class="infofeature" aria-label="${title}">
      <a class="infofeature__link" href="${action.href}">
        <span class="infofeature__media"
              data-media="image"
              data-src="${image.src}"
              data-ratio="${image.ratio}"
              data-class="infofeature__frame"
              data-alt="${image.alt}"></span>
        <span class="infofeature__title">${title}</span>
        <span class="infofeature__text">${text}</span>
        <span class="infofeature__action">
          ${action.label}
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/>
          </svg>
        </span>
      </a>
    </aside>
  `
}

/**
 * Собирает панель. Медиа поднимает вызывающая сторона (hydrateMedia),
 * как и во всех секциях страницы.
 *
 * @returns {HTMLElement}
 */
export function buildCompanyPanel() {
  const panel = document.createElement('div')
  panel.className = 'megapanel megapanel--company'
  panel.id = PANEL_ID
  panel.dataset.panel = 'company'

  panel.innerHTML = `
    <div class="megapanel__scroll">
      <div class="container">
        <div class="infopanel">
          ${companyPanel.columns.map(column).join('')}
          ${feature()}
        </div>
      </div>
    </div>
  `

  return panel
}

/**
 * Своей механики у панели нет — отдаём megamenu.js только точку входа
 * для стрелки вниз с пункта шапки.
 *
 * preventScroll обязателен: без него браузер подкручивает страницу
 * к элементу с фокусом, а прокрутка закрывает панель (см. megamenu.js).
 *
 * @param {HTMLElement} panel
 */
export function initCompanyPanel(panel) {
  return {
    focusFirst: () => panel.querySelector('.infocol__link')?.focus({ preventScroll: true }),
  }
}
