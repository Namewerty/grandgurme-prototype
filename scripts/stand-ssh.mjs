/**
 * Заливка стенда Битрикса по SSH: `npm run stand:drift|stand:deploy|stand:pull`.
 *
 * ЗАЧЕМ. До 23.09.2026 стенд заливался архивом: npm run stand собирал zip,
 * человек прикладывал его к командной PHP-строке в админке, stand-deploy.php
 * раскладывал файлы. Шагов много, каждый руками. 23.09.2026 на стенде появился
 * SSH — и весь этот путь укладывается в одну команду. Архив и stand-deploy.php
 * никуда не делись: они остаются на случай, когда SSH недоступен, и для боевого
 * сайта, куда доступа пока нет.
 *
 * ДОСТУП В РЕПОЗИТОРИЙ НЕ ПОПАДАЕТ. Скрипт знает только имя хоста `gg-stand`;
 * адрес, логин и ключ лежат в ~/.ssh/config на машине. Переопределяется
 * переменной окружения GG_STAND_SSH.
 *
 * ЧТО УЕЗЖАЕТ. Ровно те файлы, что считает scripts/stand-files.mjs, — тот же
 * список, что кладётся в архив. Ничего сверх него скрипт на сервере не трогает:
 * --delete запрещён, чужие файлы на стенде не удаляются никогда. Исключение
 * одно — три папки кеша Битрикса, они чистятся после заливки.
 *
 * КАК ЕДЕТ. rsync локально не поставлен (Windows), поэтому сборка уезжает
 * одним tar.gz в /home/deploy/.gg-stand-stage, а rsync запускается уже НА
 * СЕРВЕРЕ, из этой папки в корень сайта. Флаги те же, что были бы у заливки
 * с машины; сравнение — по контрольным суммам, а не по датам.
 *
 * КОПИЯ И ОТКАТ. Перед заливкой всё, что будет перезаписано, складывается
 * в tar.gz рядом с корнем сайта (nginx туда не смотрит). Строку отката скрипт
 * печатает в конце — отдельной команды для этого нет намеренно: откат делает
 * человек, который понимает, что откатывает.
 */

import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { gzipSync } from 'node:zlib'

import {
  ROOT,
  buildManifest,
  collectEntries,
  dateStamp,
  dirtyList,
  git,
  md5lf,
  pad,
  requireBuild,
} from './stand-files.mjs'

/* ---- Что мы знаем о сервере ------------------------------------------- */

const HOST = process.env.GG_STAND_SSH || 'gg-stand'
const SITE = '/var/www/bitrix.1grandgourmet.ru/www'
const ARCHIVE = '/var/www/bitrix.1grandgourmet.ru/gg-stand-archive'
/** Если в gg-stand-archive нет записи, копии уходят сюда — тоже вне корня сайта. */
const ARCHIVE_FALLBACK = '$HOME/gg-stand-archive'
const STAGE = '$HOME/.gg-stand-stage'
const LIST = '$HOME/.gg-stand-files.txt'
const MANIFEST = '/local/gg-stand/manifest.json'
const CACHE_DIRS = ['bitrix/cache', 'bitrix/managed_cache', 'bitrix/stack_cache']
const CHECK_BASE = 'https://bitrix.grandgurme.ru'
const CHECK_URLS = ['/', '/catalog/', '/catalog/ryba/', '/cart/', '/account/login/']

const say = (line = '') => console.log(line)
/** «1 файл», «3 файла», «5 файлов» — иначе итоговая строка читается как черновик. */
const plural = (n, one, few, many) => {
  const d = n % 100
  if (d > 10 && d < 20) return `${n} ${many}`
  const u = n % 10
  return `${n} ${u === 1 ? one : u >= 2 && u <= 4 ? few : many}`
}
const die = (line) => {
  console.error('[stand-ssh] ' + line)
  closeSsh()
  process.exit(1)
}

/* ---- Одно соединение на всю команду ------------------------------------ */

