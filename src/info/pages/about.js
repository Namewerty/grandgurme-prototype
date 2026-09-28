/** /about — «О компании». Тексты — src/data/info/about.js. */

import { ROUTES } from '../../data/routes.js'
import { aboutPage as p } from '../../data/info/about.js'

export default {
  path: ROUTES.about,
  blocks: [
    { type: 'hero', id: 'top', bg: 'dark', data: { ...p.hero, variant: 'stage' } },
    { type: 'text', id: 'story', bg: 'light', data: p.story },
    { type: 'facts', id: 'facts', bg: 'light', data: p.facts },
    { type: 'cards', id: 'brands', bg: 'light', data: { ...p.brands, variant: 'poster', columns: 2 } },
    { type: 'timezones', id: 'world', bg: 'dark', data: p.world },
    { type: 'split', id: 'boutique', bg: 'light', data: p.boutique },
    { type: 'list', id: 'principles', bg: 'light', data: p.principles },
    { type: 'table', id: 'company', bg: 'light', data: p.company },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
