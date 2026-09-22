/* ============================================================================
   Модель каталога: отбор, фасетные счётчики, сортировки. Чистые функции,
   DOM здесь не трогается вовсе — благодаря этому мобильный боттом-шит может
   считать «Показать N товаров» по черновику состояния, ничего не перерисовывая.

   ГЛАВНОЕ ПРАВИЛО, КОТОРОЕ ЛЕГКО ПОТЕРЯТЬ ПРИ ПЕРЕПИСЫВАНИИ.
   Счётчик у опции считается с ИСКЛЮЧЕНИЕМ СОБСТВЕННОЙ ФАСЕТЫ: выбор внутри
   «Бренда» не влияет на счётчики самого «Бренда», но влияет на все остальные.
   Иначе, выбрав один бренд, человек увидит у всех прочих брендов ноль и
   решит, что в разделе больше ничего нет. Реализовано параметром excludeKey
   в matches(): фасета, для которой считаем, из проверки выпадает.

   Ни одного упоминания рыбы, икры или конкретной фасеты в этом файле нет:
   свойства товара лежат в product.attrs, состав фасет приходит схемой
   из src/data/facets.js. Один и тот же код обслуживает любой раздел.
   ============================================================================ */

import { BENEFITS, DEFAULT_SORT } from '../../data/facets.js'
import { categoryCopy } from '../../data/category-copy.js'

/* --------------------------------------------------------------- утилиты */

/** Нормализация для поиска и сравнения: регистр не важен, ё приравнена к е. */
export const normalize = (value) => String(value || '').toLowerCase().replace(/ё/g, 'е')

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]))

export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/** Цена: разряды пробелами, копейки только если они есть. */
export function formatPrice(value) {
  const hasCents = Math.round(value * 100) % 100 !== 0
  const options = hasCents
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { maximumFractionDigits: 0 }
  return `${new Intl.NumberFormat('ru-RU', options).format(value)} ₽`
}

/** «≈ 2 580 ₽» — приблизительная цена или сумма (коробки, src/data/boxes.js). */
export const approxLabel = (value) => `${categoryCopy.boxes.approx}${formatPrice(value)}`

/**
 * Подпись цены позиции — одна на сетку каталога, ленты карточки, подсказки
 * поиска и избранное: у позиции в коробках цена приблизительная, «≈ 2 580 ₽».
 * null — цены нет; текст «Цена по запросу» у каждого носителя свой.
 */
export const priceText = (item) =>
  item?.price == null ? null : item.sale === 'box' ? approxLabel(item.price) : formatPrice(item.price)

/** «товар» / «товара» / «товаров». */
export function plural(n, one, few, many) {
  const n10 = n % 10
  const n100 = n % 100
  if (n100 >= 11 && n100 <= 14) return many
  if (n10 === 1) return one
  if (n10 >= 2 && n10 <= 4) return few
  return many
}

export const foundLabel = (n) => `${n} ${plural(n, 'товар', 'товара', 'товаров')}`

/** Подсветка совпадения в подсказках. Экранирование — до вставки <mark>. */
export function highlight(text, query) {
  const safe = escapeHtml(text)
  const q = normalize(query).trim()
  if (!q) return safe

  const start = normalize(safe).indexOf(q)
  if (start === -1) return safe

  return `${safe.slice(0, start)}<mark>${safe.slice(start, start + q.length)}</mark>${safe.slice(
    start + q.length,
  )}`
}

/* ------------------------------------------------- опции и границы фасет */

/**
 * Значения фасеты — из самих товаров, а не из отдельного списка: разъехаться
 * с данными нечему. order задаёт осмысленный порядок там, где алфавит
 * бессмыслен; остальное досыпается по алфавиту.
 */
export function collectOptions(products, key, order = []) {
  const found = new Set()
  products.forEach((product) => {
    const value = product.attrs?.[key]
    if (value) found.add(value)
  })

  const known = order.filter((value) => found.has(value))
  const rest = [...found].filter((value) => !order.includes(value)).sort((a, b) => a.localeCompare(b, 'ru'))
  return [...known, ...rest]
}

