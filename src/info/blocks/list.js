/* ============================================================================
   list — строки через волосяную линию, как разделы первого экрана /alt2:
   номер акцентом, название Prata, справа вторая строка. Наведение или фокус
   делает строку активной и показывает её кадр в круге справа (колонки 9–12,
   стопка кадров, растворение 500 мс). На узкой раскладке кадр — маленький
   круг 72px в начале строки.

   Строка с text раскрывается по нажатию, как в accordion (<details>:
   работает и без скрипта); href такой строки — ссылка внутри раскрытой
   части. Строка без text и с href — просто ссылка.
   ============================================================================ */

import { esc, head, image, inline, more, section } from './_html.js'
import { gsap, loadDeferred, reduced } from './_motion.js'

function row(item, i, d) {
  const thumb = `<span class="ib-list__thumb" aria-hidden="true">${image(item.media, { round: true, defer: true, ratio: '1:1' })}</span>`
  const head = `
    ${item.media ? thumb : ''}
    <span class="ib-list__num" aria-hidden="true">${esc(item.num)}</span>
    <span class="ib-list__title">${esc(item.title)}</span>
    ${item.note ? `<span class="ib-list__note">${esc(item.note)}</span>` : ''}`

  if (item.text) {
    return `
      <li class="ib-list__row" data-list-row="${i}" data-reveal>
        <details class="ib-list__details">
          <summary class="ib-list__summary">
            ${head}
            <span class="ib-list__sign" aria-hidden="true"></span>
          </summary>
          <div class="ib-list__body" data-acc-body>
            <div class="ib-list__body-inner">
              <p class="ib-list__text">${inline(item.text)}</p>
              ${item.href ? `<p class="ib-list__link">${more({ label: d.moreLabel, href: item.href })}</p>` : ''}
            </div>
          </div>
        </details>
      </li>`
  }

  const tag = item.href ? 'a' : 'div'
  return `
    <li class="ib-list__row" data-list-row="${i}" data-reveal>
      <${tag} class="ib-list__summary"${item.href ? ` href="${esc(item.href)}"` : ' tabindex="0"'}>
        ${head}
        ${item.href ? '<span class="ib-list__go" aria-hidden="true">→</span>' : ''}
      </${tag}>
    </li>`
}

export function buildList(d) {
  const withMedia = d.items.some((item) => item.media)
  const stack = withMedia
    ? `
      <div class="ib-list__aside" aria-hidden="true">
        <div class="ib-list__stack" data-list-stack>
          ${d.items
            .map(
              (item, i) => `<div class="ib-list__frame${i === 0 ? ' is-active' : ''}" data-list-frame="${i}">${image(item.media, {
                round: true,
                defer: true,
                ratio: '1:1',
              })}</div>`,
            )
            .join('')}
        </div>
      </div>`
    : ''

  return section('list', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-list__grid${withMedia ? ' has-media' : ''}">
        <ol class="ib-list__rows"${d.label && !d.title ? ` aria-label="${esc(d.label)}"` : ''}>
          ${d.items.map((item, i) => row(item, i, d)).join('')}
        </ol>
        ${stack}
      </div>
      ${d.more ? `<p class="ib-list__more" data-reveal>${more(d.more)}</p>` : ''}
    </div>`)
}

/* ------------------------------------------------------------------- init */

/** Плавное раскрытие <details>: высота за 350 мс. Общая для list и accordion. */
export function animateDetails(details, open) {
  const body = details.querySelector('[data-acc-body]')
  if (!body || reduced()) {
    details.open = open
    return
  }
  gsap.killTweensOf(body)
  if (open) {
    details.open = true
    const h = body.scrollHeight
    gsap.fromTo(body, { height: 0, opacity: 0 }, {
      height: h,
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
      onComplete: () => gsap.set(body, { clearProps: 'height,opacity' }),
    })
  } else {
    gsap.fromTo(body, { height: body.offsetHeight, opacity: 1 }, {
      height: 0,
      opacity: 0,
      duration: 0.35,
      ease: 'power2.inOut',
      onComplete: () => {
        details.open = false
        gsap.set(body, { clearProps: 'height,opacity' })
      },
    })
  }
}

/** Клик по summary — своя анимация вместо мгновенного переключения. */
export function wireDetails(details, onOpen) {
  const summary = details.querySelector('summary')
  summary.addEventListener('click', (event) => {
    event.preventDefault()
    const open = !details.open || details.dataset.closing === '1'
    details.dataset.closing = open ? '' : '1'
    if (open) onOpen?.(details)
    animateDetails(details, open)
    if (!open) setTimeout(() => (details.dataset.closing = ''), 360)
  })
}

export function initList(root) {
  const rows = [...root.querySelectorAll('[data-list-row]')]
  const frames = [...root.querySelectorAll('[data-list-frame]')]
  loadDeferred(root)

  let active = 0
  let layer = 1
  const setActive = (i) => {
    rows.forEach((r, k) => r.classList.toggle('is-active', k === i))
    if (i === active || !frames.length) return
    active = i
    const frame = frames[i]
    frames.forEach((f, k) => f.classList.toggle('is-active', k === i))
    frame.style.zIndex = String(++layer)
    // Прежний кадр гаснет, только когда новый проявился: иначе между
    // ними мелькает фон.
    const hideOthers = () => {
      if (active !== i) return
      frames.forEach((f, k) => {
        if (k !== i) gsap.set(f, { opacity: 0 })
      })
    }
    gsap.killTweensOf(frame)
    if (reduced()) {
      gsap.set(frame, { opacity: 1 })
      hideOthers()
      return
    }
    gsap.fromTo(frame, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', onComplete: hideOthers })
  }
  gsap.set(frames.slice(1), { opacity: 0 })
  rows[0]?.classList.add('is-active')

  rows.forEach((row, i) => {
    const target = row.querySelector('.ib-list__summary')
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') setActive(i)
    })
    target?.addEventListener('focus', () => setActive(i))
    const details = row.querySelector('details')
    if (details) {
      wireDetails(details, () => setActive(i))
    }
  })
}
