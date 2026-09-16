/* ============================================================================
   Точка входа для шаблона Битрикса.

   ЧЕМ ОТЛИЧАЕТСЯ ОТ src/main.js. Шапка, обе выпадающие панели, мобильное меню
   и подвал на Битриксе приходят с сервера — их рисует PHP (шаблон grandgurme).
   Скрипт их НЕ пересобирает: он находит готовую разметку и поднимает поведение.
   Это и есть смысл варианта C — карта сайта лежит в исходном html.

   Секции главной страницы пока по-прежнему собирает скрипт из src/data/*.js.
   Это осознанный технический долг первого захода: тексты главной ещё не
   разложены по инфоблокам, и переносить их в PHP «как есть» значило бы
   закрепить временные формулировки в разметке.

   Страница объявляет, что ей нужны секции главной:
       <main id="main" data-gg-sections> … </main>
   Всё остальное (внутренние страницы, каталог на родных компонентах)
   этот же скрипт просто оживляет.
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
import '../styles/components/crumbs.css'
import '../styles/components/qty.css'
import '../styles/components/summary.css'
import '../styles/sections/hero.css'
import '../styles/sections/trust.css'
import '../styles/sections/brand.css'
import '../styles/sections/categories.css'
import '../styles/sections/types.css'
import '../styles/sections/shop.css'
import '../styles/sections/proof.css'
import '../styles/sections/offline.css'
import '../styles/sections/why.css'
import '../styles/sections/journal.css'
import '../styles/components/pager.css'
import '../styles/pages/page.css'
import '../styles/pages/category.css'
import '../styles/pages/product.css'
import '../styles/pages/cart.css'
import '../styles/pages/checkout.css'
import '../styles/pages/search.css'

import { initHeader } from '../js/sections/header.js'
import { initFooter } from '../js/sections/footer.js'
import { renderSections, initSections } from '../js/sections/index.js'
import { initScroll } from '../js/scroll.js'
import { initExpert } from '../js/expert.js'
import { hydrateMedia } from '../js/media.js'
import { maskPhone } from '../js/checkout/validate.js'
import { hydrateQtySteppers } from './qty-hydrate.js'
import { hydrateCartBar, hydrateReceiveMethod, hydrateServerToast } from './purchase-hydrate.js'

function boot() {
  const main = document.querySelector('#main')
  const wantsSections = main?.hasAttribute('data-gg-sections')

  // Сначала DOM, потом скролл-движок: ему нужны готовые размеры.
  if (wantsSections) renderSections(main)

  initHeader({ ssr: true })
  initFooter({ ssr: true })

  hydrateMedia(document)

  // Карточка товара, корзина и оформление на Битриксе — серверная разметка
  // с обычными формами. Скрипт только оживляет степпер и маску телефона;
  // без него формы работают и так.
  hydrateQtySteppers(document)
  document.querySelectorAll('input[data-phone-mask]').forEach(maskPhone)
  hydrateCartBar(document)
  hydrateReceiveMethod(document)
  hydrateServerToast(document)

  initScroll()

  // После скролл-движка: hero снимает общий триггер ухода и ставит свой.
  if (wantsSections) initSections()

  initExpert(document.querySelector('#expert-widget'))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
