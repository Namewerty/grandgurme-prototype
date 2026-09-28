/* ============================================================================
   table — условия и реквизиты. <dl> в две колонки: подпись 0.75rem
   с разрядкой, значение 1rem, строки через волосяную линию.

   Строка с value: null не выводится; не осталось ни одной — вместо таблицы
   абзац fallback. Когда компания ответит, значение вписывается в данные,
   и строка появляется без правок в разметке.

   Значение может быть ссылкой (href) или несколькими ссылками (links).
   copy: true — кнопка «Скопировать»: копирует выведенные строки как
   «подпись: значение», подпись кнопки на 2 с меняется на «Скопировано».
   ============================================================================ */

import { esc, head, inline, more, paras, present, section } from './_html.js'
import { copyText } from './_copy.js'

function value(row) {
  if (row.links?.length) {
    return row.links.map((l) => `<a class="ib-link" href="${esc(l.href)}">${esc(l.label)}</a>`).join('<span class="ib-table__dot" aria-hidden="true"> · </span>')
  }
  if (row.href) return `<a class="ib-link" href="${esc(row.href)}">${esc(row.value)}</a>`
  return inline(row.value)
}

export function buildTable(d) {
  const rows = present(d.rows)
  const table = rows.length
    ? `
      <dl class="ib-table__list" data-table>
        ${rows
          .map(
            (row) => `
          <div class="ib-table__row" data-reveal>
            <dt class="ib-table__label" data-table-label>${esc(row.label)}</dt>
            <dd class="ib-table__value" data-table-value>${value(row)}</dd>
          </div>`,
          )
          .join('')}
      </dl>
      ${
        d.copy
          ? `<p class="ib-table__copy" data-reveal><button type="button" class="btn ib-table__copy-btn" data-copy-table data-done="${esc(d.copyDone)}">${esc(d.copyLabel)}</button></p>`
          : ''
      }`
    : `<p class="ib-table__fallback" data-reveal>${inline(d.fallback)}</p>`

  return section('table', d, `
    <div class="container">
      <div class="ib-table__grid">
        <div class="ib-table__head">
          ${head(d)}
          ${d.text ? paras([d.text]) : ''}
          ${d.action ? `<p class="ib-table__action" data-reveal>${more(d.action)}</p>` : ''}
        </div>
        <div class="ib-table__body">${table}</div>
      </div>
    </div>`)
}

export function initTable(root) {
  const button = root.querySelector('[data-copy-table]')
  if (!button) return
  const label = button.textContent
  let timer = null
  button.addEventListener('click', async () => {
    const lines = [...root.querySelectorAll('.ib-table__row')].map((row) => {
      const l = row.querySelector('[data-table-label]').textContent.trim()
      const v = row.querySelector('[data-table-value]').textContent.replace(/\s+/g, ' ').trim()
      return `${l}: ${v}`
    })
    const ok = await copyText(lines.join('\n'))
    if (!ok) return
    button.textContent = button.dataset.done
    clearTimeout(timer)
    timer = setTimeout(() => (button.textContent = label), 2000)
  })
}
