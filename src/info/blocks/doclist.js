/* ============================================================================
   doclist — документы списком (/documents → #list). Строки через волосяную
   линию: название, номер, срок действия, «Скачать PDF» или «по запросу»
   со ссылкой на форму запроса. Строка без number номер не показывает,
   без valid — срок, с file: null — пишет «по запросу».
   ============================================================================ */

import { esc, head, section } from './_html.js'

export function buildDoclist(d) {
  const l = d.labels
  return section('doclist', d, `
    <div class="container">
      ${head(d)}
      <ul class="ib-docs">
        ${d.items
          .map(
            (item) => `
          <li class="ib-docs__row" data-reveal>
            <span class="ib-docs__title">${esc(item.title)}</span>
            <span class="ib-docs__meta">
              ${item.number ? `<span>${esc(l.number)} ${esc(item.number)}</span>` : ''}
              ${item.valid ? `<span>${esc(l.valid)} ${esc(item.valid)}</span>` : ''}
            </span>
            ${
              item.file
                ? `<a class="btn ib-docs__action" href="${esc(item.file)}" download>${esc(l.download)}</a>`
                : `<a class="ib-docs__request" href="${esc(d.requestHref)}">${esc(l.onRequest)} <span aria-hidden="true">→</span></a>`
            }
          </li>`,
          )
          .join('')}
      </ul>
    </div>`)
}
