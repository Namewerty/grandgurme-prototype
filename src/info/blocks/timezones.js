/* ============================================================================
   timezones — города на оси долготы от −125° до +65°.

   Точки — src/data/info/geo.js на своих долготах; точки ближе 3° друг
   к другу сливаются в одну с подписью группы. Над точкой — город (группа),
   под осью — местное время, идёт по минутам (Intl.DateTimeFormat, timeZone
   из данных). Москва — большая точка с золотым кольцом. Наведение, фокус
   или касание точки показывает под осью карточку: город, что там, и при
   SHOW_PARTNER_NAMES — названия заведений (в разметку они попадают только
   с флагом). По умолчанию открыта карточка Москвы.

   При появлении ось прорисовывается слева направо, точки загораются
   по порядку. Узкая раскладка — ось вертикальная: города строками сверху
   вниз с запада на восток, время справа.

   reel — лента кадров под осью (/partners → #where): во всю ширину окна,
   едет влево 40 с на круг, пауза при наведении, стоит при reduced motion.
   Бесшовность — дублированием группы в разметке, как лента партнёров #proof.
   Кадры с data-src: грузятся, когда лента подходит к экрану.
   ============================================================================ */

import { esc, head, image, section } from './_html.js'
import { geoAxis, geoGroups, geoPoints } from '../../data/info/geo.js'
import { ScrollTrigger, gsap, loadDeferred, reduced } from './_motion.js'

/** Точки по долготе с запада на восток; соседние ближе порога — одной группой. */
export function mergePoints(keys) {
  const list = keys
    .map((key) => ({ key, ...geoPoints[key] }))
    .filter((p) => Number.isFinite(p.lon))
    .sort((a, b) => a.lon - b.lon)

  const groups = []
  list.forEach((p) => {
    const last = groups[groups.length - 1]
    if (last && p.lon - last[last.length - 1].lon < geoAxis.merge) last.push(p)
    else groups.push([p])
  })

  return groups.map((members) => {
    const key = members.map((m) => m.key).join('+')
    const lon = members.reduce((sum, m) => sum + m.lon, 0) / members.length
    const label =
      members.length === 1
        ? members[0].short || members[0].city
        : geoGroups[key] || members.map((m) => m.city).join(' и ')
    return {
      key,
      label,
      members,
      home: members.some((m) => m.home),
      tz: members[0].tz,
      x: ((lon - geoAxis.min) / (geoAxis.max - geoAxis.min)) * 100,
    }
  })
}

