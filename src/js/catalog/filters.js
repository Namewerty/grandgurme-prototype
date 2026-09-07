/* ============================================================================
   Фильтры: строка капсул, строка табов, панель пилюль, поповер, применённые
   фильтры и липкая полоса.

   Разметки, знающей про рыбу, здесь нет. Что рисовать, говорит схема раздела
   (src/data/facets.js): фасета в роли chips даёт строку капсул, в роли tabs —
   строку табов, всё остальное — пилюли с поповером. Поэтому у икры на том же
   коде получается «Сорт» и «Фасовка», а пилюли «Вес» не появляется вовсе.

   Три вещи, которые легко потерять при переписывании:

   1. Счётчик у опции считается с исключением собственной фасеты — см. model.js.
      Выбрав один бренд, человек должен видеть у остальных брендов их числа,
      а не нули.
   2. Сортировка никогда не считается активным фильтром и не попадает в
      счётчик у кнопки «Фильтры».
   3. Опция с нулём выключается, но НЕ прячется: исчезающие из списка строки
      читаются как сбой, а не как отсутствие товара.
   ============================================================================ */

import { BENEFITS, sortsFor } from '../../data/facets.js'
import { categoryCopy } from '../../data/category-copy.js'
import { icons } from '../icons.js'
import {
  activeCount,
  benefitCounts,
  escapeHtml,
  facetCounts,
  formatPrice,
  highlight,
  normalize,
  rangeActive,
  totalActive,
} from './model.js'

const copy = categoryCopy.filters

/** Открытый поповер: ключ фасеты и id кнопки, от которой он открыт. */
const popover = { key: null, anchorId: null, listQuery: '' }

export const isMobile = () => window.matchMedia('(max-width: 767px)').matches

/* Список сортировок у каждого раздела свой: на разделе без цен сортировки
   по цене и скидке не предлагаются вовсе (см. src/data/facets.js). */
const sortLabel = (ctx) => {
  const list = sortsFor(ctx.schema)
  return (list.find((option) => option.key === ctx.state.sort) || list[0]).label
}

/* ------------------------------------------------------- строка капсул */

export function renderChipsRow(ctx) {
  const facet = ctx.schema.chips
  const row = ctx.els.chipsRow
  if (!facet || !row) return

  const selected = ctx.state.values[facet.key]
  const counts = facetCounts(ctx.products, ctx.state, ctx.index, facet.key)

  const all = `
    <button type="button" class="chip${selected.length ? '' : ' is-active'}"
            data-action="chip-all" aria-pressed="${!selected.length}">
      ${facet.allLabel || 'Все'}
    </button>`

  ctx.els.chips.innerHTML =
    all +
    counts
      .map(({ value, count }) => {
        const active = selected.includes(value)
        const off = count === 0 && !active
        return `
      <button type="button" class="chip${active ? ' is-active' : ''}"
              data-action="chip" data-value="${escapeHtml(value)}"
              aria-pressed="${active}"${off ? ' aria-disabled="true" tabindex="-1"' : ''}>
        ${active ? `<span class="chip__check">${icons.check}</span>` : ''}${escapeHtml(value)}
      </button>`
      })
      .join('')
}

/* --------------------------------------------------------- строка табов */

export function renderTabsRow(ctx) {
  const facet = ctx.schema.tabs
  const row = ctx.els.tabsRow
  if (!facet || !row) return

  const current = ctx.state.values[facet.key][0] || ''
  const counts = facetCounts(ctx.products, ctx.state, ctx.index, facet.key)

  /* Роли tab / tablist здесь не годятся: за табом должна стоять панель
     (tabpanel), а тут одиночный выбор в наборе фильтров — панели нет.
     Обычная кнопка с aria-pressed описывает происходящее честно и не обещает
     скринридеру клавиатурного контракта вкладок, которого у строки нет. */
  const tab = (value, label, count) => {
    const active = current === value
    const off = count === 0 && !active && value !== ''
    return `
      <button type="button" class="tab${active ? ' is-active' : ''}"
              aria-pressed="${active}" data-action="tab" data-value="${escapeHtml(value)}"
              ${off ? 'aria-disabled="true" tabindex="-1"' : ''}>
        ${escapeHtml(label)}
      </button>`
  }

  ctx.els.tabs.innerHTML =
    tab('', facet.allLabel || 'Всё', 1) +
    counts.map(({ value, count }) => tab(value, value, count)).join('')
}

