/* ============================================================================
   Демонстрационные наполнения кабинета. ИНСТРУМЕНТ ПОКАЗА, А НЕ ЧАСТЬ МАГАЗИНА.

   Собирать кабинет руками перед каждым показом долго: нужен вход, несколько
   заказов в разных статусах, адреса и избранное. Параметр ?demo=… работает
   на любой странице кабинета и на /favorites и убирается из адреса
   (history.replaceState), чтобы перезагрузка не сбрасывала то, что человек
   успел поменять:

     ?demo=account  вход демонстрационным пользователем «Анна»,
                    +7 900 000-00-00. Запись пользователя пересоздаётся, его
                    прежние заказы и заявки удаляются и кладутся заново;
                    чужие записи не трогаются. Гостевая корзина и гостевое
                    избранное при этом входе не сливаются и не меняются.
                    В листе ожидания три записи с разными датами:
                    beluga-royal-metall-125 (ждём), keta-steklo-250 (ждём)
                    и test-ikra-v-nalichii (поступил) — на обзоре из-за неё
                    строка «Поступили товары из листа ожидания: 1»;
     ?demo=new      только на /account/login: запись +7 900 000-00-01
                    удаляется, если была, создаётся заново, и открывается
                    шаг 3 «Как к вам обращаться»;
     ?demo=guest    выход.

   ВСЕ ДАННЫЕ ВЫМЫШЛЕННЫЕ: имя, номера телефонов из диапазона 900 000-00-0x,
   адреса «Примерная улица» и «Образцовый проезд». Позиции заказов и
   избранного — настоящие из catalog-products.js, снимками, как их кладёт
   корзина. Даты считаются от сегодняшнего дня.

   Номера демонстрационных заказов — от 90001, заявок — от 9001, чтобы не
   пересекаться со счётчиками прототипа (10241 и 501); в счётчик настоящих
   номеров они не входят (см. cart/storage.js).

   Подключается только точкой входа прототипа src/account.js. В сборку
   Битрикса не попадает: src/bitrix/main.js этот файл не импортирует.
   ============================================================================ */

import { isBox, packPrice, pickPacks } from '../../data/boxes.js'
import { findProductBySlug } from '../../data/catalog-products.js'
import { checkoutCopy } from '../../data/checkout-copy.js'
import { addDays, kindOf, toIsoDay } from '../../data/fulfillment.js'
import { lineSum } from '../cart/summary.js'
import { pickupPoints } from '../../data/offline.js'
import { ROUTES } from '../../data/routes.js'
import { DEMO_ORDER_FROM, DEMO_REQUEST_FROM, replaceDemoOrders, replaceDemoRequests } from '../cart/storage.js'
import { formatPhone } from '../checkout/validate.js'
import { logout, openSession } from './api.js'
import { loadUsers, saveUsers } from './storage.js'

const ANNA = { id: 'demo-anna', phone: '9000000000', name: 'Анна' }
const OTHER = { id: 'demo-other', phone: '9000000002', name: 'Демо' }
const NEWCOMER = { id: 'demo-new', phone: '9000000001', name: '' }
const DEMO_IDS = [ANNA.id, OTHER.id]

const INTERVALS = checkoutCopy.when.intervals
const CITY = checkoutCopy.receive.city.value

const profileOf = ({ id, phone, name }) => ({
  id,
  phone,
  name,
  lastName: '',
  email: '',
  marketing: false,
  createdAt: new Date().toISOString(),
})

/**
 * Снимок позиции каталога — в том виде, в каком её кладёт корзина, а для
 * заказа — строка заказа: у коробочной позиции выбранные коробки с весом
 * и ценой (packIds — заданные, иначе подбор по номиналу), у коробки под
 * заказ — пусто и approx. У оформленного заказа вес уже известен: «≈» там
 * быть не должно.
 */
