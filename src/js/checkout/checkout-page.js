/* ============================================================================
   Страница /checkout. Одна страница, без шагов-вкладок и без регистрации.

   ГРАММАТИКА — БЛОКИ НАВЕРХУ ДРУГ ПОД ДРУГОМ через волосяную линию, каждый
   с крупной цифрой в Prata слева и подписью-надзаголовком. Никаких рамок
   вокруг групп полей: страницы оформления чаще всего выпадают из сайта
   именно из-за них — начинают выглядеть как чужая форма.

   ВАЛИДАЦИЯ. Ошибка показывается по уходу с поля и при отправке — текстом
   под полем, с aria-invalid на самом поле. Пока человек печатает, ошибок
   не появляется; исправленное поле ошибку снимает сразу. При отправке фокус
   уезжает на первое поле с ошибкой. Ни всплывающих окон, ни alert.

   Отправка — одна функция submitOrder (submit.js), на Битриксе она
   заменяется целиком. Хранилища эта страница не знает.
   ============================================================================ */

import gsap from 'gsap'
import { checkoutCopy } from '../../data/checkout-copy.js'
import { ROUTES } from '../../data/routes.js'
import { pickupPoints } from '../../data/offline.js'
import { addDays, formatDayMonth, formatWeekday, isSameDay, toIsoDay } from '../../data/fulfillment.js'
import { escapeHtml } from '../catalog/model.js'
import { createImage } from '../media.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import * as cart from '../cart/store.js'
import { fillText, inStockFirst, summaryTexts } from '../cart/summary.js'
import { formatPhone, maskPhone, phoneDigits, rules } from './validate.js'
import { submitOrder } from './submit.js'

const copy = checkoutCopy
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Лента дней: две недели вперёд, включая сегодня. */
const DAYS_AHEAD = 14

const DAY_SHORT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

/* -------------------------------------------------------------- разметка */

const step = (n, id, title, body) => `
  <section class="co-step" aria-labelledby="${id}">
    <span class="co-step__num" aria-hidden="true">${n}</span>
    <div class="co-step__body">
      <h2 class="co-step__title" id="${id}">${title}</h2>
      ${body}
    </div>
  </section>`

function field({ id, name, label, type = 'text', autocomplete, placeholder, inputmode, optional, wide }) {
  const attrs = [
    `id="${id}"`,
    `name="${name}"`,
    `type="${type}"`,
    autocomplete && `autocomplete="${autocomplete}"`,
    placeholder && `placeholder="${placeholder}"`,
    inputmode && `inputmode="${inputmode}"`,
    !optional && 'aria-required="true"',
    `aria-describedby="${id}-error"`,
  ]
    .filter(Boolean)
    .join(' ')

  return `
    <div class="field${wide ? ' field--wide' : ''}">
      <label class="field__label" for="${id}">
        ${label}${optional ? `<span class="field__optional"> — ${copy.optional}</span>` : ''}
      </label>
      <input class="field__input" ${attrs}>
      <p class="field__error" id="${id}-error" hidden></p>
    </div>`
}

/** Капсула-радиокнопка. Настоящий input: стрелки и Space работают сами. */
const cap = ({ name, value, label, sub, checked, disabled, ariaLabel, modifier }) => `
  <label class="cap${modifier ? ` cap--${modifier}` : ''}">
    <input type="radio" name="${name}" value="${escapeHtml(value)}"${checked ? ' checked' : ''}${
      disabled ? ' disabled' : ''
    }${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ''}>
    <span class="cap__face">${label}${sub ? `<span class="cap__sub">${sub}</span>` : ''}</span>
  </label>`

function contactsStep() {
  const c = copy.contacts
  return step(
    1,
    'co-contacts',
    c.title,
    `<div class="fields">
      ${field({ id: 'co-name', name: 'name', label: c.name.label, autocomplete: 'name' })}
      ${field({
        id: 'co-phone',
        name: 'phone',
        label: c.phone.label,
        type: 'tel',
        autocomplete: 'tel',
        inputmode: 'tel',
        placeholder: c.phone.placeholder,
      })}
      ${field({
        id: 'co-email',
        name: 'email',
        label: c.email.label,
        type: 'email',
        autocomplete: 'email',
        inputmode: 'email',
        placeholder: c.email.placeholder,
      })}
    </div>`,
  )
}

/**
 * Самовывоз. Пункт сейчас один, и он показывается блоком, а не радиокнопкой:
 * переключатель из одного значения — брак (см. pickupPoints в offline.js).
 * Появится второй — ряд радиокнопок включится сам.
 */
