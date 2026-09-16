/* ============================================================================
   Страница /checkout. Одна страница, без шагов-вкладок и без регистрации.

   ТРИ РЕЖИМА ПО СОДЕРЖИМОМУ КОРЗИНЫ (modeOf в src/js/cart/summary.js):
     order    только заказ   — Контакты · Как получить · Когда · Оплата ·
                               Комментарий · Согласие;
     both     заказ и заявка — те же шаги и «Заявка менеджеру» после оплаты;
     request  только заявка  — Контакты · Заявка менеджеру · Согласие.
   Нумерация сквозная по тем шагам, что показаны. Email обязателен, когда
   есть заказ; в заявке без заказа он подписан «необязательно».

   ВЫБОР РАЗДЕЛЕНИЯ. Когда в заказе есть и наличие, и под заказ, шаг «Когда»
   начинается с выбора: одной доставкой (всё к дате готовности) или двумя
   (наличие раньше, под заказ — к дате готовности). У двух доставок свои
   ленты дней, интервалы и проверка. Подблоки не пересобираются при
   переключении, а прячутся: введённое в них не теряется.

   ГРАММАТИКА — БЛОКИ НАВЕРХУ ДРУГ ПОД ДРУГОМ через волосяную линию, каждый
   с крупной цифрой в Prata слева и подписью-надзаголовком. Никаких рамок
   вокруг групп полей: страницы оформления чаще всего выпадают из сайта
   именно из-за них — начинают выглядеть как чужая форма.

   ВАЛИДАЦИЯ. Ошибка показывается по уходу с поля и при отправке — текстом
   под полем, с aria-invalid на самом поле. Пока человек печатает, ошибок
   не появляется; исправленное поле ошибку снимает сразу. При отправке фокус
   уезжает на первое поле с ошибкой. Ни всплывающих окон, ни alert.

   Отправка — одна функция submitCheckout (submit.js), на Битриксе она
   заменяется целиком. Хранилища эта страница не знает.
   ============================================================================ */

import gsap from 'gsap'
import { checkoutCopy } from '../../data/checkout-copy.js'
import { ROUTES } from '../../data/routes.js'
import { pickupPoints } from '../../data/offline.js'
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  isOrderKind,
  isSameDay,
  toIsoDay,
} from '../../data/fulfillment.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { createImage } from '../media.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import * as cart from '../cart/store.js'
import { fillText, kindOrder, modeOf, positionsLabel } from '../cart/summary.js'
import { formatPhone, maskPhone, phoneDigits, rules } from './validate.js'
import { submitCheckout } from './submit.js'

const copy = checkoutCopy
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Лента дней: две недели вперёд, включая первый день. */
const DAYS_AHEAD = 14

const DAY_SHORT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

/* ------------------------------------------------------------- состояние */

/** Что лежит в корзине — от этого зависит состав страницы. */
function planOf(items, totals) {
  const mode = modeOf(totals)
  const orderItems = kindOrder(items.filter((line) => isOrderKind(line.kind)))
  const requestItems = items.filter((line) => line.kind === 'request')
  return {
    mode,
    hasOrder: mode !== 'request',
    hasRequest: mode !== 'order',
    canSplit: totals.order.hasStock && totals.order.hasPreorder,
    orderItems,
    requestItems,
    stockItems: orderItems.filter((line) => line.kind === 'stock'),
    preorderItems: orderItems.filter((line) => line.kind === 'preorder'),
    totals,
  }
}

/** Подпись состава страницы: поменялась — страницу нужно собрать заново. */
const signatureOf = (plan) => [plan.mode, plan.canSplit].join('|')

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

/**
 * Капсула-радиокнопка. Настоящий input: стрелки и Space работают сами.
 * splitKey — у карточек выбора разделения подписи меняются при смене
 * способа получения, поэтому обе строки помечены.
 */
