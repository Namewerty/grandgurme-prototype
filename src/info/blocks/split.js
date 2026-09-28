/* ============================================================================
   split — кадр и текст рядом. Кадр 4:5, --radius-card, сторона — поле side.
   При прокрутке кадр смещается на 8 % своей высоты медленнее текста
   (параллакс scrub, без него при reduced motion).
   Поля: eyebrow, title, paragraphs[], list[], action, media, side.
   ============================================================================ */

import { esc, head, image, inline, more, paras, section } from './_html.js'
import { gsap, reduced } from './_motion.js'

export function buildSplit(d) {
  const side = d.side === 'right' ? 'right' : 'left'
  const list = d.list?.length
    ? `<ul class="ib-split__list" data-reveal>${d.list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`
    : ''
  const action = d.action
    ? d.action.kind
      ? `<p class="ib-split__action" data-reveal><a class="btn${d.action.kind === 'solid' ? ' btn--solid' : ''} ib-btn" href="${esc(d.action.href)}"${
          d.action.external ? ' target="_blank" rel="noopener"' : ''
        }>${esc(d.action.label)}</a></p>`
      : `<p class="ib-split__action" data-reveal>${more(d.action)}</p>`
    : ''

  return section('split', d, `
    <div class="container">
      <div class="ib-split__grid ib-split__grid--${side}">
        <div class="ib-split__media" data-split-media>
          <div class="ib-split__shift" data-split-shift>${image(d.media, { ratio: '4:5' })}</div>
        </div>
        <div class="ib-split__text">
          ${head(d)}
          ${paras(d.paragraphs)}
          ${list}
          ${action}
        </div>
      </div>
    </div>`)
}

export function initSplit(root) {
  if (reduced()) return
  const shift = root.querySelector('[data-split-shift]')
  if (!shift) return
  gsap.fromTo(
    shift,
    { yPercent: 4 },
    {
      yPercent: -4,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true },
    },
  )
}
