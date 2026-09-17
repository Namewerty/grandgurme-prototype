/* ============================================================================
   Медиа-манифест битриксовой сборки: какие файлы реально есть в public/media.

   ЗАЧЕМ. На Битриксе несуществующий файл не отдаётся дешёвым 404: веб-сервер
   уводит его в bitrix/urlrewrite.php, и на каждую отсутствующую картинку
   поднимается ядро CMS. Главная давала 29 хитов вместо одного, и «Контроль
   активности» блокировал IP на пять минут. Поэтому в битриксовой сборке
   и скрипт (src/js/media.js), и шаблон (include/fn.php) сверяются с этим
   списком и при промахе сразу рисуют заглушку — файл не запрашивается.

   Список уходит в два места одной командой npm run bitrix:
     — в JS-бандл константой __GG_MEDIA_MANIFEST__ (vite.bitrix.config.js);
     — в include/generated.php ключом mediaFiles (build-bitrix-data.mjs).

   В обычной сборке прототипа (npm run build, Vercel) списка нет сознательно:
   там заказчик кладёт файл в public/media, и он подхватывается без
   пересборки. На Битриксе цена другая: новый кадр появится на сайте только
   после npm run bitrix и заливки свежих app.js и generated.php.
   ============================================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MEDIA_DIR = path.join(ROOT, 'public/media')

/**
 * Лежат в репозитории, но на стенд не залиты.
 *
 * Видео не прошли лимит размера запроса при загрузке через админку. Без этого
 * списка манифест объявил бы их существующими, и каждый просмотр главной
 * снова поднимал бы ядро на промахах.
 *
 * ⚠ Залили файл на стенд — удалите строку и пересоберите, иначе вместо
 * кадра так и останется постер или заглушка.
 */
export const NOT_ON_SERVER = [
  '/media/video/production.mp4',
]

/** Служебные файлы папки — не медиа, на сайте не используются. */
const SKIP = /\.md$/i

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/** Отсортированный список адресов вида /media/brand/logo.svg. */
export function mediaManifest() {
  const excluded = new Set(NOT_ON_SERVER)

  const files = walk(MEDIA_DIR)
    .filter((file) => !SKIP.test(file))
    .map((file) => '/media/' + path.relative(MEDIA_DIR, file).split(path.sep).join('/'))

  // Строка исключения без файла — признак того, что список устарел.
  const present = new Set(files)
  for (const src of NOT_ON_SERVER) {
    if (!present.has(src)) console.warn(`[media] в NOT_ON_SERVER лишняя строка: ${src}`)
  }

  return files.filter((src) => !excluded.has(src)).sort()
}
