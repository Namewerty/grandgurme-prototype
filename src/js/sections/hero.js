/* ============================================================================
   #hero — первый экран.

   Высота 88svh, не 100svh: снизу должен выглядывать край #trust, чтобы читалось
   продолжение страницы.

   Анимаций две и они не пересекаются:
     1. Вход при загрузке — единая оркестрованная таймлиния 1.6 с.
        Поэтому у секции НЕТ data-reveal-section / data-reveal: общий reveal
        из scroll.js её не трогает.
     2. Уход при скролле — «первая смена слайда»: слой уводится вверх и гаснет,
        видео идёт с параллаксом в другую сторону.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { hero } from '../../data/hero.js'
import { video } from '../../data/media.js'
import { createVideo } from '../media.js'
import { markMoving } from '../scroll.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const actionClass = (variant) =>
  variant === 'primary' ? 'btn btn--wide btn--pearl' : 'btn btn--wide btn--outline-light'

/* --------------------------------------------------------------- разметка */

export function buildHero(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section section--dark hero'
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const [first, second] = hero.titleLines

  section.innerHTML = `
    <div class="section__layer">
      <div class="hero__media" aria-hidden="true"></div>
      <div class="hero__scrim" aria-hidden="true"></div>

      <div class="container">
        <div class="hero__inner">
          <div class="hero__content">
            <p class="eyebrow hero__eyebrow" data-hero-eyebrow>${hero.eyebrow}</p>

            <h1 id="${item.id}-title" class="hero__title">
              <span class="hero__line" data-hero-line>${first}</span><br>
              <span class="hero__line" data-hero-line>${second}</span>
            </h1>

            <p class="hero__lead" data-hero-fade>${hero.lead}</p>

            <div class="hero__actions">
              ${hero.actions
                .map(
                  ({ label, href, variant }) =>
                    `<a class="${actionClass(variant)}" href="${href}" data-hero-fade>${label}</a>`,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="hero__scroll" data-hero-scroll>
        <span class="hero__scroll-line" aria-hidden="true"></span>
        <span class="hero__scroll-label">${hero.scrollHint}</span>
      </div>
    </div>
  `

  // Запасные H1 — комментарием прямо в разметке, заказчик выбирает по месту.
  const title = section.querySelector('.hero__title')
  title.parentNode.insertBefore(
    document.createComment(
      ` Альтернативные H1: «${hero.titleAlternatives.join('» / «')}» `,
    ),
    title,
  )

  /* Ролик у первого экрана в двух кадрировках: горизонт и вертикаль.
     Исходник заказчика вертикальный, а hero на десктопе горизонтальный —
     одним файлом оба формата не закрыть, подробности в src/data/media.js.

     Вариант выбирается ОДИН РАЗ, при сборке разметки: <video> не умеет
     переключать <source> по медиазапросу (атрибут media у source браузеры
     не поддерживают), а менять источник на лету значило бы перезапускать
     ролик посреди просмотра при каждом повороте экрана. Порог тот же, что
     у мобильной раскладки шапки. */
  const config = video[item.media]
  if (config) {
    const portrait =
      config.mobileSources && window.matchMedia('(max-width: 767px)').matches

    const media = createVideo({
      sources: portrait ? config.mobileSources : config.sources,
      poster: (portrait && config.mobilePoster) || config.poster,
      ratio: config.ratio,
      alt: config.alt,
      fill: true,
    })
    section.querySelector('.hero__media').appendChild(media)
  }

  return section
}

/* -------------------------------------------------- вход при загрузке (1) */

/**
 * Одна таймлиния на весь экран, 1.6 с от первого кадра видео до маркера.
 * fromTo выставляет начальные значения синхронно при создании — до первой
 * отрисовки, поэтому контент не успевает мелькнуть.
 */
