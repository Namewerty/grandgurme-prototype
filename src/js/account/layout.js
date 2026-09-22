/* ============================================================================
   Каркас страниц кабинета: крошки, боковое меню, общие блоки.

   Стоит на всех страницах кабинета, кроме входа, и на /favorites у вошедшего.
   От 1024px — сетка из 12 колонок: слева, в колонках 1–3, липкое меню под
   шапкой, содержимое — в колонках 4–12. Уже 1024px бокового меню нет: на
   обзоре те же пункты стоят списком строк под основными блоками
   (sectionLinks), на остальных страницах путь назад дают крошки.

   Здесь же — общее для страниц: проверка адреса возврата (safeBack), переход
   на вход (loginUrl, requireUser), пустое состояние, строка связи
   с менеджером. Страницы знают только этот файл, api.js и сторы.
   ============================================================================ */

import { accountCopy } from '../../data/account-copy.js'
import { contacts } from '../../data/nav.js'
import { ROUTES } from '../../data/routes.js'
import { escapeHtml, plural } from '../catalog/model.js'
import { formatPhone } from '../checkout/validate.js'
import { icons } from '../icons.js'
import * as favorites from '../favorites/store.js'
import { logout, onWaitlistChange, peekWaitlist } from './api.js'
import { currentUser, onChange } from './session.js'

const copy = accountCopy

export const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

/** «3 позиции», «6 товаров» — формы слов лежат в account-copy.js → plurals. */
export const countLabel = (n, forms) => `${n} ${plural(n, ...forms)}`
export const positionsLabel = (n) => countLabel(n, copy.plurals.positions)
export const goodsLabel = (n) => countLabel(n, copy.plurals.goods)

export const phoneLabel = (digits) => formatPhone(digits).trim()

/* --------------------------------------------------------- вход и возврат */

/**
 * Проверка адреса возврата после входа. Принимается только путь этого же
 * сайта, не ведущий обратно на вход; всё прочее заменяется на /account.
 * Сервер повторяет эту проверку дословно.
 */
export function safeBack(back) {
  if (!back) return ROUTES.account
  try {
    const url = new URL(back, location.origin)
    const ok =
      url.origin === location.origin && url.pathname.startsWith('/') && !url.pathname.startsWith(ROUTES.accountLogin)
    return ok ? url.pathname + url.search : ROUTES.account
  } catch {
    return ROUTES.account
  }
}

/** Адрес входа с возвратом на страницу back (по умолчанию — на текущую). */
export const loginUrl = (back = location.pathname + location.search, extra = {}) =>
  `${ROUTES.accountLogin}?${new URLSearchParams({ ...extra, back })}`

/** Гость на странице кабинета уходит на вход. @returns {object|null} пользователь */
export function requireUser() {
  const user = currentUser()
  if (!user) location.replace(loginUrl())
  return user
}

/**
 * Смена входа на открытой странице кабинета: вышли в другой вкладке —
 * на вход с возвратом сюда; вошёл другой пользователь — перезагрузка;
 * тот же пользователь поправил профиль — обновляется шапка каркаса.
 */
export function watchSession(userId, mount) {
  onChange(({ user }) => {
    // Страница сама выходит или удаляет кабинет и сама решает, куда уйти.
    if (leaving) return
    if (!user) location.replace(loginUrl())
    else if (user.id !== userId) location.reload()
    else paintIdentity(mount, user)
  })
}

/* ---------------------------------------------------------------- каркас */

/**
 * Пункты кабинета. count — ключ счётчика: у избранного и листа ожидания
 * свои числа и свои атрибуты (COUNTERS ниже), обновляются по своим событиям.
 */
const MENU = [
  { key: 'overview', href: ROUTES.account, icon: 'user' },
  { key: 'orders', href: ROUTES.accountOrders, icon: 'receipt' },
  { key: 'favorites', href: ROUTES.favorites, icon: 'heart', count: 'favorites' },
  { key: 'waitlist', href: ROUTES.accountWaitlist, icon: 'bell', count: 'waitlist' },
  { key: 'addresses', href: ROUTES.accountAddresses, icon: 'pin' },
  { key: 'profile', href: ROUTES.accountProfile, icon: 'user' },
]

/** Счётчики пунктов: атрибут узла, число и подписка на изменения. */
const COUNTERS = {
  favorites: {
    attr: 'data-acc-fav-count',
    count: () => favorites.count(),
    subscribe: (fn) => favorites.subscribe(fn),
  },
  waitlist: {
    attr: 'data-acc-wait-count',
    count: () => peekWaitlist().length,
    subscribe: (fn) => onWaitlistChange(fn),
  },
}

const countSpan = (className, key) => (key ? `<span class="${className}" ${COUNTERS[key].attr}></span>` : '')

function crumbsHtml(trail) {
  const links = [{ label: copy.crumbs.home, href: ROUTES.home }, ...trail]
  return `
    <nav class="crumbs" aria-label="Хлебные крошки">
      ${links
        .map(({ label, href }, i) =>
          i === links.length - 1
            ? `<span class="crumbs__current" aria-current="page">${escapeHtml(label)}</span>`
            : `<a href="${href}">${escapeHtml(label)}</a><span class="crumbs__sep" aria-hidden="true"></span>`,
        )
        .join('')}
    </nav>`
}

