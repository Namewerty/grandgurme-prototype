/* ============================================================================
   Выпадающие панели шапки: открытие, закрытие, клавиатура.

   Что здесь решается и почему именно так.

   ЗАДЕРЖКИ. Открытие с паузой в 140 мс — панель не должна выскакивать, когда
   курсор просто прошёл по шапке к логотипу. Закрытие с паузой в 260 мс —
   за это время курсор успевает уйти с пункта в панель по диагонали, минуя
   соседние пункты. Это же снимает мигание при быстром переборе: если панель
   уже открыта, следующая открывается без задержки.

   КЛИК НА ДЕСКТОПЕ ПЕРЕХВАТЫВАЕТСЯ. Пункты — настоящие ссылки (это нужно
   и поисковику, и мобильному, и клавиатуре без JS), но на десктопе клик
   открывает панель, а не уводит со страницы: уйти в раздел можно из самой
   панели, там для этого есть «Открыть весь каталог».

   ФОКУС НЕ УБЕГАЕТ. Пока панель открыта, Tab ходит по кругу «пункт → панель
   → пункт». Иначе фокус уезжает на страницу под затемнением, и человек
   табает вслепую по невидимому контенту.

   ТОЛЬКО ДЕСКТОП. Ниже 1024px и на устройствах без наведения панелей нет —
   там отдельное меню (мобильная панель в header.js).
   ============================================================================ */

const OPEN_DELAY = 140
const CLOSE_DELAY = 260

const desktop = window.matchMedia('(min-width: 1024px)')
const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)')

/** Может ли элемент получить фокус табом. */
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Скрытые панели категорий продолжают занимать место (в этом весь смысл:
 * так высота панели не прыгает), поэтому размеры о видимости не говорят
 * ничего — спрашиваем про visibility и opacity. Табом такие ссылки всё
 * равно не достать, и в кольце фокуса их быть не должно.
 */
const isFocusable = (el) =>
  el.checkVisibility
    ? el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    : el.offsetWidth > 0 || el.offsetHeight > 0

export function initMegamenu({ header, items, onToggle }) {
  if (!header || !items.length) return null

  const scrim = document.createElement('div')
  scrim.className = 'nav-scrim'
  scrim.setAttribute('aria-hidden', 'true')
  header.after(scrim)

  let open = null // активный item
  let openTimer = null
  let closeTimer = null

  const clearTimers = () => {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
  }

  const enabled = () => desktop.matches

  /* ------------------------------------------------------ открыть / закрыть */

  function openPanel(item) {
    if (open === item) return
    if (open) hidePanel(open)

    open = item
    item.panel.classList.add('is-open')
    item.panel.removeAttribute('aria-hidden')
    item.trigger.setAttribute('aria-expanded', 'true')
    item.trigger.classList.add('is-open')

    scrim.classList.add('is-visible')
    document.documentElement.classList.add('has-megapanel')
    item.api?.reset?.()
    onToggle?.(true)
  }

  function hidePanel(item) {
    item.panel.classList.remove('is-open')
    item.panel.setAttribute('aria-hidden', 'true')
    item.trigger.setAttribute('aria-expanded', 'false')
    item.trigger.classList.remove('is-open')
  }

  function closeAll({ focusTrigger = false } = {}) {
    clearTimers()
    if (!open) return

    const item = open
    open = null
    hidePanel(item)

    scrim.classList.remove('is-visible')
    document.documentElement.classList.remove('has-megapanel')
    onToggle?.(false)

    if (focusTrigger) item.trigger.focus()
  }

  /** Панель уже открыта — соседнюю показываем сразу, без паузы. */
  const scheduleOpen = (item) => {
    clearTimers()
    if (open) return openPanel(item)
    openTimer = setTimeout(() => openPanel(item), OPEN_DELAY)
  }

  const scheduleClose = () => {
    clearTimers()
    closeTimer = setTimeout(() => closeAll(), CLOSE_DELAY)
  }

  /* -------------------------------------------------------------- фокус */

  function focusablesOf(item) {
    return [item.trigger, ...item.panel.querySelectorAll(FOCUSABLE)].filter(isFocusable)
  }

  function trapTab(event) {
    if (!open || event.key !== 'Tab') return

    const list = focusablesOf(open)
    if (!list.length) return

    const first = list[0]
    const last = list[list.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  /* ------------------------------------------------------------ подписки */

  items.forEach((item) => {
    const { trigger, panel } = item

    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', panel.id)
    panel.setAttribute('aria-hidden', 'true')

    trigger.addEventListener('mouseenter', () => {
      if (enabled() && hoverable.matches) scheduleOpen(item)
    })
    trigger.addEventListener('mouseleave', () => {
      if (enabled() && hoverable.matches) scheduleClose()
    })

    panel.addEventListener('mouseenter', clearTimers)
    panel.addEventListener('mouseleave', () => {
      if (enabled() && hoverable.matches) scheduleClose()
    })

    // Клик и Enter — одно событие. На мобильном не мешаем ссылке работать.
    trigger.addEventListener('click', (event) => {
      if (!enabled()) return
      event.preventDefault()
      if (open === item) closeAll({ focusTrigger: true })
      else openPanel(item)
    })

    trigger.addEventListener('keydown', (event) => {
      if (!enabled()) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (open !== item) openPanel(item)
        item.api?.focusFirst?.()
        return
      }

      if (event.key === 'Escape' && open === item) {
        event.preventDefault()
        closeAll({ focusTrigger: true })
      }
    })

    // Ушли по ссылке внутри панели — панель закрываем, чтобы не осталась
    // висеть поверх новой страницы, пока та грузится.
    panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeAll()
    })
  })

  document.addEventListener('keydown', (event) => {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeAll({ focusTrigger: true })
      return
    }
    trapTab(event)
  })

  // Клик мимо шапки и панели.
  document.addEventListener('pointerdown', (event) => {
    if (!open) return
    if (header.contains(event.target)) return
    closeAll()
  })

  // Прокрутка закрывает: панель приклеена к шапке, а страница под ней уезжает.
  // Сравниваем позицию, а не ловим само событие: браузер шлёт scroll и когда
  // подкручивает страницу к элементу с фокусом, и панель гасла бы от Tab.
  let scrollAt = window.scrollY
  window.addEventListener(
    'scroll',
    () => {
      if (!open) {
        scrollAt = window.scrollY
        return
      }
      if (Math.abs(window.scrollY - scrollAt) < 4) return
      closeAll()
    },
    { passive: true },
  )

  desktop.addEventListener('change', (event) => {
    if (!event.matches) closeAll()
  })

  return { close: closeAll, isOpen: () => Boolean(open) }
}
