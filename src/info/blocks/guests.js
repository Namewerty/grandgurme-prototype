/* ============================================================================
   guests — сколько икры взять на гостей (/storage → #guests).

   Степпер гостей 1–50 (компонент qty-stepper: в разметке его статичный
   двойник, init ставит живой), капсулы подачи. Результат акцентом.
   «Например» — набор до трёх банок из фасовок учёта, который покрывает
   граммы с наименьшим остатком, а при равенстве — меньшим числом банок:
   «113 г + 2 × 50 г». Больше трёх килограммов — килограммовые банки
   и одна добирающая. Банки рисуются кругами в масштабе (площадь круга
   пропорциональна весу) и появляются по одной за 80 мс.

   «Выбрать фасовку» — раздел чёрной икры с фильтром фасовки самой крупной
   банки набора, если такой фильтр в каталоге есть (fasovka-50, -113, -250).
   ============================================================================ */

import { esc, head, inline, section } from './_html.js'
import { icons } from '../../js/icons.js'
import { createQtyStepper } from '../../js/components/qty-stepper.js'
import { fill, gsap, readJson, reduced } from './_motion.js'

export function buildGuests(d) {
  const copy = {
    result: d.result,
    pack: d.pack,
    unit: d.packUnit,
    packs: d.packs,
    filters: d.filters,
    href: d.action.href,
    min: d.min,
    max: d.max,
    label: d.labelGuests,
    decrease: d.decrease,
    increase: d.increase,
  }
  const format = d.formats.find((f) => f.key === d.defaults.format) || d.formats[0]

  return section('guests', d, `
    <div class="container">
      ${head({ ...d, note: null })}
      <div class="ib-guests" data-guests="${esc(JSON.stringify(copy))}" data-reveal>
        <div class="ib-guests__controls">
          <div class="ib-guests__row">
            <p class="ib-guests__label" id="${esc(d.id)}-guests-label">${esc(d.labelGuests)}</p>
            <div class="qty" role="group" aria-label="${esc(d.labelGuests)}" data-guests-stepper>
              <button type="button" class="qty__btn" data-step="-1" aria-label="${esc(d.decrease)}">${icons.minus}</button>
              <input class="qty__value" type="text" inputmode="numeric" autocomplete="off" aria-label="${esc(d.labelGuests)}" maxlength="2" value="${d.defaults.guests}">
              <button type="button" class="qty__btn" data-step="1" aria-label="${esc(d.increase)}">${icons.plus}</button>
            </div>
          </div>
          <div class="ib-guests__row">
            <p class="ib-guests__label" id="${esc(d.id)}-format-label">${esc(d.labelFormat)}</p>
            <div class="ib-chips" role="group" aria-labelledby="${esc(d.id)}-format-label" data-guests-format data-single>
              ${d.formats
                .map(
                  (f) => `<button type="button" class="ib-chip ib-chip--two" aria-pressed="${f === format}" data-value="${f.grams}">
                    <span>${esc(f.label)}</span><span class="ib-chip__note">${esc(f.note)}</span></button>`,
                )
                .join('')}
            </div>
          </div>
          <p class="ib-guests__note">${inline(d.note)}</p>
        </div>
        <div class="ib-guests__out" aria-live="polite">
          <p class="ib-guests__result" data-guests-result>${esc(fill(d.result, { g: d.defaults.guests * format.grams }))}</p>
          <p class="ib-guests__pack" data-guests-pack></p>
          <div class="ib-guests__jars" role="img" aria-label="${esc(d.jarsLabel)}" data-guests-jars></div>
          <p class="ib-guests__action"><a class="btn btn--solid ib-btn" href="${esc(d.action.href)}" data-guests-action>${esc(d.action.label)}</a></p>
        </div>
      </div>
    </div>`)
}

/* ------------------------------------------------------------------- init */

