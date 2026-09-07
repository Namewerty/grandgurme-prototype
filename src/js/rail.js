/* ============================================================================
   Горизонтальная лента с прокруткой. Механизм витрины #shop (у ленты
   ассортимента прокрутки больше нет — там решётка 4×2, см. categories.js).

   Прокрутка НАТИВНАЯ — overflow-x + scroll-snap. Никакого перехвата touch:
   палец по ленте ведёт её вбок, палец по вертикали листает страницу, потому
   что touch-action мы не трогаем. Драг мышью по самим карточкам не
   эмулируем: он ломает выделение текста и клик по карточке.

   ЧТО ИЗМЕНИЛОСЬ ПОСЛЕ ПРАВКИ ЗАКАЗЧИКА. Раньше единственными кнопками
   листания был капсульный пейджер, стоявший в строке с переключателем
   «Себе / В подарок» — то есть НАД лентой и в стороне от неё. Заказчик
   сказал прямо: эти стрелки сбоку не находятся, а руку тянет к низу ленты,
   где у слайдеров обычно ползунок. Так и сделано — три способа листать,
   и все три там, где их ищут:

     1. Ползунок внизу. Полоса позиции перестала быть только индикатором:
        за золотой отрезок можно тянуть, а по дорожке — щёлкать, и лента
        едет в это место. Это главный способ, и он ровно там, куда тянется
        рука. Отсюда же и размеры: дорожка стала толще, у неё есть невидимая
        зона захвата в 11px сверху и снизу, курсор меняется на grab/grabbing.
     2. Пейджер. Переехал из шапки вниз, в одну строку с ползунком:
        стрелки и ползунок читаются как один орган управления, а не как
        две несвязанные детали в разных концах блока.
     3. Стрелки поверх ленты. Появляются по наведению у левого и правого
        края — для тех, кто вообще не смотрит вниз. Только на устройствах
        с курсором: пальцем лента листается сама.

   Плюс два пассивных знака, которые были и раньше: обрезанный край (маска
   гасит содержимое с той стороны, куда ещё есть куда ехать) и обрезанная
   карточка у границы контейнера.

   Вся индикация целиком снимается, когда лента помещается в экран: мёртвые
   кнопки и ползунок во всю ширину дорожки были бы обманом.
   ============================================================================ */

import { icons } from './icons.js'

/** Погрешность на дробные пиксели: scrollLeft при zoom не даёт ровных чисел. */
const EDGE = 2

/**
 * Пейджер: капсула на две кнопки, разделённые волосяной линией.
 *
 * @param {string} label что листаем — попадёт в aria-label кнопок
 * @returns {{node: HTMLElement, prev: HTMLButtonElement, next: HTMLButtonElement}}
 */
export function createPager(label) {
  const node = document.createElement('div')
  node.className = 'pager'

  const prev = createArrow('prev', `${label}: назад`, 'pager__btn')
  const next = createArrow('next', `${label}: вперёд`, 'pager__btn')

  node.append(prev, next)
  return { node, prev, next }
}

/**
 * Одиночная стрелка — та же кнопка, что в пейджере, но без капсулы вокруг.
 * Используется для стрелок поверх ленты.
 *
 * @param {'prev'|'next'} dir
 * @param {string} label
 * @param {string} base базовый класс: pager__btn или rail-edge
 */
export function createArrow(dir, label, base = 'rail-edge') {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = `${base} ${base}--${dir}`
  el.innerHTML = dir === 'prev' ? icons.chevronLeft : icons.chevronRight
  el.setAttribute('aria-label', label)
  return el
}

/** prev/next принимают и один элемент, и несколько: кнопок стало по две. */
const list = (value) => (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean)

/**
 * Оживляет ленту: кнопки, маска краёв, ползунок позиции.
 *
 * Разметку целиком строит вызывающая секция — здесь только поведение.
 *
 * @param {object} o
 * @param {HTMLElement}  o.track    сам скроллящийся контейнер
 * @param {HTMLElement} [o.frame]   обёртка, на неё вешаются is-start / is-end
 * @param {HTMLButtonElement|HTMLButtonElement[]} [o.prev]
 * @param {HTMLButtonElement|HTMLButtonElement[]} [o.next]
 * @param {HTMLElement} [o.bar]     ползунок (внутренний отрезок полосы позиции)
 * @param {number}      [o.page]    доля видимой ширины за одно нажатие
 * @returns {{sync: () => void, destroy: () => void}}
 */
