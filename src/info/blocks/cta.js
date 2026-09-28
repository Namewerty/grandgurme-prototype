/* ============================================================================
   cta — тёмная полоса-призыв: H2, абзац, кнопки; справа (колонки 9–12)
   круг с кадром и золотым кольцом, который медленно вращается при
   прокрутке — как круг первого экрана plate.
   ============================================================================ */

import { esc, image, inline, section } from './_html.js'
import { gsap, reduced } from './_motion.js'

export function buildCta(d) {
  const actions = (d.actions || [])
    .map((a) => {
      const cls = a.kind === 'solid' ? 'btn btn--solid' : 'btn'
      const ext = /^https?:/.test(a.href) || a.external ? ' target="_blank" rel="noopener"' : ''
      return `<a class="${cls} ib-btn" href="${esc(a.href)}"${ext}>${esc(a.label)}</a>`
    })
    .join('')

  return section('cta', d, `
    <div class="container">
      <div class="ib-cta__grid">
        <div class="ib-cta__text">
          <h2 class="ib__title" id="${esc(d.id)}-title" data-reveal>${esc(d.title)}</h2>
          ${d.text ? `<p class="ib__p" data-reveal>${inline(d.text)}</p>` : ''}
          ${actions ? `<div class="ib__actions" data-reveal>${actions}</div>` : ''}
        </div>
        ${
          d.media
            ? `<div class="ib-cta__disc" data-reveal><div class="ib-cta__ring"><div class="ib-cta__turn" data-cta-turn>${image(d.media, { round: true, ratio: '1:1' })}</div></div></div>`
            : ''
        }
      </div>
    </div>`)
}

export function initCta(root) {
  // Поворачивается кадр внутри круга: его обрезает круглая рамка.
  const turn = root.querySelector('[data-cta-turn] img')
  if (!turn || reduced()) return
  gsap.fromTo(turn, { rotate: -8 }, {
    rotate: 8,
    ease: 'none',
    scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true },
  })
}
