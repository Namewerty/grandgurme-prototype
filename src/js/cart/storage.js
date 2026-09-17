/* ============================================================================
   Хранилище корзины, заказов и заявок прототипа. Один из ДВУХ файлов, которые
   трогают localStorage; второй — src/js/account/storage.js (сессия,
   пользователи, избранное гостя).

   ЗАЧЕМ ОТДЕЛЬНО. На Битриксе корзина живёт в sale.basket, а заказ — в
   sale.order. При переносе этот файл заменяется запросами к ним, а store.js,
   страницы корзины и оформления остаются как есть. Если бы localStorage
   читался ещё где-нибудь, перенос превратился бы в поиск по всему проекту.

   ВСЁ В TRY/CATCH. В приватном режиме части браузеров и при выключенных
   cookie чтение и запись бросают исключение. Корзина обязана работать и
   тогда — просто без сохранения между перезагрузками: страница живёт на
   состоянии в памяти (см. store.js).

   ВЕРСИЯ В ЗАПИСИ. Поменяется форма позиции — поднимаем VERSION, и старые
   записи честно считаются пустой корзиной, а не ломают страницу полями,
   которых код больше не ждёт.

   ВЕРСИЯ 2 (16.09.2026): у позиции появились kind и categorySlug. Корзины
   первой версии честно читаются пустыми — вид позиции в них угадывать
   нельзя, он считается один раз, в kindOf.

   ВЕРСИЯ 3 КОРЗИНЫ (16.09.2026, вечер): у позиции появилось поле
   fulfillment — без него вид «под заказ» у позиции, помеченной так в обход
   раздела, терялся и она уезжала в заявку. Версия 2 ЧИТАЕТСЯ, а не
   обнуляется: недостающий fulfillment берётся из каталога по слагу, вид
   заново считает store.js. Обнулять нельзя — вкладки, открытые до выкладки,
   ещё пишут версию 2, и новая страница корзины показывала бы пустоту,
   пока человек не перезагрузит всё. Заказы и заявки остаются на версии 2.

   КОРЗИНА ПО ПОЛЬЗОВАТЕЛЮ (17.09.2026). Ключ корзины — gg-cart у гостя
   и gg-cart:<userId> у вошедшего. Текущий ключ определяется при КАЖДОМ чтении
   и записи через account/session.js, а не запоминается: вход и выход меняют
   его посреди жизни страницы. При входе гостевая корзина складывается
   с корзиной кабинета (mergeGuestCart): одинаковые позиции не удваиваются,
   остаётся большее количество; гостевой ключ удаляется. При выходе корзина
   остаётся под ключом пользователя, а гостевая пуста. На Битриксе сессии
   прототипа нет, и корзина гостя по-прежнему читает gg-cart.

   БЕЗ LOCALSTORAGE ЗАПИСИ ЖИВУТ В ПАМЯТИ МОДУЛЯ по тем же ключам. Так вход
   в приватном режиме не теряет гостевую корзину: слияние читает её из памяти.

   ЗАКАЗЫ И ЗАЯВКИ КАБИНЕТА. listOrders / listRequests отдают все записи
   браузера, принадлежность (userId) проверяет api.js. Номера от 90001
   (заказы) и 9001 (заявки) заняты демонстрацией кабинета
   (src/js/account/demo.js) и в счётчик настоящих номеров не входят.

   ЗАЯВКИ МЕНЕДЖЕРУ лежат рядом с заказами, под своим ключом gg-requests
   и со своим счётчиком номеров. На Битриксе заявка — элемент инфоблока
   «Заявки менеджеру», а не заказ магазина: в обмен с 1С она не попадает.
   ============================================================================ */

import { findProductBySlug } from '../../data/catalog-products.js'
import { currentUserId } from '../account/session.js'

const CART_KEY = 'gg-cart'
const ORDERS_KEY = 'gg-orders'
const REQUESTS_KEY = 'gg-requests'
const CART_VERSION = 3
const CART_VERSIONS_READ = [2, 3]
const RECORD_VERSION = 2

/**
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: формат номера заказа. В прототипе номер
 * локальный — счётчик в этом браузере, начатый с 10241 ради правдоподобного
 * вида. Настоящий номер присвоит sale.order на Битриксе.
 */
const FIRST_ORDER_NUMBER = 10241

/**
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: формат номера заявки. В прототипе — локальный
 * счётчик с 501; на Битриксе номер заявки — ID элемента инфоблока.
 */
const FIRST_REQUEST_NUMBER = 501

/** С этих номеров начинаются записи демонстрации кабинета (account/demo.js). */
export const DEMO_ORDER_FROM = 90001
export const DEMO_REQUEST_FROM = 9001

/** Больше в одну позицию не кладём. Граница общая для стора и слияния корзин. */
export const MAX_QTY = 99

const emptyCart = () => ({ items: [], promo: '' })

/** Записи, которые не удалось положить в localStorage. */
const memory = new Map()

function read(key) {
  if (memory.has(key)) return memory.get(key)
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    memory.delete(key)
    return true
  } catch {
    memory.set(key, value)
    return false
  }
}

function drop(key) {
  memory.delete(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* приватный режим: в хранилище записи и не было */
  }
}

/* --------------------------------------------------------------- корзина */

/** Позиция версии 2 — без fulfillment; берём его из каталога по слагу. */
const upgradeLine = (line) =>
  line && line.fulfillment === undefined
    ? { ...line, fulfillment: findProductBySlug(line.slug)?.fulfillment ?? null }
    : line

