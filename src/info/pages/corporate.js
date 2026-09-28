/** /corporate — «Корпоративные заказы и подарки». Тексты — src/data/info/corporate.js. */

import { ROUTES } from '../../data/routes.js'
import { corporatePage as p } from '../../data/info/corporate.js'

export default {
  path: ROUTES.corporate,
  blocks: [
    { type: 'hero', id: 'top', bg: 'dark', data: { ...p.hero, variant: 'stage' } },
    { type: 'giftbox', id: 'formats', bg: 'light', data: p.formats },
    { type: 'inside', id: 'inside', bg: 'dark', data: p.inside },
    { type: 'steps', id: 'how', bg: 'light', data: p.how },
    { type: 'table', id: 'terms', bg: 'light', data: p.terms },
    { type: 'form', id: 'request', bg: 'light', data: p.request },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
