/**
 * Каталог: категории верхнего уровня и их подкатегории.
 *
 * Это источник правды сразу для трёх вещей:
 *   1. каталожная панель в шапке (src/js/nav/catalog-panel.js);
 *   2. адреса страниц категорий /catalog/<slug> — по ним генерируются
 *      html-заглушки (scripts/build-pages.mjs);
 *   3. карта сайта /sitemap.
 *
 * ДЕРЕВО СОБРАНО ПО ВЫГРУЗКЕ ИЗ 1С от 20.08.2026 (инфоблок «Товары 1С»,
 * IBLOCK_ID=4: 11 разделов, 24 подраздела, 918 товаров) и БОЛЬШЕ НЕ
 * ПРЕДВАРИТЕЛЬНОЕ. Придуманных разделов здесь не осталось: сыры, десерты,
 * трюфели, европейские бренды и новинки из прежней сборки в ассортименте
 * не существуют.
 *
 * ЭТО ВИТРИНА, А НЕ КОПИЯ 1С. Учётное дерево собрано под товароведа, поэтому
 * четыре расхождения сделаны сознательно:
 *
 *   1. «Икра» разделена на «Чёрную» и «Красную»: чёрная — флагман с
 *      собственной страницей и фасетами, держать её фильтром внутри общей
 *      «Икры» нельзя. «Другая икра» (2 позиции) ушла подкатегорией
 *      к красной: на верхний уровень две позиции не тянут, а по смыслу
 *      это соседи лососёвой икры, а не осетровой.
 *   2. «Подарочные наборы» в 1С лежат ВНУТРИ «Икры». На витрине вынесены
 *      наверх: подарки собирают не только из икры.
 *   3. Три мелких раздела 1С — «Чипсы, снеки, сухарики» (31),
 *      «Хлеб и выпечка» (5, внутри «Крекеры» 4) и «Орехи, сухофрукты» (2) —
 *      собраны в один раздел «Снеки и орехи» (38). Три строки по две-пять
 *      позиций в панели читаются как недоделанный каталог.
 *   4. «Вода, соки, напитки» (в выгрузке — только соки) и «Чай, кофе, какао»
 *      (в выгрузке — только чай) собраны в «Напитки» (64). Названия
 *      разделов 1С шире их содержимого: ни воды, ни кофе, ни какао в
 *      ассортименте нет, и обещать их названием раздела нечестно.
 *
 * Названия причёсаны: 1С пишет «Рыба вяленная, сушенная» с ошибкой и
 * «Рыба слабосоленая» без «ё» — на витрине они грамотные.
 *
 * code1c — код раздела в 1С, ключ будущей интеграции. У двух собранных
 * разделов («Снеки и орехи», «Напитки») своего кода нет и быть не может:
 * они склеены из нескольких, и сопоставление идёт по кодам подкатегорий.
 * Именно поэтому code1c продублирован на каждой подкатегории.
 *
 * ⚠ SLUG'и ПОДКАТЕГОРИЙ ПОПАДАЮТ В ИМЕНА ФАЙЛОВ ФОТОГРАФИЙ
 * (/media/nav/<категория>-<подкатегория>.jpg). Дерево подтверждено выгрузкой,
 * поэтому слаги ниже — окончательные, и съёмку панели можно планировать.
 *
 * Своей страницы у подкатегории нет: ссылка ведёт на страницу категории
 * с параметром ?sub=<slug>. Это фильтр внутри категории, а не отдельный
 * раздел, поэтому в карте сайта своего адреса у неё нет.
 *
 * icon — ключ из src/js/icons.js (набор cat*).
 */

export const NAV_MEDIA_ROOT = '/media/nav'

/** Путь к кадру подкатегории в каталожной панели. */
export const navImage = (categorySlug, subSlug) =>
  `${NAV_MEDIA_ROOT}/${categorySlug}-${subSlug}.jpg`

/**
 * Кадр плитки: свой (sub.image — пэкшоты банок чёрной икры) или ожидаемый
 * кадр съёмки панели. Панель и список съёмки берут путь только отсюда.
 */
export const tileImage = (category, sub) => sub.image || navImage(category.slug, sub.slug)

/* Пэкшоты банок линеек чёрной икры — те же файлы, что поле tin
   в src/data/caviar-lines.js (public/media/alt2/types/). */
