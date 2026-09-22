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
import { showToast } from '../cart/toast.js'
import { addToWaitlist, isInWaitlist, onWaitlistChange, removeFromWaitlist, restoreToWaitlist } from '../account/api.js'
import { openLoginDialog } from '../account/login-dialog.js'
import { phoneLabel } from '../account/layout.js'
import { currentUser, onChange as onAccountChange } from '../account/session.js'
import { createProductCard } from '../components/product-card.js'
import { createHeartButton, favoriteFor } from '../favorites/toggle.js'
import { stockTagHtml } from '../components/stock-tag.js'
import { createQtyStepper } from '../components/qty-stepper.js'
import { createImage } from '../media.js'
import { approxLabel, escapeHtml, formatPrice, priceText } from '../catalog/model.js'
import { isBox, packsWord, pricePer100 } from '../../data/boxes.js'
import { getFreePacks, peekFreeCount } from '../cart/boxes.js'
import { boxPriceMarkup, createBoxPicker } from './box-picker.js'
import { MAX_QTY } from '../cart/store.js'
import { icons } from '../icons.js'
import { createArrow, createPager, initRail } from '../rail.js'

const copy = productCopy

/* ---------------------------------------------------------------- утилиты */

/** Слаг из адреса /product/<slug>. */
export function slugFromPath(pathname = location.pathname) {
  const clean = pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')
  return clean.startsWith('/product/') ? clean.slice('/product/'.length) : null
}

/** Цена в лентах: у коробок — коробка по умолчанию, без цены — «Цена по запросу». */
const priceLabel = (product) => priceText(product) ?? copy.buy.priceOnRequest

/**
 * Цена в правой колонке. У коробки в наличии — точная цена коробки по
 * умолчанию и «за коробку 202 г» (потом её перерисовывает ряд весов,
 * см. wireBoxes); у коробки под заказ — «≈ 1 980 ₽» и «за коробку».
 */
function priceMarkup(product) {
  if (!isBox(product)) return priceLabel(product)
  if (!product.inStock || !product.defaultPack) {
    return `${approxLabel(product.price)} <span class="pbuy__price-unit">${copy.boxes.perBoxApprox}</span>`
  }
  const first = product.defaultPack
  return boxPriceMarkup({ count: 1, packs: [first], sum: product.price, weights: `${first.weightG} г` })
}

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
      <p class="pbuy__price" data-price>${priceMarkup(product)}</p>
      ${isBox(product) ? '<p class="pbuy__boxes" data-boxes-line></p>' : ''}
      <div class="pbuy__kind">
        ${stockTagHtml(kind)}
        <p class="pbuy__kind-text">${kindText}</p>
      </div>

      ${buyRows(product)}
      ${isBox(product) && product.inStock ? '<div data-boxes-row></div>' : ''}

      <div class="pbuy__actions">
        <span data-qty></span>
        <button type="button" class="btn btn--solid" data-add-to-cart>
          ${kind === 'request' ? copy.buy.addRequest : copy.buy.add}
        </button>
        <button type="button" class="btn" data-ask-expert>
          ${product.price == null ? copy.buy.askPrice : copy.buy.expert}
        </button>
        <span data-fav-slot></span>
      </div>
      ${isBox(product) && product.inStock ? '<p class="pbuy__limit" data-boxes-limit hidden></p>' : ''}

      ${kind === 'request' && !product.inStock ? '<div class="pbuy__wait" data-wait></div>' : ''}

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

  // У коробки в наличии — разброс весов на складе, под заказ — «около 200 г».
  if (isBox(product)) {
    const range = product.weightRange
    rows.push({
      term: copy.boxes.specWeight,
      value: range
        ? fillText(copy.boxes.specWeightRange, range)
        : fillText(copy.boxes.specWeightValue, { g: product.nominalG }),
    })
  } else if (product.weightG) {
    rows.push({ term: copy.specs.weight, value: `${product.weightG} г` })
  }
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
    favorite: favoriteFor(item),
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

/* ------------------------------------------------------------- коробки */

/**
 * Позиция в коробках (src/data/boxes.js): строка под ценой про цену за 100 г
 * и ряд весов (box-picker.js), связанный со степпером в обе стороны.
 * Коробки берутся через границу cart/boxes.js — список приходит асинхронно,
 * ряд появляется, когда он пришёл; до этого цена — коробки по умолчанию
 * из данных, та же. Под заказ (коробок нет): только строка про фасовку.
 * @param {{ onPick: (picked: object) => void }} o  ряд поменял число коробок — степперу
 * @returns {Promise<{ ids: () => string[], setCount: (n: number) => void } | null>}
 */
async function wireBoxes(root, product, { onPick }) {
  const line = root.querySelector('[data-boxes-line]')
  if (!line) return null
  const c = copy.boxes
  const per100 = formatPrice(pricePer100(product.pricePerKg))

  if (!product.inStock) {
    line.textContent = fillText(c.preorderLine, { per100 })
    return null
  }
  line.textContent = fillText(c.stockLine, { per100 })

  const free = await getFreePacks(product.slug)
  const slot = root.querySelector('[data-boxes-row]')
  const price = root.querySelector('[data-price]')
  if (!free.length || !slot) return null

  const picker = createBoxPicker({
    free,
    nominalG: product.nominalG,
    pricePerKg: product.pricePerKg,
    onChange: (picked) => {
      price.innerHTML = boxPriceMarkup(picked)
      onPick(picked)
    },
  })
  slot.replaceWith(picker.node)
  price.innerHTML = boxPriceMarkup(picker.state())
  return { ids: () => picker.state().ids, setCount: picker.setCount }
}

