/* ============================================================================
   thermo — шкала температур (/storage → #cold).

   Вертикальный термометр (колонки 1–4): ось от −20 до +8 °C, деления через
   2°, подписи на −18, −10, −4, −2, 0, +2, +4, +6, +8. Справа от оси —
   полосы диапазонов продуктов на своих высотах (6px, --gold) с подписью.
   Колонки 6–12 — карточка выбранного продукта. Выбор — нажатием на полосу
   или на капсулу продукта над шкалой. Выбранная полоса — 10px --caspian,
   стрелка от неё к карточке. При появлении ртуть поднимается от −20
   до выбранного значения за 900 мс. По умолчанию — чёрная икра.
   Продукт с range: null не выводится. reference — полоса пунктиром
   --fg-mute (камера холодильника, для справки).

   Узкая раскладка — шкала горизонтальная, над карточкой.
   ============================================================================ */

import { esc, head, section } from './_html.js'
import { DESKTOP, ScrollTrigger, gsap, matches, reduced } from './_motion.js'

const sign = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0')

export function buildThermo(d) {
  const { min, max, step, labels } = d.axis
  const pos = (v) => (((v - min) / (max - min)) * 100).toFixed(3)
  const items = d.items.filter((item) => item.range)
  const current = items.find((item) => item.key === d.defaultKey) || items[0]

  const ticks = []
  for (let v = min; v <= max; v += step) {
    const labelled = labels.includes(v)
    ticks.push(
      `<li class="ib-thermo__tick${labelled ? ' is-label' : ''}" style="--p: ${pos(v)}%">${labelled ? `<span>${sign(v)}</span>` : ''}</li>`,
    )
  }

  const bars = items
    .map(
      (item) => `
      <li class="ib-thermo__lane" style="--from: ${pos(item.range[0])}%; --to: ${pos(item.range[1])}%">
        <button type="button" class="ib-thermo__bar${item.reference ? ' is-reference' : ''}${item === current ? ' is-active' : ''}"
                aria-pressed="${item === current}" data-thermo-key="${esc(item.key)}" data-top="${item.range[1]}"
                aria-label="${esc(`${item.title}, ${item.label}`)}">
          <span class="ib-thermo__bar-line" aria-hidden="true"></span>
          <span class="ib-thermo__bar-label" aria-hidden="true">${esc(item.title)}</span>
        </button>
      </li>`,
    )
    .join('')

  const infos = items
    .map(
      (item) => `
      <div data-thermo-info="${esc(item.key)}" hidden>
        <p class="ib-thermo__card-range">${esc(item.label)}</p>
        <h3 class="ib-thermo__card-title">${esc(item.title)}</h3>
        <p class="ib-thermo__card-text">${esc(item.text)}</p>
      </div>`,
    )
    .join('')

  return section('thermo', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-thermo" data-thermo data-min="${min}" data-max="${max}" data-reveal>
        <div class="ib-chips ib-thermo__chips" role="group" aria-label="${esc(d.productsLabel)}">
          ${items
            .map((item) => `<button type="button" class="ib-chip" aria-pressed="${item === current}" data-thermo-key="${esc(item.key)}">${esc(item.title)}</button>`)
            .join('')}
        </div>
        <div class="ib-thermo__grid">
          <div class="ib-thermo__scale" aria-label="${esc(d.scaleLabel)}" role="group" data-thermo-scale>
            <div class="ib-thermo__tube" aria-hidden="true">
              <span class="ib-thermo__mercury" data-thermo-mercury style="--level: ${pos(current.range[1])}%"></span>
              <span class="ib-thermo__bulb"></span>
            </div>
            <ul class="ib-thermo__ticks" aria-hidden="true">${ticks.join('')}</ul>
            <ul class="ib-thermo__bars">${bars}</ul>
          </div>
          <span class="ib-thermo__arrow" aria-hidden="true" data-thermo-arrow></span>
          <div class="ib-thermo__card" aria-live="polite" data-thermo-card>
            <p class="ib-thermo__card-range">${esc(current.label)}</p>
            <h3 class="ib-thermo__card-title">${esc(current.title)}</h3>
            <p class="ib-thermo__card-text">${esc(current.text)}</p>
          </div>
        </div>
        <div hidden>${infos}</div>
      </div>
    </div>`)
}

export function initThermo(root) {
  const box = root.querySelector('[data-thermo]')
  if (!box) return
  const min = Number(box.dataset.min)
  const max = Number(box.dataset.max)
  const mercury = box.querySelector('[data-thermo-mercury]')
  const card = box.querySelector('[data-thermo-card]')
  const arrow = box.querySelector('[data-thermo-arrow]')
  const grid = box.querySelector('.ib-thermo__grid')
  const controls = [...box.querySelectorAll('[data-thermo-key]')]
  const level = (v) => `${(((v - min) / (max - min)) * 100).toFixed(3)}%`

  let key = box.querySelector('.ib-thermo__bar.is-active')?.dataset.thermoKey
  let shown = false

  const placeArrow = () => {
    const bar = box.querySelector(`.ib-thermo__bar[data-thermo-key="${key}"] .ib-thermo__bar-line`)
    if (!bar || !arrow) return
    const g = grid.getBoundingClientRect()
    const b = bar.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    if (matches(DESKTOP)) {
      // От конца подписи полосы, а не от самой полосы: линия не зачёркивает текст.
      const label = bar.parentElement.querySelector('.ib-thermo__bar-label')
      const from = label && label.offsetWidth ? label.getBoundingClientRect().right : b.right
      const y = b.top + b.height / 2 - g.top
      arrow.style.cssText = `left:${from - g.left + 10}px; top:${y}px; width:${Math.max(0, c.left - from - 18)}px; height:1px`
    } else {
      const x = b.left + b.width / 2 - g.left
      arrow.style.cssText = `left:${x}px; top:${b.bottom - g.top + 6}px; height:${Math.max(0, c.top - b.bottom - 12)}px; width:1px`
    }
  }

  const select = (next) => {
    key = next
    controls.forEach((el) => {
      const on = el.dataset.thermoKey === next
      el.setAttribute('aria-pressed', String(on))
      el.classList.toggle('is-active', on)
    })
    const info = box.querySelector(`[data-thermo-info="${next}"]`)
    if (info) card.innerHTML = info.innerHTML
    const top = Number(box.querySelector(`.ib-thermo__bar[data-thermo-key="${next}"]`)?.dataset.top)
    if (shown && Number.isFinite(top)) {
      if (reduced()) mercury.style.setProperty('--level', level(top))
      else gsap.to(mercury, { '--level': level(top), duration: 0.6, ease: 'power2.out' })
    }
    placeArrow()
  }

  controls.forEach((el) => el.addEventListener('click', () => select(el.dataset.thermoKey)))
  window.addEventListener('resize', placeArrow)
  document.fonts?.ready.then(placeArrow)
  placeArrow()

  const top = Number(box.querySelector('.ib-thermo__bar.is-active')?.dataset.top)
  if (reduced()) {
    shown = true
    return
  }
  mercury.style.setProperty('--level', '0%')
  ScrollTrigger.create({
    trigger: box,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      gsap.to(mercury, {
        '--level': level(Number(box.querySelector(`.ib-thermo__bar[data-thermo-key="${key}"]`)?.dataset.top ?? top)),
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => (shown = true),
      })
    },
  })
}
