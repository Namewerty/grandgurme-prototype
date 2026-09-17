/* ============================================================================
   ЕДИНСТВЕННАЯ граница данных входа, кабинета и избранного.

   Страницы кабинета, шапка и стор избранного знают только этот файл и сторы.
   На Битриксе он заменяется запросами к серверу с теми же именами функций,
   аргументами и ответами; страницы остаются как есть. Что делает каждая
   функция в прототипе и что должен повторить сервер — записка
   PERENOS-kabinet-i-izbrannoe.md в корне.

   Все функции асинхронные. resendIn и retryIn — в секундах. phone
   в аргументах — десять цифр без +7 (phoneDigits из checkout/validate.js);
   в записях заказов телефон хранится отформатированным, сравнение — по цифрам.

   В ПРОТОТИПЕ СМС НЕ ОТПРАВЛЯЕТСЯ: подходит код 123456 для любого номера.

   Ничего не читает и не рисует при импорте.
   ============================================================================ */

import { findProductBySlug } from '../../data/catalog-products.js'
import { optionalEmail, phoneDigits, rules } from '../checkout/validate.js'
import {
  listOrders,
  listRequests,
  loadOrder,
  loadRequest,
  mergeGuestCart,
  removeUserCart,
  updateOrder,
  updateRequest,
} from '../cart/storage.js'
import { add as addToCart } from '../cart/store.js'
import { currentUser, emitChange } from './session.js'
import {
  clearGuestFavorites,
  clearSession,
  loadCodes,
  loadGuestFavorites,
  loadUserRecord,
  loadUsers,
  saveCodes,
  saveGuestFavorites,
  saveSession,
  saveUsers,
  updateUserRecord,
} from './storage.js'

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} phone      десять цифр без +7
 * @property {string} name
 * @property {string} lastName
 * @property {string} email
 * @property {boolean} marketing  согласие на новости и предложения
 * @property {string} createdAt   ISO
 *
 * @typedef {object} Address
 * @property {string} id
 * @property {string} label       «Дом», «Работа» — необязательно
 * @property {string} street      улица и дом; город всегда Москва
 * @property {string} apartment
 * @property {string} intercom
 * @property {boolean} isDefault
 * @property {string} createdAt   ISO
 *
 * @typedef {object} Order  запись заказа, как её кладёт submitCheckout:
 *   { number, createdAt, contact, receive, shipments, payment, comment, promo,
 *     items, totals }, плюс:
 * @property {string|null} userId          кому принадлежит; null у гостевого до привязки
 * @property {string} status               статус заказа, см. statuses в account-copy.js
 * @property {number|null} requestNumber   заявка, отправленная вместе с заказом
 *   У каждой отгрузки shipments[i].status — статус отгрузки.
 *
 * @typedef {object} Request  запись заявки: { number, createdAt, contact, items,
 *   contactWay, question, orderNumber }, плюс userId и status (новая — 'new').
 *
 * @typedef {object} HistoryRow
 * @property {'order'|'request'} type
 * @property {number} number
 * @property {string} createdAt
 * @property {string} status
 * @property {number|null} total           у заявки null
 * @property {number} positions
 * @property {{src: string, alt: string}[]} previews  до четырёх
 * @property {{method: 'delivery'|'pickup'|null, dates: {date: string, interval: string}[]}} receive
 */

/* Значения прототипа. ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро. */
export const CODE_LENGTH = 6 //          ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро
export const RESEND_SECONDS = 60 //      ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро
export const MAX_ATTEMPTS = 3 //         ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро
export const CODE_TTL_MINUTES = 10 //    ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро
export const MAX_CODES_PER_HOUR = 5 //   ⚠ ПОДТВЕРДИТЬ: на Битриксе значение задаёт ядро

/** Код, который подходит любому номеру. Только прототип. */
const PROTOTYPE_CODE = '123456'

export const MAX_ADDRESSES = 10
export const MAX_FAVORITES = 200
export const HISTORY_PAGE_SIZE = 20

/** Задержка ответа у шагов входа: без неё не видно, что кнопка ждёт ответа. */
const LATENCY_MS = 250
const HOUR_MS = 3600e3

const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const copyOf = (value) => JSON.parse(JSON.stringify(value))

