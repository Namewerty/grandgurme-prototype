/* ============================================================================
   Система медиа-заглушек.

   Реальных фото и видео пока нет, поэтому каждое изображение и видео заводится
   через обёртку: путь + пропорция. Пропорция держится через aspect-ratio, так что
   вёрстка не прыгает. Если файл не загрузился — на его месте рисуется заглушка
   с ожидаемым именем файла и пропорцией: «caviar-beluga.jpg · 1:1».

   Когда заказчик положит файлы в /public/media/, ничего править не нужно.
   ============================================================================ */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Условная ширина для атрибутов width/height. Реальный размер задаёт CSS. */
const INTRINSIC_WIDTH = 1200

/** '4:5' | '4/5' | 1.25 → CSS-значение для aspect-ratio. */
function toCssRatio(ratio) {
  if (typeof ratio === 'number') return String(ratio)
  return String(ratio).replace(':', ' / ')
}

/**
 * Пиксельные width/height из пропорции.
 *
 * Обёртка и так держит место через aspect-ratio, но атрибуты нужны самому
 * <img>: без них он до загрузки имеет нулевую высоту, и в момент, когда файл
 * приходит, строка внутри кадра успевает дёрнуться. Значения условные —
 * важна только их пропорция, размер на экране задаёт CSS.
 */
function intrinsicSize(ratio) {
  const [w, h] = String(ratio).split(/[:/]/).map(Number)
  if (!w || !h) return { width: INTRINSIC_WIDTH, height: INTRINSIC_WIDTH }
  return { width: INTRINSIC_WIDTH, height: Math.round((INTRINSIC_WIDTH * h) / w) }
}

/**
 * Можно ли тратить трафик на видео.
 *
 * Мобильный первый экран должен открываться постером, а не ждать ролика:
 * при Data Saver и на 2G источники к <video> вообще не подключаются —
 * остаётся постер, вёрстка от этого не меняется.
 */
export function canLoadVideo() {
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection
  if (!connection) return true
  if (connection.saveData) return false
  return !['2g', 'slow-2g'].includes(connection.effectiveType)
}

/** '4:5' | '4/5' → подпись «4:5». */
function toLabelRatio(ratio) {
  return String(ratio).replace('/', ':').replace(/\s/g, '')
}

function fileNameOf(path) {
  return String(path).split('/').pop() || String(path)
}

/** Подпись заглушки: имя файла и пропорция. */
export function placeholderLabel(path, ratio) {
  return `${fileNameOf(path)} · ${toLabelRatio(ratio)}`
}

function markMissing(wrap, label) {
  if (wrap.classList.contains('is-missing')) return
  wrap.classList.add('is-missing')
  const note = document.createElement('span')
  note.className = 'media__note'
  note.textContent = label
  wrap.appendChild(note)
}

function createWrap({ ratio, className, round, fill }) {
  const wrap = document.createElement('div')
  wrap.className = ['media', round && 'media--round', fill && 'media--fill', className]
    .filter(Boolean)
    .join(' ')
  if (!fill) wrap.style.setProperty('--media-ratio', toCssRatio(ratio))
  return wrap
}

/** Есть ли файл по адресу. Нужна, чтобы проверить постер отдельно от ролика. */
function probeImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(false)
    const probe = new Image()
    probe.onload = () => resolve(true)
    probe.onerror = () => resolve(false)
    probe.src = src
  })
}

/* ---------------------------------------------------------------- картинка */

/**
 * @param {object}  o
 * @param {string}  o.src        путь от /public
 * @param {string}  o.alt        обязателен — попадает в alt
 * @param {string}  o.ratio      '4:5', '1:1', '16:9'…
 * @param {string} [o.className] дополнительный класс обёртки
 * @param {boolean}[o.round]     круглый кадр (мотив ободка банки)
 * @param {string} [o.loading]   'lazy' | 'eager'
 * @param {string} [o.position]  object-position
 * @returns {HTMLElement}
 */
export function createImage({
  src,
  alt = '',
  ratio = '1:1',
  className = '',
  round = false,
  fill = false,
  loading = 'lazy',
  position,
}) {
  const wrap = createWrap({ ratio, className, round, fill })
  if (position) wrap.style.setProperty('--media-position', position)

  const { width, height } = intrinsicSize(ratio)

  const img = document.createElement('img')
  img.src = src
  img.alt = alt
  img.width = width
  img.height = height
  img.loading = loading
  img.decoding = 'async'
  img.addEventListener('error', () => markMissing(wrap, placeholderLabel(src, ratio)), { once: true })

  wrap.appendChild(img)
  return wrap
}

/* ------------------------------------------------------------------- видео */

