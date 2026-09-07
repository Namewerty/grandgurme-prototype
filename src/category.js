/* ============================================================================
   Точка входа страниц категорий /catalog/<slug>.

   Отдельная от src/page.js намеренно. page.js — общий каркас четырёх десятков
   заглушек: одна колонка, текст, ссылки. Категория — работающая страница
   с фильтрами, поиском и сеткой; тащить её код на «Политику
   конфиденциальности» незачем.

   Шапка, подвал и характер прокрутки — общие с остальным сайтом. Reveal-анимаций
   и кольца прогресса здесь нет: сетка перерисовывается на каждое нажатие
   фильтра, и появление карточек из-под маски читалось бы миганием выдачи.
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
import './styles/components/toast.css'
import './styles/components/crumbs.css'
import './styles/components/product-card.css'
import './styles/pages/category.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { initCategoryPage } from './js/catalog/category-page.js'

// Инерция поднимается ПЕРВОЙ: страница спрашивает getLenis(), чтобы гасить
// прокрутку под открытым боттом-шитом.
initSmoothScroll()

initHeader()
initFooter()
initCategoryPage(document.querySelector('#main'))
