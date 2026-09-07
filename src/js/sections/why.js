/* ============================================================================
   #why — «Наш стандарт». Светлая, не полноэкранная.

   ФОРМА: РАЗВОРОТ, А НЕ СЕТКА. Слева список из шести обязательств, справа
   панель активного. Заказчик забраковал прежнюю сетку 3×2 справедливо:
   «иконка — заголовок — три строки» ×6 это самая узнаваемая заготовка
   в интернете, и звать нажимать она не умеет.

   ЧТО ЗДЕСЬ НЕЛЬЗЯ ПОТЕРЯТЬ ПРИ ПЕРЕПИСЫВАНИИ. Все шесть заголовков видны
   ВСЕГДА, без единого движения мышью. Интерактив раскрывает только подробности
   и кадр. Блок, в котором «Собственное производство» надо сначала найти
   наведением, перестал заявлять и начал загадывать — а это блок обязательств.

   РАЗМЕТКА ОДНА НА ОБА РЕЖИМА: строки и панели лежат вперемешку
   (строка → её панель → строка → её панель…). На десктопе сетка уводит все
   панели в правую колонку и складывает их друг на друга, на мобильном тот же
   DOM читается сверху вниз как аккордеон. Так не нужно переносить узлы при
   смене ширины — а перенос узлов ломает фокус и рвёт анимацию на полуслове.

   Роли меняются вместе с раскладкой: tablist/tab/tabpanel на десктопе,
   кнопка с aria-expanded и region на мобильном. Обещать скринридеру контракт
   вкладок там, где панель раскрывается прямо под своим заголовком, было бы
   неправдой — тот же довод, по которому строка «Обработка» в каталоге
   размечена кнопками с aria-pressed, а не табами.

   Автолистание — раз в 5 с, с золотой полосой прогресса под активным
   заголовком: полоса и есть подсказка, что здесь можно вмешаться. Первое
   наведение, нажатие или фокус останавливают его НАВСЕГДА — вернувшееся
   листание перебивало бы выбор человека.

   prefers-reduced-motion: ни автолистания, ни кроссфейда, ни прорисовки
   контура, ни полосы прогресса. Переключение мгновенное, знаки сразу целые.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { whyCopy, whyItems } from '../../data/why.js'
import { icons } from '../icons.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const desktopMQ = window.matchMedia('(min-width: 900px)')

const AUTOPLAY_MS = 5000

/* --------------------------------------------------------------- разметка */

