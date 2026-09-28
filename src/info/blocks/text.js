/* ============================================================================
   text — текст с врезкой. Надзаголовок, H2, абзацы (колонки 1–7, до 62ch),
   справа (колонки 9–12) необязательная врезка:
     quote — крупная фраза акцентом 1.6rem;
     media — кадр --radius-card;
     year  — число акцентом clamp(6rem, 14vw, 12rem) с подписью; цифры
             проявляются по одной слева направо за 800 мс, без отсчёта
             (как count: false в #proof).
   ============================================================================ */

import { esc, head, image, inline, more, paras, section } from './_html.js'
import { gsap, reduced } from './_motion.js'

function aside(a) {
  if (!a) return ''
  if (a.kind === 'media') {
    return `<div class="ib-text__aside ib-text__aside--media" data-reveal>${image(a.media, { className: 'ib-text__media' })}</div>`
  }
  if (a.kind === 'year') {
    const digits = [...String(a.text)].map((c) => `<span class="ib-text__digit">${esc(c)}</span>`).join('')
    return `
      <div class="ib-text__aside ib-text__aside--year">
        <p class="ib-text__year" data-text-year aria-label="${esc(a.text)}"><span aria-hidden="true">${digits}</span></p>
        ${a.caption ? `<p class="ib-text__caption" data-reveal>${esc(a.caption)}</p>` : ''}
      </div>`
  }
  return `<div class="ib-text__aside"><p class="ib-text__quote" data-reveal>${inline(a.text)}</p></div>`
}

export function buildText(d) {
  return section('text', d, `
    <div class="container">
      <div class="ib-text__grid${d.aside ? ' has-aside' : ''}">
        <div class="ib-text__main">
          ${head(d)}
          <div class="ib-text__body">${paras(d.paragraphs)}</div>
          ${d.action ? `<p class="ib-text__action" data-reveal>${more(d.action)}</p>` : ''}
        </div>
        ${aside(d.aside)}
      </div>
    </div>`)
}

export function initText(root) {
  const year = root.querySelector('[data-text-year]')
  if (!year || reduced()) return
  const digits = year.querySelectorAll('.ib-text__digit')
  gsap.set(digits, { opacity: 0, y: 12 })
  gsap.to(digits, {
    opacity: 1,
    y: 0,
    duration: 0.3,
    // Последняя цифра заканчивает на 800 мс.
    stagger: digits.length > 1 ? 0.5 / (digits.length - 1) : 0,
    ease: 'power2.out',
    scrollTrigger: { trigger: year, start: 'top 85%', once: true },
  })
}
