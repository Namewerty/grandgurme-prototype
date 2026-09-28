/* ============================================================================
   Сборка информационной страницы из блоков. ЧИСТЫЙ МОДУЛЬ: работает
   в браузере (src/info.js) и в node (scripts/info-snapshot.mjs).

   renderPage(page) — строка HTML содержимого <main>: блоки по порядку
   из src/info/pages/<адрес>.js, крошки и «Дальше» подставлены.
   initBlocks(root) — оживляет блоки по data-ib, читая всё из разметки.

   Блоки «Характер икры» и «Происхождение» с /alt2 собираются через DOM
   и этому правилу не подчиняются: здесь на их месте пустая <section>
   с id и data-ib="alt2-character" / "alt2-origin", точка входа ставит
   на это место настоящую секцию (src/info.js).
   ============================================================================ */

import { findPage } from '../data/routes.js'
import { infoUi } from '../data/info/common.js'

import { buildHero, initHero } from './blocks/hero.js'
import { buildSubnav, initSubnav } from './blocks/subnav.js'
import { buildText, initText } from './blocks/text.js'
import { buildFacts, initFacts } from './blocks/facts.js'
import { buildSplit, initSplit } from './blocks/split.js'
import { buildSteps, initSteps } from './blocks/steps.js'
import { buildCards, initCards } from './blocks/cards.js'
import { buildList, initList } from './blocks/list.js'
import { buildAccordion, initAccordion } from './blocks/accordion.js'
import { buildTable, initTable } from './blocks/table.js'
import { buildCta, initCta } from './blocks/cta.js'
import { buildForm, initForm } from './blocks/form.js'
import { buildTimezones, initTimezones } from './blocks/timezones.js'
import { buildNext } from './blocks/next.js'
import { buildTasting, initTasting } from './blocks/tasting.js'
import { buildPortion, initPortion } from './blocks/portion.js'
import { buildGuests, initGuests } from './blocks/guests.js'
import { buildThermo, initThermo } from './blocks/thermo.js'
import { buildOrbit, initOrbit } from './blocks/orbit.js'
import { buildGiftbox, initGiftbox } from './blocks/giftbox.js'
import { buildInside, initInside } from './blocks/inside.js'
import { buildChannels, initChannels } from './blocks/channels.js'
import { buildBoutique, initBoutique } from './blocks/boutique.js'
import { buildDoclist } from './blocks/doclist.js'
import { buildGallery, initGallery } from './blocks/gallery.js'
import { buildSticky, initSticky } from './blocks/sticky.js'

export const BLOCKS = {
  hero: { build: buildHero, init: initHero },
  subnav: { build: buildSubnav, init: initSubnav },
  text: { build: buildText, init: initText },
  facts: { build: buildFacts, init: initFacts },
  split: { build: buildSplit, init: initSplit },
  steps: { build: buildSteps, init: initSteps },
  cards: { build: buildCards, init: initCards },
  list: { build: buildList, init: initList },
  accordion: { build: buildAccordion, init: initAccordion },
  table: { build: buildTable, init: initTable },
  cta: { build: buildCta, init: initCta },
  form: { build: buildForm, init: initForm },
  timezones: { build: buildTimezones, init: initTimezones },
  next: { build: buildNext },
  tasting: { build: buildTasting, init: initTasting },
  portion: { build: buildPortion, init: initPortion },
  guests: { build: buildGuests, init: initGuests },
  thermo: { build: buildThermo, init: initThermo },
  orbit: { build: buildOrbit, init: initOrbit },
  giftbox: { build: buildGiftbox, init: initGiftbox },
  inside: { build: buildInside, init: initInside },
  channels: { build: buildChannels, init: initChannels },
  boutique: { build: buildBoutique, init: initBoutique },
  doclist: { build: buildDoclist },
  gallery: { build: buildGallery, init: initGallery },
  sticky: { build: buildSticky, init: initSticky },
}

/** Секции /alt2: в разметке — пустое место с id, собирает их src/info.js. */
const ALT2 = { 'alt2-character': 'character', 'alt2-origin': 'origin' }

/* --------------------------------------------------------------- типограф */

/**
 * Неразрывный пробел перед тире и между числом и единицей. Тексты в данных
 * набраны обычными пробелами — так их проще править; перенос строки
 * между «50» и «г» или перед тире ставит сборка.
 */
export function typo(html) {
  return html
    .replace(/ — /g, ' — ')
    .replace(/(\d) (?=(?:г|кг|мм|см|км|°C|%|₽)(?![\p{L}]))/gu, '$1 ')
}

/* ------------------------------------------------------------ подстановки */

function crumbsFor(page) {
  const { home, company } = infoUi.crumbs
  const current = { label: page.title }
  return page.path === company.href ? [home, current] : [home, company, current]
}

/** Общие подписи блоков из src/data/info/common.js. */
function withUi(type, data) {
  switch (type) {
    case 'form':
      return { ...data, ui: infoUi.form }
    case 'table':
    case 'channels':
      return { ...data, copyLabel: infoUi.copy.label, copyDone: infoUi.copy.done }
    case 'list':
      return { ...data, moreLabel: infoUi.list.more }
    case 'timezones':
      return { ...data, ui: infoUi.timezones }
    case 'subnav':
      return { label: infoUi.subnav.label, items: data }
    case 'next':
      return {
        eyebrow: infoUi.next.eyebrow,
        label: infoUi.next.label,
        links: data.map((path) => {
          const p = findPage(path)
          return { path, title: p.title, lead: p.lead }
        }),
      }
    default:
      return data
  }
}

/* ------------------------------------------------------------------ сборка */

export function renderBlock(block, page) {
  if (block.data == null) return '' // блок под выключенным флагом
  if (ALT2[block.type]) {
    const dark = block.bg === 'dark' ? ' section--dark' : ''
    return `<section class="section ib ib--alt2${dark}" id="${ALT2[block.type]}" data-ib="${block.type}"></section>`
  }
  const def = BLOCKS[block.type]
  if (!def) throw new Error(`[info] нет блока «${block.type}»`)
  const data = { ...withUi(block.type, block.data), id: block.id, dark: block.bg === 'dark' }
  if (block.type === 'hero') {
    data.crumbs = crumbsFor(page)
    data.crumbsLabel = infoUi.crumbs.label
  }
  return def.build(data)
}

/** Разметка содержимого <main>. page — модуль из src/info/pages/. */
export function renderPage(page) {
  const route = findPage(page.path)
  const full = { ...page, title: route?.title || page.title }
  return typo(page.blocks.map((block) => renderBlock(block, full)).join('\n'))
}

/** Оживить блоки внутри root: init каждого data-ib, у кого он есть. */
export function initBlocks(root) {
  root.querySelectorAll('[data-ib]').forEach((el) => {
    const def = BLOCKS[el.dataset.ib]
    if (!def?.init) return
    try {
      def.init(el)
    } catch (error) {
      console.error(`[info] блок ${el.dataset.ib}:`, error)
    }
  })
}
