/* ============================================================================
   Проверка полей оформления и маска телефона.

   Чистые функции: значение на входе, текст ошибки на выходе ('' — ошибки
   нет). Когда показывать ошибку — решает страница: по уходу с поля и
   при отправке, но не на каждый символ. Ошибка «номер неполный» на третьей
   цифре — это упрёк человеку, который ещё печатает.
   ============================================================================ */

import { checkoutCopy } from '../../data/checkout-copy.js'

const copy = checkoutCopy

export const PHONE_LENGTH = 10

/**
 * Десять цифр номера без кода страны. Понимает «+7 925…», «8 925…»,
 * «7925…» и вставку из буфера со скобками и дефисами.
 */
export function phoneDigits(value) {
  const raw = String(value || '').trim()
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+7')) digits = digits.slice(1)
  else if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1)
  return digits.slice(0, PHONE_LENGTH)
}

/** «+7 925 466-66-46», дописывается по мере ввода. */
export function formatPhone(digits) {
  let out = '+7 '
  if (!digits) return out
  out += digits.slice(0, 3)
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`
  return out
}

/**
 * Маска на поле. При удалении символов номер не переформатируется до ухода
 * с поля: иначе стереть пробел или дефис было бы нельзя — маска возвращала
 * бы его на место на каждое нажатие Backspace.
 */
export function maskPhone(input) {
  input.addEventListener('focus', () => {
    if (!input.value) input.value = '+7 '
  })

  input.addEventListener('input', (event) => {
    if (event.inputType?.startsWith('delete')) return
    input.value = formatPhone(phoneDigits(input.value))
  })

  input.addEventListener('blur', () => {
    const digits = phoneDigits(input.value)
    input.value = digits ? formatPhone(digits) : ''
  })
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const rules = {
  name: (value) => (value.trim() ? '' : copy.contacts.name.error),

  phone: (value) => {
    const digits = phoneDigits(value)
    if (!digits) return copy.contacts.phone.errorEmpty
    return digits.length < PHONE_LENGTH ? copy.contacts.phone.error : ''
  },

  email: (value) => {
    if (!value.trim()) return copy.contacts.email.errorEmpty
    return EMAIL.test(value.trim()) ? '' : copy.contacts.email.error
  },

  street: (value) => (value.trim() ? '' : copy.receive.street.error),
}

/**
 * Почта там, где она необязательна (вход, профиль, заявка без заказа):
 * пустое поле ошибок не даёт, заполненное проверяется тем же правилом.
 */
export const optionalEmail = (value) => (String(value || '').trim() ? rules.email(String(value)) : '')
