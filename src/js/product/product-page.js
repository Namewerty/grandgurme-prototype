/* ============================================================================
   Карточка товара /product/<слаг>. Один шаблон на все позиции каталога.

   ЧТО ЗАДАЁТ ПОЗИЦИЯ, А ЧТО ШАБЛОН
     позиция  название, фасовка, упаковка, цена (или её отсутствие), свойства
              в attrs и кадры — src/data/catalog-products.js;
     шаблон   всё остальное: порядок блоков, вёрстка, поведение переключателей.

   Ни одного условия по названию раздела здесь нет — ровно как на странице
   категории. Что показывать в характеристиках, решает список ключей из
   src/data/product-copy.js: у позиции есть свойство — строка выводится, нет —
   строки нет. Придумывать «размер зерна» и «срок годности» нельзя.

   ВКЛАДОК НЕТ. Содержимого немного, и вкладки прятали бы половину того, что
   и так помещается на экран. Одна колонка блоков через волосяную линию —
   грамматика всего сайта. Вкладки «Отзывы» нет отдельно и намеренно:
   отзывов по товарам не существует ни в каком виде, а «Отзывы (0)» на банке
   премиальной икры читается как поломка. Внизу — строка со ссылкой
   на /reviews, где социальное доказательство и живёт.

   ВЫБОР ФАСОВКИ — НЕ ДЕКОРАЦИЯ. Фасовки одной линейки это РАЗНЫЕ позиции
   с разными слагами, поэтому переключение уводит на адрес другой позиции,
   а не подсвечивает капсулу на месте. Список собирается из данных: фасовки,
   которой у линейки нет, в ряду не будет; ряд с единственным значением
   не рисуется вовсе — переключатель без выбора это брак.
   ============================================================================ */

import { categories } from '../../data/catalog.js'
import { findProductBySlug, galleryOf, getProducts } from '../../data/catalog-products.js'
import { journalPosts } from '../../data/journal.js'
import { productCopy } from '../../data/product-copy.js'
import { ROUTES } from '../../data/routes.js'
import { cartCopy } from '../../data/cart-copy.js'
import { formatDayMonth, kindOf, preorderDate } from '../../data/fulfillment.js'
import { addWithToast } from '../cart/add.js'
import { fillText } from '../cart/summary.js'
import { createProductCard } from '../components/product-card.js'
import { stockTagHtml } from '../components/stock-tag.js'
import { createQtyStepper } from '../components/qty-stepper.js'
import { createImage } from '../media.js'
import { escapeHtml, formatPrice } from '../catalog/model.js'
import { icons } from '../icons.js'
import { createArrow, createPager, initRail } from '../rail.js'

const copy = productCopy

/* ---------------------------------------------------------------- утилиты */

/** Слаг из адреса /product/<slug>. */
export function slugFromPath(pathname = location.pathname) {
  const clean = pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')
  return clean.startsWith('/product/') ? clean.slice('/product/'.length) : null
}

const priceLabel = (product) =>
  product.price == null ? copy.buy.priceOnRequest : formatPrice(product.price)

/** Позиции той же линейки: у икры это grade, у остальных — само название. */
function lineOf(product) {
  const pool = getProducts(product.categorySlug)
  const grade = product.attrs?.grade
  return grade
    ? pool.filter((item) => item.attrs?.grade === grade)
    : pool.filter((item) => item.name === product.name)
}

/** Уникальные значения в порядке появления. */
const uniq = (list) => [...new Set(list)]

/* --------------------------------------------------------------- разметка */

function crumbs(product, category) {
  return `
    <nav class="crumbs" aria-label="Хлебные крошки">
      <a href="${ROUTES.home}">${copy.crumbs.home}</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <a href="${ROUTES.catalog}">${copy.crumbs.catalog}</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <a href="${ROUTES.category(category.slug)}">${escapeHtml(category.name)}</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <span class="crumbs__current" aria-current="page">${escapeHtml(product.name)}</span>
    </nav>`
}

/**
 * Галерея. Лента миниатюр рисуется только если кадров больше одного:
 * одна миниатюра под кадром — переключатель, которому нечего переключать.
 */
function gallery(product) {
  const shots = galleryOf(product)

  const thumbs =
    shots.length > 1
      ? `<div class="pgallery__thumbs" role="tablist" aria-label="Кадры товара" data-gallery-thumbs>
           ${shots
             .map(
               (shot, i) => `
             <button type="button" class="pgallery__thumb${i === 0 ? ' is-active' : ''}"
                     role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"
                     data-gallery-pick="${i}">
               <span class="visually-hidden">${escapeHtml(shot.alt)}</span>
             </button>`,
             )
             .join('')}
         </div>`
      : ''

  return `
    <div class="pgallery" data-gallery>
      <div class="pgallery__main" data-gallery-main></div>
      ${thumbs}
    </div>`
}

