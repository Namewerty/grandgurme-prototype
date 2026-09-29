/* ============================================================================
   Зона доставки: поле выбора, определение по адресу и карта зон.

   ОДНО ПОЛЕ НА ДВА МЕСТА — оформление (src/js/checkout/checkout-page.js)
   и адреса кабинета (src/js/account/pages/addresses.js). Зона хранится
   вместе с адресом, и сохранённый адрес на оформлении сразу подставляет её.

   КАК ОПРЕДЕЛЯЕТСЯ ЗОНА.
     1. Есть ключ геокодера (VITE_YANDEX_GEOCODER_KEY в .env, см. README) —
        по уходу с поля адреса адрес уходит в HTTP-геокодер Яндекса, точка
        проверяется на попадание в полигоны зон (public/data/delivery-zones.geojson,
        снят с карты боевого сайта), зона встаёт в поле сама с подписью
        «Определили по адресу». Поменять её руками можно.
     2. Ключа нет (прототип сейчас) или геокодер не ответил — зону выбирают
        из списка сами; рядом ссылка «Посмотреть карту зон» открывает
        ту же карту, что на боевом сайте.
   Зона обязательна для доставки: без неё не посчитать стоимость.

   ПОЧЕМУ HTTP-ГЕОКОДЕР, А НЕ JS API КАРТ. Для одного запроса по адресу
   тянуть скрипт карт на страницу оформления незачем. Ключ, который стоит
   в бандле боевого сайта (vue-yandex-maps), брать нельзя: он выдан под
   домен заказчика и под JS API — нужен свой ключ «HTTP Геокодер».

   Полигоны проверяются по ВНЕШНИМ контурам в порядке зон (ТТК → зона 6):
   у зон 2–6 дырки нарисованы заново, а не взяты из соседней зоны, и между
   кольцами есть щели до 290 м. Первое внешнее кольцо, в которое попала
   точка, — её зона; щелей при таком порядке нет.
   ============================================================================ */

import { checkoutCopy } from '../../data/checkout-copy.js'
import { ZONES_GEOJSON, ZONES_MAP_URL, deliveryZones, findZone } from '../../data/delivery-zones.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { REQUIRED_MARK } from '../components/required.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'

const copy = checkoutCopy.zone

/** Ключ HTTP-геокодера Яндекса. Пусто — определения по адресу нет. */
const GEOCODER_KEY = (import.meta.env && import.meta.env.VITE_YANDEX_GEOCODER_KEY) || ''

export const canGeocode = () => Boolean(GEOCODER_KEY)

/* ------------------------------------------------------------- геометрия */

/** Луч вправо от точки: нечётное число пересечений — точка внутри кольца. */
function inRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

let polygons = null

/** Полигоны зон: [{ key, ring }] в порядке deliveryZones. Грузятся один раз. */
export async function loadZones() {
  if (polygons) return polygons
  const response = await fetch(ZONES_GEOJSON)
  if (!response.ok) throw new Error(`zones ${response.status}`)
  const data = await response.json()
  polygons = deliveryZones
    .map((zone) => {
      const feature = data.features.find((item) => item.properties?.key === zone.key)
      return feature ? { key: zone.key, ring: feature.geometry.coordinates[0] } : null
    })
    .filter(Boolean)
  return polygons
}

/** Ключ зоны для точки [долгота, широта]; null — за пределами всех зон. */
export async function zoneAt(point) {
  const list = await loadZones()
  return list.find((item) => inRing(point, item.ring))?.key || null
}

/**
 * Адрес → точка. Область поиска — вокруг Москвы без жёсткой границы:
 * «Тверская, 7» находится в Москве, «Одинцово, Можайское шоссе» — в Одинцове.
 * @returns {Promise<[number, number]|null>}
 */
