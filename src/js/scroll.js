/* ============================================================================
   Движок скролла.

   Задача заказчика: «мягкая анимация как по слайдам сменяющимся, а не просто
   прокрутка». После правок ритма её держат три вещи:

     1. Lenis — инерция.
     2. Вход секции: clip-path сверху + медиа-слой из 1.045 в 1 + stagger контента.
     3. Уход и параллакс hero — своя таймлиния в js/sections/hero.js.

   Чего здесь БОЛЬШЕ НЕТ и почему:

     — Доводчик к границам секций. Он имел смысл, пока секции были во весь
       экран: их границы совпадали с границами кадра. Теперь высоту секции
       задаёт её содержимое, доводить некуда, а подтягивание после остановки
       читалось как то, что страница «вырывается» из рук.
     — Общий уход секции (слой на -6% и в 0.55 по scrub). Он отсчитывался от
       'bottom bottom' — момента, когда низ секции доходит до низа экрана.
       У секции ниже экрана этот момент наступает, пока она ещё целиком в
       кадре: контент гаснул прямо во время чтения. У hero, который остался
       полноэкранным, уход свой и отсчитывается от 'top top'.

   Анимируем только transform, opacity и clip-path.
   ============================================================================ */

import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Сколько длится подмена подписи в кольце: гаснет → меняется → проявляется. */
const RING_FADE = 200

let lenis = null

export const getLenis = () => lenis

/* ------------------------------------------------------------ will-change */

/**
 * will-change живёт только на время анимации. Постоянный он ничем не лучше
 * его отсутствия: браузер держит композиторный слой всю сессию и тратит на
 * него память, а выигрыш даёт только в момент движения.
 *
 * @param {Array<Element|null>} elements
 * @param {boolean} active
 */
export function markMoving(elements, active) {
  elements.forEach((el) => {
    if (el) el.style.willChange = active ? 'transform, opacity' : ''
  })
}

/* --------------------------------------------------------------- инерция */

function createLenis() {
  lenis = new Lenis({
    duration: 1.35,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    wheelMultiplier: 0.9,
    smoothWheel: true,
    syncTouch: false,
  })

  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)

  // Якорные ссылки тоже должны идти через Lenis, иначе прыжок ломает инерцию.
  // Отступ на высоту липкой шапки: без него надзаголовок секции оказывается
  // под ней — это видно на переходах из подвала в #why и #journal.
  //
  // ЦЕЛЬ — ЧИСЛОМ, А НЕ ЭЛЕМЕНТОМ. Lenis 1.3 в scrollTo(элемент) сам вычитает
  // scroll-margin-top цели, а у .section он уже равен шапке + 1rem
  // (layout.css — для нативного перехода без Lenis). С элементом и offset
  // отступ складывался дважды, и секция вставала на ~92px ниже шапки.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) return
    const id = link.getAttribute('href')
    if (!id || id === '#') return
    const target = document.querySelector(id)
    if (!target) return
    event.preventDefault()

    const header = document.querySelector('[data-header]')
    const top = window.scrollY + target.getBoundingClientRect().top
    lenis.scrollTo(top - (header ? header.offsetHeight + 16 : 0), { duration: 1.2 })
  })
}

/* ------------------------------------------------------ вход секции (2) */

function createReveals() {
  if (REDUCED) return

  gsap.utils.toArray('[data-reveal-section]').forEach((section) => {
    const media = section.querySelector('[data-reveal-media]')
    const items = section.querySelectorAll('[data-reveal]')

    const moving = [media, ...items]

    const tl = gsap.timeline({
      defaults: { duration: 1.1, ease: 'power3.out' },
      scrollTrigger: {
        trigger: section,
        start: 'top 82%',
        once: true,
      },
      onStart() {
        markMoving(moving, true)
      },
      onComplete() {
        // Снимаем clip-path совсем: он создаёт containing block и мешает
        // золотому кольцу карточек вылезать за границы секции.
        section.classList.add('is-revealed')
        gsap.set(section, { clearProps: 'clipPath' })
        if (media) gsap.set(media, { clearProps: 'transform' })
        if (items.length) gsap.set(items, { clearProps: 'opacity,transform' })
        markMoving(moving, false)
      },
    })

    tl.fromTo(section, { clipPath: 'inset(12% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, 0)

    if (media) tl.fromTo(media, { scale: 1.045 }, { scale: 1 }, 0)

    if (items.length) {
      tl.fromTo(items, { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07 }, 0.1)
    }
  })
}

/* --------------------------------------- видимость угловых элементов */

/**
 * Показывать элемент только между hero и подвалом. Так живут кольцо прогресса
 * (левый нижний угол) и виджет эксперта (правый нижний): на первом экране они
 * лезли бы на заголовок, на контактах — на телефоны.
 *
 * @param {Element} el          получает класс is-visible
 * @param {(visible:boolean)=>void} [onChange]
 */
export function watchBetweenHeroAndFooter(el, onChange) {
  if (!el) return

  const hero = document.querySelector('#hero')
  const footer = document.querySelector('#site-footer')

  let pastHero = !hero
  let atFooter = false

  const sync = () => {
    const visible = pastHero && !atFooter
    el.classList.toggle('is-visible', visible)
    onChange?.(visible)
  }

  sync()

  // 'bottom 50%', а не 'bottom 90%': hero ниже экрана (88svh), и на отметке
  // 90% его низ оказывается в кадре ещё при нулевой прокрутке — угловые
  // элементы показывались бы прямо на первом экране. Середина экрана —
  // однозначный признак, что первый экран пройден.
  if (hero) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'bottom 50%',
      onEnter: () => { pastHero = true; sync() },
      onLeaveBack: () => { pastHero = false; sync() },
    })
  }

  if (footer) {
    ScrollTrigger.create({
      trigger: footer,
      start: 'top 85%',
      onEnter: () => { atFooter = true; sync() },
      onLeaveBack: () => { atFooter = false; sync() },
    })
  }
}

