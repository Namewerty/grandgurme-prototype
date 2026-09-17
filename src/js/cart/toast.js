/* ============================================================================
   Тост корзины. Переехал из src/js/cart.js.

   Тост ОДИН на всё приложение — повторный клик не добавляет второй, а
   перезапускает таймер и подсказку, поэтому тосты не копятся стопкой.

   Живёт в body, а не внутри секции: при уходе секции на .section__layer стоит
   transform, а он создаёт containing block — position: fixed внутри слоя
   считался бы от него, а не от экрана.

   ЕДИНСТВЕННОЕ ОТЛИЧИЕ ОТ СТАРОГО. У тоста появилась ссылка «Перейти»: раньше
   корзины не было и вести было некуда. Со ссылкой тост держится дольше
   и не гаснет, пока на нём курсор или фокус, — иначе ссылка исчезает из-под
   руки на полпути.
   ============================================================================ */

/** Сколько тост держится на экране. Со ссылкой — дольше: её надо успеть нажать. */
const TOAST_LIFETIME = 2500
const TOAST_LIFETIME_WITH_ACTION = 4500

let toast = null
let hideTimer = null
let lifetime = TOAST_LIFETIME

function ensureToast() {
  if (toast) return toast

  toast = document.createElement('div')
  toast.className = 'toast'
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  document.body.appendChild(toast)

  const hold = () => clearTimeout(hideTimer)
  const release = () => scheduleHide()
  toast.addEventListener('pointerenter', hold)
  toast.addEventListener('pointerleave', release)
  toast.addEventListener('focusin', hold)
  toast.addEventListener('focusout', release)

  return toast
}

function scheduleHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => toast?.classList.remove('is-visible'), lifetime)
}

/**
 * Действие справа от текста — ссылка ({ label, href }: «Перейти» в корзину
 * или в избранное) либо кнопка ({ label, onClick }: «Вернуть» позицию
 * в избранное). После нажатия кнопки тост гаснет сразу: действие выполнено,
 * и держать его на экране незачем.
 *
 * @param {string} text
 * @param {{ label: string, href: string } | { label: string, onClick: () => void }} [action]
 */
export function showToast(text, action) {
  const el = ensureToast()

  el.textContent = ''
  const message = document.createElement('span')
  message.textContent = text
  el.appendChild(message)

  if (action?.onClick) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'toast__link'
    button.textContent = action.label
    button.addEventListener('click', () => {
      clearTimeout(hideTimer)
      el.classList.remove('is-visible')
      action.onClick()
    })
    el.appendChild(button)
  } else if (action) {
    const link = document.createElement('a')
    link.className = 'toast__link'
    link.href = action.href
    link.textContent = action.label
    el.appendChild(link)
  }

  el.classList.toggle('has-action', Boolean(action))
  el.classList.add('is-visible')

  lifetime = action ? TOAST_LIFETIME_WITH_ACTION : TOAST_LIFETIME
  scheduleHide()
}
