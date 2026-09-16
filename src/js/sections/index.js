/* ============================================================================
   Сборка секций главной.

   Порядок берётся из src/data/sections.js — он же задаёт остановки в кольце
   прогресса. Каждая секция строится своим модулем; временных оболочек больше
   нет, все одиннадцать наполнены.

   #brand, #categories и #journal обходятся без init: их вход — общий reveal
   из scroll.js, а вся анимация наведения — CSS. У #categories init был, пока
   ассортимент жил лентой с пейджером; решётка 4×2 не прокручивается, и
   поднимать по готовому DOM стало нечего.

   #season С ОСНОВНОЙ ГЛАВНОЙ СНЯТ (16.09.2026), но сборщик и initSeason
   остаются: src/alt/sections.js собирает секцию своим реестром и зовёт
   этот initSections — без initSeason окно предпросмотра на /alt
   перестало бы листаться. На основной главной initSeason молча выходит.

   Две фазы:
     renderSections — только DOM, до подъёма скролл-движка;
     initSections   — анимации секций, ПОСЛЕ initScroll: hero снимает общий
                      триггер ухода и ставит свой (см. hero.js).
   ============================================================================ */

import { sections } from '../../data/sections.js'
import { buildHero, initHero } from './hero.js'
import { buildTrust } from './trust.js'
import { buildBrand } from './brand.js'
import { buildTypes, initTypes } from './types.js'
import { buildShop, initShop } from './shop.js'
import { buildSeason, initSeason } from './season.js'
import { buildCategories } from './categories.js'
import { buildProof, initProof } from './proof.js'
import { buildOffline, initOffline } from './offline.js'
import { buildWhy, initWhy } from './why.js'
import { buildJournal } from './journal.js'

const builders = {
  hero: buildHero,
  trust: buildTrust,
  brand: buildBrand,
  types: buildTypes,
  shop: buildShop,
  season: buildSeason,
  categories: buildCategories,
  proof: buildProof,
  offline: buildOffline,
  why: buildWhy,
  journal: buildJournal,
}

export function renderSections(mount) {
  if (!mount) return

  const fragment = document.createDocumentFragment()

  // Остановка кольца. Секция без своего ring (сейчас это #trust) остаётся на
  // предыдущей: номер и подпись она наследует, а не сдвигает нумерацию.
  let stopNum = 0
  let stopLabel = ''

  sections.forEach((item, index) => {
    const build = builders[item.id]
    if (!build) {
      console.warn(`[sections] нет сборщика для #${item.id} — секция пропущена`)
      return
    }

    const section = build(item, index)

    // Структурные флаги ставит реестр, а не сборщик: в data/sections.js видно
    // сразу, какие секции полноэкранные и какие продолжают главу предыдущей.
    section.classList.toggle('section--full', Boolean(item.full))
    section.classList.toggle('section--tight', Boolean(item.tight))

    if (item.ring) {
      stopNum += 1
      stopLabel = item.ring
    }

    section.dataset.ringNum = String(stopNum).padStart(2, '0')
    section.dataset.ringLabel = stopLabel

    fragment.appendChild(section)
  })

  mount.appendChild(fragment)
}

export function initSections() {
  initHero()
  initTypes()
  initShop()
  initSeason()
  initProof()
  initOffline()
  initWhy()
}
