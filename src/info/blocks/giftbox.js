/* ============================================================================
   giftbox — форматы подарочных наборов (/brands → #gifts, /corporate →
   #formats; шапка — из данных страницы, форматы — src/data/info/gifts.js).

   Форматы — вкладки-капсулы сверху; под ними кадр слева (колонки 1–6,
   квадрат на --on-dark, кадр с mix-blend-mode: multiply — белый фон
   пэкшота растворяется, приём банки из #character) и паспорт справа (<dl>,
   как паспорт линейки). У «Шкатулки» под кадром три круга-цвета (чёрный,
   синий, белый): выбор меняет кадр растворением 400 мс. Смена формата —
   растворение кадра 500 мс, текст паспорта — как в #character.
   Строка паспорта с null не выводится.
   ============================================================================ */

import { esc, head, image, more, section } from './_html.js'
import { gsap, loadDeferred, reduced } from './_motion.js'

function passport(f, labels) {
  const rows = [
    [labels.jar, f.jar],
    [labels.set, f.set],
    [labels.variants, f.variants],
    [labels.caviar, f.caviar],
  ].filter(([, v]) => v)
  return `
    <h3 class="ib-gift__name">${esc(f.title)}</h3>
    <dl class="ib-gift__facts">
      ${rows.map(([dt, dd]) => `<div class="ib-gift__fact"><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`).join('')}
    </dl>`
}

export function buildGiftbox(d) {
  const id = d.id
  const first = d.formats[0]
  const shots = d.formats.flatMap((f) =>
    f.colors ? f.colors.map((c) => ({ key: `${f.key}:${c.key}`, media: c.media })) : [{ key: f.key, media: f.media }],
  )
  const firstKey = first.colors ? `${first.key}:${first.colors[0].key}` : first.key

  const colors = d.formats
    .filter((f) => f.colors)
    .map(
      (f) => `
      <div class="ib-gift__colors" role="group" aria-label="${esc(d.colorsLabel)}" data-gift-colors="${esc(f.key)}"${f === first ? '' : ' hidden'}>
        ${f.colors
          .map(
            (c, i) => `<button type="button" class="ib-gift__swatch ib-gift__swatch--${esc(c.swatch)}" aria-pressed="${i === 0}"
                  aria-label="${esc(c.label)}" data-gift-color="${esc(`${f.key}:${c.key}`)}"></button>`,
          )
          .join('')}
      </div>`,
    )
    .join('')

  return section('giftbox', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-gift" data-gift data-reveal>
        <div class="ib-gift__tabs" role="tablist" aria-label="${esc(d.tabsLabel)}">
          ${d.formats
            .map(
              (f, i) => `<button type="button" class="ib-gift__tab" role="tab" id="${esc(id)}-tab-${esc(f.key)}"
                aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-controls="${esc(id)}-panel"
                data-gift-tab="${esc(f.key)}" data-first="${esc(f.colors ? `${f.key}:${f.colors[0].key}` : f.key)}">${esc(f.title)}</button>`,
            )
            .join('')}
        </div>
        <div class="ib-gift__body" id="${esc(id)}-panel" role="tabpanel" aria-labelledby="${esc(id)}-tab-${esc(first.key)}">
          <div class="ib-gift__visual">
            <div class="ib-gift__frame">
              ${shots
                .map(
                  (s) => `<div class="ib-gift__shot${s.key === firstKey ? ' is-active' : ''}" data-gift-shot="${esc(s.key)}">${image(s.media, {
                    ratio: '1:1',
                    defer: s.key !== firstKey,
                  })}</div>`,
                )
                .join('')}
            </div>
            ${colors}
          </div>
          <div class="ib-gift__passport" data-gift-passport aria-live="polite">${passport(first, d.labels)}</div>
        </div>
        <div hidden>${d.formats.map((f) => `<div data-gift-info="${esc(f.key)}">${passport(f, d.labels)}</div>`).join('')}</div>
      </div>
      ${d.more ? `<p class="ib-gift__more" data-reveal>${more(d.more)}</p>` : ''}
    </div>`)
}

export function initGiftbox(root) {
  const box = root.querySelector('[data-gift]')
  if (!box) return
  loadDeferred(box, '200px 0px')
  const tabs = [...box.querySelectorAll('[data-gift-tab]')]
  const shots = [...box.querySelectorAll('[data-gift-shot]')]
  const passportEl = box.querySelector('[data-gift-passport]')
  const panel = box.querySelector('[role="tabpanel"]')

  let current = shots.find((s) => s.classList.contains('is-active'))?.dataset.giftShot
  let layer = 1

  const showShot = (key, duration) => {
    if (key === current) return
    current = key
    const shot = shots.find((s) => s.dataset.giftShot === key)
    if (!shot) return
    shots.forEach((s) => s.classList.toggle('is-active', s === shot))
    shot.style.zIndex = String(++layer)
    const done = () => {
      if (current !== key) return
      shots.forEach((s) => {
        if (s !== shot) gsap.set(s, { opacity: 0 })
      })
    }
    gsap.killTweensOf(shot)
    if (reduced()) {
      gsap.set(shot, { opacity: 1 })
      done()
    } else gsap.fromTo(shot, { opacity: 0 }, { opacity: 1, duration, ease: 'power2.out', onComplete: done })
  }
  gsap.set(shots.filter((s) => !s.classList.contains('is-active')), { opacity: 0 })

  const selectTab = (tab, focus) => {
    const key = tab.dataset.giftTab
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      if (on && focus) t.focus()
    })
    panel.setAttribute('aria-labelledby', tab.id)
    box.querySelectorAll('[data-gift-colors]').forEach((g) => (g.hidden = g.dataset.giftColors !== key))
    const group = box.querySelector(`[data-gift-colors="${key}"]`)
    const pressed = group?.querySelector('[aria-pressed="true"]')
    showShot(pressed ? pressed.dataset.giftColor : tab.dataset.first, 0.5)

    const html = box.querySelector(`[data-gift-info="${key}"]`).innerHTML
    if (reduced()) {
      passportEl.innerHTML = html
      return
    }
    gsap.to(passportEl, {
      opacity: 0,
      y: 8,
      duration: 0.18,
      onComplete: () => {
        passportEl.innerHTML = html
        gsap.fromTo(passportEl, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.3, clearProps: 'transform,opacity' })
      },
    })
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false))
    tab.addEventListener('keydown', (event) => {
      const map = { ArrowRight: 1, ArrowLeft: -1 }
      let next = null
      if (event.key in map) next = (i + map[event.key] + tabs.length) % tabs.length
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = tabs.length - 1
      if (next === null) return
      event.preventDefault()
      selectTab(tabs[next], true)
    })
  })

  box.querySelectorAll('[data-gift-color]').forEach((swatch) => {
    swatch.addEventListener('click', () => {
      swatch.parentElement.querySelectorAll('[data-gift-color]').forEach((s) => s.setAttribute('aria-pressed', String(s === swatch)))
      showShot(swatch.dataset.giftColor, 0.4)
    })
  })
}
