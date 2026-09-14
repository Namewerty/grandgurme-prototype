/* ============================================================================
   Генератор html-заглушек по карте сайта.

   Запускается сам перед `npm run dev` и `npm run build` (см. package.json,
   predev / prebuild). Руками — `npm run pages`.

   Что делает: для каждого адреса из src/data/routes.js кладёт файл
   <адрес>/index.html — пустой каркас с шапкой, подвалом и точкой входа
   /src/page.js. Само содержимое страница берёт из routes.js в браузере,
   поэтому здесь только <title>, описание и разметка каркаса.

   Почему каталог, а не catalog.html: адреса в карте сайта — /catalog,
   /catalog/ryba, /journal/species. Плоские файлы дали бы /catalog.html,
   и заказчику пришлось бы смотреть на адреса, которых на боевом сайте
   не будет.

   Файлы генерируемые: правки в них затираются при следующем запуске.
   Отсюда маркер GENERATED в первой строке — по нему же удаляются каркасы
   страниц, исчезнувших из карты сайта.
   ============================================================================ */

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { allPages } from '../src/data/routes.js'
import { hasProducts } from '../src/data/catalog-products.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MARKER = '<!-- GENERATED scripts/build-pages.mjs — правки затрутся -->'

const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const template = ({ title, lead, entry }) => `${MARKER}
<!doctype html>
<html lang="ru" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <title>${escape(title)} — №1 Гранд Гурмэ</title>
  <meta name="description" content="${escape(lead)}">
  <meta name="robots" content="noindex">

  <link rel="icon" href="/media/brand/favicon.svg" type="image/svg+xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Prata&display=swap">

  <script>
    /* Тема ставится до первой отрисовки, как на главной, — иначе мигает. */
    (function () {
      var root = document.documentElement
      root.classList.add('js')
      try {
        var saved = localStorage.getItem('gg-theme')
        if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved)
      } catch (e) { /* приватный режим — остаёмся на светлой */ }
    })()
  </script>
</head>
<body>
  <a class="skip-link" href="#main">Перейти к содержанию</a>

  <div id="topbar"></div>
  <header id="masthead" class="header" data-header></header>

  <main id="main" class="page"></main>

  <footer id="site-footer" class="footer section--dark"></footer>

  <noscript>
    <p style="padding:2rem;font-family:system-ui">
      Страница собирается скриптом. Включите JS, чтобы посмотреть содержимое.
    </p>
  </noscript>

  <script type="module" src="${entry}"></script>
</body>
</html>
`

/** Все сгенерированные ранее каркасы — по маркеру в первой строке. */
function findGenerated(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'public', 'src', 'scripts', 'screenshots'].includes(entry.name)) continue

    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findGenerated(full, found)
    else if (entry.name === 'index.html') {
      if (fs.readFileSync(full, 'utf8').startsWith(MARKER)) found.push(full)
    }
  }
  return found
}

const wanted = new Set(
  allPages.map((page) => path.join(ROOT, page.path.replace(/^\//, ''), 'index.html')),
)

// Сначала убираем каркасы страниц, которых в карте сайта больше нет.
let removed = 0
findGenerated(ROOT).forEach((file) => {
  if (wanted.has(file)) return
  fs.rmSync(path.dirname(file), { recursive: true, force: true })
  removed += 1
})

/**
 * Точка входа страницы.
 *
 * Шесть входов вместо одного:
 *   /src/category.js       раздел с выгрузкой товаров: фильтры, сетка, боттом-шит;
 *   /src/product.js        карточка товара: галерея, фасовки, ленты;
 *   /src/cart.js           корзина;
 *   /src/checkout.js       оформление заказа;
 *   /src/order-success.js  «Заказ принят»;
 *   /src/page.js           всё остальное — общий каркас заглушек.
 *
 * Раздел без товаров тоже остаётся на заглушке: пустой каталог с нулём
 * в счётчике выглядит на показе хуже, чем честное описание раздела.
 */
const ENTRY_BY_PATH = {
  '/cart': '/src/cart.js',
  '/checkout': '/src/checkout.js',
  '/order-success': '/src/order-success.js',
}

function entryFor(page) {
  if (ENTRY_BY_PATH[page.path]) return ENTRY_BY_PATH[page.path]
  if (page.template === 'product') return '/src/product.js'
  if (page.template !== 'category') return '/src/page.js'
  const slug = page.path.replace('/catalog/', '')
  return hasProducts(slug) ? '/src/category.js' : '/src/page.js'
}

allPages.forEach((page) => {
  const file = path.join(ROOT, page.path.replace(/^\//, ''), 'index.html')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, template({ ...page, entry: entryFor(page) }), 'utf8')
})

console.log(
  `[pages] собрано ${allPages.length} страниц` + (removed ? `, удалено лишних: ${removed}` : ''),
)
