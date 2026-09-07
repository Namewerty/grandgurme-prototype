/* ============================================================================
   Карточка товара. Одна на витрину главной (#shop) и на сетку каталога.

   Зачем общий компонент. Карточка — самый повторяемый предмет сайта: если у
   каталога заведётся своя, через две правки сайт распадётся на два разных.
   Поэтому разметка и классы здесь одни, а различия сведены к трём
   необязательным деталям, которых на главной просто нет:

     badge     плашка «Новинка» / «Акция» / «−12%» в углу кадра;
     favorite  сердце в противоположном углу;
     oldPrice  зачёркнутая старая цена рядом с новой.

   Порядок подписей общий и взят с главной: название, потом фасовка, потом
   цена. В прототипе фильтров фасовка стояла НАД названием — на странице, где
   рядом стоят карточки из двух источников, разный порядок читался бы
   как две разные карточки.

   Кадр — обёртка из js/media.js: пока файла нет, на его месте заглушка
   с именем ожидаемого файла и пропорцией.
   ============================================================================ */

import { createImage } from '../media.js'
import { icons } from '../icons.js'

/**
 * @param {object} data
 * @param {string} data.name      название товара
 * @param {string} data.note      вторая строка: фасовка или состав набора
 * @param {string} data.href      адрес карточки товара
 * @param {string} data.price     готовая строка цены
 * @param {string} [data.oldPrice] старая цена, если есть скидка
 * @param {object} data.image     { src, alt, ratio }
 * @param {object} [data.badge]   { kind: 'new'|'sale'|'discount', label }
 * @param {object} [data.favorite] { active: boolean, label, onToggle(next) }
 * @param {object} data.add       { label, onAdd() }
 * @param {boolean} [data.muted]  товар не в наличии — кадр приглушён
 * @returns {HTMLElement}
 */
export function createProductCard({
  name,
  note,
  href,
  price,
  oldPrice,
  image,
  badge,
  favorite,
  add,
  muted = false,
}) {
  const card = document.createElement('article')
  card.className = `product${muted ? ' product--muted' : ''}`

  /* Кадр — ссылка-дубль названия. Из потока фокуса убрана: у карточки должен
     быть один табстоп, а не два одинаковых. */
  const shot = document.createElement('a')
  shot.className = 'product__shot'
  shot.href = href
  shot.tabIndex = -1
  shot.setAttribute('aria-hidden', 'true')
  shot.appendChild(
    createImage({
      src: image.src,
      alt: `${name}, ${note}`,
      ratio: image.ratio || '1:1',
      className: 'product__photo',
    }),
  )

  const frame = document.createElement('div')
  frame.className = 'product__frame'
  frame.appendChild(shot)

  if (badge) {
    const mark = document.createElement('span')
    mark.className = `product__badge product__badge--${badge.kind}`
    mark.textContent = badge.label
    frame.appendChild(mark)
  }

  if (favorite) {
    const fav = document.createElement('button')
    fav.type = 'button'
    fav.className = `product__fav${favorite.active ? ' is-active' : ''}`
    fav.innerHTML = icons.heart
    fav.setAttribute('aria-pressed', String(favorite.active))
    fav.setAttribute('aria-label', `${favorite.label}: ${name}`)
    fav.addEventListener('click', () => {
      const next = !fav.classList.contains('is-active')
      fav.classList.toggle('is-active', next)
      fav.setAttribute('aria-pressed', String(next))
      favorite.onToggle?.(next)
    })
    frame.appendChild(fav)
  }

  if (add) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'product__add'
    button.innerHTML = icons.cart
    button.setAttribute('aria-label', `${add.label}: ${name}, ${note}`)
    button.addEventListener('click', () => add.onAdd?.())
    frame.appendChild(button)
  }

  const body = document.createElement('div')
  body.className = 'product__body'
  body.innerHTML = `
    <h3 class="product__name"><a href="${href}">${name}</a></h3>
    <p class="product__note">${note}</p>
    <p class="product__price">
      ${price}${oldPrice ? `<s class="product__price-old">${oldPrice}</s>` : ''}
    </p>
  `

  card.append(frame, body)
  return card
}
