/* ============================================================================
   Хранилище корзины и заказов прототипа. ЕДИНСТВЕННЫЙ файл, который трогает
   localStorage.

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

   ЗАЯВКИ МЕНЕДЖЕРУ лежат рядом с заказами, под своим ключом gg-requests
   и со своим счётчиком номеров. На Битриксе заявка — элемент инфоблока
   «Заявки менеджеру», а не заказ магазина: в обмен с 1С она не попадает.
   ============================================================================ */

import { findProductBySlug } from '../../data/catalog-products.js'

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

const emptyCart = () => ({ items: [], promo: '' })

function read(key) {
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
    return true
  } catch {
    return false
  }
}

/* --------------------------------------------------------------- корзина */

/** Позиция версии 2 — без fulfillment; берём его из каталога по слагу. */
const upgradeLine = (line) =>
  line && line.fulfillment === undefined
    ? { ...line, fulfillment: findProductBySlug(line.slug)?.fulfillment ?? null }
    : line

export function loadCart() {
  const data = read(CART_KEY)
  if (!data || !CART_VERSIONS_READ.includes(data.version) || !Array.isArray(data.items)) return emptyCart()
  return {
    items: data.items.map(upgradeLine),
    promo: typeof data.promo === 'string' ? data.promo : '',
  }
}

export function saveCart({ items, promo }) {
  return write(CART_KEY, { version: CART_VERSION, items, promo })
}

/**
 * Корзину поменяли в соседней вкладке. Событие storage приходит только
 * в чужие вкладки, поэтому свои изменения сюда не возвращаются.
 */
export function onExternalCartChange(fn) {
  window.addEventListener('storage', (event) => {
    if (event.key === CART_KEY) fn(loadCart())
  })
}

/* -------------------------------------------------------- заказы и заявки */

/** Запись с номером под ключом; номер — следующий после последнего. */
function saveNumbered(key, first, record) {
  const data = read(key)
  const list = data?.version === RECORD_VERSION && data.list ? data.list : {}
  const last = Math.max(first - 1, ...Object.keys(list).map(Number).filter(Number.isFinite))
  const number = last + 1

  list[number] = { ...record, number }
  write(key, { version: RECORD_VERSION, list })
  return number
}

function loadNumbered(key, number) {
  const data = read(key)
  if (data?.version !== RECORD_VERSION || !data.list) return null
  return data.list[number] || null
}

/** Кладёт заказ и возвращает присвоенный номер. */
export const saveOrder = (order) => saveNumbered(ORDERS_KEY, FIRST_ORDER_NUMBER, order)

/** Заказ по номеру. null — такого в этом браузере нет или хранилище недоступно. */
export const loadOrder = (number) => loadNumbered(ORDERS_KEY, number)

/** Кладёт заявку менеджеру и возвращает её номер. */
export const saveRequest = (request) => saveNumbered(REQUESTS_KEY, FIRST_REQUEST_NUMBER, request)

/** Заявка по номеру. null — из другого браузера или хранилище недоступно. */
export const loadRequest = (number) => loadNumbered(REQUESTS_KEY, number)