/** Границы числовой оси. Считаются один раз на раздел. */
export function bounds(products, field) {
  const values = products.map((product) => product[field]).filter((v) => typeof v === 'number')
  if (!values.length) return { min: 0, max: 0 }
  return { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) }
}

/**
 * Всё, что модель должна знать о разделе: опции списочных фасет и границы
 * числовых. Собирается один раз при загрузке страницы.
 */
export function buildIndex(products, schema) {
  const options = {}
  const ranges = {}

  const listFacets = [schema.chips, schema.tabs, ...schema.pills.filter((p) => p.type === 'list')].filter(
    Boolean,
  )

  listFacets.forEach((facet) => {
    options[facet.key] = collectOptions(products, facet.key, facet.order || [])
  })

  schema.pills
    .filter((pill) => pill.type === 'range')
    .forEach((pill) => {
      ranges[pill.key] = { field: pill.field, ...bounds(products, pill.field) }
    })

  return { options, ranges }
}

/* ------------------------------------------------------ правила отбора */

/* Функции matchesQuery здесь больше нет: поиск по разделу с страницы убран,
   отбор идёт только по фасетам. normalize и highlight остались — ими
   пользуется поиск по значениям внутри поповера длинной пилюли. */

export function matchesBenefit(product, key) {
  if (key === 'new') return product.isNew
  if (key === 'sale') return product.isSale
  if (key === 'discount') return product.oldPrice != null
  if (key === 'clearance') return product.isClearance
  return false
}

const rangeActive = (state, index, key) => {
  const bound = index.ranges[key]
  const value = state.ranges[key]
  if (!bound || !value) return false
  return value.min > bound.min || value.max < bound.max
}

/**
 * @param {object} product
 * @param {object} state   состояние фильтров (или черновик боттом-шита)
 * @param {object} index   опции и границы раздела
 * @param {string|null} excludeKey фасета, которую при проверке пропускаем
 */
export function matches(product, state, index, excludeKey = null) {
  /* Наличия здесь нет намеренно: оно не фильтр, а база выдачи, и решается
     по набору целиком, а не по одной позиции (см. stockView ниже). */
  if (excludeKey !== 'benefit' && state.benefits.length) {
    if (!state.benefits.some((key) => matchesBenefit(product, key))) return false
  }

  for (const [key, selected] of Object.entries(state.values)) {
    if (key === excludeKey || !selected.length) continue
    if (!selected.includes(product.attrs?.[key])) return false
  }

  for (const [key, value] of Object.entries(state.ranges)) {
    if (key === excludeKey || !rangeActive(state, index, key)) continue
    const field = index.ranges[key].field
    if (product[field] < value.min || product[field] > value.max) return false
  }

  return true
}

/* ---------------------------------------------------------------- наличие */

export const countInStock = (list) => list.reduce((n, product) => n + (product.inStock ? 1 : 0), 0)

/**
 * Что показывать по наличию для набора позиций, прошедших фильтры.
 *
 * База — то, что есть на складе. Позиции под заказ добавляются флагом
 * withPreorder (капсула «и под заказ», ?stock=all). Одно исключение:
 * если в наборе НЕТ НИ ОДНОЙ позиции в наличии, под заказ показывается
 * принудительно. Пустая сетка при фильтре, отсекающем весь набор, читается
 * как поломка сайта, а не как «со склада нет».
 *
 * Считается по набору, а не по разделу, и это важно для чёрной икры:
 * на складе там четыре банки осетра, и человек, выбравший «Белугу»,
 * иначе получал бы пустую выдачу при восемнадцати позициях под заказ.
 */
export function stockView(pool, state) {
  const inStock = countInStock(pool)
  const preorder = pool.length - inStock
  const forced = inStock === 0 && preorder > 0
  return { inStock, preorder, forced, showPreorder: forced || state.withPreorder }
}

/* Позиции с pin (тестовые, см. TEST_CAVIAR в catalog-products.js) видны
   при любом правиле наличия: для проверки трёх видов они нужны всегда. */
export const applyStock = (pool, state) =>
  stockView(pool, state).showPreorder ? pool : pool.filter((product) => product.inStock || product.pin)

/** Позиции, прошедшие фильтры, без учёта наличия. */
export const filterPool = (products, state, index) =>
  products.filter((product) => matches(product, state, index, null))

