/* ============================================================================
   Список коробок: вес слева, цена справа, отметка ровно n штук.

   Общий для двух носителей (src/data/boxes.js):
     карточка товара  выпадающий селектор веса (src/js/product/box-picker.js);
     корзина          окно «Выбрать другие» (src/js/cart/box-dialog.js).
   Раньше список жил внутри окна, и селектору карточки пришлось бы завести
   второй такой же — с теми же правилами «при n отмеченных остальные
   выключены» и «Отмечено 2 из 2».

   Ни о складе, ни о корзине не знает: список коробок приходит снаружи
   (граница cart/boxes.js), выбор отдаётся через onPick. Состояние держит
   хозяин — здесь только отрисовка: update({ n, ids }) и ничего больше.
   При n = 1 строки — радиокнопки, иначе флажки.
   ============================================================================ */

import { packPrice } from '../../data/boxes.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { icons } from '../icons.js'

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

/**
 * @param {object} o
 * @param {{ id: string, weightG: number }[]} o.free  свободные коробки по возрастанию веса
 * @param {number}   o.pricePerKg
 * @param {{ listLabel: string, count: string, hint: string }} o.texts
 * @param {(ids: string[]) => void} o.onPick  после каждого изменения отметок
 * @returns {{ node: HTMLElement, update: (state: { n: number, ids: string[] }) => void }}
 */
export function createBoxList({ free, pricePerKg, texts, onPick }) {
  // n = 0 — чтобы первый update() всегда отрисовал строки.
  let n = 0
  let ids = []

  const node = document.createElement('div')
  node.className = 'boxlist-block'
  node.innerHTML = `
    <ul class="boxlist" data-lenis-prevent aria-label="${escapeHtml(texts.listLabel)}"></ul>
    <p class="boxlist__hint field__hint" data-box-hint hidden>${escapeHtml(texts.hint)}</p>
    <p class="boxlist__count" data-box-count aria-live="polite" hidden></p>`

  const list = node.querySelector('.boxlist')
  const hint = node.querySelector('[data-box-hint]')
  const count = node.querySelector('[data-box-count]')

  const inputs = () => [...list.querySelectorAll('input[name="pack"]')]

  function render() {
    const single = n <= 1
    list.innerHTML = free
      .map(
        (pack) => `
      <li class="boxlist__row">
        <label class="check boxlist__label">
          <input type="${single ? 'radio' : 'checkbox'}" name="pack" value="${escapeHtml(pack.id)}">
          <span class="check__box" aria-hidden="true">${icons.check}</span>
          <span class="boxlist__weight">${pack.weightG} г</span>
          <span class="boxlist__price">${formatPrice(packPrice(pricePerKg, pack.weightG))}</span>
        </label>
      </li>`,
      )
      .join('')
  }

  function paint() {
    const chosen = new Set(ids)
    // Отмечено столько, сколько нужно: остальные выключены, иначе человек
    // отметил бы третью коробку при двух в корзине и не понял, что случилось.
    const full = n > 1 && ids.length >= n
    inputs().forEach((input) => {
      input.checked = chosen.has(input.value)
      input.disabled = full && !input.checked
    })
    hint.hidden = !full
    count.hidden = n < 2
    count.textContent = n < 2 ? '' : fill(texts.count, { k: ids.length, n })
  }

  list.addEventListener('change', () => {
    ids = inputs()
      .filter((input) => input.checked)
      .map((input) => input.value)
    paint()
    onPick(ids.slice())
  })

  return {
    node,
    update(next) {
      const rebuild = next.n !== n
      n = next.n
      ids = next.ids.slice()
      if (rebuild) render()
      paint()
    },
  }
}
