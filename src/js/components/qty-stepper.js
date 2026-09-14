/* ============================================================================
   Степпер количества: − / число / +. Общий для карточки товара и корзины.

   Про хранилище не знает ничего: получает число и отдаёт новое через
   onChange. Карточка держит количество у себя до нажатия «В корзину»,
   корзина сразу пишет его в store — компонент от этого не меняется.

   Число — настоящее поле ввода, а не подпись: заказ на двадцать банок
   для ресторана не набирают двадцатью нажатиями. Ввод применяется
   на change (уход с поля, Enter), а не на каждый символ: иначе, стирая
   «12», человек на полпути получал бы «1» и пересчёт суммы под рукой.
   ============================================================================ */

import { icons } from '../icons.js'

/**
 * @param {object}   o
 * @param {number}   o.value      стартовое число
 * @param {number}  [o.min=1]
 * @param {number}  [o.max=99]
 * @param {string}   o.label      подпись группы для скринридера
 * @param {string}   o.decrease   подпись кнопки «−»
 * @param {string}   o.increase   подпись кнопки «+»
 * @param {string}  [o.size]      'sm' — строка корзины
 * @param {Function} o.onChange   (next) => void
 * @param {Function}[o.onZero]    ввели 0 руками — в корзине это удаление
 */
export function createQtyStepper({
  value = 1,
  min = 1,
  max = 99,
  label,
  decrease,
  increase,
  size,
  onChange,
  onZero,
}) {
  const root = document.createElement('div')
  root.className = `qty${size === 'sm' ? ' qty--sm' : ''}`
  root.setAttribute('role', 'group')
  root.setAttribute('aria-label', label)

  root.innerHTML = `
    <button type="button" class="qty__btn" data-step="-1" aria-label="${decrease}">${icons.minus}</button>
    <input class="qty__value" type="text" inputmode="numeric" autocomplete="off"
           aria-label="${label}" maxlength="2">
    <button type="button" class="qty__btn" data-step="1" aria-label="${increase}">${icons.plus}</button>`

  const input = root.querySelector('.qty__value')
  const [minus, plus] = root.querySelectorAll('.qty__btn')
  let current = value

  const paint = () => {
    input.value = String(current)
    minus.disabled = current <= min
    plus.disabled = current >= max
  }

  const commit = (next) => {
    const clean = Math.max(min, Math.min(max, next))
    if (clean === current) {
      paint()
      return
    }
    current = clean
    paint()
    onChange?.(current)
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-step]')
    if (!button || button.disabled) return
    commit(current + Number(button.dataset.step))
  })

  input.addEventListener('change', () => {
    const typed = Number.parseInt(input.value.replace(/\D/g, ''), 10)
    if (typed === 0 && onZero) {
      onZero()
      return
    }
    commit(Number.isFinite(typed) ? typed : current)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur()
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      commit(current + (event.key === 'ArrowUp' ? 1 : -1))
    }
  })

  paint()

  return {
    node: root,
    get value() {
      return current
    },
    /** Снаружи поменяли число (соседняя вкладка, сброс) — без onChange. */
    set(next) {
      current = Math.max(min, Math.min(max, next))
      paint()
    },
  }
}