/** Выдача: фильтры плюс наличие. */
export const filterAll = (products, state, index) => applyStock(filterPool(products, state, index), state)

/**
 * Позиции под заказ — после наличия при любой сортировке. Внутри каждой
 * группы порядок сортировки сохраняется: Array#sort стабилен.
 */
export const stockFirst = (list) =>
  list
    .slice()
    .sort((a, b) => (a.pin || 99) - (b.pin || 99) || Number(Boolean(b.inStock)) - Number(Boolean(a.inStock)))

/**
 * Счётчики опций одной фасеты. Собственная фасета из отбора исключена.
 * Число у опции — сколько позиций человек увидит, выбрав её: с тем же
 * правилом наличия, что у выдачи. Иначе у «Белуги» стоял бы ноль и опция
 * выключалась бы, хотя под заказ её восемнадцать позиций.
 */
export function facetCounts(products, state, index, key) {
  const pool = products.filter((product) => matches(product, state, index, key))
  return (index.options[key] || []).map((option) => ({
    value: option,
    count: applyStock(pool.filter((product) => product.attrs?.[key] === option), state).length,
  }))
}

/** «Выгода» считается так же фасетно: собственный набор из подсчёта выпадает. */
export function benefitCounts(products, state, index) {
  const pool = products.filter((product) => matches(product, state, index, 'benefit'))
  return BENEFITS.map((benefit) => ({
    value: benefit.key,
    label: benefit.label,
    count: applyStock(pool.filter((product) => matchesBenefit(product, benefit.key)), state).length,
  }))
}

/* -------------------------------------------------------------- сортировка */

export function sortProducts(list, sortKey = DEFAULT_SORT) {
  const arr = list.slice()

  switch (sortKey) {
    case 'price_asc':
      arr.sort((a, b) => a.price - b.price)
      break
    case 'price_desc':
      arr.sort((a, b) => b.price - a.price)
      break
    case 'discount':
      arr.sort((a, b) => discountShare(b) - discountShare(a))
      break
    case 'alpha':
      arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      break
    /* Сортировки по фасовке нужны там, где цены нет, а вес — настоящая ось
       раздела: у чёрной икры человек выбирает между банкой 50 г и банкой
       на килограмм, и это единственный числовой порядок, который у нас есть. */
    case 'weight_asc':
      arr.sort((a, b) => a.weightG - b.weightG)
      break
    case 'weight_desc':
      arr.sort((a, b) => b.weightG - a.weightG)
      break
    case 'new':
      arr.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
      break
    case 'recommend':
      arr.sort((a, b) => recommendScore(b) - recommendScore(a))
      break
    default:
      arr.sort((a, b) => b.popularity - a.popularity)
  }

  return arr
}

const discountShare = (p) => (p.oldPrice ? (p.oldPrice - p.price) / p.oldPrice : 0)

/** «Рекомендуем» — популярность плюс вес новинки и акции. */
const recommendScore = (p) => (p.isNew ? 1 : 0) + (p.isSale ? 1 : 0) + p.popularity / 100

/* ------------------------------------------------- активные фильтры */

/** Сколько значений выбрано в одной фасете. Сортировка фильтром не считается. */
export function activeCount(facet, state, index) {
  if (facet.type === 'benefit') return state.benefits.length
  if (facet.type === 'range') return rangeActive(state, index, facet.key) ? 1 : 0
  return state.values[facet.key]?.length || 0
}

/**
 * Всё активное разом: строки chips и tabs и все пилюли. Капсула «и под заказ»
 * сюда не входит: она меняет базу выдачи, а не сужает её, — ровно как
 * сортировка, которая фильтром тоже не считается.
 */
export function totalActive(state, index, schema) {
  let total = 0
  Object.values(state.values).forEach((list) => {
    total += list.length
  })
  total += state.benefits.length
  schema.pills
    .filter((pill) => pill.type === 'range')
    .forEach((pill) => {
      if (rangeActive(state, index, pill.key)) total += 1
    })
  return total
}

export const hasAnyActive = (state, index, schema) =>
  Boolean(totalActive(state, index, schema))

export { rangeActive }