function info(point, ui) {
  return point.members
    .map(
      (m) => `
      <div class="ib-tz__info-item">
        <p class="ib-tz__info-city">${esc(m.city)}</p>
        <p class="ib-tz__info-note">${esc(m.note)}</p>
        ${
          m.venues?.length
            ? `<p class="ib-tz__info-label">${esc(ui.venues)}</p><ul class="ib-tz__venues">${m.venues
                .map((v) => `<li>${esc(v)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </div>`,
    )
    .join('')
}

function reel(d) {
  if (!d.reel?.length) return ''
  const frames = (hidden) =>
    d.reel
      .map((media) =>
        image(hidden ? { ...media, alt: '' } : media, { defer: true, className: 'ib-reel__frame' }),
      )
      .join('')
  return `
    <div class="ib-reel" role="region" aria-label="${esc(d.reelLabel)}" data-reel data-reveal>
      <div class="ib-reel__track">
        <div class="ib-reel__group">${frames(false)}</div>
        <div class="ib-reel__group" aria-hidden="true">${frames(true)}</div>
      </div>
    </div>`
}

export function buildTimezones(d) {
  const points = mergePoints(d.points)
  const cardId = `${d.id}-card`
  return section('timezones', d, `
    <div class="container">
      ${head(d)}
      <div class="ib-tz" data-tz data-reveal>
        <div class="ib-tz__plot">
        <div class="ib-tz__axis" aria-hidden="true"><span class="ib-tz__line" data-tz-line></span></div>
        <ul class="ib-tz__points" aria-label="${esc(d.ui.pointsLabel)}">
          ${points
            .map(
              (p) => `
            <li class="ib-tz__point${p.home ? ' is-home' : ''}${p.x > 88 ? ' is-edge-end' : ''}${p.x < 12 ? ' is-edge-start' : ''}"
                style="--x: ${p.x.toFixed(2)}%" data-tz-point="${esc(p.key)}" data-tz="${esc(p.tz)}">
              <button type="button" class="ib-tz__btn" aria-pressed="${p.home}" aria-controls="${esc(cardId)}" data-tz-btn>
                <span class="ib-tz__city">${esc(p.label)}</span>
                <span class="ib-tz__dot" aria-hidden="true"></span>
                <time class="ib-tz__time" data-tz-time></time>
              </button>
              <div class="ib-tz__info" data-tz-info hidden>${info(p, d.ui)}</div>
            </li>`,
            )
            .join('')}
        </ul>
        </div>
        <div class="ib-tz__card" id="${esc(cardId)}" aria-live="polite" data-tz-card>
          ${info(points.find((p) => p.home) || points[0], d.ui)}
        </div>
      </div>
    </div>
    ${reel(d)}`)
}

/* ------------------------------------------------------------------- init */

export function initTimezones(root) {
  const tz = root.querySelector('[data-tz]')
  const points = [...root.querySelectorAll('[data-tz-point]')]
  const card = root.querySelector('[data-tz-card]')
  if (!tz || !points.length) return

  /* ---- время ----------------------------------------------------------- */

  const formats = new Map()
  const fmt = (zone) => {
    if (!formats.has(zone)) {
      formats.set(zone, new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: zone }))
    }
    return formats.get(zone)
  }
  const tick = () => {
    const now = new Date()
    points.forEach((p) => {
      const el = p.querySelector('[data-tz-time]')
      el.textContent = fmt(p.dataset.tz).format(now)
      el.setAttribute('datetime', now.toISOString())
    })
  }
  tick()
  // По минутам, с привязкой к началу минуты.
  const toNext = 60000 - (Date.now() % 60000)
  setTimeout(() => {
    tick()
    setInterval(tick, 60000)
  }, toNext + 50)

  /* ---- выбор точки ----------------------------------------------------- */

  const select = (point) => {
    points.forEach((p) => {
      const on = p === point
      p.classList.toggle('is-active', on)
      p.querySelector('[data-tz-btn]').setAttribute('aria-pressed', String(on))
    })
    card.innerHTML = point.querySelector('[data-tz-info]').innerHTML
    card.style.setProperty('--x', point.style.getPropertyValue('--x'))
    card.classList.toggle('is-edge-end', point.classList.contains('is-edge-end'))
    card.classList.toggle('is-edge-start', point.classList.contains('is-edge-start'))
  }
  const home = points.find((p) => p.classList.contains('is-home')) || points[0]
  select(home)

  points.forEach((p) => {
    const btn = p.querySelector('[data-tz-btn]')
    btn.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') select(p)
    })
    btn.addEventListener('focus', () => select(p))
    btn.addEventListener('click', () => select(p))
  })

  /* ---- лента ----------------------------------------------------------- */

  const reelEl = root.querySelector('[data-reel]')
  if (reelEl) loadDeferred(reelEl, '300px 0px')

  /* ---- появление ------------------------------------------------------- */

  if (reduced()) {
    tz.classList.add('is-drawn')
    return
  }
  tz.classList.add('is-pending')
  ScrollTrigger.create({
    trigger: tz,
    start: 'top 80%',
    once: true,
    onEnter: () => {
      const line = root.querySelector('[data-tz-line]')
      const vertical = getComputedStyle(tz).getPropertyValue('--tz-vertical').trim() === '1'
      gsap.fromTo(line, { [vertical ? 'scaleY' : 'scaleX']: 0 }, {
        [vertical ? 'scaleY' : 'scaleX']: 1,
        duration: 1.2,
        ease: 'power2.inOut',
        onComplete: () => tz.classList.add('is-drawn'),
      })
      points.forEach((p, i) => {
        gsap.delayedCall(0.2 + (i / Math.max(1, points.length - 1)) * 1, () => p.classList.add('is-lit'))
      })
      gsap.delayedCall(1.4, () => tz.classList.remove('is-pending'))
    },
  })
}
