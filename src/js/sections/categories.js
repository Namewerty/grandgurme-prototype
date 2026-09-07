/* ============================================================================
   #categories — «Не только икра». Разделы каталога решёткой 4×2.

   Что здесь было и почему заменено дважды.

   Версия 1 — три фотоплитки 3:4 во всю ширину: три раздела из дюжины, кадры
   дублировали витрину, служебный блок съедал экран.

   Версия 2 — лента на двенадцать компактных плиток с прокруткой. Высоту она
   решила, но появилась другая беда: мелкая плитка с восьмипиксельной цифрой
   выглядит дёшево, а горизонтальную ленту в служебном блоке никто не листает —
   на экране оставались первые семь разделов, остальные пять не видел никто.

   Версия 3 (эта) — восемь разделов решёткой 4×2, целиком на одном экране.
   Прокрутки нет вообще: нет ленты — нет пейджера, полосы позиции и маски
   обрезанного края, и js/rail.js этой секции больше не нужен (он остался
   только у витрины). Блок стал выше примерно вдвое, но по-прежнему вдвое ниже
   соседних глав, и весь ассортимент читается одним взглядом.

   Решётка собрана волосяными линиями, а не рамками вокруг каждой ячейки:
   gap в 1 пиксель показывает фон-подложку, и получается сетка-таблица,
   а не восемь отдельных карточек. Это и убирает «дешёвый» вид — рамки
   с радиусами вокруг мелких элементов всегда читаются как чужой набор
   компонентов, а не как разворот каталога.

   Своих скриптов у секции нет: вход — общий reveal из scroll.js, ховер — CSS.
   ============================================================================ */

import { categoriesCopy, categoryItems } from '../../data/categories.js'
import { icons } from '../icons.js'

/** «24 позиции» / «12 позиций» / «21 позиция». */
function plural(n) {
  const tens = n % 100
  const ones = n % 10
  if (tens >= 11 && tens <= 14) return 'позиций'
  if (ones === 1) return 'позиция'
  if (ones >= 2 && ones <= 4) return 'позиции'
  return 'позиций'
}

function buildItem({ name, icon, count, href }) {
  const cell = document.createElement('li')
  cell.className = 'categories__cell'

  const link = document.createElement('a')
  link.className = 'cat'
  link.href = href

  // В ленте счётчик был голым числом: слово «позиций» съедало вторую строку
  // названия, и расшифровку приходилось прятать в aria-label. В ячейке
  // решётки место есть — пишем словами, и подпорка для скринридера не нужна.
  link.innerHTML = `
    <span class="cat__icon" aria-hidden="true">${icons[icon] || ''}</span>
    <span class="cat__name">${name}</span>
    <span class="cat__foot">
      ${count == null ? '<span></span>' : `<span class="cat__count">${count}&nbsp;${plural(count)}</span>`}
      <span class="cat__arrow" aria-hidden="true">→</span>
    </span>
  `

  cell.appendChild(link)
  return cell
}

export function buildCategories(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section categories'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="categories__head">
          <p class="eyebrow" data-reveal>${categoriesCopy.eyebrow}</p>

          <!-- Заголовок и ссылка в одной строке-флексе: только так
               align-items: baseline ловит базовую линию h2, а не надзаголовка
               над ним. Тот же приём, что в шапке #journal. -->
          <div class="categories__head-row">
            <h2 id="${item.id}-title" class="categories__title" data-reveal>${categoriesCopy.title}</h2>

            <a class="categories__all" href="${categoriesCopy.all.href}" data-reveal>
              ${categoriesCopy.all.label}
              <span class="categories__all-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <!-- Настоящий ul, а не div с role="list": role="listitem" на самой
             ссылке отобрал бы у неё роль link, и скринридер перестал бы
             называть ячейку ссылкой. Поэтому ячейка решётки — li,
             а <a> лежит внутри и растягивается на неё целиком. -->
        <ul class="categories__grid" role="list" aria-label="${categoriesCopy.gridLabel}" data-reveal></ul>
      </div>
    </div>
  `

  const grid = section.querySelector('.categories__grid')
  categoryItems.forEach((entry) => grid.appendChild(buildItem(entry)))

  return section
}
