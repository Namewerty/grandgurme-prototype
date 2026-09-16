/* ============================================================================
   Точка входа корзины /cart.

   Отдельная от src/page.js по той же причине, что категория и карточка
   товара: page.js — каркас текстовых заглушек, а корзина — работающая
   страница со своим состоянием.

   Виджета эксперта здесь нет: правый нижний угол на мобильном занимает
   липкая полоса с итогом и кнопкой, и круглая кнопка виджета легла бы
   прямо на неё. Вопросы по заказу закрывает менеджер при подтверждении.
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
import './styles/components/qty.css'
import './styles/components/summary.css'
import './styles/pages/cart.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { initCartPage } from './js/cart/cart-page.js'
import { applyCartDemo } from './js/cart/demo.js'

initSmoothScroll()

// Демонстрационное наполнение (?demo=mixed|order|request) — до шапки:
// бейдж корзины сразу показывает подменённый состав.
applyCartDemo()

initHeader()
initFooter()
initCartPage(document.querySelector('#main'))
