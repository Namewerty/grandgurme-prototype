/**
 * /partners — «Ресторанам и отелям». Посадочная страница: сюда ведут реклама
 * и рассылки на рестораны, отели и кейтеринг. Цель — заявка на дегустацию.
 *
 * Состав блоков — src/info/pages/partners.js, тексты — здесь.
 *
 * Сегменты. Адрес с ?segment=restaurant|hotel|catering|aviation заранее
 * выбирает тип заведения в форме и меняет вторую строку первого экрана
 * на строку сегмента (hero.segments). Реклама по сегментам ведёт на один
 * адрес с разным параметром.
 */

import { contacts } from '../nav.js'
import { ROUTES } from '../routes.js'
import { caviarLines } from '../caviar-lines.js'
import { SHOW_COLLAB_NAMES, SHOW_PARTNER_NAMES } from './flags.js'
import { img, infoMedia as m, infoShot } from './media.js'
import { countOf, positions } from './counts.js'

/** Фасовки икры из учёта: веса всех линеек без повторов, от малой к большой. */
export const caviarPacks = [...new Set(caviarLines.flatMap((line) => line.packs))].sort((a, b) => a - b)

export const partnersPage = {
  hero: {
    eyebrow: 'РЕСТОРАНАМ И ОТЕЛЯМ',
    /* Запасные H1: «Икра и рыба для вашего меню»,
       «Чёрная икра с Каспия для ресторанов и отелей». */
    title: ['Икра №1 Caviar', 'для ресторанной кухни'],
    titleAlternatives: ['Икра и рыба для вашего меню', 'Чёрная икра с Каспия для ресторанов и отелей'],
    lead:
      'Поставляем ресторанам, отелям и кейтерингу забойную икру с Каспия, ' +
      'рыбу Siberian Luxury Bar и европейскую гастрономию. Привезём образцы ' +
      'на дегустацию и посчитаем порцию под ваше меню.',
    /* Строка сегмента вместо lead при ?segment=… */
    segments: {
      restaurant: 'Слепая дегустация на вашей кухне и расчёт порции под подачу.',
      hotel: 'Икра и рыба для завтраков, банкетов, room service и лаунжа.',
      catering: 'Расчёт икорного сета на ваше мероприятие и число гостей.',
      aviation: 'Небольшие фасовки икры для бортового питания.',
    },
    actions: [
      { label: 'Заказать дегустацию', href: '#request', kind: 'solid' },
      { label: 'Написать в Telegram', href: contacts.telegram, kind: 'line', external: true },
    ],
    facts: [
      { value: '300', label: 'ресторанов и отелей в мире' },
      { value: 'с 1982', label: 'работаем' },
      { value: '50–1000 г', label: 'фасовки икры' },
    ],
    media: m.chefKiloTin,
  },

  /** Липкая кнопка: появляется после первого экрана, прячется у формы и у подвала. */
  sticky: { label: 'Заказать дегустацию', href: '#request' },

  where: {
    eyebrow: 'ГДЕ НАС ПОДАЮТ',
    title: 'Москва, Дубай, Нью-Йорк, Лас-Вегас и курорты Европы',
    note:
      'Икру №1 Caviar подают в 300 ресторанах и отелях мира. Наведите на ' +
      'город, чтобы узнать, где именно.',
    points: ['las-vegas', 'miami', 'new-york', 'europe', 'moscow', 'dubai'],
    /* Лента подач под осью. Порядок из задания; кадр вечера с названием
       заведения — восьмым и только при SHOW_PARTNER_NAMES. */
    reel: [
      m.scallopSmoke,
      m.tartarePearlSpoon,
      m.caviarCake,
      m.benedictCaviar,
      m.oystersPlatter,
      m.blueDish,
      m.violetDish,
      ...(SHOW_PARTNER_NAMES
        ? [infoShot('partners', 'event-night', 'Вечер со световой надписью №1 Caviar', '960:1280')]
        : []),
      m.bliniTin,
      m.canapesTray,
      m.redCaviarOyster,
      m.silverDishToasts,
      m.pastaCaviar,
    ],
    reelLabel: 'Как подают нашу икру в ресторанах и отелях',
  },

  tasting: {
    eyebrow: 'ДЕГУСТАЦИЯ',
    title: 'Привезём шесть позиций на вашу кухню',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: состав сета, время визита и возможность
       слепой дегустации. */
    text:
      'Приедем между сменами, с 15:00 до 17:00, и привезём сет: четыре ' +
      'линейки икры, нельму нежно подвяленную и клыкача холодного копчения. ' +
      'Можно провести дегустацию вслепую — рядом с продуктом, которым вы ' +
      'пользуетесь сейчас.',
    action: { label: 'Заказать дегустацию', href: '#request' },
    boardLabel: 'Дегустационный сет',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: рекомендации к подаче от шефа или технолога —
       вторая фраза карточки у четырёх линеек икры. */
    items: [
      {
        title: 'Белуга Премиум',
        text: 'Зерно 3,5 мм, сливочный вкус, икра тает во рту. Для подачи, где икра — главное на тарелке.',
        media: img('/media/alt2/types/tin-beluga-premium.jpg', 'Банка икры Белуга Премиум'),
      },
      {
        title: 'Осётр персидский',
        text: 'Зерно 2,8–3,5 мм, ореховый привкус и насыщенный аромат. Держит форму в горячих блюдах: паста, яйцо, картофель.',
        media: img('/media/alt2/types/tin-osetr-persidskiy.jpg', 'Банка икры Осётр персидский'),
      },
      {
        title: 'Осётр Премиум STURGEON',
        text: 'Зерно 2,8–3,5 мм, бархатистая текстура. Для канапе и банкетных сетов.',
        media: img('/media/alt2/types/tin-osetr-premium-sturgeon.jpg', 'Банка икры Осётр Премиум STURGEON'),
      },
      {
        title: 'Севрюга',
        text: 'Зерно 2,5 мм. Для тартаров, устриц и небольших закусок.',
        media: img('/media/alt2/types/tin-sevruga.jpg', 'Банка икры Севрюга'),
      },
      {
        title: 'Нельма нежно подвяленная',
        text: 'Северная рыба со светлым мясом и сливочным вкусом. Её редко встретишь в меню.',
        media: img('/media/nav/ryba-vyalenaya-sushenaya.jpg', 'Нельма нежно подвяленная'),
      },
      {
        title: 'Клыкач холодного копчения',
        text: 'Нежная маслянистая текстура и лёгкий аромат дымка.',
        media: img('/media/nav/ryba-holodnoe-kopchenie.jpg', 'Клыкач холодного копчения'),
      },
    ],
  },

  portion: {
    eyebrow: 'ЭКОНОМИКА ПОДАЧИ',
    title: 'Сколько порций в банке',
    text:
      'Большая банка выгодна, когда икра уходит за вечер. Если подача редкая, ' +
      'фасовка 50 или 113 г снижает списания: открытую банку съедают ' +
      'за двое-трое суток.',
    labelPack: 'Фасовка',
    labelPortion: 'Порция',
    labelPrice: 'Ваша цена за килограмм, ₽ (необязательно)',
    /* {n}, {word}, {p}, {r}, {c} подставляет блок; слово «порция» склоняется.
         — неразрывный пробел между числом и единицей: строки собираются
       в браузере, типограф сборки (src/info/render.js) до них не доходит. */
    result: '{n} {word} по {p} г',
    words: ['порция', 'порции', 'порций'],
    rest: 'и {r} г остаётся',
    cost: 'Себестоимость порции — {c}',
    note: 'Оптовый прайс для заведений пришлём после дегустации.',
    packs: caviarPacks,
    portions: [10, 15, 20, 30, 50],
    defaults: { pack: 125, portion: 20 },
    /* Больше стольких секторов банка рисуется сплошной заливкой с числом. */
    maxSectors: 60,
    unit: 'г',
    jarLabel: 'Банка сверху, поделённая на порции',
  },

  range: {
    eyebrow: 'АССОРТИМЕНТ ДЛЯ КУХНИ',
    title: 'Что поставляем',
    items: [
      {
        num: '01',
        title: 'Икра №1 Caviar',
        note: `${caviarLines.length} линеек · 50–1000 г`,
        text:
          'Белуга, осётр, севрюга и икра гибрида белуги и стерляди. Зерно от 2,5 ' +
          'до 4 мм и крупнее. Вся икра забойная, из Азербайджана.',
        media: img('/media/caviar/caviar-beluga-detail.jpg', 'Икра белуги крупным планом'),
        href: `${ROUTES.brands}#caviar`,
      },
      {
        num: '02',
        title: 'Рыба Siberian Luxury Bar',
        note: 'пласт в вакууме',
        text:
          'Лосось холодного копчения — классический, с апельсином и с укропом, ' +
          'лосось слабой соли и нежно подвяленный, нельма, клыкач.',
        media: img('/media/alt2/origin/fish-posol.jpg', 'Рыба Siberian Luxury Bar после посола'),
        href: `${ROUTES.brands}#fish`,
      },
      {
        num: '03',
        title: 'Красная икра',
        note: positions(countOf('krasnaya-ikra')),
        // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: описание ассортимента
        text: 'Икра лососёвых рыб в банках разного веса.',
        media: img('/media/alt2/hero/hero-krasnaya-ikra.jpg', 'Красная икра в раковине устрицы'),
        href: ROUTES.category('krasnaya-ikra'),
      },
      {
        num: '04',
        title: 'Крабы и морепродукты',
        note: positions(countOf('kraby-i-moreprodukty')),
        // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: описание ассортимента
        text: 'Крабы и морепродукты для холодных закусок и горячих блюд.',
        media: img('/media/alt2/hero/hero-moreprodukty.jpg', 'Устрицы с икрой и закуски'),
        href: ROUTES.category('kraby-i-moreprodukty'),
      },
      {
        num: '05',
        title: 'Европейская гастрономия',
        note: 'более 50 брендов',
        text:
          'Масла, соусы, специи, сладости и снеки европейских марок, которых ' +
          'нет на российском рынке.',
        media: img('/media/brand/boutique-main.jpg', 'Полки бутика с европейской гастрономией'),
        href: ROUTES.catalog,
      },
    ],
  },

  segments: {
    eyebrow: 'ДЛЯ КОГО',
    title: 'Ресторан, отель, кейтеринг, борт',
    more: 'Оставить заявку',
    items: [
      {
        title: 'Рестораны',
        text:
          'Подберём линейку под подачу и посчитаем себестоимость порции. Икра ' +
          'в меню каждый день или по сезону — фасовку подбираем под расход.',
        media: m.pastaCaviar,
        segment: 'restaurant',
      },
      {
        title: 'Отели',
        text: 'Один договор на ресторан, завтраки, банкеты, room service и лаунж.',
        media: m.benedictCaviar,
        segment: 'hotel',
      },
      {
        title: 'Кейтеринг',
        text:
          'Расчёт икорного сета на мероприятие и число гостей. Работаем под смету ' +
          'конкретного события.',
        media: m.canapesTray,
        segment: 'catering',
      },
      {
        title: 'Бизнес-авиация и яхты',
        text: 'Небольшие фасовки для борта и яхты.',
        media: m.businessJet,
        segment: 'aviation',
      },
    ],
  },

  docs: {
    eyebrow: 'ДОКУМЕНТЫ',
    title: 'Каждая поставка с полным пакетом документов',
    text: 'Пакет документов передаём на первой встрече, до первой поставки.',
    action: { label: 'Что подтверждает каждый документ', href: ROUTES.documents },
    rows: [
      {
        label: 'ФГИС «Меркурий»',
        value:
          'Электронный ветеринарный документ на каждую отгрузку — вам остаётся ' +
          'погасить его при приёмке',
      },
      { label: '«Честный знак»', value: 'Коды маркировки каждой банки передаём в УПД' },
      { label: 'СИТЕС', value: 'Разрешение на каждую ввезённую партию осетровой икры' },
      { label: 'ТР ЕАЭС 040/2016', value: 'Декларация о соответствии на рыбную продукцию' },
      { label: 'ЭДО', value: null }, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: оператор ЭДО
    ],
  },

  start: {
    eyebrow: 'КАК НАЧИНАЕМ',
    title: 'От заявки до регулярных поставок',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: срок первого ответа, пробная партия,
       закреплённый менеджер. */
    items: [
      { title: 'Заявка', text: 'Оставьте контакты. Менеджер свяжется, уточнит кухню и формат подачи.' },
      { title: 'Дегустация', text: 'Привозим сет на вашу кухню, считаем порцию и себестоимость.' },
      { title: 'Пробная поставка', text: 'Небольшая партия под первое меню.' },
      {
        title: 'Регулярные поставки',
        text: 'График под ваш расход, прайс для заведений и один менеджер на все вопросы.',
      },
    ],
  },

  terms: {
    eyebrow: 'УСЛОВИЯ',
    title: 'Условия для заведений',
    fallback:
      'Цены и условия для заведений отличаются от розничных. Пришлём прайс ' +
      'и условия поставки после дегустации.',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: все шесть строк. Строка с null не выводится,
       пока все null — блок показывает fallback. */
    rows: [
      { label: 'Прайс для заведений', value: null },
      { label: 'Минимальный заказ', value: null },
      { label: 'Отсрочка платежа', value: null },
      { label: 'Доставка по Москве', value: null },
      { label: 'Регионы', value: null },
      { label: 'Оплата', value: null },
    ],
  },

  /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: согласие правообладателей и описание
     коллабораций. Блок выводится только при SHOW_COLLAB_NAMES: при false
     сборщик выбрасывает строки и кадр из бандла целиком. */
  collab: SHOW_COLLAB_NAMES
    ? {
        eyebrow: 'КОЛЛАБОРАЦИИ',
        title: '№1 Caviar × Giorgio Armani, №1 Caviar × Jacob & Co',
        paragraphs: [
          'Совместные подарочные шкатулки и вечера с брендами, для которых ' +
            'важна та же подача, что и для нас.',
        ],
        media: infoShot('collab', 'jacob-co-box', 'Подарочная шкатулка коллаборации с банкой икры №1 Caviar', '1600:1066'),
        side: 'right',
      }
    : null,

  request: {
    form: 'partners',
    eyebrow: 'ЗАЯВКА',
    title: 'Заказать дегустацию',
    text: 'Оставьте контакты — менеджер свяжется и договорится о времени.',
    submit: 'Отправить заявку',
    success: 'Спасибо, заявка у нас. Менеджер свяжется с вами в рабочее время.',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: контакт отдела продаж для заведений
       (в презентации — v.eloev@grandgurme.ru и Telegram @grand_gurme).
       Пока в колонке «Или напишите сами» — общие контакты из nav.js
       и общая почта business@grandgurme.ru. */
    fields: [
      { name: 'name', label: 'Как к вам обращаться', type: 'text', required: true, autocomplete: 'name' },
      { name: 'venue', label: 'Заведение или компания', type: 'text', required: true, autocomplete: 'organization' },
      { name: 'city', label: 'Город', type: 'text', required: true, autocomplete: 'address-level2' },
      {
        name: 'role',
        label: 'Ваша роль',
        type: 'select',
        options: ['Шеф-повар', 'Закупки', 'F&B-менеджер', 'Владелец', 'Другое'],
      },
      {
        name: 'segment',
        label: 'Тип заведения',
        type: 'chips',
        single: true,
        options: [
          { value: 'restaurant', label: 'Ресторан' },
          { value: 'hotel', label: 'Отель' },
          { value: 'catering', label: 'Кейтеринг' },
          { value: 'aviation', label: 'Бизнес-авиация или яхта' },
          { value: 'other', label: 'Другое' },
        ],
      },
      {
        name: 'interest',
        label: 'Что интересует',
        type: 'chips',
        options: ['Дегустация', 'Прайс', 'Икра', 'Рыба', 'Европейская гастрономия'],
      },
      { name: 'contact', label: 'Телефон или Telegram', type: 'text', required: true, autocomplete: 'tel' },
      { name: 'comment', label: 'Комментарий', type: 'textarea' },
    ],
  },

  next: [ROUTES.documents, ROUTES.brands, ROUTES.corporate],
}
