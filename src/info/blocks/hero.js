/* ============================================================================
   hero — первый экран информационной страницы. Три вида (поле variant):

     stage    тёмный, кадр справа — раскладка первого экрана /alt2: текст
              в колонках 1–5 на --void, кадр от колонки 6 до края окна на всю
              высоту, секция заходит под прозрачную шапку (data-hero, см.
              watchHeaderState в src/js/sections/header.js). mediaFit: 'circle' —
              пэкшот на белом: кадр в круге --on-dark с multiply по центру
              правой половины;
     plate    светлый, кадр в круге с золотым кольцом справа; круг поворачивает
              кадр на 6° за высоту первого экрана;
     compact  светлый, без кадра; у /faq под lead — поле поиска.

   Крошки — над первым экраном, внутри блока: на тёмном они светлые сами
   (семантика токенов в .section--dark).

   ?segment=… (только /partners): строки сегментов лежат data-атрибутами
   на lead, init меняет текст и выбирает сегмент в форме (src/info/blocks/form.js
   слушает событие ib:segment).
   ============================================================================ */

import { esc, image, inline, section } from './_html.js'
import { FINE, WIDE, gsap, ScrollTrigger, matches, reduced } from './_motion.js'

function crumbs(list = [], label = '') {
  if (!list.length) return ''
  const items = list.map((c, i) =>
    i === list.length - 1
      ? `<span class="crumbs__current" aria-current="page">${esc(c.label)}</span>`
      : `<a href="${esc(c.href)}">${esc(c.label)}</a><span class="crumbs__sep" aria-hidden="true"></span>`,
  )
  return `<nav class="crumbs ib-hero__crumbs" aria-label="${esc(label)}" data-hero-fade>${items.join('')}</nav>`
}

function facts(list = []) {
  if (!list.length) return ''
  return `
    <dl class="ib-hero__facts" data-hero-fade>
      ${list.map((f) => `<div class="ib-hero__fact"><dt>${esc(f.value)}</dt><dd>${esc(f.label)}</dd></div>`).join('')}
    </dl>`
}

function actions(list = []) {
  if (!list.length) return ''
  return `<div class="ib-hero__actions" data-hero-fade>${list
    .map((a) => {
      const cls = a.kind === 'solid' ? 'btn btn--solid' : 'btn'
      const ext = /^https?:/.test(a.href) || a.external ? ' target="_blank" rel="noopener"' : ''
      return `<a class="${cls} ib-btn" href="${esc(a.href)}"${ext}>${esc(a.label)}</a>`
    })
    .join('')}</div>`
}

function search(s) {
  if (!s) return ''
  return `
    <form class="ib-hero__search" role="search" data-ib-search="${esc(s.target)}" data-hero-fade>
      <label class="visually-hidden" for="ib-search-input">${esc(s.label)}</label>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <input id="ib-search-input" class="ib-hero__search-input" type="search" name="q"
             placeholder="${esc(s.placeholder)}" autocomplete="off" enterkeyhint="search">
    </form>`
}

function lead(d) {
  if (!d.lead) return ''
  const segs = d.segments
    ? Object.entries(d.segments).map(([k, v]) => ` data-segment-${esc(k)}="${esc(v)}"`).join('')
    : ''
  return `<p class="ib-hero__lead" data-hero-fade data-hero-lead${segs}>${inline(d.lead)}</p>`
}

function title(d) {
  const lines = Array.isArray(d.title) ? d.title : [d.title]
  const alt = d.titleAlternatives?.length
    ? `<!-- Запасные H1: «${d.titleAlternatives.map(esc).join('» / «')}» -->`
    : ''
  return `${alt}<h1 class="ib-hero__title" id="${esc(d.id)}-title">${lines
    .map((line) => `<span class="ib-hero__line" data-hero-line>${esc(line)}</span>`)
    .join('<br>')}</h1>`
}

function content(d) {
  return `
    <div class="ib-hero__content">
      ${crumbs(d.crumbs, d.crumbsLabel)}
      ${d.eyebrow ? `<p class="eyebrow ib-hero__eyebrow" data-hero-eyebrow>${esc(d.eyebrow)}</p>` : ''}
      ${title(d)}
      ${lead(d)}
      ${search(d.search)}
      ${actions(d.actions)}
      ${facts(d.facts)}
    </div>`
}