/* -------------------------------------------------------- панель пилюль */

export function renderBar(ctx) {
  const { schema, state, index } = ctx

  const pills = schema.pills
    .map((pill) => {
      const n = activeCount(pill, state, index)
      const open = popover.key === pill.key && popover.anchorId === `pill-${pill.key}`
      return `
      <button type="button" class="pill${n ? ' is-active' : ''}${open ? ' is-open' : ''}"
              id="pill-${pill.key}" data-action="pill" data-key="${pill.key}"
              aria-haspopup="dialog" aria-expanded="${open}" aria-controls="catalog-popover">
        ${escapeHtml(pill.label)}${n ? `<span class="pill__count">${n}</span>` : ''}
        <span class="pill__chevron">${icons.chevronDown}</span>
      </button>`
    })
    .join('')

  /* Тумблера «В наличии» нет там, где остатки не ведутся: фильтр, честно
     отсекающий 92% раздела, читается как пустой каталог, а не как фильтр. */
  const stock = schema.stock === false
    ? ''
    : `
    <button type="button" class="pill pill--toggle${state.inStock ? ' is-active' : ''}"
            data-action="stock" aria-pressed="${state.inStock}">${copy.inStock}</button>`

  ctx.els.bar.innerHTML = `${pills}${stock}
    <span class="bar__divider" aria-hidden="true"></span>
    ${sortPill(ctx, 'pill-sort')}`
}

/** Пилюля сортировки. Живёт и в панели, и в липкой полосе — разметка одна. */
function sortPill(ctx, id) {
  const open = popover.key === 'sort' && popover.anchorId === id
  return `
    <button type="button" class="pill pill--sort${open ? ' is-open' : ''}" id="${id}"
            data-action="pill" data-key="sort"
            aria-haspopup="dialog" aria-expanded="${open}" aria-controls="catalog-popover">
      ${copy.sort}: <b>${escapeHtml(sortLabel(ctx))}</b>
      <span class="pill__chevron">${icons.chevronDown}</span>
    </button>`
}

/* --------------------------------------------------------------- поповер */

const popoverEl = () => document.querySelector('#catalog-popover')

export function isPopoverOpen() {
  return Boolean(popover.key)
}

export function closePopover(ctx, { restoreFocus = true } = {}) {
  const root = popoverEl()
  if (!root) return

  const previous = popover.anchorId
  root.classList.remove('is-open', 'is-narrow')
  root.innerHTML = ''
  popover.key = null
  popover.anchorId = null
  popover.listQuery = ''

  renderBar(ctx)
  renderSticky(ctx)

  if (restoreFocus && previous) document.getElementById(previous)?.focus()
}

export function openPopover(ctx, key, anchor) {
  const anchorId = anchor?.id || null
  if (popover.key === key && popover.anchorId === anchorId) {
    closePopover(ctx)
    return
  }

  popover.key = key
  popover.anchorId = anchorId
  popover.listQuery = ''

  renderBar(ctx)
  renderSticky(ctx)
  renderPopover(ctx)

  popoverEl().classList.add('is-open')
  positionPopover()
  popoverEl().querySelector('.opt, .range__input')?.focus({ preventScroll: true })
}

/**
 * Позиция считается от кнопки-якоря. Поповер fixed, поэтому при прокрутке он
 * либо едет за пилюлей, либо закрывается, если пилюля ушла с экрана: панель,
 * висящая посреди пустого места, читается как мусор на странице.
 */
export function positionPopover() {
  const root = popoverEl()
  if (!popover.key || !root) return

  const anchor = document.getElementById(popover.anchorId)
  if (!anchor) return

  const rect = anchor.getBoundingClientRect()
  const narrow = popover.key === 'sort'
  const width = narrow ? 260 : 320

  root.classList.toggle('is-narrow', narrow)

  let left = rect.left
  if (left + width > window.innerWidth - 16) left = Math.max(16, rect.right - width)

  const height = Math.min(400, root.offsetHeight || 400)
  let top = rect.bottom + 8
  if (top + height > window.innerHeight - 16) top = Math.max(16, rect.top - height - 8)

  root.style.left = `${left}px`
  root.style.top = `${top}px`
}

/** Пилюля уехала с экрана — поповеру не за что держаться. */
export function keepPopoverInPlace(ctx) {
  if (!popover.key) return
  const anchor = document.getElementById(popover.anchorId)
  if (!anchor) return closePopover(ctx, { restoreFocus: false })

  const rect = anchor.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    closePopover(ctx, { restoreFocus: false })
    return
  }
  positionPopover()
}

