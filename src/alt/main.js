/* ============================================================================
   Альтернативная главная (/alt). Точка входа. ЧЕРНОВИК НА ВЫБРОС.

   Копия src/main.js. Отличий четыре: свои реестр секций и шапка, класс
   is-alt на <body> и переключатель версий последней строкой. Всё остальное
   и, главное, ПОРЯДОК ВЫЗОВОВ — как в оригинале.

   Порядок в main.js не случайный: DOM собирается до подъёма скролл-движка,
   initSections идёт после initScroll (hero снимает общий триггер ухода
   и ставит свой), виджет — последним, ему нужны готовые триггеры hero
   и подвала. Переставишь — поедут анимации.

   Стили: те же импорты, что в основной версии, плюс ./alt.css ПОСЛЕДНЕЙ
   строкой. Порядок важен — альтернативные правила должны перебивать
   основные, а не наоборот.
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
import '../styles/components/post-card.css'
import '../styles/sections/hero.css'
import '../styles/sections/trust.css'
import '../styles/sections/brand.css'
import '../styles/sections/categories.css'
import '../styles/sections/types.css'
import '../styles/sections/shop.css'
import '../styles/sections/season.css'
import '../styles/sections/proof.css'
import '../styles/sections/offline.css'
import '../styles/sections/why.css'
import '../styles/sections/journal.css'

import './alt.css'

import { initHeader } from './header.js'
import { initFooter } from '../js/sections/footer.js'
import { renderSections, initSections } from './sections.js'
import { renderProgressRing } from '../js/progress-ring.js'
import { initScroll } from '../js/scroll.js'
import { initExpert } from '../js/expert.js'
import { hydrateMedia } from '../js/media.js'
import { initAltSwitch } from './switch.js'

function boot() {
  // Первой строкой: на этот класс завязаны все правила alt.css.
  document.body.classList.add('is-alt')

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

  // Переключатель версий — служебный, поднимаем в самом конце.
  initAltSwitch()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
