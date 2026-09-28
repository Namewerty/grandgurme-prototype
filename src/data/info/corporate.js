/**
 * /corporate — «Корпоративные заказы и подарки». Состав блоков —
 * src/info/pages/corporate.js.
 *
 * Условия для компаний (оплата по счёту, документы, минимальный заказ,
 * брендирование и т. д.) — все строки null: их называет компания.
 * Пока блок #terms выводит только fallback.
 */

import { contacts } from '../nav.js'
import { ROUTES } from '../routes.js'
import { infoMedia as m } from './media.js'
import { giftFormats } from './gifts.js'

export const corporatePage = {
  hero: {
    eyebrow: 'КОРПОРАТИВНЫЕ ПОДАРКИ',
    title: ['Икра №1 Caviar', 'в подарок партнёрам'],
    lead:
      'Шкатулки с икрой готовы к вручению без дополнительной упаковки. ' +
      'Подберём линейку и формат под ваш список и привезём к нужной дате.',
    actions: [
      { label: 'Рассчитать заказ', href: '#request', kind: 'solid' },
      { label: 'Позвонить', href: contacts.phoneHref, kind: 'line' },
    ],
    media: m.boxBlackClose,
    /* У пэкшота белый фон: кадр стоит в круге --on-dark с multiply. */
    mediaFit: 'circle',
  },

  formats: {
    eyebrow: 'ФОРМАТЫ',
    title: 'Четыре формата подарка',
    note: 'Каждый набор укомплектован перламутровой ложкой и золотым ключиком.',
    ...giftFormats,
  },

  inside: {
    eyebrow: 'ЧТО ВНУТРИ',
    title: 'Что получит тот, кому вы дарите',
    media: m.woodDiamondClose,
    /* Координаты меток — в процентах от кадра wood-diamond-close.jpg
       (1500×1500): банка — чёрная крышка, ложка — слева в ложементе,
       ключик — золотая рыба над ободком банки. */
    spots: [
      { key: 'tin', label: 'Банка икры №1 Caviar с золотым ободком', x: 38, y: 67 },
      { key: 'spoon', label: 'Перламутровая ложка: перламутр не даёт икре привкуса', x: 6, y: 42 },
      { key: 'key', label: 'Золотой ключик, чтобы открыть банку', x: 57, y: 29 },
    ],
  },

  how: {
    eyebrow: 'КАК ЗАКАЗАТЬ',
    title: 'От списка до вручения',
    items: [
      { title: 'Заявка', text: 'Сколько подарков, к какой дате и какой формат нравится.' },
      { title: 'Подбор', text: 'Менеджер предложит линейки и форматы под ваш бюджет.' },
      { title: 'Подтверждение', text: 'Согласуем состав, сумму и дату.' },
      { title: 'Доставка', text: 'Привезём подарки в офис к нужной дате.' },
    ],
  },

  terms: {
    eyebrow: 'УСЛОВИЯ',
    title: 'Для компаний',
    fallback:
      'Условия для компаний — оплата, документы, доставка и сроки — рассчитывает ' +
      'менеджер под ваш заказ.',
    /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: все семь строк. */
    rows: [
      { label: 'Оплата по счёту', value: null },
      { label: 'Закрывающие документы', value: null },
      { label: 'Минимальный заказ', value: null },
      { label: 'Открытка или вложение', value: null },
      { label: 'Брендирование', value: null },
      { label: 'Доставка по списку адресов', value: null },
      { label: 'Заказы к Новому году — до', value: null },
    ],
  },

  request: {
    form: 'corporate',
    eyebrow: 'ЗАЯВКА',
    title: 'Рассчитать заказ',
    text: 'Оставьте контакты и хотя бы примерное количество — менеджер пришлёт варианты.',
    submit: 'Отправить заявку',
    success: 'Спасибо, заявка у нас. Менеджер свяжется с вами в рабочее время.',
    fields: [
      { name: 'company', label: 'Компания', type: 'text', required: true, autocomplete: 'organization' },
      { name: 'name', label: 'Имя', type: 'text', required: true, autocomplete: 'name' },
      { name: 'contact', label: 'Телефон или почта', type: 'text', required: true },
      { name: 'qty', label: 'Сколько подарков', type: 'number' },
      { name: 'date', label: 'К какой дате', type: 'date' },
      {
        name: 'format',
        label: 'Формат',
        type: 'chips',
        options: ['Шкатулка', 'Деревянная шкатулка', 'Три вида икры', 'Пока не знаю'],
      },
      { name: 'comment', label: 'Комментарий', type: 'textarea' },
    ],
  },

  next: [ROUTES.brands, ROUTES.partners, ROUTES.delivery],
}
