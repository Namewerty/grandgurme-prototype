/**
 * Форматы подарочных наборов — блок giftbox. Стоит на /brands (#gifts)
 * и на /corporate (#formats) с разными шапками: шапка — в данных страницы,
 * форматы — здесь, одни на обе.
 *
 * Состав наборов и фасовки — презентация компании от 07.03.2026, стр. 29–31.
 * Кадры — пэкшоты на белом (public/media/info/gifts/): блок ставит их
 * на квадрат --on-dark с mix-blend-mode: multiply, белый фон растворяется.
 *
 * Строка с value: null не выводится.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие линейки кладут в наборы (строка «Икра»).
 */

import { infoMedia as m } from './media.js'

const SET = 'перламутровая ложка, золотой ключик'

export const giftFormats = {
  tabsLabel: 'Формат набора',
  colorsLabel: 'Исполнение шкатулки',
  labels: { jar: 'Банка', set: 'В наборе', variants: 'Исполнение', caviar: 'Икра' },
  formats: [
    {
      key: 'box',
      title: 'Шкатулка',
      jar: '125 или 250 г',
      set: `шкатулка, банка икры, ${SET}`,
      variants: 'чёрное · синее · белое',
      caviar: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
      /* Исполнения: кадр и цвет круга. Синий — средний цвет синей шкатулки
         с кадра, токен --gift-blue в src/info/styles/info.css. */
      colors: [
        { key: 'black', label: 'Чёрное', swatch: 'black', media: m.boxBlack },
        { key: 'blue', label: 'Синее', swatch: 'blue', media: m.boxBlue },
        { key: 'white', label: 'Белое', swatch: 'white', media: m.boxWhite },
      ],
    },
    {
      key: 'wood',
      title: 'Деревянная шкатулка',
      jar: '125 или 250 г',
      set: `деревянная шкатулка-бокс, банка икры, ${SET}`,
      variants: null,
      caviar: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
      media: m.woodRoyal,
    },
    {
      key: 'wood-large',
      title: 'Деревянная шкатулка, большая',
      jar: '500 или 1000 г',
      set: `деревянная шкатулка-бокс, банка икры, ${SET}`,
      variants: null,
      caviar: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
      media: m.woodDiamond,
    },
    {
      key: 'trio',
      title: 'Три вида икры',
      jar: 'три банки по 50 или 113 г',
      set: `бокс, три банки икры, ${SET}`,
      variants: null,
      caviar: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
      media: m.trioSet,
    },
  ],
}
