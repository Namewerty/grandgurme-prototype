/* ============================================================================
   Граница «свободные коробки на складе» (22.09.2026, см. src/data/boxes.js).

   Корзина, оформление и карточка товара берут коробки ТОЛЬКО отсюда.
   Два входа:
     getFreePacks(slug)   асинхронно, список свободных коробок с весами —
                          подбор на оформлении, окно выбора, проверка перед
                          отправкой. На Битриксе — запрос к серверу
                          (PERENOS-korobki.md);
     peekFreeCount(slug)  синхронно, сколько свободных коробок — пределы,
                          которые считаются без ожидания: add и setQty
                          в store.js, максимум степпера на карточке и в
                          корзине. В прототипе — из каталога; на Битриксе —
                          из данных, которые сервер кладёт в разметку.

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
