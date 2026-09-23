/* ============================================================================
   #origin на /alt2 — «Происхождение». ЧЕРНОВИК НА ВЫБРОС.

   Две истории — икры №1 Caviar и рыбы Siberian Luxury Bar — вкладками.
   У каждой шаги от воды до упаковки. Шаги «Забойный способ» и «Код на банке» —
   ядро блока: разницу между икрой они объясняют фактами о нашей икре
   и о способах производства вообще, никого не называя.

   РАСКЛАДКИ.
     широкая (от 1024px) — шаги слева, каждый не ниже 70vh; справа липкий
       кадр 4:5 со стопкой кадров всех шагов истории. Активен шаг, который
       пересёк середину экрана (start 'top center', end 'bottom center');
     узкая — у каждого шага свой кадр над текстом, липкого кадра нет.
   Кадр шага — один DOM-узел на обе раскладки: при смене раскладки он
   переезжает между местом в шаге и стопкой липкого кадра. Так картинка
   грузится один раз, а виджет поверх кадра не дублируется.

   ВИДЖЕТЫ (ключ widget у шага в src/data/origin.js):
     years  — число 0 → 30 за 1,6 с, один раз, когда шаг входит в середину;
     shell  — зерно в разрезе: забойная / прижизненная, radiogroup;
     radius — окружность из центра до края кадра за 1,4 с, один раз;
     cites  — крышка банки с кодом СИТЕС вместо кадра. Первая группа кода —
              вид рыбы линейки, выбранной в #character (событие gg:line-change).
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { origin, originOrder, originWidgets } from '../../data/origin.js'
import { findLine } from '../../data/caviar-lines.js'
import { originCopy as copy } from '../data/copy.js'
import { createImage } from '../../js/media.js'
import { getLenis } from '../../js/scroll.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const WIDE = window.matchMedia('(min-width: 1024px)')

/* --------------------------------------------------------------- виджеты */

function yearsHTML() {
  const w = originWidgets.years
  return `
    <div class="origin-years" aria-hidden="true">
      <span class="origin-years__num" data-years-num>${REDUCED ? w.value : 0}</span>
      <span class="origin-years__cap">${w.caption}</span>
    </div>`
}

function radiusHTML() {
  return `
    <div class="origin-radius${REDUCED ? ' is-done' : ''}" aria-hidden="true">
      <span class="origin-radius__ring" data-radius-ring></span>
      <span class="origin-radius__label">${originWidgets.radius.value}</span>
    </div>`
}

/* Зерно в разрезе. Схема, без масштаба: сердцевина, оболочка кольцом и блик.
   У забойной оболочка тонкая (1,5px), блик мягкий и большой; у прижизненной
   оболочка плотная (5px), блик маленький и резкий. */
function shellHTML(uid) {
  const w = originWidgets.shell
  return `
    <div class="origin-shell" data-shell data-state="${w.options[0].key}">
      <svg class="origin-shell__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <filter id="${uid}-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2"></feGaussianBlur>
          </filter>
        </defs>
        <circle class="origin-shell__core" cx="50" cy="50" r="36"></circle>
        <circle class="origin-shell__skin" cx="50" cy="50" r="36"></circle>
        <ellipse class="origin-shell__glint origin-shell__glint--soft" cx="39" cy="37" rx="15" ry="10"
                 filter="url(#${uid}-soft)"></ellipse>
        <ellipse class="origin-shell__glint origin-shell__glint--sharp" cx="38" cy="36" rx="4.5" ry="3"></ellipse>
      </svg>
      <div class="origin-shell__switch" role="radiogroup" aria-label="${w.label}">
        ${w.options
          .map(
            ({ key, label }, i) => `
          <button type="button" class="origin-shell__opt" role="radio" data-shell-opt="${key}"
                  aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}</button>`,
          )
          .join('')}
      </div>
      <p class="origin-shell__note">${w.note}</p>
    </div>`
}

