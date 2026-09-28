/* ============================================================================
   orbit — паспорт партии (/documents → #orbit).

   В центре (колонки 1–7) — банка сверху в круге на --on-dark с multiply,
   вокруг — орбита 1px --hairline, на ней пять кругов-документов 64px
   с короткими подписями. Орбита вращается (60 с на круг), круги остаются
   вертикальными; вращение останавливается при наведении и после первого
   выбора, при reduced motion его нет. Выбранный документ — рамка --gold,
   от него к банке — линия 1px --gold. Справа (8–12) — карточка документа.

   Круги — role="tablist", стрелки переводят выбор, Home / End — к краям.
   Узкая раскладка — орбита над карточкой, круг до 320px.
   ============================================================================ */

import { esc, image, head, inline, section } from './_html.js'

function info(item, labels) {
  return `
    <h3 class="ib-orbit__title">${esc(item.title)}</h3>
    <dl class="ib-orbit__facts">
      <div><dt>${esc(labels.what)}</dt><dd>${inline(item.what)}</dd></div>
      <div><dt>${esc(labels.proves)}</dt><dd>${inline(item.proves)}</dd></div>
      <div><dt>${esc(labels.check)}</dt><dd>${inline(item.check)}</dd></div>
    </dl>`
}

export function buildOrbit(d) {
  const n = d.items.length
  const id = d.id
  const items = d.items
    .map((item, i) => {
      const a = ((360 / n) * i).toFixed(2)
      return `
      <span class="ib-orbit__spoke${i === 0 ? ' is-active' : ''}" style="--a: ${a}deg" data-orbit-spoke="${i}" aria-hidden="true"></span>
      <span class="ib-orbit__slot" style="--a: ${a}deg">
        <span class="ib-orbit__upright">
          <button type="button" class="ib-orbit__doc${i === 0 ? ' is-active' : ''}" role="tab" id="${esc(id)}-tab-${esc(item.key)}"
                  aria-selected="${i === 0}" aria-controls="${esc(id)}-card" tabindex="${i === 0 ? 0 : -1}" data-orbit-doc="${i}">
            <span class="ib-orbit__short">${esc(item.short)}</span>
          </button>
        </span>
      </span>`
    })
    .join('')

  return section('orbit', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-orbit__grid" data-orbit data-reveal>
        <div class="ib-orbit__stage">
          <div class="ib-orbit__tin">${image(d.tin, { round: true, ratio: '1:1' })}</div>
          <div class="ib-orbit__ring" data-orbit-ring role="tablist" aria-label="${esc(d.tabsLabel)}">${items}</div>
        </div>
        <div class="ib-orbit__card" id="${esc(id)}-card" role="tabpanel" aria-labelledby="${esc(id)}-tab-${esc(d.items[0].key)}" data-orbit-card>
          ${info(d.items[0], d.labels)}
        </div>
        <div hidden>
          ${d.items.map((item, i) => `<div data-orbit-info="${i}">${info(item, d.labels)}</div>`).join('')}
        </div>
      </div>
    </div>`)
}

export function initOrbit(root) {
  const grid = root.querySelector('[data-orbit]')
  if (!grid) return
  const ring = grid.querySelector('[data-orbit-ring]')
  const docs = [...grid.querySelectorAll('[data-orbit-doc]')]
  const spokes = [...grid.querySelectorAll('[data-orbit-spoke]')]
  const card = grid.querySelector('[data-orbit-card]')

  const select = (i, { focus = false, user = true } = {}) => {
    docs.forEach((doc, k) => {
      const on = k === i
      doc.classList.toggle('is-active', on)
      doc.setAttribute('aria-selected', String(on))
      doc.tabIndex = on ? 0 : -1
      if (on && focus) doc.focus()
    })
    spokes.forEach((s, k) => s.classList.toggle('is-active', k === i))
    card.innerHTML = grid.querySelector(`[data-orbit-info="${i}"]`).innerHTML
    card.setAttribute('aria-labelledby', docs[i].id)
    if (user) grid.classList.add('is-stopped')
  }

  docs.forEach((doc, i) => {
    doc.addEventListener('click', () => select(i))
    doc.addEventListener('keydown', (event) => {
      const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
      let next = null
      if (event.key in map) next = (i + map[event.key] + docs.length) % docs.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = docs.length - 1
      if (next === null) return
      event.preventDefault()
      select(next, { focus: true })
    })
  })

  ring.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') grid.classList.add('is-hover')
  })
  ring.addEventListener('pointerleave', () => grid.classList.remove('is-hover'))
}
