/* ============================================================================
   Адреса доставки /account/addresses.

   Карточки по две в ряд от 768px; последняя клетка — кнопка «Добавить адрес»
   размером с карточку. ФОРМА ОТКРЫВАЕТСЯ НА МЕСТЕ: при изменении — вместо
   карточки, при добавлении — вместо кнопки. Модальных окон нет, confirm() нет:
   удаление подтверждается там же, на месте карточки.

   Поля и тексты ошибок — те же, что на оформлении (checkout-copy.js → receive,
   validate.js): город зафиксирован, Москва. До 10 адресов; первый становится
   основным сам; удалили основной — основным становится самый ранний.

   Вызывает api.js: getAddresses() при открытии и после каждого изменения,
   saveAddress, deleteAddress, setDefaultAddress.
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { checkoutCopy } from '../../../data/checkout-copy.js'
import { escapeHtml } from '../../catalog/model.js'
import { rules } from '../../checkout/validate.js'
import { icons } from '../../icons.js'
import { MAX_ADDRESSES, deleteAddress, getAddresses, saveAddress, setDefaultAddress } from '../api.js'
import { accountTrail, emptyState, fill, renderFrame, requireUser, setTitle, watchSession } from '../layout.js'

const copy = accountCopy.addresses
const receive = checkoutCopy.receive

/** «кв. 5 · домофон 5» — вторая строка карточки. */
export const addressDetails = (address) =>
  [
    address.apartment && fill(copy.apartment, { value: address.apartment }),
    address.intercom && fill(copy.intercom, { value: address.intercom }),
  ]
    .filter(Boolean)
    .join(' · ')

