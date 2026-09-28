/* ============================================================================
   gallery — текст и лента кадров с подписями (/storage → #serve).
   Прокрутка мышью и касанием с привязкой (scroll-snap), стрелки по краям
   на широкой раскладке и ползунок под лентой — механизм ленты витрины
   (src/js/rail.js, одежда — styles/components/rail.css).
   ============================================================================ */

import { esc, head, image, paras, section } from './_html.js'
import { icons } from '../../js/icons.js'
import { initRail } from '../../js/rail.js'
import { loadDeferred } from './_motion.js'

export function buildGallery(d) {
  const arrow = (dir) =>
    `<button type="button" class="rail-edge rail-edge--${dir}" aria-hidden="true" tabindex="-1">${
      dir === 'prev' ? icons.chevronLeft : icons.chevronRight
    }</button>`

  return section('gallery', d, `
    <div class="container">
      <div class="ib-gallery__head">
        ${head(d)}
        ${paras(d.paragraphs)}
      </div>
      <div class="ib-gallery__frame" data-gallery-frame data-reveal>
        <div class="ib-gallery__stage">
          <ul class="ib-gallery__track rail-track rail-mask" aria-label="${esc(d.railLabel)}" tabindex="0" data-gallery-track>
            ${d.items
              .map(
                (item) => `
              <li class="ib-gallery__item">
                <figure>
                  ${image(item.media, { ratio: '4:5', defer: true, className: 'ib-gallery__media' })}
                  <figcaption class="ib-gallery__caption">${esc(item.caption)}</figcaption>
                </figure>
              </li>`,
              )
              .join('')}
          </ul>
          ${arrow('prev')}${arrow('next')}
        </div>
        <div class="ib-gallery__slider">
          <div class="rail-bar" aria-hidden="true"><span class="rail-bar__thumb" data-gallery-bar></span></div>
        </div>
      </div>
    </div>`)
}

export function initGallery(root) {
  const frame = root.querySelector('[data-gallery-frame]')
  if (!frame) return
  loadDeferred(frame, '300px 0px')
  const rail = initRail({
    track: root.querySelector('[data-gallery-track]'),
    frame,
    prev: root.querySelector('.rail-edge--prev'),
    next: root.querySelector('.rail-edge--next'),
    bar: root.querySelector('[data-gallery-bar]'),
  })
  window.addEventListener('load', () => rail.sync(), { once: true })
}