const cap = ({ name, value, label, sub, checked, disabled, ariaLabel, modifier, splitKey }) => `
  <label class="cap${modifier ? ` cap--${modifier}` : ''}">
    <input type="radio" name="${name}" value="${escapeHtml(value)}"${checked ? ' checked' : ''}${
      disabled ? ' disabled' : ''
    }${ariaLabel ? ` aria-label="${escapeHtml(ariaLabel)}"` : ''}>
    <span class="cap__face">${
      splitKey ? `<span class="cap__label" data-split-label="${splitKey}">${label}</span>` : label
    }${sub ? `<span class="cap__sub"${splitKey ? ` data-split-sub="${splitKey}"` : ''}>${sub}</span>` : ''}</span>
  </label>`

function contactsStep(n, plan) {
  const c = copy.contacts
  return step(
    n,
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
        // Письмо с подтверждением уходит только по заказу: заявке почта
        // не обязательна, менеджер свяжется по телефону.
        optional: !plan.hasOrder,
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

function receiveStep(n) {
  const r = copy.receive
  return step(
    n,
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
 * Лента дней и ряд интервалов — одна отгрузка.
 *
 * @param {object} o
 * @param {string} o.key      суффикс имён полей: '' | 'stock' | 'preorder'
 * @param {Date}   o.from     первый день ленты
 * @param {number} o.length   сколько дней
 * @param {Date}   o.readyAt  дни раньше — выключены
 * @param {Date}   o.checked  выбранный по умолчанию
 * @param {string} [o.hint]   подпись под лентой
 */
function shipmentFields({ key, from, length, readyAt, checked, hint }) {
  const w = copy.when
  const suffix = key ? `_${key}` : ''
  const today = new Date()

  const days = Array.from({ length }, (_, i) => {
    const day = addDays(from, i)
    const blocked = day.getTime() < readyAt.getTime()
    const top = isSameDay(day, today)
      ? w.today
      : isSameDay(day, addDays(today, 1))
        ? w.tomorrow
        : formatWeekday(day)
    return cap({
      name: `date${suffix}`,
      value: toIsoDay(day),
      label: top,
      sub: DAY_SHORT.format(day).replace('.', ''),
      checked: isSameDay(day, checked),
      disabled: blocked,
      ariaLabel: `${top}, ${formatDayMonth(day)}`,
      modifier: 'day',
    })
  }).join('')

  const errorId = `co-interval${suffix}-error`

  return `
    <fieldset class="group">
      <legend class="field__label">${w.dateLegend}</legend>
      <div class="caps days">${days}</div>
      ${hint ? `<p class="field__hint">${hint}</p>` : ''}
    </fieldset>

    <fieldset class="group" aria-describedby="${errorId}">
      <legend class="field__label">${w.intervalLegend}</legend>
      <div class="caps">
        ${w.intervals.map((label) => cap({ name: `interval${suffix}`, value: label, label })).join('')}
      </div>
      <p class="field__error" id="${errorId}" hidden></p>
    </fieldset>`
}

/**
 * Когда. Дни раньше готовности заказа выключены, и подпись под лентой
 * объясняет почему. По умолчанию выбран первый доступный день: самый
 * частый ответ, и он же ближайший.
 */
function whenStep(n, plan, today = new Date()) {
  const w = copy.when
  const { readyAt, hasPreorder } = plan.totals.order
  const blockedHint = hasPreorder ? fillText(w.blockedHint, { date: formatDayMonth(readyAt) }) : ''

  const single = shipmentFields({
    key: '',
    from: today,
    length: DAYS_AHEAD,
    readyAt,
    checked: readyAt,
    hint: blockedHint,
  })

  if (!plan.canSplit) return step(n, 'co-when', w.title, single)

  const date = formatDayMonth(readyAt)
  const labels = w.split.delivery
  const splitCap = (value, text, checked) =>
    cap({
      name: 'split',
      value,
      label: text.label,
      sub: fillText(text.sub, { date }),
      checked,
      modifier: 'split',
      splitKey: value,
    })

  // Наличие везём с сегодня до дня перед готовностью, под заказ — от дня
  // готовности на две недели вперёд. Выключенных дней в обеих лентах нет:
  // каждая показывает ровно те дни, что подходят её отгрузке.
  const startOfToday = addDays(today, 0)
  const stockDays = Math.max(1, Math.round((readyAt.getTime() - startOfToday.getTime()) / 864e5))

  return step(
    n,
    'co-when',
    w.title,
    `<fieldset class="group">
      <legend class="field__label">${w.splitLegend}</legend>
      <div class="split">
        ${splitCap('one', labels.one, true)}
        ${splitCap('two', labels.two, false)}
      </div>
    </fieldset>

    <div class="co-panel" data-split-panel="one">
      ${single}
    </div>

    <div class="co-panel" data-split-panel="two" hidden>
      <div class="co-sub" aria-labelledby="co-sub-stock" role="group">
        <h3 class="co-sub__title" id="co-sub-stock">${fillText(w.stockTitle, {
          n: positionsLabel(plan.stockItems.length),
        })}</h3>
        ${shipmentFields({ key: 'stock', from: today, length: stockDays, readyAt: startOfToday, checked: startOfToday })}
      </div>
      <div class="co-sub" aria-labelledby="co-sub-preorder" role="group">
        <h3 class="co-sub__title" id="co-sub-preorder">${fillText(w.preorderTitle, {
          n: positionsLabel(plan.preorderItems.length),
        })}</h3>
        ${shipmentFields({ key: 'preorder', from: readyAt, length: DAYS_AHEAD, readyAt, checked: readyAt })}
      </div>
      <p class="ready-line co-note">
        <span class="ready-line__mark" aria-hidden="true">⬦</span><span>${w.splitCost}</span>
      </p>
    </div>`,
  )
}

/** Оплата. В заказе с заявкой — строка о том, что оплачивается только заказ. */
function paymentStep(n, plan) {
  const p = copy.payment
  const note =
    plan.mode === 'both'
      ? `<p class="ready-line co-note"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>${fillText(
          p.orderOnly,
          { sum: formatPrice(plan.totals.order.sum) },
        )}</span></p>`
      : ''

  return step(
    n,
    'co-payment',
    p.title,
    `<fieldset class="group">
       <legend class="visually-hidden">${p.legend}</legend>
       <div class="caps">
         ${p.options.map((o, i) => cap({ name: 'payment', value: o.value, label: o.label, checked: i === 0 })).join('')}
       </div>
     </fieldset>
     ${note}`,
  )
}

/** Заявка менеджеру: состав без сумм, способ связи, вопрос. */
function requestStep(n, plan) {
  const r = copy.request
  const lines = plan.requestItems
    .map(
      (line) => `
      <li class="order-lines__row">
        <span class="order-lines__name">${escapeHtml(line.name)}
          <span class="order-lines__note">${escapeHtml([line.note, `× ${line.qty}`].filter(Boolean).join(' '))}</span>
        </span>
      </li>`,
    )
    .join('')

  return step(
    n,
    'co-request',
    r.title,
    `<ul class="order-lines co-request__lines" aria-label="${r.itemsLabel}">${lines}</ul>
    <p class="co-request__edit"><a class="link-btn" href="${ROUTES.cart}">${r.edit}</a></p>

    <fieldset class="group">
      <legend class="field__label">${r.contactLegend}</legend>
      <div class="caps">
        ${r.contactWays
          .map((way, i) => cap({ name: 'contact_way', value: way.value, label: way.label, checked: i === 0 }))
          .join('')}
      </div>
    </fieldset>

    <div class="field field--wide">
      <label class="field__label" for="co-question">
        ${r.question.label}<span class="field__optional"> — ${copy.optional}</span>
      </label>
      <textarea class="field__input" id="co-question" name="question" rows="3"
                placeholder="${r.question.placeholder}"></textarea>
    </div>`,
  )
}

function commentStep(n) {
  const c = copy.comment
  return step(
    n,
    'co-comment',
    c.title,
    `<div class="field field--wide">
      <label class="field__label" for="co-comment-text">${c.label}</label>
      <textarea class="field__input" id="co-comment-text" name="comment" rows="3"
                placeholder="${c.placeholder}"></textarea>
    </div>`,
  )
}

function consentStep(n) {
  const c = copy.consent
  return step(
    n,
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

function summaryMarkup(plan) {
  const s = copy.summary
  const requestOnly = plan.mode === 'request'

  const orderRows = `
    <dl class="summary__rows">
      <div class="summary__row"><dt>${s.sum}</dt><dd data-sum></dd></div>
      <div class="summary__row"><dt>${s.delivery}</dt><dd data-delivery></dd></div>
    </dl>
    <p class="summary__total">
      <span>${s.total}</span>
      <span class="summary__total-value" data-total aria-live="polite"></span>
    </p>`

  const requestRows = `
    <dl class="summary__rows">
      <div class="summary__row"><dt>${s.positions}</dt><dd data-positions aria-live="polite"></dd></div>
    </dl>`

  return `
    <aside class="checkout__aside summary-sticky" aria-label="${requestOnly ? s.requestTitle : s.title}">
      <div class="summary">
        <h2 class="summary__title">${requestOnly ? s.requestTitle : s.title}</h2>
        ${plan.hasOrder ? `<ul class="summary__items" data-items aria-label="${s.itemsLabel}"></ul>` : ''}
        ${
          plan.hasRequest
            ? `${plan.hasOrder ? `<p class="summary__label">${s.requestTitle}</p>` : ''}
               <ul class="summary__items" data-request-items aria-label="${s.requestItemsLabel}"></ul>`
            : ''
        }
        <p class="checkout__edit"><a class="link-btn" href="${ROUTES.cart}">${s.edit}</a></p>

        ${plan.hasOrder ? orderRows : requestRows}

        <button type="submit" form="checkout-form" class="btn btn--solid summary__action" data-submit>
          ${copy.modes[plan.mode].submit}
        </button>
      </div>
    </aside>`
}

function markup(plan) {
  const mode = copy.modes[plan.mode]

  // Состав шагов — по режиму; номера сквозные по тем, что показаны.
  const steps = [
    (n) => contactsStep(n, plan),
    plan.hasOrder && ((n) => receiveStep(n)),
    plan.hasOrder && ((n) => whenStep(n, plan)),
    plan.hasOrder && ((n) => paymentStep(n, plan)),
    plan.hasRequest && ((n) => requestStep(n, plan)),
    plan.hasOrder && ((n) => commentStep(n)),
    (n) => consentStep(n),
  ].filter(Boolean)

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
        <h1 class="checkout__title">${mode.title}</h1>
        <p class="checkout__lead">${mode.lead}</p>
      </div>

      <div class="checkout__layout">
        <form class="checkout__form" id="checkout-form" novalidate>
          ${steps.map((build, i) => build(i + 1)).join('')}
        </form>

        ${summaryMarkup(plan)}
      </div>
    </div>`
}

/** Свёрнутый состав: кадр и количество. Название — для скринридера. */
function summaryItem(line) {
  const li = document.createElement('li')
  li.className = 'summary__item'
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

  const plan = planOf(cart.getItems(), cart.getTotals())
  const signature = signatureOf(plan)

  document.title = `${copy.modes[plan.mode].title} — №1 Гранд Гурмэ`
  mount.className = 'page-checkout'
  mount.innerHTML = markup(plan)

  const form = mount.querySelector('#checkout-form')
  const f = form.elements
  const submit = mount.querySelector('[data-submit]')
  const panels = [...mount.querySelectorAll('[data-panel]')]
  const splitPanels = [...mount.querySelectorAll('[data-split-panel]')]

  const els = {
    items: mount.querySelector('[data-items]'),
    requestItems: mount.querySelector('[data-request-items]'),
    sum: mount.querySelector('[data-sum]'),
    delivery: mount.querySelector('[data-delivery]'),
    total: mount.querySelector('[data-total]'),
    positions: mount.querySelector('[data-positions]'),
  }

  const method = () => (plan.hasOrder ? f.method.value : null)
  const split = () => (plan.canSplit ? f.split.value : 'one')

  /* ---- сводка ---------------------------------------------------------- */

  function paintSummary() {
    const items = cart.getItems()
    if (!items.length) {
      location.replace(ROUTES.cart)
      return
    }

    const next = planOf(items, cart.getTotals())
    // Состав корзины поменяли в соседней вкладке так, что меняются сами
    // шаги (появилась заявка, ушёл предзаказ). Перестроить форму на месте
    // значило бы потерять введённое без предупреждения — страница
    // перечитывается, и человек видит правильный набор шагов.
    if (signatureOf(next) !== signature) {
      location.reload()
      return
    }

    if (els.items) els.items.replaceChildren(...next.orderItems.map(summaryItem))
    if (els.requestItems) els.requestItems.replaceChildren(...next.requestItems.map(summaryItem))

    if (next.hasOrder) {
      els.sum.textContent = formatPrice(next.totals.order.sum)
      els.delivery.textContent =
        method() === 'pickup'
          ? copy.summary.pickupValue
          : split() === 'two'
            ? copy.summary.deliveryTwo
            : copy.summary.deliveryValue
      els.total.textContent = formatPrice(next.totals.order.sum)
    } else {
      els.positions.textContent = String(next.totals.request.positions)
    }
  }

  /* ---- ошибки ---------------------------------------------------------- */

  const showError = (input, message, node = document.getElementById(`${input.id}-error`)) => {
    node.textContent = message
    node.hidden = !message
    input.setAttribute('aria-invalid', String(Boolean(message)))
  }

  const TEXT_FIELDS = plan.hasOrder ? ['name', 'phone', 'email', 'street'] : ['name', 'phone', 'email']
  const touched = new Set()

  /** Улица нужна только доставке: при самовывозе поле скрыто и не проверяется. */
  const isActive = (name) => name !== 'street' || method() === 'delivery'

  /** Email без заказа необязателен, но если введён — должен быть адресом. */
  const ruleFor = (name) =>
    name === 'email' && !plan.hasOrder ? (value) => (value.trim() ? rules.email(value) : '') : rules[name]

  const checkText = (name) => {
    const input = f[name]
    const message = isActive(name) ? ruleFor(name)(input.value) : ''
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
      if (touched.has(name) && !ruleFor(name)(input.value)) showError(input, '')
    })
  })

  /** Ряды интервалов, которые сейчас проверяются: '' | 'stock' | 'preorder'. */
  const activeShipments = () => {
    if (!plan.hasOrder) return []
    return split() === 'two' ? ['stock', 'preorder'] : ['']
  }

  const checkInterval = (key) => {
    const suffix = key ? `_${key}` : ''
    const inputs = [...form.querySelectorAll(`input[name="interval${suffix}"]`)]
    const error = mount.querySelector(`#co-interval${suffix}-error`)
    const message = f[`interval${suffix}`].value ? '' : copy.when.error
    error.textContent = message
    error.hidden = !message
    inputs.forEach((input) => input.setAttribute('aria-invalid', String(Boolean(message))))
    return message ? inputs[0] : null
  }

  const clearInterval = (key) => {
    const suffix = key ? `_${key}` : ''
    const error = mount.querySelector(`#co-interval${suffix}-error`)
    if (!error) return
    error.textContent = ''
    error.hidden = true
    form.querySelectorAll(`input[name="interval${suffix}"]`).forEach((input) => input.removeAttribute('aria-invalid'))
  }

  const checkConsent = () => {
    const message = f.consent.checked ? '' : copy.consent.error
    showError(f.consent, message)
    return message ? f.consent : null
  }

  form.addEventListener('change', (event) => {
    const { name, value } = event.target
    const interval = name.match(/^interval(?:_(stock|preorder))?$/)
    if (interval) checkInterval(interval[1] || '')
    if (name === 'consent' && f.consent.checked) showError(f.consent, '')
    if (name === 'method') switchMethod(value)
    if (name === 'split') switchSplit(value)
  })

  /* ---- способ получения и разделение ----------------------------------- */

  const reveal = (panel) => {
    if (REDUCED) return
    gsap.fromTo(panel, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' })
  }

  function switchMethod(value) {
    panels.forEach((panel) => {
      const on = panel.dataset.panel === value
      panel.hidden = !on
      if (on) reveal(panel)
    })
    if (value !== 'delivery') showError(f.street, '')

    // Подписи выбора разделения: «доставкой» или «визитом».
    if (plan.canSplit) {
      const texts = copy.when.split[value === 'pickup' ? 'pickup' : 'delivery']
      const date = formatDayMonth(plan.totals.order.readyAt)
      ;['one', 'two'].forEach((key) => {
        mount.querySelector(`[data-split-label="${key}"]`).textContent = texts[key].label
        mount.querySelector(`[data-split-sub="${key}"]`).textContent = fillText(texts[key].sub, { date })
      })
    }
    paintSummary()
  }

  function switchSplit(value) {
    splitPanels.forEach((panel) => {
      const on = panel.dataset.splitPanel === value
      panel.hidden = !on
      if (on) reveal(panel)
    })
    // Ошибки скрытых рядов снимаются: проверяется только то, что видно.
    if (value === 'two') clearInterval('')
    else ['stock', 'preorder'].forEach(clearInterval)
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
    const now = planOf(items, cart.getTotals())
    const value = (name) => (f[name]?.value ?? '').trim()

    const contact = { name: value('name'), phone: formatPhone(phoneDigits(f.phone.value)), email: value('email') }

    let order = null
    if (now.hasOrder) {
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

      const ids = (list) => list.map((line) => line.id)
      const shipments =
        split() === 'two'
          ? [
              { kind: 'stock', items: ids(now.stockItems), date: value('date_stock'), interval: value('interval_stock') },
              {
                kind: 'preorder',
                items: ids(now.preorderItems),
                date: value('date_preorder'),
                interval: value('interval_preorder'),
              },
            ]
          : [{ kind: 'all', items: ids(now.orderItems), date: value('date'), interval: value('interval') }]

      order = {
        receive,
        shipments,
        payment: f.payment.value,
        comment: value('comment'),
        promo: cart.getPromo(),
        items: now.orderItems,
        totals: {
          count: now.totals.order.count,
          positions: now.totals.order.positions,
          sum: now.totals.order.sum,
          readyAt: toIsoDay(now.totals.order.readyAt),
        },
      }
    }

    const request = now.hasRequest
      ? { items: now.requestItems, contactWay: f.contact_way.value, question: value('question') }
      : null

    return { mode: now.mode, contact, order, request }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    TEXT_FIELDS.forEach((name) => touched.add(name))
    // Порядок проверок — порядок полей на странице: фокус уйдёт на первое.
    const invalid = [...TEXT_FIELDS.map(checkText), ...activeShipments().map(checkInterval), checkConsent()].filter(
      Boolean,
    )
    if (invalid.length) {
      focusInvalid(invalid[0])
      return
    }

    submit.disabled = true
    submit.setAttribute('aria-busy', 'true')
    submit.textContent = copy.summary.submitting

    try {
      await submitCheckout(collectPayload())
    } catch {
      submit.disabled = false
      submit.removeAttribute('aria-busy')
      submit.textContent = copy.modes[plan.mode].submit
    }
  })

  paintSummary()

  // Состав поменяли в соседней вкладке — сводка следует за ним. Ленту дней
  // и блок оплаты не перестраиваем: введённое в форму терять нельзя.
  cart.subscribe(paintSummary)
}
