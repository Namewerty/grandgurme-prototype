/* ============================================================================
   Пост-обработка собранной версии. Запускается сама после `npm run build`
   (см. postbuild в package.json).

   Зачем. Локально страницу 404 подставляет middleware из vite.config.js —
   в собранной версии его нет. Статический хостинг (Vercel и любой другой)
   ищет для несуществующего адреса файл 404.html В КОРНЕ вывода, а у нас
   страница лежит по адресу /404, то есть файлом dist/404/index.html.

   Поэтому копируем её ещё и в dist/404.html. Оба адреса нужны: /404 —
   настоящая страница карты сайта, на неё ведут ссылки; 404.html — то, что
   хостинг отдаёт с кодом 404 на любой несуществующий путь.
   ============================================================================ */

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))

const source = path.join(DIST, '404', 'index.html')
const target = path.join(DIST, '404.html')

if (!fs.existsSync(source)) {
  console.warn('[after-build] dist/404/index.html не найден — 404.html не создан')
  process.exit(0)
}

fs.copyFileSync(source, target)
console.log('[after-build] dist/404.html создан из dist/404/index.html')

/* ----------------------------------------------------------------------------
   Служебное из public/media, которому в выложенной версии не место
   (28.09.2026, страницы раздела «Компания»):

   — описания в .md рядом с кадрами (ИСТОЧНИКИ.md, README.md, контекст
     каталога): откуда кадр, в каком ресторане снят, имена клиентов. Пока
     нет письменного согласия, названий заведений на сайте быть не должно
     даже служебным файлом;
   — кадры, в которых видно чужое название или товарный знак, — пока
     соответствующий флаг в src/data/info/flags.js выключен: шкатулка
     коллаборации, вечер со световой надписью заведения, фасад отеля
     с вывесками. Страницы на них не ссылаются, но файл по адресу открывался бы.

   Удаляем unlinkSync / rmdirSync по одному: fs.rmSync в папке OneDrive
   отчитывается об успехе и ничего не удаляет (см. build-pages.mjs).
   ---------------------------------------------------------------------------- */

const { SHOW_COLLAB_NAMES, SHOW_PARTNER_NAMES } = await import('../src/data/info/flags.js')

function remove(target) {
  if (!fs.existsSync(target)) return 0
  if (fs.statSync(target).isDirectory()) {
    let n = 0
    for (const entry of fs.readdirSync(target)) n += remove(path.join(target, entry))
    fs.rmdirSync(target)
    return n
  }
  fs.unlinkSync(target)
  return 1
}

function removeNotes(dir) {
  if (!fs.existsSync(dir)) return 0
  let n = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) n += removeNotes(full)
    else if (entry.name.endsWith('.md')) n += remove(full)
  }
  return n
}

const notes = removeNotes(path.join(DIST, 'media'))
const flagged = [
  ...(SHOW_COLLAB_NAMES ? [] : ['media/info/collab']),
  ...(SHOW_PARTNER_NAMES ? [] : ['media/info/partners/event-night.jpg', 'media/info/geo/las-vegas.jpg']),
]
const gone = flagged.reduce((n, rel) => n + remove(path.join(DIST, rel)), 0)
console.log(`[after-build] убрано из dist/media: описаний .md — ${notes}, кадров под флагами — ${gone}`)
