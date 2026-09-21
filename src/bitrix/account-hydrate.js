/* ============================================================================
   Кабинет и избранное на серверной разметке Битрикса.

   Страницы кабинета, сердца в каталоге и на карточке, шаг с кодом — обычные
   формы, и без скрипта они работают (include/favorites.php, include/account.php,
   deploy-src/account/**). Скрипт только делает удобнее:

     1. Сердце не перезагружает страницу: форма уходит запросом с
        gg_fav_ajax=Y, сервер отвечает JSON, и все сердца этого товара на
        странице, счётчик в шапке, строка мобильного меню и число в меню
        кабинета обновляются разом. Тост — тот же, что в прототипе:
        «Добавили в избранное · Перейти» и «Убрали из избранного · Вернуть».
        На /favorites/ убранная карточка сворачивается и уходит из сетки,
        последняя — сменяется пустым состоянием; «Вернуть» ставит её обратно.
     2. Поле кода: цифры в ячейках, автоотправка, когда введены все, таймер
        повторной отправки идёт, по нулю появляется кнопка.
     3. Оформление: поля нового адреса видны, только когда выбран «Другой адрес».
     4. Подтверждение удаления кабинета открывается модальным окном.

   Тексты — src/data/account-copy.js, как в прототипе.
   ============================================================================ */

import { accountCopy } from '../data/account-copy.js'
import { plural } from '../js/catalog/model.js'
import { showToast } from '../js/cart/toast.js'

const favCopy = accountCopy.favorites
const headerCopy = accountCopy.header

const fill = (template, values) => String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
const goodsLabel = (n) => `${n} ${plural(n, ...accountCopy.plurals.goods)}`
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/* ------------------------------------------------------------ избранное */

function paintHeart(button, active) {
  button.classList.toggle('is-active', active)
  button.setAttribute('aria-pressed', String(active))
  const name = button.dataset.favName || ''
  button.setAttribute('aria-label', `${active ? favCopy.remove : favCopy.add}: ${name}`)
}

/** Все сердца товара и поля их форм — в одно состояние. */
function syncHearts(id, active) {
  document.querySelectorAll(`[data-fav-id="${CSS.escape(String(id))}"]`).forEach((button) => {
    paintHeart(button, active)
    const form = button.form
    const field = form?.querySelector('input[name="gg_fav_action"]')
    if (field) field.value = active ? 'remove' : 'add'
  })
}

/** Счётчик в шапке и строка «Избранное · n» в мобильном меню. */
function paintCount(n) {
  const link = document.querySelector('.header__actions .fav-btn')
  const badge = link?.querySelector('.fav-btn__count')
  if (badge) {
    badge.dataset.count = String(n)
    badge.textContent = String(n)
  }
  const label = link?.querySelector('.visually-hidden')
  if (label) label.textContent = n ? fill(headerCopy.favoritesLabel, { n }) : headerCopy.menuFavorites

  const menu = document.querySelector('.nav-panel__meta a[href^="/favorites"]')
  if (menu) menu.textContent = n ? fill(headerCopy.menuFavoritesCount, { n }) : headerCopy.menuFavorites

  // Кабинет: число у пункта «Избранное» в боковом меню и в строках обзора.
  document.querySelectorAll('.acc__link[href^="/favorites"] .acc__count, .acc-rows__row[href^="/favorites"] .acc-rows__count').forEach((count) => {
    count.textContent = n > 0 ? String(n) : ''
  })
}

/* ---------------------------------------------- страница /favorites/ */

const COLLAPSE_MS = 250
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Пустое состояние — та же разметка, что отдаёт deploy-src/favorites/index.php. */
function favEmpty() {
  const box = document.createElement('div')
  box.className = 'acc-empty'
  box.dataset.favEmpty = ''
  const icon = document.createElement('span')
  icon.className = 'acc-empty__icon'
  icon.setAttribute('aria-hidden', 'true')
  const heart = document.querySelector('.header__actions .fav-btn svg')
  if (heart) icon.appendChild(heart.cloneNode(true))
  const title = document.createElement('h2')
  title.className = 'acc-empty__title'
  title.textContent = favCopy.empty.title
  const text = document.createElement('p')
  text.className = 'acc-empty__text'
  text.textContent = favCopy.empty.text
  const link = document.createElement('a')
  link.className = 'btn btn--solid'
  link.href = favCopy.empty.action.href
  link.textContent = favCopy.empty.action.label
  box.append(icon, title, text, link)
  return box
}

/** Подпись «n товаров», плашка гостя, капсулы и пустое состояние — по числу. */
function paintFavPage(page, n) {
  const grid = page.querySelector('.fav__grid')
  const sub = page.querySelector('.acc-sub')
  if (sub) {
    sub.textContent = goodsLabel(n)
    sub.style.display = n ? '' : 'none'
  }
  page.querySelectorAll('.fav__guest, .fav__caps').forEach((node) => {
    node.style.display = n ? '' : 'none'
  })
  let empty = page.querySelector('[data-fav-empty]')
  if (n) {
    empty?.remove()
    if (grid) grid.style.display = ''
    return
  }
  if (grid) grid.style.display = 'none'
  if (!empty) {
    empty = favEmpty()
    ;(grid || page.lastElementChild).after(empty)
  }
}

/** Убрали сердцем на /favorites/: карточка сворачивается и уходит из сетки. */
function leaveCard(card, page, n) {
  card.classList.add('is-leaving')
  setTimeout(() => {
    if (!card.classList.contains('is-leaving')) return
    card.style.display = 'none'
    paintFavPage(page, n)
  }, REDUCED ? 0 : COLLAPSE_MS)
}

