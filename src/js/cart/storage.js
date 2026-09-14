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
   ============================================================================ */

const CART_KEY = 'gg-cart'
const ORDERS_KEY = 'gg-orders'
const VERSION = 1

/**
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: формат номера заказа. В прототипе номер
 * локальный — счётчик в этом браузере, начатый с 10241 ради правдоподобного
 * вида. Настоящий номер присвоит sale.order на Битриксе.
 */
const FIRST_ORDER_NUMBER = 10241

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

export function loadCart() {
  const data = read(CART_KEY)
  if (!data || data.version !== VERSION || !Array.isArray(data.items)) return emptyCart()
  return {
    items: data.items,
    promo: typeof data.promo === 'string' ? data.promo : '',
  }
}

export function saveCart({ items, promo }) {
  return write(CART_KEY, { version: VERSION, items, promo })
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

/* ---------------------------------------------------------------- заказы */

/** Кладёт заказ и возвращает присвоенный номер. */
export function saveOrder(order) {
  const data = read(ORDERS_KEY)
  const orders = data?.version === VERSION && data.orders ? data.orders : {}
  const last = Math.max(FIRST_ORDER_NUMBER - 1, ...Object.keys(orders).map(Number).filter(Number.isFinite))
  const number = last + 1

  orders[number] = { ...order, number }
  write(ORDERS_KEY, { version: VERSION, orders })
  return number
}

/** Заказ по номеру. null — такого в этом браузере нет или хранилище недоступно. */
export function loadOrder(number) {
  const data = read(ORDERS_KEY)
  if (data?.version !== VERSION || !data.orders) return null
  return data.orders[number] || null
}
