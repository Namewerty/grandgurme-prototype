/* ============================================================================
   Ряд весов на карточке позиции в коробках (23.09.2026, src/data/boxes.js).

   ДВА ВИДА НА ОДНО СОСТОЯНИЕ. Отмеченные коробки и число в степпере — одно
   и то же: отметил вторую коробку — в степпере стало 2, нажал «+» — система
   отметила ближайшую к номиналу из свободных, нажал «−» — сняла последнюю
   отмеченную. Ни выключенных капсул, ни «выбрано 1 из 2»: состояние всегда
   целое, и «В корзину» кладёт ровно то, что отмечено. Последнюю отмеченную
   снять нельзя — коробок в корзине меньше одной не бывает.

   Кому вес неважен: одна капсула отмечена, цена под названием — её цена,
   «В корзину». Кому важен: отмечает свою, цена меняется на месте.

   Капсулы — кнопки с aria-pressed, а не радиокнопки: отметить можно
   несколько. Разметка ряда та же, что у «Фасовка» и «Упаковка» (.pbuy__row).
   О корзине модуль не знает: отдаёт отмеченные id через onChange и value.
   ============================================================================ */

import { packPrice, packsWord, pickPacks, weightsText } from '../../data/boxes.js'
import { productCopy } from '../../data/product-copy.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'

const copy = productCopy.boxes

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

/**
 * @param {object} o
 * @param {{ id: string, weightG: number }[]} o.free  свободные коробки по возрастанию веса
 * @param {number}   o.nominalG
 * @param {number}   o.pricePerKg
 * @param {string[]} [o.selected]  отмеченные при открытии; пусто — ближайшая к номиналу
 * @param {Function} o.onChange    ({ ids, packs, sum, count }) => void — после каждого изменения
 * @returns {{ node: HTMLElement, state: () => object, setCount: (n: number) => void }}
 */
export function createBoxPicker({ free, nominalG, pricePerKg, selected = [], onChange }) {
  const byId = new Map(free.map((pack) => [pack.id, pack]))
  /** Отмеченные в порядке выбора. */
  let ids = selected.filter((id) => byId.has(id))
  if (!ids.length) ids = pickPacks(free, 1, nominalG).map((pack) => pack.id)

  const node = document.createElement('div')
  node.className = 'pbuy__row pbuy__row--boxes'
  node.innerHTML = `
    <span class="pbuy__label" id="pbuy-boxes-label">${copy.row}</span>
    <div class="pbuy__chips" role="group" aria-label="${copy.rowLabel}">
      ${free
        .map(
          (pack) => `
        <button type="button" class="chip" aria-pressed="false" data-pack="${escapeHtml(pack.id)}">
          ${pack.weightG} г
        </button>`,
        )
        .join('')}
    </div>
    <p class="pbuy__row-note" data-boxes-many hidden></p>`

  const chips = new Map([...node.querySelectorAll('[data-pack]')].map((chip) => [chip.dataset.pack, chip]))
  const many = node.querySelector('[data-boxes-many]')

  const state = () => {
    const packs = ids.map((id) => byId.get(id))
    return {
      ids: ids.slice(),
      packs,
      count: ids.length,
      sum: Math.round(packs.reduce((n, pack) => n + packPrice(pricePerKg, pack.weightG) * 100, 0)) / 100,
      weights: weightsText(packs.map((pack) => pack.weightG)),
    }
  }

  const paint = () => {
    const on = new Set(ids)
    chips.forEach((chip, id) => {
      chip.classList.toggle('is-active', on.has(id))
      chip.setAttribute('aria-pressed', String(on.has(id)))
    })
    many.hidden = ids.length < 2
    many.textContent = ids.length < 2 ? '' : fill(copy.rowMany, { n: ids.length, word: packsWord(ids.length) })
  }

  const emit = () => {
    paint()
    onChange?.(state())
  }

  node.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-pack]')
    if (!chip) return
    const id = chip.dataset.pack
    if (ids.includes(id)) {
      // Последнюю отмеченную не снимаем: меньше одной коробки не бывает.
      if (ids.length === 1) return
      ids = ids.filter((item) => item !== id)
    } else {
      ids = ids.concat(id)
    }
    emit()
  })

  paint()

  return {
    node,
    state,
    /** Степпер: «+» отмечает ближайшую к номиналу свободную, «−» снимает последнюю. */
    setCount(n) {
      const next = Math.max(1, Math.min(free.length, n))
      if (next === ids.length) return
      if (next < ids.length) ids = ids.slice(0, next)
      else ids = ids.concat(pickPacks(free, next - ids.length, nominalG, ids).map((pack) => pack.id))
      emit()
    },
  }
}

/** Мелкая подпись у цены: «за коробку 202 г» / «за 2 коробки · 202 и 204 г». */
export const perBoxesText = ({ count, weights, packs }) =>
  count === 1
    ? fill(copy.perBox, { w: packs[0].weightG })
    : fill(copy.perBoxes, { n: count, word: packsWord(count), weights })

/** Цена выбранных коробок с подписью — разметка .pbuy__price. */
export const boxPriceMarkup = (picked) =>
  `${formatPrice(picked.sum)} <span class="pbuy__price-unit">${escapeHtml(perBoxesText(picked))}</span>`
