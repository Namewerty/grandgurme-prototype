/* ============================================================================
   #hero на /alt2 — «Витрина разделов». ЧЕРНОВИК НА ВЫБРОС.

   Слева текст и список из шести разделов, справа кадр активного раздела.
   Кадры лежат стопкой, смена — перекрёстное растворение. Раздел выбирается
   наведением или фокусом; пока человек не тронул список, разделы сменяются
   сами каждые 5 с, и полоса под активной строкой — это их таймер.

   Раскладок две, граница — WIDE ниже и тот же запрос в stage.css:
     широкая — от 1024×600: текст в колонках 1–5, кадр от колонки 6
               до правого края окна на всю высоту секции;
     узкая   — всё остальное: кадр сверху во всю ширину, полоса времени
               из шести сегментов под ним, текст и список ниже.

   id="hero" сохранён намеренно: по нему шапка решает, когда стать плотной
   (watchHeaderState), а кольцо прогресса и виджет эксперта — когда
   появиться (watchBetweenHeroAndFooter). Классов .hero* в разметке нет —
   стили старого первого экрана на /alt2 не подключаются вовсе.

   ГРУЗИТСЯ ТОЛЬКО ПЕРВЫЙ КАДР. Остальные создаются при первом обращении
   (наведение, фокус, автосмена): <img> с loading="lazy" внутри видимой
   стопки загрузился бы сразу, поэтому элемента до обращения просто нет.
   Ролик «Рыбы» — так же: только при первом выборе строки.
   ============================================================================ */

import gsap from 'gsap'
import { stage } from '../data/stage.js'
import { video } from '../../data/media.js'
import { canLoadVideo, createImage, createVideo } from '../../js/media.js'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Те же условия, что в stage.css. */
const WIDE = '(min-width: 1024px) and (min-height: 600px)'
const FINE = '(hover: hover) and (pointer: fine)'

/** Период автосмены, с. */
const CYCLE = 5

/** Смещение кадра за курсором, px. */
const DRIFT_X = 12
const DRIFT_Y = 8

const pad = (n) => String(n).padStart(2, '0')

/* --------------------------------------------------------------- разметка */

export function buildStage(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section section--dark stage'
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const [first, second] = stage.titleLines

  section.innerHTML = `
    <div class="section__layer">
      <div class="stage__media" data-stage-media>
        <div class="stage__frames" data-stage-frames>
          ${stage.items
            .map((_, i) => `<div class="stage__frame${i === 0 ? ' is-active' : ''}" data-stage-frame="${i}"></div>`)
            .join('')}
        </div>
        <div class="stage__scrim" aria-hidden="true"></div>
      </div>

      <div class="container">
        <div class="stage__inner">
          <div class="stage__content">
            <div class="stage__bars" aria-hidden="true">
              ${stage.items.map(() => '<span class="stage__bar"><span class="stage__bar-fill"></span></span>').join('')}
            </div>

            <div class="stage__heading">
              <p class="eyebrow stage__eyebrow" data-stage-eyebrow>${stage.eyebrow}</p>
              <h1 id="${item.id}-title" class="stage__title">
                <span class="stage__line" data-stage-line>${first}</span><br>
                <span class="stage__line" data-stage-line>${second}</span>
              </h1>
              <p class="stage__lead" data-stage-fade>${stage.lead}</p>
            </div>

            <nav class="stage__nav" aria-label="${stage.listLabel}">
              <ol class="stage__list" data-stage-list>
                ${stage.items
                  .map(
                    (entry, i) => `
                  <li class="stage__item" data-stage-fade>
                    <a class="stage__row${i === 0 ? ' is-active' : ''}" href="${entry.href}" data-stage-row="${i}">
                      <span class="stage__num">${pad(i + 1)}</span>
                      <span class="stage__text">
                        <span class="stage__name">${entry.name}</span>
                        ${entry.meta ? `<span class="stage__meta">${entry.meta}</span>` : ''}
                      </span>
                      <span class="stage__arrow" aria-hidden="true">→</span>
                      <span class="stage__track" aria-hidden="true"></span>
                    </a>
                  </li>`,
                  )
                  .join('')}
              </ol>
            </nav>

            <a class="stage__all" href="${stage.all.href}" data-stage-fade>${stage.all.label} <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </div>
    </div>
  `

  // Запасные H1 — комментарием в разметке, как на основной главной.
  const title = section.querySelector('.stage__title')
  title.parentNode.insertBefore(
    document.createComment(` Альтернативные H1: «${stage.titleAlternatives.join('» / «')}» `),
    title,
  )

  // Первый кадр — сразу и без lazy: это первый экран.
  fillFrame(section.querySelector('[data-stage-frame="0"]'), stage.items[0], 'eager')

  return section
}

/* ------------------------------------------------------------------ кадры */

/**
 * Кадр раздела. Для «Рыбы» — ролик бренда, если можно тратить трафик
 * и движение не запрещено; иначе постер. Возвращает промис «кадр готов
 * к показу»: растворять ещё не пришедшую картинку бессмысленно — вместо
 * кадра проявилась бы пустота.
 */
