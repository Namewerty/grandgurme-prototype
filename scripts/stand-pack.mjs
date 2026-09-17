/**
 * Архив для стенда Битрикса из текущего коммита: `npm run stand`.
 *
 * ЗАЧЕМ. До 17.09.2026 архивы собирались руками, из разных коммитов,
 * а контрольные суммы переписывались в промпты таблицами. В итоге на стенде
 * оказался архив из старой базы с патчем, которого не было в GitHub, и три
 * свежих коммита до стенда не доехали. Теперь архив один на коммит и сам
 * несёт список файлов с суммами — сверять и заливать по нему умеет
 * bitrix/install/stand-deploy.php.
 *
 * ЧТО ВХОДИТ. Всё, что уезжает на сервер, целиком, а не только изменённое:
 *   bitrix/templates/grandgurme/**  → /bitrix/templates/grandgurme/** (без README.md)
 *   deploy-src/**                   → /**
 *   bitrix/server/**                → /**  (файлы ядра сайта: /local/php_interface/init.php, /urlrewrite.php)
 * Плюс stand-manifest.json: коммит, дата, md5 каждого файла.
 * md5 считается по содержимому с концами строк, приведёнными к LF, —
 * тем же способом, что и на сервере.
 *
 * НЕЗАКОММИЧЕННЫЕ ПРАВКИ. Если в рабочей копии есть изменения в этих путях
 * или в src/, архив не собирается: на стенд уезжает только то, что есть
 * в истории. Обойти для пробы можно флагом --dirty, манифест это запомнит.
 *
 * Результат: grandgurme-stand-<дата>-<коммит>.zip в корне (в git не попадает).
 * Лимит nginx стенда на загрузку — около 1 МБ; скрипт предупреждает, если больше.
 */

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const ROOT = process.cwd()
const allowDirty = process.argv.includes('--dirty')

const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim()

const commit = git('rev-parse HEAD')
const short = commit.slice(0, 7)
const branch = git('rev-parse --abbrev-ref HEAD')
const dirtyList = git('status --porcelain -- src bitrix deploy-src scripts package.json vite.bitrix.config.js')
  .split('\n')
  .filter(Boolean)
  // Результаты сборки в .gitignore и в статус не попадают; на всякий случай отсекаем.
  .filter((line) => !/assets\/|generated\.php/.test(line))

if (dirtyList.length && !allowDirty) {
  console.error('[stand] В рабочей копии есть незакоммиченные правки — архив не собран:')
  console.error(dirtyList.map((l) => '  ' + l).join('\n'))
  console.error('[stand] Закоммитьте их или соберите пробный архив: npm run stand -- --dirty')
  process.exit(1)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const toPosix = (p) => p.split(sep).join(posix.sep)

/** [путь на сервере, файл в репозитории] */
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

for (const required of ['assets/css/app.css', 'assets/js/app.js', 'include/generated.php']) {
  if (!existsSync(join(ROOT, 'bitrix/templates/grandgurme', required))) {
    console.error(`[stand] Нет ${required} — сначала npm run bitrix (npm run stand делает это сам)`)
    process.exit(1)
  }
}

entries.sort(([a], [b]) => a.localeCompare(b))

const md5lf = (buf) => createHash('md5').update(buf.toString('binary').replace(/\r\n/g, '\n'), 'binary').digest('hex')

const files = {}
const payload = entries.map(([serverPath, file]) => {
  const data = readFileSync(file)
  files[serverPath] = md5lf(data)
  return [serverPath.replace(/^\//, ''), data]
})

const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

const manifest = {
  commit,
  branch,
  dirty: dirtyList.length > 0,
  builtAt: today.toISOString(),
  files,
}
payload.push(['stand-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')])

/* ---- Минимальный ZIP (deflate), без зависимостей ----------------------- */

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff

const locals = []
const centrals = []
let offset = 0
for (const [name, data] of payload) {
  const nameBuf = Buffer.from(name, 'utf8')
  const packed = deflateRawSync(data, { level: 9 })
  const crc = crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0800, 6) // имена в UTF-8
  local.writeUInt16LE(8, 8)
  local.writeUInt16LE(dosTime(today), 10)
  local.writeUInt16LE(dosDate(today), 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(packed.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)
  locals.push(local, nameBuf, packed)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(dosTime(today), 12)
  central.writeUInt16LE(dosDate(today), 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(packed.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  central.writeUInt32LE(offset, 42)
  centrals.push(central, nameBuf)

  offset += local.length + nameBuf.length + packed.length
}
const centralBuf = Buffer.concat(centrals)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(payload.length, 8)
end.writeUInt16LE(payload.length, 10)
end.writeUInt32LE(centralBuf.length, 12)
end.writeUInt32LE(offset, 16)

const zip = Buffer.concat([...locals, centralBuf, end])
const out = `grandgurme-stand-${date}-${short}${manifest.dirty ? '-dirty' : ''}.zip`
writeFileSync(join(ROOT, out), zip)

console.log(`[stand] ${out} — ${(zip.length / 1024).toFixed(0)} КБ, файлов ${entries.length}, коммит ${short} (${branch})`)
if (manifest.dirty) console.log('[stand] ВНИМАНИЕ: пробный архив с незакоммиченными правками')
if (zip.length > 1024 * 1024) console.log('[stand] ВНИМАНИЕ: больше 1 МБ — nginx стенда такой файл не пропустит')
console.log('[stand] Дальше: bitrix/install/stand-deploy.php в командной PHP-строке (сначала $mode = \'check\').')
