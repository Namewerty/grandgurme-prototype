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

  const apply = () => {
    const method = form.querySelector('input[name="method"]:checked')?.value || 'delivery'
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== method
    })
    if (summaryDelivery) {
      summaryDelivery.textContent =
        method === 'pickup' ? summaryDelivery.dataset.pickup : summaryDelivery.dataset.delivery
    }
  }

  form.addEventListener('change', (event) => {
    if (event.target.name === 'method') apply()
  })
  apply()
}
