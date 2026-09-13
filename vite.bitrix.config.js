/**
 * Сборка ассетов прямо в шаблон Битрикса.
 *
 * Одна команда — npm run bitrix — собирает данные (include/generated.php),
 * один css и один js и кладёт их в bitrix/templates/grandgurme/assets.
 * Дальше папка шаблона пакуется и уезжает на сервер как есть.
 *
 * Почему один файл на всё: страниц у шаблона будет много, а Битрикс отдаёт
 * свои скрипты и стили сам. Дробить бандл на чанки — значит объяснять
 * Битриксу, как их подключать. Один модуль в футере проще и предсказуемее.
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: ROOT,
  // public/ на Битриксе не копируем: медиа лежит в корне сайта (/media),
  // а не внутри шаблона — так его удобнее возить партиями и заменять
  // настоящими кадрами, не пересобирая шаблон.
  publicDir: false,
  // Ассеты шаблона лежат по абсолютному пути — шаблон общий для всех страниц.
  base: '/bitrix/templates/grandgurme/assets/',

  build: {
    target: 'es2020',
    outDir: 'bitrix/templates/grandgurme/assets',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    // Один css: иначе PHP пришлось бы подключать несколько файлов и следить
    // за их порядком, а порядок в этом проекте значим (токены → база → блоки).
    cssCodeSplit: false,
    rollupOptions: {
      input: { app: 'src/bitrix/main.js' },
      output: {
        entryFileNames: 'js/app.js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (info) =>
          (info.names?.[0] ?? info.name ?? '').endsWith('.css') ? 'css/app.css' : 'files/[name][extname]',
      },
    },
  },
})