/**
 * ControlMaster бережёт время: иначе каждый шаг — новый вход. На Windows
 * мультиплексирование в OpenSSH не работает (мастер отваливается сразу,
 * остаётся мёртвый сокет), поэтому там просто открываем соединение на каждый
 * шаг: ключ без пароля, вход занимает доли секунды.
 */
const MUX = process.platform === 'win32' ? null : `/tmp/gg-stand-mux-${process.pid}`
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20']
const muxOpts = () => (MUX ? ['-o', 'ControlMaster=auto', '-o', `ControlPath=${MUX}`, '-o', 'ControlPersist=60'] : [])

function closeSsh() {
  if (MUX) spawnSync('ssh', ['-o', `ControlPath=${MUX}`, '-O', 'exit', HOST], { stdio: 'ignore' })
}

/**
 * Одна команда на сервере. cmd — это строка для sh на той стороне.
 * input — что отдать ей в stdin (список путей, tar, манифест).
 */
function ssh(cmd, { input, binary = false, allowFail = false, label = '' } = {}) {
  const r = spawnSync('ssh', [...SSH_OPTS, ...muxOpts(), HOST, cmd], {
    input,
    maxBuffer: 256 * 1024 * 1024,
    encoding: binary ? 'buffer' : 'utf8',
  })
  const err = binary ? (r.stderr || Buffer.alloc(0)).toString('utf8') : r.stderr || ''
  if (r.error) die(`ssh не запустился: ${r.error.message}`)
  if (r.status !== 0 && !allowFail) {
    die(`не выполнилось на сервере${label ? ' (' + label + ')' : ''}:\n${cmd}\n${err.trim()}`)
  }
  return { code: r.status, out: r.stdout, err }
}

/* ---- Сверка со стендом -------------------------------------------------- */

/** Манифест последней заливки со стенда; null, если его там нет. */
function remoteManifest() {
  const { code, out } = ssh(`cat ${SITE}${MANIFEST} 2>/dev/null`, { allowFail: true })
  if (code !== 0 || !out.trim()) return null
  try {
    return JSON.parse(out)
  } catch {
    die(`манифест на стенде (${MANIFEST}) не читается как JSON`)
  }
}

/**
 * md5 перечисленных файлов на сервере — с концами строк, приведёнными к LF,
 * ровно как в stand-deploy.php и stand-files.mjs. Пути уходят через stdin
 * в файл, а не аргументами: файлов сейчас четыре десятка, но список растёт,
 * а в длину командной строки упереться проще, чем кажется.
 * Пустая строка в ответе — файла нет.
 */
const PERL_MD5 =
  'chomp; my $p = $_; my $d; if (open(my $fh, "<:raw", $p)) { local $/; $d = <$fh>; close $fh; $d = "" unless defined $d; $d =~ s/\\r\\n/\\n/g; print md5_hex($d), "\\t", $p, "\\n"; } else { print "-\\t", $p, "\\n"; }'

function remoteMd5(serverPaths) {
  if (!serverPaths.length) return new Map()
  const list = serverPaths.map((p) => SITE + p).join('\n') + '\n'
  const { out } = ssh(
    `cat > $HOME/.gg-stand-check.txt && perl -MDigest::MD5=md5_hex -ne '${PERL_MD5}' $HOME/.gg-stand-check.txt; rm -f $HOME/.gg-stand-check.txt`,
    { input: list, label: 'подсчёт md5' }
  )
  const md5 = new Map()
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const tab = line.indexOf('\t')
    const sum = line.slice(0, tab)
    const path = line.slice(tab + 1).replace(SITE, '')
    md5.set(path, sum === '-' ? '' : sum)
  }
  return md5
}

/**
 * Расхождения стенда с последним манифестом: правки, сделанные мимо репозитория.
 *
 * Правило то же, что в stand-deploy.php: файл — расхождение, только если он не
 * совпал НИ с прошлой заливкой, НИ с тем, что мы сейчас собрали. Совпал с новой
 * сборкой — значит, это ровно то содержимое, которое мы и собирались положить
 * (так бывает после заливки, оборвавшейся до записи манифеста), и хвататься
 * за него незачем. Без сборки (npm run stand:drift) сравнивать не с чем —
 * тогда сравнение только с манифестом.
 */