function pickupPanel() {
  const single = pickupPoints.length === 1
  const point = (p, i) => `
    <li class="pickup__point">
      ${
        single
          ? ''
          : `<input type="radio" name="pickup" value="${p.id}" id="co-pickup-${p.id}"${i === 0 ? ' checked' : ''}>`
      }
      <${single ? 'div' : `label for="co-pickup-${p.id}"`} class="pickup__text">
        <span class="pickup__name">${p.name}</span>
        <span class="pickup__address">${p.city}, ${p.address}</span>
        <span class="pickup__hours">${p.hours}</span>
      </${single ? 'div' : 'label'}>
    </li>`

  return `
    <div class="co-panel" data-panel="pickup" hidden>
      <p class="field__hint">${copy.receive.pickupLead}</p>
      <ul class="pickup">${pickupPoints.map(point).join('')}</ul>
    </div>`
}

function receiveStep() {
  const r = copy.receive
  return step(
    2,
    'co-receive',
    r.title,
    `<fieldset class="group">
      <legend class="visually-hidden">${r.legend}</legend>
      <div class="caps">
        ${cap({ name: 'method', value: 'delivery', label: r.delivery, checked: true })}
        ${cap({ name: 'method', value: 'pickup', label: r.pickup })}
      </div>
    </fieldset>

    <div class="co-panel" data-panel="delivery">
      <div class="fields">
        <div class="field field--wide">
          <span class="field__label">${r.city.label}</span>
          <p class="field__static">${r.city.value}</p>
          <p class="field__hint">${r.city.hint} <a href="${r.city.hintLink.href}">${r.city.hintLink.label}</a></p>
        </div>
        ${field({ id: 'co-street', name: 'street', label: r.street.label, autocomplete: 'address-line1', wide: true })}
        ${field({
          id: 'co-apartment',
          name: 'apartment',
          label: r.apartment.label,
          autocomplete: 'address-line2',
          optional: true,
        })}
        ${field({ id: 'co-intercom', name: 'intercom', label: r.intercom.label, optional: true })}
      </div>
    </div>

    ${pickupPanel()}`,
  )
}

/**
 * Когда. Дни раньше готовности заказа выключены, и подпись под лентой
 * объясняет почему. По умолчанию выбран первый доступный день: самый
 * частый ответ, и он же ближайший.
 */
function whenStep(totals, today = new Date()) {
  const w = copy.when

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const day = addDays(today, i)
    const blocked = day.getTime() < totals.readyAt.getTime()
    const top = i === 0 ? w.today : i === 1 ? w.tomorrow : formatWeekday(day)
    return cap({
      name: 'date',
      value: toIsoDay(day),
      label: top,
      sub: DAY_SHORT.format(day).replace('.', ''),
      checked: isSameDay(day, totals.readyAt),
      disabled: blocked,
      ariaLabel: `${top}, ${formatDayMonth(day)}`,
      modifier: 'day',
    })
  }).join('')

  const hint = totals.hasPreorder
    ? `<p class="field__hint">${fillText(w.blockedHint, { date: formatDayMonth(totals.readyAt) })}</p>`
    : ''

  return step(
    3,
    'co-when',
    w.title,
    `<fieldset class="group">
      <legend class="field__label">${w.dateLegend}</legend>
      <div class="caps days">${days}</div>
      ${hint}
    </fieldset>

    <fieldset class="group" aria-describedby="co-interval-error">
      <legend class="field__label">${w.intervalLegend}</legend>
      <div class="caps">
        ${w.intervals.map((label) => cap({ name: 'interval', value: label, label })).join('')}
      </div>
      <p class="field__error" id="co-interval-error" hidden></p>
    </fieldset>`,
  )
}

/**
 * Оплата. Если в заказе есть позиции по запросу, способа оплаты выбирать
 * не из чего: суммы ещё нет. Весь блок тогда — одна строка о том, как
 * будет устроена оплата.
 */
function paymentStep(totals) {
  const p = copy.payment
  const body = totals.onRequestCount
    ? `<p class="ready-line co-note"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>${p.onRequest}</span></p>`
    : `<fieldset class="group">
         <legend class="visually-hidden">${p.legend}</legend>
         <div class="caps">
           ${p.options.map((o, i) => cap({ name: 'payment', value: o.value, label: o.label, checked: i === 0 })).join('')}
         </div>
       </fieldset>`

  return step(4, 'co-payment', p.title, body)
}

function commentStep() {
  const c = copy.comment
  return step(
    5,
    'co-comment',
    c.title,
    `<div class="field field--wide">
      <label class="field__label" for="co-comment-text">${c.label}</label>
      <textarea class="field__input" id="co-comment-text" name="comment" rows="3"
                placeholder="${c.placeholder}"></textarea>
    </div>`,
  )
}

