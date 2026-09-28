/* ============================================================================
   boutique — гастробутик со статусом «открыто» (/contacts → #boutique).
   Тёмный блок: слева кадр 4:5, справа адрес, строки (район, часы, метро),
   статус и кнопки. Статус считается по московскому времени из часов
   open / close (данные — pickupPoints в src/data/offline.js), обновляется
   раз в минуту; точка перед ним — --caspian, когда открыто, и --fg-mute,
   когда закрыто.
   ============================================================================ */

import { esc, ext, head, image, section } from './_html.js'

export function buildBoutique(d) {
  const actions = d.actions
    .map(
      (a) =>
        `<a class="btn${a.kind === 'solid' ? ' btn--solid' : ''} ib-btn" href="${esc(a.href)}"${ext(a.href, a.external)}>${esc(a.label)}</a>`,
    )
    .join('')

  return section('boutique', d, `
    <div class="container">
      <div class="ib-split__grid ib-split__grid--left">
        <div class="ib-split__media" data-reveal>${image(d.media, { ratio: '4:5' })}</div>
        <div class="ib-split__text">
          ${head(d)}
          <ul class="ib-boutique__lines" data-reveal>${d.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
          <p class="ib-boutique__status" data-boutique-status data-open="${esc(d.open)}" data-close="${esc(d.close)}"
             data-tz="${esc(d.tz)}" data-text-open="${esc(d.status.open)}" data-text-closed="${esc(d.status.closed)}" data-reveal>
            <span class="ib-boutique__dot" aria-hidden="true"></span><span data-boutique-text></span>
          </p>
          <div class="ib__actions" data-reveal>${actions}</div>
        </div>
      </div>
    </div>`)
}

const minutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Минуты от полуночи в поясе tz. */
function nowIn(tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz })
    .formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0)
  return get('hour') * 60 + get('minute')
}

export function initBoutique(root) {
  const status = root.querySelector('[data-boutique-status]')
  if (!status) return
  const text = status.querySelector('[data-boutique-text]')
  const { open, close, tz } = status.dataset

  const paint = () => {
    const now = nowIn(tz)
    const isOpen = now >= minutes(open) && now < minutes(close)
    status.classList.toggle('is-open', isOpen)
    const template = isOpen ? status.dataset.textOpen : status.dataset.textClosed
    text.textContent = template.replace('{close}', close).replace('{open}', open)
  }
  paint()
  const toNext = 60000 - (Date.now() % 60000)
  setTimeout(() => {
    paint()
    setInterval(paint, 60000)
  }, toNext + 50)
}
