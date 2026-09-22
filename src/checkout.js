/* ============================================================================
   Точка входа оформления заказа /checkout.

   Своя, а не общий src/page.js: форма со своей проверкой и отправкой.
   Виджета эксперта нет, как и на корзине, — вопросы по заказу закрывает
   менеджер при подтверждении, а второй способ «написать» рядом с кнопкой
   «Подтвердить заказ» только отвлекал бы от неё.
   ============================================================================ */

import 'lenis/dist/lenis.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components/topbar.css'
import './styles/components/header.css'
import './styles/components/megamenu.css'
import './styles/components/search.css'
import './styles/components/media.css'
import './styles/components/footer.css'
import './styles/components/buttons.css'
import './styles/components/crumbs.css'
import './styles/components/summary.css'
import './styles/components/form.css'
// Окно выбора коробок (22.09.2026).
import './styles/components/dialog.css'
import './styles/pages/checkout.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { initCheckoutPage } from './js/checkout/checkout-page.js'
import { applyCheckoutDemo } from './js/checkout/demo.js'

initSmoothScroll()

// Демонстрация (?demo=box-taken) — только прототип, до сборки страницы.
const demo = applyCheckoutDemo()

initHeader()
initFooter()
initCheckoutPage(document.querySelector('#main'), { demo })
