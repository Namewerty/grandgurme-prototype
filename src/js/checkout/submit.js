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
import { loadOrder, loadRequest, saveOrder, saveRequest, updateOrder } from '../cart/storage.js'
import { clear } from '../cart/store.js'
import { saveAddress } from '../account/api.js'

/**
 * КАБИНЕТ (17.09.2026). Заказ и заявка вошедшего сохраняются с его userId;
 * у гостя userId пустой — при входе с номером из контактов api.js привяжет
 * запись сам. Новый заказ получает статус 'accepted', каждая его отгрузка —
 * 'accepted', заявка — 'new'; если заявка ушла вместе с заказом, её номер
 * пишется в заказ (requestNumber). Отмеченный новый адрес сохраняется
 * в кабинет через saveAddress; повтор сохранённого адреса и одиннадцатый
 * адрес api.js молча не сохраняет — оформлению это не мешает.
 *
 * @param {object} payload { mode, contact, order|null, request|null } —
 *   см. collectPayload в checkout-page.js. contact.userId — вошедший или null.
 *   У заказа shipments: одна или две отгрузки, у каждой items (id позиций),
 *   date, interval; addressId — выбранный сохранённый адрес либо null
 *   и saveAddress — сохранить ли введённый.
 * @returns {Promise<{ order: number|null, request: number|null }>}
 */
export async function submitCheckout(payload) {
  const createdAt = new Date().toISOString()
  const { userId = null, ...contact } = payload.contact

  let order = null
  if (payload.order) {
    const { saveAddress: wantsSave, ...data } = payload.order
    order = saveOrder({
      ...data,
      shipments: data.shipments.map((shipment) => ({ ...shipment, status: 'accepted' })),
      contact,
      createdAt,
      userId,
      status: 'accepted',
      requestNumber: null,
    })

    if (userId && wantsSave && data.receive?.method === 'delivery') {
      const { street, apartment, intercom } = data.receive
      await saveAddress({ street, apartment, intercom })
    }
  }

  const request = payload.request
    ? saveRequest({ ...payload.request, contact, orderNumber: order, createdAt, userId, status: 'new' })
    : null
  if (order && request) updateOrder(order, { requestNumber: request })

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
