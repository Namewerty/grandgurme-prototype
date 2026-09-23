/**
 * Архив для стенда Битрикса из текущего коммита: `npm run stand`.
 *
 * ЗАПАСНОЙ ПУТЬ. С 23.09.2026 основная заливка — по SSH (`npm run stand:deploy`,
 * scripts/stand-ssh.mjs). Архив остаётся для случая, когда SSH недоступен,
 * и для боевого сайта, куда доступа пока нет. Список файлов у обоих путей
 * один — scripts/stand-files.mjs.
 *
 * ЗАЧЕМ. До 17.09.2026 архивы собирались руками, из разных коммитов,
 * а контрольные суммы переписывались в промпты таблицами. В итоге на стенде
 * оказался архив из старой базы с патчем, которого не было в GitHub, и три
 * свежих коммита до стенда не доехали. Теперь архив один на коммит и сам
 * несёт список файлов с суммами — сверять и заливать по нему умеет
 * bitrix/install/stand-deploy.php.
 *
 * ЧТО ВХОДИТ. Всё, что уезжает на сервер, целиком, а не только изменённое;
 * состав — в scripts/stand-files.mjs. Плюс stand-manifest.json: коммит, дата,
 * md5 каждого файла.
 *
 * НЕЗАКОММИЧЕННЫЕ ПРАВКИ. Если в рабочей копии есть изменения в этих путях
 * или в src/, архив не собирается: на стенд уезжает только то, что есть
 * в истории. Обойти для пробы можно флагом --dirty, манифест это запомнит.
 *
 * Результат: grandgurme-stand-<дата>-<коммит>.zip в корне (в git не попадает).
 * Лимит nginx стенда на загрузку — около 1 МБ; скрипт предупреждает, если больше.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'

import { ROOT, buildManifest, collectEntries, dateStamp, dirtyList, requireBuild } from './stand-files.mjs'

const allowDirty = process.argv.includes('--dirty')

const dirty = dirtyList()
if (dirty.length && !allowDirty) {
  console.error('[stand] В рабочей копии есть незакоммиченные правки — архив не собран:')
  console.error(dirty.map((l) => '  ' + l).join('\n'))
  console.error('[stand] Закоммитьте их или соберите пробный архив: npm run stand -- --dirty')
  process.exit(1)
}

requireBuild()

const entries = collectEntries()
const today = new Date()
const { manifest, payload: files } = buildManifest(entries, { dirty: dirty.length > 0, builtAt: today })

const short = manifest.commit.slice(0, 7)
const date = dateStamp(today)

/** [имя в архиве, содержимое] — пути в zip без ведущего слеша. */
const payload = files.map(([serverPath, data]) => [serverPath.replace(/^\//, ''), data])
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

console.log(
  `[stand] ${out} — ${(zip.length / 1024).toFixed(0)} КБ, файлов ${entries.length}, коммит ${short} (${manifest.branch})`
)
if (manifest.dirty) console.log('[stand] ВНИМАНИЕ: пробный архив с незакоммиченными правками')
if (zip.length > 1024 * 1024) console.log('[stand] ВНИМАНИЕ: больше 1 МБ — nginx стенда такой файл не пропустит')
console.log('[stand] Это запасной путь. Основной — npm run stand:deploy (по SSH).')
console.log('[stand] Дальше: bitrix/install/stand-deploy.php в командной PHP-строке (сначала $mode = \'check\').')
