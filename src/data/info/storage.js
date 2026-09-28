/**
 * /storage — «Как хранить и подавать». Состав блоков —
 * src/info/pages/storage.js.
 *
 * НА СТЕНДЕ ЭТА СТРАНИЦА ПРАВИТСЯ В АДМИНКЕ (ADMIN_EDITED в
 * scripts/stand-files.mjs). Здесь меняется только прототип:
 * deploy-src/storage/index.php не трогаем. Как новая страница попадёт
 * на стенд — PERENOS-info-stranicy.md.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА ПО ЭТИКЕТКАМ: все диапазоны и сроки после
 * вскрытия (на 1-caviar.ae для икры — от −2 до +2 °C, до 12 месяцев
 * закрытой и до 5 суток открытой). Продукт с range: null не выводится.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: граммы икры на гостя.
 */

import { ROUTES } from '../routes.js'
import { caviarPacks } from './partners.js'
import { infoMedia as m } from './media.js'

export const storagePage = {
  hero: {
    eyebrow: 'ПОКУПАТЕЛЯМ',
    title: ['Как хранить', 'и подавать'],
    lead:
      'При какой температуре держать икру и рыбу, сколько живёт открытая банка ' +
      'и сколько икры взять на гостей.',
    media: m.silverDishToasts,
  },

  cold: {
    eyebrow: 'ХРАНЕНИЕ',
    title: 'У каждого продукта своя температура',
    scaleLabel: 'Температура, °C',
    productsLabel: 'Продукты',
    axis: { min: -20, max: 8, step: 2, labels: [-18, -10, -4, -2, 0, 2, 4, 6, 8] },
    defaultKey: 'black',
    items: [
      {
        key: 'black',
        title: 'Чёрная икра',
        range: [-4, -2],
        label: '−4…−2 °C',
        text:
          'Самое холодное место холодильника, но не морозильная камера: заморозка ' +
          'рвёт оболочку зерна. Открытую банку съедают за двое-трое суток.',
      },
      { key: 'red', title: 'Красная икра', range: null, label: null, text: null }, // ⚠ ПОДТВЕРДИТЬ
      { key: 'fish', title: 'Рыба в вакуумной упаковке', range: null, label: null, text: null }, // ⚠ ПОДТВЕРДИТЬ
      {
        key: 'frozen',
        title: 'Замороженные морепродукты',
        range: [-20, -18],
        label: '−18 °C и ниже',
        text: 'Морозильная камера. Размораживают медленно, в холодильнике.',
      },
      {
        key: 'fridge',
        title: 'Камера холодильника',
        range: [2, 6],
        label: '+2…+6 °C',
        text: 'Обычная температура камеры — для справки, чтобы видеть, где лежат продукты.',
        reference: true,
      },
    ],
  },

  serve: {
    eyebrow: 'ПОДАЧА',
    title: 'С чем подают икру',
    paragraphs: [
      'Икру подают охлаждённой, ложкой из перламутра, кости или нержавеющей ' +
        'стали — серебро даёт привкус. Классика — тёплые блины, тост со сливочным ' +
        'маслом, яйцо, устрицы. Ниже — как подают нашу икру в ресторанах, ' +
        'с которыми мы работаем.',
    ],
    railLabel: 'Подача икры',
    items: [
      { media: m.bliniTin, caption: 'Блины и банка на льду' },
      { media: m.silverDishToasts, caption: 'Тосты со сливочным маслом' },
      { media: m.eggCaviar, caption: 'Яйцо с икрой' },
      { media: m.oystersPlatter, caption: 'Устрицы' },
      { media: m.benedictCaviar, caption: 'Яйца бенедикт' },
      { media: m.pastaCaviar, caption: 'Паста' },
    ],
  },

  guests: {
    eyebrow: 'СКОЛЬКО ВЗЯТЬ',
    title: 'Икра на ваш стол',
    labelGuests: 'Гостей',
    labelFormat: 'Подача',
    decrease: 'Меньше гостей',
    increase: 'Больше гостей',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: граммы на гостя. */
    formats: [
      { key: 'taste', label: 'Попробовать', note: '15 г на гостя', grams: 15 },
      { key: 'starter', label: 'Закуска', note: '30 г', grams: 30 },
      { key: 'main', label: 'Главное блюдо', note: '50 г', grams: 50 },
    ],
    defaults: { guests: 6, format: 'starter' },
    min: 1,
    max: 50,
    /*   — неразрывный пробел: строки собираются в браузере. */
    result: '{g} г икры',
    pack: 'Например: {packs}',
    packUnit: ' г',
    note: 'Нормы — ориентир. Точнее подскажем по телефону.',
    action: { label: 'Выбрать фасовку', href: ROUTES.category('chernaya-ikra') },
    /* Фасовки из учёта и фильтры фасовки раздела чёрной икры
       (src/data/catalog.js → fasovka-50, -113, -250). */
    packs: caviarPacks,
    filters: [50, 113, 250],
    jarsLabel: 'Банки в масштабе',
  },

  next: [ROUTES.delivery, ROUTES.brands, ROUTES.faq],
}