/* ------------------------------------------------------------------ коды */

/**
 * Выдать код. Если предыдущий отправлен меньше RESEND_SECONDS назад, новый
 * не выдаётся: возвращается остаток таймера — так «Изменить номер» и возврат
 * к тому же номеру не сжигают лимит.
 */
function issueCode(phone, extra = {}) {
  const now = Date.now()
  const codes = loadCodes()
  const record = codes[phone]
  const log = (record?.log || []).filter((at) => now - at < HOUR_MS)

  const sinceLast = record?.sentAt ? now - record.sentAt : Infinity
  if (sinceLast < RESEND_SECONDS * 1000 && record.attemptsLeft > 0) {
    codes[phone] = { ...record, ...extra }
    saveCodes(codes)
    return { ok: true, resendIn: Math.ceil(RESEND_SECONDS - sinceLast / 1000), codeLength: CODE_LENGTH }
  }

  if (log.length >= MAX_CODES_PER_HOUR) {
    return { ok: false, error: 'rate_limit', retryIn: Math.ceil((log[0] + HOUR_MS - now) / 1000) }
  }

  codes[phone] = { sentAt: now, attemptsLeft: MAX_ATTEMPTS, log: [...log, now], ...extra }
  saveCodes(codes)
  return { ok: true, resendIn: RESEND_SECONDS, codeLength: CODE_LENGTH }
}

/** Проверить код. Успех — запись кода гасится: второй раз он не подойдёт. */
function checkCode(phone, code) {
  const codes = loadCodes()
  const record = codes[phone]
  if (!record?.sentAt) return { ok: false, error: 'expired' }
  if (Date.now() - record.sentAt > CODE_TTL_MINUTES * 60e3) return { ok: false, error: 'expired' }
  if (record.attemptsLeft <= 0) return { ok: false, error: 'attempts_exhausted' }

  if (String(code) !== PROTOTYPE_CODE) {
    record.attemptsLeft -= 1
    saveCodes(codes)
    // Третья неверная попытка: код больше не принимается, нужен новый.
    return record.attemptsLeft <= 0
      ? { ok: false, error: 'attempts_exhausted' }
      : { ok: false, error: 'wrong_code', attemptsLeft: record.attemptsLeft }
  }

  // Журнал отправок остаётся: лимит на час считается и после удачного входа.
  codes[phone] = { log: record.log || [] }
  saveCodes(codes)
  return { ok: true, record }
}

/* ------------------------------------------------------------------ вход */

function createUser(phone) {
  const users = loadUsers()
  const profile = {
    id: newId('u'),
    phone,
    name: '',
    lastName: '',
    email: '',
    marketing: false,
    createdAt: new Date().toISOString(),
  }
  users.byId[profile.id] = { profile, addresses: [], favorites: [] }
  users.byPhone[phone] = profile.id
  saveUsers(users)
  return profile
}

