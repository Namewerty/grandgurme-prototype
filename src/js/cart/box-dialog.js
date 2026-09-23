/* ============================================================================
   Окно выбора коробок (<dialog class="dialog dialog--boxes">) — корзина,
   ссылка «Выбрать другие» в строке (src/js/cart/cart-page.js). С 23.09.2026
   на оформлении окна нет: выбор делается в карточке и здесь.

   Сам список весов — общий компонент src/js/components/box-list.js, тот же,
   что в выпадающем селекторе карточки. Здесь вокруг него заголовок,
   подводка, «Готово» (активна, когда отмечено ровно n), «Отмена» и
   «Подобрать автоматически». Esc, «Отмена» и клик по затемнению закрывают
   без изменений (null). Список приходит снаружи (getFreePacks): окно
   о складе не знает.
   ============================================================================ */

import { cartCopy } from '../../data/cart-copy.js'
import { packsWordAcc, pickPacks, pricePer100 } from '../../data/boxes.js'
import { createBoxList } from '../components/box-list.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
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
  const dialog = document.createElement('dialog')
  dialog.className = 'dialog dialog--boxes'
  dialog.setAttribute('aria-labelledby', 'box-dialog-title')
  dialog.innerHTML = `
    <h2 class="dialog__title" id="box-dialog-title">${escapeHtml(name)}</h2>
    <p class="dialog__text">${escapeHtml(
      fillText(copy.lead, { per100: formatPrice(pricePer100(pricePerKg)), n, word: packsWordAcc(n) }),
    )}</p>
    <div data-box-slot></div>
    <div class="dialog__actions">
      <button type="button" class="btn btn--solid" data-box-done>${copy.done}</button>
      <button type="button" class="btn" data-box-cancel>${copy.cancel}</button>
    </div>
    <p class="boxlist__auto"><button type="button" class="link-btn" data-box-auto>${copy.auto}</button></p>`

  const done = dialog.querySelector('[data-box-done]')
  let ids = selected.slice()

  const list = createBoxList({
    free,
    pricePerKg,
    texts: { listLabel: copy.listLabel, count: copy.count, hint: copy.hint },
    onPick: (next) => {
      ids = next
      done.disabled = ids.length !== n
    },
  })
  dialog.querySelector('[data-box-slot]').replaceWith(list.node)
  document.body.appendChild(dialog)
  list.update({ n, ids })
  done.disabled = ids.length !== n

  let result = null
  const close = () => dialog.close()

  done.addEventListener('click', () => {
    result = ids.slice()
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
    const inputs = [...dialog.querySelectorAll('input[name="pack"]')]
    ;(inputs.find((input) => input.checked) || inputs[0])?.focus()
  })
}
