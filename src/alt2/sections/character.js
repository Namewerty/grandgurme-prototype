/* ============================================================================
   #character на /alt2 — «Характер икры». ЧЕРНОВИК НА ВЫБРОС.

   Переделанный блок видов. У каждой из девяти линеек один и тот же набор
   признаков — паспорт, и их можно сравнить. Два инструмента сверху:
     — ЛУПА: большой круг с зерном вида, линза 180px следует за курсором
       (на тач-устройствах — за пальцем) и показывает зерно в 2,4 раза крупнее;
     — ЛИНЕЙКА ЗЕРНА: все линейки кругами на одной оси, диаметр круга —
       зерно в увеличении, в масштабе друг к другу.
   Ниже — шкала возраста рыбы у линеек, где он известен.

   Выбор линейки хранится в адресе (?line=<слаг>, replaceState) и рассылается
   событием gg:line-change на document — его слушает крышка банки в #origin.

   Данные — src/data/caviar-lines.js, тексты шапки — src/alt2/data/copy.js.
   ============================================================================ */

import gsap from 'gsap'
import {
  caviarLines,
  caviarMethod,
  caviarSpecies,
  findLine,
  findSpecies,
  linesOfSpecies,
  packsLabel,
} from '../../data/caviar-lines.js'
import { ROUTES } from '../../data/routes.js'
import { characterCopy as copy } from '../data/copy.js'
import { createImage } from '../../js/media.js'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)')

const DEFAULT_LINE = 'beluga-royal'

/** Увеличение и диаметр линзы. */
const ZOOM = 2.4
const LENS = 180

/* Ось линейки зерна, мм. У «от 4 мм» центр круга — 4,15, диаметр
   считается от 4,2. */
const AXIS = { min: 2.4, max: 4.3 }
const TICKS = [2.5, 3, 3.5, 4]
const OPEN_CENTER = 4.15
const OPEN_SIZE = 4.2
const STACK_GAP = 6

/* Ось возраста, лет. */
const AGE_MAX = 30
const AGE_TICKS = [0, 10, 18, 24, 30]

const mm = (value) => String(value).replace('.', ',')
const pct = (value) => `${(((value - AXIS.min) / (AXIS.max - AXIS.min)) * 100).toFixed(3)}%`

/** Центр и «диаметр» круга линейки на оси. Паюсной на оси нет. */
function grainPoint(line) {
  const { min, max } = line.grain
  if (min === null) return null
  if (max === null) return { center: OPEN_CENTER, size: OPEN_SIZE, from: min, to: AXIS.max }
  return { center: (min + max) / 2, size: max, from: min, to: max }
}

/** Строки паспорта: пустые значения не выводятся. */
function passportRows(line) {
  const p = copy.passport
  return [
    [p.grain, line.grain.label],
    [p.color, line.color],
    [p.texture, line.texture],
    [p.taste, line.taste],
    [p.age, line.age?.label],
    [p.packs, line.packs.length ? packsLabel(line) : null],
    [p.method, caviarMethod],
  ].filter(([, value]) => value)
}

const actionHref = (line) =>
  `${ROUTES.category('chernaya-ikra')}?${new URLSearchParams({ grade: line.grade })}`

function passportHTML(line) {
  return `
    <h3 class="character__name">${line.name}</h3>
    <p class="character__lead">${line.lead}</p>
    <dl class="character__facts">
      ${passportRows(line)
        .map(
          ([label, value]) => `
        <div class="character__fact">
          <dt>${label}</dt>
          <dd>${value}</dd>
        </div>`,
        )
        .join('')}
    </dl>
    <a class="btn btn--solid character__action" href="${actionHref(line)}">${copy.action}</a>
  `
}

/* --------------------------------------------------------------- разметка */

