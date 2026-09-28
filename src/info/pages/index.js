/** Девять информационных страниц партии 1 — адрес → состав. */

import partners from './partners.js'
import about from './about.js'
import brands from './brands.js'
import production from './production.js'
import documents from './documents.js'
import corporate from './corporate.js'
import contacts from './contacts.js'
import faq from './faq.js'
import storage from './storage.js'

export const infoPages = [partners, about, brands, production, documents, corporate, contacts, faq, storage]

/** Адреса — для scripts/build-pages.mjs (точка входа /src/info.js). */
export const INFO_PATHS = infoPages.map((page) => page.path)

export const infoPageFor = (path) => {
  const clean = String(path).replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')
  return infoPages.find((page) => page.path === clean) || null
}
