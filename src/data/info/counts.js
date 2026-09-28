/**
 * Счётчики позиций для информационных страниц — тот же расчёт, что у первого
 * экрана /alt2 (src/alt2/data/stage.js): число из categoryItems (выгрузка 1С),
 * если раздел там есть, иначе — позиции раздела в прототипе без тестовых.
 * Обновляются вместе с выгрузкой сами.
 */

import { ROUTES } from '../routes.js'
import { categoryItems } from '../categories.js'
import { getProducts } from '../catalog-products.js'
import { plural } from '../../js/catalog/model.js'

export const countOf = (slug) => {
  const item = categoryItems.find(({ href }) => href === ROUTES.category(slug))
  if (item) return item.count
  return getProducts(slug).filter((product) => !product.slug.startsWith('test-')).length
}

/** «12 позиций»; ноль — пустая строка, счётчик не выводится. */
export const positions = (n) => (n > 0 ? `${n} ${plural(n, 'позиция', 'позиции', 'позиций')}` : '')
