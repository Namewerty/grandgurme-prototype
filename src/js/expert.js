/* ============================================================================
   Плавающий виджет «Подобрать с экспертом».

   ВАЖНО: это ТОЛЬКО угловой виджет. Отдельной секции в потоке страницы и
   дублирующего блока быть не должно — так просил заказчик.

   Живёт в body, а не внутри секции: у .section__layer во время ухода секции
   стоит transform, и position: fixed внутри него считался бы от слоя, а не
   от экрана — виджет уезжал бы вместе с секцией.

   Свёрнут  — круглая кнопка 56px, при наведении слева выезжает плашка.
   Развёрнут — панель 380px раскрывается снизу вверх над кнопкой.

   ГЛАВНОЕ ДЕЙСТВИЕ — ФОРМА. Заказчик просил, чтобы писать можно было прямо
   с сайта. Мессенджеры остались, но ушли одной приглушённой строкой под форму:
   уход в WhatsApp — это выход со страницы.

   ⚠ БЭКЕНДА НЕТ. Отправка перехватывается, форма подменяется состоянием
   успеха внутри той же панели. Ни запроса на сервер, ни его имитации,
   ни выдуманного номера заявки здесь нет и быть не должно.

   Пока панель открыта, фокус заперт внутри неё: Tab и Shift+Tab ходят по
   кругу от крестика до последней ссылки. Закрытие — крестик, Esc, клик вне
   панели, из любого состояния, включая экран успеха; после закрытия фокус
   возвращается на кнопку, а не улетает в начало страницы.
   ============================================================================ */

import { expertCopy } from '../data/expert.js'
import { icons } from './icons.js'
import { watchBetweenHeroAndFooter } from './scroll.js'

/* Поля формы тоже ловятся ловушкой фокуса — иначе Tab уводил бы из панели
   на первом же вводе. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])'

const copy = expertCopy
const form = copy.form

/* --------------------------------------------------------------- разметка */

const field = ({ id, label, placeholder, optional, multiline = false, rows = 3 }) => `
  <div class="expert__field">
    <label class="expert__label" for="${id}">
      ${label}${optional ? `<span class="expert__optional"> — ${form.optional}</span>` : ''}
    </label>
    ${
      multiline
        ? `<textarea class="expert__input" id="${id}" name="${id}" rows="${rows}"
                     placeholder="${placeholder}"></textarea>`
        : `<input class="expert__input" id="${id}" name="${id}" type="text"
                  placeholder="${placeholder}" autocomplete="off">`
    }
    <p class="expert__error" id="${id}-error" hidden></p>
  </div>`

