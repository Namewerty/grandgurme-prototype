/* ============================================================================
   inside — «Что в шкатулке» (/corporate → #inside).

   Кадр во всю ширину колонок 1–8, --radius-card, на нём три метки: кружок
   14px с золотым кольцом, пульсирует раз в 3 с. Наведение, фокус или
   касание метки показывает подпись рядом. Справа (9–12) — те же пункты
   списком; наведение на пункт подсвечивает метку. Координаты меток —
   в данных, в процентах от кадра. Узкая раскладка — список под кадром.
   ============================================================================ */

import { esc, head, image, section } from './_html.js'

export function buildInside(d) {
  /* Подпись — отдельным узлом кадра, а не внутри метки: так её ширина
     считается от кадра (до его края), и подпись не выходит за экран. */
  const spots = d.spots
    .map(
      (s, i) => `
      <span class="ib-inside__spot${s.x > 50 ? ' is-left' : ''}" style="--x: ${s.x}%; --y: ${s.y}%" data-inside-spot="${esc(s.key)}">
        <button type="button" class="ib-inside__mark" aria-describedby="${esc(d.id)}-tip-${i}" aria-label="${esc(s.label)}"
                style="--delay: ${(i * 0.6).toFixed(1)}s" data-inside-mark></button>
      </span>
      <span class="ib-inside__tip${s.x > 50 ? ' is-left' : ''}" style="--x: ${s.x}%; --y: ${s.y}%" id="${esc(d.id)}-tip-${i}"
            role="tooltip" data-inside-tip="${esc(s.key)}">${esc(s.label)}</span>`,
    )
    .join('')

  return section('inside', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-inside__grid">
        <div class="ib-inside__photo" data-reveal>
          ${image(d.media, { ratio: '1:1', className: 'ib-inside__media' })}
          ${spots}
        </div>
        <ul class="ib-inside__list">
          ${d.spots
            .map(
              (s, i) => `<li class="ib-inside__item" data-inside-item="${esc(s.key)}" data-reveal>
                <span class="ib-inside__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
                <span class="ib-inside__label">${esc(s.label)}</span></li>`,
            )
            .join('')}
        </ul>
      </div>
    </div>`)
}

export function initInside(root) {
  const spots = [...root.querySelectorAll('[data-inside-spot]')]
  const items = [...root.querySelectorAll('[data-inside-item]')]

  const tips = [...root.querySelectorAll('[data-inside-tip]')]

  const activate = (key) => {
    spots.forEach((s) => s.classList.toggle('is-active', s.dataset.insideSpot === key))
    tips.forEach((t) => t.classList.toggle('is-active', t.dataset.insideTip === key))
    items.forEach((it) => it.classList.toggle('is-active', it.dataset.insideItem === key))
  }
  const clear = () => activate(null)

  spots.forEach((s) => {
    const key = s.dataset.insideSpot
    const mark = s.querySelector('[data-inside-mark]')
    mark.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') activate(key)
    })
    mark.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse' && document.activeElement !== mark) clear()
    })
    mark.addEventListener('focus', () => activate(key))
    mark.addEventListener('blur', clear)
    mark.addEventListener('click', () => activate(key))
  })

  items.forEach((it) => {
    const key = it.dataset.insideItem
    it.addEventListener('pointerenter', () => activate(key))
    it.addEventListener('pointerleave', clear)
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clear()
  })
}
