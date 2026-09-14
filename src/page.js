/* ============================================================================
   Внутренние страницы. Одна точка входа на все адреса карты сайта.

   Зачем так. Адресов по карте больше сотни, и делать сотню сборок ради текста
   «здесь будет каталог» бессмысленно. Каждая html-заглушка — это пустой
   каркас с шапкой и подвалом, а содержимое берётся из src/data/routes.js
   по location.pathname. Появится настоящая страница — у неё будет своя
   точка входа, а строка из routes.js останется описанием для карты сайта.
   Так уже вышли из-под этого файла страницы категорий (src/category.js)
   и карточки товаров (src/product.js).

   Дизайна у заглушек нет намеренно (так и просил заказчик): одна колонка,
   токены и базовая типографика. Их задача — показать, что навигация ведёт
   на живые адреса, а не в 404, и что структура сайта продумана целиком.

   Четыре страницы собираются не по общему шаблону:
     /sitemap     — полный список адресов, он же проверка целостности карты;
                    карточки товара свёрнуты в одну строку с примером;
     /production  — готовый текст: туда переехала секция «Происхождение»;
     /delivery    — «Доставка и оплата»: блоки через волосяную линию
                    (src/data/delivery.js);
     категории    — к описанию добавляется список подкатегорий ссылками.
   ============================================================================ */

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
import './styles/pages/page.css'

import { GROUPS, ROUTES, allPages, findPage, staticPages } from './data/routes.js'
import { categories } from './data/catalog.js'
import { productionPage } from './data/production.js'
import { deliveryPage } from './data/delivery.js'
import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'

/* --------------------------------------------------------------- шаблоны */

/** «74 адреса», а не «74 адресов». Своя копия: тащить сюда модель каталога
    ради одной строки в карте сайта незачем. */
function plural(n, one, few, many) {
  const n10 = n % 10
  const n100 = n % 100
  const form = n100 >= 11 && n100 <= 14 ? many : n10 === 1 ? one : n10 >= 2 && n10 <= 4 ? few : many
  return `${n} ${form}`
}

const linkList = (links) => `
  <ul class="page__links">
    ${links.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join('')}
  </ul>
`

/** Подкатегории на странице категории — те же ссылки, что в панели шапки. */
function categoryBody(page) {
  const category = categories.find((item) => ROUTES.category(item.slug) === page.path)
  if (!category) return ''

  return `
    <h2 class="page__subtitle">Разделы</h2>
    ${linkList(
      category.subs.map((sub) => ({
        label: sub.name,
        href: `${page.path}?sub=${sub.slug}`,
      })),
    )}
  `
}

/**
 * Карта сайта: все адреса одним списком, по группам.
 *
 * Карточки товаров сворачиваются в одну строку с примером. Их семьдесят с
 * лишним — по числу позиций каталога, — и списком они превращают карту сайта
 * в простыню, в которой не найти ни корзину, ни оформление заказа. Карта
 * показывает УСТРОЙСТВО сайта, а перечень товаров живёт в каталоге.
 */
function sitemapBody() {
  return GROUPS.map((group) => {
    const pages = allPages.filter((page) => page.group === group.id)
    const products = pages.filter((page) => page.template === 'product')
    const rest = pages.filter((page) => page.template !== 'product')

    const links = rest.map((page) => ({ label: `${page.title} — ${page.path}`, href: page.path }))

    if (products.length) {
      links.push({
        label: `Карточка товара — ${plural(products.length, 'адрес', 'адреса', 'адресов')}, пример: ${products[0].path}`,
        href: products[0].path,
      })
    }

    return `
      <h2 class="page__subtitle">${group.title}</h2>
      ${linkList(links)}
    `
  }).join('')
}

/** Производство: единственная страница с готовым содержимым. */
function productionBody() {
  const page = productionPage
  return `
    ${page.paragraphs.map((text) => `<p class="page__p">${text}</p>`).join('')}

    <dl class="page__facts">
      ${page.facts
        .map(
          ({ value, label }) => `
      <div class="page__fact">
        <dt class="page__fact-num">${value}</dt>
        <dd class="page__fact-label">${label}</dd>
      </div>`,
        )
        .join('')}
    </dl>

    <h2 class="page__subtitle">${page.documentsTitle}</h2>
    <ul class="page__docs">
      ${page.documents.map((text) => `<li>${text}</li>`).join('')}
    </ul>
  `
}

/**
 * Доставка и оплата. Одна колонка в читаемую меру, блоки через волосяную
 * линию — ни вкладок, ни аккордеонов: страницу читают сверху вниз в поисках
 * одного ответа, и прятать ответы за нажатиями значит заставлять искать.
 */
