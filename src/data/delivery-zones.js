/**
 * Доставка: зоны, стоимость, окно и точное время. ВСЕ ЦИФРЫ О ДОСТАВКЕ
 * НА САЙТЕ БЕРУТСЯ ТОЛЬКО ОТСЮДА — страница /delivery, оформление, корзина
 * и кабинет. Своих цифр у них нет.
 *
 * ОТКУДА ДАННЫЕ. Боевой сайт https://grandgurme.ru/delivery-payment
 * на 29.09.2026: таблица зон (цена и «бесплатно от»), «ежедневно с 10:00
 * до 18:00», «100% предоплата». Минимальной суммы заказа боевой сайт
 * не называет — её здесь нет.
 *
 * КАРТА ЗОН. На боевой странице — пользовательская карта Конструктора
 * Яндекс.Карт «Зоны доставки №1 Гранд Гурмэ» (изменена 23.02.2026).
 * Скрипт конструктора стоит в тексте страницы, который отдаёт API Битрикса
 * боевого сайта (/api/about/delivery, инфоблок 2290, detail_text). Полигоны
 * шести зон сняты с виджета конструктора и лежат в
 * public/data/delivery-zones.geojson — по ним оформление определяет зону
 * по адресу (src/js/checkout/zones.js). Поменяют карту в конструкторе —
 * файл нужно снять заново, сам он не обновится.
 *
 * key — ключ зоны: он же хранится в адресе кабинета и уходит в заказ.
 *   Совпадает с properties.key у полигона в GeoJSON.
 * name  — как зона называется в таблице и в выборе на оформлении.
 * short — короткое имя для сводки и карточки адреса.
 * hint  — граница словами. У ТТК и МКАД она очевидна; у зон 3–6 словесного
 *         описания на боевом сайте НЕТ ни в тексте, ни в конструкторе —
 *         расстояния посчитаны по полигонам (медиана внешней границы
 *         от МКАД) и округлены. ⚠ ПРЕДВАРИТЕЛЬНО: сверить с заказчиком,
 *         лучше — списком городов.
 * price    — стоимость доставки, ₽.
 * freeFrom — с какой суммы товаров доставка бесплатна, ₽.
 * windowHours — «Временное окно» из подписи полигона на боевой карте
 *         (3/4/4/5/5/6 часов). В тексте страницы его нет, на оформлении
 *         не используется: интервалы у нас по 4 часа для всех зон.
 *         ⚠ ВОПРОС ЗАКАЗЧИКУ: не значит ли это, что ширина интервала
 *         зависит от зоны.
 * inText — как зона пишется в строке корзины «До бесплатной доставки …».
 */
export const deliveryZones = [
  {
    key: 'ttk',
    name: 'Москва в пределах ТТК',
    short: 'В пределах ТТК',
    hint: 'внутри Третьего транспортного кольца',
    price: 700,
    freeFrom: 10000,
    windowHours: 3,
    inText: 'по Москве в пределах ТТК',
  },
  {
    key: 'mkad',
    name: 'Москва в пределах МКАД',
    short: 'В пределах МКАД',
    hint: 'между ТТК и МКАД',
    price: 900,
    freeFrom: 12000,
    windowHours: 4,
    inText: 'по Москве в пределах МКАД',
  },
  {
    key: 'zone3',
    name: 'Зона 3',
    short: 'Зона 3',
    hint: 'за МКАД, примерно до 10 км', // ⚠ ПРЕДВАРИТЕЛЬНО, см. шапку
    price: 1500,
    freeFrom: 13000,
    windowHours: 4,
    inText: 'в зону 3',
  },
  {
    key: 'zone4',
    name: 'Зона 4',
    short: 'Зона 4',
    hint: 'примерно 10–20 км от МКАД', // ⚠ ПРЕДВАРИТЕЛЬНО
    price: 2500,
    freeFrom: 15000,
    windowHours: 5,
    inText: 'в зону 4',
  },
  {
    key: 'zone5',
    name: 'Зона 5',
    short: 'Зона 5',
    hint: 'примерно 20–30 км от МКАД', // ⚠ ПРЕДВАРИТЕЛЬНО
    price: 3500,
    freeFrom: 20000,
    windowHours: 5,
    inText: 'в зону 5',
  },
  {
    key: 'zone6',
    name: 'Зона 6',
    short: 'Зона 6',
    hint: 'примерно 30–60 км от МКАД', // ⚠ ПРЕДВАРИТЕЛЬНО
    price: 5000,
    freeFrom: 25000,
    windowHours: 6,
    inText: 'в зону 6',
  },
]

