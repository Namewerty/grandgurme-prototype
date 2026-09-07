/* ============================================================================
   #trust — полоса доверия.
   Невысокая светлая секция сразу под hero: её край видно уже при загрузке.
   Вход — общий reveal из scroll.js (data-reveal-section / data-reveal).
   ============================================================================ */

import { trustItems } from '../../data/trust.js'
import { icons } from '../icons.js'

export function buildTrust(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section trust'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-label', 'Гарантии')

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <ul class="trust__list">
          ${trustItems
            .map(
              ({ icon, title, note }) => `
            <li class="trust__item" data-reveal>
              <span class="trust__icon" aria-hidden="true">${icons[icon] || ''}</span>
              <span class="trust__body">
                <span class="trust__title">${title}</span>
                <span class="trust__note">${note}</span>
              </span>
            </li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>
  `

  return section
}
