/* ============================================================================
   sticky — липкая кнопка посадочной страницы (/partners). После первого
   экрана внизу справа появляется капсула «Заказать дегустацию» (якорь
   на форму), прячется, когда форма в экране, и у подвала. На узкой
   раскладке — полоса во всю ширину внизу с отступом safe-area.
   Блок — <aside>, а не <section>: своего содержимого у него нет.
   ============================================================================ */

import { esc } from './_html.js'
import { scrollToEl } from './_motion.js'

export function buildSticky(d) {
  return `<aside class="ib ib--sticky" data-ib="sticky" data-target="${esc(d.href)}" aria-label="${esc(d.label)}">
    <a class="btn btn--solid ib-sticky__btn" href="${esc(d.href)}">${esc(d.label)}</a>
  </aside>`
}

export function initSticky(el) {
  const target = document.querySelector(el.dataset.target)
  const hero = document.querySelector('[data-ib="hero"]')
  const footer = document.querySelector('#site-footer')
  const link = el.querySelector('a')

  // Кнопка висит поверх страницы — выносим её из потока <main> в <body>,
  // чтобы ни одна секция с clip-path или isolation её не обрезала.
  document.body.appendChild(el)

  const state = { past: false, form: false, foot: false }
  const sync = () => {
    const on = state.past && !state.form && !state.foot
    el.classList.toggle('is-visible', on)
    link.tabIndex = on ? 0 : -1
    el.setAttribute('aria-hidden', String(!on))
  }
  sync()

  if (!('IntersectionObserver' in window)) return
  if (hero) {
    new IntersectionObserver(([e]) => {
      state.past = !e.isIntersecting && e.boundingClientRect.top < 0
      sync()
    }).observe(hero)
  }
  if (target) {
    new IntersectionObserver(([e]) => {
      state.form = e.isIntersecting
      sync()
    }, { threshold: 0.01 }).observe(target)
  }
  if (footer) {
    new IntersectionObserver(([e]) => {
      state.foot = e.isIntersecting
      sync()
    }).observe(footer)
  }

  link.addEventListener('click', (event) => {
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    scrollToEl(target)
  })
}
