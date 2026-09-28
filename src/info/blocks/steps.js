/* ============================================================================
   steps — шаги. Горизонтальная линия 1px --gold с кругами-номерами
   акцентом; под кругом — название (Prata 1.25rem) и текст. Линия
   прорисовывается слева направо за 1.2 с при появлении, круги загораются
   по мере прохода линии. На узкой раскладке линия вертикальная слева.
   ============================================================================ */

import { esc, head, section } from './_html.js'
import { DESKTOP, ScrollTrigger, gsap, matches, reduced } from './_motion.js'

const pad = (n) => String(n).padStart(2, '0')

export function buildSteps(d) {
  return section('steps', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-steps__track" data-steps>
        <span class="ib-steps__line" aria-hidden="true"><span class="ib-steps__fill" data-steps-fill></span></span>
        <ol class="ib-steps__list" style="--steps: ${d.items.length}">
          ${d.items
            .map(
              (item, i) => `
            <li class="ib-steps__item" data-steps-item>
              <span class="ib-steps__num" aria-hidden="true">${pad(i + 1)}</span>
              <h3 class="ib-steps__title">${esc(item.title)}</h3>
              <p class="ib-steps__text">${esc(item.text)}</p>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    </div>`)
}

export function initSteps(root) {
  const track = root.querySelector('[data-steps]')
  const fill = root.querySelector('[data-steps-fill]')
  const items = [...root.querySelectorAll('[data-steps-item]')]
  if (!track || !fill) return

  if (reduced()) {
    items.forEach((item) => item.classList.add('is-lit'))
    track.classList.add('is-drawn')
    return
  }

  ScrollTrigger.create({
    trigger: track,
    start: 'top 78%',
    once: true,
    onEnter: () => {
      const wide = matches(DESKTOP)
      const line = fill.parentElement
      const length = wide ? line.offsetWidth : line.offsetHeight
      const prop = wide ? 'scaleX' : 'scaleY'
      const duration = 1.2
      gsap.fromTo(fill, { [prop]: 0 }, {
        [prop]: 1,
        duration,
        ease: 'none',
        onComplete: () => track.classList.add('is-drawn'),
      })
      items.forEach((item) => {
        const num = item.querySelector('.ib-steps__num')
        const lineBox = line.getBoundingClientRect()
        const box = num.getBoundingClientRect()
        const at = wide ? box.left + box.width / 2 - lineBox.left : box.top + box.height / 2 - lineBox.top
        const t = Math.max(0, Math.min(1, at / (length || 1))) * duration
        gsap.delayedCall(t, () => item.classList.add('is-lit'))
      })
    },
  })
}
