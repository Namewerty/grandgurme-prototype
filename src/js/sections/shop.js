/* ============================================================================
   #shop — витрина «С чего обычно начинают».

   Что было и почему переделано. Шесть очень крупных карточек в две строки,
   переключатель размером с кнопку призыва и заголовок «Себе или в подарок?»,
   дублировавший этот переключатель. Блок занимал полстраницы под то, что
   по смыслу — короткая подсказка: полный ассортимент живёт в каталоге.

   Стало: одна лента, на десктопе видно пять карточек и краешек шестой,
   остальные прокручиваются. Карточка вдвое меньше, кадр квадратный (пэкшоты
   сняты на белом, квадрат для них естественнее вертикали 4:5), «в корзину» —
   компактная иконочная кнопка в углу кадра вместо полосы во всю ширину.

   Четыре механики:

   1. Селектор. Заливка активной вкладки не мигает, а переезжает: за текстом
      живёт отдельная подложка .switch__thumb, её x и ширина анимируются на
      450 мс power2.inOut. Роли tablist / tab / tabpanel, стрелки влево-вправо.
      Сама капсула стала заметно мельче — она подпись к ленте, а не герой блока.

   2. Смена набора. Уходящие карточки гаснут со stagger 40 мс, приходящие
      возвращаются со stagger 55 мс. Фазы перекрываются — иначе с восемью
      карточками только staggers съели бы больше полусекунды. Уходящая лента
      на время перехода становится absolute, поэтому обе живут в одной точке
      и высота контейнера не прыгает: она зафиксирована и доводится до новой
      отдельным твином. После смены лента пересчитывает свои края: наборы
      разной длины, и пейджер должен об этом знать.

   3. Прокрутка ленты. Механизм из js/rail.js: нативный overflow-x со snap,
      обрезанный край и три органа управления — ползунок под лентой, пейджер
      рядом с ним и стрелки поверх краёв по наведению.

      ПЕРЕДЕЛАНО ПО ПРАВКЕ ЗАКАЗЧИКА. Было: единственный пейджер в строке
      с переключателем, то есть над лентой и в стороне от неё, — заказчик
      сказал, что эти стрелки не находятся, а рука тянется к низу ленты.
      Стало: полоса позиции превратилась в живой ползунок (тянем за отрезок,
      щёлкаем по дорожке), пейджер переехал вниз и встал с ним в одну строку,
      а поверх краёв ленты по наведению всплывают стрелки. Подробности
      и мотивировка — в шапке js/rail.js.

   4. Корзина. Иконочная кнопка кладёт позицию в настоящую корзину
      (js/cart/store.js). Две банки икры кладутся настоящими позициями
      каталога — с наличием из выгрузки; остальные шесть выгрузки не имеют
      и кладутся снимком с витрины (см. cartProductOf).
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { productSets, shopCopy } from '../../data/products.js'
import { findProductBySlug } from '../../data/catalog-products.js'
import { cartCopy } from '../../data/cart-copy.js'
import { kindOf } from '../../data/fulfillment.js'
import { addWithToast } from '../cart/add.js'
import { createProductCard } from '../components/product-card.js'
import { createArrow, createPager, initRail } from '../rail.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Тайминги перехода между наборами. */
const SWAP = {
  outDuration: 0.2,
  outStagger: 0.04,
  inStart: 0.1,
  inDuration: 0.28,
  inStagger: 0.055,
}

const THUMB_DURATION = 0.45

/* --------------------------------------------------------------- разметка */

/**
 * Карточка витрины — общий компонент, тот же, что в сетке каталога
 * (js/components/product-card.js). Плашки, сердца и старой цены на главной
 * нет: витрина — короткая подсказка, а не выдача каталога.
 */
