/* ============================================================================
   Поле одноразового кода.

   ОДНО НАСТОЯЩЕЕ ПОЛЕ, а не шесть: autocomplete="one-time-code",
   inputmode="numeric", maxlength по длине кода и подпись для скринридера.
   Ячейки рисуются под полем с aria-hidden — это только вид. Поэтому вставка
   из буфера, подстановка кода системой и менеджеры паролей работают как
   с обычным полем, а скринридер слышит одно поле, а не шесть безымянных.

   Поле лежит поверх ячеек прозрачным текстом; ячейка «под курсором» —
   следующая после введённых цифр, подсвечена каспием, пока поле в фокусе.

   Когда введены все цифры, вызывается onComplete — страница отправляет код
   сама. Повторного вызова на тот же код нет, пока значение не поменяется.
   ============================================================================ */

import { accountCopy } from '../../data/account-copy.js'

const copy = accountCopy.login

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

/** 59 → «0:59». */
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * @param {object} o
 * @param {string} o.id
 * @param {number} o.length
 * @param {string} o.label          подпись для скринридера: «Код из СМС»
 * @param {string} [o.describedBy]  id узла с ошибкой
 * @param {(code: string) => void} [o.onComplete]
 */
export function createCodeInput({ id, length, label, describedBy, onComplete }) {
  const node = document.createElement('div')
  node.className = 'code-input'
  node.style.setProperty('--code-length', String(length))
  node.innerHTML = `
    <input class="code-input__field" id="${id}" name="code" type="text" inputmode="numeric"
           autocomplete="one-time-code" maxlength="${length}" pattern="[0-9]*"
           aria-label="${label}"${describedBy ? ` aria-describedby="${describedBy}"` : ''}>
    <div class="code-input__cells" aria-hidden="true">
      ${'<span class="code-input__cell"></span>'.repeat(length)}
    </div>`

  const input = node.querySelector('input')
  const cells = [...node.querySelectorAll('.code-input__cell')]
  let completed = ''

  function paint() {
    const value = input.value
    const focused = document.activeElement === input
    cells.forEach((cell, i) => {
      cell.textContent = value[i] || ''
      cell.classList.toggle('is-filled', Boolean(value[i]))
      // Все цифры введены — курсор стоит на последней ячейке.
      cell.classList.toggle('is-active', focused && !input.disabled && i === Math.min(value.length, length - 1))
    })
  }

  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, length)
    if (digits !== input.value) input.value = digits
    paint()

    if (digits.length < length) completed = ''
    else if (digits !== completed) {
      completed = digits
      onComplete?.(digits)
    }
  })
  input.addEventListener('focus', paint)
  input.addEventListener('blur', paint)
  // Курсор всегда в конце: ячейка под курсором иначе показывала бы неправду.
  input.addEventListener('click', () => input.setSelectionRange(input.value.length, input.value.length))

  paint()

  return {
    node,
    input,
    get value() {
      return input.value
    },
    clear() {
      input.value = ''
      completed = ''
      paint()
    },
    setDisabled(disabled) {
      input.disabled = disabled
      node.classList.toggle('is-disabled', disabled)
      paint()
    },
    setInvalid(invalid) {
      input.setAttribute('aria-invalid', String(Boolean(invalid)))
      node.classList.toggle('is-invalid', Boolean(invalid))
    },
    focus() {
      input.focus({ preventScroll: true })
    },
  }
}

/**
 * Шаг с кодом целиком: поле, ошибка, таймер повторной отправки и строка
 * прототипа. Один на вход и на смену номера в профиле.
 *
 *   Ошибки — под полем, в aria-live="assertive":
 *     wrong_code          поле очищается, фокус остаётся в нём;
 *     attempts_exhausted  поле выключено, пока не запрошен новый код;
 *     expired             то же.
 *   Таймер «Новый код можно запросить через 0:59» скринридеру не читается:
 *   объявляется только момент, когда код снова можно запросить.
 *   rate_limit при повторной отправке показывается на месте ссылки.
 *
 * Пока запрос не вернулся, второй не уходит — ни по автоотправке, ни по
 * двойному нажатию кнопки: busy держит сам блок, кнопку выключает onBusy.
 *
 * @param {object} o
 * @param {string} o.id
 * @param {number} o.length
 * @param {number} o.resendIn                      секунд до повторной отправки
 * @param {(code: string) => Promise<object>} o.onSubmit   ответ api: { ok } | { ok: false, error, attemptsLeft }
 * @param {() => Promise<object>} o.onResend       ответ requestCode
 * @param {(busy: boolean) => void} [o.onBusy]
 */