function consentStep() {
  const c = copy.consent
  return step(
    6,
    'co-consent-title',
    c.title,
    `<div class="field">
      <label class="check" for="co-consent">
        <input type="checkbox" id="co-consent" name="consent" aria-required="true"
               aria-describedby="co-consent-error">
        <span class="check__box" aria-hidden="true">${icons.check}</span>
        <span>${c.before} <a href="${c.terms.href}">${c.terms.label}</a>
          ${c.middle} <a href="${c.privacy.href}">${c.privacy.label}</a></span>
      </label>
      <p class="field__error" id="co-consent-error" hidden></p>
    </div>`,
  )
}

function summaryMarkup() {
  const s = copy.summary
  return `
    <aside class="checkout__aside summary-sticky" aria-label="${s.title}">
      <div class="summary">
        <h2 class="summary__title">${s.title}</h2>
        <ul class="summary__items" data-items aria-label="${s.itemsLabel}"></ul>
        <p class="checkout__edit"><a class="link-btn" href="${ROUTES.cart}">${s.edit}</a></p>

        <dl class="summary__rows">
          <div class="summary__row"><dt>${s.sum}</dt><dd data-sum></dd></div>
          <div class="summary__row"><dt>${s.delivery}</dt><dd data-delivery></dd></div>
        </dl>
        <p class="summary__total">
          <span>${s.total}</span>
          <span class="summary__total-value" data-total aria-live="polite"></span>
        </p>
        <p class="summary__note" data-note hidden></p>

        <button type="submit" form="checkout-form" class="btn btn--solid summary__action" data-submit>
          ${s.submit}
        </button>
      </div>
    </aside>`
}

function markup(totals) {
  return `
    <div class="container">
      <nav class="crumbs" aria-label="Хлебные крошки">
        <a href="${ROUTES.home}">${copy.crumbs.home}</a>
        <span class="crumbs__sep" aria-hidden="true"></span>
        <a href="${ROUTES.cart}">${copy.crumbs.cart}</a>
        <span class="crumbs__sep" aria-hidden="true"></span>
        <span class="crumbs__current" aria-current="page">${copy.crumbs.current}</span>
      </nav>

      <div class="checkout__head">
        <h1 class="checkout__title">${copy.title}</h1>
        <p class="checkout__lead">${copy.lead}</p>
      </div>

      <div class="checkout__layout">
        <form class="checkout__form" id="checkout-form" novalidate>
          ${contactsStep()}
          ${receiveStep()}
          ${whenStep(totals)}
          ${paymentStep(totals)}
          ${commentStep()}
          ${consentStep()}
        </form>

        ${summaryMarkup()}
      </div>
    </div>`
}

/** Свёрнутый состав: кадр и количество. Название — для скринридера. */
function summaryItem(line) {
  const li = document.createElement('li')
  li.className = `summary__item${line.inStock ? '' : ' is-preorder'}`
  li.innerHTML = `
    <span class="summary__item-shot"></span>
    <span class="summary__qty" aria-hidden="true">${line.qty}</span>
    <span class="visually-hidden">${escapeHtml(line.name)}, ${escapeHtml(line.note)} — ${line.qty} шт.</span>`

  if (line.image) {
    li.querySelector('.summary__item-shot').appendChild(
      createImage({ src: line.image, alt: '', ratio: '1:1', className: 'media--compact' }),
    )
  }
  return li
}

/* -------------------------------------------------------------- страница */

