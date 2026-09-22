/* ============================================================================
   Демонстрация оформления. ИНСТРУМЕНТ ПОКАЗА, А НЕ ЧАСТЬ МАГАЗИНА.

   Склад прототипа не меняется, и проверку коробок перед отправкой
   (checkout-page.js → verifyBoxes) иначе не показать:

     /checkout?demo=box-taken   при первой отправке первая выбранная коробка
                                первой коробочной строки считается проданной
                                (до перезагрузки страницы): отправка
                                останавливается с сообщением и новой суммой,
                                вторая проходит.

   Параметр убирается из адреса (history.replaceState). Подключается только
   точкой входа прототипа src/checkout.js; в сборку Битрикса не попадает.
   ============================================================================ */

import { markSold } from '../cart/boxes.js'

/**
 * Читает ?demo= и возвращает крючки для initCheckoutPage или null.
 * @returns {{ beforeVerify: (items: object[]) => void } | null}
 */
export function applyCheckoutDemo() {
  const url = new URL(location.href)
  const key = url.searchParams.get('demo')
  if (!key) return null

  url.searchParams.delete('demo')
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)

  if (key !== 'box-taken') return null

  let used = false
  return {
    beforeVerify(items) {
      if (used) return
      const line = items.find((item) => item.boxes && item.kind === 'stock' && item.boxes.packIds.length)
      if (!line) return
      used = true
      markSold([line.boxes.packIds[0]])
    },
  }
}
