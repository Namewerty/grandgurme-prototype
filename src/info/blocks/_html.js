/* ============================================================================
   Общие кирпичи разметки блоков. ЧИСТЫЕ ФУНКЦИИ: данные на входе, строка
   на выходе. Ни document, ни window — эти функции работают и в браузере,
   и в node (scripts/info-snapshot.mjs), см. README → «Правило переносимости».
   ============================================================================ */

/** Экранирование для атрибутов и текста из данных. */
export const esc = (value) =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const isExternal = (href) => /^https?:\/\//.test(href)

/** Атрибуты внешней ссылки: новая вкладка без доступа к opener. */
export const ext = (href, external) =>
  external || isExternal(href) ? ' target="_blank" rel="noopener"' : ''

/**
 * Строка из данных с ссылками вида [текст](/адрес) → HTML. Остальное
 * экранируется: разметку в данных писать нельзя, только ссылки.
 */
export function inline(text) {
  if (text == null) return ''
  const out = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let match
  while ((match = re.exec(text))) {
    out.push(esc(text.slice(last, match.index)))
    const [, label, href] = match
    out.push(`<a class="ib-link" href="${esc(href)}"${ext(href)}>${esc(label)}</a>`)
    last = match.index + match[0].length
  }
  out.push(esc(text.slice(last)))
  return out.join('')
}

/** Текст без ссылочной разметки — для aria-label и поиска. */
export const plain = (text) => String(text ?? '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

/* ------------------------------------------------------------------ кадр */

/** '4:5' | '2000:1333' → «4 / 5» и числа. */
function ratioOf(ratio = '1:1') {
  const [w, h] = String(ratio).split(/[:/]/).map(Number)
  return w && h ? { w, h, css: `${w} / ${h}` } : { w: 1, h: 1, css: '1 / 1' }
}

/**
 * Кадр — та же разметка, что у createImage (src/js/media.js): обёртка
 * .media с пропорцией и <img> с width/height. createImage собирает узел
 * через document и в node не работает, поэтому здесь её строковый двойник.
 * Незагрузившийся кадр заменяет заглушкой init в src/info/boot.js
 * (тот же markMissing, что у createImage).
 *
 * defer — кадр без src: адрес лежит в data-src и подставляется, когда блок
 * подходит к экрану (лента подач, доска, стопки кадров). loading="lazy"
 * в первых двух экранах не спасает — порог Chrome 1250–2500px.
 */
export function image(media, { round = false, fill = false, className = '', loading = 'lazy', defer = false, ratio } = {}) {
  if (!media) return ''
  const r = ratioOf(ratio || media.ratio)
  const cls = ['media', round && 'media--round', fill && 'media--fill', className].filter(Boolean).join(' ')
  const style = fill ? '' : ` style="--media-ratio: ${r.css}"`
  const width = 1200
  const height = Math.round((width * r.h) / r.w)
  const src = defer ? `data-src="${esc(media.src)}"` : `src="${esc(media.src)}"`
  return (
    `<div class="${cls}"${style} data-ratio="${r.w}:${r.h}">` +
    `<img ${src} alt="${esc(media.alt)}" width="${width}" height="${height}" loading="${loading}" decoding="async">` +
    '</div>'
  )
}

/* -------------------------------------------------------------- секция */

/**
 * Обёртка блока: одна <section class="ib ib--<тип>" data-ib="<тип>"> без
 * обёрток вокруг. Классы section / section--dark — общий ритм и тёмная
 * семантика токенов (layout.css, tokens.css).
 *
 * reveal — появление при прокрутке, как на /alt2 (scroll.js → createReveals).
 */
export function section(type, d, inner, { reveal = true, cls = '', attrs = '', labelled = true } = {}) {
  const classes = ['section', 'ib', `ib--${type}`, d.dark && 'section--dark', cls].filter(Boolean).join(' ')
  const id = d.id ? ` id="${esc(d.id)}"` : ''
  const label = labelled && d.title && d.id ? ` aria-labelledby="${esc(d.id)}-title"` : ''
  return `<section class="${classes}"${id} data-ib="${type}"${reveal ? ' data-reveal-section' : ''}${label}${attrs}>${inner}</section>`
}

/** Надзаголовок, H2 и подводка блока. */
export function head(d, { cls = '', level = 2 } = {}) {
  if (!d.eyebrow && !d.title && !d.note) return ''
  const h = `h${level}`
  return `
    <div class="ib__head${cls ? ` ${cls}` : ''}">
      ${d.eyebrow ? `<p class="eyebrow" data-reveal>${esc(d.eyebrow)}</p>` : ''}
      ${d.title ? `<${h} class="ib__title" id="${esc(d.id)}-title" data-reveal>${esc(d.title)}</${h}>` : ''}
      ${d.note ? `<p class="ib__note" data-reveal>${inline(d.note)}</p>` : ''}
    </div>`
}

/** Абзацы. */
export const paras = (list = [], cls = 'ib__p') =>
  list.map((text) => `<p class="${cls}" data-reveal>${inline(text)}</p>`).join('')

/** Кнопка-ссылка: solid — залитая, line — контурная. На тёмном фоне те же
    классы: семантика токенов внутри .section--dark переворачивает цвета. */
export function button({ label, href, kind = 'line', external }, extra = '') {
  const cls = kind === 'solid' ? 'btn btn--solid' : 'btn'
  return `<a class="${cls} ib-btn" href="${esc(href)}"${ext(href, external)}${extra}>${esc(label)}</a>`
}

export const buttons = (list = []) =>
  list.length ? `<div class="ib__actions" data-reveal>${list.map((a) => button(a)).join('')}</div>` : ''

/** Ссылка со стрелкой — «Как добраться →», «Вся рыба в каталоге →». */
export function more(action, cls = 'ib-more') {
  if (!action) return ''
  const label = String(action.label).replace(/\s*→\s*$/, '')
  return `<a class="${cls}" href="${esc(action.href)}"${ext(action.href, action.external)}>${esc(label)} <span aria-hidden="true">→</span></a>`
}

/** Строки таблицы без null. */
export const present = (rows = []) => rows.filter((row) => row && row.value != null)

/** «{n} порций» → подстановка полей. */
export const fill = (template, values) =>
  String(template).replace(/\{(\w+)\}/g, (_, key) => (values[key] ?? `{${key}}`))
