/* ============================================================================
   Мобильный боттом-шит фильтров.

   ЧЕРНОВОЕ СОСТОЯНИЕ — главное в этом экране. Фильтры внутри шита НЕ
   применяются на лету: под пальцем нет места, чтобы показать результат, а
   перерисовка выдачи за спиной у панели читается как подтормаживание. Поэтому
   шит работает на копии состояния, кнопка внизу всё время показывает, сколько
   товаров получится («Показать 14 товаров»), и только нажатие переносит
   черновик в состояние страницы.

   Исключение одно: сортировка применяется сразу и в черновике не хранится.
   Она не сужает выдачу, ей нечего показывать в счётчике, и держать её в
   черновике — значит заставлять человека нажимать «Показать» ради смены
   порядка карточек.
   ============================================================================ */

import { categoryCopy } from '../../data/category-copy.js'
import { sortsFor } from '../../data/facets.js'
import { icons } from '../icons.js'
import { wireRange } from './filters.js'
import {
  activeCount,
  benefitCounts,
  escapeHtml,
  facetCounts,
  filterAll,
  foundLabel,
} from './model.js'
import { cloneState, defaultState } from './state.js'

const copy = categoryCopy.sheet

/** Черновик и открытая гармошка живут только пока шит открыт. */
let draft = null
let openAcc = null

export const isSheetOpen = () => Boolean(draft)

/** Фасеты шита: обе главные оси, все пилюли. Сортировка добавляется отдельно. */
const sheetFacets = (schema) =>
  [
    schema.chips && { ...schema.chips, type: 'list' },
    schema.tabs && { ...schema.tabs, type: 'list', single: true },
    ...schema.pills,
  ].filter(Boolean)

export function openSheet(ctx) {
  draft = cloneState(ctx.state)
  openAcc = null
  ctx.els.sheet.classList.add('is-open')
  ctx.els.scrim.classList.add('is-open')
  document.body.classList.add('is-locked')
  ctx.lenis?.stop()
  renderSheet(ctx)
  ctx.els.sheet.querySelector('[data-action="close-sheet"]')?.focus()
}

export function closeSheet(ctx) {
  draft = null
  ctx.els.sheet.classList.remove('is-open')
  ctx.els.scrim.classList.remove('is-open')
  document.body.classList.remove('is-locked')
  ctx.lenis?.start()
  document.querySelector('[data-action="open-filters"]')?.focus()
}

export function applySheet(ctx) {
  if (!draft) return
  const next = cloneState(draft)
  next.sort = ctx.state.sort
  next.page = 1
  ctx.replaceState(next)
  closeSheet(ctx)
}

export function resetSheet(ctx) {
  draft = defaultState(ctx.schema, ctx.index)
  renderSheet(ctx)
}

/* ---------------------------------------------------------------- рендер */

export function renderSheet(ctx) {
  if (!draft) return

  const groups = sheetFacets(ctx.schema)
    .map((facet) => {
      const n = activeCount(facet, draft, ctx.index)
      return accordion({
        key: facet.key,
        label: facet.label,
        count: n ? `· ${n}` : '',
        body: groupBody(ctx, facet),
      })
    })
    .join('')

  ctx.els.sheetBody.innerHTML = `
    ${accordion({
      key: 'sort',
      label: categoryCopy.filters.sort,
      count: `· ${(sortsFor(ctx.schema).find((o) => o.key === ctx.state.sort) || sortsFor(ctx.schema)[0]).label}`,
      body: `<div role="listbox" aria-label="${categoryCopy.filters.sort}">${sortsFor(ctx.schema).map((option) => {
        const on = option.key === ctx.state.sort
        return `
        <button type="button" class="opt opt--radio${on ? ' is-on' : ''}" role="option"
                aria-selected="${on}" data-action="sort" data-value="${option.key}">
          <span class="opt__radio" aria-hidden="true"></span>
          <span class="opt__name">${escapeHtml(option.label)}</span>
        </button>`
      }).join('')}</div>`,
    })}
    ${groups}
    ${ctx.schema.stock === false ? '' : `
    <button type="button" class="sheet__stock${draft.inStock ? ' is-on' : ''}"
            role="switch" aria-checked="${draft.inStock}" data-action="sheet-stock">
      <span>${categoryCopy.filters.inStock}</span>
      <span class="sheet__switch" aria-hidden="true"></span>
    </button>`}`

  wireSheetRanges(ctx)
  updateFooter(ctx)
}