/**
 * Что класть в корзину с витрины.
 *
 * Позиция каталога — только если адрес ведёт на неё И название совпадает.
 * Проверка названия не лишняя: шесть позиций без выгрузки ведут на
 * демонстрационный адрес SAMPLE.product, то есть на банку белуги, и без неё
 * «Пате из лосося» легло бы в корзину белугой.
 *
 * Остальное кладётся снимком витрины. Цена берётся из строки карточки
 * (она уже помечена предварительной в src/data/products.js), наличие —
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: остатков по рыбе, крабам и наборам в выгрузке
 * нет, и позиция считается имеющейся на складе.
 */
function cartProductOf(item, key, index) {
  const slug = item.href.startsWith('/product/') ? item.href.slice('/product/'.length) : null
  const catalog = slug ? findProductBySlug(slug) : null
  if (catalog && catalog.name === item.name) return catalog

  const digits = String(item.price).replace(/\D/g, '')
  return {
    id: `showcase-${key}-${index}`,
    name: item.name,
    note: item.note,
    href: item.href,
    image: item.media.src,
    price: digits ? Number(digits) : null,
    inStock: true,
  }
}

function buildCard(item, key, index) {
  const { name, note, price, href, media } = item
  // Вид позиции витрины: у позиции каталога — по её разделу, у снимка —
  // «в наличии и с ценой — stock, иначе request» (src/data/fulfillment.js).
  const product = cartProductOf(item, key, index)
  const kind = kindOf(product)
  return createProductCard({
    name,
    note,
    href,
    price,
    // alt по названию товара, а не общий из реестра: кадр скрыт от
    // скринридера, но так он осмысленно попадёт в поиск по картинкам.
    image: { src: media.src, ratio: '1:1' },
    add: {
      label: cartCopy.addLabel[kind],
      onAdd: () => addWithToast(product),
    },
    kind,
  })
}

function buildRail(key) {
  const rail = document.createElement('div')
  rail.className = 'shop__rail rail-track rail-mask'
  rail.id = 'shop-panel'
  rail.setAttribute('role', 'tabpanel')
  rail.setAttribute('aria-labelledby', `shop-tab-${key}`)
  rail.tabIndex = 0
  rail.dataset.set = key

  productSets[key].forEach((item, index) => rail.appendChild(buildCard(item, key, index)))
  return rail
}