function line(slug, qty = 1, { packIds = null } = {}) {
  const product = findProductBySlug(slug)
  if (!product) return null
  const snapshot = {
    id: String(product.id),
    slug,
    name: product.name,
    note: product.weightLabel,
    href: ROUTES.product(slug),
    image: product.photo,
    price: typeof product.price === 'number' ? product.price : null,
    qty,
    inStock: product.inStock !== false,
    categorySlug: product.categorySlug,
    fulfillment: product.fulfillment === 'preorder' ? 'preorder' : null,
    sale: isBox(product) ? 'box' : null,
    nominalG: isBox(product) ? product.nominalG : null,
    pricePerKg: isBox(product) ? product.pricePerKg : null,
  }
  let boxes = null
  if (isBox(product)) {
    const picked = !product.inStock
      ? []
      : packIds
        ? packIds.map((id) => product.packs.find((pack) => pack.id === id)).filter(Boolean)
        : pickPacks(product.packs, qty, product.nominalG)
    boxes = {
      nominalG: product.nominalG,
      pricePerKg: product.pricePerKg,
      packs: picked.map((pack) => ({ id: pack.id, weightG: pack.weightG, price: packPrice(product.pricePerKg, pack.weightG) })),
      approx: !product.inStock,
    }
  }
  return { ...snapshot, kind: kindOf(snapshot), boxes }
}

const lines = (...items) => items.map(([slug, qty, options]) => line(slug, qty, options)).filter(Boolean)

const isoAt = (daysAgo, hour) => {
  const day = addDays(new Date(), -daysAgo)
  day.setHours(hour, 15, 0, 0)
  return day.toISOString()
}

/** Итоги — той же функцией суммы строки, что у корзины и заказа (lineSum). */
const totalsOf = (items, readyAt) => {
  const sums = items.map((item) => lineSum(item))
  return {
    count: items.reduce((n, item) => n + item.qty, 0),
    positions: items.length,
    sum: Math.round(sums.reduce((n, sum) => n + (sum.value || 0), 0) * 100) / 100,
    approx: sums.some((sum) => sum.approx),
    readyAt: toIsoDay(readyAt),
  }
}

const contactOf = (user) => ({ name: user.name, phone: formatPhone(user.phone), email: '' })

const HOME = { method: 'delivery', city: CITY, street: 'Примерная улица, 1', apartment: '5', intercom: '5' }
const PICKUP = { method: 'pickup', point: pickupPoints[0] || null }

function order({ number, user, daysAgo, receive, shipments, items, status, requestNumber = null, payment = 'card' }) {
  const readyAt = addDays(new Date(), -daysAgo + (shipments.length === 2 ? 7 : 0))
  return {
    number,
    userId: user.id,
    createdAt: isoAt(daysAgo, 11),
    contact: contactOf(user),
    receive,
    shipments,
    payment,
    comment: '',
    promo: '',
    items,
    totals: totalsOf(items, readyAt),
    status,
    requestNumber,
  }
}

const ids = (items) => items.map((item) => item.id)
const dayFrom = (offset) => toIsoDay(addDays(new Date(), offset))

