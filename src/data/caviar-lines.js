/**
 * Паспорта девяти линеек чёрной икры №1 Caviar.
 *
 * Лежат в общей папке данных намеренно: следующей задачей эти же паспорта
 * встанут на страницу раздела /catalog/chernaya-ikra. Сейчас их читает
 * только альтернативная главная /alt2 (блок «Характер икры», src/alt2/).
 *
 * ОТКУДА ДАННЫЕ. Презентация компании `ПРЗНТ_ГРГ_20260307_ИКРА.pdf`
 * от 07.03.2026, страницы 26–28: вид рыбы, размер зерна, цвет, текстура,
 * вкус и возраст рыбы. Коды СИТЕС видов — общепринятые трёхбуквенные коды
 * конвенции (HUS, GUE, PER, STE, BAE, RUT).
 *
 * ПОЛЯ БЕЗ ЗНАЧЕНИЯ НЕ ВЫВОДЯТСЯ. null у color, texture, taste и age значит
 * «в презентации этого нет», а не «пусто»: строки паспорта на странице
 * просто нет. Каждое такое null — строка в README, «Альтернативная главная 2»,
 * таблица «Что осталось предварительным»: значение нужно получить
 * у производителя.
 *
 * ФАСОВКИ — ИЗ УЧЁТА 1С, А НЕ ИЗ ПРЕЗЕНТАЦИИ. Веса берутся из позиций
 * caviarProducts (src/data/catalog-products.js), которые собраны из
 * CAVIAR_LINES. Сам массив CAVIAR_LINES модуль не экспортирует, а править
 * общий файл ради черновой страницы задача не позволяет, — поэтому веса
 * собираются по полю attrs.grade позиций. Результат тот же: ровно те
 * фасовки, что стоят в каталоге.
 *
 * grain — размер зерна, мм: { min, max, label }. max: null — «и крупнее»
 * (у Белуги Роял «от 4 мм»). У паюсной зерна как такового нет — икра
 * прессованная: min и max у неё null, label — «прессованная».
 * age — { years, label } или null.
 * short — подпись линейки внутри вкладки вида («Роял · Даймонд · Премиум»).
 * tin — пэкшот банки линейки на белом фоне (public/media/alt2/types/).
 */

import { caviarProducts } from './catalog-products.js'

const MEDIA = '/media'

/**
 * Виды рыбы: вкладки блока и кадры лупы. detail — зерно крупным планом,
 * один и тот же файл стоит в большом круге и внутри линзы.
 */
export const caviarSpecies = [
  {
    key: 'beluga',
    tab: 'Белуга',
    detail: `${MEDIA}/caviar/caviar-beluga-detail.jpg`,
    alt: 'Икра белуги крупным планом',
    caption: 'Huso huso. Крупнейшая рыба семейства осетровых; первую икру даёт не раньше 18 лет.',
  },
  {
    key: 'osetr',
    tab: 'Осётр',
    detail: `${MEDIA}/caviar/caviar-osetra-detail.jpg`,
    alt: 'Икра осетра крупным планом',
    caption: 'Насыщенный, многогранный вкус и бархатистая текстура.',
  },
  {
    key: 'sevruga',
    tab: 'Севрюга',
    detail: `${MEDIA}/caviar/caviar-sevruga-detail.jpg`,
    alt: 'Икра севрюги крупным планом',
    caption: 'Acipenser stellatus. Небольшая и изящная рыба семейства осетровых.',
  },
  {
    key: 'beluga-sterlyad',
    tab: 'Белуга и стерлядь',
    detail: `${MEDIA}/caviar/caviar-sterlet-detail.jpg`,
    alt: 'Икра белуги и стерляди крупным планом',
    caption: 'Гибрид белуги и стерляди — бестер.',
  },
]

/** Коды видов СИТЕС, которые встречаются в линейках. */
export const citesSpecies = {
  HUS: 'белуга',
  GUE: 'русский осётр',
  PER: 'персидский осётр',
  STE: 'севрюга',
  BAE: 'сибирский осётр',
  RUT: 'стерлядь',
}

/** Строка «Способ» — одна на все линейки. */
export const caviarMethod = 'забойный, Азербайджан'

const tin = (slug) => `${MEDIA}/alt2/types/tin-${slug}.jpg`

