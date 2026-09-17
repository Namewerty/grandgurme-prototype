/* ============================================================================
   Данные прототипа → PHP-массив для шаблона Битрикса.

   ЗАЧЕМ. Шапка, подвал и панели на Битриксе рисуются на сервере (PHP), а не
   скриптом: меню и подвал должны быть в исходном html, иначе их не видит
   поисковик. Но переписывать тексты и адреса руками в PHP нельзя — они
   разойдутся с src/data/*.js на первой же правке.

   Поэтому источник правды остаётся один — модули src/data. Этот скрипт
   импортирует их и выкладывает в include/generated.php. Правка в данных
   доезжает до Битрикса той же командой, что и сборка стилей.

   ⚠ Файл generated.php руками не правят: он перезаписывается.
   ============================================================================ */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mediaManifest } from './media-manifest.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'bitrix/templates/grandgurme/include/generated.php')

const [nav, footer, company, routesMod, media, icons] = await Promise.all([
  import('../src/data/nav.js'),
  import('../src/data/footer.js'),
  import('../src/data/company.js'),
  import('../src/data/routes.js'),
  import('../src/data/media.js'),
  import('../src/js/icons.js'),
])

/** Только строковые адреса: category()/product() на Битриксе строятся иначе. */
const routes = Object.fromEntries(
  Object.entries(routesMod.ROUTES).filter(([, v]) => typeof v === 'string'),
)

const data = {
  contacts: nav.contacts,
  topbar: nav.topbar,
  navCatalog: nav.navCatalog,
  navPrimary: nav.navPrimary,
  navSecondary: nav.navSecondary,
  navActions: nav.navActions,
  brandName: nav.brandName,
  cart: nav.cart,
  routes,
  companyPanel: company.companyPanel,
  /* Каталожную колонку подвала PHP собирает сам из карты разделов —
     здесь остальные четыре. */
  footerColumns: footer.footerColumns.filter((c) => c.title !== 'Каталог'),
  footerContacts: footer.footerContacts,
  footerTagline: footer.footerTagline,
  socials: footer.socials,
  payments: footer.payments,
  legal: { ...footer.legal, copyright: '© №1 Гранд Гурмэ' },
  brand: media.brand,
  icons: icons.icons,
  /* Медиафайлы, которые есть на сервере: адрес => true, чтобы fn.php
     проверял isset(). Тот же список лежит в JS-бандле. */
  mediaFiles: Object.fromEntries(mediaManifest().map((src) => [src, true])),
}

/** JS-значение → литерал PHP. Ключи и строки экранируются одинарными кавычками. */
function toPhp(value, indent = 0) {
  const pad = '    '.repeat(indent)
  const padIn = '    '.repeat(indent + 1)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((v) => padIn + toPhp(v, indent + 1)).join(',\n')},\n${pad}]`
  }

  const entries = Object.entries(value).filter(([, v]) => typeof v !== 'function')
  if (!entries.length) return '[]'
  return `[\n${entries
    .map(([k, v]) => `${padIn}'${k.replace(/'/g, "\\'")}' => ${toPhp(v, indent + 1)}`)
    .join(',\n')},\n${pad}]`
}

const php = `<?php
/**
 * СГЕНЕРИРОВАННЫЙ ФАЙЛ. Не редактировать.
 * Источник — src/data/*.js прототипа, сборка: npm run bitrix:data
 * Даты сборки здесь нет намеренно: одинаковые исходники дают одинаковый файл,
 * и сверка стенда по md5 (npm run stand) не видит ложных расхождений.
 * Коммит и время сборки — в stand-manifest.json архива.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

return ${toPhp(data)};
`

await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, php, 'utf8')
console.log(`[bitrix] generated.php — ${(php.length / 1024).toFixed(1)} КБ`)
