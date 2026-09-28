/* ============================================================================
   tasting — дегустационная доска (/partners → #tasting).

   Слева текст (колонки 1–5), справа (6–12) круглая доска: тёмный круг
   --void-2 с золотым ободком 2px, по окружности шесть малых кругов — кадры
   позиций, как банки на подносе; в центре — карточка выбранной позиции
   (название Prata 1.3rem, текст 0.9rem, до 26ch).

   Наведение, фокус или касание малого круга: он растёт до 1.12, остальные
   гаснут до .45, в центре — его карточка. Пока секция на экране и доску
   не трогали, позиции подсвечиваются сами по кругу каждые 3,5 с; первое
   касание выключает автосмену. При прокрутке доска поворачивается на 20°
   за проход секции, малые круги остаются вертикальными (обратный поворот).
   Узкая раскладка — доска во всю ширину до 400px, карточка под доской.
   ============================================================================ */

import { esc, head, image, more, paras, section } from './_html.js'
import { gsap, loadDeferred, reduced, watchVisible } from './_motion.js'

const CYCLE = 3.5

export function buildTasting(d) {
  const n = d.items.length
  const items = d.items
    .map(
      (item, i) => `
      <li class="ib-board__item" style="--a: ${((360 / n) * i).toFixed(2)}deg" data-board-item="${i}">
        <button type="button" class="ib-board__jar" aria-label="${esc(`${item.title}: ${item.text}`)}" aria-pressed="${i === 0}" data-board-btn>
          <span class="ib-board__upright" data-board-upright>${image(item.media, { round: true, defer: true, ratio: '1:1' })}</span>
        </button>
        <div class="ib-board__info" data-board-info hidden>
          <p class="ib-board__title">${esc(item.title)}</p>
          <p class="ib-board__text">${esc(item.text)}</p>
        </div>
      </li>`,
    )
    .join('')

  return section('tasting', d, `
    <div class="container">
      <div class="ib-tasting__grid">
        <div class="ib-tasting__text">
          ${head(d)}
          ${paras([d.text])}
          ${d.action ? `<p class="ib-tasting__action" data-reveal><a class="btn btn--solid ib-btn" href="${esc(d.action.href)}">${esc(d.action.label)}</a></p>` : ''}
        </div>
        <div class="ib-board" data-board data-reveal>
          <div class="ib-board__disc">
            <div class="ib-board__plate" data-board-plate>
              <ul class="ib-board__items" aria-label="${esc(d.boardLabel)}">${items}</ul>
            </div>
          </div>
          <!-- Карточка одна: на широкой раскладке — в центре доски, на узкой — под ней. -->
          <div class="ib-board__card" aria-live="off" data-board-card>
            <p class="ib-board__title">${esc(d.items[0].title)}</p>
            <p class="ib-board__text">${esc(d.items[0].text)}</p>
          </div>
        </div>
      </div>
    </div>`)
}

export function initTasting(root) {
  const board = root.querySelector('[data-board]')
  const items = [...root.querySelectorAll('[data-board-item]')]
  const cards = [root.querySelector('[data-board-card]')]
  const plate = root.querySelector('[data-board-plate]')
  if (!board || !items.length) return
  loadDeferred(root, '300px 0px')

  let active = 0
  let auto = !reduced()
  let visible = false
  let timer = null

  const show = (i) => {
    active = i
    board.classList.add('has-active')
    items.forEach((item, k) => {
      const on = k === i
      item.classList.toggle('is-active', on)
      item.querySelector('[data-board-btn]').setAttribute('aria-pressed', String(on))
    })
    const html = items[i].querySelector('[data-board-info]').innerHTML
    cards.forEach((card) => {
      if (!card) return
      if (reduced()) {
        card.innerHTML = html
        return
      }
      gsap.killTweensOf(card)
      gsap.to(card, {
        opacity: 0,
        duration: 0.15,
        onComplete: () => {
          card.innerHTML = html
          gsap.to(card, { opacity: 1, duration: 0.3 })
        },
      })
    })
  }

  const stop = () => {
    // Карточка объявляется скринридеру только после выбора человеком:
    // автосмена каждые 3,5 с превратила бы её в бесконечную речь.
    cards[0]?.setAttribute('aria-live', 'polite')
    auto = false
    clearInterval(timer)
    timer = null
  }
  const sync = () => {
    clearInterval(timer)
    timer = null
    if (auto && visible && !document.hidden) timer = setInterval(() => show((active + 1) % items.length), CYCLE * 1000)
  }

  items.forEach((item, i) => {
    const btn = item.querySelector('[data-board-btn]')
    btn.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return
      stop()
      show(i)
    })
    btn.addEventListener('focus', () => {
      stop()
      show(i)
    })
    btn.addEventListener('click', () => {
      stop()
      show(i)
    })
  })

  show(0)
  watchVisible(root, (on) => {
    visible = on
    sync()
  })
  document.addEventListener('visibilitychange', sync)

  if (reduced() || !plate) return
  const uprights = root.querySelectorAll('[data-board-upright]')
  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true },
  })
  tl.fromTo(plate, { rotate: 0 }, { rotate: 20, ease: 'none' }, 0)
  tl.fromTo(uprights, { rotate: 0 }, { rotate: -20, ease: 'none' }, 0)
}
