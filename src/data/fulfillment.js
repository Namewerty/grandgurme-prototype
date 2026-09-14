/**
 * Сроки исполнения заказа: сколько ждать позицию, которой нет на складе,
 * и к какой дате соберётся корзина целиком.
 *
 * Модель намеренно простая. Позиция либо на складе — тогда её везут день
 * в день по Москве, — либо под заказ, и срок у всех таких позиций один.
 * Заказ готов, когда готова самая долгая позиция: делить доставку на две
 * части прототип не предлагает, это отдельное решение заказчика со своей
 * ценой (два выезда курьера, две холодовые сумки).
 *
 * ПОЧЕМУ ДНИ КАЛЕНДАРНЫЕ, А НЕ РАБОЧИЕ. Подпись на карточке «привезём
 * примерно за 7 дней» и дата в корзине «к 21 сентября» обязаны сходиться.
 * Рабочие дни без производственного календаря врали бы на праздниках,
 * а календаря с праздниками у нас нет.
 *
 * Признак inStock берётся из выгрузки как есть: остатки у заказчика ведутся
 * (см. src/data/catalog-products.js).
 */

/** Сколько дней везём то, чего нет на складе. Подтверждено заказчиком. */
export const PREORDER_DAYS = 7

export const leadDaysOf = (product) => (product.inStock ? 0 : PREORDER_DAYS)

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
 * Дата готовности заказа: максимум сроков по составу, отсчитанный от сегодня.
 * Пустой состав и состав только из наличия дают сегодняшний день.
 */
export function readyDateFor(items, now = new Date()) {
  const lead = items.reduce((max, item) => Math.max(max, leadDaysOf(item)), 0)
  return addDays(now, lead)
}

const DAY_MONTH = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const WEEKDAY = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' })

/** «21 сентября». */
export const formatDayMonth = (date) => DAY_MONTH.format(date)

/** «к 21 сентября» — так дата готовности пишется везде на сайте. */
export const formatReadyDate = (date) => `к ${formatDayMonth(date)}`

/** «пн», «вт» — для ленты дней на оформлении. */
export const formatWeekday = (date) => WEEKDAY.format(date).replace('.', '')

/** Дата без времени для адресов и заказа: 2026-09-21, по местному часовому поясу. */
export function toIsoDay(date) {
  const day = startOfDay(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

export function fromIsoDay(value) {
  const [y, m, d] = String(value).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
