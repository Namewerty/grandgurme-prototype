/* ============================================================================
   Отправка оформления. ОДНА функция, и на Битриксе она заменяется целиком.

   Одна форма может родить два документа: ЗАКАЗ (позиции в наличии и под
   заказ, оплачивается на сайте) и ЗАЯВКУ менеджеру (позиции, которые
   оплатить нельзя). В прототипе оба никуда не уходят: кладутся в хранилище
   браузера, получают номера, корзина очищается целиком, и страница уводит на
   /order-success?n=<номер заказа>&r=<номер заявки>. Любого из параметров
   может не быть.

   На Битриксе здесь запрос к серверу: заказ — sale.order, заявка — элемент
   инфоблока «Заявки менеджеру» и почтовое событие. Сначала заказ; не создался —
   ошибка на форме, и заявка тоже не создаётся. Форма, проверка полей
   и страница успеха остаются как есть.

   Номера берутся из адреса страницы успеха, а не из памяти: так страницу
   можно перезагрузить или открыть из письма.
   ============================================================================ */

import { ROUTES } from '../../data/routes.js'
import { loadOrder, loadRequest, saveOrder, saveRequest } from '../cart/storage.js'
import { clear } from '../cart/store.js'

/**
 * @param {object} payload { mode, contact, order|null, request|null } —
 *   см. collectPayload в checkout-page.js. У заказа shipments: одна или две
 *   отгрузки, у каждой items (id позиций), date, interval.
 * @returns {Promise<{ order: number|null, request: number|null }>}
 */
export async function submitCheckout(payload) {
  const createdAt = new Date().toISOString()
  const { contact } = payload

  const order = payload.order ? saveOrder({ ...payload.order, contact, createdAt }) : null
  const request = payload.request
    ? saveRequest({ ...payload.request, contact, orderNumber: order, createdAt })
    : null

  clear()

  const params = new URLSearchParams()
  if (order) params.set('n', String(order))
  if (request) params.set('r', String(request))
  location.assign(`${ROUTES.orderSuccess}?${params}`)

  return { order, request }
}

/**
 * Заказ для страницы «Заказ принят». На Битриксе — запрос к серверу
 * по номеру и сессии. null — заказ из другого браузера или номер набран
 * руками: страница тогда показывает шаги без состава.
 */
export const getOrder = (number) => loadOrder(number)

/** Заявка по номеру — те же правила, что у заказа. */
export const getRequest = (number) => loadRequest(number)