export function buildHero(d) {
  const variant = d.variant || 'compact'
  const attrs = ` data-variant="${variant}"${variant === 'stage' ? ' data-hero' : ''}`
  const cls = `ib-hero--${variant}${d.mediaFit === 'circle' ? ' ib-hero--circle' : ''}`

  if (variant === 'stage') {
    const media =
      d.mediaFit === 'circle'
        ? `<div class="ib-hero__disc" data-hero-frame>${image(d.media, { round: true, ratio: '1:1', loading: 'eager', className: 'ib-hero__pack' })}</div>`
        : `<div class="ib-hero__frame" data-hero-frame>${image(d.media, { fill: true, loading: 'eager' })}</div>`
    return section('hero', d, `
      <div class="ib-hero__media" data-hero-media>
        ${media}
        <div class="ib-hero__scrim" aria-hidden="true"></div>
      </div>
      <div class="container ib-hero__inner">${content(d)}</div>`, { reveal: false, cls, attrs })
  }

  if (variant === 'plate') {
    return section('hero', d, `
      <div class="container">
        <div class="ib-hero__grid">
          ${content(d)}
          <div class="ib-hero__plate" data-hero-media>
            <div class="ib-hero__ring">
              <div class="ib-hero__turn" data-hero-turn>${image(d.media, { round: true, ratio: '1:1', loading: 'eager' })}</div>
            </div>
          </div>
        </div>
      </div>`, { reveal: false, cls, attrs })
  }

  return section('hero', d, `<div class="container">${content(d)}</div>`, { reveal: false, cls, attrs })
}

/* ------------------------------------------------------------------- init */

export function initHero(root) {
  const variant = root.dataset.variant
  const params = new URLSearchParams(location.search)

  /* ?segment= — строка сегмента вместо lead. */
  const leadEl = root.querySelector('[data-hero-lead]')
  const applySegment = (key) => {
    if (!leadEl) return
    const text = key && leadEl.getAttribute(`data-segment-${key}`)
    if (!leadEl.dataset.base) leadEl.dataset.base = leadEl.innerHTML
    leadEl.innerHTML = text ? esc(text) : leadEl.dataset.base
  }
  if (leadEl && params.get('segment')) applySegment(params.get('segment'))
  document.addEventListener('ib:segment', (event) => applySegment(event.detail?.key))

  if (variant === 'plate' && !reduced()) {
    // Поворачивается кадр внутри круга, а не круг: габарит повёрнутого
    // блока шире, кадр же обрезан своей круглой рамкой.
    const turn = root.querySelector('[data-hero-turn] img')
    if (turn) {
      gsap.to(turn, {
        rotate: 6,
        ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
      })
    }
  }

  if (reduced()) return
  playIntro(root, variant)

  if (variant === 'stage') {
    const frame = root.querySelector('[data-hero-frame]')
    const mm = gsap.matchMedia()
    mm.add(`${WIDE} and ${FINE}`, () => {
      const xTo = gsap.quickTo(frame, 'x', { duration: 0.8, ease: 'power3.out' })
      const yTo = gsap.quickTo(frame, 'y', { duration: 0.8, ease: 'power3.out' })
      const onMove = (event) => {
        const box = root.getBoundingClientRect()
        const nx = ((event.clientX - box.left) / box.width) * 2 - 1
        const ny = ((event.clientY - box.top) / box.height) * 2 - 1
        xTo(Math.max(-1, Math.min(1, nx)) * 10)
        yTo(Math.max(-1, Math.min(1, ny)) * 6)
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }
      root.addEventListener('pointermove', onMove)
      root.addEventListener('pointerleave', onLeave)
      return () => {
        root.removeEventListener('pointermove', onMove)
        root.removeEventListener('pointerleave', onLeave)
        gsap.set(frame, { clearProps: 'x,y' })
      }
    })
  }
}

/**
 * Вход: кадр проявляется за 1,2 с, затем надзаголовок, строки H1 из-под
 * маски (приём hero.js), lead, кнопки и факты каскадом по 60 мс.
 */
function playIntro(root, variant) {
  const media = root.querySelector('[data-hero-media]')
  const eyebrow = root.querySelector('[data-hero-eyebrow]')
  const lines = root.querySelectorAll('[data-hero-line]')
  const fades = root.querySelectorAll('[data-hero-fade]')
  const start = media ? 0.6 : 0.1

  const tl = gsap.timeline({ delay: 0.1, defaults: { ease: 'power3.out' } })
  if (media) tl.fromTo(media, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0)
  if (eyebrow) {
    tl.fromTo(eyebrow, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7 }, start)
  }
  if (lines.length) {
    tl.fromTo(
      lines,
      { clipPath: 'inset(100% 0% 0% 0%)', yPercent: 8 },
      { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 0.9, stagger: 0.14 },
      start + 0.1,
    )
  }
  if (fades.length) {
    tl.fromTo(fades, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06 }, start + 0.5)
  }
  tl.eventCallback('onComplete', () => {
    gsap.set([eyebrow, ...lines, ...fades].filter(Boolean), { clearProps: 'clipPath,transform,opacity' })
    ScrollTrigger.refresh()
  })
  if (variant === 'stage' && media) {
    const frame = root.querySelector('[data-hero-frame] .media')
    if (frame) gsap.fromTo(frame, { scale: 1.06 }, { scale: 1, duration: 6, ease: 'power2.out', delay: 0.1 })
  }
}