function demoOrders() {
  const first = DEMO_ORDER_FROM

  // Две отгрузки: наличие «В пути» сегодня, под заказ «Ждём поставку» к дню готовности.
  // Лосось нежно подвяленный — две коробки 204 и 206 г, 5 289 ₽ (коробки, src/data/boxes.js).
  const stock = lines(
    ['losos-file-hk-klassicheskiy-100', 2],
    ['nerka-file-hk-150', 1],
    ['losos-hk-korobka-146', 1],
    [
      'losos-nezhno-podvyalenyy-korobka',
      2,
      { packIds: ['losos-nezhno-podvyalenyy-korobka-204', 'losos-nezhno-podvyalenyy-korobka-206'] },
    ],
  )
  const preorder = lines(['forel-file-hk-ukrop-100', 1], ['ugor-gk-120', 1])

  const pickupItems = lines(['losos-file-slaboy-soli-100', 1], ['pashtet-losos-tsitrus-180', 2])
  const doneItems = lines(['losos-apelsin-hk-168', 1], ['forel-file-slaboy-soli-100', 2])
  const olderItems = lines(['nerka-file-hk-150', 2], ['losos-file-hk-klassicheskiy-100', 1])
  const canceledItems = lines(['losos-hk-korobka-146', 1])

  return [
    order({
      number: first + 4,
      user: ANNA,
      daysAgo: 0,
      receive: HOME,
      items: [...stock, ...preorder],
      shipments: [
        { kind: 'stock', items: ids(stock), date: dayFrom(0), interval: INTERVALS[2], status: 'on_way' },
        { kind: 'preorder', items: ids(preorder), date: dayFrom(7), interval: INTERVALS[0], status: 'waiting' },
      ],
      status: 'waiting',
      requestNumber: DEMO_REQUEST_FROM + 1,
    }),
    order({
      number: first + 3,
      user: ANNA,
      daysAgo: 1,
      receive: PICKUP,
      items: pickupItems,
      shipments: [{ kind: 'all', items: ids(pickupItems), date: dayFrom(0), interval: INTERVALS[1], status: 'ready' }],
      status: 'ready',
      payment: 'on-receipt',
    }),
    order({
      number: first + 2,
      user: ANNA,
      daysAgo: 6,
      receive: HOME,
      items: doneItems,
      shipments: [{ kind: 'all', items: ids(doneItems), date: dayFrom(-5), interval: INTERVALS[1], status: 'done' }],
      status: 'done',
      payment: 'sbp',
    }),
    // Заказ прошлого месяца.
    order({
      number: first + 1,
      user: ANNA,
      daysAgo: 36,
      receive: { ...HOME, street: 'Образцовый проезд, 10', apartment: 'офис 12', intercom: '' },
      items: olderItems,
      shipments: [{ kind: 'all', items: ids(olderItems), date: dayFrom(-35), interval: INTERVALS[0], status: 'done' }],
      status: 'done',
    }),
    order({
      number: first,
      user: ANNA,
      daysAgo: 50,
      receive: HOME,
      items: canceledItems,
      shipments: [
        { kind: 'all', items: ids(canceledItems), date: dayFrom(-49), interval: INTERVALS[3], status: 'accepted' },
      ],
      status: 'canceled',
    }),
    // Чужой заказ — для проверки «Заказ не найден».
    order({
      number: first + 98,
      user: OTHER,
      daysAgo: 2,
      receive: { ...HOME, street: 'Примерная улица, 2', apartment: '', intercom: '' },
      items: canceledItems,
      shipments: [
        { kind: 'all', items: ids(canceledItems), date: dayFrom(-1), interval: INTERVALS[1], status: 'assembling' },
      ],
      status: 'assembling',
    }),
  ]
}

function demoRequests() {
  const first = DEMO_REQUEST_FROM
  return [
    {
      number: first + 1,
      userId: ANNA.id,
      createdAt: isoAt(0, 11),
      contact: contactOf(ANNA),
      items: lines(['beluga-royal-metall-125', 1], ['beluga-royal-metall-50', 2], ['beluga-diamond-metall-125', 1]),
      contactWay: 'whatsapp',
      question: 'Нужно к пятнице — успеете?',
      orderNumber: DEMO_ORDER_FROM + 4,
      status: 'in_work',
    },
    {
      number: first,
      userId: ANNA.id,
      createdAt: isoAt(40, 16),
      contact: contactOf(ANNA),
      items: lines(['beluga-royal-metall-250', 1]),
      contactWay: 'call',
      question: '',
      orderNumber: null,
      status: 'closed',
    },
  ]
}

function demoAddresses() {
  const createdAt = isoAt(60, 10)
  return [
    { id: 'demo-home', label: 'Дом', street: HOME.street, apartment: '5', intercom: '5', isDefault: true, createdAt },
    {
      id: 'demo-work',
      label: 'Работа',
      street: 'Образцовый проезд, 10',
      apartment: 'офис 12',
      intercom: '',
      isDefault: false,
      createdAt: isoAt(30, 10),
    },
  ]
}

