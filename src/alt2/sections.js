/* ============================================================================
   Реестр и сборка секций альтернативной главной 2. ЧЕРНОВИК НА ВЫБРОС.

   Копия устройства src/alt/sections.js: массив, сборщики, склейка остановок
   кольца. Состав другой:

     #hero       — «Витрина разделов» вместо ролика бренда (stage.js);
     #character  — «Характер икры» вместо #types;
     #origin     — «Происхождение» на месте #why, сразу после #character:
                   блок видов поднимает вопрос «почему эти линейки такие»,
                   ответ идёт следом.
   Остальные секции — теми же build* из src/js/sections/, без правок.
   #why, #types, #season и #chefs здесь нет.

   Ритм фонов: тёмный → светлый ×2 → тёмный → светлый ×2 → тёмный →
   светлый ×3 → тёмный подвал.

   initSections СВОЙ и НЕ зовёт initSections из src/js/sections/index.js:
   тот поднимает initHero, а initHero ищет внутри #hero разметку старого
   первого экрана. Первый экран сохраняет id="hero" — по нему шапка решает,
   когда стать плотной, а кольцо и виджет эксперта — когда появиться.
   ============================================================================ */

import { buildTrust } from '../js/sections/trust.js'
import { buildBrand } from '../js/sections/brand.js'
import { buildShop, initShop } from '../js/sections/shop.js'
import { buildCategories } from '../js/sections/categories.js'
import { buildProof, initProof } from '../js/sections/proof.js'
import { buildOffline, initOffline } from '../js/sections/offline.js'
import { buildJournal } from '../js/sections/journal.js'

import { buildStage, initStage } from './sections/stage.js'
import { buildCharacter, initCharacter } from './sections/character.js'
import { buildOrigin, initOrigin } from './sections/origin.js'

/* dark — тёмная секция (класс ставит сборщик, флаг — для чтения порядка);
   full — у всех false: высоту первого экрана держит stage.css;
   ring — название остановки в кольце. #trust остановки не имеет
   и наследует «01 Начало». */
export const sections = [
  { id: 'hero',       dark: true,  full: false, ring: 'Начало' },
  { id: 'trust',      dark: false, full: false /* остановки нет — полоса под первым экраном */ },
  { id: 'character',  dark: false, full: false, ring: 'Характер икры' },
  { id: 'origin',     dark: true,  full: false, ring: 'Происхождение' },
  { id: 'categories', dark: false, full: false, ring: 'Ассортимент' },
  { id: 'brand',      dark: false, full: false, ring: 'О бренде' },
  { id: 'proof',      dark: true,  full: false, ring: 'Доверие' },
  { id: 'shop',       dark: false, full: false, ring: 'Витрина' },
  { id: 'offline',    dark: false, full: false, ring: 'Офлайн' },
  { id: 'journal',    dark: false, full: false, ring: 'Журнал' },
]

const builders = {
  hero: buildStage,
  trust: buildTrust,
  character: buildCharacter,
  origin: buildOrigin,
  categories: buildCategories,
  brand: buildBrand,
  proof: buildProof,
  shop: buildShop,
  offline: buildOffline,
  journal: buildJournal,
}

export function renderSections(mount) {
  if (!mount) return

  const fragment = document.createDocumentFragment()

  // Остановка кольца. Секция без своего ring остаётся на предыдущей.
  let stopNum = 0
  let stopLabel = ''

  sections.forEach((item, index) => {
    const build = builders[item.id]
    if (!build) {
      console.warn(`[alt2/sections] нет сборщика для #${item.id} — секция пропущена`)
      return
    }

    const section = build(item, index)

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
  initStage()
  initCharacter()
  initOrigin()
  initProof()
  initShop()
  initOffline()
}
