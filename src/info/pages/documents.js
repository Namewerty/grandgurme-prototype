/** /documents — «Документы и сертификаты». Тексты — src/data/info/documents.js. */

import { ROUTES } from '../../data/routes.js'
import { documentsPage as p } from '../../data/info/documents.js'

export default {
  path: ROUTES.documents,
  blocks: [
    { type: 'hero', id: 'top', bg: 'light', data: { ...p.hero, variant: 'plate' } },
    { type: 'orbit', id: 'orbit', bg: 'dark', data: p.orbit },
    { type: 'doclist', id: 'list', bg: 'light', data: p.list },
    { type: 'form', id: 'request', bg: 'light', data: p.request },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
