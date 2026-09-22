/* ============================================================================
   Страница /cart.

   ГРАММАТИКА САЙТА, А НЕ МАГАЗИННЫЙ ШАБЛОН. Строки состава разделены
   волосяными линиями, без рамок и заливок — как города в #offline и пункты
   #why. Карточка с заливкой одна: липкая сводка справа (см. summary.css).

   ГРУППЫ ПО ВИДУ ПОЗИЦИИ: «В наличии», «Под заказ», «Заявка менеджеру»
   (src/data/fulfillment.js). Пустая группа не рисуется, а заголовки
   показываются всегда, даже когда группа одна: строка под заголовком —
   это и есть обещание по срокам. Прежняя строка готовности над сводкой
   («Соберём сегодня…», «Заказ будет готов…») ушла — её заменили группы.

   ПЕРЕРИСОВЫВАЕТСЯ ТОЧЕЧНО. Страница подписана на cart:change и на каждое
   изменение сверяет строки по id: новые добавляет, пропавшие убирает,
   у остальных обновляет количество и сумму. Перерисовка всего списка на
   каждое нажатие «+» сбрасывала бы фокус со степпера, и с клавиатуры
   прибавить три банки подряд было бы нельзя.

   КОРОБКИ (src/data/boxes.js, с 23.09.2026 выбор в карточке и здесь).
   У коробочной строки в наличии под названием выбранные веса и ссылка
   «Выбрать другие» → окно выбора (box-dialog.js); «+» и «−» степпера
   добавляют и снимают коробки сами (store.js → fitPacks), сумма точная.

   Хранилища страница не знает: только API store.js. Функции разметки
   принимают простой объект позиции.
   ============================================================================ */

import gsap from 'gsap'
import { cartCopy } from '../../data/cart-copy.js'
import { KINDS } from '../../data/fulfillment.js'
import { ROUTES } from '../../data/routes.js'
import { escapeHtml } from '../catalog/model.js'
import { createImage } from '../media.js'
import { icons } from '../icons.js'
import { createQtyStepper } from '../components/qty-stepper.js'
import { kindIcon } from '../components/stock-tag.js'
import { getFreePacks } from './boxes.js'
import { openBoxDialog } from './box-dialog.js'
import * as cart from './store.js'
import { boxNote, fillText, groupLead, lineSum, lineSumLabel, positionsLabel, summaryTexts } from './summary.js'

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

const group = (kind) => `
  <section class="cart-group" aria-labelledby="cart-group-${kind}" data-group="${kind}" hidden>
    <div class="cart-group__head">
      <h2 class="cart-group__title" id="cart-group-${kind}">${copy.groups[kind].title}</h2>
      <p class="cart-group__count" data-group-count></p>
    </div>
    <p class="cart-group__lead cart-group__lead--${kind}">
      <span class="cart-group__icon" aria-hidden="true">${kindIcon(kind)}</span><span data-group-lead></span>
    </p>
    ${
      /* Подсказка про раздельную доставку стоит у срока, который она
         предлагает обойти, а не под суммой заказа: там она читалась
         условием оплаты. */
      kind === 'preorder'
        ? `<p class="cart-group__hint" data-split-hint hidden>${copy.summary.splitHint}</p>`
        : ''
    }
    <ul class="cart-list" data-lines aria-label="${copy.groups[kind].title}"></ul>
  </section>`