function fillFrame(frame, entry, loading = 'lazy') {
  if (frame.dataset.filled) return Promise.resolve()
  frame.dataset.filled = '1'

  if (entry.video && !REDUCED && canLoadVideo()) {
    const wrap = createVideo({
      sources: video.hero.sources,
      poster: entry.image.src,
      ratio: '16:9',
      alt: entry.image.alt,
      fill: true,
      autoplay: false,
    })
    frame.appendChild(wrap)
    wireSegment(wrap.querySelector('video'), entry.video)
    // У ролика есть постер — он и закрывает кадр, пока грузится видео.
    return Promise.resolve()
  }

  const wrap = createImage({
    src: entry.image.src,
    alt: entry.image.alt,
    ratio: '4:5',
    fill: true,
    loading,
  })
  if (entry.zoom) wrap.style.setProperty('--stage-zoom', String(entry.zoom))
  frame.appendChild(wrap)

  const img = wrap.querySelector('img')
  if (!img || (img.complete && img.naturalWidth)) return Promise.resolve()
  return new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true })
    img.addEventListener('error', resolve, { once: true })
  })
}

/**
 * Ролик играет отрезок from–to по кругу: посол и копчение, без самых
 * светлых планов и без логотипа из финала.
 */
function wireSegment(videoEl, { from, to }) {
  if (!videoEl) return
  videoEl.loop = false
  videoEl.addEventListener('loadedmetadata', () => {
    if (videoEl.currentTime < from) videoEl.currentTime = from
  }, { once: true })
  videoEl.addEventListener('timeupdate', () => {
    if (videoEl.currentTime >= to || videoEl.currentTime < from - 0.25) videoEl.currentTime = from
  })
  // Страховка на случай, если отрезок упрётся в конец файла.
  videoEl.addEventListener('ended', () => {
    videoEl.currentTime = from
    videoEl.play().catch(() => {})
  })
}

/* ------------------------------------------------------------------- init */