const tin = (line) => `/media/alt2/types/tin-${line}.jpg`

/**
 * Пропорция карточек в панели. Близко к квадрату, но чуть ниже: два ряда
 * карточек 1:1 не помещались в отведённые панели две трети экрана.
 * Файлы просим квадратные — CSS обрежет их по этой пропорции сам.
 */
export const NAV_CARD_RATIO = '4:3'

/**
 * Сколько подкатегорий показывает каталожная панель: два ряда по четыре.
 *
 * Панель — витрина, а не полный список. Третий ряд карточек выводит её
 * за отведённые две трети экрана и включает внутренний скролл, поэтому
 * категории с девятью и более подкатегориями показывают первые восемь,
 * а остальные живут на странице раздела — ссылка на неё стоит прямо
 * под сеткой. После выгрузки таких категорий не осталось: самая длинная —
 * чёрная икра, ровно восемь.
 *
 * Из этого следует, что ПОРЯДОК подкатегорий в списках ниже значим:
 * первыми должны стоять те, за которыми приходят. По этому же числу
 * обрезается перечень кадров для съёмки (scripts/media-list.mjs):
 * фотографировать то, что панель не покажет, незачем.
 *
 * ПЛИТКИ ПАНЕЛИ С 29.09.2026. Плиток по весу и фасовке нет ни в одном
 * разделе. Подкатегория здесь — плитка панели и сохранённый фильтр
 * (subFilters в src/data/facets.js), а не обязательно подраздел 1С:
 * у красной икры и видов рыбы code1c нет. Поля плитки:
 *   image  свой кадр вместо /media/nav/<раздел>-<плитка>.jpg (tileImage);
 *   line   slug линейки в caviar-lines.js (или массив) — под названием зерно;
 *   group  четвёрка с подписью (category.groups), сейчас только у рыбы.
 * category.tile: 'pack' — кадры раздела вписываются целиком на светлую
 * подложку (пэкшоты банок на белом), а не кадрируются.
 */
export const PANEL_MAX_CARDS = 8

