/**
 * /brands — «Наши бренды». Состав блоков — src/info/pages/brands.js.
 *
 * «Характер икры» здесь тот же, что на /alt2 (src/alt2/sections/character.js,
 * данные src/data/caviar-lines.js), без шапки: её заменяет вступление.
 *
 * Рыба — тексты из презентации компании от 07.03.2026, сокращены.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие позиции выпускаются под маркой Siberian
 * Luxury Bar (клыкач — морская рыба и в историю «северных рек» не
 * укладывается); отдельные кадры каждой позиции — пока по кадру способа
 * обработки из панели каталога.
 *
 * Подарочные наборы — src/data/info/gifts.js (блок стоит и на /corporate).
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: список европейских брендов для строки логотипов
 * в #europe. Пока — разделы каталога со счётчиками.
 */

import { ROUTES } from '../routes.js'
import { categoryItems } from '../categories.js'
import { img } from './media.js'
import { plural } from '../../js/catalog/model.js'
import { giftFormats } from './gifts.js'

const cold = img('/media/nav/ryba-holodnoe-kopchenie.jpg', 'Рыба холодного копчения')
const light = img('/media/nav/ryba-slabosolenaya.jpg', 'Рыба слабой соли')
const dried = img('/media/nav/ryba-vyalenaya-sushenaya.jpg', 'Нежно подвяленная рыба')

const EUROPE = ['bakaleya', 'sladosti', 'napitki', 'sneki', 'tovary-dlya-doma']

export const brandsPage = {
  hero: {
    eyebrow: 'НАШИ БРЕНДЫ',
    title: ['№1 Caviar', 'и Siberian Luxury Bar'],
    lead:
      'Две собственные марки: икра с Каспия и рыба северных рек. Рядом с ними ' +
      'в бутике и каталоге — европейская гастрономия, которой нет на российском рынке.',
    media: img('/media/caviar/caviar-royal-beluga.jpg', 'Банка икры №1 Caviar Royal Beluga'),
  },

  subnav: [
    { label: '№1 Caviar', href: '#caviar' },
    { label: 'Siberian Luxury Bar', href: '#fish' },
    { label: 'Подарочные наборы', href: '#gifts' },
    { label: 'Европейская гастрономия', href: '#europe' },
  ],

  caviar: {
    eyebrow: '№1 CAVIAR',
    title: 'Девять линеек икры',
    paragraphs: [
      'Вся икра №1 Caviar забойная, из Азербайджана. Линейки различаются видом ' +
        'осетровых и возрастом рыбы: от них зависят размер зерна и вкус. ' +
        'Фасовки — от 50 г до 1 кг, в жестяных банках с золотым ободком.',
    ],
  },

  fish: {
    eyebrow: 'SIBERIAN LUXURY BAR',
    title: 'Рыба северных рек',
    paragraphs: [
      'Рыбу вылавливают в притоках северных рек, вода в них идёт с горных ' +
        'ледников и таёжных родников. Посол — по классическим рецептурам ' +
        'и только морской солью, копчение — на плодовой древесине.',
    ],
    action: { label: 'Как её делают', href: `${ROUTES.production}#fish` },
  },

  fishList: {
    label: 'Позиции Siberian Luxury Bar',
    more: { label: 'Вся рыба в каталоге →', href: ROUTES.category('ryba') },
    items: [
      {
        num: '01',
        title: 'Лосось холодного копчения, классический',
        note: 'пласт, вакуум',
        text:
          'При низкой температуре рыба остаётся сочной, с плотной маслянистой ' +
          'текстурой и лёгким ароматом дымка.',
        media: cold,
      },
      {
        num: '02',
        title: 'Лосось холодного копчения с апельсином',
        note: 'пласт, вакуум',
        text:
          'В маринаде мёд, свежий имбирь и цедра цитрусовых: сладость, лёгкая ' +
          'пикантность и свежее послевкусие.',
        media: cold,
      },
      {
        num: '03',
        title: 'Лосось холодного копчения с укропом',
        note: 'пласт, вакуум',
        text: 'Копчение на древесной щепе и укроп: мягкий дымок и травяная свежесть.',
        media: cold,
      },
      {
        num: '04',
        title: 'Лосось слабой соли, классический',
        note: 'пласт, вакуум',
        text: 'Деликатный посол сохраняет сочность, яркий цвет и нежную текстуру.',
        media: light,
      },
      {
        num: '05',
        title: 'Лосось нежно подвяленный',
        note: 'пласт, вакуум',
        text: 'Медленная выдержка по традиционной технологии: насыщенный вкус и плотная текстура.',
        media: dried,
      },
      {
        num: '06',
        title: 'Нельма нежно подвяленная',
        note: 'пласт, вакуум',
        text: 'Северная рыба со светлым мясом, мягкой волокнистой текстурой и сливочным вкусом.',
        media: dried,
      },
      {
        num: '07',
        title: 'Клыкач холодного копчения',
        note: 'пласт, вакуум',
        text: 'Нежная маслянистая текстура и лёгкий аромат дымка.',
        media: cold,
      },
    ],
  },

  gifts: {
    eyebrow: 'ПОДАРОЧНЫЕ НАБОРЫ',
    title: 'Икра в шкатулке',
    note:
      'Каждый набор укомплектован перламутровой ложкой и золотым ключиком ' +
      'и готов к вручению без дополнительной упаковки.',
    more: { label: 'Подарочные наборы в каталоге →', href: ROUTES.category('podarochnye-nabory') },
    ...giftFormats,
  },

  europe: {
    eyebrow: 'ЕВРОПЕЙСКАЯ ГАСТРОНОМИЯ',
    title: 'Более 50 брендов, которых нет в российских магазинах',
    note: 'Мы привозим их сами и продаём в бутике и на сайте.',
    columns: 5,
    items: EUROPE.map((slug) => {
      const item = categoryItems.find(({ href }) => href === ROUTES.category(slug))
      return { title: item.name, count: item.count, word: plural(item.count, 'позиция', 'позиции', 'позиций'), href: item.href }
    }),
  },

  next: [ROUTES.production, ROUTES.corporate, ROUTES.storage],
}

