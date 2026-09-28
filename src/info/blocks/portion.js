/* ============================================================================
   portion — сколько порций в банке (/partners → #portion).

   Два ряда капсул: фасовка (веса из caviarLines, без повторов) и порция.
   Под ними — банка сверху: круг с золотым ободком, поделённый на n равных
   секторов тонкими линиями --hairline; сектора заполняются по кругу за
   600 мс при смене выбора, остаток — последний сектор другой прозрачности.
   Больше maxSectors секторов — сплошная заливка и число. Справа крупно
   результат акцентом, ниже остаток (если больше нуля). Поле цены — только
   цифры; заполнено — строка себестоимости (цена × порция / 1000, до рубля).
   Цены по умолчанию нет: страница розничных и оптовых цен не показывает.
   ============================================================================ */

import { esc, head, inline, section } from './_html.js'
import { fill, gsap, plural, readJson, reduced } from './_motion.js'

const R = 100 // радиус банки в единицах viewBox

export function buildPortion(d) {
  const chips = (name, list, value, label) => `
    <div class="ib-portion__row">
      <p class="ib-portion__label" id="${esc(d.id)}-${name}-label">${esc(label)}</p>
      <div class="ib-chips" role="group" aria-labelledby="${esc(d.id)}-${name}-label" data-portion-chips="${name}" data-single>
        ${list
          .map((v) => `<button type="button" class="ib-chip" aria-pressed="${v === value}" data-value="${v}">${v} ${esc(d.unit)}</button>`)
          .join('')}
      </div>
    </div>`

  const copy = {
    result: d.result,
    words: d.words,
    rest: d.rest,
    cost: d.cost,
    max: d.maxSectors,
  }

  return section('portion', d, `
    <div class="container">
      <div class="ib-portion__grid">
        <div class="ib-portion__intro">
          ${head({ ...d, note: null })}
          <p class="ib__p" data-reveal>${inline(d.text)}</p>
          <p class="ib-portion__note" data-reveal>${inline(d.note)}</p>
        </div>
        <div class="ib-portion__tool" data-portion="${esc(JSON.stringify(copy))}" data-reveal>
          ${chips('pack', d.packs, d.defaults.pack, d.labelPack)}
          ${chips('portion', d.portions, d.defaults.portion, d.labelPortion)}
          <div class="ib-portion__row ib-portion__row--price">
            <label class="ib-portion__label" for="${esc(d.id)}-price">${esc(d.labelPrice)}</label>
            <input class="field__input ib-portion__price" id="${esc(d.id)}-price" type="text" inputmode="numeric"
                   autocomplete="off" maxlength="9" data-portion-price>
          </div>
          <div class="ib-portion__out">
            <div class="ib-portion__jar" role="img" aria-label="${esc(d.jarLabel)}">
              <svg viewBox="-${R + 8} -${R + 8} ${2 * R + 16} ${2 * R + 16}" aria-hidden="true" focusable="false">
                <circle class="ib-portion__base" r="${R}"/>
                <g data-portion-sectors></g>
                <text class="ib-portion__count" data-portion-count text-anchor="middle" dominant-baseline="central"></text>
                <circle class="ib-portion__rim" r="${R + 3}"/>
              </svg>
            </div>
            <div class="ib-portion__result" aria-live="polite">
              <p class="ib-portion__main" data-portion-result></p>
              <p class="ib-portion__rest" data-portion-rest hidden></p>
              <p class="ib-portion__cost" data-portion-cost hidden></p>
            </div>
          </div>
        </div>
      </div>
    </div>`)
}

/* ------------------------------------------------------------------- init */

const NS = 'http://www.w3.org/2000/svg'

/** Сектор круга от угла a до b (градусы, 0 — вверх, по часовой). */
function sectorPath(a, b) {
  const rad = (deg) => ((deg - 90) * Math.PI) / 180
  const [x1, y1] = [R * Math.cos(rad(a)), R * Math.sin(rad(a))]
  const [x2, y2] = [R * Math.cos(rad(b)), R * Math.sin(rad(b))]
  const large = b - a > 180 ? 1 : 0
  if (b - a >= 359.999) return `M 0 ${-R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 ${-R} Z`
  return `M 0 0 L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`
}

const rub = (value) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`

export function initPortion(root) {
  const tool = root.querySelector('[data-portion]')
  if (!tool) return
  const copy = readJson(tool, 'portion')
  const group = tool.querySelector('[data-portion-sectors]')
  const count = tool.querySelector('[data-portion-count]')
  const result = tool.querySelector('[data-portion-result]')
  const rest = tool.querySelector('[data-portion-rest]')
  const cost = tool.querySelector('[data-portion-cost]')
  const price = tool.querySelector('[data-portion-price]')

  const valueOf = (name) =>
    Number(tool.querySelector(`[data-portion-chips="${name}"] [aria-pressed="true"]`)?.dataset.value || 0)

  const draw = (pack, portion) => {
    const n = Math.floor(pack / portion)
    const r = pack - n * portion
    group.textContent = ''
    count.textContent = ''
    const solid = n > copy.max
    tool.classList.toggle('is-solid', solid)

    const paths = []
    if (solid) {
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', sectorPath(0, 360 * ((n * portion) / pack)))
      path.setAttribute('class', 'ib-portion__sector')
      group.appendChild(path)
      paths.push(path)
      count.textContent = String(n)
    } else {
      const step = (360 * portion) / pack
      for (let i = 0; i < n; i += 1) {
        const path = document.createElementNS(NS, 'path')
        path.setAttribute('d', sectorPath(i * step, (i + 1) * step))
        path.setAttribute('class', 'ib-portion__sector')
        group.appendChild(path)
        paths.push(path)
      }
    }
    if (r > 0) {
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', sectorPath((360 * n * portion) / pack, 360))
      path.setAttribute('class', 'ib-portion__sector ib-portion__sector--rest')
      group.appendChild(path)
      paths.push(path)
    }
    if (!reduced()) {
      gsap.fromTo(paths, { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: paths.length > 1 ? 0.4 / (paths.length - 1) : 0, ease: 'none', clearProps: 'opacity' })
    }

    result.textContent = fill(copy.result, { n, word: plural(n, copy.words), p: portion })
    rest.hidden = r <= 0
    rest.textContent = r > 0 ? fill(copy.rest, { r }) : ''

    const perKg = Number(price.value.replace(/\D/g, ''))
    cost.hidden = !perKg
    cost.textContent = perKg ? fill(copy.cost, { c: rub(Math.round((perKg * portion) / 1000)) }) : ''
  }

  const update = () => draw(valueOf('pack'), valueOf('portion'))

  tool.querySelectorAll('[data-portion-chips]').forEach((chipGroup) => {
    chipGroup.addEventListener('click', (event) => {
      const chip = event.target.closest('.ib-chip')
      if (!chip || chip.getAttribute('aria-pressed') === 'true') return
      chipGroup.querySelectorAll('.ib-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
      update()
    })
  })

  price.addEventListener('input', () => {
    const digits = price.value.replace(/\D/g, '')
    const pretty = digits ? new Intl.NumberFormat('ru-RU').format(Number(digits)) : ''
    if (price.value !== pretty) price.value = pretty
    const perKg = Number(digits)
    cost.hidden = !perKg
    cost.textContent = perKg ? fill(copy.cost, { c: rub(Math.round((perKg * valueOf('portion')) / 1000)) }) : ''
  })

  update()
}
