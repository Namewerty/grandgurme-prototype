/** /contacts — «Контакты». «Дальше» здесь нет. Тексты — src/data/info/contacts.js. */

import { ROUTES } from '../../data/routes.js'
import { contactsPage as p } from '../../data/info/contacts.js'

export default {
  path: ROUTES.contacts,
  blocks: [
    { type: 'hero', id: 'top', bg: 'light', data: { ...p.hero, variant: 'compact' } },
    { type: 'channels', id: 'channels', bg: 'light', data: p.channels },
    { type: 'boutique', id: 'boutique', bg: 'dark', data: p.boutique },
    { type: 'table', id: 'directions', bg: 'light', data: p.directions },
    { type: 'split', id: 'dubai', bg: 'light', data: p.dubai },
    { type: 'table', id: 'company', bg: 'light', data: p.company },
    { type: 'form', id: 'write', bg: 'light', data: p.write },
  ],
}