function citesHTML(uid) {
  const w = originWidgets.cites
  const groups = w.groups
    .map((group, i) => {
      const value = group.value ?? w.defaultSpecies
      return `${i ? '<span class="origin-cites__sep" aria-hidden="true">/</span>' : ''}<button type="button"
        class="origin-cites__group${group.key === w.initial ? ' is-active' : ''}" data-group="${group.key}"
        aria-describedby="${uid}-explain"><span data-group-value>${value}</span></button>`
    })
    .join('')

  return `
    <div class="origin-cites" data-cites>
      <div class="origin-cites__lid">
        <svg class="origin-cites__arc" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <path id="${uid}-arc" d="M 40 100 A 60 60 0 0 1 160 100" fill="none"></path>
          <text><textPath href="#${uid}-arc" startOffset="50%" text-anchor="middle">${w.arc}</textPath></text>
        </svg>
        <div class="origin-cites__code" role="group" aria-label="${w.label}">${groups}</div>
        <p class="origin-cites__note">${w.note}</p>
      </div>
      <p class="origin-cites__explain" id="${uid}-explain" aria-live="polite" data-cites-explain></p>
    </div>`
}

/* --------------------------------------------------------------- разметка */

function buildMedia(step, storyKey, index) {
  const media = document.createElement('div')
  media.className = `origin__media${step.widget === 'cites' ? ' origin__media--cites' : ''}`
  media.dataset.originMedia = String(index)

  if (step.media) {
    const wrap = createImage({
      src: step.media.src,
      alt: step.media.alt,
      ratio: step.media.ratio || '4:5',
      className: 'origin__photo',
    })
    media.appendChild(wrap)
  }

  const uid = `origin-${storyKey}-${index}`
  const widget =
    step.widget === 'years' ? yearsHTML()
    : step.widget === 'radius' ? radiusHTML()
    : step.widget === 'shell' ? shellHTML(uid)
    : step.widget === 'cites' ? citesHTML(uid)
    : ''
  if (widget) media.insertAdjacentHTML('beforeend', widget)
  return media
}

function buildStory(key, story, id, active) {
  const panel = document.createElement('div')
  panel.className = 'origin__story'
  panel.id = `${id}-panel-${key}`
  panel.dataset.story = key
  panel.setAttribute('role', 'tabpanel')
  panel.setAttribute('aria-labelledby', `${id}-tab-${key}`)
  if (!active) panel.hidden = true

  panel.innerHTML = `
    <div class="origin__grid">
      <ol class="origin__steps">
        ${story.steps
          .map(
            (step, i) => `
          <li class="origin__step${i === 0 ? ' is-active' : ''}" data-step="${i}">
            <div class="origin__slot" data-slot="${i}"></div>
            <div class="origin__text">
              <p class="origin__num" aria-hidden="true">${step.num}</p>
              <h3 class="origin__step-title"><span class="visually-hidden">${step.num}. </span>${step.title}</h3>
              ${step.text.map((p) => `<p class="origin__para">${p}</p>`).join('')}
              ${step.aside ? `<p class="origin__aside">${step.aside}</p>` : ''}
            </div>
          </li>`,
          )
          .join('')}
      </ol>
      <div class="origin__sticky" aria-hidden="false">
        <div class="origin__frame" data-frame></div>
      </div>
      <p class="origin__action"><a class="origin__action-link" href="${story.action.href}">${story.action.label}</a></p>
    </div>
  `

  story.steps.forEach((step, i) => {
    panel.querySelector(`[data-slot="${i}"]`).appendChild(buildMedia(step, key, i))
  })

  return panel
}

