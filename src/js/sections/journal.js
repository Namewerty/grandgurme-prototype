/* ============================================================================
   #journal — журнал. Светлая, не полноэкранная. Предпоследний блок.

   Материалы только про выбор и различия — никаких рецептов и «как подавать»
   (отдельно оговорено заказчиком, см. комментарий в src/data/journal.js).

   Карточка целиком — одна ссылка: у неё один табстоп, а не три, и вся площадь
   кликабельна. Рубрика и лид внутри ссылки — это <span>, не <p>: <p> внутри
   <a> недопустим по HTML.

   Своих анимаций нет: вход общий из scroll.js, ховер — CSS.
   ============================================================================ */

import { journalCopy, journalPosts } from '../../data/journal.js'
import { createImage } from '../media.js'

function buildCard({ rubric, title, lead, href, media }) {
  const card = document.createElement('a')
  card.className = 'post'
  card.href = href
  card.setAttribute('data-reveal', '')

  const frame = document.createElement('div')
  frame.className = 'post__frame'
  frame.appendChild(
    createImage({
      // alt по заголовку материала, а не общий из реестра медиа: так кадр
      // осмысленно попадёт в поиск по картинкам.
      src: media.src,
      alt: title,
      ratio: '16:10',
      className: 'post__photo',
    }),
  )

  card.appendChild(frame)
  card.insertAdjacentHTML(
    'beforeend',
    `
    <span class="post__body">
      <span class="post__rubric">${rubric}</span>
      <span class="post__title">${title}</span>
      <span class="post__lead">${lead}</span>
    </span>
  `,
  )

  return card
}

export function buildJournal(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section journal'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="journal__head">
          <p class="eyebrow" data-reveal>${journalCopy.eyebrow}</p>

          <!-- Заголовок и ссылка в одной строке-флексе: только так align-items:
               baseline ловит базовую линию h2, а не надзаголовка над ним. -->
          <div class="journal__head-row">
            <h2 id="${item.id}-title" class="journal__title" data-reveal>${journalCopy.title}</h2>
            <a class="journal__all" href="${journalCopy.all.href}" data-reveal>
              ${journalCopy.all.label}
              <span class="journal__all-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div class="journal__row" data-journal-row></div>
      </div>
    </div>
  `

  const row = section.querySelector('[data-journal-row]')
  journalPosts.forEach((post) => row.appendChild(buildCard(post)))

  return section
}
