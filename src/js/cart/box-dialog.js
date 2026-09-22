/* ============================================================================
   Окно выбора коробок (<dialog class="dialog dialog--boxes">) — корзина,
   ссылка «Выбрать другие» в строке (src/js/cart/cart-page.js). С 23.09.2026
   на оформлении окна нет: выбор делается в карточке и здесь.

   Список всех свободных коробок по возрастанию веса: при одной коробке —
   радиокнопки, иначе флажки; когда отмечено n, остальные выключаются.
   «Готово» отдаёт отмеченные id, «Подобрать автоматически» — n ближайших
   к номиналу. Esc, «Отмена» и клик по затемнению закрывают без изменений
   (null). Список приходит снаружи (getFreePacks): окно о складе не знает.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { packPrice, packsWordAcc, pickPacks, pricePer100 } from '../../data/boxes.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { icons } from '../icons.js'
import { getLenis } from '../scroll.js'
import { fillText } from './summary.js'

const copy = cartCopy.boxes.dialog

/**
 * @param {object} o
 * @param {string}   o.name        название позиции — заголовок окна
 * @param {number}   o.pricePerKg
 * @param {number}   o.nominalG    для «Подобрать автоматически»
 * @param {number}   o.n           сколько коробок отметить
 * @param {{ id: string, weightG: number }[]} o.free  свободные коробки
 * @param {string[]} o.selected    отмеченные сейчас
 * @returns {Promise<string[] | null>} id отмеченных или null — без изменений
 */
export function openBoxDialog({ name, pricePerKg, nominalG, n, free, selected }) {
  const single = n === 1
  const chosen = new Set(selected)

  const dialog = document.createElement('dialog')
  dialog.className = 'dialog dialog--boxes'
  dialog.setAttribute('aria-labelledby', 'box-dialog-title')
  dialog.innerHTML = `
    <h2 class="dialog__title" id="box-dialog-title">${escapeHtml(name)}</h2>
    <p class="dialog__text">${escapeHtml(
      fillText(copy.lead, { per100: formatPrice(pricePer100(pricePerKg)), n, word: packsWordAcc(n) }),
    )}</p>
    <ul class="boxlist" data-lenis-prevent aria-label="${copy.listLabel}">
      ${free
        .map(
          (pack) => `
        <li class="boxlist__row">
          <label class="check boxlist__label">
            <input type="${single ? 'radio' : 'checkbox'}" name="pack" value="${escapeHtml(pack.id)}"${
              chosen.has(pack.id) ? ' checked' : ''
            }>
            <span class="check__box" aria-hidden="true">${icons.check}</span>
            <span class="boxlist__weight">${pack.weightG} г</span>
            <span class="boxlist__price">${formatPrice(packPrice(pricePerKg, pack.weightG))}</span>
          </label>
        </li>`,
        )
        .join('')}
    </ul>
    <p class="boxlist__hint field__hint" data-box-hint hidden>${copy.hint}</p>
    <p class="boxlist__count" data-box-count aria-live="polite"></p>
    <div class="dialog__actions">
      <button type="button" class="btn btn--solid" data-box-done>${copy.done}</button>
      <button type="button" class="btn" data-box-cancel>${copy.cancel}</button>
    </div>
    <p class="boxlist__auto"><button type="button" class="link-btn" data-box-auto>${copy.auto}</button></p>`
  document.body.appendChild(dialog)

  const inputs = [...dialog.querySelectorAll('input[name="pack"]')]
  const done = dialog.querySelector('[data-box-done]')
  const hint = dialog.querySelector('[data-box-hint]')
  const count = dialog.querySelector('[data-box-count]')

  const refresh = () => {
    const k = inputs.filter((input) => input.checked).length
    count.textContent = fillText(copy.count, { k, n })
    const full = !single && k >= n
    inputs.forEach((input) => {
      input.disabled = full && !input.checked
    })
    hint.hidden = !full
    done.disabled = k !== n
  }

  let result = null
  const close = () => dialog.close()

  dialog.addEventListener('change', refresh)
  done.addEventListener('click', () => {
    result = inputs.filter((input) => input.checked).map((input) => input.value)
    close()
  })
  dialog.querySelector('[data-box-cancel]').addEventListener('click', close)
  dialog.querySelector('[data-box-auto]').addEventListener('click', () => {
    result = pickPacks(free, n, nominalG).map((pack) => pack.id)
    close()
  })
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close()
  })
  // showModal() держит страницу недоступной, но Tab с последней кнопки
  // уходит в интерфейс браузера — держим его в окне по кругу.
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return
    const stops = [...dialog.querySelectorAll('input:not([disabled]), button:not([disabled]), a[href]')]
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

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      getLenis()?.start()
      dialog.remove()
      resolve(result)
    })
    getLenis()?.stop()
    dialog.showModal()
    refresh()
    ;(inputs.find((input) => input.checked) || inputs[0])?.focus()
  })
}
