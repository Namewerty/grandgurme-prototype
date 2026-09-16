/* ============================================================================
   Реестр и сборка секций альтернативной главной. ЧЕРНОВИК НА ВЫБРОС.

   ЗАЧЕМ КОПИЯ, А НЕ ИМПОРТ. renderSections из src/js/sections/index.js читает
   реестр из src/data/sections.js напрямую — параметра «какой реестр брать»
   у него нет. Добавить его значило бы править основной код ради черновика,
   поэтому массив и сборка скопированы сюда целиком: порядок, флаги и
   нумерация остановок кольца правятся в этом файле.

   ЧТО ИЗМЕНИЛОСЬ ПРОТИВ src/data/sections.js: добавлена #chefs сразу после
   #proof, перед #shop. Всё остальное — порядок, флаги dark/full/tight,
   названия остановок — как в основной версии.

   #season ТЕПЕРЬ ЕСТЬ ТОЛЬКО ЗДЕСЬ. 16.09.2026 блок «Сезон и новинки» снят
   с основной главной решением Дениса; в этом массиве он остался на прежнем
   месте, после #shop, с флагом tight. Импорт season.css — в src/alt/main.js.

   ⚠ НУМЕРАЦИЯ ОСТАНОВОК СДВИНУЛАСЬ. Остановок стало десять вместо девяти,
   и всё, что идёт после #proof, получило номер на единицу больше:
   Витрина 06→07, Офлайн 07→08, Стандарт 08→09, Журнал 09→10. Это ожидаемо
   и правильно — кольцо считает остановки, а не помнит номера.

   initSections импортируется из основного модуля как есть: он терпим
   к отсутствию секций (каждый init* начинается с querySelector и молча
   выходит) и ничего не знает про #chefs. Инициализация новой секции идёт
   после него.
   ============================================================================ */

import { buildHero } from '../js/sections/hero.js'
import { buildTrust } from '../js/sections/trust.js'
import { buildBrand } from '../js/sections/brand.js'
import { buildTypes } from '../js/sections/types.js'
import { buildShop } from '../js/sections/shop.js'
import { buildSeason } from '../js/sections/season.js'
import { buildCategories } from '../js/sections/categories.js'
import { buildProof } from '../js/sections/proof.js'
import { buildOffline } from '../js/sections/offline.js'
import { buildWhy } from '../js/sections/why.js'
import { buildJournal } from '../js/sections/journal.js'
import { initSections as initBaseSections } from '../js/sections/index.js'

import { buildChefs, initChefs } from './sections/chefs.js'

/* Флаги те же, что в src/data/sections.js:
     dark  — тёмная секция;
     full  — min-height 100svh, носитель только hero;
     tight — продолжение главы предыдущей секции;
     ring  — название остановки в кольце. Секция без ring наследует номер
             и подпись предыдущей (#trust, #season). */
export const sections = [
  { id: 'hero',       dark: true,  full: true,  media: 'hero',       ring: 'Начало' },
  { id: 'trust',      dark: false, full: false /* остановки нет — полоса под hero */ },
  { id: 'types',      dark: false, full: false,                      ring: 'Виды икры' },
  { id: 'categories', dark: false, full: false,                      ring: 'Ассортимент' },
  { id: 'brand',      dark: false, full: false,                      ring: 'О бренде' },
  { id: 'proof',      dark: true,  full: false,                      ring: 'Доверие' },
  /* Новая секция альтернативы. Светлая — тёмная сразу после тёмного #proof
     слепила бы два разворота в один. Своя остановка: блок отвечает на свой
     вопрос, а не продолжает предыдущий. */
  { id: 'chefs',      dark: false, full: false,                      ring: 'Ресторанам' },
  { id: 'shop',       dark: false, full: false,                      ring: 'Витрина' },
  { id: 'season',     dark: false, full: false, tight: true },
  { id: 'offline',    dark: false, full: false,                      ring: 'Офлайн' },
  { id: 'why',        dark: false, full: false,                      ring: 'Стандарт' },
  { id: 'journal',    dark: false, full: false,                      ring: 'Журнал' },
]

const builders = {
  hero: buildHero,
  trust: buildTrust,
  brand: buildBrand,
  types: buildTypes,
  shop: buildShop,
  season: buildSeason,
  categories: buildCategories,
  proof: buildProof,
  chefs: buildChefs,
  offline: buildOffline,
  why: buildWhy,
  journal: buildJournal,
}

export function renderSections(mount) {
  if (!mount) return

  const fragment = document.createDocumentFragment()

  // Остановка кольца. Секция без своего ring остаётся на предыдущей:
  // номер и подпись она наследует, а не сдвигает нумерацию.
  let stopNum = 0
  let stopLabel = ''

  sections.forEach((item, index) => {
    const build = builders[item.id]
    if (!build) {
      console.warn(`[alt/sections] нет сборщика для #${item.id} — секция пропущена`)
      return
    }

    const section = build(item, index)

    // Структурные флаги ставит реестр, а не сборщик.
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
  initBaseSections()
  initChefs()
}