export const categories = [
  {
    slug: 'chernaya-ikra',
    name: 'Чёрная икра',
    icon: 'catCaviarBlack',
    code1c: 'ikra_chernaya',
    lead:
      'Осетровая икра: девять линеек, шесть фасовок от 50 г до килограмма, ' +
      'банка металл, банка стекло и паюсная в пакете.',
    /* ПЛИТКИ — ПО ЛИНЕЙКАМ (29.09.2026). Виды (белуга, осётр…) и фасовки
       из панели убраны: виды на странице раздела и так стоят первой строкой
       капсул, фасовка — пилюлей. Линеек девять, мест в панели восемь,
       поэтому обе севрюги — зернистая и паюсная — одной карточкой.
       Каждая плитка — правило grade в subFilters (src/data/facets.js);
       прежние ссылки ?sub=beluga, ?sub=fasovka-50 и т. д. там оставлены
       рабочими, в панели их нет.
       Кадр — пэкшот банки линейки на белом фоне (tile: 'pack': вписан
       целиком на ровную светлую подложку), под названием — размер зерна
       из caviar-lines.js (line — slug линейки там). */
    tile: 'pack',
    subs: [
      { slug: 'beluga-royal', name: 'Белуга Роял', line: 'beluga-royal', image: tin('beluga-royal') },
      { slug: 'beluga-diamond', name: 'Белуга Даймонд', line: 'beluga-diamond', image: tin('beluga-diamond') },
      { slug: 'beluga-premium', name: 'Белуга Премиум', line: 'beluga-premium', image: tin('beluga-premium') },
      {
        slug: 'beluga-sterlyad-selected',
        name: 'Белуга и стерлядь SELECTED',
        line: 'beluga-sterlyad-selected',
        image: tin('beluga-sterlyad-selected'),
      },
      { slug: 'osetr-persidskiy', name: 'Осётр персидский', line: 'osetr-persidskiy', image: tin('osetr-persidskiy') },
      {
        slug: 'osetr-russkiy-premium',
        name: 'Осётр русский Премиум',
        line: 'osetr-russkiy-premium',
        image: tin('osetr-russkiy-premium'),
      },
      {
        slug: 'osetr-premium-sturgeon',
        name: 'Осётр Премиум STURGEON',
        line: 'osetr-premium-sturgeon',
        image: tin('osetr-premium-sturgeon'),
      },
      /* Обе севрюги одной плиткой: под названием — зерно обеих линеек. */
      { slug: 'sevruga', name: 'Севрюга', line: ['sevruga', 'sevruga-payusnaya'], image: tin('sevruga') },
    ],
  },
  {
    slug: 'krasnaya-ikra',
    name: 'Красная икра',
    icon: 'catCaviarRed',
    code1c: 'ikra_krasnaya',
    lead: 'Лососёвая икра и другие виды икры, кроме осетровой.',
    /* Под заказ: то, чего нет на складе, можно оплатить и получить через
       PREORDER_DAYS дней. Действует на весь раздел, включая «Другую икру».
       У разделов без этого поля отсутствие на складе означает заявку
       менеджеру (kindOf в src/data/fulfillment.js). */
    fulfillment: 'preorder',
    /* ПЛИТКИ — ПО ВИДУ РЫБЫ (29.09.2026). Карточка «Другая икра» (подраздел
       1С) убрана: в снимке стенда под ней нет ни одной позиции. Вместо неё —
       виды, которые реально есть у позиций раздела (ось species в
       redCaviarSchema), по убыванию числа позиций в снимке от 22.09.2026:
       кета 5 · горбуша 3 · кижуч 3 · нерка 1 (при равенстве — порядок оси).
       Правило каждой — species в subFilters (src/data/facets.js).
       Фотографий под виды нет: панель рисует карточку-заглушку (название
       крупно, число позиций мелко), ожидаемые кадры — в navImageList. */
    subs: [
      { slug: 'keta', name: 'Кета' },
      { slug: 'gorbusha', name: 'Горбуша' },
      { slug: 'kizhuch', name: 'Кижуч' },
      { slug: 'nerka', name: 'Нерка' },
    ],
  },
  {
    slug: 'ryba',
    name: 'Рыба',
    fulfillment: 'preorder', // см. «Красную икру» выше
    icon: 'catFish',
    code1c: 'ryba',
    lead: 'Холодное и горячее копчение, слабосолёная, вяленая и сушёная.',
    /* ДВЕ ЧЕТВЁРКИ С ПОДПИСЯМИ (29.09.2026, groups ниже).
       Первая — способ приготовления: РОВНО четыре подраздела 1С, порядок
       по числу позиций в выгрузке: 47 · 35 · 22 · 17.
       Вторая — четыре вида рыбы с наибольшим числом позиций в снимке
       (ось species в fishSchema, attrs.species позиций): лосось 7 · форель 3 ·
       палтус 3 · нерка 2 (осётр — 1 позиция, в четвёрку не вошёл). Оси
       «Вид рыбы» в 1С нет — вид собран из названий товаров, поэтому список
       пересчитывается по данным при каждой новой выгрузке.
       Кадров видов нет — карточки-заглушки, пути — в navImageList. */
    groups: [
      { key: 'processing', label: 'Способ приготовления' },
      { key: 'species', label: 'Вид рыбы' },
    ],
    subs: [
      {
        slug: 'holodnoe-kopchenie',
        name: 'Холодного копчения',
        code1c: 'ryba_kholodnogo_kopcheniya',
      },
      { slug: 'slabosolenaya', name: 'Слабосолёная', code1c: 'ryba_slabosolenaya_' },
      {
        slug: 'vyalenaya-sushenaya',
        name: 'Вяленая и сушёная',
        code1c: 'ryba_vyalennaya_sushennaya',
      },
      {
        slug: 'goryachee-kopchenie',
        name: 'Горячего копчения',
        code1c: 'ryba_goryachego_kopcheniya',
      },
      { slug: 'losos', name: 'Лосось', group: 'species' },
      { slug: 'forel', name: 'Форель', group: 'species' },
      { slug: 'paltus', name: 'Палтус', group: 'species' },
      { slug: 'nerka', name: 'Нерка', group: 'species' },
    ],
  },
  {
    slug: 'kraby-i-moreprodukty',
    name: 'Крабы и морепродукты',
    icon: 'catCrab',
    code1c: 'moreprodukty_kraby',
    lead: 'Крабовое мясо и морепродукты — небольшой отобранный раздел.',
    /* Подразделов в 1С нет, и придумывать их нельзя: на семь позиций деление
       по видам всё равно не нужно. Панель показывает описание раздела. */
    subs: [],
  },
  {
    slug: 'bakaleya',
    name: 'Бакалея и консервы',
    icon: 'catGrocery',
    code1c: 'bakaleya_konservatsiya',
    lead:
      'Масла, соусы и специи, мёд и варенье, оливки, каперсы, консервы — ' +
      'то, что стоит рядом с деликатесом.',
    subs: [
      { slug: 'masla-sousy-spetsii', name: 'Масла, соусы, специи', code1c: 'maslo_sousy_spetsii' },
      {
        slug: 'med-varenye-siropy',
        name: 'Мёд, варенье, сиропы',
        code1c: 'myed_varene_dzhemy_siropy',
      },
      { slug: 'olivki-masliny', name: 'Оливки и маслины', code1c: 'olivki_i_masliny' },
      {
        slug: 'adzhika-hren-gorchitsa',
        name: 'Аджика, хрен, горчица',
        code1c: 'adzhika_khren_gorchitsa',
      },
      { slug: 'kapersy-artishoki', name: 'Каперсы и артишоки', code1c: 'kapersy_i_artishoki' },
      { slug: 'mayonez-ketchup', name: 'Майонез и кетчуп', code1c: 'mayonez_ketchup' },
      { slug: 'ovoshchnye-konservy', name: 'Овощные консервы', code1c: 'ovoshchnye_konservy' },
    ],
  },
  {
    slug: 'sladosti',
    name: 'Печенье и сладости',
    icon: 'catDessert',
    code1c: 'pechene_torty_sladosti',
    lead: 'Печенье и вафли, шоколад и конфеты, мармелад, зефир и пастила.',
    /* Раздел 1С называется «Печенье, торты, сладости», но тортов в нём нет
       ни одного — ни в подразделах, ни в самом разделе. Название витрины
       обещает только то, что есть. */
    subs: [
      { slug: 'pechenye-vafli', name: 'Печенье и вафли', code1c: 'pechene_vafli' },
      { slug: 'shokolad-konfety', name: 'Шоколад и конфеты', code1c: 'shokolad_konfety' },
      {
        slug: 'marmelad-zefir-pastila',
        name: 'Мармелад, зефир, пастила',
        code1c: 'marmelad_zefir_pastila_ledentsy',
      },
    ],
  },
  {
    slug: 'sneki',
    name: 'Снеки и орехи',
    icon: 'catSnack',
    /* Собран из трёх разделов 1С, своего кода нет — см. шапку файла. */
    code1c: null,
    lead: 'Чипсы и сухарики, хлеб и крекеры, орехи и сухофрукты.',
    subs: [
      { slug: 'chipsy-sukhariki', name: 'Чипсы и сухарики', code1c: 'chipsy_sneki_sukhariki' },
      { slug: 'hleb-krekery', name: 'Хлеб и крекеры', code1c: 'khleb_i_vypechka' },
      { slug: 'orehi-suhofrukty', name: 'Орехи и сухофрукты', code1c: 'orekhi_sukhofrukty' },
    ],
  },
  {
    slug: 'napitki',
    name: 'Напитки',
    icon: 'catDrink',
    /* Собран из двух разделов 1С, своего кода нет — см. шапку файла. */
    code1c: null,
    lead: 'Соки, морсы и смузи, листовой чай.',
    subs: [
      { slug: 'soki-morsy-smuzi', name: 'Соки, морсы, смузи', code1c: 'soki_morsy_smuzi' },
      { slug: 'chay', name: 'Чай', code1c: 'chay' },
    ],
  },
  {
    slug: 'podarochnye-nabory',
    name: 'Подарочные наборы',
    icon: 'catGift',
    code1c: 'podarochnye_nabory',
    lead: 'Готовые наборы к празднику и в подарок.',
    /* Подразделов в 1С нет: на две позиции их и не нужно. Подборка подарков
       по поводу и бюджету живёт на отдельной странице /gifts. */
    subs: [],
  },
  {
    slug: 'tovary-dlya-doma',
    name: 'Товары для дома',
    icon: 'catHome',
    code1c: 'tovary_dlya_doma',
    lead: 'Средства для стирки и посуды, ароматы для дома.',
    /* Раздел настоящий (41 позиция) и убрать его нельзя, но тон витрины
       премиальной гастрономии он ломает, поэтому стоит последним и в панели,
       и в решётке «Не только икра», и в подвале. */
    subs: [
      { slug: 'stirka-sushka', name: 'Для стирки и сушки', code1c: 'dlya_stirki_i_sushki' },
      { slug: 'aromaty-dlya-doma', name: 'Ароматы для дома', code1c: 'aromaty_dlya_doma' },
      { slug: 'sredstva-dlya-posudy', name: 'Средства для посуды', code1c: 'sredstva_dlya_posudy' },
    ],
  },
]

