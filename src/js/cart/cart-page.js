/* ============================================================================
   Страница /cart.

   ГРАММАТИКА САЙТА, А НЕ МАГАЗИННЫЙ ШАБЛОН. Строки состава разделены
   волосяными линиями, без рамок и заливок — как города в #offline и пункты
   #why. Карточка с заливкой одна: липкая сводка справа (см. summary.css).

   ПЕРЕРИСОВЫВАЕТСЯ ТОЧЕЧНО. Страница подписана на cart:change и на каждое
   изменение сверяет строки по id: новые добавляет, пропавшие убирает,
   у остальных обновляет количество и сумму. Перерисовка всего списка на
   каждое нажатие «+» сбрасывала бы фокус со степпера, и с клавиатуры
   прибавить три банки подряд было бы нельзя.

   Хранилища страница не знает: только API store.js. Функции разметки
   принимают простой объект позиции.
   ============================================================================ */

import gsap from 'gsap'
import { cartCopy } from '../../data/cart-copy.js'
import { ROUTES } from '../../data/routes.js'
import { escapeHtml } from '../catalog/model.js'
import { createImage } from '../media.js'
import { icons } from '../icons.js'
import { createQtyStepper } from '../components/qty-stepper.js'
import * as cart from './store.js'
import { inStockFirst, lineNote, lineSumLabel, positionsLabel, summaryTexts } from './summary.js'

const copy = cartCopy
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* -------------------------------------------------------------- разметка */

function skeleton() {
  return `
    <div class="container">
      <nav class="crumbs" aria-label="Хлебные крошки">
        <a href="${ROUTES.home}">${copy.crumbs.home}</a>
        <span class="crumbs__sep" aria-hidden="true"></span>
        <span class="crumbs__current" aria-current="page">${copy.crumbs.current}</span>
      </nav>

      <div class="cart__head">
        <h1 class="cart__title" tabindex="-1" data-cart-title>${copy.title}</h1>
        <p class="cart__positions" data-positions aria-live="polite"></p>
      </div>

      <div data-cart-body></div>
    </div>`
}

function layout() {
  const s = copy.summary
  return `
    <div class="cart__layout">
      <ul class="cart-list" data-lines aria-label="${copy.listLabel}"></ul>

      <aside class="cart__aside summary-sticky" aria-label="${s.title}">
        <p class="ready-line cart__ready">
          <span class="ready-line__mark" aria-hidden="true">⬦</span><span data-ready></span>
        </p>

        <div class="summary">
          <h2 class="summary__title">${s.title}</h2>
          <dl class="summary__rows">
            <div class="summary__row"><dt>${s.count}</dt><dd data-count></dd></div>
            <div class="summary__row"><dt>${s.sum}</dt><dd data-sum></dd></div>
            <div class="summary__row" data-onrequest-row hidden><dt>${s.onRequest}</dt><dd data-onrequest></dd></div>
            <div class="summary__row"><dt>${s.delivery}</dt><dd>${s.deliveryValue}</dd></div>
          </dl>
          <p class="summary__total">
            <span>${s.total}</span>
            <span class="summary__total-value" data-total aria-live="polite"></span>
          </p>
          <p class="summary__note" data-note hidden></p>

          <a class="btn btn--solid summary__action" href="${ROUTES.checkout}" data-checkout></a>

          <div class="cart__promo">
            <button type="button" class="link-btn" data-promo-toggle
                    aria-expanded="false" aria-controls="cart-promo">${s.promoToggle}</button>
            <div class="cart__promo-field" id="cart-promo" hidden>
              <label class="field__label" for="cart-promo-input">${s.promoLabel}</label>
              <input class="field__input" id="cart-promo-input" type="text" autocomplete="off"
                     aria-describedby="cart-promo-hint">
              <p class="field__hint" id="cart-promo-hint">${s.promoHint}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div class="cart-bar" data-cart-bar>
      <p class="cart-bar__total">
        <span class="cart-bar__label">${s.total}</span>
        <span class="cart-bar__value" data-bar-total></span>
      </p>
      <a class="btn btn--solid" href="${ROUTES.checkout}" data-bar-checkout></a>
    </div>`
}

