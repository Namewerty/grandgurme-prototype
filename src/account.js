/* ============================================================================
   Точка входа входа, личного кабинета и избранного — девять адресов:

     /account/login       вход и регистрация по номеру телефона;
     /account             обзор;
     /account/orders      заказы и заявки;
     /account/order?n=    заказ;
     /account/request?r=  заявка;
     /account/addresses   адреса доставки;
     /account/profile     личные данные;
     /account/waitlist    лист ожидания — «Сообщить о поступлении»;
     /favorites           избранное — у гостя из браузера, у вошедшего из кабинета.

   Страница выбирается по location.pathname. Гость на любом адресе кабинета,
   кроме входа и избранного, уходит на вход с возвратом (requireUser
   в src/js/account/layout.js).

   Виджета эксперта здесь нет по той же причине, что на корзине и оформлении:
   вопросы по заказу закрывает менеджер, связь с ним стоит на страницах.

   Демонстрация (?demo=account|new|guest) — до шапки: счётчики и состояние
   входа сразу показывают подменённое. В сборку Битрикса этот файл и
   account/demo.js не входят.
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
import './styles/components/stock-tag.css'
import './styles/components/status-tag.css'
import './styles/components/summary.css'
import './styles/components/form.css'
import './styles/components/code-input.css'
import './styles/components/dialog.css'
import './styles/components/login.css'
import './styles/pages/checkout.css'
import './styles/pages/account.css'

import { ROUTES } from './data/routes.js'
import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { initSmoothScroll } from './js/scroll.js'
import { applyAccountDemo } from './js/account/demo.js'
import { initLoginPage } from './js/account/pages/login.js'
import { initOverviewPage } from './js/account/pages/overview.js'
import { initOrdersPage } from './js/account/pages/orders.js'
import { initOrderPage } from './js/account/pages/order.js'
import { initRequestPage } from './js/account/pages/request.js'
import { initAddressesPage } from './js/account/pages/addresses.js'
import { initProfilePage } from './js/account/pages/profile.js'
import { initWaitlistPage } from './js/account/pages/waitlist.js'
import { initFavoritesPage } from './js/account/pages/favorites.js'

const PAGES = {
  [ROUTES.account]: initOverviewPage,
  [ROUTES.accountOrders]: initOrdersPage,
  '/account/order': initOrderPage,
  '/account/request': initRequestPage,
  [ROUTES.accountAddresses]: initAddressesPage,
  [ROUTES.accountProfile]: initProfilePage,
  [ROUTES.accountWaitlist]: initWaitlistPage,
  [ROUTES.favorites]: initFavoritesPage,
}

async function boot() {
  initSmoothScroll()

  const demo = await applyAccountDemo()

  initHeader()
  initFooter()

  const mount = document.querySelector('#main')
  const path = location.pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')

  if (path === ROUTES.accountLogin) initLoginPage(mount, { step: demo.loginStep })
  else (PAGES[path] || initOverviewPage)(mount)
}

boot()