/**
 * Категория, открытая в панели по умолчанию, до наведения на список.
 * Чёрная икра — флагманский продукт, он встречает первым.
 */
export const defaultCategorySlug = 'chernaya-ikra'

/**
 * Витрины: страницы, собранные из нескольких разделов (22.09.2026).
 *
 * «Икра» — быстрый вход из шапки: чёрная и красная икра на одной странице
 * по адресу /catalog/ikra, шаблон тот же, что у страниц разделов. Разделом
 * каталога витрина НЕ становится: в categories записи нет, поэтому её нет
 * в каталожной панели, в подвале, на /catalog и в карте разделов. В карте
 * сайта она есть как страница.
 *
 *   from        разделы, из которых собираются позиции, в порядке показа;
 *   typeLabels  подпись раздела для оси «Икра» (attrs.type у копии позиции,
 *               см. getProducts в catalog-products.js).
 *
 * Вид позиции (под заказ или заявка) считается по разделу самой позиции,
 * а не по витрине: у красной икры предзаказ есть, у чёрной нет.
 */
export const showcases = [
  {
    slug: 'ikra',
    name: 'Икра',
    icon: 'catCaviarBlack',
    lead: 'Чёрная и красная икра на одной странице.',
    from: ['chernaya-ikra', 'krasnaya-ikra'],
    typeLabels: { 'chernaya-ikra': 'Чёрная', 'krasnaya-ikra': 'Красная' },
  },
]

