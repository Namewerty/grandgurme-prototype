/* ============================================================================
   #season — «Сейчас в сезоне». Светлая, продолжает главу витрины (tight).

   ПОЧЕМУ НЕ ВТОРАЯ ЛЕНТА КАРТОЧЕК. Две одинаковые ленты на одной странице
   читаются как сбой сборки, а не как два разных предложения. Поэтому блок
   построен на другой типографической механике: строчный список слева
   и одно окно предпросмотра справа. Строки разделены волосяными линиями —
   тем же приёмом, что города в #offline и пункты #why.

   ОКНО — ПРИГЛАШЕНИЕ, А НЕ УКРАШЕНИЕ. Пока курсор не касался блока, кадр
   сам перелистывается раз в 4.5 с: это и есть подсказка, что строки живые.
   Первое наведение или фокус останавливают листание НАВСЕГДА — вернувшееся
   листание перебивало бы выбор человека.

   Окно помечено aria-hidden: оно дублирует то, что уже написано в строке,
   и скринридеру незачем слышать название дважды.

   Мобильный (< 1024): окна нет вовсе, строки получают квадратную миниатюру
   56×56 слева. Автолистания там тоже нет — листать нечего.

   prefers-reduced-motion: ни автолистания, ни кроссфейда; смена кадра
   мгновенная, золотая линия активной строки сразу в конечном виде.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { seasonCopy, seasonItems } from '../../data/season.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const wideMQ = window.matchMedia('(min-width: 1024px)')

const AUTOPLAY_MS = 4500

/* --------------------------------------------------------------- разметка */

export function buildSeason(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section season'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const rows = seasonItems
    .map(
      ({ mark, name, note, price, href, media }, i) => `
    <li class="season__item">
      <a class="season__row${i === 0 ? ' is-active' : ''}" href="${href}" data-season-row="${i}">
        <span class="season__rule" aria-hidden="true"></span>
        <span class="season__line" aria-hidden="true"></span>

        <!-- Обёртка отдельным элементом: hydrateMedia ЗАМЕНЯЕТ узел
             с data-media на медиа-обёртку, и класс, стоявший на нём,
             потерялся бы вместе с узлом. -->
        <span class="season__thumb">
          <span data-media="image" data-src="${media.src}" data-ratio="1:1"
                data-alt="${media.alt}"></span>
        </span>

        <span class="season__text">
          <span class="season__top">
            <span class="season__mark">${seasonCopy.marks[mark]}</span>
            <span class="season__name">${name}</span>
          </span>
          <span class="season__note">${note}</span>
        </span>

        <span class="season__price">${price}</span>
      </a>
    </li>`,
    )
    .join('')

  /* Кадры лежат друг на друге в окне фиксированной пропорции 4:5. Обёртка
     держит позицию, кадр внутри тянется на всю её площадь (data-fill),
     поэтому пропорцию задаёт окно, а не сам файл: кадры сортов квадратные,
     пэкшоты тоже, а окно должно быть одним для всех шести. */
  const frames = seasonItems
    .map(
      ({ media }, i) => `
    <span class="season__frame${i === 0 ? ' is-active' : ''}" data-season-frame="${i}">
      <span data-media="image" data-fill="true" data-src="${media.src}"
            data-ratio="4:5" data-alt="${media.alt}"></span>
    </span>`,
    )
    .join('')

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="season__head">
          <p class="eyebrow" data-reveal>${seasonCopy.eyebrow}</p>
          <h2 id="${item.id}-title" class="season__title" data-reveal>${seasonCopy.title}</h2>
          <p class="season__note-lead" data-reveal>${seasonCopy.note}</p>
        </div>

        <div class="season__body" data-season-body data-reveal>
          <div class="season__col">
            <ul class="season__list">${rows}</ul>

            <p class="season__more">
              <a href="${seasonCopy.more.href}">${seasonCopy.more.label}</a>
            </p>
          </div>

          <!-- Окно дублирует то, что уже написано в строке слева, поэтому
               из дерева доступности убрано целиком. -->
          <div class="season__window" aria-hidden="true">
            <div class="season__frames">${frames}</div>
            <p class="season__caption" data-season-caption>${seasonItems[0].name}</p>
          </div>
        </div>
      </div>
    </div>
  `

  return section
}

/* ------------------------------------------------------------------- init */

export function initSeason() {
  const section = document.querySelector('#season')
  const body = section?.querySelector('[data-season-body]')
  if (!body) return

  const rows = [...body.querySelectorAll('[data-season-row]')]
  const frames = [...body.querySelectorAll('[data-season-frame]')]
  const caption = body.querySelector('[data-season-caption]')
  if (!rows.length) return

  let active = 0
  let timer = null
  let stopped = REDUCED

  const wide = () => wideMQ.matches

  function show(next) {
    if (next === active) return

    rows.forEach((row, i) => row.classList.toggle('is-active', i === next))

    const from = frames[active]
    const to = frames[next]
    active = next

    caption.textContent = seasonItems[next].name

    if (REDUCED) {
      frames.forEach((frame, i) => frame.classList.toggle('is-active', i === next))
      return
    }

    // Мягкий кроссфейд: уходящий кадр гаснет под приходящим, а не сменяется
    // щелчком. Оба лежат друг на друге в окне фиксированной пропорции,
    // поэтому высота блока при смене не двигается.
    gsap.killTweensOf([from, to])
    to.classList.add('is-active')
    gsap.fromTo(to, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' })
    gsap.to(from, {
      opacity: 0,
      duration: 0.45,
      ease: 'power2.out',
      onComplete: () => {
        from.classList.remove('is-active')
        gsap.set(from, { opacity: 1 })
      },
    })
  }

  /** Первое вмешательство гасит автолистание навсегда. */
  function stop() {
    if (stopped) return
    stopped = true
    clearTimeout(timer)
  }

  function schedule() {
    clearTimeout(timer)
    if (stopped || !wide()) return
    timer = setTimeout(() => {
      show((active + 1) % rows.length)
      schedule()
    }, AUTOPLAY_MS)
  }

  rows.forEach((row, i) => {
    // Наведение и фокус ведут себя одинаково: клавиатура должна давать
    // ровно то же, что мышь, иначе окно для неё мертво.
    row.addEventListener('mouseenter', () => {
      if (!wide()) return
      stop()
      show(i)
    })
    row.addEventListener('focus', () => {
      stop()
      if (wide()) show(i)
    })
  })

  // Ушли на узкий экран — листать нечего: окна там нет.
  wideMQ.addEventListener('change', () => (wide() ? schedule() : clearTimeout(timer)))

  if (REDUCED) return

  // Листание начинается, когда блок в кадре: отработав за экраном, оно
  // пропало бы впустую, а человек увидел бы уже остановившееся окно.
  ScrollTrigger.create({
    trigger: section,
    start: 'top 80%',
    once: true,
    onEnter: schedule,
  })
}
