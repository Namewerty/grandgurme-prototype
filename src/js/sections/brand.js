/* ============================================================================
   #brand — о бренде. Стоит сразу под полосой доверия, до всего товарного.

   Композиция — асимметричный коллаж по мотиву блока о компании на действующем
   сайте: слева крупный вертикальный кадр с курсивной врезкой, справа текст,
   факты, ссылка и два меньших кадра разного формата.

   Крупный кадр — media--fill: он не задаёт высоту блока, а забирает ту,
   которую набрала текстовая колонка. Иначе 3:4 при ширине ~500px дал бы
   почти 700px только на фото, и блок вырос бы на целый экран — чего
   заказчик просил избежать: блок информационный, но компактный.

   Своей анимации у секции нет: вход идёт общим reveal из scroll.js
   (data-reveal-section / data-reveal), крупный кадр помечен data-reveal-media
   и наезжает из 1.045 в 1. Поэтому в src/js/sections/index.js нет initBrand.
   ============================================================================ */

import { brand } from '../../data/brand.js'
import { brandStory } from '../../data/media.js'
import { createImage } from '../media.js'

export function buildBrand(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section brand'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="brand__grid">

          <figure class="brand__main" data-brand-main>
            <figcaption class="brand__quote">${brand.quote}</figcaption>
          </figure>

          <div class="brand__text">
            <p class="eyebrow" data-reveal>${brand.eyebrow}</p>
            <h2 id="${item.id}-title" class="brand__title" data-reveal>${brand.title}</h2>

            ${brand.paragraphs
              .map((text) => `<p class="brand__p" data-reveal>${text}</p>`)
              .join('')}

            <dl class="brand__facts" data-reveal>
              ${brand.facts
                .map(
                  ({ value, label }) => `
              <div class="brand__fact">
                <dt class="brand__fact-num">${value}</dt>
                <dd class="brand__fact-label">${label}</dd>
              </div>`,
                )
                .join('')}
            </dl>

            <p class="brand__action" data-reveal>
              <a class="brand__link" href="${brand.action.href}">
                <span>${brand.action.label}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M4 12h15M13.5 6.5 20 12l-6.5 5.5"/>
                </svg>
              </a>
            </p>
          </div>

          <div class="brand__gallery" data-reveal>
            ${brandStory.detail
              .map(
                (_, i) => `<div class="brand__detail" data-brand-detail="${i}"></div>`,
              )
              .join('')}
          </div>

        </div>
      </div>
    </div>
  `

  // Крупный кадр: fill, поэтому пропорция 3:4 работает только подписью
  // заглушки — высоту забирает грид-ячейка.
  const main = createImage({ ...brandStory.main, fill: true })
  main.setAttribute('data-reveal-media', '')
  section.querySelector('[data-brand-main]').prepend(main)

  // Меньшие кадры тоже fill: ряд держит одну высоту на оба, а разный формат
  // читается по разной ширине колонок (см. .brand__gallery в CSS).
  section.querySelectorAll('[data-brand-detail]').forEach((slot) => {
    const config = brandStory.detail[Number(slot.dataset.brandDetail)]
    if (!config) return
    slot.appendChild(createImage({ ...config, fill: true }))
  })

  return section
}
