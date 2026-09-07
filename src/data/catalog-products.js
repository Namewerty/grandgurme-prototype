/**
 * Товары для страниц категорий.
 *
 * ЧЁРНАЯ ИКРА — НАСТОЯЩАЯ. Все 52 позиции взяты из выгрузки 1С от 20.08.2026
 * (раздел «Икра» → «Икра черная», `ikra_chernaya`): девять линеек, шесть
 * фасовок, три вида упаковки. Придуманных сортов — «Бестер», «Роял Белуга»,
 * «Ассорти» — здесь больше нет, как нет и придуманных цен: цен в выгрузке
 * не оказалось ни у одной позиции, см. блок про цену ниже.
 *
 * ⚠ ПОЗИЦИИ ПО РЫБЕ ОСТАЛИСЬ ДЕМОНСТРАЦИОННЫМИ. Товарной выгрузки по рыбе
 * нет — в 1С по разделу известны только числа (230 позиций) и четыре способа
 * обработки. Двадцать две позиции ниже перенесены из прототипа фильтров
 * (Фильтры.html) и нужны затем, чтобы на сайте оставалась живая демонстрация
 * фасет с ценами, брендами и странами: на чёрной икре этих осей нет.
 * Названия, фасовки, цены, страны, бренды и признаки новинок в них
 * ПРИДУМАНЫ — заменить выгрузкой по рыбе, когда она придёт. Ось «Обработка»
 * приведена к четырём реальным значениям из 1С.
 *
 * ЧТО ЗДЕСЬ ВАЖНО ДЛЯ КОДА, А НЕ ДЛЯ КЛИЕНТА
 *
 * Свойства, по которым фильтруют, лежат в attrs — плоским словарём
 * «ключ фасеты → значение». Именно поэтому страница категории работает без
 * единого if по названию раздела: она читает attrs[key] по схеме из
 * src/data/facets.js. Числовые оси (цена, вес) живут отдельными полями:
 * по ним считается диапазон, а не совпадение.
 *
 * Обязательные поля позиции:
 *   id, slug, name, weightLabel, weightG, price, oldPrice|null,
 *   inStock, isNew, isSale, isClearance, popularity (0…100), addedAt (ISO),
 *   attrs {}, photo — путь к кадру от /public.
 *
 * price === null — «цена по запросу»: значение неизвестно и выдумывать его
 * нельзя. Карточка в этом случае пишет строку из category-copy.js вместо
 * суммы, а фасета «Цена» и сортировки по цене у раздела просто не заводятся
 * (src/data/facets.js). То же с addedAt === null: даты появления позиции
 * в выгрузке нет, поэтому сортировки «Сначала новинки» у раздела тоже нет.
 *
 * ⚠ ЧУЖИЕ БРЕНДЫ В ФАСЕТЕ «БРЕНД» — ЗАГЛУШКИ ИЗ ПРОТОТИПА. Собственные марки
 * настоящие («Siberian Luxury Bar», «№1 Caviar»), остальные названия пришли
 * из демонстрационного набора Фильтры.html и могут совпасть с реальными
 * компаниями. Заменить списком поставщиков до показа фасеты клиентам —
 * то же правило, что для ленты партнёров на главной.
 *
 * ФОТОГРАФИИ. Кадров под позиции каталога пока нет: заглушка media.js рисует
 * имя ожидаемого файла и пропорцию. Позиции икры показывают уже снятые кадры
 * сортов из /media/caviar — там снят ровно тот продукт, который подписан.
 * Ожидаемые файлы перечислены в src/data/media.js (catalogShots).
 */

import { MEDIA_ROOT, caviarGallery } from './media.js'

/** Кадр позиции каталога: /media/catalog/<категория>/<слаг>.jpg, квадрат. */
const shot = (categorySlug, slug) => `${MEDIA_ROOT}/catalog/${categorySlug}/${slug}.jpg`

/* ------------------------------------------------------------------- рыба */

/**
 * Ось «Обработка» здесь — настоящая одна ось. В прототипе фильтров в том же
 * ряду стояло «В подарочной упаковке», то есть свойство упаковки, а не
 * обработки; из-за такого смешения счётчики двух фильтров начинают
 * противоречить друг другу. Подарочные позиции остались подарочными —
 * это видно в фасете «Упаковка», — но обработку получили честную.
 *
 * После выгрузки из 1С ось приведена к ЧЕТЫРЁМ реальным значениям учёта:
 * холодного копчения · слабосолёная · вяленая и сушёная · горячего копчения.
 * Придуманные значения «Икра» и «Паштеты» убраны: в 1С таких подразделов
 * у рыбы нет. Две позиции лососёвой икры вместе с ними уехали из набора —
 * их место в разделе «Красная икра», а не в рыбе; паштеты остались, но
 * обработку получили по способу приготовления рыбы внутри.
 */
