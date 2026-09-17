/**
 * Как позиция доходит до покупателя: вид позиции, сроки, дата готовности.
 *
 * ТРИ ВИДА ПОЗИЦИИ (решение Дениса, 16.09.2026). Вид вычисляется ОДНОЙ
 * функцией — kindOf — по наличию, цене и разделу витрины и больше нигде
 * не угадывается:
 *
 *   stock     есть на складе и есть цена — заказать и оплатить, доставка
 *             день в день;
 *   preorder  нет на складе, есть цена, раздел помечен fulfillment: 'preorder'
 *             в src/data/catalog.js («Рыба» и «Красная икра» со всеми
 *             подразделами) — заказать и оплатить, привезём через
 *             PREORDER_DAYS дней;
 *   request   всё остальное — оплатить нельзя, позиция уходит менеджеру
 *             заявкой. Сюда попадает всё, чего нет на складе вне рыбы
 *             и красной икры, ВКЛЮЧАЯ ЧЁРНУЮ ИКРУ, и позиция без цены
 *             в любом разделе при любом наличии: оплатить то, у чего нет
 *             суммы, нельзя.
 *
 * Главное следствие: в ЗАКАЗЕ больше не бывает позиций «по запросу».
 * Заказ всегда имеет точную сумму, а всё без суммы — заявка.
 *
 * Позиция витрины главной (src/data/products.js) раздела не имеет: в наличии
 * и с ценой — stock, иначе request.
 *
 * ПОЧЕМУ ДНИ КАЛЕНДАРНЫЕ, А НЕ РАБОЧИЕ. Метка «Под заказ · 7 дней» и дата
 * «к 23 сентября» обязаны сходиться. Рабочие дни без производственного
 * календаря врали бы на праздниках, а календаря с праздниками у нас нет.
 *
 * Признак inStock берётся из выгрузки как есть: остатки у заказчика ведутся
 * (см. src/data/catalog-products.js).
 */

import { categories } from './catalog.js'

/** Сколько дней везём то, чего нет на складе. Подтверждено заказчиком. */
export const PREORDER_DAYS = 7

/** «7 дней», «1 день», «3 дня» — число дней словами для меток и подписей. */
export function daysLabel(n) {
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней'
  return `${n} ${word}`
}

/** Порядок видов везде на сайте: группы корзины, сводка, отгрузки. */
export const KINDS = ['stock', 'preorder', 'request']

const PREORDER_SECTIONS = new Set(
  categories.filter((category) => category.fulfillment === 'preorder').map((category) => category.slug),
)

/**
 * Вид позиции.
 * @param {object} product  { inStock, price, categorySlug? }
 * @returns {'stock'|'preorder'|'request'}
 */
export function kindOf(product) {
  const hasPrice = typeof product?.price === 'number' && product.price > 0
  if (!hasPrice) return 'request'
  if (product.inStock) return 'stock'
  // fulfillment у самой позиции — только тестовые позиции прототипа
  // (TEST_CAVIAR в catalog-products.js): в чёрной икре предзаказа нет.
  const preorder = product.fulfillment === 'preorder' || PREORDER_SECTIONS.has(product.categorySlug)
  return preorder ? 'preorder' : 'request'
}

/** Позиция оплачивается на сайте — то есть идёт в заказ, а не в заявку. */
export const isOrderKind = (kind) => kind === 'stock' || kind === 'preorder'

const startOfDay = (date) => {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

export function addDays(date, days) {
  const day = startOfDay(date)
  day.setDate(day.getDate() + days)
  return day
}

export const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()

/**
 * Дата готовности заказа. Считается ТОЛЬКО по позициям заказа: сегодня,
 * если в нём нет preorder, иначе сегодня + PREORDER_DAYS. Позиции заявки
 * на дату не влияют — срок по ним называет менеджер.
 */
export function readyDateFor(items, now = new Date()) {
  const hasPreorder = items.some((item) => item.kind === 'preorder')
  return addDays(now, hasPreorder ? PREORDER_DAYS : 0)
}

/** Дата готовности позиции под заказ, если оформить сегодня. */
export const preorderDate = (now = new Date()) => addDays(now, PREORDER_DAYS)

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const WEEKDAY = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

/** «23 сентября». */
export const formatDayMonth = (date) => DAY_MONTH.format(date)

/**
 * «17 сентября 2026» — дата оформления в кабинете. Год нужен: в истории
 * заказов лежат записи прошлых лет, а formatDayMonth его не пишет.
 * Собирается вручную: Intl для ru-RU дописывает « г.».
 */
export const formatDate = (date) => `${DAY_MONTH.format(date)} ${date.getFullYear()}`

/** «к 23 сентября» — так дата готовности пишется везде на сайте. */
export const formatReadyDate = (date) => `к ${formatDayMonth(date)}`

/** «пн», «вт» — для ленты дней на оформлении. */
export const formatWeekday = (date) => WEEKDAY.format(date).replace('.', '')

/** Дата без времени для адресов и заказа: 2026-09-23, по местному часовому поясу. */
export function toIsoDay(date) {
  const day = startOfDay(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

export function fromIsoDay(value) {
  const [y, m, d] = String(value).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
