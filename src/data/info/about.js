/**
 * /about — «О компании». Состав блоков — src/info/pages/about.js.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА:
 *   — основатели и история по годам, если компания захочет именную историю;
 *   — документ, подтверждающий 1982 год;
 *   — бутик на Софийской набережной открыт или открывается: в презентации —
 *     «открываем весной 2026», на действующем сайте — адрес и часы работы.
 */

import { ROUTES } from '../routes.js'
import { brand } from '../brand.js'
import { pickupPoints } from '../offline.js'
import { img, infoMedia as m } from './media.js'
import { companyDetails, companyRows } from './company-details.js'

/** «50+» → значение 50 и хвостик «+», «1982» — без отсчёта: бегущие
    «0 → 1982» читаются как сломанный счётчик (правило #proof). */
const toFact = ({ value, label }) => {
  const match = String(value).match(/^([\d\s,]+)(\D*)$/)
  const num = match ? match[1] : value
  const suffix = match ? match[2] : ''
  return { value: num, suffix, label, count: value !== '1982' }
}

const boutique = pickupPoints[0]

export const aboutPage = {
  hero: {
    eyebrow: 'О КОМПАНИИ',
    title: ['Семейное дело', 'с 1982 года'],
    lead:
      '№1 Гранд Гурмэ производит и поставляет икру, рыбу и деликатесы под ' +
      'собственными марками. Магазины и представительства работают в Дубае, ' +
      'США и Европе, в Москве — гастробутик на Софийской набережной.',
    actions: [{ label: 'Наши бренды', href: ROUTES.brands, kind: 'line' }],
    media: m.seaUrchin,
  },

  story: {
    eyebrow: 'ИСТОРИЯ',
    title: 'Как всё начиналось',
    paragraphs: [
      'Компания начиналась как небольшое семейное дело. Её основатели хотели ' +
        'поставлять продукт высокого качества и при этом бережно относиться ' +
        'к природе, из которой он берётся.',
      'Правило сохранилось. Икру №1 Caviar и рыбу Siberian Luxury Bar мы ' +
        'выпускаем под своими марками и отвечаем за продукт от воды до стола. ' +
        'Их выбирают рестораны и отели в Дубае, Нью-Йорке, Лас-Вегасе, Монако ' +
        'и на курортах Европы.',
      'В 2026 году компания пришла в Россию. В Москве — гастробутик ' +
        'на Софийской набережной, в каталоге рядом с икрой и рыбой — более ' +
        '50 европейских гастрономических брендов, которых нет на российском рынке.',
    ],
    aside: {
      kind: 'year',
      text: '1982',
      caption: 'год, с которого семья занимается деликатесами',
    },
  },

  /* Те же значения, что brand.facts (src/data/brand.js), — импортом. */
  facts: {
    label: 'Компания в цифрах',
    items: brand.facts.map(toFact),
  },

  /* Шапки у блока нет: в задании — две карточки марок, без заголовка. */
  brands: {
    label: 'Собственные марки',
    items: [
      {
        title: '№1 Caviar',
        note: 'Икра с Каспия',
        text: 'Девять линеек забойной икры белуги, осетра и севрюги. Фасовки от 50 г до 1 кг.',
        media: m.spoonGoldPlate,
        href: `${ROUTES.brands}#caviar`,
      },
      {
        title: 'Siberian Luxury Bar',
        note: 'Рыба северных рек',
        text: 'Лосось, нельма и клыкач. Посол морской солью по классическим рецептурам.',
        media: img('/media/alt2/origin/fish-kopchenie.jpg', 'Рыба Siberian Luxury Bar холодного копчения', '4:5'),
        href: `${ROUTES.brands}#fish`,
      },
    ],
  },

  world: {
    eyebrow: 'В МИРЕ',
    title: 'Пять часовых поясов',
    note: 'Бутики, представительства и рестораны-партнёры — от Лас-Вегаса до Дубая.',
    points: ['las-vegas', 'miami', 'new-york', 'europe', 'moscow', 'dubai'],
  },

  /* Адрес и часы — из pickupPoints (src/data/offline.js), не копией. */
  boutique: {
    eyebrow: 'МОСКВА',
    title: 'Гастробутик на Софийской набережной',
    paragraphs: [
      'Икра, рыба и европейская гастрономия на одних полках. Всё можно ' +
        'посмотреть и попробовать до покупки.',
    ],
    list: [boutique.address, boutique.hours, boutique.metro],
    action: { label: 'Как добраться', href: ROUTES.contacts },
    media: img('/media/brand/boutique-main.jpg', 'Зал гастробутика на Софийской набережной', '4:5'),
    side: 'left',
  },

  principles: {
    eyebrow: 'ЧТО МЫ СЧИТАЕМ КАЧЕСТВОМ',
    title: 'Пять правил',
    items: [
      {
        num: '01',
        title: 'Икра только забойная',
        note: '№1 Caviar',
        text:
          'Икру берут один раз, в момент полной зрелости рыбы. Так получается ' +
          'тонкая оболочка и сливочный вкус.',
        media: img('/media/caviar/caviar-osetra-detail.jpg', 'Икра осетра крупным планом'),
        href: ROUTES.production,
      },
      {
        num: '02',
        title: 'Морская соль и ручной посол',
        note: 'икра и рыба',
        text: 'Каждую партию солит мастер, соли ровно столько, чтобы сохранить вкус.',
        media: img('/media/alt2/origin/origin-master.jpg', 'Мастер держит килограммовую банку икры'),
        href: ROUTES.production,
      },
      {
        num: '03',
        title: 'Документы на каждую партию',
        note: 'ТР ЕАЭС, СИТЕС, Меркурий',
        text:
          'Происхождение и безопасность подтверждены документами, их можно ' +
          'проверить самостоятельно.',
        media: m.silverDishToasts,
        href: ROUTES.documents,
      },
      {
        num: '04',
        title: 'Холодовая цепь до двери',
        note: 'доставка',
        text: 'Термоупаковка и контроль температуры на всём пути от склада до вас.',
        media: img('/media/categories/category-giftwrap.jpg', 'Заказ в термоупаковке'),
        href: ROUTES.delivery,
      },
      {
        num: '05',
        title: 'Гастрономия, которой нет в России',
        note: 'более 50 брендов',
        text: 'Европейские марки, которые мы привозим сами.',
        media: img('/media/brand/boutique-detail-02.jpg', 'Полка бутика с европейской гастрономией'),
        href: ROUTES.catalog,
      },
    ],
  },

  company: {
    eyebrow: 'РЕКВИЗИТЫ',
    title: companyDetails.name,
    rows: companyRows,
    copy: true,
  },

  next: [ROUTES.brands, ROUTES.production, ROUTES.partners],
}