export function buildShop(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section shop'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const first = shopCopy.tabs[0]

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="shop__head">
          <p class="eyebrow" data-reveal>${shopCopy.eyebrow}</p>
          <h2 id="${item.id}-title" class="shop__title" data-reveal>${shopCopy.title}</h2>
          <p class="shop__note" data-reveal>${shopCopy.note}</p>
        </div>

        <!-- В строке остался только переключатель: пейджер уехал вниз, к
             ползунку (см. шапку файла). Поэтому и три колонки больше не нужны —
             капсула центрируется сама. -->
        <div class="shop__controls" data-reveal>
          <div class="switch" role="tablist" aria-label="Кому выбираем" data-shop-tablist>
            <span class="switch__thumb" aria-hidden="true" data-shop-thumb></span>
            ${shopCopy.tabs
              .map(
                ({ key, label, panelLabel }, index) => `
              <button class="switch__tab" type="button" role="tab"
                      id="shop-tab-${key}"
                      data-shop-tab="${key}"
                      aria-controls="shop-panel"
                      aria-label="${panelLabel}"
                      aria-selected="${index === 0}"
                      tabindex="${index === 0 ? '0' : '-1'}">${label}</button>`,
              )
              .join('')}
          </div>
        </div>

        <!-- Управление лентой лежит ВНУТРИ обёртки: класс is-scrollable JS
             ставит на неё, и ползунок со стрелками гаснет целиком, когда лента
             влезла без остатка. Маска обрезанного края висит отдельно на самом
             скроллере (класс .rail-mask у .shop__rail), иначе она гасила бы
             и концы полосы. -->
        <div class="shop__frame" data-shop-frame>
          <!-- Сцена: сама лента плюс стрелки поверх её краёв. Позиционируются
               они от сцены, а не от обёртки, — иначе центрировались бы
               по высоте вместе со строкой ползунка под ней. -->
          <div class="shop__stage" data-shop-stage>
            <div class="shop__viewport" data-shop-viewport></div>
          </div>

          <!-- Ползунок и пейджер одной строкой: два способа листать стоят
               рядом, и ни один не приходится искать. -->
          <div class="shop__slider">
            <div class="rail-bar" aria-hidden="true">
              <span class="rail-bar__thumb" data-shop-bar></span>
            </div>

            <span data-shop-pager></span>
          </div>
        </div>

        <p class="shop__more">
          <a class="shop__more-link" href="${first.more.href}" data-shop-more>${first.more.label}</a>
        </p>
      </div>
    </div>
  `

  section.querySelector('[data-shop-viewport]').appendChild(buildRail(first.key))

  const pager = createPager(shopCopy.railLabel)
  section.querySelector('[data-shop-pager]').appendChild(pager.node)

  // Стрелки поверх ленты — дубль пейджера для тех, кто не смотрит вниз.
  // aria-hidden и tabindex=-1: в дерево доступности они не идут, иначе
  // скринридер объявлял бы четыре кнопки листания вместо двух.
  const stage = section.querySelector('[data-shop-stage]')
  ;['prev', 'next'].forEach((dir) => {
    const arrow = createArrow(dir, '')
    arrow.setAttribute('aria-hidden', 'true')
    arrow.tabIndex = -1
    stage.appendChild(arrow)
  })

  return section
}

/* ------------------------------------------------------- подложка вкладок */

function createThumb(list, thumb) {
  const place = (tab, animate) => {
    if (!tab) return
    const offset = tab.offsetLeft
    const width = tab.offsetWidth

    if (!animate || REDUCED) {
      gsap.set(thumb, { x: offset, width })
      return
    }
    gsap.to(thumb, { x: offset, width, duration: THUMB_DURATION, ease: 'power2.inOut' })
  }

  const active = () => list.querySelector('[aria-selected="true"]')

  // Ширина вкладок зависит от шрифта — до его загрузки подложка встала бы мимо.
  place(active(), false)
  if (document.fonts?.ready) document.fonts.ready.then(() => place(active(), false))
  window.addEventListener('resize', () => place(active(), false))

  return place
}

/* --------------------------------------------------------- смена набора */

/**
 * @param {HTMLElement} viewport
 * @param {() => void} onSwapped лента пересчитывает края: наборы разной длины
 */
function createSwapper(viewport, onSwapped) {
  let running = null

  return function swap(key) {
    const outgoing = viewport.querySelector('.shop__rail')
    if (!outgoing || outgoing.dataset.set === key) return

    // Досматривать предыдущий переход некогда: досчитываем его мгновенно,
    // onComplete приберёт за собой, и стартуем новый с чистого состояния.
    if (running) running.progress(1)

    const incoming = buildRail(key)

    if (REDUCED) {
      outgoing.replaceWith(incoming)
      onSwapped()
      return
    }

    const startHeight = viewport.offsetHeight

    viewport.style.height = `${startHeight}px`
    outgoing.classList.add('is-leaving')
    outgoing.setAttribute('aria-hidden', 'true')
    outgoing.removeAttribute('id')
    outgoing.tabIndex = -1

    viewport.appendChild(incoming)

    const leaving = outgoing.querySelectorAll('.product')
    const entering = incoming.querySelectorAll('.product')
    const endHeight = incoming.offsetHeight

    gsap.set(entering, { opacity: 0, y: 16 })

    running = gsap.timeline({
      onComplete: () => {
        outgoing.remove()
        viewport.style.height = ''
        gsap.set(entering, { clearProps: 'opacity,transform' })
        running = null
        onSwapped()
        ScrollTrigger.refresh()
      },
    })

    running.to(
      leaving,
      { opacity: 0, y: 16, duration: SWAP.outDuration, ease: 'power2.in', stagger: SWAP.outStagger },
      0,
    )

    running.to(
      entering,
      {
        opacity: 1,
        y: 0,
        duration: SWAP.inDuration,
        ease: 'power3.out',
        stagger: SWAP.inStagger,
      },
      SWAP.inStart,
    )

    if (Math.abs(endHeight - startHeight) > 1) {
      running.to(viewport, { height: endHeight, duration: 0.3, ease: 'power2.inOut' }, SWAP.inStart)
    }

    // Пейджер оживает по новой ленте сразу, не дожидаясь конца перехода:
    // приходящая лента уже в потоке и её ширину можно измерить.
    onSwapped()
  }
}

/* ------------------------------------------------------------- селектор */

function wireTabs(section, onSwapped) {
  const list = section.querySelector('[data-shop-tablist]')
  const thumb = section.querySelector('[data-shop-thumb]')
  const viewport = section.querySelector('[data-shop-viewport]')
  const more = section.querySelector('[data-shop-more]')
  if (!list || !thumb || !viewport) return

  const tabs = [...list.querySelectorAll('[data-shop-tab]')]
  const place = createThumb(list, thumb)
  const swap = createSwapper(viewport, onSwapped)

  const select = (tab, { focus = false } = {}) => {
    if (!tab) return

    tabs.forEach((other) => {
      const on = other === tab
      other.setAttribute('aria-selected', String(on))
      other.tabIndex = on ? 0 : -1
    })

    place(tab, true)
    swap(tab.dataset.shopTab)

    const copy = shopCopy.tabs.find(({ key }) => key === tab.dataset.shopTab)
    if (more && copy) {
      more.textContent = copy.more.label
      more.href = copy.more.href
    }

    if (focus) tab.focus()
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab)))

  list.addEventListener('keydown', (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[event.key]
    if (step === undefined) return

    event.preventDefault()
    const current = tabs.indexOf(document.activeElement)
    const from = current === -1 ? tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true') : current
    const next =
      step === -Infinity ? 0 : step === Infinity ? tabs.length - 1 : (from + step + tabs.length) % tabs.length

    select(tabs[next], { focus: true })
  })
}

/* ------------------------------------------------------------ каскад входа */

function createCascade(section) {
  const cards = section.querySelectorAll('.shop__rail .product')
  if (!cards.length) return

  gsap.set(cards, { opacity: 0, y: 24 })

  gsap.to(cards, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out',
    stagger: 0.06,
    scrollTrigger: { trigger: section.querySelector('[data-shop-viewport]'), start: 'top 85%', once: true },
    onComplete: () => gsap.set(cards, { clearProps: 'opacity,transform' }),
  })
}

/* ------------------------------------------------------------------- init */

export function initShop() {
  const section = document.querySelector('#shop')
  if (!section) return

  const frame = section.querySelector('[data-shop-frame]')
  const bar = section.querySelector('[data-shop-bar]')

  // По две кнопки на направление: капсула под лентой и стрелка поверх края.
  const prev = [...section.querySelectorAll('.rail-pager__btn--prev, .rail-edge--prev')]
  const next = [...section.querySelectorAll('.rail-pager__btn--next, .rail-edge--next')]

  // Лента живёт до первой смены набора, потом её заменяет новая — поэтому
  // при каждой смене поднимаем механизм заново на актуальном элементе,
  // предварительно отписав прежний: кнопки пейджера общие для обеих лент.
  let rail = null
  const mount = () => {
    rail?.destroy()
    rail = initRail({
      track: section.querySelector('.shop__rail:not(.is-leaving)'),
      frame,
      prev,
      next,
      bar,
    })
  }

  mount()
  wireTabs(section, mount)

  if (!REDUCED) createCascade(section)
}
