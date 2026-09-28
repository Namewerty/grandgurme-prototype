/**
 * /production — «Производство и качество». Тексты — src/data/info/production.js.
 * «Происхождение» — секция /alt2 без шапки (alt2-origin); /production#fish
 * и #caviar открывают её на нужной вкладке (originTabs, src/info.js).
 */

import { ROUTES } from '../../data/routes.js'
import { productionPage as p } from '../../data/info/production.js'

export default {
  path: ROUTES.production,
  originTabs: p.originTabs,
  blocks: [
    { type: 'hero', id: 'top', bg: 'dark', data: { ...p.hero, variant: 'stage' } },
    { type: 'alt2-origin', id: 'origin', bg: 'dark', data: {} },
    { type: 'list', id: 'check', bg: 'light', data: p.check },
    { type: 'facts', id: 'facts', bg: 'light', data: p.facts },
    { type: 'cta', id: 'docs', bg: 'dark', data: p.docs },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
