/* ============================================================================
   №1 Гранд Гурмэ — прототип главной. Точка входа.

   Порядок важен: сначала собираем DOM (шапка, секции, подвал, кольцо),
   затем поднимаем скролл-движок — ему нужны готовые размеры.
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
import './styles/components/progress-ring.css'
import './styles/components/footer.css'
import './styles/components/buttons.css'
import './styles/components/toast.css'
import './styles/components/expert.css'
import './styles/components/rail.css'
import './styles/components/product-card.css'
import './styles/components/post-card.css'
import './styles/sections/hero.css'
import './styles/sections/trust.css'
import './styles/sections/brand.css'
import './styles/sections/categories.css'
import './styles/sections/types.css'
import './styles/sections/shop.css'
import './styles/sections/season.css'
import './styles/sections/proof.css'
import './styles/sections/offline.css'
import './styles/sections/why.css'
import './styles/sections/journal.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { renderSections, initSections } from './js/sections/index.js'
import { renderProgressRing } from './js/progress-ring.js'
import { initScroll } from './js/scroll.js'
import { initExpert } from './js/expert.js'
import { hydrateMedia } from './js/media.js'

function boot() {
  renderSections(document.querySelector('#main'))
  initHeader()
  initFooter()
  renderProgressRing(document.querySelector('#progress-ring'))

  hydrateMedia(document)

  initScroll()

  // После скролл-движка: hero снимает общий триггер ухода и ставит свой,
  // остальные секции вешают собственные анимации поверх общих reveal.
  initSections()

  // Виджету нужны готовые триггеры hero и подвала — поднимаем последним.
  initExpert(document.querySelector('#expert-widget'))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
