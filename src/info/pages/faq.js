/** /faq — «Вопросы и ответы». Тексты — src/data/info/faq.js. */

import { ROUTES } from '../../data/routes.js'
import { faqPage as p } from '../../data/info/faq.js'

export default {
  path: ROUTES.faq,
  blocks: [
    { type: 'hero', id: 'top', bg: 'light', data: { ...p.hero, variant: 'compact' } },
    { type: 'accordion', id: 'answers', bg: 'light', data: p.answers },
    { type: 'cta', id: 'ask', bg: 'dark', data: p.ask },
  ],
}
