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

   КАБИНЕТ (17.09.2026). Оформление без входа остаётся. Гостю вход предлагается
   одной строкой над первым шагом и ничего не блокирует. Вошедшему контакты
   подставлены из кабинета (остаются редактируемыми), сохранённые адреса стоят
   карточками-радиокнопками, последняя — «Другой адрес»; под полями нового
   адреса — чекбокс «Сохранить адрес в кабинете». В payload уходят
   contact.userId и order.addressId либо новый адрес. Вход сменился в соседней
   вкладке — корзина не переключается, страница просит обновиться.

   КОРОБКИ С РАЗНЫМ ВЕСОМ (22.09.2026, src/data/boxes.js). Выбора коробок
   здесь НЕТ с 23.09.2026: он в карточке и корзине, на оформлении уже поздно —
   человек теряется в форме. Строки приходят с выбранными коробками и точной
   суммой; в сводке только миниатюры и итог. Коробки под заказ: сумма с «≈»,
   у шага «Оплата» один вариант — при получении. Перед отправкой выбранные
   коробки проверяются заново (getFreePacks): купленную, пока заполняли форму,
   заменяет ближайшая свободная, заказ не отправляется, человек видит
   сообщение над составом и новую сумму; следующее нажатие отправляет.
   Коробки берутся только через границу cart/boxes.js.

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
import { packPrice, pickPacks } from '../../data/boxes.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { createImage } from '../media.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import { findPack, getFreePacks } from '../cart/boxes.js'
import * as cart from '../cart/store.js'
import { boxNote, fillText, kindOrder, modeOf, positionsLabel, sumLabel } from '../cart/summary.js'
import { formatPhone, maskPhone, phoneDigits, rules } from './validate.js'
import { submitCheckout } from './submit.js'
import { accountCopy } from '../../data/account-copy.js'
import { MAX_ADDRESSES, getAddresses } from '../account/api.js'
import { currentUser, onChange as onAccountChange } from '../account/session.js'

const copy = checkoutCopy
const accCopy = accountCopy.checkout

/** Значение радиокнопки «Другой адрес». */
const NEW_ADDRESS = 'new'
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
    // Есть ли коробки под заказ — от этого зависит шаг «Оплата».
    hasPreorderBoxes: orderItems.some((line) => line.boxes && line.kind !== 'stock'),
    totals,
  }
}

/**
 * Подпись состава страницы: поменялась — страницу нужно собрать заново.
 * Признак коробок под заказ здесь же: состав корзины может поменяться
 * в соседней вкладке, и шаг «Оплата» должен пересобраться вместе с ним.
 */
const signatureOf = (plan) => [plan.mode, plan.canSplit, plan.hasPreorderBoxes].join('|')

const totalsNow = () => cart.getTotals()

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

/**
 * Сохранённые адреса вошедшего — карточки-радиокнопки на основе .cap:
 * название или улица первой строкой, остальное второй; выбран основной.
 * Последняя карточка — «Другой адрес», она открывает обычные поля.
 */
function addressCards(addresses) {
  const details = (a) =>
    [
      a.label ? a.street : '',
      a.apartment && fillText(accountCopy.addresses.apartment, { value: a.apartment }),
      a.intercom && fillText(accountCopy.addresses.intercom, { value: a.intercom }),
    ]
      .filter(Boolean)
      .join(', ')

  const card = ({ value, label, sub, checked }) => `
    <label class="cap cap--split">
      <input type="radio" name="address" value="${escapeHtml(value)}"${checked ? ' checked' : ''}>
      <span class="cap__face">
        <span class="cap__label">${escapeHtml(label)}</span>
        ${sub ? `<span class="cap__sub">${escapeHtml(sub)}</span>` : ''}
      </span>
    </label>`

  const chosen = addresses.find((a) => a.isDefault) || addresses[0]
  return `
    <fieldset class="group">
      <legend class="field__label">${accCopy.addressLegend}</legend>
      <div class="split">
        ${addresses
          .map((a) => card({ value: a.id, label: a.label || a.street, sub: details(a), checked: a.id === chosen.id }))
          .join('')}
        ${card({ value: NEW_ADDRESS, label: accCopy.otherAddress, sub: accCopy.otherAddressSub })}
      </div>
    </fieldset>`
}

/** Под полями нового адреса у вошедшего: чекбокс сохранения или строка о лимите. */
function saveAddressRow(account) {
  if (!account.user) return ''
  if (account.addresses.length >= MAX_ADDRESSES) {
    return `<p class="field__hint field--wide">${accCopy.addressLimit}</p>`
  }
  return `
    <div class="field field--wide">
      <label class="check" for="co-save-address">
        <input type="checkbox" id="co-save-address" name="save_address" checked>
        <span class="check__box" aria-hidden="true">${icons.check}</span>
        <span>${accCopy.saveAddress}</span>
      </label>
    </div>`
}

