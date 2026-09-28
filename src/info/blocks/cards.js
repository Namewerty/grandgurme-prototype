/* ============================================================================
   cards — сетка карточек, 2–4 в ряд (поле columns). Три вида (variant):

     default  необязательный кадр сверху (3:2, --radius-card), название,
              текст, ссылка со стрелкой. Наведение: кадр до 1.04 за 600 мс,
              стрелка сдвигается. Вся карточка — одна ссылка, если есть href;
     count    без кадра: название Prata 1.5rem, число акцентом 2.4rem,
              стрелка (разделы каталога на /brands);
     poster   крупная карточка 4:5, кадр на всю карточку, текст снизу на
              затемнении; наведение — кадр до 1.05, текст поднимается на 8px
              и открывает вторую строку (две марки на /about).

   segment у карточки (/partners → #segments): ссылка ведёт к форме
   с выбранным типом заведения. Без скрипта это обычный переход
   ?segment=…#request, со скриптом — без перезагрузки (событие ib:segment).
   ============================================================================ */

import { esc, head, image, section } from './_html.js'
import { scrollToEl } from './_motion.js'

const arrow = '<span class="ib-cards__arrow" aria-hidden="true">→</span>'

function hrefOf(item) {
  if (item.segment) return `?segment=${encodeURIComponent(item.segment)}#request`
  return item.href || ''
}

function card(item, d) {
  const href = hrefOf(item)
  const tag = href ? 'a' : 'div'
  const attrs = href
    ? ` href="${esc(href)}"${item.segment ? ` data-segment="${esc(item.segment)}"` : ''}`
    : ''

  if (d.variant === 'count') {
    return `
      <li class="ib-cards__cell" data-reveal>
        <${tag} class="ib-card ib-card--count"${attrs}>
          <span class="ib-card__title">${esc(item.title)}</span>
          <span class="ib-card__count"><span class="ib-card__num">${esc(item.count)}</span> ${esc(item.word)}</span>
          ${href ? arrow : ''}
        </${tag}>
      </li>`
  }

  if (d.variant === 'poster') {
    return `
      <li class="ib-cards__cell" data-reveal>
        <${tag} class="ib-card ib-card--poster"${attrs}>
          ${image(item.media, { ratio: '4:5', className: 'ib-card__media' })}
          <span class="ib-card__shade" aria-hidden="true"></span>
          <span class="ib-card__body">
            ${item.note ? `<span class="ib-card__note">${esc(item.note)}</span>` : ''}
            <span class="ib-card__title">${esc(item.title)}</span>
            <span class="ib-card__text">${esc(item.text)}</span>
          </span>
          ${href ? arrow : ''}
        </${tag}>
      </li>`
  }

  const moreLabel = item.more || d.more
  return `
    <li class="ib-cards__cell" data-reveal>
      <${tag} class="ib-card"${attrs}>
        ${item.media ? image(item.media, { ratio: '3:2', className: 'ib-card__media' }) : ''}
        ${item.tag ? `<span class="ib-card__tag">${esc(item.tag)}</span>` : ''}
        <span class="ib-card__title">${esc(item.title)}</span>
        ${item.text ? `<span class="ib-card__text">${esc(item.text)}</span>` : ''}
        ${href && moreLabel ? `<span class="ib-card__more">${esc(moreLabel)} ${arrow}</span>` : ''}
      </${tag}>
    </li>`
}

export function buildCards(d) {
  const variant = d.variant || 'default'
  const columns = d.columns || Math.min(4, d.items.length)
  return section('cards', d, `
    <div class="container">
      ${head(d)}
      <ul class="ib-cards__grid ib-cards__grid--${variant}" style="--cols: ${columns}"${
        d.label && !d.title ? ` aria-label="${esc(d.label)}"` : ''
      }>
        ${d.items.map((item) => card(item, { ...d, variant })).join('')}
      </ul>
      ${d.after || ''}
    </div>`, { cls: `ib-cards--${variant}` })
}

export function initCards(root) {
  root.querySelectorAll('a[data-segment]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector('#request')
      if (!target) return
      event.preventDefault()
      const key = link.dataset.segment
      const url = new URL(location.href)
      url.searchParams.set('segment', key)
      url.hash = 'request'
      history.replaceState(history.state, '', url)
      document.dispatchEvent(new CustomEvent('ib:segment', { detail: { key } }))
      scrollToEl(target)
    })
  })
}