/** Три в наличии, две рыбы под заказ, чёрная икра без цены и снятая с продажи позиция. */
function demoFavorites() {
  const slugs = [
    'losos-file-slaboy-soli-100',
    'klykach-file-hk-206',
    'beluga-royal-metall-125',
    'pashtet-losos-tsitrus-180',
    'paltus-file-gk-perets-150',
    'losos-apelsin-hk-168',
  ]
  const items = slugs.map((slug, i) => {
    // Снимок избранного — без количества, вида и коробок заказа.
    const { qty, kind, boxes, ...snapshot } = line(slug) || {}
    return snapshot.id ? { ...snapshot, addedAt: isoAt(i, 12) } : null
  })
  // Слага нет в каталоге: стор выбросит позицию и покажет строку «больше не продаются».
  items.push({
    id: 'demo-gone',
    slug: 'demo-snyato-s-prodazhi',
    name: 'Демонстрационная позиция, снятая с продажи',
    note: '100 г',
    href: ROUTES.catalog,
    image: null,
    price: 990,
    inStock: true,
    categorySlug: 'ryba',
    fulfillment: null,
    addedAt: isoAt(20, 12),
  })
  return items.filter(Boolean)
}

/**
 * Лист ожидания: две позиции не на складе (чёрная икра — заявка, красная —
 * под заказ) и одна тестовая в наличии — она «поступила». Даты разные:
 * порядок внутри группы «ждём» должен быть виден.
 */
function demoWaitlist() {
  const slugs = ['beluga-royal-metall-125', 'keta-steklo-250', 'test-ikra-v-nalichii']
  return slugs
    .map((slug, i) => {
      const product = findProductBySlug(slug)
      if (!product) return null
      return {
        id: String(product.id),
        slug,
        name: product.name,
        note: product.weightLabel,
        href: ROUTES.product(slug),
        image: product.photo,
        addedAt: isoAt(i * 3 + 1, 14),
      }
    })
    .filter(Boolean)
}

function putUser(users, user, record) {
  Object.keys(users.byPhone).forEach((phone) => {
    if (users.byPhone[phone] === user.id) delete users.byPhone[phone]
  })
  // Номер мог быть занят настоящей записью прототипа — демонстрация его забирает.
  const owner = users.byPhone[user.phone]
  if (owner && owner !== user.id) delete users.byId[owner]
  users.byId[user.id] = record
  users.byPhone[user.phone] = user.id
}

function loginAsAnna() {
  const users = loadUsers()
  const profile = profileOf(ANNA)
  putUser(users, ANNA, {
    profile,
    addresses: demoAddresses(),
    favorites: demoFavorites(),
    waitlist: demoWaitlist(),
  })
  putUser(users, OTHER, { profile: profileOf(OTHER), addresses: [], favorites: [], waitlist: [] })
  saveUsers(users)

  const isDemo = (record) => DEMO_IDS.includes(record.userId)
  replaceDemoOrders(isDemo, demoOrders())
  replaceDemoRequests(isDemo, demoRequests())

  openSession(profile, { mergeGuest: false })
}

function loginAsNewcomer() {
  const users = loadUsers()
  const profile = profileOf(NEWCOMER)
  putUser(users, NEWCOMER, { profile, addresses: [], favorites: [], waitlist: [] })
  saveUsers(users)
  openSession(profile, { mergeGuest: false })
}

/**
 * Читает ?demo= и готовит наполнение. Зовётся точкой входа ДО шапки: счётчики
 * сразу показывают подменённое состояние.
 * @returns {Promise<{ loginStep?: 'profile' }>}
 */
export async function applyAccountDemo() {
  const url = new URL(location.href)
  const key = url.searchParams.get('demo')
  if (!key) return {}

  const result = {}
  if (key === 'account') loginAsAnna()
  if (key === 'guest') await logout()
  if (key === 'new' && url.pathname.replace(/\/$/, '') === ROUTES.accountLogin) {
    loginAsNewcomer()
    result.loginStep = 'profile'
  }

  url.searchParams.delete('demo')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  return result
}