export const fishProducts = [
  {
    id: 1,
    slug: 'losos-file-hk-klassicheskiy-100',
    name: 'Лосось филе холодного копчения, классический',
    weightLabel: '100 г',
    weightG: 100,
    price: 1190,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 95,
    addedAt: '2025-11-02',
    attrs: {
      species: 'Лосось',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Норвегия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 2,
    slug: 'losos-file-slaboy-soli-100',
    name: 'Лосось филе слабой соли, классический',
    weightLabel: '100 г',
    weightG: 100,
    price: 1190,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 92,
    addedAt: '2025-10-15',
    attrs: {
      species: 'Лосось',
      processing: 'Слабосолёная',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Русский улов',
    },
  },
  {
    id: 3,
    slug: 'losos-hk-korobka-146',
    name: 'Лосось холодного копчения, классический, в коробке',
    weightLabel: '1 шт, 146 г',
    weightG: 146,
    price: 1883,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 80,
    addedAt: '2025-09-20',
    attrs: {
      species: 'Лосось',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Фирменная коробка',
      country: 'Норвегия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 4,
    slug: 'pashtet-losos-tsitrus-180',
    name: 'Паштет из лосося горячего копчения с цитрусом',
    weightLabel: '180 г',
    weightG: 180,
    price: 1990,
    oldPrice: null,
    inStock: true,
    isNew: true,
    isSale: false,
    isClearance: false,
    popularity: 70,
    addedAt: '2026-06-10',
    attrs: {
      species: 'Лосось',
      processing: 'Горячего копчения',
      taste: 'С цитрусом',
      packaging: 'Стеклянная банка',
      country: 'Россия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 5,
    slug: 'klykach-file-hk-206',
    name: 'Клыкач филе холодного копчения, в коробке',
    weightLabel: '1 шт, 206 г',
    weightG: 206,
    price: 2039,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 60,
    addedAt: '2025-08-05',
    attrs: {
      species: 'Клыкач',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Фирменная коробка',
      country: 'Чили',
      brand: 'Nordic Catch',
    },
  },
  {
    id: 6,
    slug: 'losos-apelsin-hk-168',
    name: 'Лосось с апельсином холодного копчения, в коробке',
    weightLabel: '1 шт, 168 г',
    weightG: 168,
    price: 2167,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 65,
    addedAt: '2025-07-18',
    attrs: {
      species: 'Лосось',
      processing: 'Холодного копчения',
      taste: 'С апельсином',
      packaging: 'Фирменная коробка',
      country: 'Норвегия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 7,
    slug: 'forel-file-slaboy-soli-100',
    name: 'Форель филе слабой соли, классическая',
    weightLabel: '100 г',
    weightG: 100,
    price: 950,
    oldPrice: null,
    inStock: true,
    isNew: true,
    isSale: false,
    isClearance: false,
    popularity: 55,
    addedAt: '2026-07-25',
    attrs: {
      species: 'Форель',
      processing: 'Слабосолёная',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Русский улов',
    },
  },
  {
    id: 8,
    slug: 'forel-file-hk-ukrop-100',
    name: 'Форель филе холодного копчения с укропом',
    weightLabel: '100 г',
    weightG: 100,
    price: 1050,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 50,
    addedAt: '2025-06-14',
    attrs: {
      species: 'Форель',
      processing: 'Холодного копчения',
      taste: 'С укропом',
      packaging: 'Вакуумная упаковка',
      country: 'Норвегия',
      brand: 'Nordic Catch',
    },
  },
  {
    id: 9,
    slug: 'paltus-file-hk-150',
    name: 'Палтус филе холодного копчения, классический',
    weightLabel: '150 г',
    weightG: 150,
    price: 1450,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 58,
    addedAt: '2025-05-22',
    attrs: {
      species: 'Палтус',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Фарерские острова',
      brand: 'Nordic Catch',
    },
  },
  {
    id: 10,
    slug: 'paltus-file-gk-perets-150',
    name: 'Палтус филе горячего копчения с перцем',
    weightLabel: '150 г',
    weightG: 150,
    price: 1520,
    oldPrice: 1690,
    inStock: true,
    isNew: false,
    isSale: true,
    isClearance: false,
    popularity: 62,
    addedAt: '2026-05-30',
    attrs: {
      species: 'Палтус',
      processing: 'Горячего копчения',
      taste: 'С перцем',
      packaging: 'Вакуумная упаковка',
      country: 'Исландия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 11,
    slug: 'muksun-file-slaboy-soli-200',
    name: 'Муксун филе слабой соли, классический',
    weightLabel: '200 г',
    weightG: 200,
    price: 1780,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 48,
    addedAt: '2025-04-11',
    attrs: {
      species: 'Муксун',
      processing: 'Слабосолёная',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Русский улов',
    },
  },
  {
    id: 12,
    slug: 'nerka-file-hk-150',
    name: 'Нерка филе холодного копчения, классическая',
    weightLabel: '150 г',
    weightG: 150,
    price: 1690,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 52,
    addedAt: '2025-03-09',
    attrs: {
      species: 'Нерка',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Slabosol',
    },
  },
  {
    id: 13,
    slug: 'nerka-file-mozhzhevelnik-150',
    name: 'Нерка филе слабой соли с можжевельником',
    weightLabel: '150 г',
    weightG: 150,
    price: 1750,
    oldPrice: null,
    inStock: true,
    isNew: true,
    isSale: false,
    isClearance: false,
    popularity: 66,
    addedAt: '2026-07-02',
    attrs: {
      species: 'Нерка',
      processing: 'Слабосолёная',
      taste: 'С можжевельником',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Slabosol',
    },
  },
  {
    id: 14,
    slug: 'treska-vyalenaya-pryanaya-120',
    name: 'Треска вяленая, пряная',
    weightLabel: '120 г',
    weightG: 120,
    price: 890,
    oldPrice: null,
    inStock: false,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 30,
    addedAt: '2025-02-17',
    attrs: {
      species: 'Треска',
      processing: 'Вяленая и сушёная',
      taste: 'Пряный',
      packaging: 'Вакуумная упаковка',
      country: 'Норвегия',
      brand: 'Balt Fish',
    },
  },
  {
    id: 15,
    slug: 'tunets-vyalenyy-100',
    name: 'Тунец вяленый, классический',
    weightLabel: '100 г',
    weightG: 100,
    price: 1290,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 40,
    addedAt: '2025-01-28',
    attrs: {
      species: 'Тунец',
      processing: 'Вяленая и сушёная',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Чили',
      brand: 'Balt Fish',
    },
  },
  {
    id: 16,
    slug: 'ugor-gk-120',
    name: 'Угорь горячего копчения, классический',
    weightLabel: '120 г',
    weightG: 120,
    price: 1690,
    oldPrice: 1890,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 45,
    addedAt: '2025-12-05',
    attrs: {
      species: 'Угорь',
      processing: 'Горячего копчения',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 17,
    slug: 'osetr-hk-korobka-250',
    name: 'Осётр холодного копчения, классический, в коробке',
    weightLabel: '1 шт, 250 г',
    weightG: 250,
    price: 3450,
    oldPrice: 3800,
    inStock: true,
    isNew: false,
    isSale: true,
    isClearance: false,
    popularity: 70,
    addedAt: '2026-04-19',
    attrs: {
      species: 'Осётр',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Фирменная коробка',
      country: 'Россия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 18,
    slug: 'seld-slaboy-soli-250',
    name: 'Сельдь слабой соли, классическая',
    weightLabel: '250 г',
    weightG: 250,
    price: 420,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 35,
    addedAt: '2024-11-30',
    attrs: {
      species: 'Сельдь',
      processing: 'Слабосолёная',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Русский улов',
    },
  },
  {
    id: 19,
    slug: 'skumbriya-gk-300',
    name: 'Скумбрия горячего копчения, классическая',
    weightLabel: '300 г',
    weightG: 300,
    price: 480,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 38,
    addedAt: '2024-10-12',
    attrs: {
      species: 'Скумбрия',
      processing: 'Горячего копчения',
      taste: 'Классический',
      packaging: 'Вакуумная упаковка',
      country: 'Россия',
      brand: 'Русский улов',
    },
  },
  {
    id: 22,
    slug: 'pashtet-paltus-ukrop-180',
    name: 'Паштет из палтуса холодного копчения с укропом',
    weightLabel: '180 г',
    weightG: 180,
    price: 1590,
    oldPrice: null,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: false,
    popularity: 44,
    addedAt: '2025-08-27',
    attrs: {
      species: 'Палтус',
      processing: 'Холодного копчения',
      taste: 'С укропом',
      packaging: 'Стеклянная банка',
      country: 'Норвегия',
      brand: 'Nordic Catch',
    },
  },
  {
    id: 23,
    slug: 'nabor-losos-tri-vida-300',
    name: 'Набор дегустационный: лосось трёх видов',
    weightLabel: '3 шт, 300 г',
    weightG: 300,
    price: 3990,
    oldPrice: 4490,
    inStock: true,
    isNew: false,
    isSale: false,
    isClearance: true,
    popularity: 68,
    addedAt: '2026-02-14',
    attrs: {
      species: 'Лосось',
      processing: 'Холодного копчения',
      taste: 'Классический',
      packaging: 'Подарочная коробка',
      country: 'Россия',
      brand: 'Siberian Luxury Bar',
    },
  },
  {
    id: 24,
    slug: 'forel-apelsin-podarochnyy-180',
    name: 'Форель холодного копчения с апельсином, подарочный набор',
    weightLabel: '1 шт, 180 г',
    weightG: 180,
    price: 2290,
    oldPrice: null,
    inStock: true,
    isNew: true,
    isSale: false,
    isClearance: false,
    popularity: 58,
    addedAt: '2026-06-29',
    attrs: {
      species: 'Форель',
      processing: 'Холодного копчения',
      taste: 'С апельсином',
      packaging: 'Подарочная коробка',
      country: 'Норвегия',
      brand: 'Nordic Catch',
    },
  },
].map((product) => ({ ...product, photo: shot('ryba', product.slug) }))

/* ------------------------------------------------------------ чёрная икра */

/**
 * Пятьдесят две позиции чёрной икры — ровно то, что лежит в 1С в разделе
 * «Икра» → «Икра черная» (`ikra_chernaya`) на 20.08.2026.
 *
 * ЧЕТЫРЕ ОСИ, ПО КОТОРЫМ ЭТИ ПОЗИЦИИ РАЗЛИЧАЮТСЯ, И НИ ОДНОЙ ЛИШНЕЙ:
 *   grade      линейка, 9 значений — главная ось раздела (капсулы «Сорт»);
 *   format     фасовка, 6 значений: 50 · 113 · 125 · 250 · 500 · 1000 г;
 *   packaging  упаковка, 3 значения: банка металл, банка стекло, пакет;
 *   species    вид рыбы, 4 значения — по нему собраны подкатегории панели.
 *
 * 113 г — НЕ ОПЕЧАТКА и не «почти 125». Это стеклянная банка, стандартный
 * для отрасли вес; округлять его до круглого числа нельзя.
 *
 * ⚠ ЦЕН В ВЫГРУЗКЕ НЕТ НИ У ОДНОЙ ПОЗИЦИИ, поэтому price === null у всех
 * пятидесяти двух, и карточка пишет «Цена по запросу». Придуманная цена
 * здесь хуже пустого места: человек, покупающий икру, знает порядок цифр,
 * и вымышленная сумма на банке белуги читается как несерьёзность магазина.
 * Из того же следует: фасеты «Цена» и сортировок по цене и скидке у раздела
 * нет вовсе (src/data/facets.js) — пустой ползунок цены на всю страницу
 * выглядел бы поломкой. Придут цены — вернуть pill 'price' в caviarSchema
 * и sorts price_asc/price_desc, разметка их уже умеет.
 *
 * ⚠ ОСТАТКИ НЕ ВЫВОДИМ. В выгрузке «в наличии» помечены 4 позиции из 52
 * (осётр русский Премиум и осётр Премиум STURGEON, банка металл 50 г и банка
 * стекло 113 г) — остальные 48, включая всю белугу, числятся отсутствующими.
 * Похоже, что остатки в базе просто не ведутся: магазин, у которого нет
 * ни одной банки белуги, — не то, что показывают на витрине. Поэтому
 * inStock: true у всех, а тумблер «В наличии» у раздела выключен в схеме.
 * Появятся настоящие остатки — вернуть флаги сюда и `stock: true` в схему.
 *
 * ⚠ ПОЛЕ popularity — НЕ СТАТИСТИКА ПРОДАЖ, её у нас нет. Это порядок
 * позиций в выгрузке 1С, записанный числом, чтобы сортировка по умолчанию
 * давала осмысленный ряд: белуга сверху, паюсная снизу. Заменить реальной
 * статистикой, когда появится аналитика магазина.
 *
 * ⚠ СТРАН, БРЕНДОВ-ПОСТАВЩИКОВ, СОСТАВОВ И СРОКОВ ГОДНОСТИ В ВЫГРУЗКЕ НЕТ.
 * Фасеты «Страна» и «Бренд» на этой странице поэтому убраны, а не заполнены
 * наугад: собственная марка «№1 Caviar» на всех 52 позициях сделала бы
 * фасету из одного значения, а чужие бренды здесь были бы выдумкой.
 */

/** Фасовки, общие для семи линеек из девяти. Порядок — от малой к большой. */
const PACKS = [
  ['50 г', 50, 'Банка металл'],
  ['113 г', 113, 'Банка стекло'],
  ['125 г', 125, 'Банка металл'],
  ['250 г', 250, 'Банка металл'],
  ['500 г', 500, 'Банка металл'],
  ['1000 г', 1000, 'Банка металл'],
]

/** У двух осетровых линеек есть ещё стеклянная банка 50 г — итого семь. */
const PACKS_WITH_GLASS_50 = [
  ['50 г', 50, 'Банка металл'],
  ['50 г', 50, 'Банка стекло'],
  ...PACKS.slice(1),
]

/** Паюсная — прессованная икра, идёт только пакетом и только в двух весах. */
const PACKS_PAYUSNAYA = [
  ['250 г', 250, 'Пакет'],
  ['500 г', 500, 'Пакет'],
]

/**
 * Линейки в том порядке, в каком они стоят в 1С и в фасете «Сорт».
 *
 * Названия причёсаны: 1С кричит капслоком («Икра чёрная Белуга РОЯЛ Банка
 * металл 50 г»), на витрине пишем обычным регистром и без фасовки в имени.
 * Латиница SELECTED и STURGEON оставлена: это часть имени линейки, а не
 * английское слово, которое можно перевести.
 *
 * slug — начало слага позиции; name — название товара без фасовки: фасовка
 * стоит второй строкой карточки и в названии дублировалась бы.
 */
const CAVIAR_LINES = [
  {
    slug: 'beluga-royal',
    grade: 'Белуга Роял',
    species: 'Белуга',
    name: 'Икра белуги Роял',
    packs: PACKS,
  },
  {
    slug: 'beluga-diamond',
    grade: 'Белуга Даймонд',
    species: 'Белуга',
    name: 'Икра белуги Даймонд',
    packs: PACKS,
  },
  {
    slug: 'beluga-premium',
    grade: 'Белуга Премиум',
    species: 'Белуга',
    name: 'Икра белуги Премиум',
    packs: PACKS,
  },
  {
    slug: 'beluga-sterlyad-selected',
    grade: 'Белуга и стерлядь SELECTED',
    species: 'Белуга и стерлядь',
    name: 'Икра белуги и стерляди SELECTED',
    packs: PACKS,
  },
  {
    slug: 'osetr-persidskiy',
    grade: 'Осётр персидский',
    species: 'Осётр',
    name: 'Икра осетра персидского',
    packs: PACKS,
  },
  {
    slug: 'osetr-russkiy-premium',
    grade: 'Осётр русский Премиум',
    species: 'Осётр',
    name: 'Икра осетра русского Премиум',
    packs: PACKS_WITH_GLASS_50,
  },
  {
    slug: 'osetr-premium-sturgeon',
    grade: 'Осётр Премиум STURGEON',
    species: 'Осётр',
    name: 'Икра осетра Премиум STURGEON',
    packs: PACKS_WITH_GLASS_50,
  },
  {
    slug: 'sevruga',
    grade: 'Севрюга',
    species: 'Севрюга',
    name: 'Икра севрюги',
    packs: PACKS,
  },
  {
    slug: 'sevruga-payusnaya',
    grade: 'Севрюга паюсная',
    species: 'Севрюга',
    name: 'Икра севрюги паюсная',
    packs: PACKS_PAYUSNAYA,
  },
]

/**
 * Кадры сняты по видам рыбы, а не по линейкам: внутри вида банка одна и та же,
 * а девять почти одинаковых пэкшотов икры — это девять съёмок ради ничего.
 *
 * ⚠ Кадр `caviar-sterlet.jpg` снимался как «икра стерляди»; отдельной линейки
 * стерляди в ассортименте нет, есть купаж «Белуга и стерлядь SELECTED», и
 * кадр стоит на нём. Пересняв банку купажа, заменить файл — путь не меняется.
 * Кадры `caviar-bester.jpg` и `caviar-royal-beluga.jpg` больше не нужны:
 * бестера в ассортименте нет вовсе, а «Роял» — линейка внутри белуги.
 */
const caviarShot = {
  'Белуга': `${MEDIA_ROOT}/caviar/caviar-beluga.jpg`,
  'Осётр': `${MEDIA_ROOT}/caviar/caviar-osetra.jpg`,
  'Севрюга': `${MEDIA_ROOT}/caviar/caviar-sevruga.jpg`,
  'Белуга и стерлядь': `${MEDIA_ROOT}/caviar/caviar-sterlet.jpg`,
}

/**
 * Кадры галереи на карточке товара — по виду, а не по позиции: банка внутри
 * вида одна и та же. Порядок ключей совпадает с caviarGallery в media.js.
 */
const caviarGalleryBySpecies = {
  'Белуга': caviarGallery[0],
  'Осётр': caviarGallery[1],
  'Севрюга': caviarGallery[2],
  'Белуга и стерлядь': caviarGallery[3],
}

/** Слаг упаковки для адреса позиции: три значения, три коротких слова. */
const packagingSlug = {
  'Банка металл': 'metall',
  'Банка стекло': 'steklo',
  'Пакет': 'paket',
}

export const caviarProducts = CAVIAR_LINES.flatMap((line) =>
  line.packs.map(([format, weightG, packaging]) => ({ line, format, weightG, packaging })),
).map(({ line, format, weightG, packaging }, index) => ({
  id: 100 + index,
  slug: `${line.slug}-${packagingSlug[packaging]}-${weightG}`,
  name: line.name,
  /* Вторая строка карточки — упаковка И вес: без упаковки две позиции
     осетра по 50 г (металл и стекло) отличались бы только пилюлей фильтра,
     а на карточке выглядели бы дублем. */
  weightLabel: `${packaging}, ${weightG} г`,
  weightG,
  price: null,
  oldPrice: null,
  inStock: true,
  isNew: false,
  isSale: false,
  isClearance: false,
  popularity: 100 - index,
  addedAt: null,
  attrs: {
    grade: line.grade,
    format,
    packaging,
    species: line.species,
  },
  photo: caviarShot[line.species],
}))

/* ----------------------------------------------------------------- реестр */

/**
 * Разделы, у которых уже есть товары. Все остальные адреса /catalog/<slug>
 * остаются информационными заглушками (src/page.js): десять пустых каталогов
 * на показе выглядят хуже, чем десять честных описаний раздела.
 */
export const productsByCategory = {
  ryba: fishProducts,
  'chernaya-ikra': caviarProducts,
}

export const hasProducts = (slug) => Boolean(productsByCategory[slug]?.length)

export const getProducts = (slug) => productsByCategory[slug] || []

/**
 * Все позиции всех разделов плоским списком, с указанием раздела. Нужен
 * карточке товара и генератору страниц: у каждой позиции свой адрес
 * /product/<слаг>, и оба должны получать один и тот же список.
 */
export const allProducts = Object.entries(productsByCategory).flatMap(
  ([categorySlug, list]) => list.map((product) => ({ ...product, categorySlug })),
)

/** Позиция по слагу из адреса. null — адрес не наш, страница покажет 404. */
export function findProductBySlug(slug) {
  return allProducts.find((product) => product.slug === slug) || null
}

/** Соседи по разделу — из них собираются ряды фасовок и ленты «ещё». */
export const siblingsOf = (product) => getProducts(product.categorySlug)

/**
 * Кадры для галереи карточки. У икры это вид: главный кадр плюс два ракурса
 * (см. caviarGallery в media.js). У остальных разделов ракурсов не снято —
 * галерея честно остаётся одним кадром, и ленты миниатюр под ним не будет.
 */
export const galleryOf = (product) =>
  caviarGalleryBySpecies[product.attrs?.species] || [
    { src: product.photo, ratio: '1:1', alt: product.name },
  ]
