/* ============================================================================
   Перечень кадров каталожной панели для public/media/README.md.

   Кадров под сотню, и все их имена собираются из слагов в src/data/catalog.js.
   Держать такой список руками нельзя: дерево каталога ещё не подтверждено
   заказчиком и меняется почти каждую итерацию, а фотографу уходит именно
   README — разошедшийся список означает переснятые кадры.

   Скрипт переписывает блок между маркерами NAV:START и NAV:END, остальной
   текст файла не трогает. Запуск: `npm run media`.
   ============================================================================ */

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

import { PANEL_MAX_CARDS, categories, collections, navImage } from '../src/data/catalog.js'

const FILE = fileURLToPath(new URL('../public/media/README.md', import.meta.url))
const START = '<!-- NAV:START -->'
const END = '<!-- NAV:END -->'

// Панель показывает не больше PANEL_MAX_CARDS подкатегорий в категории —
// снимать то, что в неё не попадёт, незачем.
const shown = (category) => category.subs.slice(0, PANEL_MAX_CARDS)
const total = categories.reduce((sum, category) => sum + shown(category).length, 0)

const body = [
  `Всего кадров подкатегорий: **${total}**, плюс ${collections.length} кадра подборок.`,
  '',
  ...categories.flatMap((category) => [
    `**${category.name}**`,
    '',
    // Разделы без подкатегорий (крабы, подарочные наборы) кадров панели
    // не требуют вовсе: справа у них стоит описание раздела, а не сетка.
    // Пустая строка под названием читалась бы как забытый список.
    shown(category).length
      ? shown(category)
          .map((sub) => `\`${navImage(category.slug, sub.slug).replace('/media/nav/', '')}\``)
          .join(' · ')
      : '_Подкатегорий нет — кадры не нужны._',
    '',
  ]),
  '**Подборки — горизонтальные, 3:2, 900×600**',
  '',
  collections
    .map((collection) => `\`${collection.image.replace('/media/nav/', '')}\` (${collection.title.toLowerCase()})`)
    .join(' · '),
  '',
  'Эти два кадра стоят у правого края панели и крупнее остальных — здесь можно',
  'и нужно снимать композицию, а не одиночный продукт.',
].join('\n')

const text = fs.readFileSync(FILE, 'utf8')
const from = text.indexOf(START)
const to = text.indexOf(END)

if (from === -1 || to === -1) {
  console.error(`[media] в ${FILE} нет маркеров ${START} … ${END}`)
  process.exit(1)
}

fs.writeFileSync(
  FILE,
  `${text.slice(0, from + START.length)}\n\n${body}\n\n${text.slice(to)}`,
  'utf8',
)

console.log(`[media] перечень кадров панели обновлён: ${total} + ${collections.length}`)
