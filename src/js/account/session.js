/* ============================================================================
   Кто сейчас вошёл. Синхронно и без побочных действий при импорте.

   currentUser() в прототипе читает gg-session и gg-users (account/storage.js).
   На Битриксе пользователь приходит с сервера в разметке страницы, и эта
   функция читает его оттуда — всё, что выше (шапка, корзина, страницы
   кабинета), остаётся как есть.

   СОБЫТИЕ account:change на document, detail: { user }. Рассылается:
     — api.js после входа, выхода, правки профиля и удаления кабинета;
     — этим файлом, когда вход поменяли в соседней вкладке (событие storage).
   Слежение за соседними вкладками включается первым вызовом onChange, а не
   импортом: в сборке Битрикса шапка в режиме ssr его не вызывает, и модуль
   там не делает ничего.
   ============================================================================ */

import { SESSION_KEY, USERS_KEY, loadSession, loadUserRecord, onExternalChange } from './storage.js'

/** Вошедший пользователь или null. Сессия на удалённого пользователя — гость. */
export function currentUser() {
  const session = loadSession()
  if (!session) return null
  return loadUserRecord(session.userId)?.profile || null
}

export const currentUserId = () => currentUser()?.id || null

/** Разослать account:change. Зовёт api.js; страницы сами его не вызывают. */
export function emitChange() {
  document.dispatchEvent(new CustomEvent('account:change', { detail: { user: currentUser() } }))
}

let watching = false
let lastSeen = null

/** Отпечаток того, что видит шапка: кто вошёл и как его зовут. */
const fingerprint = (user) => (user ? `${user.id}|${user.name}|${user.phone}` : '')

function watchOtherTabs() {
  if (watching) return
  watching = true
  lastSeen = fingerprint(currentUser())

  // gg-users меняется и от правки адресов с избранным — событие шлём только
  // когда поменялся сам вход или то, что от него видно в шапке.
  onExternalChange([SESSION_KEY, USERS_KEY], () => {
    const next = fingerprint(currentUser())
    if (next === lastSeen) return
    lastSeen = next
    emitChange()
  })

  document.addEventListener('account:change', (event) => {
    lastSeen = fingerprint(event.detail?.user)
  })
}

/** Подписка на смену входа — в этой вкладке и в соседних. Возвращает отписку. */
export function onChange(fn) {
  watchOtherTabs()
  const handler = (event) => fn(event.detail)
  document.addEventListener('account:change', handler)
  return () => document.removeEventListener('account:change', handler)
}
