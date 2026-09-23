/* ============================================================================
   Шаги входа — один модуль на страницу /account/login и окно входа.

     1. телефон и согласие → requestCode;
     2. код из СМС → verifyCode (отправляется сам, когда введены все цифры);
     3. «Как к вам обращаться» — только для нового номера → completeProfile.
        Окно входа (login-dialog.js) этот шаг не показывает: человек пришёл
        ради уведомления, имя заполнит в кабинете. Кабинет для нового номера
        создаётся на шаге кода в любом случае.

   Функция рисует шаги в переданный узел и зовёт onComplete, когда они
   закончились. Настройки: показывать ли шаг профиля, уровень заголовка
   (на странице h1, в окне h2), заголовок и подводка первого шага, надзаголовок.

   ВХОД И РЕГИСТРАЦИЯ — ОДИН СЦЕНАРИЙ. Паролей, входа по почте и кнопок
   зарубежных сервисов нет (решение 17.09.2026, см. account-copy.js).

   Смена шага анимируется так же, как смена режима на оформлении; при
   prefers-reduced-motion — без анимации. После смены шага фокус на первом
   поле. Пока запрос к api.js не вернулся, кнопка шага выключена.

   Шаги — обычные формы: у полей name, у форм method="post", у кнопок type.
   На Битриксе их отдаёт сервер с теми же классами; окну входа вместо
   requestCode и verifyCode нужны запросы к серверу — записка
   PERENOS-ikra-menyu-ozhidanie.md.

   Вынесено 22.09.2026 из pages/login.js без изменения поведения страницы.
   ============================================================================ */

import gsap from 'gsap'
import { accountCopy } from '../../data/account-copy.js'
import { checkoutCopy } from '../../data/checkout-copy.js'
import { escapeHtml } from '../catalog/model.js'
import { PHONE_LENGTH, formatPhone, maskPhone, optionalEmail, phoneDigits, rules } from '../checkout/validate.js'
import { icons } from '../icons.js'
import { completeProfile, requestCode as requestCodeLocal, verifyCode as verifyCodeLocal } from './api.js'
import { createCodeStep } from './code-input.js'
import { fill, phoneLabel } from './layout.js'
import { currentUser } from './session.js'

const copy = accountCopy.login
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const field = ({ id, name, label, type = 'text', autocomplete, inputmode, placeholder, hint, optional }) => `
  <div class="field">
    <label class="field__label" for="${id}">
      ${label}${optional ? `<span class="field__optional"> · ${checkoutCopy.optional}</span>` : ''}
    </label>
    <input class="field__input" id="${id}" name="${name}" type="${type}"
           ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''}
           ${placeholder ? `placeholder="${placeholder}"` : ''} ${optional ? '' : 'aria-required="true"'}
           aria-describedby="${id}-error${hint ? ` ${id}-hint` : ''}">
    <p class="field__error" id="${id}-error" hidden></p>
    ${hint ? `<p class="field__hint" id="${id}-hint">${hint}</p>` : ''}
  </div>`

function showError(input, message) {
  const node = document.getElementById(`${input.id}-error`)
  node.textContent = message
  node.hidden = !message
  input.setAttribute('aria-invalid', String(Boolean(message)))
}

const setBusy = (button, busy) => {
  button.disabled = busy
  if (busy) button.setAttribute('aria-busy', 'true')
  else button.removeAttribute('aria-busy')
}

/**
 * @param {HTMLElement} host   куда рисовать шаги
 * @param {object} [o]
 * @param {boolean} [o.profileStep=true]  показывать ли шаг «Как к вам обращаться»
 * @param {'h1'|'h2'} [o.heading='h1']    уровень заголовка шага
 * @param {string|null} [o.eyebrow=null]  надзаголовок над первым шагом
 * @param {{ title?: string, lead?: string }} [o.phoneCopy]  заголовок и подводка первого шага
 * @param {string} [o.prefill='']         номер, подставленный в поле (десять цифр)
 * @param {'profile'|null} [o.start=null] начать сразу с шага профиля (демонстрация)
 * @param {(user: object, meta: { isNew: boolean }) => void} [o.onSignedIn]  после верного кода
 * @param {(user: object|null) => void} [o.onComplete]  шаги закончились
 * @param {(phone: string) => Promise<object>} [o.requestCode]  выдать код
 * @param {(phone: string, code: string) => Promise<object>} [o.verifyCode]  проверить код
 *   Два последних — транспорт. По умолчанию это api.js прототипа
 *   (localStorage, код 123456). На Битриксе шаги те же, но код выдаёт
 *   и проверяет сервер, поэтому окно входа подсовывает сюда свои две
 *   функции (src/bitrix/login-transport.js). Больше ничего в шагах
 *   не меняется — иначе два входа разошлись бы.
 * @returns {{ signingIn: boolean, focus(): void, destroy(): void }}
 *   signingIn — true с момента отправки кода: странице входа нужно отличать
 *   свой вход от входа в соседней вкладке.
 */
