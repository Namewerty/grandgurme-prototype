/* ============================================================================
   Реестр выпадающих панелей альтернативной шапки. ЧЕРНОВИК НА ВЫБРОС.

   ЭТОТ ФАЙЛ — ИСТОЧНИК ПРАВДЫ ПРО ШЕВРОНЫ, ровно как src/js/nav/panels.js
   в основной версии. Требование заказчика в альтернативе не отменяется:
   шеврон стоит только там, где панель действительно собрана, и шапка
   спрашивает про это реестр, а не поле panel в данных.

   Панелей здесь пять на два режима ширины:

     catalog       каталожная, своя копия (src/alt/catalog-panel.js);
     buyersMini    «Покупателям» — узкая, ≥ 1360px;
     companyMini   «Компания»    — узкая с кадром, ≥ 1360px;
     partnersMini  «Партнёрам»   — узкая, ≥ 1360px;
     company       исходная трёхколоночная — 1024–1359px, когда три пункта
                   схлопываются обратно в один. Переиспользуется импортом
                   из основного кода: содержимое то же, менять его незачем.

   Схлопывание сделано на данных, а не через display: none у лишних пунктов
   (см. src/alt/header.js): спрятанный, но существующий в DOM пункт остаётся
   в дереве доступности и в табуляции — скринридер объявил бы четыре пункта
   вместо одного.
   ============================================================================ */

import { buildCompanyPanel, initCompanyPanel } from '../js/nav/company-panel.js'
import { buildCatalogPanel, initCatalogPanel } from './catalog-panel.js'
import { buildInfoPanel, initInfoPanel } from './info-panel.js'
import { infoItems } from './nav.js'

const miniPanels = Object.fromEntries(
  infoItems.map((item) => [
    item.panel,
    { build: () => buildInfoPanel(item), init: initInfoPanel, mini: true },
  ]),
)

export const panelRegistry = {
  catalog: { build: buildCatalogPanel, init: initCatalogPanel },
  company: { build: buildCompanyPanel, init: initCompanyPanel },
  ...miniPanels,
}

/** Есть ли у пункта настоящая панель. Отсюда же берётся наличие шеврона. */
export const hasPanel = (key) => Boolean(key && panelRegistry[key])

/** Узкая ли панель: у таких позиция считается в рантайме (info-panel.js). */
export const isMiniPanel = (key) => Boolean(panelRegistry[key]?.mini)