const accordion = ({ key, label, count, body }) => `
  <div class="acc${openAcc === key ? ' is-open' : ''}" data-acc="${key}">
    <button type="button" class="acc__head" data-action="toggle-acc" data-key="${key}"
            aria-expanded="${openAcc === key}">
      <span class="acc__label">${escapeHtml(label)}</span>
      ${count ? `<span class="acc__count">${escapeHtml(count)}</span>` : ''}
      <span class="acc__chevron">${icons.chevronDown}</span>
    </button>
    <div class="acc__body">${body}</div>
  </div>`

function groupBody(ctx, facet) {
  if (facet.type === 'benefit') {
    return benefitCounts(ctx.products, draft, ctx.index)
      .map(({ value, label, count }) =>
        sheetOption({
          action: 'sheet-benefit',
          key: 'benefit',
          value,
          label,
          count,
          checked: draft.benefits.includes(value),
        }),
      )
      .join('')
  }

  if (facet.type === 'range') return rangeBody(ctx, facet)

  return facetCounts(ctx.products, draft, ctx.index, facet.key)
    .map(({ value, count }) =>
      sheetOption({
        action: 'sheet-facet',
        key: facet.key,
        value,
        label: escapeHtml(value),
        count,
        checked: draft.values[facet.key].includes(value),
      }),
    )
    .join('')
}

function sheetOption({ action, key, value, label, count, checked }) {
  const off = count === 0 && !checked
  return `
    <button type="button" class="opt${checked ? ' is-on' : ''}" role="checkbox"
            aria-checked="${checked}" aria-disabled="${off}"
            data-action="${action}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(value)}">
      <span class="opt__box" aria-hidden="true">${checked ? icons.check : ''}</span>
      <span class="opt__name">${label}</span>
      <span class="opt__count">${count}</span>
    </button>`
}

function rangeBody(ctx, facet) {
  const bound = ctx.index.ranges[facet.key]
  const value = draft.ranges[facet.key]

  return `
    <div class="range" data-sheet-range="${facet.key}">
      <div class="range__slider">
        <span class="range__track" aria-hidden="true"></span>
        <span class="range__fill" data-range-fill aria-hidden="true"></span>
        <input type="range" class="range__input range__input--min" data-range-min
               min="${bound.min}" max="${bound.max}" value="${value.min}"
               aria-label="${categoryCopy.filters.from}">
        <input type="range" class="range__input range__input--max" data-range-max
               min="${bound.min}" max="${bound.max}" value="${value.max}"
               aria-label="${categoryCopy.filters.to}">
      </div>
      <div class="range__fields">
        <input type="number" data-range-field-min value="${value.min}">
        <span aria-hidden="true">—</span>
        <input type="number" data-range-field-max value="${value.max}">
      </div>
    </div>`
}

function wireSheetRanges(ctx) {
  ctx.els.sheetBody.querySelectorAll('[data-sheet-range]').forEach((node) => {
    const key = node.dataset.sheetRange
    wireRange(node, ctx.index.ranges[key], (min, max) => {
      draft.ranges[key] = { min, max }
      updateFooter(ctx)
    })
  })
}

/** Кнопка внизу — единственный отчёт о том, что даст черновик. */
function updateFooter(ctx) {
  const count = filterAll(ctx.products, draft, ctx.index).length
  ctx.els.sheetApply.textContent = `${copy.apply} ${foundLabel(count)}`
  ctx.els.sheetApply.disabled = count === 0
}

/* --------------------------------------------------------------- действия */

export function handleSheetAction(ctx, action, el) {
  if (!draft) return false

  const key = el.dataset.key
  const value = el.dataset.value

  if (action === 'toggle-acc') {
    openAcc = openAcc === key ? null : key
    renderSheet(ctx)
    return true
  }

  if (action === 'sheet-facet') {
    const list = draft.values[key]
    const single = ctx.schema.tabs?.key === key
    const index = list.indexOf(value)

    if (single) draft.values[key] = index === -1 ? [value] : []
    else if (index === -1) list.push(value)
    else list.splice(index, 1)

    renderSheet(ctx)
    return true
  }

  if (action === 'sheet-benefit') {
    const index = draft.benefits.indexOf(value)
    if (index === -1) draft.benefits.push(value)
    else draft.benefits.splice(index, 1)
    renderSheet(ctx)
    return true
  }

  if (action === 'sheet-stock') {
    draft.inStock = !draft.inStock
    renderSheet(ctx)
    return true
  }

  return false
}
