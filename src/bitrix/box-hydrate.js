/* ============================================================================
   Коробки на серверной разметке Битрикса (24.09.2026).

   Товар, который продаётся коробками разного веса, сервер рисует готовым
   (bitrix/templates/grandgurme/include/boxes.php): цену коробки по
   умолчанию, обычный <select> с весами и строку корзины с выбранными
   весами. Без скрипта всё это работает формами. Скрипт ставит поверх то же,
   что в прототипе, — теми же модулями:

     карточка  select → селектор веса (src/js/product/box-picker.js):
               «Коробка 202 г» выпадает списком, сколько коробок решает
               степпер, какие — селектор; отмеченные уходят в форму полями
               packs[] (ID предложений), цена под названием — их сумма;
     корзина   «Выбрать другие» → окно выбора (src/js/cart/box-dialog.js);
               выбор уходит формой строки с gg_action=packs.

   Данные — в атрибутах: data-box-picker у ряда карточки, data-box у ссылки
   в строке корзины. Тексты тоже приходят оттуда: у пласта в вакууме
   «упаковка», а не «коробка» (gg_box_js_copy).
   ============================================================================ */

import { createBoxPicker } from '../js/product/box-picker.js'
import { openBoxDialog } from '../js/cart/box-dialog.js'
import { escapeHtml, formatPrice, plural } from '../js/catalog/model.js'

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

const read = (node, attr) => {
  try {
    return JSON.parse(node.getAttribute(attr) || 'null')
  } catch {
    return null
  }
}

/** «за коробку 202 г» / «за 2 коробки · 202 и 204 г» — perBoxesText прототипа. */
const perText = (texts, { count, weights, packs }) =>
  count === 1
    ? fill(texts.perBox, { w: packs[0].weightG })
    : fill(texts.perBoxes, { n: count, word: plural(count, ...texts.words), weights })

function hydratePicker(row) {
  const data = read(row, 'data-box-picker')
  const form = document.getElementById(row.dataset.form || '')
  const price = document.querySelector('.pbuy__price[data-price]')
  const qty = form?.querySelector('.qty[data-qty-hydrate]')
  const qtyInput = qty?.querySelector('input[name="quantity"]')
  if (!data || !form || !data.free?.length) return

  const select = row.querySelector('select')
  const slot = document.createElement('div')
  slot.hidden = true
  form.appendChild(slot)

  const paint = (state) => {
    slot.innerHTML = state.ids.map((id) => `<input type="hidden" name="packs[]" value="${escapeHtml(id)}">`).join('')
    if (price && state.count) {
      price.innerHTML = `${formatPrice(state.sum)} <span class="pbuy__price-unit">${escapeHtml(perText(data.copy, state))}</span>`
    }
    if (qtyInput && Number(qtyInput.value) !== state.count && state.count) qtyInput.value = String(state.count)
  }

  const picker = createBoxPicker({
    free: data.free,
    nominalG: data.nominalG,
    pricePerKg: data.pricePerKg,
    selected: select?.value ? [select.value] : [],
    texts: data.copy,
    onChange: paint,
  })
  // select с name="packs[]" уходит вместе с рядом: дальше поля пишет paint.
  row.replaceWith(picker.node)
  paint(picker.state())

  qty?.addEventListener('qty-change', (event) => picker.setCount(Number(event.detail.value)))
}

function hydratePick(button) {
  const data = read(button, 'data-box')
  const form = button.closest('form')
  if (!data || !form) return
  button.hidden = false

  button.addEventListener('click', async () => {
    const ids = await openBoxDialog({
      name: data.name,
      pricePerKg: data.pricePerKg,
      nominalG: data.nominalG,
      n: data.n,
      free: data.free,
      selected: data.selected,
      texts: {
        lead: data.copy.dialogLead,
        listLabel: data.copy.listLabel,
        count: data.copy.dialogCount,
        hint: data.copy.hint,
        done: data.copy.done,
        cancel: data.copy.cancel,
        auto: data.copy.auto,
      },
      wordAcc: (n) => plural(n, ...data.copy.wordsAcc),
    })
    button.focus({ preventScroll: true })
    if (!ids || ids.slice().sort().join() === data.selected.slice().sort().join()) return

    form.querySelector('input[name="gg_action"]').value = 'packs'
    form.insertAdjacentHTML(
      'beforeend',
      ids.map((id) => `<input type="hidden" name="packs[]" value="${escapeHtml(id)}">`).join(''),
    )
    form.submit()
  })
}

export function hydrateBoxes(root = document) {
  root.querySelectorAll('[data-box-picker]').forEach(hydratePicker)
  root.querySelectorAll('button[data-pick][data-box]').forEach(hydratePick)
}
