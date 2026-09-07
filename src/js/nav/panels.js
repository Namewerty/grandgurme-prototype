/* ============================================================================
   Реестр выпадающих панелей шапки.

   Пунктов, которые могли бы раскрывать панель, четыре: КАТАЛОГ, ИКРА,
   ПОДАРКИ, КОМПАНИЯ. Собраны две — каталог и компания; у «Икры» и «Подарков»
   сборщика пока нет, и они работают обычными ссылками.

   ЭТОТ ФАЙЛ — ИСТОЧНИК ПРАВДЫ ПРО ШЕВРОНЫ. Заказчик просил различать пункты,
   которые ведут на страницу, и пункты, которые раскрывают панель: у вторых
   рядом со словом стоит шеврон. Шапка спрашивает про наличие сборщика
   ИМЕННО ЗДЕСЬ (см. hasPanel в src/js/sections/header.js), а не смотрит
   на поле panel в src/data/nav.js. Разница принципиальная: поле в данных —
   это заявка на будущую панель, а шеврон — обещание, что панель откроется
   прямо сейчас. Шеврон над обычной ссылкой обманывает ровно тем способом,
   от которого просили избавиться.

   Чтобы добавить панель: положить сюда build/init и указать тот же ключ
   в поле panel у пункта в src/data/nav.js. Шеврон появится сам.
   ============================================================================ */

import { buildCatalogPanel, initCatalogPanel } from './catalog-panel.js'
import { buildCompanyPanel, initCompanyPanel } from './company-panel.js'

export const panelRegistry = {
  catalog: { build: buildCatalogPanel, init: initCatalogPanel },
  company: { build: buildCompanyPanel, init: initCompanyPanel },
  // caviar: { build: buildCaviarPanel, init: initCaviarPanel },
  // gifts:  { build: buildGiftsPanel,  init: initGiftsPanel },
}

/** Есть ли у пункта настоящая панель. Отсюда же берётся наличие шеврона. */
export const hasPanel = (key) => Boolean(key && panelRegistry[key])
