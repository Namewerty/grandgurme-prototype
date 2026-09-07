/**
 * Сезон и новинки (#season). Идёт сразу за витриной #shop и продолжает её
 * главу: «С чего обычно начинают» — постоянное, «Сейчас в сезоне» —
 * временное. Отсюда флаг tight в реестре секций и отсутствие своей остановки
 * в кольце: это один разворот, а не новая глава.
 *
 * ⚠ СОСТАВ БЛОКА ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ ЗАКАЗЧИКА.
 *
 * Признака сезонности и новизны в данных НЕТ ВООБЩЕ: в выгрузке 1С от
 * 20.08.2026 по чёрной икре нет ни дат поступления, ни пометок «новинка»,
 * ни движения остатков — сортировки «Сначала новинки» у раздела по той же
 * причине не существует. Список ниже собран вручную из НАСТОЯЩИХ позиций,
 * а метки «Сезон» и «Новинка» — редакционные, а не поля учёта.
 *
 * Что должен подтвердить заказчик:
 *   1. состав — эти ли шесть позиций он хочет показывать ближайшие недели;
 *   2. метки — какая позиция сезонная, какая новая;
 *   3. как список будет обновляться дальше: руками в этом файле или полем
 *      в 1С (тогда метка станет настоящим признаком и уедет в выгрузку).
 *
 * ЧЕГО В БЛОКЕ НЕТ И НЕ БУДЕТ. Ни «−30%», ни «успейте», ни «только до»,
 * ни счётчиков обратного отсчёта: это не тот бренд. Блок сообщает, что
 * компания отобрала на ближайшее время, и всё.
 *
 * ПОЗИЦИИ НЕ ПЕРЕПИСЫВАЮТСЯ РУКАМИ. Название, фасовка и цена берутся из
 * данных по слагу — придумать здесь новое название физически нельзя.
 * Четыре позиции икры настоящие, из 1С, и ведут на свои карточки; две
 * позиции витрины (краб и подарочная шкатулка) товарной выгрузки под собой
 * не имеют — они, как и в самой витрине, помечены предварительными
 * в src/data/products.js и ведут на демонстрационный адрес.
 */

import { caviarProducts } from './catalog-products.js'
import { self, gift } from './products.js'
import { caviar, products as productShots, gifts as giftShots } from './media.js'
import { ROUTES } from './routes.js'

export const seasonCopy = {
  eyebrow: 'СЕЗОН И НОВИНКИ',
  title: 'Сейчас в сезоне',
  note: 'Позиции, которые мы отбираем на ближайшие недели.',
  /* Отдельной страницы новинок в каталоге нет — такого раздела нет и в 1С,
     поэтому ссылка ведёт в общий каталог, а не в несуществующий раздел. */
  more: { label: 'Все новинки →', href: ROUTES.catalog },
  marks: { season: 'Сезон', new: 'Новинка' },
  priceOnRequest: 'Цена по запросу',
}

/** Цена приходит числом или не приходит вовсе — выдумывать её нельзя. */
const price = (value) =>
  value == null
    ? seasonCopy.priceOnRequest
    : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`

/** Позиция каталога по слагу. Промах — ошибка сборки, а не молчаливая дыра. */
function fromCatalog(slug, mark, media) {
  const product = caviarProducts.find((item) => item.slug === slug)
  if (!product) throw new Error(`[season] нет позиции со слагом ${slug}`)

  return {
    mark,
    name: product.name,
    note: product.weightLabel,
    price: price(product.price),
    href: ROUTES.product(product.slug),
    media,
  }
}

/** Позиция витрины: своего слага у неё нет, адрес демонстрационный. */
const fromShowcase = (item, mark, media) => ({
  mark,
  name: item.name,
  note: item.note,
  price: item.price,
  href: item.href,
  media,
})

/**
 * Шесть строк, шесть разных кадров. Одинаковый кадр в двух строках читался бы
 * как сбой сборки, поэтому по одной позиции на вид икры: внутри вида банка
 * на всех линейках одна и та же.
 */
export const seasonItems = [
  fromCatalog('beluga-royal-metall-125', 'season', caviar[0]),
  fromCatalog('osetr-persidskiy-steklo-113', 'new', caviar[1]),
  fromCatalog('sevruga-payusnaya-paket-250', 'new', caviar[2]),
  fromCatalog('beluga-sterlyad-selected-metall-250', 'season', caviar[3]),
  fromShowcase(self[2], 'season', productShots[2]),
  fromShowcase(gift[0], 'new', giftShots[0]),
]
