/* ============================================================================
   Поиск в шапке.

   ЧТО ПРОИСХОДИТ ПО НАЖАТИЮ НА ЛУПУ. Содержимое шапки гаснет, и на его месте,
   В ТОЙ ЖЕ ВЫСОТЕ, разворачивается строка поиска во всю ширину контейнера.
   Под шапкой раскрывается панель подсказок.

   ПОЧЕМУ ВО ВСЮ ШИРИНУ, А НЕ ПОЛОСКОЙ СПРАВА. Логотип стоит по центру шапки.
   Строка на половину ширины либо упирается в него, либо заставляет его
   съезжать вбок — и то и другое читается как поломка. Замена всего содержимого
   решает сразу и это, и вопрос места: строке достаётся вся ширина, а панели
   подсказок — вся ширина под шапкой.

   ВЫСОТА ШАПКИ НЕ МЕНЯЕТСЯ. Строка лежит абсолютом поверх .header__inner,
   а сам .header__inner никуда не девается — он только гаснет (opacity +
   visibility). Если бы его убирали через display: none, высоту держать было бы
   нечему и шапка схлопывалась бы на 76 пикселей.

   МОБИЛЬНЫЙ — ОТДЕЛЬНЫЙ СЛОЙ. В шапке шириной 360px строка поиска с крестиком
   и кнопкой отмены не помещается рядом ни с чем, а панель подсказок под ней
   всё равно занимает весь экран. Поэтому ниже 1024px поиск открывается
   полноэкранным слоем — тем же приёмом, что мобильное меню.

   ДВА ИСТОЧНИКА ВЫДАЧИ. В прототипе выдача ненастоящая: совпадение подстрокой
   по набору товаров прототипа и дереву каталога (src/data/search.js). На
   Битриксе шапка передаёт remote, и выдача приходит с сервера
   (/search/suggest.php, include/search.php шаблона): товары и разделы живой
   витрины. До 16.09.2026 стенд тоже искал по данным прототипа — у чёрной икры
   там нет цен, отрисовка падала на первой же позиции, и панель оставалась
   пустой.

   ТРИ СОСТОЯНИЯ ПАНЕЛИ:
     пустое поле  — последние запросы, популярные, недавно просмотренные;
     есть ввод    — товары с миниатюрой и ценой, разделы, «показать все»;
     нет совпадений — объяснение и выход в каталог.

   КЛАВИАТУРА. ↑/↓ ходят по строкам выдачи, Enter уходит по активной строке
   (или на страницу результатов, если ничего не выделено), Esc закрывает.
   Роли combobox/listbox расставлены на поле и на списке: без них скринридер
   молчит о том, что под полем появились варианты.
   ============================================================================ */

import {
  productBySlug,
  productUrl,
  searchAll,
  searchCopy,
  searchIdle,
  searchUrl,
} from '../../data/search.js'
import { ROUTES } from '../../data/routes.js'
import { icons } from '../icons.js'
import { hydrateMedia } from '../media.js'
import { getLenis } from '../scroll.js'

const desktop = window.matchMedia('(min-width: 1024px)')

/** Задержка перед перерисовкой выдачи. Ниже — дёргается, выше — ощущается. */
const TYPE_DELAY = 120

/** Задержка перед запросом к серверу подсказок. */
const REMOTE_TYPE_DELAY = 250

const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const price = (value) => `${value.toLocaleString('ru-RU')}&nbsp;₽`

/**
 * Подсветка совпадения. Ищем по нормализованной строке (без «ё» и регистра),
 * а <mark> ставим по ИСХОДНОМУ тексту: подсвечивать нужно то, что человек
 * видит, а не то, по чему сравнивали.
 */
