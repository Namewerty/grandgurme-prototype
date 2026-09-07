/* ============================================================================
   #types — виды чёрной икры.

   Композиция как в меню Petrossian: ряд крупных круглых кадров, под каждым
   название и вкусовой дескриптор.

   Шапка секции идёт общим reveal из scroll.js (data-reveal), а сам ряд —
   собственным каскадом слева направо, поэтому у карточек data-reveal НЕТ.

   На планшете и мобильном ряд — горизонтальный скролл со snap. Lenis ведёт
   только вертикаль (syncTouch выключен), поэтому нативная горизонталь внутри
   ряда с ним не спорит.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { caviarTypes, typesCopy } from '../../data/caviar-types.js'
import { createImage } from '../media.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* --------------------------------------------------------------- разметка */

function buildCard({ name, lines, href, media }) {
  const card = document.createElement('a')
  card.className = 'type'
  card.href = href

  const frame = document.createElement('span')
  frame.className = 'type__frame'
  frame.appendChild(
    createImage({
      src: media.src,
      alt: media.alt,
      ratio: media.ratio,
      round: true,
      className: 'type__photo',
    }),
  )

  const caption = document.createElement('span')
  caption.className = 'type__caption'
  /* Вторая строка — состав вида (какие линейки в него входят). Раньше
     здесь стоял вкусовой дескриптор, но настоящих у нас нет, а придуманные
     из данных убраны; класс оставлен прежним — это та же роль подписи. */
  caption.innerHTML = `
    <span class="type__name">${name}</span>
    <span class="type__flavour">${lines}</span>
  `

  card.append(frame, caption)
  return card
}

export function buildTypes(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section types'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="types__head">
          <p class="eyebrow" data-reveal>${typesCopy.eyebrow}</p>
          <h2 id="${item.id}-title" class="types__title" data-reveal>${typesCopy.title}</h2>
          <p class="types__note" data-reveal>${typesCopy.note}</p>
        </div>

        <div class="types__row" data-types-row></div>

        <div class="types__bar" data-types-bar aria-hidden="true">
          <span class="types__bar-thumb"></span>
        </div>

        <p class="types__more">
          <a class="types__more-link" href="${typesCopy.more.href}">${typesCopy.more.label}</a>
        </p>
      </div>
    </div>
  `

  const row = section.querySelector('[data-types-row]')
  caviarTypes.forEach((type) => row.appendChild(buildCard(type)))

  return section
}

/* ------------------------------------------------ индикатор позиции ряда */

/** Виден только на мобильном (CSS), но считается всегда — расчёт дешёвый. */
function wireIndicator(row, bar) {
  const thumb = bar.querySelector('.types__bar-thumb')
  if (!thumb) return

  const update = () => {
    const scrollable = row.scrollWidth - row.clientWidth
    if (scrollable <= 1) {
      thumb.style.width = '100%'
      thumb.style.transform = 'translateX(0)'
      return
    }
    const barWidth = bar.clientWidth
    const thumbWidth = Math.max(24, barWidth * (row.clientWidth / row.scrollWidth))
    thumb.style.width = `${thumbWidth}px`
    thumb.style.transform = `translateX(${(row.scrollLeft / scrollable) * (barWidth - thumbWidth)}px)`
  }

  row.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  update()
}

/* ------------------------------------------------------- каскад входа */

function createCascade(section) {
  const frames = section.querySelectorAll('.type__frame')
  const captions = section.querySelectorAll('.type__caption')
  if (!frames.length) return

  gsap.set(frames, { scale: 0.9, opacity: 0 })
  gsap.set(captions, { y: 18, opacity: 0 })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: 'top 78%', once: true },
    onComplete: () => gsap.set([...frames, ...captions], { clearProps: 'opacity,transform' }),
  })

  tl.to(frames, {
    scale: 1,
    opacity: 1,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.09,
  })

  tl.to(
    captions,
    { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.09 },
    0.2,
  )
}

/* ------------------------------------------------------------------- init */

export function initTypes() {
  const section = document.querySelector('#types')
  if (!section) return

  const row = section.querySelector('[data-types-row]')
  const bar = section.querySelector('[data-types-bar]')
  if (row && bar) wireIndicator(row, bar)

  if (!REDUCED) createCascade(section)
}
