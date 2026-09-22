/* ============================================================================
   Демонстрационное наполнение корзины. ИНСТРУМЕНТ ПОКАЗА, А НЕ ЧАСТЬ МАГАЗИНА.

   В данных прототипа позиций заявки с ценой нет вовсе, а собирать смешанную
   корзину руками перед каждым показом долго. Адрес /cart?demo=… заменяет
   содержимое корзины готовым набором и убирает параметр из адреса
   (history.replaceState), чтобы перезагрузка не сбрасывала то, что человек
   успел поменять:

     ?demo=mixed    две позиции в наличии, одна под заказ, чёрная икра не на
                    складе без цены и позиция витрины главной, помеченная здесь
                    отсутствующей на складе (заявка с ценой);
     ?demo=order    наличие и под заказ — заказ без заявки;
     ?demo=request  только заявка;
     ?demo=boxes    коробки с разным весом (src/data/boxes.js): лосось нежно
                    подвяленный × 2 и осётр × 1 в наличии, клыкач — коробка
                    под заказ, и обычная позиция в наличии. Итог корзины
                    «≈ 11 780 ₽», на оформлении подбор коробок и окно выбора.

   Подключается только точкой входа прототипа src/cart.js. В сборку Битрикса
   не попадает: src/bitrix/main.js этот файл не импортирует.
   ============================================================================ */

import { findProductBySlug } from '../../data/catalog-products.js'
import { productSets } from '../../data/products.js'
import { replace } from './store.js'

/** Позиция каталога по слагу — с разделом, от него зависит вид. */
const catalog = (slug, qty = 1) => ({ product: findProductBySlug(slug), qty })

/**
 * Шкатулка «Осётр» с витрины главной. Раздела у позиций витрины нет, наличие
 * в выгрузке не приходит — здесь оно выставлено «нет на складе», чтобы
 * показать заявку с известной ценой.
 */
function showcaseOutOfStock() {
  const item = productSets.gift[0]
  return {
    product: {
      id: 'showcase-gift-0',
      name: item.name,
      note: item.note,
      href: item.href,
      image: item.media.src,
      price: Number(String(item.price).replace(/\D/g, '')),
      inStock: false,
    },
    qty: 1,
  }
}

const SETS = {
  mixed: () => [
    catalog('losos-file-hk-klassicheskiy-100', 2),
    catalog('nerka-file-hk-150'),
    catalog('forel-file-hk-ukrop-100'),
    catalog('beluga-diamond-metall-125'),
    showcaseOutOfStock(),
  ],
  order: () => [
    catalog('losos-file-hk-klassicheskiy-100', 2),
    catalog('nerka-file-hk-150'),
    catalog('ugor-gk-120'),
  ],
  request: () => [catalog('beluga-royal-metall-50'), showcaseOutOfStock()],
  boxes: () => [
    catalog('losos-nezhno-podvyalenyy-korobka', 2),
    catalog('osetr-hk-korobka-250'),
    catalog('klykach-file-hk-206'),
    catalog('losos-file-hk-klassicheskiy-100'),
  ],
}

/** Читает ?demo= и, если набор известен, подменяет корзину. */
export function applyCartDemo() {
  const url = new URL(location.href)
  const key = url.searchParams.get('demo')
  if (!key) return

  const set = SETS[key]
  if (set) replace(set().filter(({ product }) => product))

  url.searchParams.delete('demo')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
