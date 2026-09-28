/**
 * /contacts — «Контакты». Состав блоков — src/info/pages/contacts.js.
 *
 * Телефон, мессенджеры и почта — contacts из src/data/nav.js; адрес и часы
 * бутика — pickupPoints из src/data/offline.js; реквизиты —
 * src/data/info/company-details.js. Здесь только подписи и то, чего больше
 * нигде нет (Дубай — с 1-caviar.ae).
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: часы работы телефона, контакт для прессы
 * и сотрудничества; бутик открыт или открывается (см. offline.js).
 */

import { contacts } from '../nav.js'
import { ROUTES } from '../routes.js'
import { pickupPoints } from '../offline.js'
import { img } from './media.js'
import { companyDetails, companyRows } from './company-details.js'

const boutique = pickupPoints[0]

export const contactsPage = {
  hero: {
    eyebrow: 'КОНТАКТЫ',
    title: ['Контакты'],
    lead:
      'Ответим по телефону и в мессенджерах, примем заявку и подскажем, ' +
      'как добраться до бутика.',
  },

  channels: {
    label: 'Способы связи',
    items: [
      {
        key: 'phone',
        icon: 'phone',
        label: 'Телефон',
        value: contacts.phone,
        href: contacts.phoneHref,
        extra: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: часы работы телефона
      },
      { key: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', value: 'Написать', href: contacts.whatsapp, external: true },
      { key: 'telegram', icon: 'telegram', label: 'Telegram', value: '@grandgurme', href: contacts.telegram, external: true },
      {
        key: 'email',
        icon: 'mail',
        label: 'Почта',
        value: contacts.email,
        href: `mailto:${contacts.email}`,
        copy: contacts.email,
      },
    ],
  },

  /* Адрес и часы — из pickupPoints, не копией. Статус считается по часам
     open / close того же пункта по московскому времени. */
  boutique: {
    eyebrow: 'ГАСТРОБУТИК',
    title: boutique.address,
    lines: [boutique.district, boutique.hours, boutique.metro],
    open: boutique.open,
    close: boutique.close,
    tz: 'Europe/Moscow',
    status: {
      open: 'Сейчас открыто · до {close}',
      closed: 'Сейчас закрыто · откроемся в {open}',
    },
    actions: [
      {
        label: 'Построить маршрут',
        href: 'https://yandex.ru/maps/?text=Москва%2C%20Софийская%20набережная%2C%2010',
        kind: 'solid',
        external: true,
      },
      { label: 'Позвонить', href: contacts.phoneHref, kind: 'line' },
    ],
    media: img('/media/brand/boutique-main.jpg', 'Зал гастробутика на Софийской набережной', '4:5'),
  },

  directions: {
    eyebrow: 'ПО НАПРАВЛЕНИЯМ',
    title: 'Кому написать',
    rows: [
      {
        label: 'Заказы и доставка',
        value: `${contacts.phone} · ${contacts.email}`,
        links: [
          { label: contacts.phone, href: contacts.phoneHref },
          { label: contacts.email, href: `mailto:${contacts.email}` },
        ],
      },
      { label: 'Рестораны и отели', value: 'Заявка на дегустацию', href: `${ROUTES.partners}#request` },
      { label: 'Корпоративные подарки', value: 'Рассчитать заказ', href: `${ROUTES.corporate}#request` },
      { label: 'Пресса и сотрудничество', value: null }, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
    ],
  },

  /* Данные — с 1-caviar.ae. */
  dubai: {
    eyebrow: 'ДУБАЙ',
    title: '№1 Caviar на Dubai Marina',
    list: ['Marina Promenade, Delphine Towers P1-LS-3', '+971 50 408 2102', 'info@1-caviar.ae'],
    action: { label: 'Сайт в Дубае', href: 'https://1-caviar.ae', kind: 'line', external: true },
    media: img('/media/info/geo/dubai-lounge.jpg', 'Лобби отеля в Дубае', '4:5'),
    side: 'right',
  },

  company: {
    eyebrow: 'РЕКВИЗИТЫ',
    title: companyDetails.name,
    rows: companyRows,
    copy: true,
  },

  write: {
    form: 'contacts',
    eyebrow: 'ОБРАТНАЯ СВЯЗЬ',
    title: 'Напишите нам',
    submit: 'Отправить',
    success: 'Спасибо, сообщение у нас. Ответим в рабочее время.',
    fields: [
      { name: 'name', label: 'Имя', type: 'text', required: true, autocomplete: 'name' },
      { name: 'contact', label: 'Телефон или почта', type: 'text', required: true },
      {
        name: 'topic',
        label: 'Тема',
        type: 'chips',
        single: true,
        options: ['Заказ', 'Качество', 'Сотрудничество', 'Другое'],
      },
      { name: 'message', label: 'Сообщение', type: 'textarea', required: true },
    ],
  },
}