export function renderPopover(ctx) {
  const root = popoverEl()
  if (!root) return

  if (popover.key === 'sort') {
    root.innerHTML = `
      <div class="pop__list" role="listbox" aria-label="${copy.sort}">
        ${sortsFor(ctx.schema).map((option) => {
          const on = option.key === ctx.state.sort
          return `
          <button type="button" class="opt opt--radio${on ? ' is-on' : ''}" role="option"
                  aria-selected="${on}" data-action="sort" data-value="${option.key}">
            <span class="opt__radio" aria-hidden="true"></span>
            <span class="opt__name">${escapeHtml(option.label)}</span>
          </button>`
        }).join('')}
      </div>`
    return
  }

  const pill = ctx.schema.pills.find((item) => item.key === popover.key)
  if (!pill) {
    root.innerHTML = ''
    return
  }

  if (pill.type === 'benefit') {
    root.innerHTML = `
      <div class="pop__list">
        ${benefitCounts(ctx.products, ctx.state, ctx.index)
          .map(({ value, label, count }) =>
            optionRow({
              action: 'toggle-benefit',
              key: 'benefit',
              value,
              label,
              count,
              checked: ctx.state.benefits.includes(value),
            }),
          )
          .join('')}
      </div>
      ${popFooter('reset-benefit', 'benefit')}`
    return
  }

  if (pill.type === 'list') {
    renderListPopover(ctx, pill, root)
    return
  }

  renderRangePopover(ctx, pill, root)
}

function optionRow({ action, key, value, label, count, checked }) {
  const off = count === 0 && !checked
  return `
    <button type="button" class="opt${checked ? ' is-on' : ''}" role="checkbox"
            aria-checked="${checked}" aria-disabled="${off}" ${off ? 'tabindex="-1"' : ''}
            data-action="${action}" data-key="${escapeHtml(key)}" data-value="${escapeHtml(value)}">
      <span class="opt__box" aria-hidden="true">${checked ? icons.check : ''}</span>
      <span class="opt__name">${label}</span>
      <span class="opt__count">${count}</span>
    </button>`
}

const popFooter = (action, key) => `
  <div class="pop__footer">
    <button type="button" class="link-btn" data-action="${action}" data-key="${escapeHtml(key)}">
      ${copy.reset}
    </button>
  </div>`

/** Свой поиск внутри длинного списка опций. Порог — восемь строк. */
function renderListPopover(ctx, pill, root) {
  const counts = facetCounts(ctx.products, ctx.state, ctx.index, pill.key)
  const withSearch = counts.length > 8
  const query = popover.listQuery

  const rows = counts
    .filter(({ value }) => !query || normalize(value).includes(normalize(query)))
    .map(({ value, count }) =>
      optionRow({
        action: 'toggle-facet',
        key: pill.key,
        value,
        label: highlight(value, query),
        count,
        checked: ctx.state.values[pill.key].includes(value),
      }),
    )
    .join('')

  root.innerHTML = `
    ${
      withSearch
        ? `<div class="pop__search">
             <input type="text" id="pop-search" placeholder="${copy.listSearch}"
                    value="${escapeHtml(query)}" autocomplete="off">
           </div>`
        : ''
    }
    <div class="pop__list">${rows || `<p class="pop__empty">${copy.listEmpty}</p>`}</div>
    ${popFooter('reset-facet', pill.key)}`

  if (!withSearch) return

  const input = root.querySelector('#pop-search')
  input.addEventListener('input', () => {
    popover.listQuery = input.value
    renderPopover(ctx)
    const next = popoverEl().querySelector('#pop-search')
    if (next) {
      next.focus()
      next.setSelectionRange(next.value.length, next.value.length)
    }
  })
}

/* ---------------------------------------------------------- диапазон */

