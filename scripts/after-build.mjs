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
