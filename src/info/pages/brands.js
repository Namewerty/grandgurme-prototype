/**
 * /brands — «Наши бренды». Тексты — src/data/info/brands.js.
 * «Характер икры» — секция /alt2 без шапки (alt2-character).
 */

import { ROUTES } from '../../data/routes.js'
import { brandsPage as p } from '../../data/info/brands.js'

export default {
  path: ROUTES.brands,
  blocks: [
    { type: 'hero', id: 'top', bg: 'light', data: { ...p.hero, variant: 'plate' } },
    { type: 'subnav', id: 'contents', bg: 'light', data: p.subnav },
    { type: 'text', id: 'caviar', bg: 'light', data: p.caviar },
    { type: 'alt2-character', id: 'character', bg: 'light', data: {} },
    { type: 'text', id: 'fish', bg: 'dark', data: p.fish },
    { type: 'list', id: 'fish-list', bg: 'dark', data: p.fishList },
    { type: 'giftbox', id: 'gifts', bg: 'light', data: p.gifts },
    { type: 'cards', id: 'europe', bg: 'light', data: { ...p.europe, variant: 'count' } },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
