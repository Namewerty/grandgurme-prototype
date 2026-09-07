import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const SKIP = new Set(['node_modules', 'dist', '.git', 'public', 'src', 'scripts', 'screenshots'])

/**
 * Все html-страницы проекта: index.html в корне и каркасы разделов,
 * разложенные по папкам вида catalog/ryba/index.html.
 *
 * Список собирается обходом файлов, а не пишется руками: страниц почти сорок,
 * и любая забытая строка означала бы 404 в собранной версии — в dev-режиме
 * такая страница работает и так, и пропажу замечаешь только после сборки.
 */
function findPages(dir = ROOT, found = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue

    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findPages(full, found)
      continue
    }
    // Только index.html: в корне лежат ещё присланные заказчиком макеты
    // («Фильтры.html» и мокап главной), и они не страницы прототипа.
    if (entry.name !== 'index.html') continue

    const key = path.relative(ROOT, full).replace(/\\/g, '/').replace(/\.html$/, '')
    found[key === 'index' ? 'main' : key] = full
  }
  return found
}

/**
 * Адреса без хвостового слеша и без .html.
 *
 * Заказчик ходит по прототипу так же, как ходил бы по сайту: набирает
 * /catalog, а не /catalog/index.html. Middleware дописывает index.html,
 * если по адресу лежит папка со страницей, и отдаёт /404 вместо пустого
 * ответа. Нужно и dev-серверу, и preview — поэтому вешаем на оба.
 */
function prettyUrls() {
  const resolve = (req, next) => {
    const url = (req.url || '/').split('?')[0]
    if (url.includes('.') || url === '/') return next()

    // Служебные адреса Vite (/@vite/client, /@fs/…, /@id/…) расширения не
    // имеют и без этой проверки уезжали бы на страницу 404 — dev-сервер
    // падал с ошибкой разбора html как модуля. По той же причине трогаем
    // только запросы за страницами, а не за данными и ассетами.
    if (url.startsWith('/@') || url.startsWith('/__') || url.startsWith('/node_modules')) {
      return next()
    }
    if (!String(req.headers.accept || '').includes('text/html')) return next()

    const clean = url.replace(/\/$/, '')
    const candidate = path.join(ROOT, clean, 'index.html')

    if (fs.existsSync(candidate)) {
      req.url = `${clean}/index.html${req.url.slice(url.length)}`
      return next()
    }

    // Несуществующий адрес показываем страницей 404, а не служебной ошибкой.
    if (fs.existsSync(path.join(ROOT, '404', 'index.html'))) req.url = '/404/index.html'
    next()
  }

  // Фигурные скобки обязательны: возвращённое из configureServer значение
  // Vite считает пост-хуком и пытается вызвать, а use() возвращает само
  // приложение — сервер падал бы на старте.
  return {
    name: 'gg-pretty-urls',
    configureServer(server) {
      server.middlewares.use((req, res, next) => resolve(req, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => resolve(req, next))
    },
  }
}

export default defineConfig({
  appType: 'mpa',
  plugins: [prettyUrls()],

  server: {
    port: 5173,
    host: true,
    open: false,
  },

  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: { input: findPages() },
  },
})
