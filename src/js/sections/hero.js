/* ============================================================================
   #hero — первый экран с роликом бренда (17.09.2026).

   Ролик — нарезка производства, в финале золотой логотип по центру кадра.
   Поэтому текст и кнопки нигде не заходят в ЗОНУ ЛОГОТИПА (таблица —
   в README, «Первый экран: ролик бренда», и в src/data/media.js).

   Раскладок две, граница — в hero.css и в WIDE ниже:
     широкая  — горизонтальный экран от 768×600: видео во всю секцию 88svh,
                центр кадра свободен, текст полосой у нижнего края;
     узкая    — портрет любой ширины и низкий горизонтальный экран: видео
                кадром сверху (4:5, 1:1 или 16:9), текст под ним на --void.

   Подзаголовка и маркера «ПРОЛИСТАЙТЕ» нет: сняты 17.09 по решению Дениса,
   тексты лежат в истории коммитов.

   Анимаций две и они не пересекаются:
     1. Вход при загрузке — единая оркестрованная таймлиния.
        Поэтому у секции НЕТ data-reveal-section / data-reveal: общий reveal
        из scroll.js её не трогает.
     2. Уход при скролле — «первая смена слайда»: слой уводится вверх и гаснет,
        контент уезжает вперёд слоя. Видео идёт с параллаксом в другую сторону
        только в широкой раскладке: в узкой кадр стоит блоком без запаса
        по высоте, двигать его некуда.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { hero } from '../../data/hero.js'
import { video } from '../../data/media.js'
import { createVideo } from '../media.js'
import { markMoving } from '../scroll.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Те же условия, что у раскладок в hero.css. */
const WIDE = '(orientation: landscape) and (min-width: 768px) and (min-height: 600px)'
const PORTRAIT_FILE = '(max-width: 767px) and (orientation: portrait)'

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
            <div class="hero__heading">
              <p class="eyebrow hero__eyebrow" data-hero-eyebrow>${hero.eyebrow}</p>

              <h1 id="${item.id}-title" class="hero__title">
                <span class="hero__line" data-hero-line>${first}</span><br>
                <span class="hero__line" data-hero-line>${second}</span>
              </h1>
            </div>

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

  /* Ролик в двух кадрировках: горизонтальный 16:9 и центральный кадр 4:5.
     Вертикальный файл получает только телефон в портрете — там кадр 4:5,
     и горизонтальный файл обрезался бы до трети ширины вместе с логотипом.
     Повёрнутый телефон (кадр 16:9) и планшет в портрете (кадр 1:1) берут
     горизонтальный файл. Подробности — в src/data/media.js.

     Вариант выбирается ОДИН РАЗ, при сборке разметки: <video> не умеет
     переключать <source> по медиазапросу (атрибут media у source браузеры
     не поддерживают), а менять источник на лету значило бы перезапускать
     ролик посреди просмотра при каждом повороте экрана. */
  const config = video[item.media]
  if (config) {
    const portrait = config.mobileSources && window.matchMedia(PORTRAIT_FILE).matches

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
 * Одна таймлиния на весь экран, от первого кадра видео до кнопок.
 * fromTo выставляет начальные значения синхронно при создании — до первой
 * отрисовки, поэтому контент не успевает мелькнуть.
 */
function playIntro(section) {
  const media = section.querySelector('.hero__media')
  const eyebrow = section.querySelector('[data-hero-eyebrow]')
  const lines = section.querySelectorAll('[data-hero-line]')
  const fades = section.querySelectorAll('[data-hero-fade]')

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

  // 4. Кнопки.
  tl.fromTo(
    fades,
    { y: 22, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.65, stagger: 0.08 },
    0.78,
  )

  return tl
}

/* ------------------------------------------------- уход при скролле (2) */

/**
 * Уход первого экрана: слой поднимается и гаснет, контент уезжает вперёд
 * слоя, в широкой раскладке видео идёт вниз. Расхождение скоростей
 * и читается как смена слайда.
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

  // У каждого твина свой ScrollTrigger с одними границами. will-change
  // держим только пока уход идёт; колбэк идемпотентный.
  const triggerFor = (target) => ({
    trigger: section,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onToggle: (self) => markMoving([target], self.isActive),
  })

  if (layer) {
    gsap.fromTo(
      layer,
      { yPercent: 0, opacity: 1 },
      {
        yPercent: -6,
        opacity: 0.55,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: triggerFor(layer),
      },
    )
  }

  if (content) {
    gsap.fromTo(
      content,
      { yPercent: 0, opacity: 1 },
      {
        yPercent: -18,
        opacity: 0,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: triggerFor(content),
      },
    )
  }

  /* Видео идёт вниз, слой вверх — только в широкой раскладке. Сдвиг 8% при
     запасе кадра 12% сверху (hero.css): верхний край не обнажается. В узкой
     раскладке кадр стоит блоком ровно по своей высоте; matchMedia снимает
     твин вместе с inline-transform, когда экран перестаёт быть широким. */
  if (media) {
    gsap.matchMedia().add(WIDE, () => {
      gsap.fromTo(
        media,
        { yPercent: 0 },
        {
          yPercent: 8,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: triggerFor(media),
        },
      )
    })
  }
}

/* ------------------------------------------------------------------- init */

export function initHero() {
  const section = document.querySelector('#hero')
  if (!section) return

  if (REDUCED) return

  playIntro(section)
  createExit(section)
}