function highlight(text, query) {
  const source = String(text)
  const q = String(query).trim()
  if (q.length < 2) return escape(source)

  const flat = source.toLowerCase().replace(/ё/g, 'е')
  const needle = q.toLowerCase().replace(/ё/g, 'е')
  const at = flat.indexOf(needle)
  if (at === -1) return escape(source)

  return (
    escape(source.slice(0, at)) +
    `<mark>${escape(source.slice(at, at + needle.length))}</mark>` +
    escape(source.slice(at + needle.length))
  )
}

/* ------------------------------------------------------------- разметка */

const chip = (text) => `
  <button class="schip" type="button" data-search-item data-query="${escape(text)}">${escape(text)}</button>
`

const productRow = ({ product }, query) => `
  <a class="srow" href="${productUrl()}" data-search-item>
    <span class="srow__media"
          data-media="image"
          data-src="${product.photo}"
          data-ratio="1:1"
          data-class="srow__frame"
          data-alt="${escape(product.name)}"></span>
    <span class="srow__body">
      <span class="srow__name">${highlight(product.name, query)}</span>
      <span class="srow__note">${escape(product.weightLabel)}</span>
    </span>
    <span class="srow__price">${product.price == null ? searchCopy.priceOnRequest : price(product.price)}</span>
  </a>
`

/**
 * Строка товара из ответа сервера. Цена приходит готовой строкой
 * («7 990 ₽», «4 990 ₽ / кг», «Цена по запросу»), фотографий в выгрузке 1С
 * нет — на месте кадра знак марки, как в сетке каталога.
 */
const remoteProductRow = (card, query) => `
  <a class="srow" href="${escape(card.href)}" data-search-item>
    <span class="srow__media">
      <span class="media srow__frame is-blank" style="--media-ratio: 1 / 1" aria-hidden="true">
        <span class="blank__mark">${icons.emptyFish}</span>
      </span>
    </span>
    <span class="srow__body">
      <span class="srow__name">${highlight(card.name, query)}</span>
      <span class="srow__note">${escape(card.note)}</span>
    </span>
    <span class="srow__price">${escape(card.price)}</span>
  </a>
`

/* Подкатегория на живом сайте приходит с именем раздела (parent):
   «Холодного копчения» без «Рыбы» рядом читалась бы оторванной. */
const categoryRow = (category, query) => `
  <a class="scat" href="${category.href ? escape(category.href) : ROUTES.category(category.slug)}" data-search-item>
    <span class="scat__icon" aria-hidden="true">${icons[category.icon] || icons.search}</span>
    <span class="scat__name">${highlight(category.name, query)}${
      category.parent ? `<span class="scat__parent">${escape(category.parent)}</span>` : ''
    }</span>
  </a>
`

const group = (title, body, modifier = '') => `
  <section class="sgroup ${modifier}">
    <h3 class="sgroup__title eyebrow">${title}</h3>
    ${body}
  </section>
`

/* ---- последние запросы на живом сайте --------------------------------- */

const RECENT_KEY = 'gg-search-recent'

function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