export function buildOrigin(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section section--dark origin'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const id = item.id

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="origin__head">
          <div class="origin__intro">
            <p class="eyebrow" data-reveal>${copy.eyebrow}</p>
            <h2 id="${id}-title" class="origin__title" data-reveal>${copy.title}</h2>
            <p class="origin__note" data-reveal>${copy.note}</p>
          </div>
          <div class="origin__tabs" role="tablist" aria-label="${copy.tabsLabel}" data-reveal>
            ${originOrder
              .map(
                (key, i) => `
              <button type="button" class="origin__tab" role="tab" id="${id}-tab-${key}"
                      aria-controls="${id}-panel-${key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
                      data-story-tab="${key}">${origin[key].tab}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="origin__stories" data-stories></div>
      </div>
    </div>
  `

  const title = section.querySelector('.origin__title')
  title.parentNode.insertBefore(
    document.createComment(' Запасные заголовки: «Откуда икра и рыба на вашем столе» / «Путь до банки» '),
    title,
  )

  const stories = section.querySelector('[data-stories]')
  originOrder.forEach((key, i) => stories.appendChild(buildStory(key, origin[key], id, i === 0)))

  return section
}

/* ------------------------------------------------------------------- init */

export function initOrigin() {
  const section = document.querySelector('#origin')
  if (!section) return

  const tabs = [...section.querySelectorAll('[data-story-tab]')]
  const panels = new Map([...section.querySelectorAll('[data-story]')].map((el) => [el.dataset.story, el]))

  let currentKey = originOrder[0]
  let triggers = []
  const fired = new Set() // years/radius — один раз за загрузку страницы

  /* ---- раскладка: кадры в шагах или в липком кадре ---------------------- */

  function place(panel) {
    const frame = panel.querySelector('[data-frame]')
    const medias = [...panel.querySelectorAll('[data-origin-media]')]
    const wide = WIDE.matches
    medias.forEach((media) => {
      const i = media.dataset.originMedia
      if (wide) {
        if (media.parentElement !== frame) frame.appendChild(media)
      } else {
        const slot = panel.querySelector(`[data-slot="${i}"]`)
        if (media.parentElement !== slot) slot.appendChild(media)
        gsap.killTweensOf(media)
        gsap.set(media, { clearProps: 'opacity,transform,zIndex' })
        media.inert = false
        media.removeAttribute('aria-hidden')
        media.classList.remove('is-active')
      }
    })
    if (wide) setActive(panel, activeIndex(panel), true)
  }

  const activeIndex = (panel) => {
    const step = panel.querySelector('.origin__step.is-active')
    return step ? Number(step.dataset.step) : 0
  }

  let layer = 1
  function setActive(panel, index, instant = false) {
    const steps = [...panel.querySelectorAll('.origin__step')]
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index))
    if (!WIDE.matches) return

    const medias = [...panel.querySelector('[data-frame]').querySelectorAll(':scope > [data-origin-media]')]
    medias.forEach((media) => {
      const on = Number(media.dataset.originMedia) === index
      media.classList.toggle('is-active', on)
      media.setAttribute('aria-hidden', String(!on))
      media.inert = !on
      if (!on) {
        if (instant || REDUCED) gsap.set(media, { opacity: 0 })
        else gsap.to(media, { opacity: 0, duration: 0.7, ease: 'power2.out' })
        return
      }
      media.style.zIndex = String(++layer)
      if (instant || REDUCED) {
        gsap.set(media, { opacity: 1, scale: 1 })
      } else {
        gsap.to(media, { opacity: 1, duration: 0.7, ease: 'power2.out' })
        gsap.fromTo(media, { scale: 1.05 }, { scale: 1, duration: 2, ease: 'power2.out' })
      }
    })
  }

  /* ---- триггеры видимой истории ---------------------------------------- */

  function wire(panel) {
    triggers.forEach((t) => t.kill())
    triggers = []

    const steps = [...panel.querySelectorAll('.origin__step')]
    steps.forEach((step, i) => {
      triggers.push(
        ScrollTrigger.create({
          trigger: step,
          start: 'top center',
          end: 'bottom center',
          onToggle: (self) => {
            if (self.isActive) setActive(panel, i)
          },
        }),
      )

      const media = panel.querySelector(`[data-origin-media="${i}"]`)
      const years = media?.querySelector('[data-years-num]')
      const ring = media?.querySelector('[data-radius-ring]')
      const key = `${panel.dataset.story}:${i}`
      if ((years || ring) && !REDUCED && !fired.has(key)) {
        triggers.push(
          ScrollTrigger.create({
            trigger: step,
            start: 'top center',
            once: true,
            onEnter: () => {
              fired.add(key)
              if (years) countYears(years)
              if (ring) growRing(ring)
            },
          }),
        )
      }
    })
  }

  /* ---- вкладки ---------------------------------------------------------- */

  function switchStory(key, focus) {
    if (key === currentKey) return
    const from = panels.get(currentKey)
    const to = panels.get(key)
    currentKey = key

    tabs.forEach((tab) => {
      const on = tab.dataset.storyTab === key
      tab.setAttribute('aria-selected', String(on))
      tab.tabIndex = on ? 0 : -1
      if (on && focus) tab.focus()
    })

    const swap = () => {
      from.hidden = true
      to.hidden = false
      place(to)
      setActive(to, 0, true)
      wire(to)
      ScrollTrigger.refresh()

      // Если верх секции уже ушёл выше экрана — к началу секции, иначе
      // человек оказывается в середине новой истории.
      // Цель — числом, а не элементом: Lenis у элемента сам вычитает
      // scroll-margin-top секции (layout.css), и отступ под шапку
      // складывался бы с ним — секция вставала на 92px ниже.
      const top = section.getBoundingClientRect().top
      if (top < 0) {
        const header = document.querySelector('[data-header]')
        const target = window.scrollY + top - (header ? header.offsetHeight + 16 : 0)
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(target, { duration: 1 })
        else window.scrollTo({ top: target })
      }

      if (REDUCED) return
      gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    }

    if (REDUCED) swap()
    else gsap.to(from, { opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => {
      gsap.set(from, { clearProps: 'opacity' })
      swap()
    } })
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => switchStory(tab.dataset.storyTab, false))
    tab.addEventListener('keydown', (event) => {
      let next = null
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = tabs.length - 1
      if (next === null) return
      event.preventDefault()
      switchStory(tabs[next].dataset.storyTab, true)
    })
  })

  /* ---- смена раскладки --------------------------------------------------- */

  WIDE.addEventListener?.('change', () => {
    place(panels.get(currentKey))
    ScrollTrigger.refresh()
  })

  /* ---- виджеты ------------------------------------------------------------ */

  section.querySelectorAll('[data-shell]').forEach(wireShell)
  section.querySelectorAll('[data-cites]').forEach(wireCites)

  /* ---- старт -------------------------------------------------------------- */

  const first = panels.get(currentKey)
  place(first)
  wire(first)
}

