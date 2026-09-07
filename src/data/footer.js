/**
 * Подвал — полный указатель по сайту.
 *
 * ЗАЧЕМ ТАК ПОДРОБНО. Заметная часть людей ищет служебные страницы внизу,
 * а не вверху: так устроена привычка, и спорить с ней бессмысленно. Поэтому
 * подвал перестал быть коротким набором «главного» и стал указателем: пять
 * групп по смыслу — каталог, покупателям, компания, сотрудничество,
 * контакты — плюс правовая строка снизу.
 *
 * КАТАЛОЖНАЯ КОЛОНКА СОБИРАЕТСЯ ИЗ ДАННЫХ, А НЕ РУКАМИ. Список разделов
 * берётся из src/data/catalog.js, то есть из того же места, откуда его берут
 * каталожная панель и генератор страниц. Руками этот список вести нельзя:
 * он разойдётся с каталогом на первой же правке, и в подвале появятся ссылки
 * на несуществующие разделы.
 *
 * ЧЕГО В ПОДВАЛЕ НЕТ И ПОЧЕМУ. Из карты сайта сюда не попали:
 *   /checkout, /order-success — шаги оформления, в них приходят из корзины,
 *                               а не из навигации;
 *   /search                   — не страница, а результат действия;
 *   /404                      — по смыслу недостижима ссылкой;
 *   /product/<слаг>, /journal/<слаг> — шаблоны, а не разделы: карточка товара
 *                               и статья открываются из каталога и журнала.
 * Всё перечисленное всё равно доступно из /sitemap — ссылка на карту стоит
 * в правовой строке. Ни одна ссылка подвала не ведёт в никуда: адреса берутся
 * из src/data/routes.js, а по ней же генерируются каркасы страниц.
 */

import { categories } from './catalog.js'
import { contacts } from './nav.js'
import { ROUTES } from './routes.js'

export const footerColumns = [
  {
    title: 'Каталог',
    links: [
      ...categories.map((category) => ({
        label: category.name,
        href: ROUTES.category(category.slug),
      })),
      /* Именно «Подарки», а не «Подарочные наборы»: раздел с таким названием
         уже есть в каталоге выше (/catalog/podarochnye-nabory), и две строки
         с одинаковой подписью, ведущие по разным адресам, читаются как
         ошибка вёрстки. «Подарки» — то же слово, что в шапке. */
      { label: 'Подарки', href: ROUTES.gifts },
      { label: 'Весь каталог', href: ROUTES.catalog },
    ],
  },
  {
    title: 'Покупателям',
    links: [
      { label: 'Доставка и оплата', href: ROUTES.delivery },
      { label: 'Возврат и гарантия качества', href: ROUTES.returns },
      { label: 'Как хранить и подавать', href: ROUTES.storage },
      { label: 'Подарочные сертификаты', href: ROUTES.certificates },
      /* ⚠ Программа лояльности не подтверждена заказчиком — см. пометку
         у ROUTES.loyalty. Нет программы — убрать строку и здесь, и в панели
         «Компания» (src/data/company.js). */
      { label: 'Программа лояльности', href: ROUTES.loyalty },
      { label: 'Вопросы и ответы', href: ROUTES.faq },
      { label: 'Личный кабинет', href: ROUTES.account },
      { label: 'Корзина', href: ROUTES.cart },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'О компании', href: ROUTES.about },
      { label: 'Наши бренды', href: ROUTES.brands },
      { label: 'Производство и качество', href: ROUTES.production },
      { label: 'Документы и сертификаты', href: ROUTES.documents },
      { label: 'Бутики и представительства', href: ROUTES.boutiques },
      { label: 'Отзывы', href: ROUTES.reviews },
      { label: 'Журнал', href: ROUTES.journal },
      { label: 'Контакты', href: ROUTES.contacts },
    ],
  },
  {
    title: 'Сотрудничество',
    links: [
      { label: 'Ресторанам и отелям', href: ROUTES.partners },
      { label: 'Корпоративные заказы и подарки', href: ROUTES.corporate },
      { label: 'Оптовым покупателям', href: ROUTES.wholesale },
    ],
  },
]

export const footerContacts = {
  title: 'Контакты',
  items: [
    { label: contacts.phone, href: contacts.phoneHref },
    { label: contacts.email, href: `mailto:${contacts.email}` },
    { label: 'WhatsApp', href: contacts.whatsapp },
    { label: 'Telegram', href: contacts.telegram },
    { label: 'Все контакты и реквизиты', href: ROUTES.contacts },
  ],
}

export const socials = [
  {
    label: 'Telegram',
    href: contacts.telegram,
    icon: '<path d="M21 4.5 2.8 11.4c-.6.2-.6.9 0 1.1l4.6 1.5 1.8 5.4c.2.5.8.6 1.2.2l2.5-2.4 4.5 3.3c.5.4 1.2.1 1.3-.5L22 5.3c.1-.6-.4-1-1-.8Z"/><path d="m7.4 14 10.9-7.6L9.6 16"/>',
  },
  {
    label: 'Instagram',
    href: contacts.instagram,
    icon: '<rect x="3" y="3" width="18" height="18"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" stroke="none"/>',
  },
]

export const payments = ['Sber Pay', 'СБП']

export const legal = {
  copyright: `© №1 Гранд Гурмэ, ${new Date().getFullYear()}`,
  /* Отдельной строкой внизу, как просил заказчик: правовые документы
     и карта сайта не должны стоять в одном ряду с разделами каталога. */
  links: [
    { label: 'Политика конфиденциальности', href: ROUTES.privacy },
    { label: 'Публичная оферта', href: ROUTES.terms },
    { label: 'Согласие на обработку персональных данных', href: ROUTES.consent },
    { label: 'Карта сайта', href: ROUTES.sitemap },
  ],
  disclaimer: 'Прототип. Не публичная оферта.',
}

export const footerTagline =
  'Бутик премиальной гастрономии. Чёрная и красная икра, рыба, крабы и морепродукты, подарочные наборы. Доставка по Москве и области.'