function rememberQuery(query) {
  const q = String(query).trim()
  if (q.length < 2) return
  try {
    const next = [q, ...readRecent().filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* приватный режим — просто не запоминаем */
  }
}

/**
 * Пустое поле на живом сайте: свои последние запросы этого браузера и
 * популярные. «Недавно смотрели» здесь нет — истории просмотров сайт
 * пока не ведёт, а придуманная история хуже пустого места.
 */
function remoteIdleBody() {
  const recent = readRecent()
  return `
    ${recent.length ? group(searchCopy.recent, `<div class="schips">${recent.map(chip).join('')}</div>`) : ''}
    ${group(searchCopy.popular, `<div class="schips">${searchCopy.popularLive.map(chip).join('')}</div>`)}
  `
}

/** Пустое поле: последние, популярные, недавно просмотренные. */
function idleBody() {
  const viewed = searchIdle.viewedSlugs.map(productBySlug).filter(Boolean)

  return `
    ${
      searchIdle.recent.length
        ? group(searchCopy.recent, `<div class="schips">${searchIdle.recent.map(chip).join('')}</div>`)
        : ''
    }
    ${group(searchCopy.popular, `<div class="schips">${searchIdle.popular.map(chip).join('')}</div>`)}
    ${
      viewed.length
        ? group(searchCopy.viewed, `<div class="srows">${viewed.map((entry) => productRow(entry, '')).join('')}</div>`)
        : ''
    }
  `
}

/** Есть ввод: товары, разделы, «показать все». */
function resultsBody(result, { row = productRow, url = searchUrl(result.query) } = {}) {
  const { query, products, categories, total } = result

  if (!total) {
    return `
      <div class="sempty">
        <p class="sempty__title">${searchCopy.emptyTitle}</p>
        <p class="sempty__text">${searchCopy.emptyText}</p>
        <a class="btn btn--outline" href="${searchCopy.emptyAction.href}" data-search-item>
          ${searchCopy.emptyAction.label}
        </a>
      </div>
    `
  }

  return `
    ${
      products.length
        ? group(
            searchCopy.products,
            `<div class="srows">${products.map((entry) => row(entry, query)).join('')}</div>`,
          )
        : ''
    }
    ${
      categories.length
        ? group(
            searchCopy.sections,
            `<div class="scats">${categories.map((category) => categoryRow(category, query)).join('')}</div>`,
          )
        : ''
    }
    <a class="sall" href="${escape(url)}" data-search-item>
      ${searchCopy.all}
      ${products.length || categories.length ? `<span class="sall__count">${total}</span>` : ''}
    </a>
  `
}

/**
 * Строка поиска. Одна и та же разметка для шапки и для мобильного слоя —
 * отличаются только классом обёртки и наличием кнопки «закрыть».
 */
const field = (idSuffix) => `
  <form class="sfield" role="search" data-search-form>
    <span class="sfield__icon" aria-hidden="true">${icons.search}</span>
    <input class="sfield__input"
           id="search-input-${idSuffix}"
           type="search"
           name="q"
           autocomplete="off"
           spellcheck="false"
           enterkeyhint="search"
           placeholder="${searchCopy.placeholder}"
           aria-label="${searchCopy.submit}"
           role="combobox"
           aria-expanded="false"
           aria-autocomplete="list"
           aria-controls="search-results-${idSuffix}"
           data-search-input>
    <button class="sfield__clear" type="button" data-search-clear hidden>
      ${icons.close}
      <span class="visually-hidden">Очистить</span>
    </button>
    <button class="sfield__close" type="button" data-search-close>
      <span class="sfield__close-label">${searchCopy.close}</span>
      <span class="sfield__close-icon" aria-hidden="true">${icons.close}</span>
    </button>
  </form>
`

const results = (idSuffix) => `
  <div class="sresults" id="search-results-${idSuffix}" role="listbox"
       aria-label="Подсказки поиска" data-search-results></div>
`

/* ------------------------------------------------------------- сборка */

/**
 * Поднимает поиск. Разметку строит сам: в шапке — строку поверх .header__inner
 * и панель под шапкой, в конце body — мобильный слой.
 *
 * @param {object} o
 * @param {HTMLElement} o.header
 * @param {HTMLElement[]} o.triggers точки входа в поиск: капсула в шапке
 *   на десктопе и иконка на мобильном
 * @param {() => void} [o.onOpen] закрыть то, что не должно висеть вместе с поиском
 * @param {{suggestUrl: string, resultsUrl: string}} [o.remote] выдача с сервера
 *   (Битрикс). Без него — выдача прототипа по src/data/search.js
 * @returns {{open: () => void, close: () => void, isOpen: () => boolean}}
 */
export function initSearch({ header, triggers = [], onOpen, remote = null }) {
  if (!header) return { open: () => {}, close: () => {}, isOpen: () => false }

  /* ---- разметка ---------------------------------------------------------- */

  const container = header.querySelector('.container')

  const bar = document.createElement('div')
  bar.className = 'hsearch'
  bar.innerHTML = field('bar')
  container.appendChild(bar)

  const panel = document.createElement('div')
  panel.className = 'searchpanel'
  panel.innerHTML = `<div class="searchpanel__scroll"><div class="container">${results('bar')}</div></div>`
  header.appendChild(panel)

  /* Затемнение под панелью подсказок — то же самое, что под выпадающими
     панелями. Своё, а не общее с megamenu.js: панель поиска и мегапанель
     никогда не открыты вместе, и делить один узел ради этого не стоит —
     пришлось бы связывать два независимых модуля. */
  const scrim = document.createElement('div')
  scrim.className = 'nav-scrim'
  scrim.setAttribute('aria-hidden', 'true')
  header.after(scrim)

  const layer = document.createElement('div')
  layer.className = 'searchfull'
  layer.setAttribute('aria-hidden', 'true')
  layer.innerHTML = `
    <div class="searchfull__head"><div class="container">${field('full')}</div></div>
    <div class="searchfull__body"><div class="container">${results('full')}</div></div>
  `
  document.body.appendChild(layer)

  /* ---- ссылки на узлы ---------------------------------------------------- */

  const views = [
    {
      root: bar,
      form: bar.querySelector('[data-search-form]'),
      input: bar.querySelector('[data-search-input]'),
      clear: bar.querySelector('[data-search-clear]'),
      body: panel.querySelector('[data-search-results]'),
    },
    {
      root: layer,
      form: layer.querySelector('[data-search-form]'),
      input: layer.querySelector('[data-search-input]'),
      clear: layer.querySelector('[data-search-clear]'),
      body: layer.querySelector('[data-search-results]'),
    },
  ]

  const view = () => (desktop.matches ? views[0] : views[1])

  let open = false
  let active = -1
  let items = []
  let typing = null
  let locked = false

  /* ---- выдача ------------------------------------------------------------ */

  /* Ответы сервера по запросам: повторный ввод того же текста не ходит
     на сервер, а устаревший ответ не перерисовывает свежую выдачу. */
  const cache = new Map()
  let pending = null

  const resultsHref = (query) => `${remote.resultsUrl}?q=${encodeURIComponent(query)}`

  async function fetchSuggest(query) {
    if (cache.has(query)) return cache.get(query)
    pending?.abort()
    pending = new AbortController()
    const response = await fetch(`${remote.suggestUrl}?q=${encodeURIComponent(query)}`, {
      signal: pending.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`suggest ${response.status}`)
    const data = await response.json()
    const result = {
      query,
      products: Array.isArray(data.products) ? data.products : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      total: Number(data.total) || 0,
    }
    result.total = Math.max(result.total, result.products.length) + result.categories.length
    cache.set(query, result)
    return result
  }

  function paint() {
    const query = view().input.value.trim()

    if (remote) {
      if (query.length < 2) {
        pending?.abort()
        render(remoteIdleBody())
        return
      }
      fetchSuggest(query)
        .then((result) => {
          // Пока ответ шёл, человек мог дописать запрос: старый ответ не рисуем.
          if (view().input.value.trim() !== query) return
          render(resultsBody(result, { row: remoteProductRow, url: resultsHref(query) }))
        })
        .catch((error) => {
          if (error.name === 'AbortError') return
          // Сервер не ответил — честно ведём на страницу результатов.
          render(resultsBody({ query, products: [], categories: [], total: 1 }, { url: resultsHref(query) }))
        })
      return
    }

    render(query.length < 2 ? idleBody() : resultsBody(searchAll(query)))
  }

  function render(html) {
    // Рисуем в обе панели сразу: их две (шапка и мобильный слой), а какая
    // из них на экране — решает медиазапрос. Перекладывать DOM при повороте
    // экрана было бы дороже и ломало бы фокус.
    views.forEach((item) => {
      item.body.innerHTML = html
      hydrateMedia(item.body)
    })

    // Кнопка очистки живёт только при непустом поле.
    views.forEach((item) => {
      item.clear.hidden = !item.input.value
    })

    active = -1
    items = [...view().body.querySelectorAll('[data-search-item]')]
    items.forEach((el, index) => {
      el.setAttribute('role', 'option')
      el.id = el.id || `search-option-${index}`
      el.setAttribute('aria-selected', 'false')
    })
  }

  function setActive(index) {
    if (!items.length) return

    const next = (index + items.length) % items.length
    items.forEach((el, i) => {
      const on = i === next
      el.classList.toggle('is-active', on)
      el.setAttribute('aria-selected', String(on))
    })

    active = next
    const el = items[next]
    view().input.setAttribute('aria-activedescendant', el.id)
    el.scrollIntoView({ block: 'nearest' })
  }

  /* ---- открыть / закрыть ------------------------------------------------- */

  /**
   * @param {boolean} next
   * @param {{focusTrigger?: boolean}} [o] вернуть ли фокус на точку входа
   *   при закрытии.
   *   Не всегда: если поиск закрылся оттого, что человек ушёл табом дальше
   *   по странице, возврат фокуса назад запер бы его в шапке навсегда.
   */
  function setOpen(next, { focusTrigger = true } = {}) {
    if (open === next) return
    open = next

    const mobile = !desktop.matches

    header.classList.toggle('is-searching', next && !mobile)
    panel.classList.toggle('is-open', next && !mobile)
    scrim.classList.toggle('is-visible', next && !mobile)
    document.documentElement.classList.toggle('has-searchpanel', next && !mobile)
    layer.classList.toggle('is-open', next && mobile)
    layer.setAttribute('aria-hidden', String(!(next && mobile)))

    triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', String(next)))
    views.forEach((item) => item.input.setAttribute('aria-expanded', String(next)))

    // Шапке нужно знать: над раскрытой панелью подсказок она должна быть
    // плотной, а не полупрозрачной. Событием, а не колбэком, — причин
    // для плотного состояния несколько и сводит их одна функция в header.js.
    header.dispatchEvent(new CustomEvent('search:toggle', { detail: { open: next } }))

    // Мобильный слой перекрывает страницу целиком — прокрутку под ним держим
    // выключенной в двух местах сразу: нативную и Lenis (инерция живёт своей).
    //
    // Снимаем блокировку ПО ФЛАГУ, а не по текущей ширине окна: поиск можно
    // открыть на мобильном и закрыть уже после поворота экрана, и тогда
    // проверка «сейчас мобильный?» вернёт false, а страница осталась бы
    // заблокированной навсегда.
    if (next && mobile) locked = true
    if (!next || !mobile) {
      if (locked) {
        document.body.classList.remove('is-locked')
        getLenis()?.start()
        locked = false
      }
    } else {
      document.body.classList.add('is-locked')
      getLenis()?.stop()
    }

    if (next) {
      onOpen?.()
      paint()

      // Фокус ставим дважды. Сразу — чтобы он не остался на кнопке-лупе, если
      // кадр не придёт (свёрнутая вкладка, prefers-reduced-motion). И после
      // кадра — потому что пока строка не проявилась, Safari отказывается
      // ставить каретку и открывает клавиатуру мимо поля.
      view().input.focus()
      requestAnimationFrame(() => view().input.focus())
    } else {
      views.forEach((item) => {
        item.input.value = ''
        item.input.removeAttribute('aria-activedescendant')
        item.clear.hidden = true
      })
      active = -1
      items = []
      if (focusTrigger) triggers[0]?.focus()
    }
  }

  /* ---- события ----------------------------------------------------------- */

  triggers.forEach((trigger) => {
    trigger.setAttribute('aria-expanded', 'false')
    trigger.addEventListener('click', (event) => {
      event.preventDefault()
      setOpen(!open)
    })
  })

  views.forEach((item) => {
    item.input.addEventListener('input', () => {
      clearTimeout(typing)
      // С сервером задержка длиннее: запрос на каждую букву — лишняя нагрузка
      // и лишние хиты «Контроля активности».
      typing = setTimeout(paint, remote ? REMOTE_TYPE_DELAY : TYPE_DELAY)
    })

    item.clear.addEventListener('click', () => {
      item.input.value = ''
      item.input.focus()
      paint()
    })

    item.root.querySelector('[data-search-close]').addEventListener('click', () => setOpen(false))

    item.form.addEventListener('submit', (event) => {
      event.preventDefault()
      const query = item.input.value.trim()
      if (!query) return
      if (remote) {
        rememberQuery(query)
        location.href = resultsHref(query)
        return
      }
      location.href = searchUrl(query)
    })

    item.input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive(active + 1)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive(active - 1)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== 'Enter') return

      const el = items[active]
      if (!el) return // пусто — работает обычная отправка формы

      event.preventDefault()
      // Строка популярного запроса не ссылка, а кнопка: она подставляет текст
      // в поле и сразу пересобирает выдачу.
      if (el.dataset.query) {
        item.input.value = el.dataset.query
        paint()
        return
      }
      el.click()
    })
  })

  // Чипы запросов подставляют текст в поле, ссылки работают ссылками.
  views.forEach((item) => {
    item.body.addEventListener('click', (event) => {
      if (remote && event.target.closest('a[data-search-item]')) rememberQuery(item.input.value)
      const el = event.target.closest('[data-query]')
      if (!el) return
      item.input.value = el.dataset.query
      item.input.focus()
      paint()
    })
  })

  document.addEventListener('keydown', (event) => {
    if (open && event.key === 'Escape') setOpen(false)
  })

  // Клик мимо: в шапке — всё, что вне шапки; на мобильном слой занимает
  // экран целиком, и «мимо» там не бывает.
  document.addEventListener('pointerdown', (event) => {
    if (!open || !desktop.matches) return
    if (header.contains(event.target)) return
    setOpen(false)
  })

  /* Фокус ушёл табом за пределы шапки — закрываем, но НЕ возвращаем его
     назад. Это поведение обычного комбобокса: панель подсказок не ловит
     фокус в кольцо (как это делают мегапанели), она просто исчезает, когда
     до неё больше нет дела. Кольцо здесь было бы вредным: из поиска человек
     чаще всего уходит дальше по странице, а не по кругу между полем
     и подсказками. */
  document.addEventListener('focusin', (event) => {
    if (!open || !desktop.matches) return
    if (header.contains(event.target)) return
    setOpen(false, { focusTrigger: false })
  })

  // Смена раскладки экрана с открытым поиском: состояние принадлежит разным
  // узлам, поэтому закрываем — иначе на мобильном останется висеть строка
  // в шапке, а на десктопе полноэкранный слой.
  desktop.addEventListener('change', () => {
    if (open) setOpen(false)
  })

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
  }
}