/** Ряд капсул одной оси. Пустой, если выбирать не из чего. */
function chipsRow({ label, options, current, name }) {
  if (options.length < 2) return ''

  return `
    <div class="pbuy__row">
      <span class="pbuy__label">${label}</span>
      <div class="pbuy__chips" role="group" aria-label="${label}">
        ${options
          .map(
            ({ value, href }) => `
          <a class="chip${value === current ? ' is-active' : ''}"
             href="${href}"${value === current ? ' aria-current="true"' : ''}
             data-${name}="${escapeHtml(value)}">${escapeHtml(value)}</a>`,
          )
          .join('')}
      </div>
    </div>`
}

/**
 * Оси выбора. Фасовка — главная; упаковка показывается для выбранной
 * фасовки, потому что у 50 г бывает и металл, и стекло, а у 250 г только
 * металл. Показывать недоступную упаковку значит врать о наличии.
 */
function buyRows(product) {
  const line = lineOf(product)

  const formats = uniq(line.map((item) => item.attrs.format || item.weightLabel)).map((value) => {
    // Внутри фасовки стараемся сохранить текущую упаковку: человек выбирал
    // вес, а не переезд со стекла на металл.
    const same = line.find(
      (item) =>
        (item.attrs.format || item.weightLabel) === value &&
        item.attrs.packaging === product.attrs.packaging,
    )
    const any = line.find((item) => (item.attrs.format || item.weightLabel) === value)
    return { value, href: ROUTES.product((same || any).slug) }
  })

  const currentFormat = product.attrs.format || product.weightLabel

  const packagings = uniq(
    line
      .filter((item) => (item.attrs.format || item.weightLabel) === currentFormat)
      .map((item) => item.attrs.packaging),
  )
    .filter(Boolean)
    .map((value) => {
      const match = line.find(
        (item) =>
          (item.attrs.format || item.weightLabel) === currentFormat &&
          item.attrs.packaging === value,
      )
      return { value, href: ROUTES.product(match.slug) }
    })

  return (
    chipsRow({ label: copy.buy.format, options: formats, current: currentFormat, name: 'format' }) +
    chipsRow({
      label: copy.buy.packaging,
      options: packagings,
      current: product.attrs.packaging,
      name: 'packaging',
    })
  )
}

function buyColumn(product) {
  /* Вторая строка под названием — вид и линейка. Пишется из того, что есть:
     у рыбы линейки нет вовсе, и лишнего разделителя быть не должно. */
  const line = [product.attrs.species, product.attrs.grade].filter(Boolean).join(' · ')

  /* Вид позиции стоит сразу под ценой: «сколько» и «когда» — один вопрос,
     и отвечать на него через два блока нельзя. Метка — та же, что в сетке
     каталога, но здесь она есть и у «в наличии»: на карточке человек
     решает, покупать ли. */
  const kind = kindOf(product)
  const kindText = fillText(copy.kind[kind], { date: formatDayMonth(preorderDate()) })

  return `
    <div class="pbuy">
      <h1 class="pbuy__title">${escapeHtml(product.name)}</h1>
      ${line ? `<p class="pbuy__line">${escapeHtml(line)}</p>` : ''}
      <p class="pbuy__price">${priceLabel(product)}</p>
      <div class="pbuy__kind">
        ${stockTagHtml(kind)}
        <p class="pbuy__kind-text">${kindText}</p>
      </div>

      ${buyRows(product)}

      <div class="pbuy__actions">
        <span data-qty></span>
        <button type="button" class="btn btn--solid" data-add-to-cart>
          ${kind === 'request' ? copy.buy.addRequest : copy.buy.add}
        </button>
        <button type="button" class="btn" data-ask-expert>
          ${product.price == null ? copy.buy.askPrice : copy.buy.expert}
        </button>
      </div>

      <ul class="pbuy__promises">
        ${copy.promises
          .map(
            ({ icon, text }) => `
          <li class="pbuy__promise">
            <span class="pbuy__promise-icon" aria-hidden="true">${icons[icon] || ''}</span>
            <span>${text}</span>
          </li>`,
          )
          .join('')}
      </ul>
    </div>`
}

