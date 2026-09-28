/* ============================================================================
   Общее для init* блоков: движение, раскладки, отложенные кадры.

   Всё, что трогает window, — функциями, а не константами модуля: файлы
   блоков импортирует и node (scripts/info-snapshot.mjs), где window нет.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

/** Те же условия, что у первого экрана /alt2 (stage.css). */
export const WIDE = '(min-width: 1024px) and (min-height: 600px)'
export const DESKTOP = '(min-width: 1024px)'
export const FINE = '(hover: hover) and (pointer: fine)'

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const matches = (query) => window.matchMedia(query).matches

/**
 * Кадры с data-src получают адрес, когда корень подходит к экрану ближе
 * margin. Так грузятся ленты и доски: loading="lazy" в первых двух экранах
 * не спасает — порог Chrome 1250–2500px.
 */
export function loadDeferred(root, margin = '400px 0px') {
  const imgs = [...root.querySelectorAll('img[data-src]')]
  if (!imgs.length) return
  const go = () => imgs.forEach((img) => {
    if (!img.dataset.src) return
    // Кадры стопок и лент нужны сразу: подошли к экрану — грузим все,
    // а не по одному, когда каждый доедет до своего порога lazy.
    img.loading = 'eager'
    img.src = img.dataset.src
    img.removeAttribute('data-src')
  })
  if (!('IntersectionObserver' in window)) return go()
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return
    io.disconnect()
    go()
  }, { rootMargin: margin })
  io.observe(root)
}

/** Колбэк, пока корень на экране (true) и вне его (false). */
export function watchVisible(root, cb, threshold = 0.15) {
  if (!('IntersectionObserver' in window)) return cb(true)
  new IntersectionObserver(([entry]) => cb(entry.isIntersecting), { threshold }).observe(root)
}

/** «товар» / «товара» / «товаров» — как plural из model.js, для init без импорта данных. */
export function plural(n, [one, few, many]) {
  const n10 = n % 10
  const n100 = n % 100
  if (n100 >= 11 && n100 <= 14) return many
  if (n10 === 1) return one
  if (n10 >= 2 && n10 <= 4) return few
  return many
}

export const fill = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) => (values[key] ?? `{${key}}`))

/** JSON из data-атрибута. */
export const readJson = (el, name) => {
  try {
    return JSON.parse(el.dataset[name] || 'null')
  } catch {
    return null
  }
}

/** Липкая шапка и отступ под неё — для прокрутки к цели числом. */
export function headerOffset(extra = 16) {
  const header = document.querySelector('[data-header]')
  return (header ? header.offsetHeight : 0) + extra
}

/* Lenis поднимает src/js/scroll.js, а его модуль читает window при импорте —
   блоки его не импортируют. Точка входа передаёт сюда getLenis. */
let lenisOf = () => null
export const setLenisGetter = (fn) => {
  lenisOf = fn
}

/** Прокрутка к числу через Lenis, без него — нативно. Цель — числом:
    Lenis у элемента сам вычитает scroll-margin-top (см. scroll.js). */
export function scrollToY(y, duration = 1.2) {
  const target = Math.max(0, y)
  const lenis = lenisOf()
  if (lenis) lenis.scrollTo(target, { duration: reduced() ? 0 : duration, force: true })
  else window.scrollTo({ top: target, behavior: reduced() ? 'auto' : 'smooth' })
}

/** Прокрутка к элементу с отступом под шапку (и, если есть, под оглавление). */
export function scrollToEl(el, extra = 16) {
  if (!el) return
  const subnav = document.querySelector('[data-ib="subnav"]')
  const sub = subnav ? subnav.offsetHeight : 0
  scrollToY(window.scrollY + el.getBoundingClientRect().top - headerOffset(extra) - sub)
}