/* Порядок — как в фасете «Сорт» (src/data/facets.js). */
const LINES = [
  {
    slug: 'beluga-royal',
    grade: 'Белуга Роял',
    species: 'beluga',
    name: 'Белуга Роял',
    short: 'Роял',
    latin: 'Huso huso',
    cites: 'HUS',
    lead: 'Зерно от 4 мм — крупнее, чем в других линейках №1 Caviar.',
    grain: { min: 4, max: null, label: 'от 4 мм' },
    color: 'от антрацитового до стально-серого',
    texture: 'мягкая и нежная, тает во рту',
    taste: 'глубокий, сливочный, с тонкими ореховыми нотами',
    age: { years: 30, label: 'самки дают икру к 30 годам' },
  },
  {
    slug: 'beluga-diamond',
    grade: 'Белуга Даймонд',
    species: 'beluga',
    name: 'Белуга Даймонд',
    short: 'Даймонд',
    latin: 'Huso huso',
    cites: 'HUS',
    lead: 'Крупное зерно и долгое послевкусие.',
    grain: { min: 3.6, max: 3.9, label: '3,6–3,9 мм' },
    color: 'от антрацитового до стально-серого',
    texture: 'нежная',
    taste: 'сливочный, с тонкими ореховыми нотами и долгим послевкусием',
    age: { years: 24, label: 'самки дают икру к 24 годам' },
  },
  {
    slug: 'beluga-premium',
    grade: 'Белуга Премиум',
    species: 'beluga',
    name: 'Белуга Премиум',
    short: 'Премиум',
    latin: 'Huso huso',
    cites: 'HUS',
    lead: 'Сливочный вкус, икра тает во рту.',
    grain: { min: 3.5, max: 3.5, label: '3,5 мм' },
    color: 'от антрацитового до стально-серого',
    texture: 'мягкая и нежная, тает во рту',
    taste: 'сливочный',
    age: { years: 18, label: 'самки впервые дают икру в 18 лет' },
  },
  /* ⚠ КУПАЖ ИЛИ ГИБРИД. В catalog-products.js и в README линейка описана как
     купаж белуги и стерляди, и там же сказано, что бестера в ассортименте нет.
     Презентация компании (стр. 27) называет её икрой бестера — гибрида белуги
     и стерляди. Страница следует презентации; расхождение — строкой в README,
     «Что осталось предварительным». */
  {
    slug: 'beluga-sterlyad-selected',
    grade: 'Белуга и стерлядь SELECTED',
    species: 'beluga-sterlyad',
    name: 'Белуга и стерлядь SELECTED',
    short: 'SELECTED',
    latin: 'Huso huso × Acipenser ruthenus',
    cites: 'HUS x RUT', // ⚠ ПОДТВЕРДИТЬ ПО БАНКЕ: порядок видов в коде
    lead: 'Икра бестера — гибрида белуги и стерляди.',
    grain: { min: 2.5, max: 2.5, label: '2,5 мм' },
    color: 'от серебристо-серого до тёмного',
    texture: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    taste: 'нежный, сливочный',
    age: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
  },
  {
    slug: 'osetr-persidskiy',
    grade: 'Осётр персидский',
    species: 'osetr',
    name: 'Осётр персидский',
    short: 'Персидский',
    latin: 'Acipenser persicus',
    cites: 'PER',
    lead: 'Ореховый привкус и насыщенный аромат.',
    grain: { min: 2.8, max: 3.5, label: '2,8–3,5 мм' },
    color: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    texture: 'бархатистая',
    taste: 'с характерным ореховым привкусом и насыщенным ароматом',
    age: { years: 24, label: 'от рыбы 24 лет и старше' },
  },
  {
    slug: 'osetr-russkiy-premium',
    grade: 'Осётр русский Премиум',
    species: 'osetr',
    name: 'Осётр русский Премиум',
    short: 'Русский Премиум',
    latin: 'Acipenser gueldenstaedtii',
    cites: 'GUE',
    lead: 'Русский осётр с ореховым привкусом.',
    grain: { min: 2.8, max: 3.0, label: '2,8–3 мм' },
    color: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    texture: 'бархатистая',
    taste: 'с характерным ореховым привкусом и насыщенным ароматом',
    age: { years: 18, label: 'от рыбы 18 лет и старше' },
  },
  /* В прайсе той же презентации у этой линейки стоит «3,5 мм», в описании —
     «2,8–3,5 мм»; взято описание. */
  {
    slug: 'osetr-premium-sturgeon',
    grade: 'Осётр Премиум STURGEON',
    species: 'osetr',
    name: 'Осётр Премиум STURGEON',
    short: 'Премиум STURGEON',
    latin: 'Acipenser gueldenstaedtii × Acipenser baerii',
    cites: 'GUE x BAE',
    lead: 'Гибрид русского и сибирского осетра.',
    grain: { min: 2.8, max: 3.5, label: '2,8–3,5 мм' },
    color: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    texture: 'бархатистая',
    taste: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    age: { years: 18, label: 'от рыбы 18 лет и старше' },
  },
  {
    slug: 'sevruga',
    grade: 'Севрюга',
    species: 'sevruga',
    name: 'Севрюга',
    short: 'Зернистая',
    latin: 'Acipenser stellatus',
    cites: 'STE',
    lead: 'Икра севрюги, зерно 2,5 мм.',
    grain: { min: 2.5, max: 2.5, label: '2,5 мм' },
    color: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    texture: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    taste: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    age: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
  },
  {
    slug: 'sevruga-payusnaya',
    grade: 'Севрюга паюсная',
    species: 'sevruga',
    name: 'Севрюга паюсная',
    short: 'Паюсная',
    latin: 'Acipenser stellatus',
    cites: 'STE',
    lead: 'Прессованная икра ручной работы: из 2 кг свежей икры получается 1 кг.',
    grain: { min: null, max: null, label: 'прессованная' },
    color: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    texture: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    taste: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
    age: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: нет в презентации
  },
]

/** Веса фасовок линейки из учёта 1С: без повторов, от малой к большой. */
function packsOf(grade) {
  const weights = caviarProducts
    .filter((product) => product.attrs.grade === grade)
    .map((product) => product.weightG)
  return [...new Set(weights)].sort((a, b) => a - b)
}

export const caviarLines = LINES.map((line) => ({
  ...line,
  tin: tin(line.slug),
  packs: packsOf(line.grade),
}))

/** «50 · 113 · 125 · 250 · 500 · 1000 г» */
export const packsLabel = (line) => `${line.packs.join(' · ')} г`

export const findLine = (slug) => caviarLines.find((line) => line.slug === slug) || null

export const linesOfSpecies = (key) => caviarLines.filter((line) => line.species === key)

export const findSpecies = (key) => caviarSpecies.find((species) => species.key === key) || null
