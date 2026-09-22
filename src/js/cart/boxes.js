/* ============================================================================
   Граница «свободные коробки на складе» (22.09.2026, см. src/data/boxes.js).

   Корзина, оформление и карточка товара берут коробки ТОЛЬКО отсюда.
   Три входа:
     getFreePacks(slug)   асинхронно, список свободных коробок с весами —
                          ряд весов на карточке, окно выбора в корзине,
                          проверка перед отправкой. На Битриксе — запрос
                          к серверу (PERENOS-korobki.md);
     peekFreePacks(slug)  синхронно, тот же список — подбор коробок в сторе
                          (add, setQty, чтение записи): у строки корзины
                          всегда столько выбранных коробок, сколько в ней
                          коробок, и ждать сервер при каждом «+» нельзя.
                          В прототипе — из каталога; на Битриксе — из
                          данных, которые сервер кладёт в разметку строки;
     peekFreeCount(slug)  синхронно, сколько свободных — пределы количества.

   СКЛАД ПРОТОТИПА НЕ МЕНЯЕТСЯ: после заказа коробки остаются свободными.
   Единственное исключение — демонстрация /checkout?demo=box-taken
   (src/js/checkout/demo.js): markSold помечает коробку проданной до
   перезагрузки страницы, чтобы показать проверку перед отправкой.
   ============================================================================ */

import { isBox } from '../../data/boxes.js'
import { findProductBySlug } from '../../data/catalog-products.js'

/** Коробки, «купленные» демонстрацией. Живут до перезагрузки страницы. */
const sold = new Set()

const packsOf = (slug) => {
  const product = slug ? findProductBySlug(slug) : null
  return isBox(product) ? product.packs : []
}

const freeOf = (slug) => packsOf(slug).filter((pack) => !sold.has(pack.id))

/** @returns {Promise<{ id: string, weightG: number }[]>} по возрастанию веса */
export async function getFreePacks(slug) {
  return freeOf(slug)
    .map((pack) => ({ ...pack }))
    .sort((a, b) => a.weightG - b.weightG)
}

/** Тот же список синхронно — подбор в сторе. По возрастанию веса. */
export const peekFreePacks = (slug) =>
  freeOf(slug)
    .map((pack) => ({ ...pack }))
    .sort((a, b) => a.weightG - b.weightG)

export const peekFreeCount = (slug) => freeOf(slug).length

/**
 * Коробка по id — вес для точной цены строки. Ищется и среди проданных:
 * строка корзины могла выбрать её раньше, и сумму ей считать всё равно надо.
 */
export const findPack = (slug, id) => packsOf(slug).find((pack) => pack.id === id) || null

/** Только демонстрация: коробки считаются проданными до перезагрузки. */
export function markSold(ids) {
  ids.forEach((id) => sold.add(id))
}