export function createLoginFlow(
  host,
  {
    profileStep = true,
    heading = 'h1',
    eyebrow = null,
    phoneCopy = {},
    prefill = '',
    start = null,
    onSignedIn = () => {},
    onComplete = () => {},
    requestCode = requestCodeLocal,
    verifyCode = verifyCodeLocal,
  } = {},
) {
  const H = heading === 'h2' ? 'h2' : 'h1'
  let phone = ''
  let codeStep = null
  let signingIn = start === 'profile'

  const finish = (user) => onComplete(user ?? currentUser())

  /** Смена шага: та же анимация, что у панелей оформления. */
  function show(form, focusTarget) {
    host.replaceChildren(form)
    if (!REDUCED) {
      gsap.fromTo(form, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out', clearProps: 'all' })
    }
    focusTarget()?.focus({ preventScroll: true })
  }

  /* ---- шаг 1: телефон ---------------------------------------------------- */

  function phoneStep(value = '') {
    const c = copy.phone
    const form = document.createElement('form')
    form.className = 'login__step'
    form.method = 'post'
    form.noValidate = true
    form.innerHTML = `
      ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
      <${H} class="login__title">${phoneCopy.title || c.title}</${H}>
      <p class="login__lead">${phoneCopy.lead || c.lead}</p>

      ${field({
        id: 'login-phone',
        name: 'phone',
        label: c.label,
        type: 'tel',
        autocomplete: 'tel',
        inputmode: 'tel',
        placeholder: c.placeholder,
      })}

      <div class="field">
        <label class="check" for="login-consent">
          <input type="checkbox" id="login-consent" name="consent" aria-required="true"
                 aria-describedby="login-consent-error">
          <span class="check__box" aria-hidden="true">${icons.check}</span>
          <span>${c.consent.before} <a href="${c.consent.consent.href}">${c.consent.consent.label}</a>
            ${c.consent.middle} <a href="${c.consent.privacy.href}">${c.consent.privacy.label}</a></span>
        </label>
        <p class="field__error" id="login-consent-error" hidden></p>
      </div>

      <button type="submit" class="btn btn--solid login__submit">${c.submit}</button>
      <p class="field__error" data-form-error aria-live="assertive" hidden></p>
      <p class="login__note">${c.note}</p>`

    const input = form.elements.phone
    const consent = form.elements.consent
    const button = form.querySelector('[type="submit"]')
    const formError = form.querySelector('[data-form-error]')

    maskPhone(input)
    if (value) input.value = formatPhone(value)

    const phoneError = () => {
      const digits = phoneDigits(input.value)
      if (!digits) return c.errorEmpty
      return digits.length < PHONE_LENGTH ? rules.phone(input.value) : ''
    }

    input.addEventListener('blur', () => showError(input, input.value.trim() ? phoneError() : ''))
    input.addEventListener('input', () => {
      if (!phoneError()) showError(input, '')
    })
    consent.addEventListener('change', () => consent.checked && showError(consent, ''))

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (button.disabled) return

      const errors = [
        [input, phoneError()],
        [consent, consent.checked ? '' : c.consent.error],
      ]
      errors.forEach(([el, message]) => showError(el, message))
      const firstInvalid = errors.find(([, message]) => message)
      if (firstInvalid) {
        firstInvalid[0].focus()
        return
      }

      formError.hidden = true
      setBusy(button, true)
      const digits = phoneDigits(input.value)
      const result = await requestCode(digits)
      setBusy(button, false)

      if (!result.ok) {
        formError.textContent = fill(c.rateLimit, { m: Math.max(1, Math.ceil((result.retryIn || 60) / 60)) })
        formError.hidden = false
        return
      }
      phone = digits
      show(codeForm(result), () => codeStep)
    })

    return form
  }

  /* ---- шаг 2: код --------------------------------------------------------- */

  function codeForm({ resendIn, codeLength }) {
    const c = copy.code
    const form = document.createElement('form')
    form.className = 'login__step'
    form.method = 'post'
    form.noValidate = true
    form.innerHTML = `
      <${H} class="login__title">${c.title}</${H}>
      <p class="login__lead">
        ${escapeHtml(fill(c.sentTo, { phone: phoneLabel(phone) }))}
        <button type="button" class="link-btn login__change" data-change-phone>${c.changePhone}</button>
      </p>
      <div data-code-step></div>`

    // Таймер прежнего шага с кодом (вернулись с «Изменить номер») гасим.
    codeStep?.destroy()
    codeStep = createCodeStep({
      id: 'login-code',
      length: codeLength,
      resendIn,
      submitLabel: c.submit,
      onResend: () => requestCode(phone),
      onSubmit: async (code) => {
        signingIn = true
        const result = await verifyCode(phone, code)
        if (!result.ok) {
          signingIn = false
          return result
        }
        onSignedIn(result.user, { isNew: Boolean(result.isNew) })
        if (result.isNew && profileStep) show(profileForm(), () => host.querySelector('#login-name'))
        else finish(result.user)
        return result
      },
    })
    form.querySelector('[data-code-step]').replaceWith(codeStep.node)

    form.addEventListener('submit', (event) => {
      event.preventDefault()
      codeStep.submit()
    })
    form.querySelector('[data-change-phone]').addEventListener('click', () => {
      show(phoneStep(phone), () => host.querySelector('#login-phone'))
      // Согласие человек уже давал — возвращаем отмеченным.
      host.querySelector('#login-consent').checked = true
    })

    return form
  }

  /* ---- шаг 3: как к вам обращаться ---------------------------------------- */

  function profileForm() {
    const c = copy.profile
    const user = currentUser()
    const form = document.createElement('form')
    form.className = 'login__step'
    form.method = 'post'
    form.noValidate = true
    form.innerHTML = `
      <${H} class="login__title">${c.title}</${H}>
      <p class="login__lead">${escapeHtml(fill(c.lead, { phone: phoneLabel(user?.phone || phone) }))}</p>

      ${field({ id: 'login-name', name: 'name', label: c.name.label, autocomplete: 'given-name' })}
      ${field({
        id: 'login-email',
        name: 'email',
        label: c.email.label,
        type: 'email',
        autocomplete: 'email',
        inputmode: 'email',
        hint: c.email.hint,
        optional: true,
      })}

      <div class="field">
        <label class="check" for="login-marketing">
          <input type="checkbox" id="login-marketing" name="marketing">
          <span class="check__box" aria-hidden="true">${icons.check}</span>
          <span>${c.marketing}</span>
        </label>
      </div>

      <button type="submit" class="btn btn--solid login__submit">${c.submit}</button>
      <button type="button" class="link-btn login__later" data-later>${c.later}</button>`

    const f = form.elements
    const button = form.querySelector('[type="submit"]')

    f.name.addEventListener('input', () => f.name.value.trim() && showError(f.name, ''))
    f.email.addEventListener('blur', () => showError(f.email, optionalEmail(f.email.value)))
    f.email.addEventListener('input', () => !optionalEmail(f.email.value) && showError(f.email, ''))

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (button.disabled) return

      setBusy(button, true)
      const result = await completeProfile({
        name: f.name.value,
        email: f.email.value,
        marketing: f.marketing.checked,
      })
      if (result.ok) {
        finish(result.user)
        return
      }
      setBusy(button, false)
      showError(f.name, result.errors.name || '')
      showError(f.email, result.errors.email || '')
      ;(result.errors.name ? f.name : f.email).focus()
    })

    // «Заполнить позже»: кабинет уже создан на шаге кода, имя останется пустым.
    form.querySelector('[data-later]').addEventListener('click', () => finish())

    return form
  }

  /* ---- старт -------------------------------------------------------------- */

  if (start === 'profile') show(profileForm(), () => host.querySelector('#login-name'))
  else show(phoneStep(prefill), () => host.querySelector('#login-phone'))

  return {
    get signingIn() {
      return signingIn
    },
    focus: () => host.querySelector('input:not([disabled])')?.focus({ preventScroll: true }),
    destroy: () => {
      codeStep?.destroy()
      codeStep = null
    },
  }
}
