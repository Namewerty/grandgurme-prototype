/* ============================================================================
   Окно входа (22.09.2026): <dialog class="dialog dialog--login">, showModal().

   Открывает «Сообщить о поступлении» на карточке товара для гостя: подписка
   есть только у вошедшего, СМС уходит на номер кабинета. Внутри — те же
   шаги, что на /account/login (login-flow.js), без шага «Как к вам
   обращаться»: человек пришёл ради уведомления, имя заполнит в кабинете.

   Как удаление кабинета в pages/profile.js: фокус внутри окна держит
   браузер, Esc закрывает, после закрытия фокус возвращается на кнопку,
   которая окно открыла; клик по затемнению закрывает. Tab ходит по кругу —
   штатно с последней кнопки он уходит в интерфейс браузера.

   openLoginDialog возвращает промис: пользователь после верного кода или
   null, если окно закрыли, не войдя. Шапка и корзина на вход реагируют
   сами (account:change, слияние гостевой корзины в openSession).
   ============================================================================ */

import { accountCopy } from '../../data/account-copy.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import { createLoginFlow } from './login-flow.js'

const STOPS = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * @param {object} o
 * @param {string} o.title заголовок шага телефона
 * @param {string} o.lead  подводка шага телефона
 * @param {(phone: string) => Promise<object>} [o.requestCode] транспорт: выдать код
 * @param {(phone: string, code: string) => Promise<object>} [o.verifyCode] транспорт: проверить код
 *   Без них шаги ходят в api.js прототипа; на Битриксе окну передают
 *   серверные запросы (src/bitrix/login-transport.js).
 * @returns {Promise<object|null>}
 */
export function openLoginDialog({ title, lead, requestCode, verifyCode }) {
  return new Promise((resolve) => {
    const opener = document.activeElement
    let done = null

    const dialog = document.createElement('dialog')
    dialog.className = 'dialog dialog--login'
    dialog.setAttribute('aria-label', title)
    dialog.innerHTML = `
      <button type="button" class="icon-btn dialog__close" data-dialog-close>
        ${icons.close}<span class="visually-hidden">${accountCopy.login.close}</span>
      </button>
      <div class="dialog__body" data-login-host></div>`
    document.body.appendChild(dialog)

    const flow = createLoginFlow(dialog.querySelector('[data-login-host]'), {
      profileStep: false,
      heading: 'h2',
      phoneCopy: { title, lead },
      ...(requestCode ? { requestCode } : {}),
      ...(verifyCode ? { verifyCode } : {}),
      onComplete: (user) => {
        done = user
        dialog.close()
      },
    })

    dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return
      const stops = [...dialog.querySelectorAll(STOPS)].filter((el) => el.offsetWidth || el.offsetHeight)
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

    dialog.addEventListener('close', () => {
      getLenis()?.start()
      flow.destroy()
      dialog.remove()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
      resolve(done)
    })

    getLenis()?.stop()
    dialog.showModal()
    flow.focus()
  })
}