function emptyState() {
  const e = copy.empty
  return `
    <div class="cart-empty">
      <h2 class="cart-empty__title">${e.title}</h2>
      <p class="cart-empty__text">${e.text}</p>
      <div class="cart-empty__actions">
        ${e.actions
          .map(
            ({ label, href }, i) =>
              `<a class="btn${i === 0 ? ' btn--solid' : ''}" href="${href}">${label}</a>`,
          )
          .join('')}
      </div>
    </div>`
}

/**
 * Строка позиции. Принимает простой объект позиции и обработчики —
 * о корзине не знает ничего.
 */
function createLine(line, { onQty, onRemove }) {
  const node = document.createElement('li')
  node.className = 'cart-line'
  node.dataset.id = line.id

  const name = escapeHtml(line.name)
  node.innerHTML = `
    <a class="cart-line__shot" href="${line.href}" tabindex="-1" aria-hidden="true"></a>
    <div class="cart-line__body">
      <h2 class="cart-line__name"><a href="${line.href}">${name}</a></h2>
      <button type="button" class="icon-btn cart-line__remove" data-remove
              aria-label="${copy.line.remove}: ${name}">${icons.close}</button>
      <p class="cart-line__note" data-line-note></p>
      <span data-line-qty></span>
      <p class="cart-line__sum" data-line-sum></p>
    </div>`

  // Кадр позиции витрины без выгрузки может отсутствовать — тогда остаётся
  // пустой квадрат на --surface, а не заглушка с подписью «undefined».
  if (line.image) {
    node.querySelector('.cart-line__shot').appendChild(
      createImage({ src: line.image, alt: '', ratio: '1:1', className: 'cart-line__photo media--compact' }),
    )
  }

  const stepper = createQtyStepper({
    value: line.qty,
    size: 'sm',
    max: cart.MAX_QTY,
    label: `${copy.line.qty}: ${line.name}`,
    decrease: copy.line.decrease,
    increase: copy.line.increase,
    onChange: (qty) => onQty(line.id, qty),
    onZero: () => onRemove(line.id),
  })
  stepper.node.classList.add('cart-line__qty')
  node.querySelector('[data-line-qty]').replaceWith(stepper.node)

  node.querySelector('[data-remove]').addEventListener('click', () => onRemove(line.id))

  const note = node.querySelector('[data-line-note]')
  const sum = node.querySelector('[data-line-sum]')

  return {
    node,
    update(next) {
      node.classList.toggle('is-preorder', !next.inStock)
      note.textContent = lineNote(next)
      sum.textContent = lineSumLabel(next)
      sum.classList.toggle('is-request', next.price == null)
      if (stepper.value !== next.qty) stepper.set(next.qty)
    },
  }
}

/* -------------------------------------------------------------- страница */

