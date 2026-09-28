/* ============================================================================
   facts — три-четыре числа в ряд через волосяные линии. Число акцентом
   clamp(3rem, 6vw, 5rem), подпись 0.85rem. Отсчёт от нуля при появлении —
   тот же разбор значений, что в #proof (src/js/sections/proof.js):
   prefix / suffix не отсчитываются, count: false — без отсчёта,
   разряды — неразрывным пробелом. На узкой раскладке — 2×2.

   Функции разбора повторены здесь, а не импортированы: модуль proof.js
   читает window при импорте, а блоки собирает и node.
   ============================================================================ */

import { esc, head, section } from './_html.js'
import { ScrollTrigger, gsap, reduced } from './_motion.js'

const toNumber = (raw) => Number(String(raw).replace(/\s/g, '').replace(',', '.'))

function decimalsOf(raw) {
  const at = String(raw).search(/[.,]/)
  return at === -1 ? 0 : String(raw).length - at - 1
}

const format = (value, decimals) =>
  value.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

export function buildFacts(d) {
  const items = d.items
    .map(({ value, prefix, suffix, label, count }) => {
      const counted = count !== false && Number.isFinite(toNumber(value))
      const num = counted ? `<span data-fact-value="${esc(value)}">${esc(value)}</span>` : `<span>${esc(value)}</span>`
      return `
        <div class="ib-facts__item" data-reveal>
          <dt class="ib-facts__num">${prefix ? `<span class="ib-facts__affix">${esc(prefix.trim())}</span>` : ''}${num}${
            suffix ? `<span class="ib-facts__affix ib-facts__affix--suffix">${esc(suffix)}</span>` : ''
          }</dt>
          <dd class="ib-facts__label">${esc(label)}</dd>
        </div>`
    })
    .join('')

  return section('facts', d, `
    <div class="container">
      ${head(d)}
      <dl class="ib-facts__list" data-count="${d.items.length}"${d.label && !d.title ? ` aria-label="${esc(d.label)}"` : ''}>${items}</dl>
    </div>`)
}

export function initFacts(root) {
  if (reduced()) return
  const nums = [...root.querySelectorAll('[data-fact-value]')].map((el) => {
    const raw = el.dataset.factValue
    return { el, raw, target: toNumber(raw), decimals: decimalsOf(raw) }
  })
  if (!nums.length) return
  nums.forEach(({ el, decimals }) => {
    el.textContent = format(0, decimals)
  })
  ScrollTrigger.create({
    trigger: root.querySelector('.ib-facts__list'),
    start: 'top 85%',
    once: true, // прокрутка вверх-вниз повтор не запускает
    onEnter: () => {
      nums.forEach(({ el, raw, target, decimals }) => {
        const state = { value: 0 }
        gsap.to(state, {
          value: target,
          duration: 1.4,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = format(state.value, decimals)
          },
          onComplete: () => {
            el.textContent = format(target, decimals) || raw
          },
        })
      })
    },
  })
}
