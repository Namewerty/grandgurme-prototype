/**
 * Товар в коробках с разным весом (22.09.2026). Чистые функции: ни DOM,
 * ни хранилища. Граница «свободные коробки на складе» — src/js/cart/boxes.js.
 *
 * О ЧЁМ ЭТО. Большая часть рыбы продаётся не на развес и не в фасовке
 * с ровным весом, а коробками: коробка «около 200 г» на деле весит от 174
 * до 238 г, каждая уже нарезана, взвешена и запечатана, и человек платит за
 * вес именно своей коробки. 1С знает, какие коробки лежат на складе.
 *
 * РЕШЕНИЕ ДЕНИСА. До оформления человек видит только приблизительные вес
 * и цену: «Коробка ≈ 200 г», «≈ 2 580 ₽», выбирать в карточке нечего.
 * На оформлении система сама подбирает коробки, самые близкие к номиналу,
 * и показывает точный вес и сумму; кто хочет, меняет их по ссылке «Выбрать
 * другие». Заказ из коробок в наличии имеет точную сумму и оплачивается
 * сразу. Приблизительной остаётся только коробка под заказ, которой на складе
 * ещё нет: её вес узнают при фасовке. Копейки в точной цене остаются как есть
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

/** «Коробка ≈ 200 г» — подпись позиции в сетке, карточке и корзине. */
export const boxLabel = (nominalG) => fill(copy.label, { g: nominalG })

/**
 * Обёртка при объявлении данных: выводит weightG, weightLabel, price
 * и inStock из pricePerKg, nominalG и packs. Исходные поля остаются.
 */
export function withBoxFields(product) {
  const packs = (product.packs || []).map((pack) => ({ ...pack }))
  const nominalG = product.nominalG ?? median(packs.map((pack) => pack.weightG))
  return {
    ...product,
    sale: 'box',
    nominalG,
    packs,
    weightG: nominalG,
    weightLabel: boxLabel(nominalG),
    price: approxPrice(product.pricePerKg, nominalG),
    inStock: packs.length > 0,
  }
}