function drift(last, build = null) {
  const paths = Object.keys(last.files)
  const md5 = remoteMd5(paths)
  const changed = []
  const gone = []
  for (const path of paths) {
    const cur = md5.get(path) ?? ''
    if (cur === last.files[path]) continue
    if (build && cur === build[path]) continue
    ;(cur === '' ? gone : changed).push(path)
  }
  return { changed, gone }
}

function sayLast(last) {
  if (!last) {
    say('Сейчас на стенде: манифеста нет — заливка ещё не делалась.')
    return
  }
  say(
    `Сейчас на стенде: коммит ${last.commit.slice(0, 7)} (${last.branch}) от ${last.builtAt}` +
      (last.dirty ? ' — ПРОБНЫЙ, с незакоммиченными правками' : '')
  )
}

/* ---- tar.gz для отправки сборки ----------------------------------------- */

const oct = (n, len) => n.toString(8).padStart(len - 1, '0') + '\0'

/** Минимальный ustar — чтобы не зависеть от tar на Windows. */
function tarball(files, mtime = Math.floor(Date.now() / 1000)) {
  const blocks = []
  for (const [name, data] of files) {
    if (Buffer.byteLength(name, 'utf8') > 100) die(`слишком длинный путь для tar: ${name}`)
    const h = Buffer.alloc(512)
    h.write(name, 0, 100, 'utf8')
    h.write(oct(0o644, 8), 100, 8, 'utf8')
    h.write(oct(0, 8), 108, 8, 'utf8')
    h.write(oct(0, 8), 116, 8, 'utf8')
    h.write(oct(data.length, 12), 124, 12, 'utf8')
    h.write(oct(mtime, 12), 136, 12, 'utf8')
    h.write('        ', 148, 8, 'utf8') // место под контрольную сумму — пока пробелы
    h.write('0', 156, 1, 'utf8')
    h.write('ustar\0' + '00', 257, 8, 'utf8')
    let sum = 0
    for (const b of h) sum += b
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8')
    blocks.push(h, data)
    const tail = (512 - (data.length % 512)) % 512
    if (tail) blocks.push(Buffer.alloc(tail))
  }
  blocks.push(Buffer.alloc(1024)) // конец архива
  return gzipSync(Buffer.concat(blocks), { level: 9 })
}

/* ---- Сборка ------------------------------------------------------------- */

function buildFromCommit({ force }) {
  const dirty = dirtyList()
  if (dirty.length) {
    console.error('[stand-ssh] В рабочей копии есть незакоммиченные правки — на стенд такое не уезжает:')
    console.error(dirty.map((l) => '  ' + l).join('\n'))
    die('закоммитьте их и повторите.')
  }
  const branch = git('rev-parse --abbrev-ref HEAD')
  if (branch !== 'main' && !force) die(`ветка ${branch}, а не main. Если это осознанно — добавьте --force.`)

  say('[stand-ssh] Сборка: npm run bitrix')
  execSync('npm run bitrix', { cwd: ROOT, stdio: 'inherit' })
  requireBuild()

  const entries = collectEntries()
  const { manifest, payload } = buildManifest(entries, { dirty: false })
  return { manifest, payload }
}

/* ---- Команды ------------------------------------------------------------ */

function cmdDrift() {
  const last = remoteManifest()
  sayLast(last)
  if (!last) {
    say('Сравнивать не с чем.')
    return
  }
  const { changed, gone } = drift(last)
  for (const p of changed) say('ИЗМЕНЁН     ' + p)
  for (const p of gone) say('УДАЛЁН      ' + p)
  const total = changed.length + gone.length
  say('')
  say(
    total
      ? `Итог: коммит ${last.commit.slice(0, 7)}, ${plural(total, 'расхождение', 'расхождения', 'расхождений')} — перенести в репозиторий (npm run stand:pull -- <путь>) до следующей заливки.`
      : `Итог: коммит ${last.commit.slice(0, 7)}, расхождений нет — стенд совпадает с последней заливкой.`
  )
}

