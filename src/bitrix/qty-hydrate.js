/* ============================================================================
   Степпер количества на серверной разметке Битрикса.

   В прототипе степпер собирает скрипт (js/components/qty-stepper.js). На
   Битриксе карточка товара и корзина рисуются PHP, и степпер приходит готовой
   разметкой внутри обычной формы — без JS форма всё равно отправляет число
   из поля. Здесь только оживляются кнопки − и +.

   Разметка, которую ждёт скрипт (классы — те же, что у компонента прототипа):

     <div class="qty" data-qty-hydrate>                 ← или data-qty-hydrate="submit"
       <button type="button" class="qty__btn" data-step="-1" aria-label="Меньше">…</button>
       <input class="qty__value" name="quantity" value="1" min="1" max="99" inputmode="numeric">
       <button type="button" class="qty__btn" data-step="1" aria-label="Больше">…</button>
     </div>

   data-qty-hydrate="submit" — после изменения форма отправляется сама:
   так строка корзины пересчитывается сервером без отдельной кнопки «Обновить».
   ============================================================================ */

export function hydrateQtySteppers(root = document) {
  root.querySelectorAll('.qty[data-qty-hydrate]').forEach((box) => {
    const input = box.querySelector('.qty__value')
    if (!input || box.dataset.qtyReady) return
    box.dataset.qtyReady = '1'

    const min = Number(input.min || 1)
    const max = Number(input.max || 99)
    const autoSubmit = box.dataset.qtyHydrate === 'submit'
    const clamp = (value) => Math.max(min, Math.min(max, Number.parseInt(value, 10) || min))

    const paint = () => {
      const value = clamp(input.value)
      box.querySelectorAll('[data-step]').forEach((button) => {
        button.disabled = Number(button.dataset.step) < 0 ? value <= min : value >= max
      })
    }

    const commit = (next) => {
      const value = clamp(next)
      if (String(value) === input.value) return paint()
      input.value = String(value)
      paint()
      if (autoSubmit) input.form?.requestSubmit()
    }

    box.addEventListener('click', (event) => {
      const button = event.target.closest('[data-step]')
      if (!button || button.disabled) return
      commit(clamp(input.value) + Number(button.dataset.step))
    })

    input.addEventListener('change', () => commit(input.value))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !autoSubmit) event.preventDefault()
    })

    paint()
  })
}