function receiveStep(n, account) {
  const r = copy.receive
  const hasSaved = account.addresses.length > 0
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
      ${hasSaved ? addressCards(account.addresses) : ''}
      <div class="fields" data-new-address${hasSaved ? ' hidden' : ''}>
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
        ${saveAddressRow(account)}
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

const readyLine = (text, attrs = '') =>
  `<p class="ready-line co-note"${attrs}><span class="ready-line__mark" aria-hidden="true">⬦</span><span>${text}</span></p>`

/**
 * Оплата. В заказе с заявкой — строка о том, что оплачивается только заказ.
 * Есть коробки под заказ — точной суммы у заказа нет: единственный вариант
 * «При получении» и примечание об этом.
 */
function paymentStep(n, plan) {
  const p = copy.payment
  const options = plan.hasPreorderBoxes ? p.options.filter((o) => o.value === 'on-receipt') : p.options
  const notes = [
    plan.hasPreorderBoxes ? readyLine(p.preorderBoxes) : '',
    plan.mode === 'both'
      ? readyLine(`<span data-order-only>${fillText(p.orderOnly, { sum: sumLabel({ value: plan.totals.order.sum, approx: plan.totals.order.approx }) })}</span>`)
      : '',
  ].join('')

  return step(
    n,
    'co-payment',
    p.title,
    `<fieldset class="group">
       <legend class="visually-hidden">${p.legend}</legend>
       <div class="caps">
         ${options.map((o, i) => cap({ name: 'payment', value: o.value, label: o.label, checked: i === 0 })).join('')}
       </div>
     </fieldset>
     ${notes}`,
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
        ${
          /* Проверка коробок перед отправкой: сообщение над составом. */
          plan.hasOrder ? '<p class="summary__notice" data-box-notice tabindex="-1" hidden></p>' : ''
        }
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

function markup(plan, account) {
  const mode = copy.modes[plan.mode]

  // Вошедший: подводка режима «только заказ» говорит, что подставлено
  // из кабинета. Подводки двух других режимов не меняются.
  const lead =
    account.user && plan.mode === 'order'
      ? account.addresses.length
        ? accCopy.leadWithAddress
        : accCopy.leadContacts
      : mode.lead

  // Гость: вход предлагается одной строкой и ничего не блокирует.
  const loginHref = `${ROUTES.accountLogin}?${new URLSearchParams({ back: ROUTES.checkout })}`
  const guestLine = account.user
    ? ''
    : `<p class="checkout__login">${accCopy.guestBefore} <a href="${loginHref}">${accCopy.guestLink}</a> ${accCopy.guestAfter}</p>`

  // Состав шагов — по режиму; номера сквозные по тем, что показаны.
  const steps = [
    (n) => contactsStep(n, plan),
    plan.hasOrder && ((n) => receiveStep(n, account)),
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
        <p class="checkout__lead">${lead}</p>
      </div>

      <div class="checkout__layout">
        <form class="checkout__form" id="checkout-form" novalidate>
          <div class="checkout__notice" data-session-notice role="alert" hidden>
            <p>${accCopy.sessionChanged}</p>
            <button type="button" class="btn" data-session-reload>${accCopy.reload}</button>
          </div>
          ${guestLine}
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
    <span class="visually-hidden">${escapeHtml(line.name)}, ${escapeHtml(boxNote(line) ?? line.note)} — ${line.qty} шт.</span>`

  if (line.image) {
    li.querySelector('.summary__item-shot').appendChild(
      createImage({ src: line.image, alt: '', ratio: '1:1', className: 'media--compact' }),
    )
  }
  return li
}

/* -------------------------------------------------------------- страница */

/**
 * @param {HTMLElement} mount
 * @param {{ demo?: { beforeVerify?: (items: object[]) => void } | null }} [options]
 *   demo — только прототип (src/js/checkout/demo.js): ?demo=box-taken перед
 *   первой проверкой коробок помечает одну проданной
 */
export async function initCheckoutPage(mount, { demo = null } = {}) {
  if (!mount) return

  // Оформлять нечего — возвращаем в корзину: там пустое состояние с выходами.
  if (!cart.getItems().length) {
    location.replace(ROUTES.cart)
    return
  }

  // Корзину под заполненной формой не подменяем: вход сменился в соседней
  // вкладке — страница просит обновиться (см. watchSession ниже).
  cart.holdAccount()

  // Вошедший: контакты и адреса из кабинета. Оформление без входа остаётся.
  const user = currentUser()
  const account = { user, addresses: user ? await getAddresses() : [] }

  const plan = planOf(cart.getItems(), totalsNow())
  const signature = signatureOf(plan)

  /** Сообщения проверки коробок по id строки и строки, с которыми заказ не отправить. */
  const boxMessages = new Map()
  const blocked = new Set()

  document.title = `${copy.modes[plan.mode].title} — №1 Гранд Гурмэ`
  mount.className = 'page-checkout'
  mount.innerHTML = markup(plan, account)

  const form = mount.querySelector('#checkout-form')
  const f = form.elements
  const submit = mount.querySelector('[data-submit]')

  // Подставленное из кабинета остаётся редактируемым.
  if (user) {
    f.name.value = [user.name, user.lastName].filter(Boolean).join(' ')
    f.phone.value = formatPhone(user.phone).trim()
    f.email.value = user.email || ''
  }

  /** Выбран сохранённый адрес, а не «Другой адрес» и не обычные поля. */
  const savedAddress = () => {
    const id = account.addresses.length ? f.address?.value : null
    return id && id !== NEW_ADDRESS ? account.addresses.find((a) => a.id === id) || null : null
  }
  const panels = [...mount.querySelectorAll('[data-panel]')]
  const splitPanels = [...mount.querySelectorAll('[data-split-panel]')]

  const els = {
    items: mount.querySelector('[data-items]'),
    requestItems: mount.querySelector('[data-request-items]'),
    boxNotice: mount.querySelector('[data-box-notice]'),
    orderOnly: mount.querySelector('[data-order-only]'),
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

    const next = planOf(items, totalsNow())
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

    // Проверка коробок перед отправкой: сообщения над составом.
    if (els.boxNotice) {
      const messages = [...boxMessages.values()]
      els.boxNotice.hidden = !messages.length
      els.boxNotice.innerHTML = messages
        .map(
          (m) =>
            `${escapeHtml(m.text)}${m.link ? ` <a href="${m.link.href}">${m.link.label}</a>` : ''}`,
        )
        .join('<br>')
      els.boxNotice.setAttribute('role', messages.some((m) => m.alert) ? 'alert' : 'status')
    }

    if (next.hasOrder) {
      const total = sumLabel({ value: next.totals.order.sum, approx: next.totals.order.approx })
      els.sum.textContent = total
      els.delivery.textContent =
        method() === 'pickup'
          ? copy.summary.pickupValue
          : split() === 'two'
            ? copy.summary.deliveryTwo
            : copy.summary.deliveryValue
      els.total.textContent = total
      if (els.orderOnly) els.orderOnly.textContent = fillText(copy.payment.orderOnly, { sum: total })
    } else {
      els.positions.textContent = String(next.totals.request.positions)
    }
  }

  /* ---- коробки --------------------------------------------------------- */

  const boxLinesInStock = () => cart.getItems().filter((line) => line.boxes && line.kind === 'stock')
  const goneMessage = (line) => ({
    text: fillText(copy.boxes.gone, { name: line.name }),
    link: copy.boxes.goneLink,
    alert: true,
  })

  /**
   * Проверка перед отправкой: коробку, которую уже купили, пока человек
   * заполнял форму, заменяет ближайшая к номиналу свободная, не выбранная
   * в этом заказе; сводка пересчитывается, заказ не отправляется. Свободных
   * не осталось — сообщение со ссылкой в корзину, отправка стоит.
   * @returns {Promise<boolean>} можно ли отправлять
   */
  async function verifyBoxes() {
    let ok = true
    const lines = boxLinesInStock()
    const chosen = new Set(lines.flatMap((line) => line.boxes.packIds))

    for (const line of lines) {
      const free = await getFreePacks(line.slug)
      const freeIds = new Set(free.map((pack) => pack.id))
      const taken = line.boxes.packIds.filter((id) => !freeIds.has(id))
      if (!taken.length) {
        if (blocked.has(line.id) && free.length >= line.qty) {
          blocked.delete(line.id)
          boxMessages.delete(line.id)
        }
        continue
      }

      ok = false
      const next = line.boxes.packIds.slice()
      for (const id of taken) {
        const [replacement] = pickPacks(free, 1, line.boxes.nominalG, [...chosen])
        if (!replacement) {
          boxMessages.set(line.id, goneMessage(line))
          blocked.add(line.id)
          break
        }
        chosen.add(replacement.id)
        next[next.indexOf(id)] = replacement.id
        boxMessages.set(line.id, {
          alert: true,
          text: fillText(copy.boxes.taken, {
            name: line.name,
            old: findPack(line.slug, id)?.weightG ?? '',
            new: replacement.weightG,
            price: formatPrice(packPrice(line.boxes.pricePerKg, replacement.weightG)),
          }),
        })
      }
      if (!blocked.has(line.id)) cart.setPacks(line.id, next)
    }

    return ok && !blocked.size
  }

  /** Строка заказа: выбранные коробки с весом и ценой; под заказ — пусто и approx. */
  function toOrderLine(line) {
    if (!line.boxes) return line
    const { nominalG, pricePerKg, packIds } = line.boxes
    const inStock = line.kind === 'stock'
    const packs = inStock
      ? packIds
          .map((id) => findPack(line.slug, id))
          .filter(Boolean)
          .sort((a, b) => a.weightG - b.weightG)
          .map((pack) => ({ id: pack.id, weightG: pack.weightG, price: packPrice(pricePerKg, pack.weightG) }))
      : []
    return { ...line, boxes: { nominalG, pricePerKg, packs, approx: !inStock } }
  }

  /* ---- ошибки ---------------------------------------------------------- */

  const showError = (input, message, node = document.getElementById(`${input.id}-error`)) => {
    node.textContent = message
    node.hidden = !message
    input.setAttribute('aria-invalid', String(Boolean(message)))
  }

  const TEXT_FIELDS = plan.hasOrder ? ['name', 'phone', 'email', 'street'] : ['name', 'phone', 'email']
  const touched = new Set()

  /** Улица нужна только доставке на новый адрес: при самовывозе и при
      выбранном сохранённом адресе поле скрыто и не проверяется. */
  const isActive = (name) => name !== 'street' || (method() === 'delivery' && !savedAddress())

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
    if (name === 'address') switchAddress(value)
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

  /** «Другой адрес» открывает обычные поля; сохранённый — прячет их. */
  function switchAddress(value) {
    const fields = mount.querySelector('[data-new-address]')
    if (!fields) return
    const on = value === NEW_ADDRESS
    fields.hidden = !on
    if (on) {
      reveal(fields)
      f.street.focus({ preventScroll: true })
    } else {
      showError(f.street, '')
    }
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
    const now = planOf(items, totalsNow())
    const value = (name) => (f[name]?.value ?? '').trim()

    const contact = {
      name: value('name'),
      phone: formatPhone(phoneDigits(f.phone.value)),
      email: value('email'),
      // Заказ и заявка вошедшего сохраняются с его userId; у гостя — null.
      userId: user?.id || null,
    }

    let order = null
    if (now.hasOrder) {
      const pickupId = f.pickup?.value || pickupPoints[0]?.id
      // Сохранённый адрес уходит в заказ целиком: запись заказа читается
      // и без кабинета. Рядом — addressId; у нового адреса он null.
      const saved = savedAddress()
      const receive =
        method() === 'delivery'
          ? {
              method: 'delivery',
              city: copy.receive.city.value,
              street: saved ? saved.street : value('street'),
              apartment: saved ? saved.apartment : value('apartment'),
              intercom: saved ? saved.intercom : value('intercom'),
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
        addressId: method() === 'delivery' ? saved?.id || null : null,
        // Новый адрес с отмеченным чекбоксом сохранит submitCheckout.
        saveAddress: Boolean(user && method() === 'delivery' && !saved && f.save_address?.checked),
        shipments,
        payment: f.payment.value,
        comment: value('comment'),
        promo: cart.getPromo(),
        // Коробки уходят в заказ с весом и ценой каждой (toOrderLine).
        items: now.orderItems.map(toOrderLine),
        totals: {
          count: now.totals.order.count,
          positions: now.totals.order.positions,
          sum: now.totals.order.sum,
          // Есть коробки под заказ — сумма приблизительная, до фасовки.
          approx: Boolean(now.totals.order.approx),
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

    const release = () => {
      submit.disabled = false
      submit.removeAttribute('aria-busy')
      submit.textContent = copy.modes[plan.mode].submit
    }

    // Коробки проверяются заново: купленную заменяет свободная, заказ
    // не уходит — человек видит новую сумму и нажимает ещё раз.
    demo?.beforeVerify?.(cart.getItems())
    const boxesOk = await verifyBoxes()
    if (!boxesOk) {
      release()
      paintSummary()
      const message = els.boxNotice
      if (message && !message.hidden) {
        message.focus({ preventScroll: true })
        message.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' })
      }
      return
    }

    try {
      await submitCheckout(collectPayload())
    } catch {
      release()
    }
  })

  paintSummary()

  // Состав поменяли в соседней вкладке — сводка следует за ним. Ленту дней
  // и блок оплаты не перестраиваем: введённое в форму терять нельзя.
  cart.subscribe(paintSummary)

  /* Вход сменился в соседней вкладке (вошли, вышли или вошёл другой). Корзину
     не переключаем: над формой строка с кнопкой «Обновить», отправка
     выключена — иначе заказ ушёл бы с корзиной и контактами прежнего входа. */
  const notice = mount.querySelector('[data-session-notice]')
  notice.querySelector('[data-session-reload]').addEventListener('click', () => location.reload())
  onAccountChange(({ user: next }) => {
    if ((next?.id || null) === (user?.id || null)) return
    notice.hidden = false
    submit.disabled = true
    notice.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' })
  })
}