/* ------------------------------------------------------------ years, radius */

function countYears(el) {
  const target = originWidgets.years.value
  const state = { n: 0 }
  gsap.to(state, {
    n: target,
    duration: 1.6,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = String(Math.round(state.n))
    },
  })
}

function growRing(ring) {
  const box = ring.closest('.origin-radius')
  gsap.fromTo(
    ring,
    { scale: 0, opacity: 1 },
    {
      scale: 1,
      duration: 1.4,
      ease: 'power2.out',
      onComplete: () => box?.classList.add('is-done'),
    },
  )
  // Подпись проявляется, когда окружность доходит до края.
  const label = box?.querySelector('.origin-radius__label')
  if (label) gsap.fromTo(label, { opacity: 0 }, { opacity: 1, duration: 0.35, delay: 1.1 })
}

/* ------------------------------------------------------------------ shell */

function wireShell(root) {
  const options = [...root.querySelectorAll('[data-shell-opt]')]
  const choose = (i, focus) => {
    options.forEach((opt, k) => {
      opt.setAttribute('aria-checked', String(k === i))
      opt.tabIndex = k === i ? 0 : -1
    })
    root.dataset.state = options[i].dataset.shellOpt
    if (focus) options[i].focus()
  }
  options.forEach((opt, i) => {
    opt.addEventListener('click', () => choose(i, false))
    opt.addEventListener('keydown', (event) => {
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      if (!forward && !back) return
      event.preventDefault()
      choose((i + (forward ? 1 : -1) + options.length) % options.length, true)
    })
  })
}

/* ------------------------------------------------------------------ cites */

function wireCites(root) {
  const w = originWidgets.cites
  const buttons = [...root.querySelectorAll('[data-group]')]
  const explain = root.querySelector('[data-cites-explain]')
  const speciesValue = root.querySelector('[data-group="species"] [data-group-value]')

  let species = { code: w.defaultSpecies, latin: w.defaultLatin }
  let active = w.initial

  const textFor = (key) => {
    if (key === 'species') return w.speciesExplain(species.code, species.latin)
    return w.groups.find((group) => group.key === key)?.explain || ''
  }

  const activate = (key) => {
    active = key
    buttons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.group === key))
    explain.textContent = textFor(key)
  }

  buttons.forEach((btn, i) => {
    const key = btn.dataset.group
    btn.addEventListener('pointerenter', () => activate(key))
    btn.addEventListener('focus', () => activate(key))
    btn.addEventListener('click', () => activate(key))
    btn.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
      buttons[next].focus()
    })
  })

  document.addEventListener('gg:line-change', (event) => {
    const line = findLine(event.detail?.slug)
    const code = event.detail?.cites || w.defaultSpecies
    if (code === species.code) return
    species = { code, latin: line?.latin || w.defaultLatin }

    const apply = () => {
      speciesValue.textContent = code
      if (active === 'species') explain.textContent = textFor('species')
    }
    if (REDUCED) return apply()
    gsap
      .timeline()
      .to(speciesValue, { opacity: 0, duration: 0.1 })
      .add(apply)
      .to(speciesValue, { opacity: 1, duration: 0.1 })
  })

  activate(active)
}