export function initCartPage(mount) {
  if (!mount) return

  document.title = `${copy.title} — №1 Гранд Гурмэ`
  mount.className = 'page-cart'
  mount.innerHTML = skeleton()

  const title = mount.querySelector('[data-cart-title]')
  const positions = mount.querySelector('[data-positions]')
  const body = mount.querySelector('[data-cart-body]')

  /** Строки по id. Живут, пока открыт непустой список. */
  const rows = new Map()
  let els = null
  let barObserver = null

  /** После удаления фокус не должен улетать в начало страницы. */
  let focusAfterRemove = null

  const handlers = {
    onQty: (id, qty) => cart.setQty(id, qty),
    onRemove: (id) => removeLine(id),
  }

  function removeLine(id) {
    const row = rows.get(id)
    const ordered = [...(els?.lines.children || [])]
    const at = ordered.indexOf(row?.node)
    const neighbour = ordered[at + 1] || ordered[at - 1]
    focusAfterRemove = neighbour ? neighbour.dataset.id : 'title'

    if (!row || REDUCED) {
      cart.remove(id)
      return
    }

    // Строка схлопывается, а не пропадает рывком: соседние строки подтягиваются,
    // и глаз видит, куда делась позиция.
    row.node.style.overflow = 'hidden'
    gsap.to(row.node, {
      opacity: 0,
      height: 0,
      paddingTop: 0,
      paddingBottom: 0,
      duration: 0.28,
      ease: 'power2.inOut',
      onComplete: () => cart.remove(id),
    })
  }

  function ensureLayout() {
    if (els) return els

    body.innerHTML = layout()
    els = {
      lines: body.querySelector('[data-lines]'),
      ready: body.querySelector('[data-ready]'),
      count: body.querySelector('[data-count]'),
      sum: body.querySelector('[data-sum]'),
      onRequestRow: body.querySelector('[data-onrequest-row]'),
      onRequest: body.querySelector('[data-onrequest]'),
      total: body.querySelector('[data-total]'),
      note: body.querySelector('[data-note]'),
      checkout: body.querySelector('[data-checkout]'),
      bar: body.querySelector('[data-cart-bar]'),
      barTotal: body.querySelector('[data-bar-total]'),
      barCheckout: body.querySelector('[data-bar-checkout]'),
    }

    wirePromo(body)

    // Липкая полоса внизу мобильного экрана прячется, когда в кадре уже есть
    // кнопка самой сводки: две одинаковые кнопки на одном экране — лишнее.
    if ('IntersectionObserver' in window) {
      barObserver = new IntersectionObserver(([entry]) => {
        els?.bar.classList.toggle('is-hidden', entry.isIntersecting)
      })
      barObserver.observe(els.checkout)
    }

    return els
  }

  function wirePromo(root) {
    const toggle = root.querySelector('[data-promo-toggle]')
    const field = root.querySelector('#cart-promo')
    const input = root.querySelector('#cart-promo-input')

    input.value = cart.getPromo()
    const setOpen = (open) => {
      field.hidden = !open
      toggle.setAttribute('aria-expanded', String(open))
    }
    setOpen(Boolean(input.value))

    toggle.addEventListener('click', () => {
      const open = field.hidden
      setOpen(open)
      if (open) input.focus()
    })
    input.addEventListener('change', () => cart.setPromo(input.value))
  }

  function renderEmpty() {
    rows.clear()
    barObserver?.disconnect()
    barObserver = null
    els = null
    body.innerHTML = emptyState()
  }

  function paintSummary(totals) {
    const t = summaryTexts(totals)
    els.ready.textContent = t.ready
    els.count.textContent = t.count
    els.sum.textContent = t.sum
    els.onRequestRow.hidden = !t.onRequest
    els.onRequest.textContent = t.onRequest
    els.total.textContent = t.total
    els.total.classList.toggle('is-text', t.allOnRequest)
    els.barTotal.classList.toggle('is-text', t.allOnRequest)
    els.note.hidden = !t.note
    els.note.textContent = t.note
    els.checkout.textContent = t.checkout
    els.barTotal.textContent = t.total
    els.barCheckout.textContent = t.checkout
  }

  function sync() {
    const items = cart.getItems()
    const totals = cart.getTotals()

    positions.textContent = items.length ? positionsLabel(totals.positions) : ''

    if (!items.length) {
      renderEmpty()
      if (focusAfterRemove) title.focus()
      focusAfterRemove = null
      return
    }

    const { lines } = ensureLayout()
    const ordered = inStockFirst(items)
    const ids = new Set(ordered.map((line) => line.id))

    rows.forEach((row, id) => {
      if (ids.has(id)) return
      row.node.remove()
      rows.delete(id)
    })

    ordered.forEach((line, index) => {
      let row = rows.get(line.id)
      if (!row) {
        row = createLine(line, handlers)
        rows.set(line.id, row)
      }
      row.update(line)
      const current = lines.children[index]
      if (current !== row.node) lines.insertBefore(row.node, current || null)
    })

    paintSummary(totals)

    if (focusAfterRemove) {
      const target =
        focusAfterRemove === 'title' ? title : rows.get(focusAfterRemove)?.node.querySelector('.cart-line__name a')
      ;(target || title).focus()
      focusAfterRemove = null
    }
  }

  sync()
  cart.subscribe(sync)
}
