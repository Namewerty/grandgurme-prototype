/* ============================================================================
   #proof — доверие.

   Сознательно без карточек отзывов с цитатами и звёздочками: доверие тут
   держат проверяемые вещи — цифры, названия партнёров и ссылка на документы.

   Цифры отсчитываются от нуля один раз: ScrollTrigger с once: true, так что
   прокрутка вверх-вниз повтор не запускает. Отсчитывается не вся строка, а
   только число: приставка «с » у года и «+» у числа клиентов стоят отдельными
   span'ами и не мигают. Год основания не отсчитывается вовсе (count: false).
   Откуда взяты значения и что ещё нужно подтвердить — в src/data/proof.js.

   Лента партнёров — чистый CSS: трек из двух одинаковых групп едет на -50%,
   то есть ровно на одну группу, поэтому стык не виден. Пауза по наведению
   и отключение при prefers-reduced-motion — тоже в CSS.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { proofCopy, proofStats } from '../../data/proof.js'
import { partners } from '../../data/partners.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const COUNT_DURATION = 1.4

/* ------------------------------------------------------------- числа */

/** '100 000' → 100000, '4,9' → 4.9. Пробелы-разделители разрядов игнорируем
    (в значении стоит неразрывный, поэтому \s, а не обычный пробел). */
const toNumber = (raw) => Number(String(raw).replace(/\s/g, '').replace(',', '.'))

/** Сколько знаков после запятой держать при отсчёте. */
function decimalsOf(raw) {
  const at = String(raw).search(/[.,]/)
  return at === -1 ? 0 : String(raw).length - at - 1
}

/** 46000 → «46 000», 4.9 → «4,9». Формат русский, разряды неразрывным пробелом. */
function format(value, decimals) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/* --------------------------------------------------------------- разметка */

/** Приставка и хвостик не отсчитываются: отсчёт идёт только по самому числу,
    иначе «+» и «с » мигали бы вместе с ним. Значению с count: false атрибут
    data-stat-value не ставится вовсе — счётчик его просто не увидит. */
function statsMarkup() {
  return proofStats
    .map(({ value, label, prefix, suffix, count }) => {
      const counted = count !== false
      const num = counted
        ? `<span data-stat-value="${value}">${value}</span>`
        : `<span>${value}</span>`
      const affix = (text, kind) =>
        `<span class="stat__affix stat__affix--${kind}">${text}</span>`

      return `
        <div class="stat">
          <span class="stat__num">
            ${prefix ? affix(prefix.trim(), 'prefix') : ''}${num}${
              suffix ? affix(suffix, 'suffix') : ''
            }
          </span>
          <span class="stat__label">${label}</span>
        </div>`
    })
    .join('')
}

/** Точка ставится после каждого названия, включая последнее: иначе на стыке
    двух групп два имени слиплись бы без разделителя. */
function marqueeGroup(hidden) {
  const items = partners
    .map(
      (name) => `
      <span class="proof__partner">${name}</span>
      <span class="proof__dot" aria-hidden="true">•</span>`,
    )
    .join('')

  return `<div class="proof__group"${hidden ? ' aria-hidden="true"' : ''}>${items}</div>`
}

export function buildProof(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section section--dark proof'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="proof__head">
          <p class="eyebrow" data-reveal>${proofCopy.eyebrow}</p>
          <h2 id="${item.id}-title" class="proof__title" data-reveal>${proofCopy.title}</h2>
        </div>

        <div class="proof__stats" data-proof-stats>
          ${statsMarkup()}
        </div>

        <div class="proof__marquee" data-proof-marquee>
          <div class="proof__track">
            ${marqueeGroup(false)}
            ${marqueeGroup(true)}
          </div>
        </div>

        <div class="proof__docs">
          <p class="proof__docs-text" data-reveal>${proofCopy.documents}</p>
          <p data-reveal>
            <a class="btn btn--outline-light" href="${proofCopy.action.href}">${proofCopy.action.label}</a>
          </p>
        </div>
      </div>
    </div>
  `

  return section
}

/* ------------------------------------------------------- отсчёт от нуля */

function createCounters(section) {
  const nums = section.querySelectorAll('[data-stat-value]')
  if (!nums.length) return

  const countable = []
  nums.forEach((el) => {
    const raw = el.dataset.statValue
    const target = toNumber(raw)
    if (!Number.isFinite(target)) return

    countable.push({ el, raw, target, decimals: decimalsOf(raw) })
  })
  if (!countable.length) return

  // Обнуляем сразу, а не в момент срабатывания: иначе на границе экрана видно,
  // как число падает со значения в ноль и только потом отсчитывается.
  countable.forEach(({ el, decimals }) => {
    el.textContent = format(0, decimals)
  })

  ScrollTrigger.create({
    trigger: section.querySelector('[data-proof-stats]') || section,
    start: 'top 85%',
    once: true, // прокрутка вверх-вниз повтор не запускает
    onEnter: () => {
      countable.forEach(({ el, raw, target, decimals }) => {
        const state = { value: 0 }
        gsap.to(state, {
          value: target,
          duration: COUNT_DURATION,
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

/* ------------------------------------------------------------------- init */

export function initProof() {
  const section = document.querySelector('#proof')
  if (!section || REDUCED) return

  createCounters(section)
}