export function initRail({ track, frame, prev, next, bar, page = 0.85 }) {
  if (!track) return { sync: () => {}, destroy: () => {} }

  const host = frame || track
  const prevs = list(prev)
  const nexts = list(next)
  const barTrack = bar ? bar.parentElement : null

  const maxScroll = () => track.scrollWidth - track.clientWidth

  /* --------------------------------------------------- состояние индикации */

  const sync = () => {
    const max = maxScroll()
    const scrollable = max > EDGE

    host.classList.toggle('is-scrollable', scrollable)

    // Ленту, которая влезла целиком, не подрезаем и не листаем.
    if (!scrollable) {
      host.classList.remove('is-start', 'is-end')
      ;[...prevs, ...nexts].forEach((btn) => { btn.disabled = true })
      if (bar) bar.style.cssText = ''
      return
    }

    const left = track.scrollLeft
    host.classList.toggle('is-start', left > EDGE)
    host.classList.toggle('is-end', left < max - EDGE)

    prevs.forEach((btn) => { btn.disabled = left <= EDGE })
    nexts.forEach((btn) => { btn.disabled = left >= max - EDGE })

    if (bar) {
      // Ширина отрезка — видимая доля ленты, положение — доля прокрученного
      // от свободного хода. Тот же расчёт, что у нативного скроллбара,
      // поэтому отрезок никогда не выходит за полосу.
      const ratio = track.clientWidth / track.scrollWidth
      bar.style.width = `${(ratio * 100).toFixed(2)}%`
      bar.style.transform = `translateX(${((left / max) * (1 / ratio - 1) * 100).toFixed(2)}%)`
    }
  }

  /* ------------------------------------------------------------- стрелки */

  const step = (dir) => {
    track.scrollBy({ left: dir * track.clientWidth * page, behavior: 'smooth' })
  }

  const back = () => step(-1)
  const forward = () => step(1)

  prevs.forEach((btn) => btn.addEventListener('click', back))
  nexts.forEach((btn) => btn.addEventListener('click', forward))

  /* ------------------------------------------------------------- ползунок

     Три вещи, без которых протяжка ощущается сломанной:

     1. scrollLeft двигаем напрямую, без behavior:'smooth'. Плавная прокрутка
        догоняет курсор с задержкой — отрезок отстаёт от руки. Smooth остаётся
        только у стрелок, где он и уместен.
     2. На время протяжки снимаем scroll-snap. При включённом snap браузер
        подтягивает каждое наше присваивание scrollLeft к ближайшей карточке,
        и ползунок идёт за курсором рывками, а не один к одному. Отпустили —
        вернули: снап нужен пальцу и стрелкам, но не протяжке.
     3. Захват указателя (setPointerCapture): без него уход курсора за пределы
        полосы во время протяжки роняет события, и ползунок залипает. */

  let dragFrom = 0        // clientX в момент нажатия
  let dragScroll = 0      // scrollLeft в момент нажатия
  let dragging = false

  /** Сколько пикселей может пройти сам ползунок по дорожке. */
  const freeRun = () => (barTrack ? barTrack.clientWidth - bar.offsetWidth : 0)

  const onBarDown = (event) => {
    if (!barTrack || event.button > 0) return
    const max = maxScroll()
    if (max <= EDGE) return

    dragging = true
    dragFrom = event.clientX
    dragScroll = track.scrollLeft

    // «Мимо ползунка» считаем по координате, а не по event.target: у дорожки
    // есть невидимая зона захвата сверху и снизу (псевдоэлемент), и нажатие
    // прямо над отрезком приходит с target = дорожка — центрировать его
    // в этом случае было бы рывком на ровном месте.
    const thumb = bar.getBoundingClientRect()
    const onThumb = event.clientX >= thumb.left && event.clientX <= thumb.right

    // Нажали мимо ползунка — сперва подводим его центр под курсор, дальше
    // работает обычная протяжка: курсор уже «держит» отрезок.
    if (!onThumb) {
      const free = freeRun()
      if (free > 0) {
        const x = event.clientX - barTrack.getBoundingClientRect().left - bar.offsetWidth / 2
        const ratio = Math.min(Math.max(x / free, 0), 1)
        dragScroll = ratio * max
        track.scrollLeft = dragScroll
      }
    }

    barTrack.classList.add('is-dragging')
    track.style.scrollSnapType = 'none'
    barTrack.setPointerCapture?.(event.pointerId)
    event.preventDefault()   // иначе курсор превращается в «выделение текста»
  }

  const onBarMove = (event) => {
    if (!dragging) return
    const free = freeRun()
    if (free <= 0) return

    const delta = event.clientX - dragFrom
    track.scrollLeft = dragScroll + (delta / free) * maxScroll()
  }

  const onBarUp = (event) => {
    if (!dragging) return
    dragging = false
    barTrack.classList.remove('is-dragging')
    track.style.scrollSnapType = ''
    barTrack.releasePointerCapture?.(event.pointerId)
  }

  if (barTrack) {
    barTrack.addEventListener('pointerdown', onBarDown)
    barTrack.addEventListener('pointermove', onBarMove)
    barTrack.addEventListener('pointerup', onBarUp)
    barTrack.addEventListener('pointercancel', onBarUp)
  }

  /* ------------------------------------------------------------ пересчёт */

  track.addEventListener('scroll', sync, { passive: true })

  // Ширина карточек зависит от шрифта и от размера окна: и то и другое
  // приходит позже первой отрисовки, а от них зависит, прокручивается лента
  // вообще или нет.
  const observer = 'ResizeObserver' in window ? new ResizeObserver(sync) : null
  if (observer) observer.observe(track)
  else window.addEventListener('resize', sync)

  if (document.fonts?.ready) document.fonts.ready.then(sync)

  sync()

  /* Витрина подменяет ленту целиком при смене набора «Себе / В подарок»,
     и кнопки при этом остаются прежние. Без отписки на них копились бы
     обработчики от всех прошлых лент, и одно нажатие листало бы сразу
     несколько — в том числе уже удалённых. */
  const destroy = () => {
    prevs.forEach((btn) => btn.removeEventListener('click', back))
    nexts.forEach((btn) => btn.removeEventListener('click', forward))
    track.removeEventListener('scroll', sync)

    if (barTrack) {
      barTrack.removeEventListener('pointerdown', onBarDown)
      barTrack.removeEventListener('pointermove', onBarMove)
      barTrack.removeEventListener('pointerup', onBarUp)
      barTrack.removeEventListener('pointercancel', onBarUp)
    }

    if (observer) observer.disconnect()
    else window.removeEventListener('resize', sync)
  }

  return { sync, destroy }
}