function layout() {
  const s = copy.summary
  return `
    <div class="cart__layout">
      <div class="cart__groups" aria-label="${copy.listLabel}" role="region">
        ${KINDS.map(group).join('')}
      </div>

      <aside class="cart__aside summary-sticky" aria-label="${s.title}">
        <div class="summary">
          <div class="summary__order" data-order-block>
            <h2 class="summary__title">${s.title}</h2>
            <dl class="summary__rows">
              <div class="summary__row"><dt>${s.count}</dt><dd data-count></dd></div>
              <div class="summary__row"><dt>${s.sum}</dt><dd data-sum></dd></div>
              <div class="summary__row"><dt>${s.delivery}</dt><dd>${s.deliveryValue}</dd></div>
            </dl>
            <p class="summary__total">
              <span>${s.total}</span>
              <span class="summary__total-value" data-total aria-live="polite"></span>
            </p>
            <p class="summary__note" data-approx-note hidden></p>
          </div>

          <div class="summary__request" data-request-block hidden>
            <h2 class="summary__subtitle">${s.requestTitle}</h2>
            <p class="summary__note" data-request-note aria-live="polite"></p>
          </div>

          <a class="btn btn--solid summary__action" href="${ROUTES.checkout}" data-checkout></a>

          <div class="cart__promo" data-promo>
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
        <span class="cart-bar__label" data-bar-label></span>
        <span class="cart-bar__value" data-bar-total></span>
      </p>
      <a class="btn btn--solid cart-bar__action" href="${ROUTES.checkout}">
        <span class="cart-bar__long" data-bar-checkout></span><span class="cart-bar__short" aria-hidden="true">${copy.bar.short}</span>
      </a>
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
function createLine(line, { onQty, onRemove, onPick }) {
  const node = document.createElement('li')
  node.className = 'cart-line'
  node.dataset.id = line.id

  const name = escapeHtml(line.name)
  // Ссылка «Выбрать другие» — только у коробок в наличии: под заказ выбирать не из чего.
  const canPick = Boolean(line.boxes) && line.kind === 'stock'
  node.innerHTML = `
    <a class="cart-line__shot" href="${line.href}" tabindex="-1" aria-hidden="true"></a>
    <div class="cart-line__body">
      <h3 class="cart-line__name"><a href="${line.href}">${name}</a></h3>
      <button type="button" class="icon-btn cart-line__remove" data-remove
              aria-label="${copy.line.remove}: ${name}">${icons.close}</button>
      <p class="cart-line__note"><span data-line-note></span>${
        canPick
          ? ` <button type="button" class="link-btn cart-line__pick" data-pick
                      aria-label="${escapeHtml(fillText(copy.boxes.pickLabel, { name: line.name }))}"></button>`
          : ''
      }</p>
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

  // Коробки в наличии: не больше свободных коробок на складе.
  const stepper = createQtyStepper({
    value: line.qty,
    size: 'sm',
    max: cart.maxQtyOf(line.id),
    label: `${copy.line.qty}: ${line.name}`,
    decrease: copy.line.decrease,
    increase: copy.line.increase,
    onChange: (qty) => onQty(line.id, qty),
    onZero: () => onRemove(line.id),
  })
  stepper.node.classList.add('cart-line__qty')
  node.querySelector('[data-line-qty]').replaceWith(stepper.node)

  node.querySelector('[data-remove]').addEventListener('click', () => onRemove(line.id))
  node.querySelector('[data-pick]')?.addEventListener('click', () => onPick(line.id))

  const noteRow = node.querySelector('.cart-line__note')
  const note = node.querySelector('[data-line-note]')
  const pick = node.querySelector('[data-pick]')
  const sum = node.querySelector('[data-line-sum]')

  return {
    node,
    update(next) {
      // Приписки наличия в строке больше нет: срок сказан заголовком группы.
      // У коробок подпись — выбранные веса (boxNote), рядом «Выбрать другие».
      const text = boxNote(next) ?? next.note
      note.textContent = text
      noteRow.hidden = !text && !pick
      if (pick) pick.textContent = next.qty === 1 ? copy.boxes.pickOne : copy.boxes.pick
      sum.textContent = lineSumLabel(next)
      sum.classList.toggle('is-request', next.price == null)
      // Сумма позиции заявки в итог не входит — пишется приглушённо.
      sum.classList.toggle('is-estimate', next.kind === 'request' && next.price != null)
      sum.classList.toggle('is-approx', lineSum(next).approx)
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
    onPick: (id) => pickBoxes(id),
  }

  /** «Выбрать другие»: окно со свободными коробками; фокус возвращается на ссылку. */
  async function pickBoxes(id) {
    const line = cart.getItems().find((item) => item.id === id)
    if (!line?.boxes) return
    const free = await getFreePacks(line.slug)
    const ids = await openBoxDialog({
      name: line.name,
      pricePerKg: line.boxes.pricePerKg,
      nominalG: line.boxes.nominalG,
      n: line.qty,
      free,
      selected: line.boxes.packIds,
    })
    if (ids) cart.setPacks(id, ids)
    rows.get(id)?.node.querySelector('[data-pick]')?.focus({ preventScroll: true })
  }

  function removeLine(id) {
    const row = rows.get(id)
    // Соседняя строка ищется по всей корзине, а не внутри группы: последняя
    // строка группы отдаёт фокус первой строке следующей.
    const ordered = [...(body.querySelectorAll('.cart-line') || [])]
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
    const groups = Object.fromEntries(
      KINDS.map((kind) => {
        const node = body.querySelector(`[data-group="${kind}"]`)
        return [
          kind,
          {
            node,
            lines: node.querySelector('[data-lines]'),
            count: node.querySelector('[data-group-count]'),
            lead: node.querySelector('[data-group-lead]'),
          },
        ]
      }),
    )

    els = {
      groups,
      orderBlock: body.querySelector('[data-order-block]'),
      count: body.querySelector('[data-count]'),
      sum: body.querySelector('[data-sum]'),
      total: body.querySelector('[data-total]'),
      approxNote: body.querySelector('[data-approx-note]'),
      splitHint: body.querySelector('[data-split-hint]'),
      requestBlock: body.querySelector('[data-request-block]'),
      requestNote: body.querySelector('[data-request-note]'),
      checkout: body.querySelector('[data-checkout]'),
      promo: body.querySelector('[data-promo]'),
      bar: body.querySelector('[data-cart-bar]'),
      barLabel: body.querySelector('[data-bar-label]'),
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

    els.orderBlock.hidden = !t.showOrder
    // Промокод — только к заказу: к заявке его применить не к чему.
    els.promo.hidden = !t.showOrder
    els.count.textContent = t.count
    els.sum.textContent = t.sum
    els.total.textContent = t.total
    // Коробки без выбранного веса: «≈» в сумме и строка под итогом.
    els.approxNote.textContent = t.approxNote
    els.approxNote.hidden = !t.approxNote
    els.splitHint.hidden = !t.splitHint

    els.requestBlock.hidden = !t.showRequest
    els.requestBlock.classList.toggle('is-alone', !t.showOrder)
    els.requestNote.textContent = t.requestNote

    els.checkout.textContent = t.checkout
    els.barLabel.textContent = t.bar.label
    els.barTotal.textContent = t.bar.value
    els.barTotal.classList.toggle('is-text', t.bar.isText)
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

    const { groups } = ensureLayout()
    const ids = new Set(items.map((line) => line.id))

    rows.forEach((row, id) => {
      if (ids.has(id)) return
      row.node.remove()
      rows.delete(id)
    })

    KINDS.forEach((kind) => {
      const g = groups[kind]
      const lines = items.filter((line) => line.kind === kind)

      g.node.hidden = !lines.length
      g.count.textContent = lines.length ? positionsLabel(lines.length) : ''
      g.lead.textContent = groupLead(kind, totals.order.readyAt)

      lines.forEach((line, index) => {
        let row = rows.get(line.id)
        if (!row) {
          row = createLine(line, handlers)
          rows.set(line.id, row)
        }
        row.update(line)
        const current = g.lines.children[index]
        if (current !== row.node) g.lines.insertBefore(row.node, current || null)
      })
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
