/* ============================================================================
   Точка входа карточки товара /product/<слаг>.

   Отдельная от src/page.js по той же причине, что и категория: page.js —
   общий каркас четырёх десятков заглушек, одна колонка текста. Карточка —
   работающая страница с галереей, переключателями фасовок и лентами; тащить
   её код на «Политику конфиденциальности» незачем.

   Шапка, подвал и характер прокрутки — общие с остальным сайтом. Reveal-
   анимаций и кольца прогресса здесь нет, как и на странице категории:
   кольцо показывает главы главной, а на карточке глав нет.

   Виджет эксперта, наоборот, есть: на него ведёт кнопка «Спросить эксперта»
   в правой колонке, и заводить ради неё вторую форму на странице было бы
   удвоением точки приёма заявок.
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
import './styles/components/expert.css'
import './styles/components/rail.css'
import './styles/components/crumbs.css'
import './styles/components/product-card.css'
import './styles/components/post-card.css'
import './styles/pages/page.css'
import './styles/pages/product.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { initExpert } from './js/expert.js'
import { hydrateMedia } from './js/media.js'
import { initProductPage } from './js/product/product-page.js'

initSmoothScroll()

initHeader()
initFooter()
initProductPage(document.querySelector('#main'))

// Кадр журнала внизу карточки объявлен декларативно — поднимаем его после
// сборки страницы, как это делает главная.
hydrateMedia(document.querySelector('#main'))

// Каркас страницы генерируется общим шаблоном (scripts/build-pages.mjs),
// и места под виджет в нём нет — заводим его здесь, а не в шаблоне: на
// заглушках виджет не нужен.
const widget = document.createElement('div')
widget.id = 'expert-widget'
document.body.appendChild(widget)
initExpert(widget)
