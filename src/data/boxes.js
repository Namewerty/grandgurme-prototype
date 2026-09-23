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
 * Коробка выбирается В КАРТОЧКЕ, но выбор не вывален на страницу: под ценой
 * стоит один компактный селектор «Коробка 202 г», он выпадает списком весов
 * (src/js/product/box-picker.js). По умолчанию отмечена коробка, ближайшая
 * к номиналу, и цена под названием — её точная цена; кому вес неважен,
 * тот разницы с обычным товаром не замечает. Корзина показывает выбранные
 * веса и «Выбрать другие»; на оформлении выбора нет: там уже поздно,
 * человек теряется в форме.
 *
 * В КАТАЛОГЕ — СТАНДАРТ, А НЕ КОНКРЕТНАЯ КОРОБКА (правка Дениса 23.09).
 * Сетка, поиск и избранное пишут номинальный вес и цену по номиналу:
 * «Коробка 200 г», «2 580 ₽», без «≈». Конкретный вес и его цена — дело
 * карточки, где человек коробку и выбирает.
 *
 * «≈» ЖИВЁТ ТАМ, ГДЕ СУММА ДЕЙСТВИТЕЛЬНО НЕИЗВЕСТНА, — у коробки под заказ,
 * которой на складе ещё нет: в карточке «≈ 1 980 ₽ за коробку» и «около
 * 200 г», в корзине и заказе «Коробка ≈ 200 г · взвесим при фасовке».
 *
 * ЦЕНЫ БЕЗ КОПЕЕК (правка Дениса 23.09): цена коробки округляется до рубля,
 * 12 900 ₽ × 0,174 кг = 2 244,6 → 2 245 ₽. Суммы складываются из уже
 * округлённых цен коробок, поэтому копейки не появляются нигде.
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

/**
 * Цена коробки, округлённая до рубля: 12 900 × 0,174 кг = 2 244,6 → 2 245.
 * Ею же считается цена стандартной коробки в каталоге — packPrice(pricePerKg,
 * nominalG): 12 900 × 0,2 = 2 580.
 */
export const packPrice = (pricePerKg, weightG) => Math.round((pricePerKg * weightG) / 1000)

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
 * Сравнение «кто ближе к номиналу»; при равенстве — более лёгкая коробка.
 * Им же упорядочивается ДОБАВЛЕНИЕ коробок к уже выбранным (карточка,
 * store.fitPacks): когда количество потом уменьшают, лишними становятся
 * самые далёкие от номинала, а не случайные.
 */
export const nearerTo = (nominalG) => (a, b) =>
  Math.abs(a.weightG - nominalG) - Math.abs(b.weightG - nominalG) || a.weightG - b.weightG

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
    .sort(nearerTo(nominalG))
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

/** «Коробка 200 г» — подпись позиции в сетке, поиске и избранном: номинал, без «≈». */
export const boxLabel = (weightG) => fill(copy.label, { g: weightG })

/** «Коробка ≈ 200 г» — коробка под заказ в корзине и заказе: вес узнают при фасовке. */
export const boxLabelApprox = (nominalG) => fill(copy.labelApprox, { g: nominalG })

/**
 * Обёртка при объявлении данных: выводит weightG, weightLabel, price
 * и inStock из pricePerKg, nominalG и packs. Исходные поля остаются.
 * Вес и цена — СТАНДАРТНЫЕ, по номиналу: по ним живут сетка, поиск,
 * избранное, пилюли «Цена» и «Вес», сортировки и kindOf. Ещё одно
 * выведенное поле, defaultPack, нужно карточке для первой отрисовки цены,
 * пока не пришёл живой список коробок из границы cart/boxes.js.
 */
export function withBoxFields(product) {
  const packs = (product.packs || []).map((pack) => ({ ...pack }))
  const nominalG = product.nominalG ?? median(packs.map((pack) => pack.weightG))
  const first = defaultPack(packs, nominalG)
  return {
    ...product,
    sale: 'box',
    nominalG,
    packs,
    weightG: nominalG,
    weightLabel: boxLabel(nominalG),
    price: packPrice(product.pricePerKg, nominalG),
    inStock: packs.length > 0,
    defaultPack: first ? { ...first } : null,
  }
}