/** Объединение избранного без повторов, новые сверху, не больше MAX_FAVORITES. */
function mergeFavorites(own, guest) {
  const seen = new Set()
  return [...own, ...guest]
    .filter((item) => item && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')))
    .slice(0, MAX_FAVORITES)
}

/**
 * Порядок при успешном входе. Сервер повторяет его шаг в шаг:
 *   1. заказы и заявки с этим номером в контактах и пустым userId получают
 *      userId вошедшего;
 *   2. избранное гостя переходит в кабинет (объединение без повторов),
 *      гостевое очищается;
 *   3. гостевая корзина складывается с корзиной кабинета;
 *   4. запись сессии;
 *   5. событие account:change.
 * @param {{ mergeGuest?: boolean }} [options] демонстрационный вход гостевую
 *   корзину и избранное не трогает
 */
export function openSession(user, { mergeGuest = true } = {}) {
  const samePhone = (record) => !record.userId && phoneDigits(record.contact?.phone) === user.phone
  listOrders().filter(samePhone).forEach((order) => updateOrder(order.number, { userId: user.id }))
  listRequests().filter(samePhone).forEach((request) => updateRequest(request.number, { userId: user.id }))

  if (mergeGuest) {
    const guest = loadGuestFavorites()
    if (guest.length) {
      updateUserRecord(user.id, (record) => ({ ...record, favorites: mergeFavorites(record.favorites, guest) }))
    }
    clearGuestFavorites()
    mergeGuestCart(user.id)
  }

  saveSession(user.id)
  emitChange()
}

export async function requestCode(phone) {
  await wait()
  return issueCode(phoneDigits(phone))
}

export async function verifyCode(phone, code) {
  await wait()
  const digits = phoneDigits(phone)
  const result = checkCode(digits, code)
  if (!result.ok) return result

  const knownId = loadUsers().byPhone[digits]
  const known = knownId ? loadUserRecord(knownId)?.profile : null
  const user = known || createUser(digits)

  openSession(user)
  return { ok: true, isNew: !known, user: copyOf(user) }
}

/**
 * Телефон из заказа или заявки этого браузера — десять цифр или ''.
 * Нужен входу со страницы «Заказ принят»: номер подставляется в поле.
 * На Битриксе — из заказа текущей сессии; чужой заказ номера не отдаёт.
 */
export async function getRecordPhone({ order = null, request = null }) {
  const record = (order && loadOrder(order)) || (request && loadRequest(request)) || null
  return record ? phoneDigits(record.contact?.phone) : ''
}

/** Шаг «Как к вам обращаться»: имя обязательно, почта — нет. */
export async function completeProfile({ name = '', email = '', marketing = false }) {
  await wait()
  const user = currentUser()
  if (!user) return { ok: false, errors: {} }

  const errors = {}
  const nameError = rules.name(name)
  const emailError = optionalEmail(email)
  if (nameError) errors.name = nameError
  if (emailError) errors.email = emailError
  if (Object.keys(errors).length) return { ok: false, errors }

  return writeProfile(user.id, { name: name.trim(), email: email.trim(), marketing: Boolean(marketing) })
}

function writeProfile(userId, patch) {
  const record = updateUserRecord(userId, (current) => ({ ...current, profile: { ...current.profile, ...patch } }))
  emitChange()
  return { ok: true, user: copyOf(record.profile) }
}

export async function getUser() {
  const user = currentUser()
  return user ? copyOf(user) : null
}

/** Выход: удаляется сессия, затем account:change. Корзина остаётся в кабинете. */
export async function logout() {
  clearSession()
  emitChange()
}

/* ------------------------------------------------------- заказы и заявки */

/** Чем меньше, тем дальше от получения. */
const STATUS_RANK = { accepted: 0, waiting: 1, assembling: 2, on_way: 3, ready: 3, done: 4 }

/** Статус заказа с двумя отгрузками — статус той, что дальше от получения. */
export function orderStatus(order) {
  if (order.status === 'canceled') return 'canceled'
  const statuses = (order.shipments || []).map((shipment) => shipment.status).filter(Boolean)
  if (!statuses.length) return order.status || 'accepted'
  return statuses.reduce((far, status) => ((STATUS_RANK[status] ?? 0) < (STATUS_RANK[far] ?? 0) ? status : far))
}

const previewsOf = (items = []) =>
  items
    .filter((line) => line.image)
    .slice(0, 4)
    .map((line) => ({ src: line.image, alt: line.name }))

const orderRow = (order) => ({
  type: 'order',
  number: order.number,
  createdAt: order.createdAt,
  status: orderStatus(order),
  total: order.totals?.sum ?? 0,
  positions: order.items?.length || 0,
  previews: previewsOf(order.items),
  receive: {
    method: order.receive?.method || null,
    dates: (order.shipments || []).map(({ date, interval }) => ({ date, interval })),
  },
})

const requestRow = (request) => ({
  type: 'request',
  number: request.number,
  createdAt: request.createdAt,
  status: request.status || 'new',
  total: null,
  positions: request.items?.length || 0,
  previews: previewsOf(request.items),
  receive: { method: null, dates: [] },
})

const ownOrders = (userId) => listOrders().filter((order) => order.userId === userId)
const ownRequests = (userId) => listRequests().filter((request) => request.userId === userId)

/**
 * История: новые сверху, страницами по HISTORY_PAGE_SIZE.
 * @param {{ type?: 'all'|'orders'|'requests', page?: number }} [query]
 * @returns {Promise<{ items: HistoryRow[], total: number, hasOrders: boolean, hasRequests: boolean }>}
 */
export async function getHistory({ type = 'all', page = 1 } = {}) {
  const user = currentUser()
  if (!user) return { items: [], total: 0, hasOrders: false, hasRequests: false }

  const orders = ownOrders(user.id).map(orderRow)
  const requests = ownRequests(user.id).map(requestRow)
  const rows = (type === 'orders' ? orders : type === 'requests' ? requests : [...orders, ...requests]).sort(
    (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b.number - a.number,
  )

  const start = (Math.max(1, page) - 1) * HISTORY_PAGE_SIZE
  return {
    items: rows.slice(start, start + HISTORY_PAGE_SIZE),
    total: rows.length,
    hasOrders: orders.length > 0,
    hasRequests: requests.length > 0,
  }
}

/** Заказ по номеру — только свой. Найден по userId: после смены номера остаётся. */
export async function getOrder(number) {
  const user = currentUser()
  const order = user ? loadOrder(number) : null
  return order && order.userId === user.id ? { ...copyOf(order), status: orderStatus(order) } : null
}

export async function getRequest(number) {
  const user = currentUser()
  const request = user ? loadRequest(number) : null
  return request && request.userId === user.id ? { status: 'new', ...copyOf(request) } : null
}

/**
 * Повторить заказ. Позиция, найденная в каталоге по слагу, берёт цену,
 * наличие и кадр из каталога; позиция без слага (витрина главной) — из снимка.
 * Слаг есть, а в каталоге его нет — позиция снята с продажи: в skipped.
 * @returns {Promise<{ added: number, skipped: string[] }>}
 */
export async function reorder(number) {
  const order = await getOrder(number)
  const result = { added: 0, skipped: [] }
  if (!order) return result

  order.items.forEach((line) => {
    const product = line.slug ? findProductBySlug(line.slug) : null
    if (line.slug && !product) {
      result.skipped.push(line.name)
      return
    }
    addToCart(product || line, line.qty)
    result.added += 1
  })
  return result
}

/* ---------------------------------------------------------------- адреса */

const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

export async function getAddresses() {
  const user = currentUser()
  return user ? copyOf(loadUserRecord(user.id)?.addresses || []) : []
}

/**
 * Сохранить адрес: с id — правка, без id — новый. Первый адрес становится
 * основным сам. Одиннадцатый — 'limit'; адрес с той же улицей и квартирой
 * уже есть — 'duplicate', второй раз он не сохраняется.
 */
export async function saveAddress(address) {
  const user = currentUser()
  if (!user) return { ok: false, errors: {} }

  const streetError = rules.street(address.street || '')
  if (streetError) return { ok: false, errors: { street: streetError } }

  const list = loadUserRecord(user.id)?.addresses || []
  const existing = address.id ? list.find((item) => item.id === address.id) : null
  if (!existing && list.length >= MAX_ADDRESSES) return { ok: false, error: 'limit' }

  const twin = list.find(
    (item) =>
      item.id !== existing?.id && sameText(item.street, address.street) && sameText(item.apartment, address.apartment),
  )
  if (twin) return { ok: false, error: 'duplicate' }

  const saved = {
    id: existing?.id || newId('a'),
    label: String(address.label || '').trim(),
    street: String(address.street).trim(),
    apartment: String(address.apartment || '').trim(),
    intercom: String(address.intercom || '').trim(),
    isDefault: Boolean(address.isDefault) || !list.length || Boolean(existing?.isDefault),
    createdAt: existing?.createdAt || new Date().toISOString(),
  }

  updateUserRecord(user.id, (record) => {
    const rest = record.addresses.filter((item) => item.id !== saved.id)
    const others = saved.isDefault ? rest.map((item) => ({ ...item, isDefault: false })) : rest
    const at = record.addresses.findIndex((item) => item.id === saved.id)
    const next = [...others]
    next.splice(at === -1 ? next.length : at, 0, saved)
    return { ...record, addresses: next }
  })
  return { ok: true, address: copyOf(saved) }
}

/** Удалили основной — основным становится адрес с самым ранним createdAt. */
export async function deleteAddress(id) {
  const user = currentUser()
  if (!user) return
  updateUserRecord(user.id, (record) => {
    const removed = record.addresses.find((item) => item.id === id)
    const rest = record.addresses.filter((item) => item.id !== id)
    if (removed?.isDefault && rest.length) {
      const earliest = [...rest].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
      return { ...record, addresses: rest.map((item) => ({ ...item, isDefault: item.id === earliest.id })) }
    }
    return { ...record, addresses: rest }
  })
}

export async function setDefaultAddress(id) {
  const user = currentUser()
  if (!user) return
  updateUserRecord(user.id, (record) => ({
    ...record,
    addresses: record.addresses.map((item) => ({ ...item, isDefault: item.id === id })),
  }))
}

/* --------------------------------------------------------------- профиль */

export async function saveProfile({ name = '', lastName = '', email = '', marketing = false }) {
  const user = currentUser()
  if (!user) return { ok: false, errors: {} }

  const emailError = optionalEmail(email)
  if (emailError) return { ok: false, errors: { email: emailError } }

  return writeProfile(user.id, {
    name: name.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    marketing: Boolean(marketing),
  })
}

/** Номер, на который сейчас выдан код смены. Живёт до подтверждения. */
let pendingPhone = null

export async function requestPhoneChange(phone) {
  await wait()
  const user = currentUser()
  const digits = phoneDigits(phone)
  if (!user) return { ok: false, error: 'expired' }
  if (digits === user.phone) return { ok: false, error: 'same_phone' }

  const owner = loadUsers().byPhone[digits]
  if (owner && owner !== user.id) return { ok: false, error: 'phone_taken' }

  const result = issueCode(digits, { changeFor: user.id })
  if (result.ok) pendingPhone = digits
  return result
}

export async function confirmPhoneChange(code) {
  await wait()
  const user = currentUser()
  if (!user || !pendingPhone) return { ok: false, error: 'expired' }

  const result = checkCode(pendingPhone, code)
  if (!result.ok) return result

  const users = loadUsers()
  delete users.byPhone[user.phone]
  users.byPhone[pendingPhone] = user.id
  users.byId[user.id].profile = { ...users.byId[user.id].profile, phone: pendingPhone }
  saveUsers(users)
  pendingPhone = null

  // Заказы остаются в кабинете: они привязаны по userId, а не по номеру.
  emitChange()
  return { ok: true, user: copyOf(users.byId[user.id].profile) }
}

/**
 * Удаляет запись пользователя, адреса, избранное и его корзину.
 * Заказы и заявки остаются у магазина.
 */
export async function deleteAccount() {
  const user = currentUser()
  if (!user) return { ok: true }

  const users = loadUsers()
  delete users.byId[user.id]
  delete users.byPhone[user.phone]
  saveUsers(users)
  removeUserCart(user.id)
  clearSession()
  emitChange()
  return { ok: true }
}

/* ------------------------------------------------------------- избранное */

function readFavorites() {
  const user = currentUser()
  return user ? loadUserRecord(user.id)?.favorites || [] : loadGuestFavorites()
}

function writeFavorites(items) {
  const user = currentUser()
  if (user) updateUserRecord(user.id, (record) => ({ ...record, favorites: items }))
  else saveGuestFavorites(items)
}

/** Снимки позиций: у вошедшего — из кабинета, у гостя — из браузера. */
export async function getFavorites() {
  return copyOf(readFavorites())
}

/**
 * @param {object} snapshot снимок позиции (см. favorites/store.js)
 * @param {number} [index]  место в списке — для «Вернуть»; без него — сверху
 */
export async function addFavorite(snapshot, index = 0) {
  const items = readFavorites().filter((item) => item.id !== snapshot.id)
  items.splice(Math.max(0, Math.min(index, items.length)), 0, snapshot)

  // Переполнение: уходят самые старые.
  while (items.length > MAX_FAVORITES) {
    const oldest = items.reduce((min, item) => (String(item.addedAt) < String(min.addedAt) ? item : min))
    items.splice(items.indexOf(oldest), 1)
  }
  writeFavorites(items)
}

export async function removeFavorite(id) {
  writeFavorites(readFavorites().filter((item) => item.id !== id))
}

/** Синхронное чтение для первой отрисовки: шапке нужен счётчик сразу. */
export const peekFavorites = () => copyOf(readFavorites())
