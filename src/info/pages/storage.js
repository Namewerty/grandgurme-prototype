/**
 * /storage — «Как хранить и подавать». Тексты — src/data/info/storage.js.
 * На стенде страница правится в админке: deploy-src/storage/index.php
 * эта задача не трогает (PERENOS-info-stranicy.md).
 */

import { ROUTES } from '../../data/routes.js'
import { storagePage as p } from '../../data/info/storage.js'

export default {
  path: ROUTES.storage,
  blocks: [
    { type: 'hero', id: 'top', bg: 'light', data: { ...p.hero, variant: 'plate' } },
    { type: 'thermo', id: 'cold', bg: 'dark', data: p.cold },
    { type: 'gallery', id: 'serve', bg: 'light', data: p.serve },
    { type: 'guests', id: 'guests', bg: 'light', data: p.guests },
    { type: 'next', id: 'next', bg: 'light', data: p.next },
  ],
}