/** Зона, которая считается, пока адреса нет: корзина пишет «…в пределах ТТК». */
export const DEFAULT_ZONE = 'ttk'

/** Полигоны зон — для определения зоны по адресу. */
export const ZONES_GEOJSON = '/data/delivery-zones.geojson'

/**
 * Карта зон с боевой страницы — для диалога «Посмотреть карту зон».
 * Тот же конструктор, что у боевого сайта: поменяют зоны там — карта здесь
 * поменяется сама, а GeoJSON выше нужно будет снять заново.
 */
export const ZONES_MAP_URL =
  'https://yandex.ru/map-widget/v1/?um=constructor%3A92b89ca0f6fa3931dc3edafbcb32ecaa7068e7d8b77ff39c6b0e9912cc57113b&source=constructor&lang=ru_RU&scroll=true'

/**
 * Окно доставки — ежедневно, как на боевом сайте. Интервалы оформления
 * строятся из него (deliveryIntervals ниже), вечернего «18:00–22:00»
 * больше нет: оно выходило за окно.
 */
export const DELIVERY_WINDOW = { from: '10:00', to: '18:00' }

/** Ширина интервала, часов: окно 10–18 даёт «10:00–14:00» и «14:00–18:00». */
export const INTERVAL_HOURS = 4

/**
 * Доставка «к столу» — к точному времени (оформление, шаг «Когда»).
 *   stepMin      шаг выбора времени;
 *   leadMin      самое раннее время на сегодня — сейчас плюс столько,
 *                с округлением вверх до шага;
 *   surcharge    доплата за точное время, ₽. 0 — строки в сводке нет;
 *   lateMin      допуск по опозданию, минут. null — подсказка его не называет.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: доплату и допуск. На боевом сайте доставки
 * к точному времени нет; значения ниже — «бесплатно и без допуска».
 */
export const EXACT_TIME = {
  stepMin: 15,
  leadMin: 120,
  surcharge: 0,
  lateMin: null,
}

/**
 * Оплата — как на боевом сайте: 100% предоплата. В тексте страницы боевого
 * сайта — «банковской картой на сайте», в подвале — SberPay и СБП.
 */
export const PREPAYMENT = true

/* ---------------------------------------------------------------- правила */

export const findZone = (key) => deliveryZones.find((zone) => zone.key === key) || null

/** Сколько стоит доставка зоны при такой сумме товаров. null — зоны нет. */
export function deliveryCost(zoneKey, goodsSum) {
  const zone = findZone(zoneKey)
  if (!zone) return null
  return goodsSum >= zone.freeFrom ? 0 : zone.price
}

/** Сколько не хватает до бесплатной доставки: 0 — порог достигнут. */
export function toFreeDelivery(zoneKey, goodsSum) {
  const zone = findZone(zoneKey)
  return zone ? Math.max(0, zone.freeFrom - goodsSum) : null
}

/* ------------------------------------------------------------------ время */

/** '10:30' → 630 минут от полуночи. */
export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 630 → '10:30'. */
export const fromMinutes = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

/**
 * Интервалы оформления из окна доставки: по INTERVAL_HOURS подряд и «весь
 * день». value — то, что уходит в заказ и показывается в кабинете.
 */
export function deliveryIntervals(window = DELIVERY_WINDOW, hours = INTERVAL_HOURS) {
  const from = toMinutes(window.from)
  const to = toMinutes(window.to)
  const list = []
  for (let start = from; start + hours * 60 <= to; start += hours * 60) {
    const label = `${fromMinutes(start)}–${fromMinutes(start + hours * 60)}`
    list.push({ value: label, label })
  }
  const whole = `${window.from}–${window.to}`
  list.push({ value: `В течение дня (${whole})`, label: `В течение дня (${whole})` })
  return list
}

/**
 * Время «к столу» на выбранный день: от начала окна до конца с шагом stepMin.
 * Сегодня — не раньше, чем через leadMin от now, с округлением вверх до шага.
 * Пустой список — на этот день точное время недоступно.
 */
export function exactTimes(day, now = new Date(), window = DELIVERY_WINDOW, rule = EXACT_TIME) {
  const from = toMinutes(window.from)
  const to = toMinutes(window.to)
  const sameDay =
    day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate()

  let first = from
  if (sameDay) {
    const earliest = now.getHours() * 60 + now.getMinutes() + rule.leadMin
    first = Math.max(from, Math.ceil(earliest / rule.stepMin) * rule.stepMin)
  }

  const list = []
  for (let t = first; t <= to; t += rule.stepMin) list.push(fromMinutes(t))
  return list
}