export function createCodeStep({ id, length, resendIn, submitLabel, onSubmit, onResend, onBusy }) {
  const node = document.createElement('div')
  node.className = 'code-step'
  node.innerHTML = `
    <div data-code-slot></div>
    <p class="field__error" id="${id}-error" aria-live="assertive" hidden></p>
    <button type="submit" class="btn btn--solid code-step__submit" data-code-submit>${submitLabel}</button>
    <p class="code-step__resend" data-resend></p>
    <p class="visually-hidden" aria-live="polite" data-resend-live></p>
    <p class="code-step__prototype">${copy.code.prototype}</p>`

  const error = node.querySelector(`#${id}-error`)
  const resend = node.querySelector('[data-resend]')
  const live = node.querySelector('[data-resend-live]')
  let busy = false
  let timer = null

  const code = createCodeInput({
    id,
    length,
    label: copy.code.inputLabel,
    describedBy: `${id}-error`,
    onComplete: (value) => submit(value),
  })
  node.querySelector('[data-code-slot]').replaceWith(code.node)

  const button = node.querySelector('[data-code-submit]')

  // Кнопка «Войти» остаётся для тех, кто вводит по-другому; форма вокруг
  // блока зовёт submit() по своему событию submit.
  function setBusy(next) {
    busy = next
    button.disabled = next
    if (next) button.setAttribute('aria-busy', 'true')
    else button.removeAttribute('aria-busy')
    onBusy?.(next)
  }

  function showError(message) {
    error.textContent = message
    error.hidden = !message
    code.setInvalid(Boolean(message))
  }

  function startTimer(seconds) {
    clearInterval(timer)
    live.textContent = ''
    let left = Math.max(0, Math.round(seconds))

    const tick = () => {
      if (left <= 0) {
        clearInterval(timer)
        resend.innerHTML = `<button type="button" class="link-btn" data-resend-btn>${copy.code.resend}</button>`
        resend.querySelector('[data-resend-btn]').addEventListener('click', requestAgain)
        live.textContent = copy.code.resendReady
        return
      }
      resend.textContent = fill(copy.code.timer, { time: clock(left) })
      left -= 1
    }
    tick()
    timer = setInterval(tick, 1000)
  }

  async function requestAgain() {
    if (busy) return
    setBusy(true)
    const result = await onResend()
    setBusy(false)

    if (!result.ok) {
      clearInterval(timer)
      resend.textContent =
        result.error === 'rate_limit'
          ? fill(copy.phone.rateLimit, { m: Math.max(1, Math.ceil(result.retryIn / 60)) })
          : ''
      return
    }
    showError('')
    code.setDisabled(false)
    code.clear()
    code.focus()
    startTimer(result.resendIn)
  }

  async function submit(value = code.value) {
    if (busy) return
    if (value.length < length) {
      showError(copy.code.errors.incomplete)
      code.focus()
      return
    }

    setBusy(true)
    const result = await onSubmit(value)
    setBusy(false)
    if (result.ok) return

    if (result.error === 'wrong_code') {
      showError(fill(copy.code.errors.wrong_code, { n: result.attemptsLeft }))
      code.clear()
      code.focus()
    } else {
      // attempts_exhausted и expired: поле выключено, пока не запрошен новый код.
      showError(copy.code.errors[result.error] || copy.code.errors.expired)
      code.clear()
      code.setDisabled(true)
      // Ждать таймер незачем: код уже не примут — даём запросить новый сразу.
      startTimer(0)
    }
  }

  startTimer(resendIn)

  return {
    node,
    submit,
    focus: () => code.focus(),
    destroy: () => clearInterval(timer),
  }
}