function playIntro(section) {
  const media = section.querySelector('.hero__media')
  const eyebrow = section.querySelector('[data-hero-eyebrow]')
  const lines = section.querySelectorAll('[data-hero-line]')
  const fades = section.querySelectorAll('[data-hero-fade]')
  const marker = section.querySelector('[data-hero-scroll]')

  const tl = gsap.timeline({ delay: 0.1, defaults: { ease: 'power3.out' } })

  // 1. Видео проявляется из чёрного — под ним фон --void.
  tl.fromTo(media, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 0)

  // 2. Надзаголовок — маска слева направо, вместе с золотой линией.
  tl.fromTo(
    eyebrow,
    { clipPath: 'inset(0% 100% 0% 0%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7 },
    0.2,
  )

  // 3. Строки H1 — поочерёдно из-под маски снизу вверх.
  tl.fromTo(
    lines,
    { clipPath: 'inset(100% 0% 0% 0%)', yPercent: 8 },
    { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 0.9, stagger: 0.14 },
    0.3,
  )

  // 4. Подзаголовок и кнопки.
  tl.fromTo(
    fades,
    { y: 22, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.65, stagger: 0.08 },
    0.78,
  )

  // 5. Маркер прокрутки — последним.
  tl.fromTo(marker, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 1.15)

  return tl
}

/** Маркер живёт до первой прокрутки и больше не возвращается. */
function watchScrollHint(section) {
  const marker = section.querySelector('[data-hero-scroll]')
  if (!marker) return

  const hide = () => {
    if (window.scrollY < 8) return
    window.removeEventListener('scroll', hide)
    // Гасим через GSAP, а не классом: интро могло ещё не доиграть и оставить
    // свой inline-opacity — killTweensOf снимает спор.
    gsap.killTweensOf(marker)
    gsap.to(marker, { opacity: 0, y: 10, duration: 0.4, ease: 'power2.out' })
  }

  window.addEventListener('scroll', hide, { passive: true })
}

/* ------------------------------------------------- уход при скролле (2) */

/**
 * Уход первого экрана: слой поднимается и гаснет, видео идёт вниз, контент
 * уезжает вперёд слоя. Расхождение скоростей и читается как смена слайда.
 *
 * Отсчёт от 'top top', а не от 'bottom bottom': hero ниже экрана (88svh),
 * и его низ доходит до низа кадра ещё при нулевой прокрутке — секция
 * открывалась бы уже подгашенной.
 */
function createExit(section) {
  const layer = section.querySelector('.section__layer')
  // Двигаем сам кадр, а не обёртку: у обёртки при отсутствии файла живёт
  // подпись заглушки, её уводить не надо.
  const media = section.querySelector('.hero__media .media > video, .hero__media .media > img')
  const content = section.querySelector('.hero__content')

  const scrollTrigger = {
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    // will-change держим только пока уход идёт. Колбэк сработает трижды —
    // по разу на твин, — но он идемпотентный.
    onToggle: (self) => markMoving([layer, media, content], self.isActive),
  }

  if (layer) {
    gsap.fromTo(
      layer,
      { yPercent: 0, opacity: 1 },
      { yPercent: -6, opacity: 0.55, ease: 'none', immediateRender: false, scrollTrigger },
    )
  }

  // Видео идёт вниз, слой вверх — расхождение и читается как смена слайда.
  if (media) {
    gsap.fromTo(
      media,
      { yPercent: 0 },
      { yPercent: 12, ease: 'none', immediateRender: false, scrollTrigger },
    )
  }

  if (content) {
    gsap.fromTo(
      content,
      { yPercent: 0, opacity: 1 },
      { yPercent: -18, opacity: 0, ease: 'none', immediateRender: false, scrollTrigger },
    )
  }
}

/* ------------------------------------------------------------------- init */

export function initHero() {
  const section = document.querySelector('#hero')
  if (!section) return

  if (REDUCED) return

  playIntro(section)
  watchScrollHint(section)
  createExit(section)
}
