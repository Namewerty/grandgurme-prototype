/* ============================================================================
   Узкие панели информационных пунктов: «Покупателям», «Компания»,
   «Партнёрам». ЧЕРНОВИК НА ВЫБРОС.

   ПОЧЕМУ УЗКИЕ. Полноширинная мега-панель ради трёх ссылок «Партнёрам»
   выглядит как несобравшийся макет: две трети ширины остались бы пустыми.
   Панель шириной по содержимому — 280–340px, волосяная рамка, фон --surface
   (модификатор .megapanel--mini в src/alt/alt.css).

   Каталожная панель при этом остаётся полноширинной: там витрина,
   и ширина ей нужна.

   СВОЕЙ МЕХАНИКИ ОТКРЫТИЯ ЗДЕСЬ НЕТ. Открытие по наведению и клику, Esc,
   кольцо фокуса, закрытие при прокрутке — всё приходит из общего
   src/js/nav/megamenu.js, ровно как у панели «Компания» в основной версии.
   Единственное, чего megamenu.js про узкие панели не знает, — где им стоять
   по горизонтали: базовая .megapanel растянута на всю ширину шапки
   (inset-inline: 0). Привязку к своему пункту делает positionMiniPanel()
   ниже, через переменную --mini-left. Причёсывать сам megamenu.js ради
   черновика нельзя, а стилями это не решается: позиция пункта известна
   только в рантайме и меняется при смене ширины экрана.

   КОЛОНКА ЦЕЛИКОМ, БЕЗ ЗАГОЛОВКА. Заголовок колонки повторял бы слово
   в шапке, под которым панель и раскрылась. Имя панели скринридеру даёт
   aria-label.

   Кадр бутика есть только у «Компании» — см. src/alt/nav.js.
   ============================================================================ */

const link = ({ label, href }) =>
  `<li><a class="infocol__link" href="${href}">${label}</a></li>`

/**
 * Пропорция кадра в узкой панели своя, 16:9 вместо исходных 3:2. Это решение
 * раскладки, а не свойство файла: при ширине панели в 340px кадр 3:2 занимал
 * 227px, и панель «Компании» вырастала до 595px — на ноутбуке с экраном 768
 * она уходила во внутренний скролл. Файл тот же, CSS обрежет его сам.
 */
const FEATURE_RATIO = '16:9'

function feature(data) {
  const { image, title, text, action } = data

  return `
    <aside class="infomini__feature" aria-label="${title}">
      <a class="infofeature__link" href="${action.href}">
        <span class="infofeature__media"
              data-media="image"
              data-src="${image.src}"
              data-ratio="${FEATURE_RATIO}"
              data-class="infofeature__frame"
              data-alt="${image.alt}"></span>
        <span class="infofeature__title">${title}</span>
        <span class="infofeature__text">${text}</span>
      </a>
    </aside>
  `
}

/**
 * Собирает узкую панель одного информационного пункта.
 * Медиа поднимает вызывающая сторона (hydrateMedia).
 *
 * @param {{panel: string, label: string, links: Array, feature: object|null}} item
 * @returns {HTMLElement}
 */
export function buildInfoPanel(item) {
  const panel = document.createElement('div')
  panel.className = 'megapanel megapanel--mini'
  panel.id = `megapanel-${item.panel}`
  panel.dataset.panel = item.panel
  panel.setAttribute('aria-label', item.label)

  panel.innerHTML = `
    <div class="megapanel__scroll">
      <div class="infomini">
        <ul class="infocol__list">
          ${item.links.map(link).join('')}
        </ul>
        ${item.feature ? feature(item.feature) : ''}
      </div>
    </div>
  `

  return panel
}

/**
 * Ставит панель под её пунктом.
 *
 * Панель лежит внутри <header> абсолютом (position: sticky у шапки делает её
 * containing block), поэтому смещение считаем от левого края шапки. Если
 * панель не помещается до правого края контейнера — прижимаем её правым краем
 * к пункту, а не выпускаем за экран.
 *
 * Зовётся перед каждым открытием и при смене ширины окна: позиция пункта
 * меняется вместе с раскладкой шапки.
 *
 * @param {HTMLElement} header
 * @param {HTMLElement} trigger
 * @param {HTMLElement} panel
 */
export function positionMiniPanel(header, trigger, panel) {
  if (!header || !trigger || !panel) return

  const headerBox = header.getBoundingClientRect()
  const triggerBox = trigger.getBoundingClientRect()

  // Отступ до края экрана — тот же, что у контейнера страницы.
  const gutter = parseFloat(getComputedStyle(header).getPropertyValue('--gutter')) || 20
  const width = panel.offsetWidth || 300

  const max = headerBox.width - width - gutter
  const left = Math.max(gutter, Math.min(triggerBox.left - headerBox.left, max))

  panel.style.setProperty('--mini-left', `${Math.round(left)}px`)
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
export function initInfoPanel(panel) {
  return {
    focusFirst: () => panel.querySelector('.infocol__link')?.focus({ preventScroll: true }),
  }
}
