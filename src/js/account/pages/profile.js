/* ============================================================================
   Личные данные /account/profile.

   Имя, фамилия, почта (необязательная, проверка optionalEmail), уведомления.
   «Сохранить» доступна, когда что-то изменено. Телефон — текстом; смена
   номера — панель на месте строки телефона: новый номер → код → подтвердить.
   Таймер, ошибки и строка прототипа — те же, что на входе (createCodeStep).

   Удаление кабинета — <dialog>: фокус внутри окна держит сам браузер
   (showModal), Esc закрывает, после закрытия фокус возвращается на ссылку.
   ⚠ ПОДТВЕРДИТЬ У ЮРИСТА: порядок удаления и что остаётся у магазина.

   Вызывает api.js: saveProfile, requestPhoneChange, confirmPhoneChange,
   logout, deleteAccount.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { checkoutCopy } from '../../../data/checkout-copy.js'
import { ROUTES } from '../../../data/routes.js'
import { showToast } from '../../cart/toast.js'
import { PHONE_LENGTH, maskPhone, optionalEmail, phoneDigits, rules } from '../../checkout/validate.js'
import { icons } from '../../icons.js'
import { getLenis } from '../../scroll.js'
import { confirmPhoneChange, deleteAccount, requestPhoneChange, saveProfile } from '../api.js'
import { createCodeStep } from '../code-input.js'
import {
  accountTrail,
  fill,
  markLeaving,
  phoneLabel,
  renderFrame,
  requireUser,
  setTitle,
  signOut,
  watchSession,
} from '../layout.js'
import { currentUser } from '../session.js'

const copy = accountCopy.profile
const optional = `<span class="field__optional"> · ${checkoutCopy.optional}</span>`

export async function initProfilePage(mount) {
  const user = requireUser()
  if (!user) return

  setTitle(copy.pageTitle)
  const main = renderFrame(mount, { page: 'profile', trail: accountTrail({ label: copy.pageTitle }), user })

  // Удаление кабинета уводит на главную само — перехват выхода здесь мешал бы.
  let leaving = false
  watchSession(user.id, mount)

  main.innerHTML = `
    <h1 class="acc-title">${copy.pageTitle}</h1>

    <form class="acc-form" method="post" novalidate data-profile-form>
      <div class="fields">
        <div class="field">
          <label class="field__label" for="pf-name">${copy.name.label}</label>
          <input class="field__input" id="pf-name" name="name" type="text" autocomplete="given-name">
        </div>
        <div class="field">
          <label class="field__label" for="pf-last">${copy.lastName.label}${optional}</label>
          <input class="field__input" id="pf-last" name="lastName" type="text" autocomplete="family-name">
        </div>
        <div class="field field--wide">
          <label class="field__label" for="pf-email">${copy.email.label}${optional}</label>
          <input class="field__input" id="pf-email" name="email" type="email" autocomplete="email" inputmode="email"
                 aria-describedby="pf-email-error pf-email-hint">
          <p class="field__error" id="pf-email-error" hidden></p>
          <p class="field__hint" id="pf-email-hint">${copy.email.hint}</p>
        </div>
      </div>

      <div class="acc-form__phone" data-phone-row></div>

      <fieldset class="group">
        <legend class="co-label">${copy.notifications}</legend>
        <label class="check" for="pf-marketing">
          <input type="checkbox" id="pf-marketing" name="marketing">
          <span class="check__box" aria-hidden="true">${icons.check}</span>
          <span>${copy.marketing}</span>
        </label>
      </fieldset>

      <p><button type="submit" class="btn btn--solid" disabled>${copy.save}</button></p>
    </form>

    <div class="acc-form__foot">
      <button type="button" class="btn" data-logout>${copy.logout}</button>
      <button type="button" class="link-btn acc-form__remove" data-remove>${copy.remove}</button>
    </div>

    <dialog class="dialog" aria-labelledby="pf-remove-title" data-remove-dialog>
      <h2 class="dialog__title" id="pf-remove-title">${copy.removeDialog.title}</h2>
      <p class="dialog__text">${copy.removeDialog.text}</p>
      <p class="dialog__actions">
        <button type="button" class="btn btn--solid" data-remove-yes>${copy.removeDialog.yes}</button>
        <button type="button" class="btn" data-remove-no>${copy.removeDialog.no}</button>
      </p>
    </dialog>`

  /* ---- профиль ------------------------------------------------------------ */

  const form = main.querySelector('[data-profile-form]')
  const f = form.elements
  const save = form.querySelector('[type="submit"]')
  const emailError = form.querySelector('#pf-email-error')

  let saved = {
    name: user.name || '',
    lastName: user.lastName || '',
    email: user.email || '',
    marketing: Boolean(user.marketing),
  }
  const current = () => ({
    name: f.name.value.trim(),
    lastName: f.lastName.value.trim(),
    email: f.email.value.trim(),
    marketing: f.marketing.checked,
  })
  const fillForm = () => {
    f.name.value = saved.name
    f.lastName.value = saved.lastName
    f.email.value = saved.email
    f.marketing.checked = saved.marketing
  }
  const isDirty = () => JSON.stringify(current()) !== JSON.stringify(saved)
  const showEmailError = (message) => {
    emailError.textContent = message
    emailError.hidden = !message
    f.email.setAttribute('aria-invalid', String(Boolean(message)))
  }

  fillForm()
  form.addEventListener('input', () => {
    save.disabled = !isDirty()
    if (!optionalEmail(f.email.value)) showEmailError('')
  })
  f.email.addEventListener('blur', () => showEmailError(optionalEmail(f.email.value)))

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (save.disabled) return

    save.disabled = true
    const result = await saveProfile(current())
    if (!result.ok) {
      save.disabled = false
      showEmailError(result.errors.email || '')
      f.email.focus()
      return
    }
    saved = current()
    showToast(copy.saved)
  })

  /* ---- телефон и смена номера ---------------------------------------------- */

  const phoneRow = main.querySelector('[data-phone-row]')
  let codeStep = null

  function phoneStatic() {
    codeStep?.destroy()
    codeStep = null
    phoneRow.innerHTML = `
      <span class="field__label">${copy.phone.label}</span>
      <p class="field__static acc-form__phone-line">
        <span>${phoneLabel(currentUser()?.phone || user.phone)}</span>
        <button type="button" class="link-btn" data-change>${copy.phone.change}</button>
      </p>`
    phoneRow.querySelector('[data-change]').addEventListener('click', () => phoneEdit())
  }

  function phoneEdit() {
    const c = copy.phoneChange
    phoneRow.innerHTML = `
      <div class="acc-panel" role="group" aria-label="${c.title}">
        <div class="field">
          <label class="field__label" for="pf-new-phone">${c.label}</label>
          <input class="field__input" id="pf-new-phone" name="newPhone" form="pf-phone-form" type="tel"
                 autocomplete="tel" inputmode="tel" placeholder="${accountCopy.login.phone.placeholder}"
                 aria-required="true" aria-describedby="pf-new-phone-error">
          <p class="field__error" id="pf-new-phone-error" aria-live="assertive" hidden></p>
        </div>
        <p class="acc-panel__buttons">
          <button type="button" class="btn btn--solid" data-get-code>${c.getCode}</button>
          <button type="button" class="btn" data-cancel>${c.cancel}</button>
        </p>
      </div>`

    const input = phoneRow.querySelector('#pf-new-phone')
    const error = phoneRow.querySelector('#pf-new-phone-error')
    const getCode = phoneRow.querySelector('[data-get-code]')
    const showError = (message) => {
      error.textContent = message
      error.hidden = !message
      input.setAttribute('aria-invalid', String(Boolean(message)))
    }

    maskPhone(input)
    input.focus()
    phoneRow.querySelector('[data-cancel]').addEventListener('click', () => {
      phoneStatic()
      phoneRow.querySelector('[data-change]').focus()
    })
    // Поле живёт внутри формы профиля: Enter в нём не должен её отправлять.
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      getCode.click()
    })

    getCode.addEventListener('click', async () => {
      if (getCode.disabled) return
      const digits = phoneDigits(input.value)
      const message = !digits
        ? accountCopy.login.phone.errorEmpty
        : digits.length < PHONE_LENGTH
          ? rules.phone(input.value)
          : ''
      showError(message)
      if (message) {
        input.focus()
        return
      }

      getCode.disabled = true
      const result = await requestPhoneChange(digits)
      getCode.disabled = false
      if (!result.ok) {
        showError(
          result.error === 'phone_taken'
            ? c.taken
            : result.error === 'same_phone'
              ? c.same
              : fill(accountCopy.login.phone.rateLimit, { m: Math.max(1, Math.ceil((result.retryIn || 60) / 60)) }),
        )
        input.focus()
        return
      }
      phoneCode(digits, result)
    })
  }

  function phoneCode(digits, { resendIn, codeLength }) {
    const c = copy.phoneChange
    phoneRow.innerHTML = `
      <div class="acc-panel" role="group" aria-label="${c.title}">
        <p class="field__hint">${fill(accountCopy.login.code.sentTo, { phone: phoneLabel(digits) })}</p>
        <div data-code-step></div>
        <p class="acc-panel__buttons"><button type="button" class="link-btn" data-cancel>${c.cancel}</button></p>
      </div>`

    codeStep = createCodeStep({
      id: 'pf-code',
      length: codeLength,
      resendIn,
      submitLabel: c.confirm,
      onResend: () => requestPhoneChange(digits),
      onSubmit: async (code) => {
        const result = await confirmPhoneChange(code)
        if (result.ok) {
          phoneStatic()
          phoneRow.querySelector('[data-change]').focus()
          showToast(c.done)
        }
        return result
      },
    })
    phoneRow.querySelector('[data-code-step]').replaceWith(codeStep.node)

    // Блок стоит внутри формы профиля: его кнопка type="submit" отправила бы
    // профиль. Перехватываем нажатие и отправляем код.
    const button = codeStep.node.querySelector('[data-code-submit]')
    button.type = 'button'
    button.addEventListener('click', () => codeStep.submit())
    codeStep.node.querySelector('input').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      codeStep.submit()
    })

    phoneRow.querySelector('[data-cancel]').addEventListener('click', () => {
      phoneStatic()
      phoneRow.querySelector('[data-change]').focus()
    })
    codeStep.focus()
  }

  phoneStatic()

  /* ---- выход и удаление ---------------------------------------------------- */

  main.querySelector('[data-logout]').addEventListener('click', () => {
    leaving = true
    signOut()
  })

  const dialog = main.querySelector('[data-remove-dialog]')
  const removeLink = main.querySelector('[data-remove]')

  removeLink.addEventListener('click', () => {
    getLenis()?.stop()
    dialog.showModal()
    // Безопасная кнопка первой в фокусе: Enter по привычке не удаляет кабинет.
    dialog.querySelector('[data-remove-no]').focus()
  })
  dialog.addEventListener('close', () => {
    getLenis()?.start()
    if (!leaving) removeLink.focus()
  })
  // showModal() делает страницу под окном недоступной, но Tab с последней
  // кнопки уходит в интерфейс браузера. Держим его внутри окна по кругу.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const stops = [...dialog.querySelectorAll('button:not([disabled]), a[href]')]
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  })
  // Клик по затемнению вокруг окна закрывает его, как Esc.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
  dialog.querySelector('[data-remove-no]').addEventListener('click', () => dialog.close())
  dialog.querySelector('[data-remove-yes]').addEventListener('click', async () => {
    leaving = true
    markLeaving()
    await deleteAccount()
    location.assign(ROUTES.home)
  })
}