function paintIdentity(mount, user) {
  const name = mount.querySelector('[data-acc-name]')
  const phone = mount.querySelector('[data-acc-phone]')
  if (name) name.textContent = user.name?.trim() || copy.nav.fallbackName
  if (phone) phone.textContent = phoneLabel(user.phone)
}

function paintCount(mount, key) {
  const counter = COUNTERS[key]
  const n = counter.count()
  mount.querySelectorAll(`[${counter.attr}]`).forEach((node) => {
    node.textContent = n ? String(n) : ''
  })
}

/** Первая отрисовка всех счётчиков и подписка каждого на своё событие. */
function watchCounts(mount) {
  Object.keys(COUNTERS).forEach((key) => {
    paintCount(mount, key)
    COUNTERS[key].subscribe(() => paintCount(mount, key))
  })
}

let leaving = false

/** Страница уходит сама (выход, удаление кабинета): слежение за входом молчит. */
export function markLeaving() {
  leaving = true
}

/** «Выйти» — logout() и переход на главную. */
export async function signOut() {
  markLeaving()
  await logout()
  location.assign(ROUTES.home)
}

/**
 * Собирает каркас и возвращает узел для содержимого страницы.
 *
 * @param {HTMLElement} mount
 * @param {object} o
 * @param {string} o.page     ключ текущего пункта меню
 * @param {{label: string, href?: string}[]} o.trail  крошки после «Главная»
 * @param {object} o.user
 */
export function renderFrame(mount, { page, trail, user }) {
  mount.className = 'page-account'
  mount.innerHTML = `
    <div class="container">
      ${crumbsHtml(trail)}

      <div class="acc">
        <aside class="acc__side" aria-label="${copy.nav.label}">
          <p class="acc__name" data-acc-name></p>
          <p class="acc__phone" data-acc-phone></p>

          <nav class="acc__menu" aria-label="${copy.nav.label}">
            ${MENU.map(
              ({ key, href, count }) => `
              <a class="acc__link${key === page ? ' is-current' : ''}" href="${href}"${
                key === page ? ' aria-current="page"' : ''
              }>
                <span>${copy.nav[key]}</span>
                ${countSpan('acc__count', count)}
              </a>`,
            ).join('')}
          </nav>

          <button type="button" class="link-btn acc__logout" data-acc-logout>${copy.nav.logout}</button>
        </aside>

        <div class="acc__main" data-acc-main></div>
      </div>
    </div>`

  paintIdentity(mount, user)
  watchCounts(mount)
  mount.querySelector('[data-acc-logout]').addEventListener('click', signOut)

  return mount.querySelector('[data-acc-main]')
}

/** Крошки кабинета: «Личный кабинет / …». Последняя — текущая страница. */
export const accountTrail = (...rest) => [{ label: copy.crumbs.account, href: ROUTES.account }, ...rest]

/**
 * Пункты кабинета списком строк — обзор уже 1024px, где бокового меню нет.
 * «Обзор» в списке не нужен: человек на нём и стоит.
 */
export function sectionLinks() {
  const nav = document.createElement('nav')
  nav.className = 'acc-rows'
  nav.setAttribute('aria-label', copy.nav.label)
  nav.innerHTML =
    MENU.filter(({ key }) => key !== 'overview')
      .map(
        ({ key, href, icon, count }) => `
        <a class="acc-rows__row" href="${href}">
          <span class="acc-rows__icon" aria-hidden="true">${icons[icon]}</span>
          <span class="acc-rows__label">${copy.nav[key]}</span>
          ${countSpan('acc-rows__count', count)}
          <span class="acc-rows__chevron" aria-hidden="true">${icons.chevronRight}</span>
        </a>`,
      )
      .join('') +
    `<button type="button" class="acc-rows__row acc-rows__row--button" data-acc-logout>
       <span class="acc-rows__icon" aria-hidden="true">${icons.close}</span>
       <span class="acc-rows__label">${copy.nav.logout}</span>
     </button>`

  nav.querySelector('[data-acc-logout]').addEventListener('click', signOut)
  watchCounts(nav)
  return nav
}

/* ----------------------------------------------------------- общие блоки */

/**
 * Пустое состояние одного вида: знак 48px линией, заголовок Prata, текст
 * до 42ch, одна кнопка (ссылка или действие).
 */
export function emptyState({ icon, title, text, action, onAction }) {
  const box = document.createElement('div')
  box.className = 'acc-empty'
  box.innerHTML = `
    <span class="acc-empty__icon" aria-hidden="true">${icons[icon] || ''}</span>
    <h2 class="acc-empty__title">${title}</h2>
    <p class="acc-empty__text">${text}</p>
    ${
      onAction
        ? `<button type="button" class="btn btn--solid" data-empty-action>${action}</button>`
        : `<a class="btn btn--solid" href="${action.href}">${action.label}</a>`
    }`
  if (onAction) box.querySelector('[data-empty-action]').addEventListener('click', onAction)
  return box
}

/** Телефон, WhatsApp и Telegram — из contacts в src/data/nav.js. */
export const contactLinksHtml = () => `
  <a href="${contacts.phoneHref}">${contacts.phone}</a>
  <a href="${contacts.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>
  <a href="${contacts.telegram}" target="_blank" rel="noopener">Telegram</a>`

/** Заголовок страницы: document.title и h1 одним текстом. */
export function setTitle(text) {
  document.title = `${text} — №1 Гранд Гурмэ`
}
