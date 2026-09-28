/**
 * Общие подписи блоков информационных страниц: крошки, «Дальше», кнопки
 * копирования, формы. Тексты самих страниц — в соседних файлах, по файлу
 * на страницу (partners.js, about.js…).
 *
 * Ссылки внутри строки пишутся как [текст](/адрес) — блоки превращают их
 * в <a> при сборке (src/info/blocks/_html.js → inline()).
 */

import { contacts } from '../nav.js'
import { ROUTES } from '../routes.js'

export const infoUi = {
  crumbs: {
    label: 'Хлебные крошки',
    home: { label: 'Главная', href: ROUTES.home },
    company: { label: 'Компания', href: ROUTES.about },
  },

  next: { eyebrow: 'ДАЛЬШЕ', label: 'Соседние страницы' },

  subnav: { label: 'Разделы страницы' },

  copy: { label: 'Скопировать', done: 'Скопировано' },

  list: { more: 'Подробнее', open: 'Перейти' },

  cards: { more: 'Подробнее' },

  timezones: {
    now: 'сейчас',
    venues: 'Где подают',
    pointsLabel: 'Города',
  },

  form: {
    optional: 'необязательно',
    required: 'Заполните поле',
    email: 'Проверьте адрес почты',
    select: 'Выберите',
    consent:
      'Даю [согласие на обработку персональных данных](/consent) ' +
      'и принимаю [политику конфиденциальности](/privacy)',
    consentError: 'Без согласия мы не можем принять заявку',
    sending: 'Отправляем…',
    aside: {
      title: 'Или напишите сами',
      items: [
        { label: 'Телефон', value: contacts.phone, href: contacts.phoneHref },
        { label: 'Telegram', value: '@grandgurme', href: contacts.telegram, external: true },
        { label: 'WhatsApp', value: 'Написать', href: contacts.whatsapp, external: true },
        { label: 'Почта', value: contacts.email, href: `mailto:${contacts.email}` },
      ],
    },
  },
}
