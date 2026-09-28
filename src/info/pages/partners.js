/**
 * /partners — «Ресторанам и отелям». Посадочная: читается подряд,
 * оглавления нет. Тексты — src/data/info/partners.js.
 */

import { ROUTES } from '../../data/routes.js'
import { partnersPage as p } from '../../data/info/partners.js'

export default {
  path: ROUTES.partners,
  blocks: [
    { type: 'hero', id: 'top', bg: 'dark', data: { ...p.hero, variant: 'stage' } },
    { type: 'timezones', id: 'where', bg: 'light', data: p.where },
    { type: 'tasting', id: 'tasting', bg: 'dark', data: p.tasting },
    { type: 'portion', id: 'portion', bg: 'light', data: p.portion },
    { type: 'list', id: 'range', bg: 'light', data: p.range },
    { type: 'cards', id: 'segments', bg: 'light', data: { ...p.segments, columns: 4 } },
    { type: 'table', id: 'docs', bg: 'dark', data: p.docs },
    { type: 'steps', id: 'start', bg: 'light', data: p.start },
    { type: 'table', id: 'terms', bg: 'light', data: p.terms },
    // Под флагом SHOW_COLLAB_NAMES: при false data === null, блока нет.
    { type: 'split', id: 'collab', bg: 'dark', data: p.collab },
    { type: 'form', id: 'request', bg: 'light', data: p.request },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
    { type: 'sticky', id: null, bg: null, data: p.sticky },
  ],
}