function renderRangePopover(ctx, pill, root) {
  const bound = ctx.index.ranges[pill.key]
  const value = ctx.state.ranges[pill.key]
  const isPrice = pill.key === 'price'

  root.innerHTML = `
    <div class="range">
      <div class="range__slider">
        <span class="range__track" aria-hidden="true"></span>
        <span class="range__fill" data-range-fill aria-hidden="true"></span>
        <input type="range" class="range__input range__input--min" data-range-min
               min="${bound.min}" max="${bound.max}" value="${value.min}" aria-label="${copy.from}">
        <input type="range" class="range__input range__input--max" data-range-max
               min="${bound.min}" max="${bound.max}" value="${value.max}" aria-label="${copy.to}">
      </div>
      <div class="range__fields">
        <input type="number" data-range-field-min value="${value.min}" aria-label="${copy.from}">
        <span aria-hidden="true">—</span>
        <input type="number" data-range-field-max value="${value.max}" aria-label="${copy.to}">
      </div>
      ${
        isPrice
          ? `<div class="range__presets">
              ${copy.pricePresets
                .map(
                  (preset) => `
                <button type="button" data-action="preset" data-key="${pill.key}"
                        data-min="${Math.max(bound.min, preset.min)}"
                        data-max="${Math.min(bound.max, preset.max)}">${preset.label}</button>`,
                )
                .join('')}
            </div>`
          : ''
      }
    </div>
    ${popFooter('reset-range', pill.key)}`

  wireRange(root, bound, (min, max) => ctx.setRange(pill.key, min, max))
}

/**
 * Два ползунка на одной дорожке. Значение применяется на change, а не на
 * input: пересчитывать выдачу на каждый пиксель перетаскивания — значит
 * дёргать сетку под рукой.
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
    fieldMin.value = lo
    fieldMax.value = hi
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
    field.addEventListener('blur', () => {
      const raw = Number(field.value)
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

/* ------------------------------------------------- применённые фильтры */

/**
 * Строка снятия фильтров. Сюда же попадает фильтр, пришедший ссылкой из
 * мега-меню: человек должен видеть, чем сужена выдача, и уметь это снять
 * одним нажатием — иначе подкатегория читается как ловушка.
 */
export function renderAppliedChips(ctx) {
  const { state, index, schema } = ctx
  const chips = []

  Object.entries(state.values).forEach(([key, list]) => {
    list.forEach((value) => chips.push({ label: value, action: 'clear-facet', key, value }))
  })

  state.benefits.forEach((key) => {
    const benefit = BENEFITS.find((item) => item.key === key)
    if (benefit) chips.push({ label: benefit.label, action: 'clear-benefit', value: key })
  })

  schema.pills
    .filter((pill) => pill.type === 'range')
    .forEach((pill) => {
      if (!rangeActive(state, index, pill.key)) return
      const value = state.ranges[pill.key]
      const label =
        pill.key === 'price'
          ? `${formatPrice(value.min)} — ${formatPrice(value.max)}`
          : `${value.min}–${value.max} ${pill.unit}`
      chips.push({ label, action: 'clear-range', key: pill.key })
    })

  if (state.inStock) chips.push({ label: copy.inStock, action: 'clear-stock' })

  ctx.els.applied.innerHTML = chips.length
    ? chips
        .map(
          (chip) => `
      <button type="button" class="applied" data-action="${chip.action}"
              ${chip.key ? `data-key="${escapeHtml(chip.key)}"` : ''}
              ${chip.value ? `data-value="${escapeHtml(chip.value)}"` : ''}
              aria-label="Убрать фильтр: ${escapeHtml(chip.label)}">
        ${escapeHtml(chip.label)}<span class="applied__x" aria-hidden="true">${icons.close}</span>
      </button>`,
        )
        .join('')
    : ''

  ctx.els.applied.classList.toggle('is-empty', !chips.length)
}

/* --------------------------------------------------------- липкая полоса */

/**
 * Поиска в липкой полосе нет ни на одной ширине. Раньше на мобильном здесь
 * стояла иконка, возвращавшая к полю раздела; поля больше нет, а кнопка,
 * ведущая в никуда, — это сломанный переключатель, а не компромисс.
 * Поиск по сайту живёт в шапке, она липкая и доступна всегда.
 */
export function renderSticky(ctx) {
  const { state, index, schema } = ctx
  const count = totalActive(state, index, schema)

  ctx.els.sticky.innerHTML = `
    <div class="container catalog-sticky__inner">
      <button type="button" class="pill pill--filters" data-action="open-filters">
        ${categoryCopy.sheet.open}${count ? `<span class="pill__count">${count}</span>` : ''}
      </button>
      <span class="catalog-sticky__found" data-sticky-found>${
        ctx.found == null ? '' : `${categoryCopy.results.found} ${ctx.found}`
      }</span>
      ${sortPill(ctx, 'sticky-sort')}
    </div>`
}
