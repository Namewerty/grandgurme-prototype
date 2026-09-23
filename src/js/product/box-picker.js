/* ============================================================================
   Селектор веса коробки на карточке (23.09.2026, src/data/boxes.js).

   ОДИН СЕЛЕКТОР, А НЕ РЯД ВЕСОВ. На действующем сайте все коробки выложены
   на страницу кнопками — от этого и уходим: здесь под ценой стоит одна
   строка «Коробка 202 г», она выпадает списком весов с ценами (общий
   список — src/js/components/box-list.js, тот же, что в окне корзины).
   Кому вес неважен, тот видит цену и «В корзину» и селектор не открывает.

   СКОЛЬКО КОРОБОК — РЕШАЕТ СТЕПЕР, КАКИЕ ИМЕННО — СЕЛЕКТОР. При одной
   коробке список — радиокнопки, и выбор сразу закрывает панель. Поставили
   в степпере 2 — в списке флажки, отметить нужно две; «+» отмечает
   ближайшую к номиналу из свободных, «−» снимает последнюю отмеченную,
   и подпись селектора становится «Коробка 202 и 238 г».

   О корзине модуль не знает: отдаёт отмеченные id через onChange и state().
   ============================================================================ */

import { defaultPack, nearerTo, packPrice, packsWord, pickPacks, weightsText } from '../../data/boxes.js'
import { productCopy } from '../../data/product-copy.js'
import { createBoxList } from '../components/box-list.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { icons } from '../icons.js'

const copy = productCopy.boxes

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

/**
 * @param {object} o
 * @param {{ id: string, weightG: number }[]} o.free  свободные коробки по возрастанию веса
 * @param {number}   o.nominalG
 * @param {number}   o.pricePerKg
 * @param {string[]} [o.selected]  отмеченные при открытии; пусто — ближайшая к номиналу
 * @param {Function} o.onChange    ({ ids, packs, count, sum, weights }) => void
 * @returns {{ node: HTMLElement, state: () => object, setCount: (n: number) => void }}
 */
export function createBoxPicker({ free, nominalG, pricePerKg, selected = [], onChange }) {
  const byId = new Map(free.map((pack) => [pack.id, pack]))
  /** Отмеченные в порядке выбора. */
  let ids = selected.filter((id) => byId.has(id))
  if (!ids.length) {
    const first = defaultPack(free, nominalG)
    ids = first ? [first.id] : []
  }

  const node = document.createElement('div')
  node.className = 'pbuy__row pbuy__row--boxes'
  node.innerHTML = `
    <span class="pbuy__label" id="pbuy-box-label">${copy.row}</span>
    <div class="boxsel" data-boxsel>
      <button type="button" class="boxsel__trigger" data-boxsel-trigger
              aria-expanded="false" aria-controls="pbuy-box-panel">
        <span class="boxsel__value" data-boxsel-value></span>
        <span class="boxsel__caret" aria-hidden="true">${icons.chevronDown}</span>
      </button>
      <div class="boxsel__panel" id="pbuy-box-panel" data-boxsel-panel hidden></div>
    </div>`

  const trigger = node.querySelector('[data-boxsel-trigger]')
  const value = node.querySelector('[data-boxsel-value]')
  const panel = node.querySelector('[data-boxsel-panel]')

  const state = () => {
    const packs = ids.map((id) => byId.get(id))
    return {
      ids: ids.slice(),
      packs,
      count: ids.length,
      sum: packs.reduce((n, pack) => n + packPrice(pricePerKg, pack.weightG), 0),
      weights: weightsText(packs.map((pack) => pack.weightG)),
    }
  }

  /** Сколько коробок нужно — это число степпера, а не длина отметок. */
  let want = Math.max(1, ids.length)

  const list = createBoxList({
    free,
    pricePerKg,
    texts: { listLabel: copy.listLabel, count: copy.count, hint: copy.hint },
    onPick: (next) => {
      ids = next
      // Сняли одну из двух — состояние неполное: меняется только счётчик
      // в списке, цена и степпер ждут, пока человек отметит вторую.
      if (ids.length !== want) {
        syncList()
        return
      }
      paint()
      onChange?.(state())
      // Одна коробка: выбор сделан — панель закрывается сама.
      if (want === 1) close({ focus: true })
    },
  })
  panel.appendChild(list.node)

  const isOpen = () => !panel.hidden

  const syncList = () => list.update({ n: want, ids })

  function paint() {
    const weights = state().weights
    value.textContent = fill(copy.trigger, { weights })
    trigger.setAttribute('aria-label', fill(copy.triggerLabel, { weights }))
    syncList()
  }

  /**
   * Отметок меньше, чем нужно: недостающие подбираются по номиналу
   * и дописываются в порядке близости к нему — уменьшат количество,
   * останутся самые близкие.
   */
  function fillUp() {
    if (ids.length >= want) return false
    const add = pickPacks(free, want - ids.length, nominalG, ids).sort(nearerTo(nominalG))
    ids = ids.concat(add.map((pack) => pack.id))
    return true
  }

  /* Панель закрывается кликом мимо и Esc; пока она открыта, слушатели
     висят на документе, а не постоянно. */
  const onDocClick = (event) => {
    if (!node.contains(event.target)) close()
  }
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close({ focus: true })
    }
  }

  function open() {
    if (isOpen()) return
    panel.hidden = false
    trigger.setAttribute('aria-expanded', 'true')
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeydown)
    panel.querySelector('input[name="pack"]:checked, input[name="pack"]')?.focus()
  }

  function close({ focus = false } = {}) {
    if (!isOpen()) return
    panel.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onKeydown)
    // Закрыли с неполным выбором — недостающие коробки подбираются сами:
    // в корзину уйдёт ровно столько, сколько стоит в степпере.
    if (fillUp()) {
      paint()
      onChange?.(state())
    }
    if (focus) trigger.focus({ preventScroll: true })
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    if (isOpen()) close({ focus: true })
    else open()
  })

  paint()

  return {
    node,
    state,
    /** Степпер: «+» отмечает ближайшую к номиналу свободную, «−» снимает последнюю. */
    setCount(n) {
      const next = Math.max(1, Math.min(free.length, n))
      if (next === want && next === ids.length) return
      want = next
      if (next < ids.length) ids = ids.slice(0, next)
      else fillUp()
      paint()
      onChange?.(state())
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
