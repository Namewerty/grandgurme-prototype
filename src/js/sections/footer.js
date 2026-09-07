/* ============================================================================
   Подвал — полный указатель по сайту. Всегда тёмный. Здесь же незаметный
   переключатель темы.

   Раскладка сменилась вместе с составом: колонок стало пять (каталог,
   покупателям, компания, сотрудничество, контакты), и брендовый блок больше
   не стоит с ними в один ряд — он ушёл строкой выше. Пять колонок рядом
   с блоком текста давали по 150 пикселей на колонку, и «Корпоративные заказы
   и подарки» ломались на четыре строки.

   Что в подвале есть и чего нет — в шапке src/data/footer.js.
   ============================================================================ */

import {
  footerColumns,
  footerContacts,
  footerTagline,
  legal,
  payments,
  socials,
} from '../../data/footer.js'
import { brandName } from '../../data/nav.js'
import { toggleTheme, themeLabel } from '../theme.js'

const column = ({ title, links }) => `
  <div class="footer__col">
    <h2 class="footer__col-title">${title}</h2>
    ${links.map((l) => `<a class="footer__link" href="${l.href}">${l.label}</a>`).join('')}
  </div>
`

const social = ({ label, href, icon }) => `
  <a class="icon-btn" href="${href}" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icon}</svg>
    <span class="visually-hidden">${label}</span>
  </a>
`

export function initFooter() {
  const mount = document.querySelector('#site-footer')
  if (!mount) return

  mount.innerHTML = `
    <div class="container">
      <div class="footer__inner">
        <div class="footer__lead">
          <div class="footer__brand">
            <span class="wordmark">
              <span class="wordmark__num">${brandName.num}</span><span>${brandName.name}</span>
            </span>
            <p class="footer__tagline">${footerTagline}</p>
          </div>

          <div class="footer__aside">
            <div class="footer__social">${socials.map(social).join('')}</div>
            <div class="pay">
              ${payments.map((p) => `<span class="pay__badge">${p}</span>`).join('')}
            </div>
          </div>
        </div>

        <div class="footer__top">
          ${footerColumns.map(column).join('')}

          <div class="footer__col">
            <h2 class="footer__col-title">${footerContacts.title}</h2>
            ${footerContacts.items
              .map((i) => `<a class="footer__link" href="${i.href}">${i.label}</a>`)
              .join('')}
          </div>
        </div>

        <div class="footer__bottom">
          <p>${legal.copyright} · ${legal.disclaimer}</p>
          <div class="footer__legal">
            ${legal.links
              .map((l) => `<a class="footer__link" href="${l.href}">${l.label}</a>`)
              .join('')}
            <button class="theme-toggle" type="button" data-theme-toggle aria-live="polite">
              <span class="theme-toggle__dot" aria-hidden="true"></span>
              <span data-theme-label>Тема: ${themeLabel()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `

  const button = mount.querySelector('[data-theme-toggle]')
  const label = mount.querySelector('[data-theme-label]')

  button?.addEventListener('click', () => {
    const next = toggleTheme()
    if (label) label.textContent = `Тема: ${themeLabel(next)}`
  })
}