/* ------------------------------------------------ строка на /search/ */

/**
 * Подсказки под строкой страницы результатов (только Битрикс).
 *
 * До 22.09.2026 строка на /search/ была голой формой: набираешь — ничего
 * не происходит, пока не нажмёшь «Найти». Подсказки жили только в шапке,
 * и человек, дописывавший запрос на странице выдачи, видел поиск
 * «сломанным». Теперь под строкой та же выдача, что в шапке: те же
 * строки товаров, разделы и «Показать все результаты», тот же сервер
 * и та же задержка; пустое поле — свои последние и популярные запросы.
 *
 * Разметка страницы: form.search-page__form > input.search-page__input.
 * Без скрипта форма работает как раньше.
 *
 * @param {HTMLFormElement} form
 * @param {{suggestUrl: string, resultsUrl: string}} remote
 */
export function initInlineSearch(form, remote) {
  const input = form?.querySelector('input[name="q"]')
  if (!form || !input || !remote) return

  const box = document.createElement('div')
  box.className = 'search-page__suggest'
  box.hidden = true
  box.innerHTML = results('page')
  form.appendChild(box)
  const body = box.querySelector('[data-search-results]')

  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-controls', 'search-results-page')
  input.setAttribute('aria-expanded', 'false')

  const cache = new Map()
  let pending = null
  let typing = null
  let items = []
  let active = -1

  const resultsHref = (query) => `${remote.resultsUrl}?q=${encodeURIComponent(query)}`

  function show(next) {
    box.hidden = !next
    input.setAttribute('aria-expanded', String(next))
    if (!next) {
      active = -1
      input.removeAttribute('aria-activedescendant')
    }
  }

  function render(html) {
    body.innerHTML = html
    items = [...body.querySelectorAll('[data-search-item]')]
    items.forEach((el, index) => {
      el.setAttribute('role', 'option')
      el.id = `search-page-option-${index}`
      el.setAttribute('aria-selected', 'false')
    })
    active = -1
    show(true)
  }

  async function fetchSuggest(query) {
    if (cache.has(query)) return cache.get(query)
    pending?.abort()
    pending = new AbortController()
    const response = await fetch(`${remote.suggestUrl}?q=${encodeURIComponent(query)}`, {
      signal: pending.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`suggest ${response.status}`)
    const data = await response.json()
    const result = {
      query,
      products: Array.isArray(data.products) ? data.products : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      total: Number(data.total) || 0,
    }
    result.total = Math.max(result.total, result.products.length) + result.categories.length
    cache.set(query, result)
    return result
  }

  function paint() {
    const query = input.value.trim()
    if (query.length < 2) {
      pending?.abort()
      render(remoteIdleBody())
      return
    }
    fetchSuggest(query)
      .then((result) => {
        if (input.value.trim() !== query) return
        render(resultsBody(result, { row: remoteProductRow, url: resultsHref(query) }))
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        render(resultsBody({ query, products: [], categories: [], total: 1 }, { url: resultsHref(query) }))
      })
  }

  function setActive(index) {
    if (!items.length) return
    active = (index + items.length) % items.length
    items.forEach((el, i) => {
      el.classList.toggle('is-active', i === active)
      el.setAttribute('aria-selected', String(i === active))
    })
    input.setAttribute('aria-activedescendant', items[active].id)
    items[active].scrollIntoView({ block: 'nearest' })
  }

  input.addEventListener('focus', () => {
    if (box.hidden) paint()
  })

  input.addEventListener('input', () => {
    clearTimeout(typing)
    typing = setTimeout(paint, REMOTE_TYPE_DELAY)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (box.hidden) paint()
      else setActive(active + 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(active - 1)
      return
    }
    if (event.key === 'Escape') {
      if (!box.hidden) {
        event.preventDefault()
        show(false)
      }
      return
    }
    if (event.key !== 'Enter') return
    const el = items[active]
    if (!el || box.hidden) return // обычная отправка формы
    event.preventDefault()
    if (el.dataset.query) {
      input.value = el.dataset.query
      paint()
      return
    }
    el.click()
  })

  body.addEventListener('click', (event) => {
    if (event.target.closest('a[data-search-item]')) rememberQuery(input.value)
    const chipEl = event.target.closest('[data-query]')
    if (!chipEl) return
    input.value = chipEl.dataset.query
    input.focus()
    paint()
  })

  form.addEventListener('submit', () => rememberQuery(input.value))

  document.addEventListener('pointerdown', (event) => {
    if (!box.hidden && !form.contains(event.target)) show(false)
  })

  document.addEventListener('focusin', (event) => {
    if (!box.hidden && !form.contains(event.target)) show(false)
  })
}
