/* ============================================================================
   Диапазон «от — до»: одна разметка и одна проводка на все места, где он
   стоит, — поповер пилюли каталога, мобильный боттом-шит и избранное.
   Копий этой разметки в проекте быть не должно: у цены на трёх экранах
   разъехались бы формат чисел и правило «цен мало».

   ПРАВИЛО «ЦЕН МАЛО». Если в текущей выборке меньше двух разных значений,
   пилюля остаётся на месте, но неактивна и объясняет почему. Ползунок
   с нулевым диапазоном не показывается никогда: он читается как поломка,
   а не как отсутствие данных. Раньше из-за этого пилюлю «Цена» у икры
   убирали целиком (29.09.2026 решение поменялось: цена нужна везде).

   ПОЗИЦИИ БЕЗ ЗНАЧЕНИЯ (цена по запросу). Пока диапазон полный, они
   в выдаче; стоит сузить — уходят (matches в model.js). Здесь это не
   решается: модуль только рисует и читает поля.
   ============================================================================ */

import { categoryCopy } from '../../data/category-copy.js'
import { icons } from '../icons.js'

const copy = categoryCopy.filters

const NUMBER = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** «12 900» — разряды пробелами, как в цене. */
export const formatNumber = (value) => NUMBER.format(value)

/** «12 900», «12900», «12 900 ₽» → 12900. Пустое поле → NaN. */
export function parseNumber(text) {
  const digits = String(text ?? '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : NaN
}

/** Сколько разных числовых значений поля в наборе. */
export function distinctCount(list, field) {
  const seen = new Set()
  list.forEach((item) => {
    if (typeof item[field] === 'number') seen.add(item[field])
  })
  return seen.size
}

/**
 * Можно ли пользоваться диапазоном: у раздела ненулевой размах и в текущей
 * выборке хотя бы два разных значения.
 */
export const rangeUsable = (list, field, bound) =>
  Boolean(bound) && bound.max > bound.min && distinctCount(list, field) >= 2

/** Подсказка неактивной пилюли. У цены — своя, у остальных осей — общая. */
export const rangeHint = (key) => (key === 'price' ? copy.priceUnknown : copy.rangeUnknown)

/**
 * Готовые диапазоны цены, которые реально сужают выдачу раздела. У икры
 * все цены выше 6 000 ₽, и «до 1 500 ₽» там вёл бы в пустоту, а «от 6 000 ₽»
 * ничего бы не менял, — такие кнопки не показываются.
 */
export function presetsFor(bound) {
  return copy.pricePresets
    .map((preset) => ({
      label: preset.label,
      min: Math.max(bound.min, preset.min),
      max: Math.min(bound.max, preset.max),
    }))
    .filter((preset) => preset.min < preset.max && (preset.min > bound.min || preset.max < bound.max))
}

/**
 * Разметка диапазона. Поля текстовые, а не number: number не принимает
 * «12 900» с пробелом и не умеет показывать разряды.
 *
 * @param {object} o
 * @param {{min:number,max:number}} o.bound  границы оси раздела
 * @param {{min:number,max:number}} o.value  текущий выбор
 * @param {string} o.unit                    «₽», «г»
 * @param {boolean} [o.presets]              показать готовые диапазоны цены
 * @param {string} [o.attrs]                 атрибуты корневого узла
 */
export function rangeMarkup({ bound, value, unit = '', presets = false, key = '', attrs = '' }) {
  const field = (name, current, label) => `
    <label class="range__field">
      <span class="range__prefix">${label.toLowerCase()}</span>
      <input type="text" inputmode="numeric" autocomplete="off" ${name}
             value="${formatNumber(current)}" aria-label="${label}${unit ? `, ${unit}` : ''}">
      ${unit ? `<span class="range__unit" aria-hidden="true">${unit}</span>` : ''}
    </label>`

  const list = presets ? presetsFor(bound) : []

  return `
    <div class="range" ${attrs}>
      <div class="range__slider">
        <span class="range__track" aria-hidden="true"></span>
        <span class="range__fill" data-range-fill aria-hidden="true"></span>
        <input type="range" class="range__input range__input--min" data-range-min
               min="${bound.min}" max="${bound.max}" value="${value.min}" aria-label="${copy.from}">
        <input type="range" class="range__input range__input--max" data-range-max
               min="${bound.min}" max="${bound.max}" value="${value.max}" aria-label="${copy.to}">
      </div>
      <div class="range__fields">
        ${field('data-range-field-min', value.min, copy.from)}
        <span aria-hidden="true">—</span>
        ${field('data-range-field-max', value.max, copy.to)}
      </div>
      ${
        list.length
          ? `<div class="range__presets">
              ${list
                .map(
                  (preset) => `
                <button type="button" data-action="preset" data-key="${key}"
                        data-min="${preset.min}" data-max="${preset.max}">${preset.label}</button>`,
                )
                .join('')}
            </div>`
          : ''
      }
    </div>`
}

/** Вместо ползунка — одна строка о том, почему его нет. */
export const rangeHintMarkup = (key) => `<p class="range__hint">${rangeHint(key)}</p>`

/**
 * Неактивная пилюля: на месте, приглушена, поповер не открывает, подсказка —
 * по наведению и фокусу. Фокус у неё остаётся намеренно: иначе с клавиатуры
 * подсказку не прочитать. Одна разметка для каталога и избранного.
 */
export const idlePillMarkup = ({ id, key, label, count = 0 }) => `
  <button type="button" class="pill is-idle${count ? ' is-active' : ''}" id="${id}"
          data-action="pill-idle" aria-disabled="true" aria-describedby="${id}-hint">
    ${label}${count ? `<span class="pill__count">${count}</span>` : ''}
    <span class="pill__chevron">${icons.chevronDown}</span>
    <span class="pill__hint" id="${id}-hint" role="tooltip">${rangeHint(key)}</span>
  </button>`

/**
 * Два ползунка на одной дорожке и два поля. Значение применяется на change,
 * а не на input: пересчитывать выдачу на каждый пиксель перетаскивания —
 * значит дёргать сетку под рукой. Поле применяется по уходу из него и по Enter.
 */
export function wireRange(root, bound, apply) {
  const min = root.querySelector('[data-range-min]')
  const max = root.querySelector('[data-range-max]')
  const fieldMin = root.querySelector('[data-range-field-min]')
  const fieldMax = root.querySelector('[data-range-field-max]')
  const fill = root.querySelector('[data-range-fill]')
  if (!min || !max) return

  const span = bound.max - bound.min || 1

  const paint = () => {
    const lo = Number(min.value)
    const hi = Number(max.value)
    fill.style.left = `${((lo - bound.min) / span) * 100}%`
    fill.style.width = `${Math.max(0, ((hi - lo) / span) * 100)}%`
    fieldMin.value = formatNumber(lo)
    fieldMax.value = formatNumber(hi)
  }

  paint()

  min.addEventListener('input', () => {
    if (Number(min.value) > Number(max.value)) min.value = max.value
    paint()
  })
  max.addEventListener('input', () => {
    if (Number(max.value) < Number(min.value)) max.value = min.value
    paint()
  })

  const commit = () => apply(Number(min.value), Number(max.value))
  min.addEventListener('change', commit)
  max.addEventListener('change', commit)

  const commitField = (field, target, clamp) => {
    let before = field.value
    field.addEventListener('focus', () => {
      before = field.value
    })
    field.addEventListener('blur', () => {
      if (field.value === before) return
      const raw = parseNumber(field.value)
      target.value = clamp(Number.isFinite(raw) ? raw : Number(target.value))
      paint()
      commit()
    })
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') field.blur()
    })
  }

  commitField(fieldMin, min, (v) => Math.min(Math.max(v, bound.min), Number(max.value)))
  commitField(fieldMax, max, (v) => Math.max(Math.min(v, bound.max), Number(min.value)))
}