export function initCheckoutPage(mount) {
  if (!mount) return

  // Оформлять нечего — возвращаем в корзину: там пустое состояние с выходами.
  if (!cart.getItems().length) {
    location.replace(ROUTES.cart)
    return
  }

  document.title = `${copy.title} — №1 Гранд Гурмэ`
  mount.className = 'page-checkout'
  mount.innerHTML = markup(cart.getTotals())

  const form = mount.querySelector('#checkout-form')
  const f = form.elements
  const submit = mount.querySelector('[data-submit]')
  const panels = [...mount.querySelectorAll('[data-panel]')]

  const els = {
    items: mount.querySelector('[data-items]'),
    sum: mount.querySelector('[data-sum]'),
    delivery: mount.querySelector('[data-delivery]'),
    total: mount.querySelector('[data-total]'),
    note: mount.querySelector('[data-note]'),
  }

  const method = () => f.method.value

  /* ---- сводка ---------------------------------------------------------- */

  function paintSummary() {
    const items = cart.getItems()
    if (!items.length) {
      location.replace(ROUTES.cart)
      return
    }

    const t = summaryTexts(cart.getTotals())
    els.items.replaceChildren(...inStockFirst(items).map(summaryItem))
    els.sum.textContent = t.sum
    els.delivery.textContent =
      method() === 'pickup' ? copy.summary.pickupValue : copy.summary.deliveryValue
    els.total.textContent = t.total
    els.total.classList.toggle('is-text', t.allOnRequest)
    els.note.hidden = !t.note
    els.note.textContent = t.note
  }

  /* ---- ошибки ---------------------------------------------------------- */

  const showError = (input, message, node = document.getElementById(`${input.id}-error`)) => {
    node.textContent = message
    node.hidden = !message
    input.setAttribute('aria-invalid', String(Boolean(message)))
  }

  const TEXT_FIELDS = ['name', 'phone', 'email', 'street']
  const touched = new Set()

  /** Улица нужна только доставке: при самовывозе поле скрыто и не проверяется. */
  const isActive = (name) => name !== 'street' || method() === 'delivery'

  const checkText = (name) => {
    const input = f[name]
    const message = isActive(name) ? rules[name](input.value) : ''
    showError(input, message)
    return message ? input : null
  }

  // Маска вешается раньше проверки: на уходе с поля номер сначала
  // приводится к виду «+7 925 466-66-46», и только потом проверяется.
  maskPhone(f.phone)

  TEXT_FIELDS.forEach((name) => {
    const input = f[name]
    input.addEventListener('blur', () => {
      touched.add(name)
      checkText(name)
    })
    // Исправленное поле снимает ошибку сразу, но новую ошибку на вводе
    // не показываем — только по уходу с поля.
    input.addEventListener('input', () => {
      if (touched.has(name) && !rules[name](input.value)) showError(input, '')
    })
  })

  const intervalInputs = [...form.querySelectorAll('input[name="interval"]')]
  const intervalError = mount.querySelector('#co-interval-error')

  const checkInterval = () => {
    const message = f.interval.value ? '' : copy.when.error
    intervalError.textContent = message
    intervalError.hidden = !message
    intervalInputs.forEach((input) => input.setAttribute('aria-invalid', String(Boolean(message))))
    return message ? intervalInputs[0] : null
  }

  const checkConsent = () => {
    const message = f.consent.checked ? '' : copy.consent.error
    showError(f.consent, message)
    return message ? f.consent : null
  }

  form.addEventListener('change', (event) => {
    const { name } = event.target
    if (name === 'interval') checkInterval()
    if (name === 'consent' && f.consent.checked) showError(f.consent, '')
    if (name === 'method') switchMethod(event.target.value)
  })

  /* ---- способ получения ------------------------------------------------ */

  function switchMethod(value) {
    panels.forEach((panel) => {
      const on = panel.dataset.panel === value
      panel.hidden = !on
      if (on && !REDUCED) {
        gsap.fromTo(panel, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' })
      }
    })
    if (value !== 'delivery') showError(f.street, '')
    paintSummary()
  }

  /* ---- отправка -------------------------------------------------------- */

  function focusInvalid(input) {
    input.focus({ preventScroll: true })
    const lenis = getLenis()
    const header = document.querySelector('[data-header]')?.offsetHeight || 0
    if (lenis) lenis.scrollTo(input, { offset: -(header + 96), immediate: REDUCED })
    else input.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' })
  }

  function collectPayload() {
    const items = cart.getItems()
    const totals = cart.getTotals()
    const value = (name) => f[name].value.trim()

    const pickupId = f.pickup?.value || pickupPoints[0]?.id
    const receive =
      method() === 'delivery'
        ? {
            method: 'delivery',
            city: copy.receive.city.value,
            street: value('street'),
            apartment: value('apartment'),
            intercom: value('intercom'),
          }
        : { method: 'pickup', point: pickupPoints.find((p) => p.id === pickupId) || null }

    return {
      contact: { name: value('name'), phone: formatPhone(phoneDigits(f.phone.value)), email: value('email') },
      receive,
      when: { date: f.date.value, interval: f.interval.value },
      // Позиции по запросу — способа оплаты нет: сумму подтвердит менеджер.
      payment: totals.onRequestCount ? null : f.payment.value,
      comment: value('comment'),
      promo: cart.getPromo(),
      items,
      totals: { ...totals, readyAt: toIsoDay(totals.readyAt) },
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    TEXT_FIELDS.forEach((name) => touched.add(name))
    // Порядок проверок — порядок полей на странице: фокус уйдёт на первое.
    const invalid = [...TEXT_FIELDS.map(checkText), checkInterval(), checkConsent()].filter(Boolean)
    if (invalid.length) {
      focusInvalid(invalid[0])
      return
    }

    submit.disabled = true
    submit.setAttribute('aria-busy', 'true')
    submit.textContent = copy.summary.submitting

    try {
      await submitOrder(collectPayload())
    } catch {
      submit.disabled = false
      submit.removeAttribute('aria-busy')
      submit.textContent = copy.summary.submit
    }
  })

  paintSummary()

  // Состав поменяли в соседней вкладке — сводка следует за ним. Ленту дней
  // и блок оплаты не перестраиваем: введённое в форму терять нельзя,
  // а итоги пересчитает менеджер при подтверждении.
  cart.subscribe(paintSummary)
}
