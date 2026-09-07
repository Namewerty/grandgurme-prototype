/* ============================================================================
   #offline — офлайн-сеть.

   Карты на главной нет: она тяжёлая, требует ключа и уводит внимание. Здесь
   только список городов крупной типографикой и ссылка на отдельную страницу.

   Миниатюра бутика всплывает у курсора. Живёт в body, а не в секции: при уходе
   секции на .section__layer стоит transform, а он создаёт containing block —
   position: fixed внутри слоя считался бы от него, а не от экрана. Кадры
   всех городов строятся сразу и
   переключаются классом — так каждый сохраняет свою заглушку, пока файла нет.

   На тач-устройствах миниатюра не показывается вовсе: подсказка у курсора там
   бессмысленна, а лишние кадры незачем грузить.
   ============================================================================ */

import { cities, offlineCopy } from '../../data/offline.js'
import { createImage } from '../media.js'

const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Отступ миниатюры от курсора и от края экрана. */
const THUMB = { width: 180, offsetX: 28, margin: 16 }

/* --------------------------------------------------------------- разметка */

export function buildOffline(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section offline'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="offline__grid">
          <div class="offline__text">
            <p class="eyebrow" data-reveal>${offlineCopy.eyebrow}</p>
            <h2 id="${item.id}-title" class="offline__title" data-reveal>${offlineCopy.title}</h2>
            <p class="offline__p" data-reveal>${offlineCopy.text}</p>
            <p class="offline__action" data-reveal>
              <a class="btn" href="${offlineCopy.action.href}">${offlineCopy.action.label}</a>
            </p>
          </div>

          <div class="offline__cities" data-reveal>
            <ul class="cities">
              ${cities
                .map(
                  ({ city, country }, index) => `
                <li>
                  <a class="city" href="${offlineCopy.action.href}" data-city="${index}">
                    <span class="city__name">${city}</span>
                    <span class="city__country">${country}</span>
                  </a>
                </li>`,
                )
                .join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `

  return section
}

/* --------------------------------------------------------- миниатюра */

function createThumb() {
  const thumb = document.createElement('div')
  thumb.className = 'boutique-thumb'
  thumb.setAttribute('aria-hidden', 'true')

  const inner = document.createElement('div')
  inner.className = 'boutique-thumb__inner'

  // Без media--compact: пока файла нет, в миниатюре видно его имя — заказчику
  // сразу понятно, какой кадр здесь ждут.
  cities.forEach(({ media }) => {
    inner.appendChild(createImage({ src: media.src, alt: '', ratio: '3:2' }))
  })

  thumb.appendChild(inner)
  document.body.appendChild(thumb)

  return thumb
}

function wireThumb(section) {
  const rows = [...section.querySelectorAll('[data-city]')]
  if (!rows.length) return

  const thumb = createThumb()
  const shots = [...thumb.querySelectorAll('.media')]

  const move = (event) => {
    const half = THUMB.width / 2
    const x = Math.min(
      window.innerWidth - half - THUMB.margin,
      Math.max(half + THUMB.margin, event.clientX + THUMB.offsetX + half),
    )
    const y = Math.min(
      window.innerHeight - THUMB.margin - 60,
      Math.max(THUMB.margin + 60, event.clientY),
    )
    thumb.style.setProperty('--x', `${x}px`)
    thumb.style.setProperty('--y', `${y}px`)
  }

  rows.forEach((row) => {
    const index = Number(row.dataset.city)

    row.addEventListener('mouseenter', (event) => {
      shots.forEach((shot, i) => shot.classList.toggle('is-active', i === index))
      move(event)
      thumb.classList.add('is-visible')
    })

    row.addEventListener('mousemove', move)
    row.addEventListener('mouseleave', () => thumb.classList.remove('is-visible'))
  })

  // Ушли со страницы или начали листать — подсказку убираем, иначе она
  // зависает над экраном.
  window.addEventListener('blur', () => thumb.classList.remove('is-visible'))
  window.addEventListener('scroll', () => thumb.classList.remove('is-visible'), { passive: true })
}

/* ------------------------------------------------------------------- init */

export function initOffline() {
  const section = document.querySelector('#offline')
  if (!section || !CAN_HOVER) return

  wireThumb(section)
}
