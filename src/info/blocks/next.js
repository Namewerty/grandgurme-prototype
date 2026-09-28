/* ============================================================================
   next — «Дальше»: последний блок перед подвалом. Надзаголовок «ДАЛЬШЕ»,
   три карточки-ссылки в ряд: название Prata 1.4rem, первое предложение
   lead страницы из src/data/routes.js, стрелка.
   ============================================================================ */

import { esc, section } from './_html.js'

/** Первое предложение: до первой точки, за которой пробел и заглавная. */
export const firstSentence = (text) => {
  const match = String(text).match(/^.*?[.!?](?=\s+[А-ЯЁA-Z«№]|$)/)
  return (match ? match[0] : String(text)).trim()
}

export function buildNext(d) {
  return section('next', { ...d, title: null }, `
    <div class="container">
      <p class="eyebrow" data-reveal>${esc(d.eyebrow)}</p>
      <ul class="ib-next__grid" aria-label="${esc(d.label)}">
        ${d.links
          .map(
            (l) => `
          <li data-reveal>
            <a class="ib-next__card" href="${esc(l.path)}">
              <span class="ib-next__title">${esc(l.title)}</span>
              <span class="ib-next__lead">${esc(firstSentence(l.lead))}</span>
              <span class="ib-next__arrow" aria-hidden="true">→</span>
            </a>
          </li>`,
          )
          .join('')}
      </ul>
    </div>`)
}
