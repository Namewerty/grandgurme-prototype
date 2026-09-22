/**
 * Товар в коробках с разным весом (22.09.2026). Чистые функции: ни DOM,
 * ни хранилища. Граница «свободные коробки на складе» — src/js/cart/boxes.js.
 *
 * О ЧЁМ ЭТО. Большая часть рыбы продаётся не на развес и не в фасовке
 * с ровным весом, а коробками: коробка «около 200 г» на деле весит от 174
 * до 238 г, каждая уже нарезана, взвешена и запечатана, и человек платит за
 * вес именно своей коробки. 1С знает, какие коробки лежат на складе.
 *
 * РЕШЕНИЕ ДЕНИСА (23.09.2026, взамен решения 22.09 «выбор на оформлении»).
 * Коробка выбирается В КАРТОЧКЕ: по умолчанию стоит коробка, ближайшая
 * к номиналу, цена под названием — её точная цена; кому важно, тот
 * перевыбирает в ряду весов. Корзина показывает выбранные веса и точную
 * сумму, «Выбрать другие» открывает окно. На оформлении выбора нет: там
 * уже поздно, человек теряется в форме. Кому вес неважен, тот разницы
 * с обычным товаром не замечает: цена, «В корзину», готово.
 *
 * «≈» ЖИВЁТ ТОЛЬКО В КАРТОЧКЕ И ТАМ, ГДЕ СУММА ДЕЙСТВИТЕЛЬНО НЕИЗВЕСТНА.
 * В сетке каталога, поиске и избранном у коробки в наличии подпись
 * «Коробка 202 г» и цена коробки по умолчанию «2 605,80 ₽» — те же, что
 * человек увидит в карточке; у коробки под заказ — «Коробка 200 г» по
 * номиналу и цена по номиналу, без «≈» (так решил Денис). В карточке
 * коробки под заказ «≈ 1 980 ₽ за коробку» и «около 200 г»; в корзине
 * и заказе у неё «Коробка ≈ 200 г · взвесим при фасовке» и «≈ …» —
 * там сумма и правда приблизительная. Копейки в точной цене остаются
 * (12 900 ₽ × 0,174 кг = 2 244,60 ₽), округлять точные суммы не нужно.
 *
 * ПОЛЯ ПОЗИЦИИ «в коробках»:
 *   sale: 'box'        продаётся коробками разного веса;
 *   pricePerKg         цена за килограмм, ₽;
 *   nominalG           номинальный вес коробки; не задан — медиана весов packs;
 *   packs              свободные коробки на складе: [{ id, weightG }].
 * Остальные поля (weightG, weightLabel, price, inStock) из них ВЫВОДЯТСЯ
 * обёрткой withBoxFields при объявлении данных, руками не пишутся.
 */

import { categoryCopy } from './category-copy.js'
import { plural } from '../js/catalog/model.js'

const copy = categoryCopy.boxes

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

export const isBox = (item) => Boolean(item) && item.sale === 'box'

/** Точная цена коробки в рублях с копейками: 12 900 × 174 → 2 244,60. */
export const packPrice = (pricePerKg, weightG) => Math.round((pricePerKg * weightG) / 10) / 100

/** Приблизительная цена коробки — до десятков рублей: 12 900 × 0,2 = 2 580. */
export const approxPrice = (pricePerKg, nominalG) => Math.round((pricePerKg * nominalG) / 1000 / 10) * 10

/** Цена за 100 г — для строки «1 290 ₽ за 100 г». */
export const pricePer100 = (pricePerKg) => pricePerKg / 10

/** Медиана весов — номинал, если он не задан. Пустой список → 0. */
export function median(values) {
  const list = values.filter((v) => typeof v === 'number').sort((a, b) => a - b)
  if (!list.length) return 0
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2)
}

/**
 * n коробок, самых близких к номиналу по модулю разницы; при равенстве —
 * более лёгкая. Результат по возрастанию веса. exclude — id коробок,
 * которые брать нельзя (уже выбраны в этом заказе).
 */
export function pickPacks(packs, n, nominalG, exclude = []) {
  const skip = new Set(exclude)
  return packs
    .filter((pack) => !skip.has(pack.id))
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.weightG - nominalG) - Math.abs(b.weightG - nominalG) || a.weightG - b.weightG,
    )
    .slice(0, Math.max(0, n))
    .sort((a, b) => a.weightG - b.weightG)
}

/** «204 г», «204 и 206 г», «174, 176 и 178 г». */
export function weightsText(weights) {
  const list = weights.slice().sort((a, b) => a - b)
  if (!list.length) return ''
  if (list.length === 1) return `${list[0]} г`
  return `${list.slice(0, -1).join(', ')} ${copy.and} ${list[list.length - 1]} г`
}

/** «коробка / коробки / коробок» и винительный «коробку / коробки / коробок». */
export const packsWord = (n) => plural(n, ...copy.words)
export const packsWordAcc = (n) => plural(n, ...copy.wordsAcc)

/** Коробка по умолчанию — ближайшая к номиналу; null, если свободных нет. */
export const defaultPack = (packs, nominalG) => pickPacks(packs, 1, nominalG)[0] || null

/** «Коробка 202 г» — подпись позиции в сетке, поиске и избранном: без «≈». */
export const boxLabel = (weightG) => fill(copy.label, { g: weightG })

/** «Коробка ≈ 200 г» — коробка под заказ в корзине и заказе: вес узнают при фасовке. */
export const boxLabelApprox = (nominalG) => fill(copy.labelApprox, { g: nominalG })

/**
 * Обёртка при объявлении данных: выводит weightG, weightLabel, price
 * и inStock из pricePerKg, nominalG и packs. Исходные поля остаются.
 * Есть свободные коробки — подпись и цена коробки по умолчанию (точная,
 * та же, что откроется в карточке); нет — по номиналу, приблизительная.
 * Ещё два выведенных поля для первой отрисовки карточки: defaultPack
 * (коробка по умолчанию или null) и weightRange ({ min, max } или null) —
 * живой список коробок карточка потом берёт через границу cart/boxes.js.
 */
export function withBoxFields(product) {
  const packs = (product.packs || []).map((pack) => ({ ...pack }))
  const nominalG = product.nominalG ?? median(packs.map((pack) => pack.weightG))
  const first = defaultPack(packs, nominalG)
  const weights = packs.map((pack) => pack.weightG)
  return {
    ...product,
    sale: 'box',
    nominalG,
    packs,
    weightG: nominalG,
    weightLabel: boxLabel(first ? first.weightG : nominalG),
    price: first ? packPrice(product.pricePerKg, first.weightG) : approxPrice(product.pricePerKg, nominalG),
    inStock: packs.length > 0,
    defaultPack: first ? { ...first } : null,
    weightRange: weights.length ? { min: Math.min(...weights), max: Math.max(...weights) } : null,
  }
}