export function initStage() {
  const section = document.querySelector('#hero.stage')
  if (!section) return

  const frames = [...section.querySelectorAll('[data-stage-frame]')]
  const rows = [...section.querySelectorAll('[data-stage-row]')]
  const tracks = rows.map((row) => row.querySelector('.stage__track'))
  const bars = [...section.querySelectorAll('.stage__bar-fill')]
  const list = section.querySelector('[data-stage-list]')
  const count = rows.length

  let active = 0
  let layer = 1

  /* ---- состояние автосмены -------------------------------------------- */

  let auto = !REDUCED
  let visible = true
  let overList = false
  let timer = null
  const progress = { p: 0 }

  if (!auto) section.classList.add('is-manual')

  const videoOf = (i) => frames[i].querySelector('video')

  /** Играет ли ролик: активна «Рыба» и секция на экране. */
  const syncVideo = () => {
    frames.forEach((frame, i) => {
      const el = videoOf(i)
      if (!el) return
      if (i === active && visible && !document.hidden) el.play().catch(() => {})
      else el.pause()
    })
  }

  /* Полоса времени: у строки — линия под активной, у узкой раскладки —
     шесть сегментов, прошлые заполнены, будущие пусты. */
  const paint = () => {
    const p = auto ? progress.p : 1
    tracks.forEach((track, i) => {
      if (!auto) track.style.transform = ''
      else track.style.transform = `scaleX(${i === active ? p : 0})`
    })
    bars.forEach((bar, i) => {
      const value = i < active ? 1 : i === active ? p : 0
      bar.style.transform = `scaleX(${value})`
    })
  }

  const syncTimer = () => {
    if (!timer) return
    if (auto && visible && !document.hidden && !overList) timer.resume()
    else timer.pause()
  }

  const startCycle = () => {
    timer?.kill()
    timer = null
    if (!auto) return
    progress.p = 0
    timer = gsap.to(progress, {
      p: 1,
      duration: CYCLE,
      ease: 'none',
      onUpdate: paint,
      onComplete: () => show((active + 1) % count),
    })
    syncTimer()
    paint()
  }

  const stopAuto = () => {
    if (!auto) return
    auto = false
    timer?.kill()
    timer = null
    section.classList.add('is-manual')
    paint()
  }

  /* ---- смена кадра ----------------------------------------------------- */

  const crossfade = (i) => {
    const frame = frames[i]
    frames.forEach((f, k) => f.classList.toggle('is-active', k === i))
    frame.style.zIndex = String(++layer)

    const hideOthers = () => {
      if (active !== i) return
      frames.forEach((f, k) => {
        if (k !== i) gsap.set(f, { opacity: 0 })
      })
    }

    if (REDUCED) {
      gsap.set(frame, { opacity: 1 })
      hideOthers()
      return
    }

    gsap.killTweensOf(frame)
    gsap.fromTo(frame, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.out', onComplete: hideOthers })
    gsap.fromTo(frame, { scale: 1.06 }, { scale: 1, duration: 6, ease: 'power2.out' })
  }

  function show(i) {
    if (i === active) {
      if (auto) startCycle()
      return
    }
    active = i

    rows.forEach((row, k) => row.classList.toggle('is-active', k === i))
    syncVideo()
    if (auto) startCycle()
    else paint()

    fillFrame(frames[i], stage.items[i]).then(() => {
      if (active !== i) return
      crossfade(i)
      syncVideo()
    })
  }

  /* ---- выбор строки ---------------------------------------------------- */

  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return
      stopAuto()
      show(i)
    })
    row.addEventListener('focus', () => {
      stopAuto()
      show(i)
    })
  })

  list.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return
    overList = true
    syncTimer()
  })
  list.addEventListener('pointerleave', () => {
    overList = false
    syncTimer()
  })

  /* ---- видимость секции и вкладки -------------------------------------- */

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        syncTimer()
        syncVideo()
      },
      { threshold: 0.15 },
    ).observe(section)
  }

  document.addEventListener('visibilitychange', () => {
    syncTimer()
    syncVideo()
  })

  /* ---- кадр за курсором ------------------------------------------------ */

  const media = section.querySelector('[data-stage-frames]')
  if (!REDUCED && media) {
    const mm = gsap.matchMedia()
    mm.add(`${WIDE} and ${FINE}`, () => {
      const xTo = gsap.quickTo(media, 'x', { duration: 0.8, ease: 'power3.out' })
      const yTo = gsap.quickTo(media, 'y', { duration: 0.8, ease: 'power3.out' })

      const onMove = (event) => {
        const box = section.getBoundingClientRect()
        const nx = ((event.clientX - box.left) / box.width) * 2 - 1
        const ny = ((event.clientY - box.top) / box.height) * 2 - 1
        xTo(Math.max(-1, Math.min(1, nx)) * DRIFT_X)
        yTo(Math.max(-1, Math.min(1, ny)) * DRIFT_Y)
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      section.addEventListener('pointermove', onMove)
      section.addEventListener('pointerleave', onLeave)
      return () => {
        section.removeEventListener('pointermove', onMove)
        section.removeEventListener('pointerleave', onLeave)
        gsap.set(media, { clearProps: 'x,y' })
      }
    })
  }

  /* ---- вторая строка под названием, если рядом не помещается ----------- */

  const fitRows = () => {
    rows.forEach((row) => {
      const meta = row.querySelector('.stage__meta')
      if (!meta) return
      row.classList.remove('is-stacked')
      if (!window.matchMedia(WIDE).matches) return
      const line = parseFloat(getComputedStyle(meta).lineHeight) || 16
      if (meta.offsetHeight > line * 1.5) row.classList.add('is-stacked')
    })
  }
  fitRows()
  let fitTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer)
    fitTimer = setTimeout(fitRows, 120)
  })
  document.fonts?.ready.then(fitRows)

  /* ---- вход ------------------------------------------------------------ */

  gsap.set(frames.slice(1), { opacity: 0 })
  paint()

  if (REDUCED) return

  const intro = playIntro(section)
  // Автосмена стартует, когда экран собран: иначе первый раздел сменился бы
  // раньше, чем человек дочитал заголовок.
  intro.eventCallback('onComplete', startCycle)
}

/**
 * Вход при загрузке: кадр проявляется, затем надзаголовок, строки H1
 * из-под маски, lead и список каскадом по 60 мс. Приём и поправка на обрезку
 * глифов маской — как в src/js/sections/hero.js (padding + отрицательный
 * margin у .stage__line, см. stage.css).
 */
function playIntro(section) {
  const media = section.querySelector('[data-stage-media]')
  const first = section.querySelector('[data-stage-frame="0"]')
  const eyebrow = section.querySelector('[data-stage-eyebrow]')
  const lines = section.querySelectorAll('[data-stage-line]')
  const fades = section.querySelectorAll('[data-stage-fade]')
  const bars = section.querySelector('.stage__bars')

  const tl = gsap.timeline({ delay: 0.1, defaults: { ease: 'power3.out' } })

  tl.fromTo(media, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0)

  tl.fromTo(
    eyebrow,
    { clipPath: 'inset(0% 100% 0% 0%)' },
    { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7 },
    0.6,
  )

  tl.fromTo(
    lines,
    { clipPath: 'inset(100% 0% 0% 0%)', yPercent: 8 },
    { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 0.9, stagger: 0.14 },
    0.7,
  )

  tl.fromTo(
    fades,
    { y: 16, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.6, stagger: 0.06 },
    1.1,
  )

  if (bars) tl.fromTo(bars, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 1.1)

  // Масштаб первого кадра идёт 6 с отдельным твином, вне таймлинии: иначе
  // её onComplete (старт автосмены) ждал бы его конца.
  gsap.fromTo(first, { scale: 1.06 }, { scale: 1, duration: 6, ease: 'power2.out', delay: 0.1 })

  return tl
}
