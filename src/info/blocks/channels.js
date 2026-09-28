/* ============================================================================
   channels — карточки связи (/contacts → #channels). Четыре в ряд
   (2×2 на планшете, столбиком на телефоне), на --surface, --radius-card:
   иконка, подпись, значение крупно — ссылкой, строка под значением
   (null не выводится), у почты — «Скопировать».
   ============================================================================ */

import { esc, ext, section } from './_html.js'
import { icons } from '../../js/icons.js'
import { copyText } from './_copy.js'

export function buildChannels(d) {
  return section('channels', { ...d, title: null }, `
    <div class="container">
      <ul class="ib-channels__grid" aria-label="${esc(d.label)}">
        ${d.items
          .map(
            (c) => `
          <li class="ib-channel" data-reveal>
            <span class="ib-channel__icon">${icons[c.icon] || ''}</span>
            <span class="ib-channel__label">${esc(c.label)}</span>
            <a class="ib-channel__value" href="${esc(c.href)}"${ext(c.href, c.external)}>${esc(c.value)}</a>
            ${c.extra ? `<span class="ib-channel__extra">${esc(c.extra)}</span>` : ''}
            ${
              c.copy
                ? `<button type="button" class="link-btn ib-channel__copy" data-copy="${esc(c.copy)}" data-done="${esc(d.copyDone)}">${esc(d.copyLabel)}</button>`
                : ''
            }
          </li>`,
          )
          .join('')}
      </ul>
    </div>`)
}

export function initChannels(root) {
  root.querySelectorAll('[data-copy]').forEach((button) => {
    const label = button.textContent
    let timer = null
    button.addEventListener('click', async () => {
      if (!(await copyText(button.dataset.copy))) return
      button.textContent = button.dataset.done
      clearTimeout(timer)
      timer = setTimeout(() => (button.textContent = label), 2000)
    })
  })
}
