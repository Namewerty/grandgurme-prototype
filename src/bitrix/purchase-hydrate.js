/* ============================================================================
   Корзина и оформление на Битриксе: то немногое, что делает скрипт поверх
   серверной разметки. Без него обе страницы работают — просто показывают
   чуть больше, чем нужно.

   1. Липкая полоса итога (.cart-bar) внизу мобильной корзины прячется,
      когда в кадре уже кнопка самой сводки: две одинаковые кнопки на одном
      экране — лишнее. Тот же приём, что в src/js/cart/cart-page.js.

   2. Способ получения на /checkout. Сервер рисует оба блока — адрес
      и бутик, — потому что без скрипта переключатель ничего бы не
      переключал. Со скриптом виден только выбранный. Разметка:
        <input type="radio" name="method" value="delivery|pickup">
        <div class="co-panel" data-panel="delivery"> … </div>
        <div class="co-panel" data-panel="pickup"> … </div>
      Скрытые поля адреса сервер при самовывозе и так не проверяет.

   3. Выбор «одной / двумя доставками» на /checkout. Сервер рисует оба
      подблока, без скрипта виден и тот и другой; проверяются подблоки
      двух доставок только при выбранном «двумя». Со скриптом виден только
      выбранный, подписи карточек меняются вместе со способом получения
      («доставкой» / «визитом»), строка «Доставка» в сводке — тоже:
        <input type="radio" name="split" value="one|two">
        <div class="split" data-split-texts='{"delivery":{"one":[…]}}'>
        <div class="co-panel" data-split-panel="one|two"> … </div>
        <dd data-summary-delivery data-delivery data-delivery-two data-pickup>

   4. Серверный тост (.toast[data-server-toast]) после добавления в корзину
      или в заявку: сервер рисует его видимым, скрипт прячет через 4,5 с,
      как src/js/cart/toast.js, и не прячет, пока на нём курсор или фокус.
   ============================================================================ */

export function hydrateCartBar(root = document) {
  const bar = root.querySelector('.cart-bar')
  const action = root.querySelector('.cart__aside .summary__action')
  if (!bar || !action || !('IntersectionObserver' in window)) return

  new IntersectionObserver(([entry]) => {
    bar.classList.toggle('is-hidden', entry.isIntersecting)
  }).observe(action)
}

export function hydrateReceiveMethod(root = document) {
  const form = root.querySelector('#checkout-form')
  const panels = form ? [...form.querySelectorAll('[data-panel]')] : []
  if (!panels.length) return

  const summaryDelivery = root.querySelector('[data-summary-delivery]')
  const splitPanels = [...form.querySelectorAll('[data-split-panel]')]
  const splitBox = form.querySelector('[data-split-texts]')
  let splitTexts = null
  try {
    splitTexts = splitBox ? JSON.parse(splitBox.dataset.splitTexts) : null
  } catch {
    splitTexts = null
  }

  const apply = () => {
    const method = form.querySelector('input[name="method"]:checked')?.value || 'delivery'
    const split = form.querySelector('input[name="split"]:checked')?.value || 'one'
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== method
    })
    splitPanels.forEach((panel) => {
      panel.hidden = panel.dataset.splitPanel !== split
    })
    if (splitTexts?.[method]) {
      ;['one', 'two'].forEach((key) => {
        const label = form.querySelector(`[data-split-label="${key}"]`)
        const sub = form.querySelector(`[data-split-sub="${key}"]`)
        if (label) label.textContent = splitTexts[method][key][0]
        if (sub) sub.textContent = splitTexts[method][key][1]
      })
    }
    if (summaryDelivery) {
      summaryDelivery.textContent =
        method === 'pickup'
          ? summaryDelivery.dataset.pickup
          : split === 'two'
            ? summaryDelivery.dataset.deliveryTwo
            : summaryDelivery.dataset.delivery
    }
  }

  form.addEventListener('change', (event) => {
    if (event.target.name === 'method' || event.target.name === 'split') apply()
  })
  apply()
}

/** Серверный тост: прячется сам, пока на нём нет курсора или фокуса. */
export function hydrateServerToast(root = document) {
  const toast = root.querySelector('.toast[data-server-toast]')
  if (!toast) return

  let timer = null
  const hide = () => {
    clearTimeout(timer)
    timer = setTimeout(() => toast.classList.remove('is-visible'), 4500)
  }
  toast.addEventListener('pointerenter', () => clearTimeout(timer))
  toast.addEventListener('focusin', () => clearTimeout(timer))
  toast.addEventListener('pointerleave', hide)
  toast.addEventListener('focusout', hide)
  hide()
}