export async function initAddressesPage(mount) {
  const user = requireUser()
  if (!user) return

  setTitle(copy.pageTitle)
  const main = renderFrame(mount, { page: 'addresses', trail: accountTrail({ label: copy.pageTitle }), user })
  watchSession(user.id, mount)

  main.innerHTML = `
    <h1 class="acc-title">${copy.pageTitle}</h1>
    <p class="acc-sub">${copy.lead}</p>
    <div class="addr-grid" data-grid></div>`
  const grid = main.querySelector('[data-grid]')

  /** Что сейчас открыто на месте: { mode: 'edit'|'confirm'|'add', id } */
  let open = null
  /** Куда вернуть фокус после перерисовки: data-focus узла. */
  let focusKey = null

  /* ---- карточка ---------------------------------------------------------- */

  function card(address) {
    const el = document.createElement('article')
    el.className = 'addr-card'
    const details = addressDetails(address)
    el.innerHTML = `
      <h2 class="addr-card__title">${escapeHtml(address.label || address.street)}</h2>
      ${address.label ? `<p class="addr-card__line">${escapeHtml(address.street)}</p>` : ''}
      ${details ? `<p class="addr-card__line addr-card__line--mute">${escapeHtml(details)}</p>` : ''}
      ${address.isDefault ? `<p class="addr-card__default">${copy.default}</p>` : ''}
      <p class="addr-card__actions">
        <button type="button" class="link-btn" data-act="edit" data-focus="edit-${address.id}">${copy.edit}</button>
        <button type="button" class="link-btn" data-act="confirm" data-focus="remove-${address.id}">${copy.remove}</button>
        ${
          address.isDefault
            ? ''
            : `<button type="button" class="link-btn" data-act="default" data-focus="default-${address.id}">${copy.makeDefault}</button>`
        }
      </p>`

    el.addEventListener('click', async (event) => {
      const act = event.target.closest('[data-act]')?.dataset.act
      if (!act) return
      if (act === 'default') {
        await setDefaultAddress(address.id)
        focusKey = `edit-${address.id}`
      } else {
        open = { mode: act, id: address.id }
      }
      paint()
    })
    return el
  }

  /* ---- подтверждение удаления на месте карточки ---------------------------- */

  function confirmCard(address) {
    const el = document.createElement('div')
    el.className = 'addr-card addr-card--confirm'
    el.setAttribute('role', 'group')
    el.setAttribute('aria-label', copy.confirm.title)
    el.innerHTML = `
      <h2 class="addr-card__title">${copy.confirm.title}</h2>
      <p class="addr-card__line addr-card__line--mute">${escapeHtml(address.label || address.street)}</p>
      <p class="addr-card__buttons">
        <button type="button" class="btn btn--solid" data-yes>${copy.confirm.yes}</button>
        <button type="button" class="btn" data-no>${copy.confirm.no}</button>
      </p>`
    el.querySelector('[data-yes]').addEventListener('click', async () => {
      await deleteAddress(address.id)
      open = null
      focusKey = 'add'
      paint()
    })
    el.querySelector('[data-no]').addEventListener('click', () => {
      open = null
      focusKey = `remove-${address.id}`
      paint()
    })
    queueMicrotask(() => el.querySelector('[data-no]').focus())
    return el
  }

  /* ---- форма на месте карточки или кнопки --------------------------------- */

  function form(address) {
    const editing = Boolean(address)
    const el = document.createElement('form')
    el.className = 'addr-card addr-card--form'
    el.method = 'post'
    el.noValidate = true
    el.setAttribute('aria-label', editing ? copy.form.titleEdit : copy.form.titleAdd)

    const optional = `<span class="field__optional"> · ${checkoutCopy.optional}</span>`
    el.innerHTML = `
      <h2 class="addr-card__title">${editing ? copy.form.titleEdit : copy.form.titleAdd}</h2>
      <div class="fields">
        <div class="field field--wide">
          <label class="field__label" for="addr-label">${copy.form.label.label}${optional}</label>
          <input class="field__input" id="addr-label" name="label" type="text" autocomplete="off"
                 placeholder="${copy.form.label.placeholder}">
        </div>
        <div class="field field--wide">
          <span class="field__label">${receive.city.label}</span>
          <p class="field__static">${receive.city.value}</p>
          <p class="field__hint">${receive.city.hint} <a href="${receive.city.hintLink.href}">${receive.city.hintLink.label}</a></p>
        </div>
        <div class="field field--wide">
          <label class="field__label" for="addr-street">${receive.street.label}</label>
          <input class="field__input" id="addr-street" name="street" type="text" autocomplete="address-line1"
                 aria-required="true" aria-describedby="addr-street-error">
          <p class="field__error" id="addr-street-error" hidden></p>
        </div>
        <div class="field">
          <label class="field__label" for="addr-apartment">${receive.apartment.label}${optional}</label>
          <input class="field__input" id="addr-apartment" name="apartment" type="text" autocomplete="address-line2">
        </div>
        <div class="field">
          <label class="field__label" for="addr-intercom">${receive.intercom.label}${optional}</label>
          <input class="field__input" id="addr-intercom" name="intercom" type="text" autocomplete="off">
        </div>
        <div class="field field--wide">
          <label class="check" for="addr-default">
            <input type="checkbox" id="addr-default" name="isDefault">
            <span class="check__box" aria-hidden="true">${icons.check}</span>
            <span>${copy.form.makeDefault}</span>
          </label>
        </div>
      </div>
      <p class="field__error" data-form-error aria-live="assertive" hidden></p>
      <p class="addr-card__buttons">
        <button type="submit" class="btn btn--solid">${copy.form.save}</button>
        <button type="button" class="btn" data-cancel>${copy.form.cancel}</button>
      </p>`

    const f = el.elements
    if (editing) {
      f.label.value = address.label
      f.street.value = address.street
      f.apartment.value = address.apartment
      f.intercom.value = address.intercom
      f.isDefault.checked = address.isDefault
      // Основной адрес нельзя «разжаловать» снятием галочки: основной есть всегда.
      f.isDefault.disabled = address.isDefault
    }

    const streetError = el.querySelector('#addr-street-error')
    const formError = el.querySelector('[data-form-error]')
    const showStreet = (message) => {
      streetError.textContent = message
      streetError.hidden = !message
      f.street.setAttribute('aria-invalid', String(Boolean(message)))
    }
    f.street.addEventListener('blur', () => showStreet(rules.street(f.street.value)))
    f.street.addEventListener('input', () => !rules.street(f.street.value) && showStreet(''))

    el.addEventListener('submit', async (event) => {
      event.preventDefault()
      const submit = el.querySelector('[type="submit"]')
      if (submit.disabled) return

      const message = rules.street(f.street.value)
      showStreet(message)
      if (message) {
        f.street.focus()
        return
      }

      submit.disabled = true
      const result = await saveAddress({
        id: address?.id,
        label: f.label.value,
        street: f.street.value,
        apartment: f.apartment.value,
        intercom: f.intercom.value,
        isDefault: f.isDefault.checked,
      })
      submit.disabled = false

      if (!result.ok) {
        if (result.errors?.street) showStreet(result.errors.street)
        formError.textContent = result.error === 'duplicate' ? copy.form.duplicate : result.error === 'limit' ? copy.limit : ''
        formError.hidden = !formError.textContent
        ;(result.error === 'duplicate' ? f.street : submit).focus()
        return
      }
      open = null
      focusKey = `edit-${result.address.id}`
      paint()
    })

    el.querySelector('[data-cancel]').addEventListener('click', () => {
      open = null
      focusKey = editing ? `edit-${address.id}` : 'add'
      paint()
    })

    queueMicrotask(() => (editing ? f.street : f.label).focus())
    return el
  }

  /* ---- сетка --------------------------------------------------------------- */

  async function paint() {
    const list = await getAddresses()
    grid.replaceChildren()

    if (!list.length && open?.mode !== 'add') {
      grid.classList.add('is-empty')
      grid.appendChild(
        emptyState({
          icon: 'pin',
          title: copy.empty.title,
          text: copy.empty.text,
          action: copy.empty.action,
          onAction: () => {
            open = { mode: 'add' }
            paint()
          },
        }),
      )
      return
    }
    grid.classList.remove('is-empty')

    list.forEach((address) => {
      const here = open?.id === address.id
      grid.appendChild(
        here && open.mode === 'edit' ? form(address) : here && open.mode === 'confirm' ? confirmCard(address) : card(address),
      )
    })

    if (open?.mode === 'add') {
      grid.appendChild(form(null))
    } else if (list.length >= MAX_ADDRESSES) {
      const note = document.createElement('p')
      note.className = 'addr-limit'
      note.textContent = copy.limit
      grid.appendChild(note)
    } else {
      const add = document.createElement('button')
      add.type = 'button'
      add.className = 'addr-card addr-card--add'
      add.dataset.focus = 'add'
      add.innerHTML = `<span class="addr-card__plus" aria-hidden="true">${icons.plus}</span><span>${copy.add}</span>`
      add.addEventListener('click', () => {
        open = { mode: 'add' }
        paint()
      })
      grid.appendChild(add)
    }

    if (focusKey) {
      grid.querySelector(`[data-focus="${focusKey}"]`)?.focus()
      focusKey = null
    }
  }

  await paint()
}