/** Набор банок: до трёх, наименьший остаток, при равенстве — меньше банок. */
export function pickJars(grams, packs) {
  const sorted = [...packs].sort((a, b) => b - a)
  const biggest = sorted[0]
  if (grams > biggest * 3) {
    const whole = Math.floor(grams / biggest)
    const rest = grams - whole * biggest
    const jars = Array(whole).fill(biggest)
    if (rest > 0) jars.push([...packs].sort((a, b) => a - b).find((p) => p >= rest) || biggest)
    return jars
  }
  let best = null
  const consider = (jars) => {
    const sum = jars.reduce((s, v) => s + v, 0)
    if (sum < grams) return
    const left = sum - grams
    if (!best || left < best.left || (left === best.left && jars.length < best.jars.length)) best = { jars, left }
  }
  sorted.forEach((a) => {
    consider([a])
    sorted.forEach((b) => {
      if (b > a) return
      consider([a, b])
      sorted.forEach((c) => {
        if (c > b) return
        consider([a, b, c])
      })
    })
  })
  return best ? best.jars : [biggest]
}

/** [113, 50, 50] → «113 г + 2 × 50 г». */
export function jarsLabel(jars, unit) {
  const counts = new Map()
  ;[...jars].sort((a, b) => b - a).forEach((j) => counts.set(j, (counts.get(j) || 0) + 1))
  return [...counts].map(([w, n]) => (n > 1 ? `${n} × ${w}${unit}` : `${w}${unit}`)).join(' + ')
}

export function initGuests(root) {
  const box = root.querySelector('[data-guests]')
  if (!box) return
  const copy = readJson(box, 'guests')
  const result = box.querySelector('[data-guests-result]')
  const pack = box.querySelector('[data-guests-pack]')
  const jarsEl = box.querySelector('[data-guests-jars]')
  const action = box.querySelector('[data-guests-action]')
  const formats = box.querySelector('[data-guests-format]')
  const staticStepper = box.querySelector('[data-guests-stepper]')

  let guests = Number(staticStepper.querySelector('input').value) || 1
  const grams = () => Number(formats.querySelector('[aria-pressed="true"]')?.dataset.value || 0)

  const render = () => {
    const g = guests * grams()
    result.textContent = fill(copy.result, { g: g.toLocaleString('ru-RU') })
    const jars = pickJars(g, copy.packs)
    pack.textContent = fill(copy.pack, { packs: jarsLabel(jars, copy.unit) })

    const top = Math.max(...jars)
    const url = new URL(copy.href, location.origin)
    if (copy.filters.includes(top)) url.searchParams.set('sub', `fasovka-${top}`)
    action.href = url.pathname + url.search

    // Круги в масштабе: площадь пропорциональна весу, 1000 г — 150px.
    jarsEl.textContent = ''
    const nodes = [...jars]
      .sort((a, b) => b - a)
      .map((w) => {
        const el = document.createElement('span')
        el.className = 'ib-guests__jar'
        el.style.setProperty('--d', `${(150 * Math.sqrt(w / 1000)).toFixed(1)}px`)
        el.innerHTML = `<span>${w}</span>`
        jarsEl.appendChild(el)
        return el
      })
    if (!reduced()) gsap.fromTo(nodes, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, stagger: 0.08, ease: 'back.out(1.6)' })
  }

  /* Живой степпер вместо статичного двойника — тот же компонент, что в корзине. */
  const stepper = createQtyStepper({
    value: guests,
    min: copy.min,
    max: copy.max,
    label: copy.label,
    decrease: copy.decrease,
    increase: copy.increase,
    onChange: (next) => {
      guests = next
      render()
    },
  })
  stepper.node.setAttribute('data-guests-stepper', '')
  staticStepper.replaceWith(stepper.node)

  formats.addEventListener('click', (event) => {
    const chip = event.target.closest('.ib-chip')
    if (!chip || chip.getAttribute('aria-pressed') === 'true') return
    formats.querySelectorAll('.ib-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
    render()
  })

  render()
}