export function buildWhy(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section why'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const rows = whyItems
    .map(
      ({ icon, name, text, media }, i) => `
      <button type="button" class="why__tab${i === 0 ? ' is-active' : ''}"
              id="why-tab-${i}" data-why-tab="${i}" aria-controls="why-panel-${i}">
        <span class="why__rule" aria-hidden="true"></span>
        <span class="why__icon" aria-hidden="true">${icons[icon] || ''}</span>
        <span class="why__name">${name}</span>
        <span class="why__progress" aria-hidden="true"><i data-why-progress></i></span>
      </button>

      <div class="why__panel${i === 0 ? ' is-active' : ''}"
           id="why-panel-${i}" data-why-panel="${i}" aria-labelledby="why-tab-${i}">
        <div class="why__panel-inner">
          <p class="why__text">${text}</p>
          <div data-media="image" data-class="why__media" data-src="${media.src}"
               data-ratio="${media.ratio}" data-alt="${media.alt}"></div>
        </div>
      </div>`,
    )
    .join('')

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="why__head">
          <p class="eyebrow" data-reveal>${whyCopy.eyebrow}</p>
          <h2 id="${item.id}-title" class="why__title" data-reveal>${whyCopy.title}</h2>
        </div>

        <div class="why__body" data-why-body data-reveal>
          ${rows}
        </div>
      </div>
    </div>
  `

  return section
}

/* ------------------------------------------------------- отрисовка знаков */

/**
 * Замер длин контура. getTotalLength заставляет браузер считать геометрию,
 * поэтому меряем один раз на пункт и до записи стилей: вперемешку это дало бы
 * layout thrashing на шести знаках сразу.
 */
function measurePaths(tab) {
  return [...tab.querySelectorAll('.why__icon svg > *')].map((path) => {
    // Окружности и эллипсы getTotalLength поддерживают не везде одинаково;
    // где не вышло — берём заведомо большее число, контур всё равно скроется.
    let length = 100
    try {
      length = path.getTotalLength() || 100
    } catch {
      length = 100
    }
    return { path, length }
  })
}

/** Прячет контур в самого себя: штрих равен длине пути, отступ тоже. */
function hideOutline(paths) {
  paths.forEach(({ path, length }) => {
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
  })
}

function drawOutline(paths) {
  if (!paths.length) return
  gsap.to(
    paths.map(({ path }) => path),
    {
      strokeDashoffset: 0,
      duration: 0.85,
      ease: 'power1.inOut',
      stagger: 0.05,
      // Пунктир снимаем совсем: иначе он остаётся в инлайновых стилях
      // и мешает знаку, если страницу масштабируют после анимации.
      onComplete: () => {
        paths.forEach(({ path }) => {
          path.style.strokeDasharray = ''
          path.style.strokeDashoffset = ''
        })
      },
    },
  )
}

/* ------------------------------------------------------------------- init */

export function initWhy() {
  const section = document.querySelector('#why')
  const body = section?.querySelector('[data-why-body]')
  if (!body) return

  const tabs = [...body.querySelectorAll('[data-why-tab]')]
  const panels = [...body.querySelectorAll('[data-why-panel]')]
  if (!tabs.length) return

  const outlines = tabs.map(measurePaths)
  const inners = panels.map((panel) => panel.querySelector('.why__panel-inner'))

  /* Пока секция не вошла в кадр, контуры спрятаны и перерисовывать их
     по переключению нельзя: рисунок пошёл бы дважды и порвался. */
  let entered = REDUCED

  let active = 0
  /* Мобильный аккордеон может быть закрыт целиком — на десктопе не может:
     пустая правая колонка читается как несобравшийся блок. */
  let collapsed = false
  let desktop = desktopMQ.matches
  let autoplayTimer = null
  let progress = null
  let stopped = REDUCED

  const isOpen = (i) => i === active && !(collapsed && !desktop)

  /* ---- роли: контракт меняется вместе с раскладкой ---------------------- */

  function applyRoles() {
    if (desktop) {
      body.setAttribute('role', 'tablist')
      body.setAttribute('aria-orientation', 'vertical')
      body.setAttribute('aria-label', whyCopy.title)
    } else {
      body.removeAttribute('role')
      body.removeAttribute('aria-orientation')
      body.removeAttribute('aria-label')
    }

    tabs.forEach((tab, i) => {
      tab.classList.toggle('is-active', isOpen(i))

      if (desktop) {
        tab.setAttribute('role', 'tab')
        tab.setAttribute('aria-selected', String(i === active))
        tab.removeAttribute('aria-expanded')
        // Roving tabindex: Tab заходит в группу вкладок один раз,
        // дальше по ней ходят стрелки.
        tab.tabIndex = i === active ? 0 : -1
      } else {
        tab.removeAttribute('role')
        tab.removeAttribute('aria-selected')
        tab.setAttribute('aria-expanded', String(isOpen(i)))
        tab.tabIndex = 0
      }
    })

    panels.forEach((panel, i) => {
      panel.setAttribute('role', desktop ? 'tabpanel' : 'region')
      panel.classList.toggle('is-active', isOpen(i))
    })
  }

  /* ---- полоса прогресса и автолистание ---------------------------------- */

  function killProgress() {
    progress?.kill()
    progress = null
    body.querySelectorAll('[data-why-progress]').forEach((bar) => gsap.set(bar, { scaleX: 0 }))
  }

  function runProgress() {
    killProgress()
    if (stopped || !desktop) return

    const bar = tabs[active].querySelector('[data-why-progress]')
    if (!bar) return
    progress = gsap.fromTo(
      bar,
      { scaleX: 0 },
      { scaleX: 1, duration: AUTOPLAY_MS / 1000, ease: 'none' },
    )
  }

  function scheduleAutoplay() {
    clearTimeout(autoplayTimer)
    if (stopped || !desktop) return
    autoplayTimer = setTimeout(() => {
      select((active + 1) % tabs.length)
      scheduleAutoplay()
    }, AUTOPLAY_MS)
  }

  /** Первое вмешательство гасит автолистание навсегда. */
  function stopAutoplay() {
    if (stopped) return
    stopped = true
    clearTimeout(autoplayTimer)
    killProgress()
  }

  /* ---- переключение ------------------------------------------------------ */

  function crossfade(from, to) {
    if (from === to) return

    // Панели, зависшие в полупрозрачности от быстрого перебора наведением,
    // возвращаем в исходное: незакрытая панель под новой читается как грязь.
    panels.forEach((panel, i) => {
      if (i === from || i === to) return
      panel.classList.remove('is-active')
      gsap.set(inners[i], { opacity: 1, y: 0 })
    })

    panels[to].classList.add('is-active')

    if (REDUCED) {
      panels[from].classList.remove('is-active')
      gsap.set([inners[from], inners[to]], { opacity: 1, y: 0 })
      return
    }

    gsap.killTweensOf([inners[from], inners[to]])
    gsap.to(inners[from], {
      opacity: 0,
      y: -12,
      duration: 0.28,
      ease: 'power3.out',
      onComplete: () => {
        panels[from].classList.remove('is-active')
        gsap.set(inners[from], { opacity: 1, y: 0 })
      },
    })
    gsap.fromTo(
      inners[to],
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out', delay: 0.06 },
    )
  }

  /** Мобильный аккордеон: высоту анимируем, заголовки остаются на месте. */
  function accordion() {
    panels.forEach((panel, i) => {
      const open = isOpen(i)
      panel.classList.toggle('is-active', open)

      if (REDUCED) {
        gsap.set(panel, { height: open ? 'auto' : 0 })
        return
      }

      gsap.killTweensOf(panel)
      gsap.to(panel, {
        height: open ? inners[i].offsetHeight : 0,
        duration: 0.32,
        ease: 'power3.out',
        // auto после раскрытия: иначе текст, переехавший на строку ниже при
        // повороте экрана, обрежется зафиксированной высотой.
        onComplete: () => open && gsap.set(panel, { height: 'auto' }),
      })
    })
  }

  /**
   * Знак активного пункта прорисовывается заново. Знаки остальных пяти уже
   * нарисованы целиком (каскад на входе секции) — прятать их нельзя: заголовок
   * без знака рядом читается как недогрузившаяся иконка.
   */
  function redraw(i) {
    if (!entered || REDUCED) return
    gsap.killTweensOf(outlines[i].map(({ path }) => path))
    hideOutline(outlines[i])
    drawOutline(outlines[i])
  }

  /** Выбор пункта. На мобильном повторное нажатие по открытому его закрывает. */
  function select(next, { toggle = false, focus = false } = {}) {
    syncMode()
    const same = next === active
    if (desktop && same && !collapsed) return

    if (!desktop && toggle && same) collapsed = !collapsed
    else collapsed = false

    const from = active
    active = next

    if (desktop) crossfade(from, next)
    applyRoles()
    if (!desktop) accordion()

    if (focus) tabs[next].focus()
    if (isOpen(next)) redraw(next)
    runProgress()
  }

  /* ---- клавиатура -------------------------------------------------------- */

  const KEYS_NEXT = ['ArrowDown', 'ArrowRight']
  const KEYS_PREV = ['ArrowUp', 'ArrowLeft']

  body.addEventListener('keydown', (event) => {
    syncMode()
    const at = tabs.indexOf(event.target.closest('[data-why-tab]'))
    if (at === -1) return

    let next = null
    if (KEYS_NEXT.includes(event.key)) next = (at + 1) % tabs.length
    else if (KEYS_PREV.includes(event.key)) next = (at - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next === null) return

    event.preventDefault()
    stopAutoplay()
    // На мобильном стрелки только переносят фокус: раскрытие там делают
    // Enter и пробел, и раскрывать чужой пункт «по дороге» неправильно.
    if (desktop) select(next, { focus: true })
    else tabs[next].focus()
  })

  /* ---- указатель --------------------------------------------------------- */

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      stopAutoplay()
      select(i, { toggle: true })
    })

    tab.addEventListener('mouseenter', () => {
      syncMode()
      if (!desktop) return
      stopAutoplay()
      select(i)
    })

    tab.addEventListener('focus', () => {
      syncMode()
      stopAutoplay()
      if (desktop) select(i)
    })
  })

  /* ---- смена раскладки --------------------------------------------------- */

  function applyLayout() {
    desktop = desktopMQ.matches
    collapsed = false

    // Инлайновые высоты — след аккордеона, инлайновая прозрачность — след
    // кроссфейда. На чужой раскладке и то и другое прячет панели насовсем.
    panels.forEach((panel, i) => {
      gsap.killTweensOf([panel, inners[i]])
      gsap.set(panel, { clearProps: 'height' })
      gsap.set(inners[i], { clearProps: 'opacity,transform' })
    })

    applyRoles()
    if (!desktop) accordion()

    // Автолистания на мобильном нет: там нет и панели, за которой стоило бы
    // следить, а самопроизвольно раскрывающийся аккордеон читается как сбой.
    if (!desktop) clearTimeout(autoplayTimer)
    runProgress()
  }

  /**
   * Раскладка переключается по matchMedia, но полагаться ТОЛЬКО на событие
   * нельзя: под эмуляцией устройства (инструменты разработчика, CDP) оно
   * до страницы иногда не доходит, и блок остаётся в чужом режиме — на узком
   * экране с ролями вкладок. Поэтому режим ещё и переспрашивается перед
   * каждым действием: сверка стоит один matchMedia, ошибка — сломанный блок.
   */
  function syncMode() {
    if (desktopMQ.matches !== desktop) applyLayout()
  }

  desktopMQ.addEventListener('change', applyLayout)
  window.addEventListener('resize', syncMode, { passive: true })

  /* ---- старт ------------------------------------------------------------- */

  applyLayout()

  // При prefers-reduced-motion контуры сразу целые, первая панель открыта,
  // полосы прогресса и автолистания нет вовсе.
  if (REDUCED) return

  outlines.forEach(hideOutline)

  // Отрисовка знаков и автолистание начинаются, когда блок в кадре: и то
  // и другое, отработав за экраном, пропало бы впустую. Каскад сверху вниз
  // по списку — тот же приём, что у кругов сортов в #types.
  ScrollTrigger.create({
    trigger: section,
    start: 'top 82%',
    once: true,
    onEnter: () => {
      entered = true
      outlines.forEach((paths, i) => gsap.delayedCall(i * 0.09, () => drawOutline(paths)))
      scheduleAutoplay()
      runProgress()
    },
  })
}
