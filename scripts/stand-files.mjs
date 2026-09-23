/**
 * Список файлов, которые уезжают на стенд, и манифест к ним.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Путей заливки два — архив через админку
 * (scripts/stand-pack.mjs) и SSH (scripts/stand-ssh.mjs). Список файлов
 * и правило подсчёта md5 у них обязаны совпадать до буквы, иначе два пути
 * начнут расходиться, а разошедшиеся сборки — ровно та беда, из-за которой
 * 17.09.2026 появился CLAUDE.md. Поэтому список живёт здесь один.
 *
 * ЧТО ВХОДИТ:
 *   bitrix/templates/grandgurme/**  → /bitrix/templates/grandgurme/** (без README.md)
 *   deploy-src/**                   → /**
 *   bitrix/server/**                → /**  (файлы ядра сайта: /local/php_interface/init.php, /urlrewrite.php)
 *
 * md5 считается по содержимому с концами строк, приведёнными к LF, — тем же
 * способом, что и на сервере (bitrix/install/stand-deploy.php, stand-ssh.mjs).
 */

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'

export const ROOT = process.cwd()

export const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim()

/** md5 с концами строк, приведёнными к LF. */
export const md5lf = (buf) =>
  createHash('md5').update(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary').digest('hex')

/** Незакоммиченные правки в путях, которые уезжают на сервер или влияют на сборку. */
export const dirtyList = () =>
  git('status --porcelain -- src bitrix deploy-src scripts package.json vite.bitrix.config.js')
    .split('\n')
    .filter(Boolean)
    // Результаты сборки в .gitignore и в статус не попадают; на всякий случай отсекаем.
    .filter((line) => !/assets\/|generated\.php/.test(line))

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const toPosix = (p) => p.split(sep).join(posix.sep)

/** [[путь на сервере, файл в репозитории], ...], отсортировано по пути на сервере. */
export function collectEntries() {
  const entries = []
  const add = (srcDir, serverPrefix, skip = () => false) => {
    const abs = join(ROOT, srcDir)
    if (!existsSync(abs)) return
    for (const file of walk(abs)) {
      const rel = toPosix(relative(abs, file))
      if (skip(rel)) continue
      entries.push([posix.join(serverPrefix, rel), file])
    }
  }
  add('bitrix/templates/grandgurme', '/bitrix/templates/grandgurme', (rel) => rel === 'README.md')
  add('deploy-src', '/')
  add('bitrix/server', '/')
  entries.sort(([a], [b]) => a.localeCompare(b))
  return entries
}

/** Проверка, что npm run bitrix отработал: без этих файлов заливать нечего. */
export function requireBuild() {
  for (const required of ['assets/css/app.css', 'assets/js/app.js', 'include/generated.php']) {
    if (!existsSync(join(ROOT, 'bitrix/templates/grandgurme', required))) {
      console.error(`[stand] Нет ${required} — сначала npm run bitrix`)
      process.exit(1)
    }
  }
}

/**
 * Страницы, которые правят в админке Битрикса, а не в репозитории.
 *
 * ЗАЧЕМ. Руководство меняет тексты сайта визуальным редактором, без
 * разработчика. Заливка таких страниц затёрла бы правку контент-менеджера
 * молча, поэтому правило простое:
 *
 *   — файла на стенде нет → заливаем (первая установка);
 *   — файл на стенде есть → НЕ трогаем никогда, даже с --force;
 *   — npm run stand:drift не считает его расхождением, а пишет отдельной
 *     строкой «правится в админке».
 *
 * Чтобы вернуть страницу к виду из репозитория, её надо сначала удалить
 * на стенде — это осознанное действие человека, а не побочный эффект заливки.
 *
 * Пути — от корня сайта, как в манифесте. Список будет расти по мере того,
 * как страницы переезжают в админку.
 */
export const ADMIN_EDITED = ['/storage/index.php']

export const pad = (n) => String(n).padStart(2, '0')

export const dateStamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Манифест заливки. Формат один и у архива, и у SSH: на него смотрят
 * stand-deploy.php, stand-ssh.mjs и записки Cowork.
 */
export function buildManifest(entries, { dirty, builtAt = new Date() } = {}) {
  const files = {}
  const payload = entries.map(([serverPath, file]) => {
    const data = readFileSync(file)
    files[serverPath] = md5lf(data)
    return [serverPath, data]
  })
  return {
    manifest: {
      commit: git('rev-parse HEAD'),
      branch: git('rev-parse --abbrev-ref HEAD'),
      dirty: Boolean(dirty),
      builtAt: builtAt.toISOString(),
      files,
    },
    payload,
  }
}
