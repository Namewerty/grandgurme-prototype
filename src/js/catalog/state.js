/* ============================================================================
   Состояние фильтров и его адрес.

   ПОЧЕМУ QUERY, А НЕ ХЭШ. В прототипе фильтров состояние жило в location.hash
   (#cat=…&brand=…). На сайте так нельзя по двум причинам: хэш уже занят
   якорями секций и переходами Lenis, а мега-меню ведёт на подкатегории
   обычным параметром — /catalog/ryba?sub=holodnoe-kopchenie. Состояние
   переехало в query-строку, историю ведёт replaceState: назад из каталога
   человек должен вернуться на предыдущую страницу, а не отматывать двадцать
   нажатий по фильтрам.

   ПОДКАТЕГОРИЯ — ЭТО СОХРАНЁННЫЙ ФИЛЬТР. Ссылка ?sub=<слаг> из мега-меню
   разворачивается в значение фасеты (src/data/facets.js, subFilters), после
   чего адрес переписывается в канонический вид ?processing=Холодного+копчения.
   Так у одного и того же набора товаров один адрес, а не два, и человек
   видит выбранное фильтром, а не «третьим уровнем», из которого нет выхода.
   ============================================================================ */

import { DEFAULT_SORT, defaultSortFor, sortsFor, subFilterFor } from '../../data/facets.js'

/** Пустое состояние раздела: границы диапазонов берутся из товаров. */
export function defaultState(schema, index) {
  const values = {}
  const facetKeys = [schema.chips, schema.tabs, ...schema.pills.filter((p) => p.type === 'list')]
    .filter(Boolean)
    .map((facet) => facet.key)

  facetKeys.forEach((key) => {
    values[key] = []
  })

  const ranges = {}
  Object.entries(index.ranges).forEach(([key, bound]) => {
    ranges[key] = { min: bound.min, max: bound.max }
  })

  /* Поля query здесь нет: поиска по разделу на странице больше нет,
     и параметр ?q= в адресе каталога тоже не появляется. */
  return {
    values,
    ranges,
    benefits: [],
    inStock: false,
    /* Сортировка по умолчанию — первая из доступных разделу: на разделе без
       цен «Сначала дешевле» из адреса тоже не должна применяться. */
    sort: defaultSortFor(schema),
    page: 1,
  }
}

export const cloneState = (state) => ({
  ...state,
  values: Object.fromEntries(Object.entries(state.values).map(([k, v]) => [k, v.slice()])),
  ranges: Object.fromEntries(Object.entries(state.ranges).map(([k, v]) => [k, { ...v }])),
  benefits: state.benefits.slice(),
})

/* ------------------------------------------------------------ чтение URL */

export function stateFromUrl(schema, index, categorySlug, search = location.search) {
  const state = defaultState(schema, index)
  const params = new URLSearchParams(search)

  if (params.has('stock')) state.inStock = params.get('stock') === '1'
  if (params.has('ben')) state.benefits = params.get('ben').split(',').filter(Boolean)

  const sort = params.get('sort')
  if (sort && sortsFor(schema).some((option) => option.key === sort)) state.sort = sort

  const page = Number(params.get('page'))
  if (page > 1) state.page = page

  Object.keys(state.values).forEach((key) => {
    if (!params.has(key)) return
    const allowed = index.options[key] || []
    const chosen = params.get(key).split(',').filter((value) => allowed.includes(value))
    // Таб выбирается одиночно: лишние значения из адреса отсекаем здесь,
    // иначе строка табов не смогла бы показать активный.
    state.values[key] = schema.tabs?.key === key ? chosen.slice(0, 1) : chosen
  })

  Object.entries(state.ranges).forEach(([key, value]) => {
    if (!params.has(key)) return
    const [min, max] = params.get(key).split('-').map(Number)
    const bound = index.ranges[key]
    if (Number.isFinite(min)) value.min = Math.max(bound.min, Math.min(min, bound.max))
    if (Number.isFinite(max)) value.max = Math.min(bound.max, Math.max(max, value.min))
  })

  applySub(state, schema, index, categorySlug, params.get('sub'))
  return state
}

/**
 * Разворачивает ?sub=<слаг> в значения фасеты. Явно заданный в адресе фильтр
 * по той же оси приоритетнее: если человек уже что-то выбрал руками, ссылка
 * из меню не должна затирать его выбор.
 */
function applySub(state, schema, index, categorySlug, subSlug) {
  const rule = subFilterFor(categorySlug, subSlug)
  if (!rule) return

  const current = state.values[rule.key]
  if (!current || current.length) return

  const allowed = index.options[rule.key] || []
  const values = rule.values.filter((value) => allowed.includes(value))
  state.values[rule.key] = schema.tabs?.key === rule.key ? values.slice(0, 1) : values
}

/* ------------------------------------------------------------ запись URL */

export function stateToSearch(state, index) {
  const params = new URLSearchParams()

  Object.entries(state.values).forEach(([key, list]) => {
    if (list.length) params.set(key, list.join(','))
  })

  Object.entries(state.ranges).forEach(([key, value]) => {
    const bound = index.ranges[key]
    if (value.min > bound.min || value.max < bound.max) params.set(key, `${value.min}-${value.max}`)
  })

  if (state.benefits.length) params.set('ben', state.benefits.join(','))
  if (state.inStock) params.set('stock', '1')
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort)
  if (state.page > 1) params.set('page', String(state.page))

  const query = params.toString()
  return query ? `?${query}` : location.pathname
}

/**
 * Адрес переписывается без записи в историю. Единственное исключение — первый
 * заход по ссылке из мега-меню: там мы меняем ?sub= на канонические параметры,
 * и это тоже replaceState, чтобы кнопка «назад» вела на предыдущую страницу,
 * а не на ту же самую с другим написанием адреса.
 */
export function syncUrl(state, index) {
  const next = stateToSearch(state, index)
  const current = `${location.pathname}${location.search}`
  const target = next.startsWith('?') ? `${location.pathname}${next}` : next
  if (target !== current) history.replaceState(null, '', target)
}