/* ------------------------------------------------- сообщить о поступлении */

/**
 * «Сообщить о поступлении» — только у позиции заявкой менеджеру, которой нет
 * на складе (узел .pbuy__wait рисует buyColumn). Подписка есть только
 * у вошедшего: гостю открывается окно входа (login-dialog.js), после
 * верного кода позиция кладётся в лист сама. Состояние кнопки — из листа
 * ожидания; вышел в соседней вкладке — кнопка возвращается к виду для гостя.
 */
function wireWaitlist(root, product) {
  const box = root.querySelector('[data-wait]')
  if (!box) return

  const c = copy.waitlist
  const id = String(product.id)
  const snapshot = {
    id,
    slug: product.slug,
    name: product.name,
    note: product.weightLabel,
    href: ROUTES.product(product.slug),
    image: product.photo,
  }

  function paint() {
    const user = currentUser()
    const on = Boolean(user) && isInWaitlist(id)

    box.innerHTML = on
      ? `<div class="pbuy__wait-row">
           <button type="button" class="btn pbuy__wait-btn is-on" aria-disabled="true" data-wait-on>
             <span class="pbuy__wait-icon" aria-hidden="true">${icons.check}</span>${c.subscribed}
           </button>
           <button type="button" class="link-btn pbuy__wait-off" data-wait-off>${c.off}</button>
         </div>
         <p class="pbuy__wait-note">
           ${escapeHtml(fillText(c.noteOn.before, { phone: phoneLabel(user.phone) }))}
           <a href="${c.noteOn.link.href}">${c.noteOn.link.label}</a>${c.noteOn.after}
         </p>`
      : `<div class="pbuy__wait-row">
           <button type="button" class="btn pbuy__wait-btn" data-wait-on>
             <span class="pbuy__wait-icon" aria-hidden="true">${icons.bell}</span>${c.subscribe}
           </button>
         </div>
         <p class="pbuy__wait-note">${c.noteOff}</p>`

    box.querySelector('[data-wait-on]').addEventListener('click', subscribe)
    box.querySelector('[data-wait-off]')?.addEventListener('click', unsubscribe)
  }

  async function subscribe(event) {
    const button = event.currentTarget
    if (button.getAttribute('aria-disabled') === 'true') return

    if (!currentUser()) {
      const user = await openLoginDialog(c.login)
      // Закрыли окно, не войдя, — ничего не меняется.
      if (!user) return
    }
    const result = await addToWaitlist(snapshot)
    if (!result.ok) return
    paint()
    // Кнопка перерисована — фокус остаётся на ней, а не уходит в body.
    box.querySelector('[data-wait-on]')?.focus({ preventScroll: true })
    showToast(c.toastOn, c.toastOnAction)
  }

  async function unsubscribe() {
    const removed = await removeFromWaitlist(id)
    paint()
    box.querySelector('[data-wait-on]')?.focus({ preventScroll: true })
    showToast(c.toastOff, {
      label: c.toastUndo,
      onClick: () => removed && restoreToWaitlist(removed.entry, removed.index),
    })
  }

  paint()
  onWaitlistChange(paint)
  onAccountChange(paint)
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
  // не пишет в корзину, пока человек не решил. У коробок в наличии
  // максимум — число свободных коробок; упёрлись — подпись под кнопками;
  // степпер и ряд весов — одно состояние (wireBoxes).
  const boxMax = isBox(product) && product.inStock ? Math.min(MAX_QTY, peekFreeCount(product.slug)) : MAX_QTY
  const limitNote = mount.querySelector('[data-boxes-limit]')
  const paintLimit = (value) => {
    if (!limitNote) return
    limitNote.hidden = value < boxMax
    limitNote.textContent = fillText(copy.boxes.limit, { n: boxMax, word: packsWord(boxMax) })
  }
  let boxes = null
  const qty = createQtyStepper({
    value: 1,
    max: boxMax,
    label: copy.buy.qty,
    decrease: copy.buy.decrease,
    increase: copy.buy.increase,
    onChange: (value) => {
      paintLimit(value)
      boxes?.setCount(value)
    },
  })
  mount.querySelector('[data-qty]')?.replaceWith(qty.node)
  paintLimit(qty.value)
  wireBoxes(mount, product, {
    // Отметили или сняли капсулу — степпер следует за рядом; set() без onChange.
    onPick: (picked) => {
      if (qty.value === picked.count) return
      qty.set(picked.count)
      paintLimit(picked.count)
    },
  }).then((picker) => {
    boxes = picker
  })

  mount.querySelector('[data-add-to-cart]')?.addEventListener('click', () => {
    addWithToast(product, qty.value, { packIds: boxes ? boxes.ids() : [] })
  })

  // Сердце — после кнопок; состояние общее с сердцами в лентах ниже.
  mount.querySelector('[data-fav-slot]')?.replaceWith(createHeartButton(product, 'pbuy__fav'))

  wireWaitlist(mount, product)

  // Кнопка не заводит вторую форму на странице, а поднимает угловой виджет:
  // одна форма на сайте — одна точка приёма заявок. У позиции без цены
  // она же называется «Узнать цену».
  mount.querySelector('[data-ask-expert]')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('expert:open'))
  })

  return { product }
}