/** Ключ корзины: гостевой или пользователя. Считается при каждом обращении. */
const cartKeyOf = (userId) => (userId ? `${CART_KEY}:${userId}` : CART_KEY)
const currentCartKey = () => cartKeyOf(currentUserId())

function readCart(key) {
  const data = read(key)
  if (!data || !CART_VERSIONS_READ.includes(data.version) || !Array.isArray(data.items)) return emptyCart()
  return {
    items: data.items.map(upgradeLine),
    promo: typeof data.promo === 'string' ? data.promo : '',
  }
}

export const loadCart = () => readCart(currentCartKey())

export function saveCart({ items, promo }) {
  return write(currentCartKey(), { version: CART_VERSION, items, promo })
}

/**
 * Корзину поменяли в соседней вкладке. Событие storage приходит только
 * в чужие вкладки, поэтому свои изменения сюда не возвращаются. Слушается
 * ТЕКУЩИЙ ключ: после входа в соседней вкладке это уже корзина кабинета.
 */
export function onExternalCartChange(fn) {
  window.addEventListener('storage', (event) => {
    if (event.key === currentCartKey()) fn(loadCart())
  })
}

/**
 * Вход: гостевая корзина складывается с корзиной кабинета. Одинаковые
 * позиции не удваиваются — остаётся большее из двух количеств, не больше
 * MAX_QTY. Порядок: сначала то, что уже лежало в кабинете, затем новое
 * из гостевой. Гостевой ключ после этого удаляется.
 */
export function mergeGuestCart(userId) {
  if (!userId) return
  const guest = readCart(CART_KEY)
  const own = readCart(cartKeyOf(userId))

  const items = own.items.map((line) => ({ ...line }))
  guest.items.forEach((line) => {
    const same = items.find((item) => item.id === line.id)
    if (same) same.qty = Math.min(MAX_QTY, Math.max(Number(same.qty) || 0, Number(line.qty) || 0))
    else items.push({ ...line, qty: Math.min(MAX_QTY, Number(line.qty) || 1) })
  })

  write(cartKeyOf(userId), { version: CART_VERSION, items, promo: own.promo || guest.promo })
  drop(CART_KEY)
}

/** Удаление кабинета: корзина пользователя уходит вместе с ним. */
export function removeUserCart(userId) {
  if (userId) drop(cartKeyOf(userId))
}

/* -------------------------------------------------------- заказы и заявки */

const listOf = (key) => {
  const data = read(key)
  return data?.version === RECORD_VERSION && data.list ? data.list : {}
}

/**
 * Запись с номером под ключом; номер — следующий после последнего.
 * Номера демонстрации (от demoFrom) в счёт не идут: иначе после показа
 * кабинета настоящий заказ получил бы номер 90100.
 */
function saveNumbered(key, first, demoFrom, record) {
  const list = listOf(key)
  const numbers = Object.keys(list)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n < demoFrom)
  const last = Math.max(first - 1, ...numbers)
  const number = last + 1

  list[number] = { ...record, number }
  write(key, { version: RECORD_VERSION, list })
  return number
}

const loadNumbered = (key, number) => listOf(key)[number] || null

function updateNumbered(key, number, patch) {
  const list = listOf(key)
  if (!list[number]) return null
  list[number] = { ...list[number], ...patch, number: list[number].number }
  write(key, { version: RECORD_VERSION, list })
  return list[number]
}

/**
 * Демонстрация кабинета: убрать записи по условию и положить новые под
 * заданными номерами. Чужие записи не трогаются. Только для account/demo.js.
 */
function replaceNumbered(key, shouldRemove, records) {
  const list = listOf(key)
  Object.keys(list).forEach((number) => {
    if (shouldRemove(list[number])) delete list[number]
  })
  records.forEach((record) => {
    list[record.number] = record
  })
  write(key, { version: RECORD_VERSION, list })
}

/** Кладёт заказ и возвращает присвоенный номер. */
export const saveOrder = (order) => saveNumbered(ORDERS_KEY, FIRST_ORDER_NUMBER, DEMO_ORDER_FROM, order)

/** Заказ по номеру. null — такого в этом браузере нет или хранилище недоступно. */
export const loadOrder = (number) => loadNumbered(ORDERS_KEY, number)

/** Кладёт заявку менеджеру и возвращает её номер. */
export const saveRequest = (request) =>
  saveNumbered(REQUESTS_KEY, FIRST_REQUEST_NUMBER, DEMO_REQUEST_FROM, request)

/** Заявка по номеру. null — из другого браузера или хранилище недоступно. */
export const loadRequest = (number) => loadNumbered(REQUESTS_KEY, number)

/** Все заказы и заявки этого браузера. Чьи они — решает api.js по userId. */
export const listOrders = () => Object.values(listOf(ORDERS_KEY))
export const listRequests = () => Object.values(listOf(REQUESTS_KEY))

/** Правка записи: привязка к пользователю при входе, статус. */
export const updateOrder = (number, patch) => updateNumbered(ORDERS_KEY, number, patch)
export const updateRequest = (number, patch) => updateNumbered(REQUESTS_KEY, number, patch)

export const replaceDemoOrders = (shouldRemove, records) => replaceNumbered(ORDERS_KEY, shouldRemove, records)
export const replaceDemoRequests = (shouldRemove, records) => replaceNumbered(REQUESTS_KEY, shouldRemove, records)