function cmdDeploy({ yes, force }) {
  const { manifest, payload } = buildFromCommit({ force })
  const short = manifest.commit.slice(0, 7)
  const date = dateStamp()
  const serverPaths = Object.keys(manifest.files)

  const last = remoteManifest()
  sayLast(last)
  say(`Собрано: коммит ${short} (${manifest.branch}), файлов ${serverPaths.length}`)
  say('')

  // 1. Правки на стенде мимо репозитория.
  if (last) {
    const { changed, gone } = drift(last, manifest.files)
    if (changed.length || gone.length) {
      for (const p of changed) say('ИЗМЕНЁН НА СТЕНДЕ  ' + p)
      for (const p of gone) say('УДАЛЁН НА СТЕНДЕ   ' + p)
      say('')
      if (!force) {
        die(
          `на стенде ${plural(changed.length + gone.length, 'правка', 'правки', 'правок')} мимо репозитория. ` +
            'Заберите их (npm run stand:pull -- <путь>) или, если они заведомо не нужны, повторите с --force.'
        )
      }
      say(`--force: перечисленное выше будет перезаписано — ${plural(changed.length + gone.length, 'файл', 'файла', 'файлов')}.`)
      say('')
    }
  }

  // 2. Сборка уезжает в промежуточную папку вне корня сайта.
  const listText = serverPaths.map((p) => p.replace(/^\//, '')).join('\n') + '\n'
  const tar = tarball([
    ...payload.map(([serverPath, data]) => [serverPath.replace(/^\//, ''), data]),
    ['_stand-files.txt', Buffer.from(listText)],
  ])
  const archiveDir = ssh(
    `rm -rf ${STAGE} && mkdir -p ${STAGE} && tar -xzf - -C ${STAGE} && mv ${STAGE}/_stand-files.txt ${LIST} && ` +
      `if ( touch ${ARCHIVE}/.w && rm -f ${ARCHIVE}/.w ) 2>/dev/null; then echo ${ARCHIVE}; else mkdir -p ${ARCHIVE_FALLBACK} && echo ${ARCHIVE_FALLBACK}; fi`,
    { input: tar, label: 'отправка сборки' }
  ).out.trim()
  if (archiveDir !== ARCHIVE) {
    say(`ВНИМАНИЕ: в ${ARCHIVE} нет записи для пользователя deploy — копии кладутся в ${archiveDir}.`)
    say('')
  }

  // 3. Сухой прогон: он и есть «что изменится».
  // -rlD — это -a без -t, -g, -o и -p. Владельца и группу меняем не мы, по датам
  // сравнивать нечего (сравнение по суммам), а -p опущен намеренно: с ним rsync
  // пытается подровнять права УЖЕ СУЩЕСТВУЮЩИХ папок вроде /bitrix (она 0777),
  // и падает — deploy не владелец. Без -p --chmod действует только на то, что
  // rsync создаёт сам; чужие права остаются как были.
  const RSYNC = `rsync -rlD --checksum --itemize-changes --chmod=Dg+ws,Fg+w --files-from=${LIST} ${STAGE}/ ${SITE}/`
  const dry = ssh(`${RSYNC} --dry-run`, { label: 'сухой прогон rsync' }).out
  const willChange = dry
    .split('\n')
    .filter((l) => /^[<>c]f/.test(l))
    .map((l) => '/' + l.slice(l.indexOf(' ') + 1).trim())
    .filter(Boolean)

  for (const p of willChange) say((last && !(p in last.files) ? 'НОВЫЙ       ' : 'ОБНОВИТСЯ   ') + p)
  if (last) {
    for (const goneFromBuild of Object.keys(last.files).filter((p) => !(p in manifest.files))) {
      say('НЕТ В СБОРКЕ ' + goneFromBuild + ' — был в прошлой заливке; удалить руками, если больше не нужен')
    }
  }
  say('')
  say(`Изменится ${plural(willChange.length, 'файл', 'файла', 'файлов')} из ${serverPaths.length}.`)

  if (!yes) {
    say('')
    say(`Итог: коммит ${short}, изменится ${plural(willChange.length, 'файл', 'файла', 'файлов')}, копия не делалась (сухой прогон).`)
    say('Залить: npm run stand:deploy -- --yes')
    return
  }

  // 4. Копия того, что будет перезаписано, — до заливки. В имени есть время:
  // за день один коммет заливают по нескольку раз, и без времени вторая копия
  // затирала бы первую — то есть ровно ту версию, к которой хочется вернуться.
  const now = new Date()
  const backup = `${archiveDir}/backup-${date}-${pad(now.getHours())}${pad(now.getMinutes())}-${short}.tar.gz`
  const backupList = willChange.map((p) => p.replace(/^\//, '')).join('\n') + '\n'
  const made = ssh(
    `cat > $HOME/.gg-stand-backup.txt && cd ${SITE} && ` +
      `while IFS= read -r f; do [ -f "$f" ] && printf "%s\\n" "$f"; done < $HOME/.gg-stand-backup.txt > $HOME/.gg-stand-backup-exists.txt; ` +
      `if [ -s $HOME/.gg-stand-backup-exists.txt ]; then tar -czf ${backup} -T $HOME/.gg-stand-backup-exists.txt && wc -l < $HOME/.gg-stand-backup-exists.txt; else echo 0; fi; ` +
      `rm -f $HOME/.gg-stand-backup.txt $HOME/.gg-stand-backup-exists.txt`,
    { input: backupList, label: 'копия перед заливкой' }
  ).out.trim()
  say('')
  say(`Копия: ${backup} — ${plural(Number(made) || 0, 'файл', 'файла', 'файлов')}`)

  // 5. Заливка.
  const real = ssh(RSYNC, { label: 'заливка rsync' }).out
  const written = real.split('\n').filter((l) => /^[<>c]f/.test(l)).length
  say(`Залито ${plural(written, 'файл', 'файла', 'файлов')}.`)

  // 6. Манифест — на него смотрят stand:drift и stand-deploy.php.
  ssh(`mkdir -p ${SITE}/local/gg-stand && cat > ${SITE}${MANIFEST}`, {
    input: JSON.stringify(manifest, null, 2) + '\n',
    label: 'запись манифеста',
  })

  // 7. Кеш Битрикса — только эти три папки.
  const cache = CACHE_DIRS.map((d) => `[ -d "${d}" ] && find "${d}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +`).join('; ')
  const cacheRun = ssh(`cd ${SITE}; ${cache}; true`, { allowFail: true, label: 'чистка кеша' })
  // Часть кеша пишет php-fpm (www-data) в подпапки без групповой записи —
  // такие файлы deploy удалить не может. Битрикс их перепишет сам, но знать
  // об этом надо: строка про права — в README, «Инфраструктура».
  const stuck = cacheRun.err.split('\n').filter((l) => l.includes('Permission denied')).length
  say(
    stuck
      ? `Кеш очищен частично: ${plural(stuck, 'файл', 'файла', 'файлов')} не удалить — их писал www-data в папки без групповой записи.`
      : 'Кеш очищен: ' + CACHE_DIRS.join(', ')
  )

  // 8. Проверка: страницы отвечают, манифест на месте, суммы сошлись.
  say('')
  const codes = ssh(
    CHECK_URLS.map((u) => `printf '%s ' ${u}; curl -sk -o /dev/null -m 30 -w '%{http_code}\\n' ${CHECK_BASE}${u}`).join('; '),
    { label: 'проверка страниц' }
  ).out
  let bad = 0
  for (const line of codes.split('\n').filter(Boolean)) {
    const ok = line.trim().endsWith('200')
    if (!ok) bad++
    say(`${ok ? 'OK  ' : 'СБОЙ'} ${line.trim()}`)
  }
  const after = remoteManifest()
  if (!after || after.commit !== manifest.commit) {
    bad++
    say(`СБОЙ манифест на стенде: ${after ? after.commit.slice(0, 7) : 'нет'}, заливали ${short}`)
  } else {
    say(`OK   манифест на стенде: коммит ${short}`)
  }
  const back = remoteMd5(serverPaths)
  const mismatch = serverPaths.filter((p) => back.get(p) !== manifest.files[p])
  if (mismatch.length) {
    bad++
    say(`СБОЙ суммы не сошлись у ${mismatch.length} файлов: ${mismatch.slice(0, 5).join(', ')}`)
  } else {
    say(`OK   суммы сошлись у всех ${serverPaths.length} файлов`)
  }

  // 9. Тег.
  // За день стенд заливают не по разу. Уже стоящий тег не переставляем —
  // он отмечает другой коммит, который тоже когда-то был на стенде; берём
  // следующий номер, как это уже заведено у тегов vercel-<дата>-2.
  let tag = `stand-${date}`
  const tagged = (t) => spawnSync('git', ['rev-list', '-n', '1', t], { cwd: ROOT, encoding: 'utf8' })
  let n = 1
  let at = tagged(tag)
  while (at.status === 0 && at.stdout.trim() && at.stdout.trim() !== manifest.commit) {
    tag = `stand-${date}-${++n}`
    at = tagged(tag)
  }
  if (at.status === 0 && at.stdout.trim() === manifest.commit) {
    say(`Тег ${tag} на этом коммите уже стоит.`)
  } else {
    git(`tag ${tag} ${manifest.commit}`)
    const push = spawnSync('git', ['push', '--tags'], { cwd: ROOT, encoding: 'utf8' })
    say(push.status === 0 ? `Тег ${tag} поставлен и отправлен.` : `Тег ${tag} поставлен, push не прошёл: ${push.stderr.trim()}`)
  }

  say('')
  say(`Итог: коммит ${short}, изменилось ${plural(willChange.length, 'файл', 'файла', 'файлов')}, копия ${backup}`)
  say(`Откат: ssh ${HOST} "tar -xzf ${backup} -C ${SITE}"`)
  if (bad) {
    say('')
    die(`проверка после заливки дала ${bad} сбоев — откатывайте строкой выше.`)
  }
}

function cmdPull(path) {
  if (!path) die('нужен путь от корня сайта: npm run stand:pull -- /catalog/index.php')
  const serverPath = '/' + path.replace(/^\/+/, '')

  // Сначала — в тот файл, из которого этот путь на стенде и собран.
  const entry = collectEntries().find(([p]) => p === serverPath)
  let target
  if (entry) {
    target = entry[1]
  } else if (serverPath.startsWith('/bitrix/templates/grandgurme/')) {
    target = join(ROOT, 'bitrix/templates/grandgurme', serverPath.slice('/bitrix/templates/grandgurme/'.length))
  } else if (/^\/(local|bitrix)\//.test(serverPath) || serverPath === '/urlrewrite.php') {
    target = join(ROOT, 'bitrix/server', serverPath.slice(1))
  } else {
    target = join(ROOT, 'deploy-src', serverPath.slice(1))
  }

  const { code, out } = ssh(`cat ${SITE}${serverPath}`, { binary: true, allowFail: true })
  if (code !== 0) die(`на стенде нет файла ${serverPath}`)

  const before = existsSync(target) ? md5lf(readFileSync(target)) : null
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, out)
  const after = md5lf(out)

  say(`Забрано: ${serverPath} → ${relative(ROOT, target).split(sep).join('/')}`)
  say(
    before === null
      ? 'Файла в репозитории не было — добавлен.'
      : before === after
        ? 'Содержимое совпало, файл не изменился.'
        : 'Файл в репозитории обновлён — проверьте git diff и закоммитьте.'
  )
  say('')
  say(`Итог: коммит ${git('rev-parse --short HEAD')}, забран 1 файл, копия не нужна.`)
}

/* ---- Разбор аргументов -------------------------------------------------- */

const argv = process.argv.slice(2)
const command = argv[0]
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const rest = argv.slice(1).filter((a) => !a.startsWith('--'))

try {
  if (command === 'drift') cmdDrift()
  else if (command === 'deploy') cmdDeploy({ yes: flags.has('--yes'), force: flags.has('--force') })
  else if (command === 'pull') cmdPull(rest[0])
  else die('команда: drift | deploy [--yes] [--force] | pull <путь>')
} finally {
  closeSsh()
}