function render(mount) {
  mount.className = 'expert'
  mount.innerHTML = `
    <div class="expert__panel" id="expert-panel" role="dialog"
         aria-labelledby="expert-title" aria-hidden="true">
      <button class="expert__close icon-btn" type="button" data-expert-close>
        ${icons.close}
        <span class="visually-hidden">${copy.close}</span>
      </button>

      <p class="expert__title" id="expert-title">${copy.title}</p>
      <p class="expert__text">${copy.text}</p>

      <form class="expert__form" data-expert-form novalidate>
        ${field({ id: 'expert-name', label: form.name.label, placeholder: form.name.placeholder, optional: true })}
        ${field({ id: 'expert-contact', label: form.contact.label, placeholder: form.contact.placeholder })}
        ${field({
          id: 'expert-message',
          label: form.message.label,
          placeholder: form.message.placeholder,
          optional: true,
          multiline: true,
          rows: form.message.rows,
        })}

        <div class="expert__field expert__field--consent">
          <label class="expert__consent" for="expert-consent">
            <input type="checkbox" id="expert-consent" name="consent"
                   aria-describedby="expert-consent-error">
            <span class="expert__check" aria-hidden="true">${icons.check}</span>
            <span>${form.consent.text}
              <a href="${form.consent.href}">${form.consent.linkLabel}</a></span>
          </label>
          <p class="expert__error" id="expert-consent-error" hidden></p>
        </div>

        <button class="expert__btn expert__btn--solid" type="submit"
                data-expert-submit disabled>${form.submit}</button>
      </form>

      <div class="expert__done" data-expert-done hidden>
        <p class="expert__done-title">${copy.success.title}</p>
        <button class="expert__btn" type="button" data-expert-again>${copy.success.action}</button>
      </div>

      <p class="expert__messengers">
        ${copy.messengers.prefix}
        ${copy.messengers.items
          .map(({ label, href }) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`)
          .join('<span class="expert__dot" aria-hidden="true">·</span>')}
      </p>

      <p class="expert__phone">
        <a href="${copy.phone.href}">${copy.phone.label}</a>
      </p>
    </div>

    <button class="expert__toggle" type="button"
            aria-expanded="false" aria-controls="expert-panel">
      <span class="expert__tip" aria-hidden="true">${copy.tip}</span>
      <span class="expert__icon" aria-hidden="true">${icons.dialog}</span>
      <span class="visually-hidden">${copy.tip}</span>
    </button>
  `
}

/* ------------------------------------------------------------ ловушка фокуса */

function trapFocus(panel, event) {
  // Скрытые части панели (форма после отправки, экран успеха до неё) из
  // круга выпадают: иначе Tab проваливался бы в hidden-ветку.
  const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
  if (!items.length) return

  const first = items[0]
  const last = items[items.length - 1]

  // Фокус мог оказаться вне панели (клик мимо, программная установка) —
  // возвращаем его на край, а не гадаем, куда шагать дальше.
  if (!panel.contains(document.activeElement)) {
    event.preventDefault()
    first.focus()
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/* ------------------------------------------------------------------ форма */

/** Ошибка живёт под полем, а не всплывает: всплывающую не прочитать дважды. */
function setError(input, node, message) {
  const on = Boolean(message)
  node.textContent = message || ''
  node.hidden = !on
  input.setAttribute('aria-invalid', String(on))
  input.closest('.expert__field')?.classList.toggle('has-error', on)
}

/* ------------------------------------------------------------------- init */

export function initExpert(mount) {
  if (!mount) return

  render(mount)

  const panel = mount.querySelector('.expert__panel')
  const toggle = mount.querySelector('.expert__toggle')
  const close = mount.querySelector('[data-expert-close]')

  const formEl = mount.querySelector('[data-expert-form]')
  const done = mount.querySelector('[data-expert-done]')
  const submit = mount.querySelector('[data-expert-submit]')
  const again = mount.querySelector('[data-expert-again]')

  const contact = mount.querySelector('#expert-contact')
  const contactError = mount.querySelector('#expert-contact-error')
  const consent = mount.querySelector('#expert-consent')
  const consentError = mount.querySelector('#expert-consent-error')

  let open = false

  /* ---- согласие управляет кнопкой ------------------------------------- */

  const syncSubmit = () => {
    submit.disabled = !consent.checked
  }

  consent.addEventListener('change', () => {
    syncSubmit()
    if (consent.checked) setError(consent, consentError, '')
  })

  contact.addEventListener('input', () => {
    if (contact.value.trim()) setError(contact, contactError, '')
  })

  /* ---- отправка --------------------------------------------------------- */

  const showForm = () => {
    formEl.hidden = false
    done.hidden = true
  }

  formEl.addEventListener('submit', (event) => {
    // ⚠ БЭКЕНДА НЕТ: заявка никуда не уходит, и делать вид, что уходит,
    // нельзя. Показываем честное состояние успеха внутри панели.
    event.preventDefault()

    let ok = true
    if (!contact.value.trim()) {
      setError(contact, contactError, expertCopy.form.contact.error)
      ok = false
    }
    if (!consent.checked) {
      setError(consent, consentError, expertCopy.form.consent.error)
      ok = false
    }
    if (!ok) {
      // Фокус — на первое поле с ошибкой: без этого человек читает сообщение
      // внизу формы и не понимает, куда возвращаться.
      ;(contact.getAttribute('aria-invalid') === 'true' ? contact : consent).focus()
      return
    }

    formEl.hidden = true
    done.hidden = false
    again.focus()
  })

  again.addEventListener('click', () => {
    formEl.reset()
    setError(contact, contactError, '')
    setError(consent, consentError, '')
    syncSubmit()
    showForm()
    contact.focus()
  })

  /* ---- открытие и закрытие --------------------------------------------- */

  const setOpen = (next, { restoreFocus = true } = {}) => {
    if (open === next) return
    open = next

    mount.classList.toggle('is-open', open)
    panel.setAttribute('aria-hidden', String(!open))
    toggle.setAttribute('aria-expanded', String(open))

    // Первое поле получает фокус при открытии: панель открыли, чтобы писать,
    // а не чтобы искать, куда нажать. Крестик остаётся первым в табуляции.
    if (open) (formEl.hidden ? again : mount.querySelector('#expert-name')).focus()
    else if (restoreFocus) toggle.focus()
  }

  toggle.addEventListener('click', () => setOpen(!open))
  close.addEventListener('click', () => setOpen(false))

  /* Виджет открывается и снаружи: кнопка «Спросить эксперта» на карточке
     товара ведёт сюда, а не заводит вторую такую же форму на странице.
     Событие, а не экспортированная функция: карточка не должна знать,
     поднят ли виджет вообще, — на странице без него ничего не произойдёт. */
  document.addEventListener('expert:open', () => setOpen(true))

  // Ссылка уводит на другую страницу или в мессенджер — панель за собой
  // закрываем, но фокус не отбираем: пользователь уже ушёл по ссылке.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false, { restoreFocus: false })
  })

  document.addEventListener('keydown', (event) => {
    if (!open) return
    if (event.key === 'Escape') setOpen(false)
    else if (event.key === 'Tab') trapFocus(panel, event)
  })

  // pointerdown, а не click: панель закрывается по нажатию, до того как
  // браузер решит, куда отдать фокус.
  document.addEventListener('pointerdown', (event) => {
    if (!open || mount.contains(event.target)) return
    setOpen(false, { restoreFocus: false })
  })

  // Появляется после hero, исчезает на подвале — как кольцо прогресса.
  // Закрываем панель на уходе: висящая панель над невидимой кнопкой не нужна.
  watchBetweenHeroAndFooter(mount, (visible) => {
    if (!visible) setOpen(false, { restoreFocus: false })
  })

  syncSubmit()
}
