/* ============================================================================
   Снимки информационных страниц для переноса на Битрикс.

   npm run info:snapshot — собирает разметку <main> каждой из девяти страниц
   раздела «Компания» (src/info/pages/) и кладёт её в
   bitrix/info-snapshots/<адрес>.html. Это заготовка страницы Битрикса:
   разметка вставляется между шапкой и подвалом как есть, и блоки оживают
   тем же скриптом (init* читают всё из разметки). Файлы — в git.

   Заодно это проверка правила переносимости: build* — чистые функции.
   Скрипт работает в node, где нет ни document, ни window, и падает,
   если какой-то блок полез в браузерное API при сборке.

   Секции «Характер икры» и «Происхождение» с /alt2 собираются через DOM —
   в снимке на их месте пустая <section> с id и data-ib (PERENOS-info-stranicy.md).
   ============================================================================ */

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

import { infoPages } from '../src/info/pages/index.js'
import { renderPage } from '../src/info/render.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'bitrix', 'info-snapshots')

fs.mkdirSync(OUT, { recursive: true })

const stamp = `<!-- GENERATED scripts/info-snapshot.mjs — разметка блоков раздела «Компания»; править в src/data/info/ и src/info/, затем npm run info:snapshot -->`

let count = 0
for (const page of infoPages) {
  const html = renderPage(page)
  if (/<script/i.test(html)) throw new Error(`[info:snapshot] ${page.path}: в разметке <script>`)
  const name = page.path.replace(/^\//, '') || 'index'
  const file = path.join(OUT, `${name}.html`)
  fs.writeFileSync(file, `${stamp}\n<main id="main" class="info">\n${html}\n</main>\n`, 'utf8')
  const blocks = (html.match(/<section /g) || []).length
  console.log(`[info:snapshot] ${page.path} → bitrix/info-snapshots/${name}.html · блоков: ${blocks}`)
  count += 1
}

console.log(`[info:snapshot] готово: ${count} страниц`)