function deliveryBody() {
  const page = deliveryPage

  const rows = (list) => `
    <dl class="page__rows">
      ${list.map(({ term, value }) => `<div class="page__row"><dt>${term}</dt><dd>${value}</dd></div>`).join('')}
    </dl>`

  const points = (list) => `
    <ul class="page__docs">
      ${list.map((p) => `<li><b>${p.name}</b> · ${p.city}, ${p.address} · ${p.hours}</li>`).join('')}
    </ul>`

  return `
    ${page.blocks
      .map(
        (block) => `
      <section class="page__block" aria-labelledby="delivery-${block.id}">
        <h2 class="page__subtitle" id="delivery-${block.id}">${block.title}</h2>
        ${(block.text || []).map((text) => `<p class="page__p">${text}</p>`).join('')}
        ${block.rows ? rows(block.rows) : ''}
        ${block.points ? points(block.points) : ''}
      </section>`,
      )
      .join('')}

    <p class="page__block page__p">
      ${page.returns.text} <a class="page__inline-link" href="${page.returns.link.href}">${page.returns.link.label}</a>
    </p>
  `
}

/** Не нашли адрес — это 404 в чистом виде, даже если файл называется иначе. */
const notFoundPage = staticPages.find((page) => page.path === ROUTES.notFound)

/**
 * Страницы, которые уже сделаны и пометки «заглушка» не требуют:
 * производство с настоящим текстом, карта сайта и 404 — последняя
 * и должна выглядеть именно так, как выглядит.
 */
const READY = [ROUTES.production, ROUTES.delivery, ROUTES.sitemap, ROUTES.notFound]

/** Надзаголовок: откуда пришли и что это за адрес. */
function eyebrowFor(page) {
  if (page.path === ROUTES.sitemap) return 'НАВИГАЦИЯ'
  if (page.path === ROUTES.notFound) return 'ОШИБКА 404'
  if (page.template === 'category') return 'КАТАЛОГ'
  if (page.template === 'article') return 'ЖУРНАЛ'
  if (page.template === 'product') return 'ТОВАР'
  return GROUPS.find((group) => group.id === page.group)?.title.toUpperCase() || 'РАЗДЕЛ'
}

/**
 * Страница результатов поиска. Настоящей выдачи здесь нет и в прототипе
 * не будет — но запрос, с которым сюда пришли, показать обязательно:
 * иначе переход «показать все результаты» выглядит как переход в никуда,
 * и на показе заказчик решает, что поиск сломан.
 */
function searchBody() {
  const query = new URLSearchParams(location.search).get('q')
  if (!query) return ''

  return `
    <p class="page__p"><strong>Запрос:</strong> «${query.replace(/</g, '&lt;')}»</p>
    <p class="page__p">
      Выдача собирается на стороне сервера и появится вместе с выгрузкой
      каталога. Подсказки при вводе уже работают — они в шапке.
    </p>
  `
}

function bodyFor(page) {
  if (page.path === ROUTES.sitemap) return sitemapBody()
  if (page.path === ROUTES.search) return searchBody()
  if (page.path === ROUTES.production) return productionBody()
  if (page.path === ROUTES.delivery) return deliveryBody()
  if (page.template === 'category') return categoryBody(page)

  if (page.path === ROUTES.notFound) {
    return linkList([
      { label: 'Каталог', href: ROUTES.catalog },
      { label: 'Поиск по сайту', href: ROUTES.search },
      { label: 'Контакты', href: ROUTES.contacts },
      { label: 'На главную', href: ROUTES.home },
    ])
  }

  return ''
}

/* ------------------------------------------------------------------ сборка */

function render(mount) {
  if (!mount) return

  const page = findPage(location.pathname) || notFoundPage
  const isStub = !READY.includes(page.path)

  document.title = `${page.title} — №1 Гранд Гурмэ`

  mount.className = 'page'
  mount.innerHTML = `
    <div class="page__inner">
      <p class="eyebrow">${eyebrowFor(page)}</p>
      <h1 class="page__title">${page.title}</h1>
      <p class="page__p page__lead">${page.lead}</p>

      ${bodyFor(page)}

      ${
        isStub
          ? `<p class="page__stub">
               Страница-заглушка прототипа. Адрес настоящий и уже стоит
               в навигации — наполнение появится на следующих шагах.
             </p>`
          : ''
      }

      <p class="page__back">
        <a class="btn" href="${ROUTES.home}">На главную</a>
      </p>
    </div>
  `
}

render(document.querySelector('#main'))
initHeader()
initFooter()
