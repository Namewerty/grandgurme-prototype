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
 * Показывать элемент только между hero и подвалом. Так живёт виджет эксперта
 * (правый нижний угол): на первом экране он лез бы на заголовок, на контактах —
 * на телефоны. Кольцо прогресса в левом нижнем углу жило так же и снято
 * 29.09.2026.
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

/* ------------------------------------------------------------------ init */

/**
 * Только инерция, без reveal-анимаций.
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

  ScrollTrigger.refresh()
  window.addEventListener('load', () => ScrollTrigger.refresh())

  // Шрифты меняют высоту заголовков — пересчитываем позиции триггеров.
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())
}
