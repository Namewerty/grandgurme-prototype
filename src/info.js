/* ============================================================================
   Информационные страницы раздела «Компания», партия 1. Одна точка входа
   на девять адресов: страница выбирается по location.pathname
   (src/info/pages/), разметка — из блоков (src/info/render.js).

   Порядок вызовов — как в src/page.js и src/alt2/main.js: разметка до
   скролл-движка, шапка и подвал, затем Lenis и появление блоков (initScroll —
   тот же, что на /alt2: он не завязан на секции главной, кольцо без своего
   узла не строится), затем init блоков.

   ?snapshot=1 (только dev-сервер): вместо сборки скриптом в <main>
   вставляется готовый снимок bitrix/info-snapshots/<адрес>.html — проверка,
   что разметка, перенесённая на Битрикс как есть, оживает тем же init*.
   ============================================================================ */

import 'lenis/dist/lenis.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components/topbar.css'
import './styles/components/header.css'
import './styles/components/megamenu.css'
import './styles/components/search.css'
import './styles/components/media.css'
import './styles/components/footer.css'
import './styles/components/buttons.css'
import './styles/components/crumbs.css'
import './styles/components/form.css'
import './styles/components/qty.css'
import './styles/components/rail.css'
import './alt2/styles/character.css'
import './alt2/styles/origin.css'
import './info/styles/info.css'
import './info/styles/blocks/hero.css'
import './info/styles/blocks/subnav.css'
import './info/styles/blocks/text.css'
import './info/styles/blocks/facts.css'
import './info/styles/blocks/split.css'
import './info/styles/blocks/steps.css'
import './info/styles/blocks/cards.css'
import './info/styles/blocks/list.css'
import './info/styles/blocks/accordion.css'
import './info/styles/blocks/table.css'
import './info/styles/blocks/cta.css'
import './info/styles/blocks/form.css'
import './info/styles/blocks/timezones.css'
import './info/styles/blocks/next.css'
import './info/styles/blocks/tasting.css'
import './info/styles/blocks/portion.css'
import './info/styles/blocks/guests.css'
import './info/styles/blocks/thermo.css'
import './info/styles/blocks/orbit.css'
import './info/styles/blocks/giftbox.css'
import './info/styles/blocks/inside.css'
import './info/styles/blocks/channels.css'
import './info/styles/blocks/boutique.css'
import './info/styles/blocks/doclist.css'
import './info/styles/blocks/gallery.css'
import './info/styles/blocks/sticky.css'

// Последним: акцентный шрифт и зерно тёмных секций под body.is-info.
import './alt2/alt2.css'

import { initHeader } from './js/sections/header.js'
import { initFooter } from './js/sections/footer.js'
import { getLenis, initScroll } from './js/scroll.js'
import { placeholderLabel } from './js/media.js'
import { buildCharacter, initCharacter } from './alt2/sections/character.js'
import { buildOrigin, initOrigin } from './alt2/sections/origin.js'
import { infoPageFor } from './info/pages/index.js'
import { initBlocks, renderPage } from './info/render.js'
import { scrollToEl, setLenisGetter } from './info/blocks/_motion.js'

/* ------------------------------------------------------------ снимки */

/* Только в dev: в собранной версии ветка выпадает целиком вместе со
   снимками (import.meta.env.DEV — константа сборки). */
async function snapshotHtml(path) {
  if (!import.meta.env.DEV) return null
  const files = import.meta.glob('../bitrix/info-snapshots/*.html', { query: '?raw', import: 'default' })
  const name = path.replace(/^\//, '') || 'index'
  const load = files[`../bitrix/info-snapshots/${name}.html`]
  if (!load) return null
  const html = await load()
  // Снимок — целиком <main>…</main>: внутрь нашего <main> идёт содержимое.
  return html.replace(/^[\s\S]*?<main[^>]*>/, '').replace(/<\/main>[\s\S]*$/, '')
}

/* ------------------------------------------------------------- кадры */

/** Незагрузившийся кадр — заглушка с именем файла, как у createImage. */
function wireImages(root) {
  root.querySelectorAll('.media > img').forEach((img) => {
    const wrap = img.parentElement
    const mark = () => {
      if (wrap.classList.contains('is-missing')) return
      wrap.classList.add('is-missing')
      const note = document.createElement('span')
      note.className = 'media__note'
      note.textContent = placeholderLabel(img.getAttribute('src') || img.dataset.src || '', wrap.dataset.ratio || '1:1')
      wrap.appendChild(note)
    }
    if (img.complete && img.getAttribute('src') && !img.naturalWidth) mark()
    else img.addEventListener('error', mark, { once: true })
  })
}

/* ------------------------------------------------------- секции /alt2 */

function mountAlt2(main) {
  const character = main.querySelector('[data-ib="alt2-character"]')
  if (character) {
    const intro = character.previousElementSibling?.querySelector('.ib__title')
    character.replaceWith(buildCharacter({ id: 'character', headless: true, labelledBy: intro?.id }))
  }
  const origin = main.querySelector('[data-ib="alt2-origin"]')
  if (origin) origin.replaceWith(buildOrigin({ id: 'origin', headless: true }))
}

/** /production#fish, #caviar — «Происхождение» на нужной вкладке. */
function openOriginTab(page) {
  const key = page.originTabs?.[location.hash.slice(1)]
  const section = document.querySelector('#origin')
  if (!key || !section) return false
  const tab = section.querySelector(`[data-story-tab="${key}"]`)
  if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click()
  setTimeout(() => scrollToEl(section, 0), 350)
  return true
}

/** Якорь адреса: блоки строятся скриптом, браузер к ним сам не прокрутит. */
function scrollToHash(page) {
  if (!location.hash || location.hash.length < 2) return
  if (openOriginTab(page)) return
  let target = null
  try {
    target = document.querySelector(location.hash)
  } catch {
    return
  }
  // Вопросы /faq раскрывает и прокручивает сам блок accordion.
  if (!target || target.matches('details')) return
  requestAnimationFrame(() => scrollToEl(target))
  // Шрифты и кадры выше догружаются и сдвигают цель — доводим ещё раз.
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => setTimeout(() => scrollToEl(target), 60), { once: true })
  }
}

/* ------------------------------------------------------------------ сборка */

async function boot() {
  document.body.classList.add('is-info')

  const page = infoPageFor(location.pathname)
  const main = document.querySelector('#main')
  if (!page || !main) return
  main.className = 'info'

  const snapshot = new URLSearchParams(location.search).has('snapshot') ? await snapshotHtml(page.path) : null
  main.innerHTML = snapshot ?? renderPage(page)
  if (snapshot) main.dataset.snapshot = '1'

  mountAlt2(main)
  initHeader()
  initFooter()
  wireImages(main)

  setLenisGetter(getLenis)
  initScroll()

  initBlocks(main)
  if (main.querySelector('#character')) initCharacter()
  if (main.querySelector('#origin')) initOrigin()

  scrollToHash(page)
  window.addEventListener('hashchange', () => openOriginTab(page))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