/**
 * Подборки в правой колонке панели. Своих разделов у них нет: «Хиты продаж» —
 * фильтр каталога, «Подарочные наборы» — существующая категория.
 *
 * ⚠ СОСТАВ ПОДБОРКИ «ХИТЫ ПРОДАЖ» ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ: статистики продаж
 * в выгрузке нет. Прежняя вторая подборка вела на раздел «Новинки», которого
 * в ассортименте не существует, — заменена подарками.
 */
export const collections = [
  {
    slug: 'hits',
    title: 'Хиты продаж',
    text: 'Что чаще всего заказывают в бутиках',
    href: '/catalog?collection=hits',
    image: `${NAV_MEDIA_ROOT}/collection-hits.jpg`,
    ratio: '3:2',
  },
  {
    slug: 'gifts',
    title: 'Подарочные наборы',
    text: 'Готовые наборы к празднику и в подарок',
    href: '/catalog/podarochnye-nabory',
    image: `${NAV_MEDIA_ROOT}/collection-gifts.jpg`,
    ratio: '3:2',
  },
]

/** Нижняя строка панели. */
export const catalogPanelFooter = {
  main: { label: 'Открыть весь каталог', href: '/catalog' },
  quick: [
    { label: 'Чёрная икра', href: '/catalog/chernaya-ikra' },
    { label: 'Подарки', href: '/gifts' },
  ],
}

/** Ссылка на подкатегорию: фильтр внутри страницы категории. */
export const subHref = (categorySlug, subSlug) =>
  `/catalog/${categorySlug}?sub=${subSlug}`

/** Плоский список всех ожидаемых кадров панели — для README и проверок. */
export function navImageList() {
  const list = []

  categories.forEach((category) => {
    category.subs.forEach((sub) => {
      list.push({
        path: tileImage(category, sub),
        alt: `${category.name} — ${sub.name}`,
      })
    })
  })

  collections.forEach((collection) => {
    list.push({ path: collection.image, alt: collection.title })
  })

  return list
}