/** Характеристики: только то, что реально лежит в attrs позиции. */
function specs(product) {
  const rows = copy.specs.order
    .filter((key) => product.attrs?.[key])
    .map((key) => ({ term: copy.specs.labels[key], value: product.attrs[key] }))

  if (product.weightG) rows.push({ term: copy.specs.weight, value: `${product.weightG} г` })
  if (!rows.length) return ''

  return `
    <section class="pblock">
      <h2 class="pblock__title">${copy.specs.title}</h2>
      <dl class="pspecs">
        ${rows
          .map(
            ({ term, value }) => `
          <div class="pspecs__row">
            <dt>${escapeHtml(term)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>`,
          )
          .join('')}
      </dl>
    </section>`
}

const textBlock = ({ title, text, link }) => `
  <section class="pblock">
    <h2 class="pblock__title">${title}</h2>
    <div class="pblock__text">
      ${text.map((paragraph) => `<p>${paragraph}</p>`).join('')}
    </div>
    <p class="pblock__link"><a href="${link.href}">${link.label}</a></p>
  </section>`

/** Лента карточек: общий компонент и общая механика прокрутки из rail.js. */
function railBlock({ id, title, label }) {
  return `
    <section class="pblock prail" data-rail="${id}">
      <div class="prail__head">
        <h2 class="pblock__title">${title}</h2>
        <span data-rail-pager></span>
      </div>

      <div class="prail__frame" data-rail-frame>
        <div class="prail__stage" data-rail-stage>
          <div class="prail__track rail-track rail-mask" data-rail-track
               tabindex="0" aria-label="${label}"></div>
        </div>

        <div class="prail__slider">
          <div class="rail-bar" aria-hidden="true">
            <span class="rail-bar__thumb" data-rail-bar></span>
          </div>
        </div>
      </div>
    </section>`
}

function journalBlock() {
  const post = journalPosts.find((item) => item.slug === copy.journal.slug) || journalPosts[0]
  if (!post) return ''

  return `
    <section class="pblock">
      <h2 class="pblock__title">${copy.journal.title}</h2>
      <a class="post post--wide" href="${post.href}">
        <span class="post__frame">
          <span data-media="image" data-class="post__photo" data-src="${post.media.src}"
                data-ratio="16:10" data-alt="${escapeHtml(post.title)}"></span>
        </span>
        <span class="post__body">
          <span class="post__rubric">${post.rubric}</span>
          <span class="post__title">${post.title}</span>
          <span class="post__lead">${post.lead}</span>
        </span>
      </a>
    </section>`
}

/* --------------------------------------------------------------- сборка */

function notFound(mount) {
  const page = copy.notFound
  document.title = `${page.title} — №1 Гранд Гурмэ`

  mount.className = 'page'
  mount.innerHTML = `
    <div class="page__inner">
      <p class="eyebrow">${page.eyebrow}</p>
      <h1 class="page__title">${page.title}</h1>
      <p class="page__p page__lead">${page.text}</p>
      <ul class="page__links">
        ${page.links.map(({ label, href }) => `<li><a href="${href}">${label}</a></li>`).join('')}
      </ul>
    </div>`
}

/**
 * Карточки для ленты. Кадр берётся из самой позиции, как в сетке каталога.
 * Соседи по ленте — из того же раздела, что и открытая позиция.
 */
function cardFor(product, categorySlug) {
  const item = { ...product, categorySlug }
  const kind = kindOf(item)
  return createProductCard({
    name: product.name,
    note: product.weightLabel,
    href: ROUTES.product(product.slug),
    price: priceLabel(product),
    image: { src: product.photo, ratio: '1:1' },
    add: {
      label: cartCopy.addLabel[kind],
      onAdd: () => addWithToast(item),
    },
    kind,
  })
}

/** Одна представительная позиция на каждый вид, кроме вида текущей. */
function otherSpecies(product) {
  const pool = getProducts(product.categorySlug)
  const mine = product.attrs?.species

  return uniq(pool.map((item) => item.attrs?.species).filter(Boolean))
    .filter((species) => species !== mine)
    .map((species) => {
      // Представитель — та же фасовка, если она у вида есть: ряд карточек
      // с разным весом читался бы как случайная подборка.
      const same = pool.find(
        (item) => item.attrs.species === species && item.weightG === product.weightG,
      )
      return same || pool.find((item) => item.attrs.species === species)
    })
    .filter(Boolean)
}

function fillRail(root, id, products, categorySlug) {
  const block = root.querySelector(`[data-rail="${id}"]`)
  if (!block) return

  // Лента из одной карточки — не лента. Блок не заводим вовсе.
  if (products.length < 2) {
    block.remove()
    return
  }

  const track = block.querySelector('[data-rail-track]')
  products.forEach((product) => track.appendChild(cardFor(product, categorySlug)))

  const pager = createPager(track.getAttribute('aria-label'))
  block.querySelector('[data-rail-pager]').appendChild(pager.node)

  // Стрелки поверх краёв — дубль пейджера для тех, кто не смотрит вниз.
  // aria-hidden и tabindex=-1: иначе скринридер объявит четыре кнопки вместо двух.
  const stage = block.querySelector('[data-rail-stage]')
  const edges = ['prev', 'next'].map((dir) => {
    const arrow = createArrow(dir, '')
    arrow.setAttribute('aria-hidden', 'true')
    arrow.tabIndex = -1
    stage.appendChild(arrow)
    return arrow
  })

  initRail({
    track,
    frame: block.querySelector('[data-rail-frame]'),
    prev: [pager.prev, edges[0]],
    next: [pager.next, edges[1]],
    bar: block.querySelector('[data-rail-bar]'),
  })
}

/* ---------------------------------------------------------------- галерея */

function wireGallery(root, product) {
  const shots = galleryOf(product)
  const main = root.querySelector('[data-gallery-main]')
  if (!main) return

  const paint = (index) => {
    main.innerHTML = ''
    main.appendChild(
      createImage({
        src: shots[index].src,
        alt: shots[index].alt,
        ratio: '1:1',
        className: 'pgallery__shot',
        loading: index === 0 ? 'eager' : 'lazy',
      }),
    )
  }

  paint(0)

  const thumbs = [...root.querySelectorAll('[data-gallery-pick]')]
  if (!thumbs.length) return

  // Миниатюра — тот же кадр, что и главный: отдельных мелких файлов
  // под ленту не заводим, лишняя съёмка ради ста пикселей.
  thumbs.forEach((thumb, index) => {
    thumb.appendChild(
      createImage({
        src: shots[index].src,
        alt: '',
        ratio: '1:1',
        className: 'pgallery__thumb-shot media--compact',
      }),
    )
  })

  const select = (index, { focus = false } = {}) => {
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === index)
      thumb.setAttribute('aria-selected', String(i === index))
      thumb.tabIndex = i === index ? 0 : -1
    })
    // Переключение мгновенное, без слайдера: это выбор ракурса, а не показ.
    paint(index)
    if (focus) thumbs[index].focus()
  }

  thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => select(index)))

  root.querySelector('[data-gallery-thumbs]').addEventListener('keydown', (event) => {
    const at = thumbs.indexOf(event.target.closest('[data-gallery-pick]'))
    if (at === -1) return

    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    const edge = { Home: 0, End: thumbs.length - 1 }[event.key]
    if (step === undefined && edge === undefined) return

    event.preventDefault()
    select(edge ?? (at + step + thumbs.length) % thumbs.length, { focus: true })
  })
}