async function geocode(address) {
  const params = new URLSearchParams({
    apikey: GEOCODER_KEY,
    geocode: address,
    format: 'json',
    lang: 'ru_RU',
    results: '1',
    ll: '37.617635,55.755814',
    spn: '2.4,1.6',
  })
  const response = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params}`)
  if (!response.ok) return null
  const data = await response.json()
  const pos = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos
  if (!pos) return null
  const [lon, lat] = pos.split(' ').map(Number)
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null
}

/**
 * Зона по адресу.
 * @returns {Promise<{ status: 'ok'|'outside'|'notfound'|'off', zone: string|null }>}
 *   off — ключа нет или геокодер не ответил: выбор остаётся за человеком.
 */
export async function zoneForAddress(address) {
  if (!canGeocode() || !String(address || '').trim()) return { status: 'off', zone: null }
  try {
    const point = await geocode(address)
    if (!point) return { status: 'notfound', zone: null }
    const zone = await zoneAt(point)
    return zone ? { status: 'ok', zone } : { status: 'outside', zone: null }
  } catch {
    return { status: 'off', zone: null }
  }
}

/* ------------------------------------------------------------------ поле */

/** «В пределах МКАД — 900 ₽». Короткое имя: полное на 375 px обрезалось. */
const optionLabel = (zone) => `${zone.short} — ${formatPrice(zone.price)}`

/** Подпись под полем: граница зоны и порог бесплатной доставки. */
export const zoneHint = (zone) =>
  `${zone.hint} · ${copy.freeFrom} ${formatPrice(zone.freeFrom)}`

/**
 * Разметка поля. Выбор из шести — выпадающий список, а не шесть капсул:
 * вариантов больше трёх, и ряд кнопок на телефоне занял бы полэкрана.
 */
export function zoneFieldMarkup({ id, name = 'zone', value = '' }) {
  return `
    <div class="field field--wide zone-field" data-zone-field>
      <label class="field__label" for="${id}">${copy.label}${REQUIRED_MARK}</label>
      <div class="field__select">
        <select class="field__input" id="${id}" name="${name}" aria-required="true"
                aria-describedby="${id}-hint ${id}-error">
          <option value="">${copy.placeholder}</option>
          ${deliveryZones
            .map(
              (zone) =>
                `<option value="${zone.key}"${zone.key === value ? ' selected' : ''}>${escapeHtml(optionLabel(zone))}</option>`,
            )
            .join('')}
        </select>
      </div>
      <p class="field__hint" id="${id}-hint" data-zone-hint></p>
      <p class="field__error" id="${id}-error" hidden></p>
      <p class="zone-field__map">
        <button type="button" class="link-btn" data-zone-map>${copy.map}</button>
      </p>
    </div>`
}

/**
 * Оживить поле: подпись под выбором, карта, определение по адресу.
 *
 * @param {HTMLElement} root  узел [data-zone-field]
 * @param {object} o
 * @param {HTMLInputElement} [o.address]  поле адреса — по уходу с него зона определяется сама
 * @param {() => string} [o.addressText] полный адрес для геокодера (по умолчанию значение поля)
 * @param {(key: string) => void} [o.onChange]
 * @returns {{ select: HTMLSelectElement, set: (key: string, note?: string) => void, validate: () => HTMLElement|null, clear: () => void }}
 */
export function wireZoneField(root, { address, addressText, onChange } = {}) {
  const select = root.querySelector('select')
  const hint = root.querySelector('[data-zone-hint]')
  const error = root.querySelector('.field__error')
  let note = ''

  const paintHint = () => {
    const zone = findZone(select.value)
    const parts = [note, zone ? zoneHint(zone) : canGeocode() ? copy.hintAuto : copy.hintManual].filter(Boolean)
    hint.textContent = parts.join(' · ')
  }

  const showError = (message) => {
    error.textContent = message
    error.hidden = !message
    select.setAttribute('aria-invalid', String(Boolean(message)))
  }

  const set = (key, withNote = '') => {
    select.value = key || ''
    note = withNote
    if (key) showError('')
    paintHint()
    onChange?.(select.value)
  }

  select.addEventListener('change', () => {
    note = ''
    if (select.value) showError('')
    paintHint()
    onChange?.(select.value)
  })
  // Обязательное поле: ошибка по уходу с пустого выбора, как у полей ввода.
  select.addEventListener('blur', () => {
    if (!select.value) showError(copy.error)
  })

  root.querySelector('[data-zone-map]').addEventListener('click', openZonesMap)

  if (address && canGeocode()) {
    let last = ''
    address.addEventListener('blur', async () => {
      const text = (addressText ? addressText() : address.value).trim()
      if (!text || text === last) return
      last = text
      hint.textContent = copy.detecting
      const result = await zoneForAddress(text)
      if (result.status === 'ok') set(result.zone, copy.detected)
      else if (result.status === 'outside') {
        set('', '')
        showError(copy.outside)
      } else {
        note = result.status === 'notfound' ? copy.notFound : ''
        paintHint()
      }
    })
  }

  paintHint()

  return {
    select,
    set,
    validate() {
      const message = select.value ? '' : copy.error
      showError(message)
      return message ? select : null
    },
    clear: () => showError(''),
  }
}

/* ------------------------------------------------------------- карта зон */

/**
 * Карта зон в диалоге — тот же конструктор Яндекс.Карт, что на боевом сайте.
 * iframe создаётся при открытии и уходит с закрытием: сторонний виджет
 * не грузится, пока карту не попросили.
 */
export function openZonesMap() {
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog dialog--map'
  dialog.setAttribute('aria-labelledby', 'zones-map-title')
  dialog.innerHTML = `
    <button type="button" class="icon-btn dialog__close" data-close aria-label="${copy.mapClose}">${icons.close}</button>
    <h2 class="dialog__title" id="zones-map-title">${copy.mapTitle}</h2>
    <p class="dialog__text">${copy.mapLead}</p>
    <div class="zones-map">
      <iframe src="${ZONES_MAP_URL}" title="${copy.mapTitle}" loading="lazy" allowfullscreen></iframe>
    </div>
    <ul class="zones-legend">
      ${deliveryZones
        .map(
          (zone) => `
        <li><b>${escapeHtml(zone.short)}</b> — ${formatPrice(zone.price)}, ${copy.freeFrom} ${formatPrice(zone.freeFrom)}</li>`,
        )
        .join('')}
    </ul>`

  const close = () => dialog.close()
  dialog.querySelector('[data-close]').addEventListener('click', close)
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close()
  })
  dialog.addEventListener('close', () => {
    getLenis()?.start()
    dialog.remove()
  })

  document.body.appendChild(dialog)
  getLenis()?.stop()
  dialog.showModal()
  dialog.querySelector('[data-close]').focus()
}
