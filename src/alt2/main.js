/* ============================================================================
   Альтернативная главная 2 (/alt2). Точка входа. ЧЕРНОВИК НА ВЫБРОС.

   Копия src/main.js с тем же порядком вызовов. Отличия:
     — класс is-alt2 на <body> первой строкой: на него завязан alt2.css;
     — стилей старого первого экрана, #types и #why нет, вместо них стили
       трёх новых блоков и ./alt2.css ПОСЛЕДНЕЙ строкой;
     — реестр секций и initSections — свои (./sections.js);
     — переключатель версий последней строкой.

   Шапка основная (src/js/sections/header.js): /alt2 меняет первые блоки
   страницы, а не навигацию.

   Порядок вызовов тот же, что в main.js, и по тем же причинам: DOM
   до скролл-движка, initSections после initScroll, виджет эксперта
   последним — ему нужны готовые триггеры #hero и подвала.
   ============================================================================ */

import 'lenis/dist/lenis.css'

import '../styles/tokens.css'
import '../styles/base.css'
import '../styles/layout.css'
import '../styles/components/topbar.css'
import '../styles/components/header.css'
import '../styles/components/megamenu.css'
import '../styles/components/search.css'
import '../styles/components/media.css'
import '../styles/components/progress-ring.css'
import '../styles/components/footer.css'
import '../styles/components/buttons.css'
import '../styles/components/toast.css'
import '../styles/components/expert.css'
import '../styles/components/rail.css'
import '../styles/components/product-card.css'
import '../styles/components/stock-tag.css'
import '../styles/components/post-card.css'
import '../styles/sections/trust.css'
import '../styles/sections/brand.css'
import '../styles/sections/categories.css'
import '../styles/sections/shop.css'
import '../styles/sections/proof.css'
import '../styles/sections/offline.css'
import '../styles/sections/journal.css'
import './styles/stage.css'
import './styles/character.css'
import './styles/origin.css'

import './alt2.css'

import { initHeader } from '../js/sections/header.js'
import { initFooter } from '../js/sections/footer.js'
import { renderSections, initSections } from './sections.js'
import { renderProgressRing } from '../js/progress-ring.js'
import { initScroll } from '../js/scroll.js'
import { initExpert } from '../js/expert.js'
import { hydrateMedia } from '../js/media.js'
import { initAltSwitch } from '../alt/switch.js'

function boot() {
  // Первой строкой: на этот класс завязаны все правила alt2.css.
  document.body.classList.add('is-alt2')

  renderSections(document.querySelector('#main'))
  initHeader()
  initFooter()
  renderProgressRing(document.querySelector('#progress-ring'))

  hydrateMedia(document)

  initScroll()

  // После скролл-движка: новые блоки вешают свои триггеры поверх общих reveal.
  initSections()

  // Виджету нужны готовые триггеры #hero и подвала — поднимаем последним.
  initExpert(document.querySelector('#expert-widget'))

  // Переключатель версий — служебный, поднимаем в самом конце.
  initAltSwitch()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