/* ------------------------------------------------------------------- init */

export function initProductPage(mount) {
  if (!mount) return null

  const product = findProductBySlug(slugFromPath())
  // Слага нет в каталоге — показываем содержимое 404, а не пустую страницу.
  if (!product) {
    notFound(mount)
    return null
  }

  const category = categories.find((item) => item.slug === product.categorySlug)
  document.title = `${product.name}, ${product.weightLabel} — №1 Гранд Гурмэ`

  const railTitle =
    copy.rails.species.byCategory[product.categorySlug] || copy.rails.species.title

  mount.className = 'page-product'
  mount.innerHTML = `
    <div class="product-page">
      <div class="container">
        ${crumbs(product, category)}

        <div class="ptop">
          ${gallery(product)}
          ${buyColumn(product)}
        </div>

        <div class="pblocks">
          ${specs(product)}
          ${textBlock(copy.storage)}
          ${textBlock(copy.documents)}
          ${railBlock({
            id: 'formats',
            title: copy.rails.formats.title,
            label: copy.rails.formats.label,
          })}
          ${railBlock({ id: 'species', title: railTitle, label: copy.rails.species.label })}
          ${journalBlock()}

          <p class="previews">
            ${copy.reviews.text}
            <a href="${copy.reviews.link.href}">${copy.reviews.link.label}</a>
          </p>
        </div>
      </div>
    </div>`

  wireGallery(mount, product)

  fillRail(
    mount,
    'formats',
    lineOf(product).filter((item) => item.slug !== product.slug),
    product.categorySlug,
  )
  fillRail(mount, 'species', otherSpecies(product), product.categorySlug)

  // Количество живёт в степпере до нажатия «В корзину»: карточка ничего
  // не пишет в корзину, пока человек не решил.
  const qty = createQtyStepper({
    value: 1,
    label: copy.buy.qty,
    decrease: copy.buy.decrease,
    increase: copy.buy.increase,
  })
  mount.querySelector('[data-qty]')?.replaceWith(qty.node)

  mount.querySelector('[data-add-to-cart]')?.addEventListener('click', () => {
    addWithToast(product, qty.value)
  })

  // Кнопка не заводит вторую форму на странице, а поднимает угловой виджет:
  // одна форма на сайте — одна точка приёма заявок. У позиции без цены
  // она же называется «Узнать цену».
  mount.querySelector('[data-ask-expert]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('expert:open'))
  })

  return { product }
}
