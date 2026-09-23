/**
 * #hero на /alt2 — «Витрина разделов». Тексты и шесть разделов.
 * ЧЕРНОВИК НА ВЫБРОС, как и вся альтернативная главная 2.
 *
 * Задача первого экрана — с первого взгляда показать, что здесь продаётся
 * весь стол, а не одна икра, и дать сразу уйти в нужный раздел. Ролик бренда
 * здесь не используется: он остаётся на основной главной.
 *
 * СЧЁТЧИКИ НАСТОЯЩИЕ И СЧИТАЮТСЯ, А НЕ ПИШУТСЯ РУКАМИ. Число берётся
 * из categoryItems (src/data/categories.js — выгрузка 1С), если раздел там
 * есть; иначе — число позиций раздела в прототипе без тестовых (слаг test-…).
 * «Европейская гастрономия» — сумма четырёх разделов categoryItems. Ноль —
 * счётчик в строке не выводится.
 */

import { ROUTES } from '../../data/routes.js'
import { categoryItems } from '../../data/categories.js'
import { getProducts } from '../../data/catalog-products.js'
import { caviarLines } from '../../data/caviar-lines.js'
import { plural } from '../../js/catalog/model.js'

const countOf = (slug) => {
  const item = categoryItems.find(({ href }) => href === ROUTES.category(slug))
  if (item) return item.count
  return getProducts(slug).filter((product) => !product.slug.startsWith('test-')).length
}

const positions = (n) => (n > 0 ? `${n} ${plural(n, 'позиция', 'позиции', 'позиций')}` : '')

/** «Siberian Luxury Bar · 230 позиций»; без счётчика — только первая часть. */
const joined = (...parts) => parts.filter(Boolean).join(' · ')

const europe = ['bakaleya', 'sladosti', 'napitki', 'sneki'].reduce((sum, slug) => sum + countOf(slug), 0)
const lines = caviarLines.length

export const stage = {
  eyebrow: 'МЕЖДУНАРОДНЫЙ ГАСТРОБУТИК · С 1982 ГОДА',

  /* Запасные H1: «Каспийская икра / и деликатесы к ней»,
     «Икра №1 Caviar / и ещё 50 брендов Европы». */
  titleLines: ['Икра с Каспия', 'и гастрономия Европы'],
  titleAlternatives: [
    'Каспийская икра / и деликатесы к ней',
    'Икра №1 Caviar / и ещё 50 брендов Европы',
  ],

  lead:
    'Икра №1 Caviar и рыба Siberian Luxury Bar — наши собственные марки. ' +
    'Рядом с ними более 50 европейских брендов, которых нет на российском рынке.',

  /** Подпись списка для скринридера. */
  listLabel: 'Разделы',

  all: { label: 'Весь каталог', href: ROUTES.catalog },

  /* Порядок фиксированный. image — кадр строки; у «Рыбы» вместо кадра ролик
     бренда (отрезок 4,4–13,8 с), image — его постер. */
  items: [
    {
      key: 'chernaya-ikra',
      name: 'Чёрная икра',
      href: ROUTES.category('chernaya-ikra'),
      meta: `${lines} ${plural(lines, 'линейка', 'линейки', 'линеек')} №1 Caviar`,
      image: { src: '/media/alt2/hero/hero-chernaya-ikra.jpg', alt: 'Чёрная икра в панцире морского ежа' },
    },
    {
      key: 'krasnaya-ikra',
      name: 'Красная икра',
      href: ROUTES.category('krasnaya-ikra'),
      meta: positions(countOf('krasnaya-ikra')),
      image: { src: '/media/alt2/hero/hero-krasnaya-ikra.jpg', alt: 'Красная икра в раковине устрицы' },
    },
    {
      key: 'ryba',
      name: 'Рыба',
      href: ROUTES.category('ryba'),
      meta: joined('Siberian Luxury Bar', positions(countOf('ryba'))),
      image: { src: '/media/alt2/hero/hero-ryba.jpg', alt: 'Ломти рыбы Siberian Luxury Bar' },
      video: { from: 4.4, to: 13.8 },
    },
    {
      key: 'kraby-i-moreprodukty',
      name: 'Крабы и морепродукты',
      href: ROUTES.category('kraby-i-moreprodukty'),
      meta: positions(countOf('kraby-i-moreprodukty')),
      image: { src: '/media/alt2/hero/hero-moreprodukty.jpg', alt: 'Устрицы с икрой и закуски' },
    },
    {
      key: 'europe',
      name: 'Европейская гастрономия',
      href: ROUTES.catalog,
      meta: joined('Более 50 брендов', positions(europe)),
      image: {
        src: '/media/brand/boutique-main.jpg',
        alt: 'Бутик №1 Гранд Гурмэ: полки с европейской гастрономией',
      },
    },
    {
      key: 'podarochnye-nabory',
      name: 'Подарочные наборы',
      href: ROUTES.category('podarochnye-nabory'),
      meta: positions(countOf('podarochnye-nabory')),
      image: { src: '/media/alt2/hero/hero-podarki.jpg', alt: 'Шкатулка с икрой №1 Caviar Diamond Beluga' },
      /* Пэкшот квадратный, по краям белые углы фона (ИСТОЧНИКИ.md) —
         кадр увеличен от центра, чтобы углы ушли за край. */
      zoom: 1.3,
    },
  ],
}