/** «Вернуть»: карточка на прежнем месте. */
function returnCard(card, page, n) {
  card.classList.remove('is-leaving')
  card.style.display = ''
  paintFavPage(page, n)
}

async function sendFavorite(form, action, index) {
  const body = new FormData(form)
  body.set('gg_fav_action', action)
  body.set('gg_fav_ajax', 'Y')
  if (index !== undefined) body.set('gg_fav_index', String(index))

  const response = await fetch(form.action || location.href, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) throw new Error(`favorites: ${response.status}`)
  return response.json()
}

function hydrateFavorites(root) {
  root.addEventListener('submit', async (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.matches('.fav-form')) return
    event.preventDefault()

    const action = form.querySelector('input[name="gg_fav_action"]')?.value || 'add'
    // Сердце в сетке /favorites/: у кнопки может быть атрибут form, поэтому
    // карточку ищем от самой кнопки, а не от формы.
    const heart = form.querySelector('[data-fav-id]') || document.querySelector(`[form="${CSS.escape(form.id)}"][data-fav-id]`)
    const card = heart?.closest('.fav__grid .product') || null
    const page = card?.closest('.fav') || null
    try {
      const result = await sendFavorite(form, action)
      syncHearts(result.id, result.active)
      paintCount(result.count)

      if (result.active) {
        if (card) returnCard(card, page, result.count)
        showToast(favCopy.toastAdded, { label: favCopy.toastAddedAction.label, href: '/favorites/' })
      } else {
        if (card) leaveCard(card, page, result.count)
        const undoIndex = result.undoIndex
        showToast(favCopy.toastRemoved, {
          label: favCopy.toastUndo,
          onClick: async () => {
            const back = await sendFavorite(form, 'restore', Math.max(0, undoIndex))
            syncHearts(back.id, back.active)
            paintCount(back.count)
            if (card && back.active) returnCard(card, page, back.count)
          },
        })
      }
    } catch {
      // Запрос не прошёл — отправляем форму обычным способом.
      form.submit()
    }
  })
}

/* ------------------------------------------------------------- поле кода */

function hydrateCodeInput(node) {
  const input = node.querySelector('.code-input__field')
  const cells = [...node.querySelectorAll('.code-input__cell')]
  if (!input || !cells.length) return

  const length = cells.length
  let completed = ''

  const paint = () => {
    const digits = input.value.replace(/\D/g, '').slice(0, length)
    const focused = document.activeElement === input && !input.disabled
    cells.forEach((cell, i) => {
      cell.textContent = digits[i] || ''
      cell.classList.toggle('is-filled', Boolean(digits[i]))
      cell.classList.toggle('is-active', focused && i === Math.min(digits.length, length - 1))
    })
  }

  node.classList.add('is-hydrated')
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, length)
    if (digits !== input.value) input.value = digits
    paint()
    if (digits.length < length) {
      completed = ''
      return
    }
    if (digits === completed) return
    completed = digits
    // Автоотправка той же кнопкой, что и вручную: у кнопки name и value.
    const form = input.form
    const submit = form?.querySelector('.code-step__submit')
    if (form && submit && !submit.disabled) {
      submit.disabled = true
      form.requestSubmit ? form.requestSubmit(submit) : submit.click()
    }
  })
  input.addEventListener('focus', paint)
  input.addEventListener('blur', paint)
  input.addEventListener('click', () => input.setSelectionRange(input.value.length, input.value.length))
  paint()
}

function hydrateResendTimer(timer) {
  const box = timer.closest('.code-step__resend')
  const button = box?.querySelector('[data-resend-button]')
  const live = timer.closest('.code-step')?.querySelector('[data-resend-live]')
  let left = Number(timer.dataset.resendIn) || 0

  const tick = () => {
    left -= 1
    if (left > 0) {
      timer.textContent = fill(accountCopy.login.code.timer, { time: clock(left) })
      return
    }
    clearInterval(handle)
    timer.remove()
    if (button) button.hidden = false
    if (live) live.textContent = accountCopy.login.code.resendReady
  }
  const handle = setInterval(tick, 1000)
}

/* ------------------------------------------------------------- оформление */

function hydrateAddressChoice(root) {
  const fields = root.querySelector('[data-new-address]')
  const radios = [...root.querySelectorAll('input[type="radio"][name="address"]')]
  if (!fields || !radios.length) return

  const apply = () => {
    const choice = radios.find((radio) => radio.checked)?.value || 'new'
    const isNew = choice === 'new'
    // Поля не выключаются, только прячутся: при выбранном сохранённом адресе
    // сервер заполняет их сам (deploy-src/checkout/index.php).
    fields.hidden = !isNew
  }
  radios.forEach((radio) => radio.addEventListener('change', apply))
  apply()
}

/* --------------------------------------------------------------- окно */

function hydrateDialog(dialog) {
  if (typeof dialog.showModal !== 'function' || !dialog.open) return
  // Сервер отдаёт <dialog open>; модальным его делает только showModal().
  dialog.close()
  dialog.showModal()
  const back = dialog.querySelector('a[href]')
  dialog.addEventListener('cancel', (event) => {
    if (!back) return
    event.preventDefault()
    location.assign(back.href)
  })
}

/* ------------------------------------------------------------------ вход */

export function hydrateAccount(root = document) {
  hydrateFavorites(root)
  root.querySelectorAll('.code-input').forEach(hydrateCodeInput)
  root.querySelectorAll('[data-resend-timer]').forEach(hydrateResendTimer)
  hydrateAddressChoice(root)
  root.querySelectorAll('dialog.dialog[open]').forEach(hydrateDialog)
}