export function buildCharacter(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section character'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const id = item.id

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="character__head">
          <p class="eyebrow" data-reveal>${copy.eyebrow}</p>
          <h2 id="${id}-title" class="character__title" data-reveal>${copy.title}</h2>
          <p class="character__note" data-reveal>${copy.note}</p>
        </div>

        <div class="character__picker" data-reveal>
          <div class="character__tabs" role="tablist" aria-label="${copy.tabsLabel}" data-tabs>
            ${caviarSpecies
              .map(
                (species) => `
              <button type="button" class="character__tab" role="tab" id="${id}-tab-${species.key}"
                      aria-controls="${id}-panel" aria-selected="false" tabindex="-1"
                      data-species="${species.key}">${species.tab}</button>`,
              )
              .join('')}
          </div>
          <div class="character__lines" role="group" aria-label="${copy.linesLabel}" data-lines></div>
          <p class="character__species" data-species-caption></p>
        </div>

        <div class="character__body" id="${id}-panel" role="tabpanel" data-panel>
          <div class="character__visual">
            <div class="character__stage" data-stage>
              <div class="character__disc" data-disc></div>
              <div class="character__tin" data-tin aria-hidden="true"></div>
              <div class="character__lens" data-lens aria-hidden="true"></div>
            </div>
            <p class="character__hint" data-hint></p>
          </div>

          <div class="character__passport" data-passport>
            <div class="character__passport-inner" data-passport-inner aria-live="polite"></div>
          </div>
        </div>

        <div class="character__scale">
          <p class="character__scale-title" id="${id}-ruler-title">${copy.ruler}</p>
          <div class="character__ruler-scroll">
            <div class="character__ruler" role="group" aria-labelledby="${id}-ruler-title" data-ruler>
              <div class="character__ruler-plot" data-ruler-plot></div>
              <div class="character__axis" aria-hidden="true">
                ${TICKS.map((t) => `<span class="character__tick" style="left:${pct(t)}"><span>${mm(t)}</span></span>`).join('')}
                <span class="character__tick character__tick--end" style="left:100%"><span>4+</span></span>
              </div>
              <p class="character__ruler-name" data-ruler-name aria-hidden="true"></p>
              <p class="character__tip" data-ruler-tip aria-hidden="true"></p>
            </div>
          </div>
          <p class="character__scale-note">${copy.rulerNote}</p>
        </div>

        <div class="character__age" data-age>
          <p class="character__scale-title">${copy.age}</p>
          <div class="character__age-plot">
            <div class="character__age-axis" aria-hidden="true">
              ${AGE_TICKS.map((t) => `<span class="character__tick" style="left:${(t / AGE_MAX) * 100}%"><span>${t}</span></span>`).join('')}
            </div>
            <span class="character__age-line" data-age-line aria-hidden="true"></span>
            <p class="character__age-value" data-age-value>
              <span class="character__age-num" data-age-num></span>
              <span class="character__age-label" data-age-label></span>
            </p>
          </div>
        </div>

        <p class="character__more">
          <a class="character__more-link" href="${copy.more.href}">${copy.more.label}</a>
        </p>
      </div>
    </div>
  `

  // Запасные заголовки — комментарием в разметке.
  const title = section.querySelector('.character__title')
  title.parentNode.insertBefore(
    document.createComment(' Запасные заголовки: «Девять линеек — девять характеров» / «Икра по характеру» '),
    title,
  )

  buildRuler(section)
  return section
}

/** Круги линеек на оси. Круги одного центра встают столбиком. */
function buildRuler(section) {
  const plot = section.querySelector('[data-ruler-plot]')
  const stacks = new Map()

  caviarLines.forEach((line) => {
    const point = grainPoint(line)
    if (!point) return

    const key = point.center.toFixed(3)
    const below = stacks.get(key) || { mm: 0, n: 0 }

    const range = document.createElement('span')
    range.className = 'character__range'
    range.setAttribute('aria-hidden', 'true')
    range.style.left = pct(point.from)
    range.style.width = `calc(${pct(point.to)} - ${pct(point.from)})`
    plot.appendChild(range)

    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'character__dot'
    dot.dataset.line = line.slug
    dot.setAttribute('aria-label', `${line.name}, зерно ${line.grain.label}`)
    dot.setAttribute('aria-pressed', 'false')
    dot.style.left = pct(point.center)
    dot.style.setProperty('--size', String(point.size))
    dot.style.setProperty('--below-mm', String(below.mm))
    dot.style.setProperty('--below-n', String(below.n))
    plot.appendChild(dot)

    stacks.set(key, { mm: below.mm + point.size, n: below.n + 1 })
  })

  // Высота поля — по самому высокому столбику: сумма диаметров в мм
  // (множитель px/мм — в CSS, свой для широкой и узкой раскладки) плюс
  // зазоры между кругами.
  const tallest = [...stacks.values()].reduce(
    (best, s) => (s.mm + s.n * 0.001 > best.mm + best.n * 0.001 ? s : best),
    { mm: 0, n: 0 },
  )
  plot.style.setProperty('--stack-mm', String(tallest.mm))
  plot.style.setProperty('--stack-gaps', String(Math.max(0, tallest.n - 1)))
  plot.style.setProperty('--stack-gap', `${STACK_GAP}px`)
}

/* ------------------------------------------------------------------- init */

export function initCharacter() {
  const section = document.querySelector('#character')
  if (!section) return

  const tabs = [...section.querySelectorAll('[role="tab"]')]
  const linesBox = section.querySelector('[data-lines]')
  const caption = section.querySelector('[data-species-caption]')
  const panel = section.querySelector('[data-panel]')
  const stageEl = section.querySelector('[data-stage]')
  const disc = section.querySelector('[data-disc]')
  const tinBox = section.querySelector('[data-tin]')
  const lens = section.querySelector('[data-lens]')
  const hint = section.querySelector('[data-hint]')
  const passport = section.querySelector('[data-passport]')
  const passportInner = section.querySelector('[data-passport-inner]')
  const dots = [...section.querySelectorAll('.character__dot')]
  const rulerName = section.querySelector('[data-ruler-name]')
  const tip = section.querySelector('[data-ruler-tip]')
  const ruler = section.querySelector('[data-ruler]')
  const ageBox = section.querySelector('[data-age]')
  const ageLine = section.querySelector('[data-age-line]')
  const ageValue = section.querySelector('[data-age-value]')
  const ageNum = section.querySelector('[data-age-num]')
  const ageLabel = section.querySelector('[data-age-label]')

  let current = null

  /* ---- слои большого круга и банки: создаются по первому обращению ------ */

  const discLayers = new Map() // ключ вида или 'tin:<слаг>' для паюсной
  const tinLayers = new Map()

  /* КАРТИНКИ — ТОЛЬКО ПОСЛЕ LOAD. Блок стоит сразу под первым экраном,
     в пределах порога ленивой загрузки Chrome (1250–2500px), и loading="lazy"
     не мешал кадру вида (350 КБ) идти вместе с первым экраном. Поэтому слой
     создаётся сразу, а <img> в него кладётся после load — или раньше, если
     человек успел долистать до блока. */
  let imagesAllowed = document.readyState === 'complete'
  const fillLayer = (layer) => {
    if (!imagesAllowed || layer.dataset.filled) return
    layer.dataset.filled = '1'
    const { src, alt } = layer._source
    layer.appendChild(createImage({ src, alt, ratio: '1:1', round: true, loading: 'eager' }))
  }
  const allowImages = () => {
    if (imagesAllowed) return
    imagesAllowed = true
    discLayers.forEach(fillLayer)
    tinLayers.forEach(fillLayer)
  }

  /** Ключ слоя большого круга. У паюсной — пэкшот банки, а не кадр вида. */
  const discKeyOf = (line) => (line.grain.min === null ? `tin:${line.slug}` : line.species)

  const discSource = (line) => {
    if (line.grain.min === null) return { src: line.tin, alt: line.name, tin: true }
    const species = findSpecies(line.species)
    return { src: species.detail, alt: species.alt, tin: false }
  }

  function discLayer(key, source) {
    if (discLayers.has(key)) return discLayers.get(key)
    const layer = document.createElement('div')
    layer.className = `character__layer${source.tin ? ' character__layer--tin' : ''}`
    layer.dataset.src = source.src
    layer._source = source
    fillLayer(layer)
    gsap.set(layer, { opacity: 0 })
    disc.appendChild(layer)
    discLayers.set(key, layer)
    return layer
  }

  function tinLayer(line) {
    if (tinLayers.has(line.slug)) return tinLayers.get(line.slug)
    const layer = document.createElement('div')
    layer.className = 'character__tin-layer'
    layer._source = { src: line.tin, alt: '' }
    fillLayer(layer)
    gsap.set(layer, { opacity: 0 })
    tinBox.appendChild(layer)
    tinLayers.set(line.slug, layer)
    return layer
  }

  let discKey = null
  let activeDisc = null

  function showDisc(line) {
    const key = discKeyOf(line)
    if (key === discKey) return
    const first = discKey === null
    discKey = key
    const layer = discLayer(key, discSource(line))
    activeDisc = layer
    stageEl.classList.toggle('is-tin', line.grain.min === null)

    discLayers.forEach((other) => {
      if (other === layer) return
      if (REDUCED || first) gsap.set(other, { opacity: 0 })
      else gsap.to(other, { opacity: 0, duration: 0.6, ease: 'power2.out' })
    })
    if (REDUCED || first) {
      gsap.set(layer, { opacity: 1, scale: 1 })
    } else {
      gsap.fromTo(layer, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power2.out' })
    }
  }

  let tinSlug = null
  function showTin(line) {
    const hasTin = line.grain.min !== null
    tinBox.hidden = !hasTin
    if (!hasTin || tinSlug === line.slug) return
    const first = tinSlug === null
    tinSlug = line.slug
    const layer = tinLayer(line)
    tinLayers.forEach((other) => {
      if (other === layer) return
      if (REDUCED || first) gsap.set(other, { opacity: 0 })
      else gsap.to(other, { opacity: 0, duration: 0.3, ease: 'power2.out' })
    })
    if (REDUCED || first) gsap.set(layer, { opacity: 1 })
    else gsap.to(layer, { opacity: 1, duration: 0.3, ease: 'power2.out' })
  }

  /* ---- вкладки видов и строка линеек ----------------------------------- */

  function renderLines(line) {
    const lines = linesOfSpecies(line.species)
    linesBox.innerHTML = lines
      .map(
        (item, i) =>
          `${i ? '<span class="character__sep" aria-hidden="true">·</span>' : ''}` +
          `<button type="button" class="character__line" data-line="${item.slug}" aria-pressed="${item.slug === line.slug}"` +
          ` aria-label="${item.name}">${item.short}</button>`,
      )
      .join('')
    caption.textContent = findSpecies(line.species)?.caption || ''
  }

  function syncTabs(line) {
    tabs.forEach((tab) => {
      const on = tab.dataset.species === line.species
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      if (on) panel.setAttribute('aria-labelledby', tab.id)
    })
  }

  /* ---- паспорт ---------------------------------------------------------- */

  let passportTl = null
  function showPassport(line, first) {
    passportTl?.kill()
    if (first || REDUCED) {
      passportInner.innerHTML = passportHTML(line)
      gsap.set(passportInner, { clearProps: 'opacity,transform' })
      return
    }
    passportTl = gsap
      .timeline()
      .to(passportInner, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.in' })
      .add(() => {
        passportInner.innerHTML = passportHTML(line)
      })
      .fromTo(passportInner, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: 'power2.out' })
  }

  /** Высота паспорта — по самой длинной линейке, чтобы блок не прыгал. */
  function measurePassport() {
    const probe = document.createElement('div')
    probe.className = 'character__passport-inner character__passport-probe'
    probe.style.width = `${passportInner.clientWidth}px`
    passport.appendChild(probe)
    let tallest = 0
    caviarLines.forEach((line) => {
      probe.innerHTML = passportHTML(line)
      tallest = Math.max(tallest, probe.offsetHeight)
    })
    probe.remove()
    passport.style.minHeight = `${Math.ceil(tallest)}px`
  }

  /* ---- линейка зерна --------------------------------------------------- */

  /** Подпись под осью / над кругом: центр по x, но не за краями линейки. */
  function placeLabel(el, dot, above) {
    const box = ruler.getBoundingClientRect()
    const d = dot.getBoundingClientRect()
    const center = d.left + d.width / 2 - box.left
    el.style.left = '0px'
    const w = el.offsetWidth
    const left = Math.max(0, Math.min(box.width - w, center - w / 2))
    el.style.left = `${left}px`
    if (above) {
      // Подпись встаёт над верхним кругом своего столбика.
      const top = Math.min(
        ...dots
          .filter((other) => other.style.left === dot.style.left)
          .map((other) => other.getBoundingClientRect().top),
      )
      el.style.top = `${top - box.top - el.offsetHeight - 6}px`
    }
  }

  function syncRuler(line) {
    let activeDot = null
    dots.forEach((dot) => {
      const on = dot.dataset.line === line.slug
      dot.classList.toggle('is-active', on)
      dot.setAttribute('aria-pressed', String(on))
      if (on) activeDot = dot
    })
    rulerName.textContent = activeDot ? line.name : ''
    rulerName.hidden = !activeDot
    if (activeDot) placeLabel(rulerName, activeDot, false)
  }

  dots.forEach((dot) => {
    const line = findLine(dot.dataset.line)
    const showTip = () => {
      tip.textContent = `${line.name} · ${line.grain.label}`
      tip.classList.add('is-visible')
      placeLabel(tip, dot, true)
    }
    const hideTip = () => tip.classList.remove('is-visible')
    dot.addEventListener('pointerenter', showTip)
    dot.addEventListener('pointerleave', hideTip)
    dot.addEventListener('focus', showTip)
    dot.addEventListener('blur', hideTip)
    dot.addEventListener('click', () => select(line.slug))
  })

  /* ---- шкала возраста --------------------------------------------------- */

  /** Число стоит над концом золотой линии, подпись — справа от него;
      у правого края вся пара сдвигается влево, чтобы не выйти за шкалу. */
  function placeAge(share) {
    const width = ageValue.parentElement.clientWidth
    const numWidth = ageNum.offsetWidth
    const wanted = share * width - numWidth / 2
    const left = Math.max(0, Math.min(width - ageValue.offsetWidth, wanted))
    ageValue.style.left = `${left}px`
  }

  function syncAge(line, first) {
    const age = line.age
    ageBox.classList.toggle('is-empty', !age)
    if (!age) {
      gsap.killTweensOf(ageLine)
      gsap.set(ageLine, { scaleX: 0 })
      return
    }
    const share = Math.min(1, age.years / AGE_MAX)
    ageNum.textContent = String(age.years)
    ageLabel.textContent = age.label
    ageLine.style.width = `${share * 100}%`
    placeAge(share)

    gsap.killTweensOf(ageLine)
    if (REDUCED) gsap.set(ageLine, { scaleX: 1 })
    else gsap.fromTo(ageLine, { scaleX: 0 }, { scaleX: 1, duration: first ? 0 : 0.8, ease: 'power2.out' })
  }

  /* ---- выбор линейки ---------------------------------------------------- */

  function select(slug, { first = false, focusLine = false } = {}) {
    const line = findLine(slug) || findLine(DEFAULT_LINE)
    if (current && line.slug === current.slug) return
    const speciesChanged = !current || current.species !== line.species
    current = line

    syncTabs(line)
    if (speciesChanged) renderLines(line)
    else {
      linesBox.querySelectorAll('[data-line]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.line === line.slug))
      })
    }
    if (focusLine) linesBox.querySelector(`[data-line="${line.slug}"]`)?.focus()

    showDisc(line)
    showTin(line)
    showPassport(line, first)
    syncRuler(line)
    syncAge(line, first)

    if (!first) {
      const url = new URL(location.href)
      url.searchParams.set('line', line.slug)
      history.replaceState(history.state, '', url)
    }

    const detail = { slug: line.slug, species: line.species, cites: line.cites, name: line.name }
    const announce = () => document.dispatchEvent(new CustomEvent('gg:line-change', { detail }))
    // При загрузке — после того, как #origin повесит слушателя (initOrigin
    // идёт следом в том же тике).
    if (first) queueMicrotask(announce)
    else announce()
  }

  linesBox.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-line]')
    if (btn) select(btn.dataset.line)
  })

  /* Вкладки: стрелки влево и вправо переводят фокус и выбор, Home/End —
     на крайние. Смена вида выбирает его первую линейку. */
  const selectSpecies = (key, focus) => {
    const first = linesOfSpecies(key)[0]
    if (!first) return
    select(first.slug)
    if (focus) tabs.find((tab) => tab.dataset.species === key)?.focus()
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      if (current?.species !== tab.dataset.species) selectSpecies(tab.dataset.species, false)
    })
    tab.addEventListener('keydown', (event) => {
      let next = null
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = tabs.length - 1
      if (next === null) return
      event.preventDefault()
      selectSpecies(tabs[next].dataset.species, true)
    })
  })

  /* ---- лупа ------------------------------------------------------------- */

  wireLens({ stageEl, disc, lens, getLayer: () => activeDisc })

  const setHint = () => {
    hint.textContent = FINE.matches ? copy.hintLens : copy.hintTouch
  }
  setHint()
  FINE.addEventListener?.('change', setHint)

  /* ---- старт ------------------------------------------------------------ */

  const fromUrl = new URLSearchParams(location.search).get('line')
  select(findLine(fromUrl) ? fromUrl : DEFAULT_LINE, { first: true })

  /** Подпись вида занимает одну или две строки — место держим по самой
      длинной, иначе блок прыгал бы при смене вкладки. */
  function measureCaption() {
    caption.style.minHeight = ''
    const shown = caption.textContent
    let tallest = 0
    caviarSpecies.forEach((species) => {
      caption.textContent = species.caption
      tallest = Math.max(tallest, caption.offsetHeight)
    })
    caption.textContent = shown
    caption.style.minHeight = `${tallest}px`
  }

  /* Всё, что зависит от ширины и шрифтов: высота паспорта и подписи вида,
     подпись под активным кругом, положение числа на шкале возраста. */
  const relayout = () => {
    measurePassport()
    measureCaption()
    if (!current) return
    syncRuler(current)
    if (current.age) placeAge(Math.min(1, current.age.years / AGE_MAX))
  }

  relayout()
  let resizeTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(relayout, 150)
  })
  document.fonts?.ready.then(relayout)

  // Кадры лупы всех четырёх видов — после load, чтобы смена вида не мигала.
  const preload = () => {
    allowImages()
    caviarSpecies.forEach((species) => discLayer(species.key, { src: species.detail, alt: species.alt, tin: false }))
    const payusnaya = caviarLines.find((line) => line.grain.min === null)
    if (payusnaya) discLayer(`tin:${payusnaya.slug}`, discSource(payusnaya))
  }
  if (document.readyState === 'complete') preload()
  else window.addEventListener('load', preload, { once: true })

  // Долистали до блока раньше load (медленная сеть) — кадры нужны сейчас.
  if ('IntersectionObserver' in window && !imagesAllowed) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      io.disconnect()
      allowImages()
    }, { rootMargin: '300px 0px' })
    io.observe(stageEl)
  }
}

/* ------------------------------------------------------------------ лупа */

/**
 * Линза над большим кругом. Мышь — при (hover: hover) and (pointer: fine):
 * курсор над кругом скрыт, линза ходит за ним. Касание — линза появляется
 * под пальцем и ведётся им; прокрутка страницы блокируется только пока палец
 * на круге (touch-action: none на круге в CSS). Центр линзы не выходит
 * за окружность большого круга.
 */
function wireLens({ stageEl, disc, lens, getLayer }) {
  let shown = false
  let pointerId = null

  const show = () => {
    if (shown) return
    shown = true
    const layer = getLayer()
    const src = layer?.dataset.src
    if (!src) return
    lens.style.backgroundImage = `url("${src}")`
    lens.classList.toggle('is-tin', layer.classList.contains('character__layer--tin'))
    lens.classList.add('is-visible')
  }

  const hide = () => {
    shown = false
    lens.classList.remove('is-visible')
  }

  const move = (event) => {
    const box = disc.getBoundingClientRect()
    const r = box.width / 2
    let dx = event.clientX - (box.left + r)
    let dy = event.clientY - (box.top + r)
    const dist = Math.hypot(dx, dy)
    if (dist > r) {
      dx = (dx / dist) * r
      dy = (dy / dist) * r
    }
    const px = r + dx
    const py = r + dy
    const size = box.width * ZOOM
    lens.style.transform = `translate(${px - LENS / 2}px, ${py - LENS / 2}px)`
    lens.style.backgroundSize = `${size}px ${size}px`
    lens.style.backgroundPosition = `${LENS / 2 - px * ZOOM}px ${LENS / 2 - py * ZOOM}px`
  }

  disc.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || !FINE.matches) return
    stageEl.classList.add('is-lens')
    show()
    move(event)
  })
  disc.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && !FINE.matches) return
    if (event.pointerType !== 'mouse' && event.pointerId !== pointerId) return
    if (!shown) show()
    move(event)
  })
  disc.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return
    stageEl.classList.remove('is-lens')
    hide()
  })

  disc.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return
    pointerId = event.pointerId
    disc.setPointerCapture?.(event.pointerId)
    stageEl.classList.add('is-lens')
    show()
    move(event)
  })
  const release = (event) => {
    if (event.pointerId !== pointerId) return
    pointerId = null
    stageEl.classList.remove('is-lens')
    hide()
  }
  disc.addEventListener('pointerup', release)
  disc.addEventListener('pointercancel', release)
}
