/* ============================================================================
   Точка входа /order-success?n=<номер>.

   page.css подключён ради одного случая: номера в адресе нет, и страница
   показывает содержимое /404 той же разметкой, что общие заглушки.
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
import './styles/components/summary.css'
import './styles/pages/page.css'
import './styles/pages/checkout.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { initOrderSuccess } from './js/checkout/success-page.js'

initSmoothScroll()

initHeader()
initFooter()
initOrderSuccess(document.querySelector('#main'))