/**
 * Видео всегда с постером. Если ролика нет — остаётся постер.
 * Если нет ни ролика, ни постера — заглушка с именем файла и статичным затемнением.
 *
 * Ролик подключается только при нормальном соединении: на 2G и при включённом
 * Data Saver источники не добавляются вовсе, и пользователь видит постер.
 * Автоплей отдельно выключается при prefers-reduced-motion — там ролик может
 * быть загружен, но стоит на первом кадре.
 *
 * @param {object}   o
 * @param {Array<{src:string,type:string}>} o.sources
 * @param {string}   o.poster
 * @param {string}   o.ratio
 * @param {string}   o.alt
 * @returns {HTMLElement}
 */
export function createVideo({
  sources = [],
  poster = '',
  ratio = '16:9',
  alt = '',
  className = '',
  fill = false,
  autoplay = true,
}) {
  const wrap = createWrap({ ratio, className: ['media--video', className].filter(Boolean).join(' '), fill })

  const video = document.createElement('video')
  video.muted = true
  video.defaultMuted = true
  video.loop = true
  video.playsInline = true
  video.controls = false
  video.preload = 'metadata'
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  video.setAttribute('aria-label', alt)
  video.setAttribute('role', 'img')
  if (poster) video.poster = poster

  const primary = sources[0]?.src || 'video'
  let failed = 0

  const onAllSourcesFailed = async () => {
    const posterOk = await probeImage(poster)
    if (!posterOk) markMissing(wrap, placeholderLabel(primary, ratio))
  }

  // Плохое соединение или Data Saver — источники не подключаем совсем.
  // Тогда работает та же ветка, что и при пустом sources: остаётся постер.
  const allowSources = canLoadVideo()
  if (!allowSources) video.preload = 'none'

  if (sources.length === 0 || !allowSources) {
    onAllSourcesFailed()
  } else {
    sources.forEach(({ src, type }) => {
      const source = document.createElement('source')
      source.src = src
      if (type) source.type = type
      source.addEventListener(
        'error',
        () => {
          failed += 1
          if (failed >= sources.length) onAllSourcesFailed()
        },
        { once: true },
      )
      video.appendChild(source)
    })
  }

  wrap.appendChild(video)

  // При prefers-reduced-motion видео не автоплеится — остаётся постер.
  if (autoplay && !REDUCED && allowSources) {
    video.autoplay = true
    observePlayback(video)
  }

  return wrap
}

/** Играем только пока ролик в кадре — экономим батарею на мобильном. */
function observePlayback(video) {
  const play = () => video.play().catch(() => {})
  if (!('IntersectionObserver' in window)) return play()

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? play() : video.pause()))
    },
    { rootMargin: '10% 0px', threshold: 0.01 },
  )
  io.observe(video)
}

/* ------------------------------------------------- декларативная разметка */

/**
 * Поднимает элементы вида
 *   <div data-media="image" data-src="…" data-ratio="4:5" data-alt="…"></div>
 * в полноценные медиа-обёртки. Удобно для секций, собранных из шаблонных строк.
 */
export function hydrateMedia(root = document) {
  root.querySelectorAll('[data-media]').forEach((node) => {
    const kind = node.dataset.media
    const ratio = node.dataset.ratio || '1:1'
    const className = node.dataset.class || ''
    const fill = node.dataset.fill === 'true'

    const el =
      kind === 'video'
        ? createVideo({
            sources: JSON.parse(node.dataset.sources || '[]'),
            poster: node.dataset.poster || '',
            ratio,
            alt: node.dataset.alt || '',
            className,
            fill,
          })
        : createImage({
            src: node.dataset.src || '',
            alt: node.dataset.alt || '',
            ratio,
            className,
            fill,
            round: node.dataset.round === 'true',
            loading: node.dataset.loading || 'lazy',
          })

    node.replaceWith(el)
  })
}

/** Логотип: пробуем svg, при неудаче — текстовый вордмарк.
    href задаёт вызывающая сторона: на главной это якорь первого экрана,
    на внутренних страницах — корень. */
export function createLogo({ src, name, num, className = '', href = '/' }) {
  const link = document.createElement('a')
  link.className = className
  link.href = href
  link.setAttribute('aria-label', `${num} ${name} — на главную`)

  const wordmark = document.createElement('span')
  wordmark.className = 'wordmark'
  wordmark.innerHTML = `<span class="wordmark__num">${num}</span><span>${name}</span>`

  const img = document.createElement('img')
  img.src = src
  img.alt = `${num} ${name}`
  img.addEventListener(
    'error',
    () => {
      img.remove()
      link.appendChild(wordmark)
    },
    { once: true },
  )

  link.appendChild(img)
  return link
}