/* ------------------------------------------------- кольцо прогресса */

/**
 * Кольцо показывает долю прочитанного, номер текущей остановки и её название.
 *
 * Остановки — не то же самое, что секции: #trust это узкая полоса под первым
 * экраном, отдельной остановкой она не считается и относится к «01 Начало».
 * Поэтому номер и подпись каждая секция несёт на себе в data-ring-num /
 * data-ring-label (проставляются при сборке, см. js/sections/index.js), а не
 * вычисляются здесь из позиции в DOM.
 */
function createProgressRing() {
  const ring = document.querySelector('.progress-ring')
  if (!ring) return

  const bar = ring.querySelector('.progress-ring__bar')
  const num = ring.querySelector('.progress-ring__num')
  const caption = ring.querySelector('.progress-ring__label')
  const sections = gsap.utils.toArray('#main .section')
  if (!bar || !num || !sections.length) return

  const radius = Number(bar.getAttribute('r'))
  const circumference = 2 * Math.PI * radius
  ring.style.setProperty('--ring-circumference', circumference.toFixed(2))

  const setProgress = (value) => {
    const clamped = Math.max(0, Math.min(1, value))
    bar.style.strokeDashoffset = (circumference * (1 - clamped)).toFixed(2)
  }

  setProgress(0)

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => setProgress(self.progress),
  })

  /* Подмена подписи: гасим, меняем текст в темноте, проявляем. Иначе на
     границе секций видно, как одно название перебивает другое. */
  const fade = REDUCED ? 0 : RING_FADE
  let current = null
  let swapTimer = null

  const setStop = (stopNum, stopLabel, isDark) => {
    ring.classList.toggle('is-over-dark', isDark)
    if (stopNum === current) return
    current = stopNum

    clearTimeout(swapTimer)
    ring.classList.add('is-swapping')

    swapTimer = setTimeout(() => {
      num.textContent = stopNum
      if (caption) caption.textContent = stopLabel
      ring.classList.remove('is-swapping')
    }, fade)
  }

  // Первая остановка проставляется сразу: до первой прокрутки кольцо должно
  // показывать «01 Начало», а не пустую строку.
  const first = sections[0]
  if (first) {
    num.textContent = first.dataset.ringNum || '01'
    if (caption) caption.textContent = first.dataset.ringLabel || ''
    current = first.dataset.ringNum || '01'
  }

  sections.forEach((section) => {
    const stopNum = section.dataset.ringNum
    const stopLabel = section.dataset.ringLabel || ''
    const isDark = section.classList.contains('section--dark')
    if (!stopNum) return

    const apply = () => setStop(stopNum, stopLabel, isDark)

    ScrollTrigger.create({
      trigger: section,
      start: 'top 60%',
      end: 'bottom 60%',
      onEnter: apply,
      onEnterBack: apply,
    })
  })

  watchBetweenHeroAndFooter(ring)
}

/* ------------------------------------------------------------------ init */

/**
 * Только инерция, без reveal-анимаций и кольца прогресса.
 *
 * Для внутренних страниц: ощущение прокрутки на всём сайте должно быть одно,
 * а появление секций из-под маски — приём главной. В каталоге он был бы вреден
 * отдельно: сетка товаров перерисовывается на каждое нажатие фильтра, и
 * анимация входа превратилась бы в мигание выдачи.
 *
 * Поднимает тот же модульный lenis, что и initScroll(), — иначе getLenis()
 * вернул бы null и мобильное меню не смогло бы остановить инерцию под собой.
 */
export function initSmoothScroll() {
  if (REDUCED) return
  createLenis()
}

export function initScroll() {
  if (!REDUCED) createLenis()

  createReveals()
  createProgressRing()

  ScrollTrigger.refresh()
  window.addEventListener('load', () => ScrollTrigger.refresh())

  // Шрифты меняют высоту заголовков — пересчитываем позиции триггеров.
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())
}
