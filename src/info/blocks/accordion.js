/* ============================================================================
   accordion — вопросы и ответы группами. Вопрос — строка через волосяную
   линию, справа «+», который поворачивается в «×». Разметка — <details> /
   <summary>: блок работает и без скрипта. Скрипт добавляет плавное
   раскрытие (350 мс) и закрывает соседний вопрос внутри группы.

   У вопроса id из slug: /faq#<slug> раскрывает вопрос и прокручивает к нему.
   Вопрос с a: null не выводится.

   Над вопросами — капсулы групп («Все» и названия групп): выбор оставляет
   одну группу. Поле поиска стоит в первом экране (hero → search,
   data-ib-search="<id этого блока>"): поиск по вопросам и ответам без учёта
   регистра и «ё», с задержкой 150 мс; совпадения подсвечиваются, группы без
   совпадений прячутся, найденные вопросы раскрываются. Поиск и группа —
   в адресе (?q=, ?group=, replaceState).
   ============================================================================ */

import { esc, inline, section } from './_html.js'
import { reduced, scrollToEl } from './_motion.js'
import { animateDetails, wireDetails } from './list.js'

export function buildAccordion(d) {
  const groups = d.groups
    .map((g) => ({ ...g, items: g.items.filter((item) => item.a && item.a.length) }))
    .filter((g) => g.items.length)

  const chips = `
    <div class="ib-acc__filter" role="group" aria-label="${esc(d.filterLabel)}" data-reveal>
      <button type="button" class="ib-chip" aria-pressed="true" data-acc-group="">${esc(d.all)}</button>
      ${groups
        .map((g) => `<button type="button" class="ib-chip" aria-pressed="false" data-acc-group="${esc(g.key)}">${esc(g.title)}</button>`)
        .join('')}
    </div>`

  const body = groups
    .map(
      (g) => `
      <div class="ib-acc__group" data-acc-key="${esc(g.key)}">
        <h2 class="ib-acc__group-title" data-reveal>${esc(g.title)}</h2>
        <div class="ib-acc__items">
          ${g.items
            .map(
              (item) => `
            <details class="ib-acc__item" id="${esc(item.slug)}" data-reveal>
              <summary class="ib-acc__q"><span class="ib-acc__q-text" data-acc-q>${esc(item.q)}</span><span class="ib-acc__sign" aria-hidden="true"></span></summary>
              <div class="ib-acc__a" data-acc-body>
                <div class="ib-acc__a-inner" data-acc-a>${item.a.map((p) => `<p>${inline(p)}</p>`).join('')}</div>
              </div>
            </details>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('')

  return section('accordion', { ...d, title: null }, `
    <div class="container">
      <div class="ib-acc">
        ${chips}
        <div class="ib-acc__groups" data-acc-groups>${body}</div>
        <p class="ib-acc__empty" data-acc-empty hidden>${inline(d.empty)}</p>
      </div>
    </div>`, { attrs: d.label ? ` aria-label="${esc(d.label)}"` : '' })
}

/* ------------------------------------------------------------------- init */

const norm = (value) => String(value || '').toLowerCase().replace(/ё/g, 'е')

/** Подсветка совпадений только в текстовых узлах: ссылки в ответе целы. */
function mark(root, query) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  nodes.forEach((node) => {
    const text = node.nodeValue
    const low = norm(text)
    let at = low.indexOf(query)
    if (at === -1) return
    const frag = document.createDocumentFragment()
    let last = 0
    while (at !== -1) {
      frag.append(text.slice(last, at))
      const m = document.createElement('mark')
      m.textContent = text.slice(at, at + query.length)
      frag.append(m)
      last = at + query.length
      at = low.indexOf(query, last)
    }
    frag.append(text.slice(last))
    node.replaceWith(frag)
  })
}

export function initAccordion(root) {
  const groups = [...root.querySelectorAll('[data-acc-key]')]
  const items = [...root.querySelectorAll('details.ib-acc__item')]
  const chips = [...root.querySelectorAll('[data-acc-group]')]
  const empty = root.querySelector('[data-acc-empty]')
  const form = document.querySelector(`[data-ib-search="${root.id}"]`)
  const input = form?.querySelector('input')

  // Исходная разметка вопросов и ответов — чтобы снимать подсветку.
  const source = new Map()
  items.forEach((item) => {
    const q = item.querySelector('[data-acc-q]')
    const a = item.querySelector('[data-acc-a]')
    source.set(item, { q, a, qHtml: q.innerHTML, aHtml: a.innerHTML, text: norm(`${q.textContent} ${a.textContent}`) })
  })

  let group = ''
  let query = ''

  /* Соседний вопрос внутри группы закрывается. */
  items.forEach((item) => {
    wireDetails(item, (opened) => {
      if (query) return
      const own = opened.closest('[data-acc-key]')
      own?.querySelectorAll('details[open]').forEach((other) => {
        if (other !== opened) animateDetails(other, false)
      })
    })
  })

  const writeUrl = () => {
    const url = new URL(location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    if (group) url.searchParams.set('group', group)
    else url.searchParams.delete('group')
    history.replaceState(history.state, '', url)
  }

  const apply = ({ openFound = true } = {}) => {
    const q = norm(query).trim()
    let any = false
    groups.forEach((g) => {
      const inGroup = !group || g.dataset.accKey === group
      let found = 0
      g.querySelectorAll('details.ib-acc__item').forEach((item) => {
        const s = source.get(item)
        s.q.innerHTML = s.qHtml
        s.a.innerHTML = s.aHtml
        const hit = inGroup && (!q || s.text.includes(q))
        item.hidden = !hit
        if (!hit) return
        found += 1
        if (q) {
          mark(s.q, q)
          mark(s.a, q)
          if (openFound) item.open = true
        }
      })
      g.hidden = found === 0
      if (found) any = true
    })
    empty.hidden = any
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.accGroup === group)))
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      group = chip.dataset.accGroup
      apply()
      writeUrl()
    })
  })

  let timer = null
  input?.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const had = Boolean(query.trim())
      query = input.value
      if (had && !query.trim()) items.forEach((item) => (item.open = false))
      apply()
      writeUrl()
    }, 150)
  })
  form?.addEventListener('submit', (event) => event.preventDefault())

  /* Состояние из адреса. */
  const params = new URLSearchParams(location.search)
  query = params.get('q') || ''
  group = params.get('group') || ''
  if (group && !groups.some((g) => g.dataset.accKey === group)) group = ''
  if (input) input.value = query
  apply()

  /* /faq#<slug> — раскрыть и прокрутить. */
  const openHash = () => {
    const id = decodeURIComponent(location.hash.slice(1))
    const item = id && items.find((el) => el.id === id)
    if (!item) return
    if (item.hidden) {
      group = ''
      query = ''
      if (input) input.value = ''
      apply()
    }
    item.open = true
    requestAnimationFrame(() => scrollToEl(item, 24))
    // Шрифты и кадры выше догружаются и сдвигают вопрос — доводим ещё раз.
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => setTimeout(() => scrollToEl(item, 24), 60), { once: true })
    }
  }
  openHash()
  window.addEventListener('hashchange', openHash)
  root.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link) return
    const item = items.find((el) => `#${el.id}` === link.getAttribute('href'))
    if (!item) return
    event.preventDefault()
    event.stopPropagation()
    history.replaceState(history.state, '', link.getAttribute('href'))
    openHash()
  })

  if (reduced()) root.classList.add('is-reduced')
}
