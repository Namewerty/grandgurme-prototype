/* ============================================================================
   Хранилище входа, пользователей и избранного гостя. Второй и последний файл
   прототипа, который трогает localStorage (первый — src/js/cart/storage.js:
   корзина, заказы, заявки).

   ЗАЧЕМ ОТДЕЛЬНО. На Битриксе пользователь, его адреса и избранное живут
   на сервере. При переносе этот файл вместе с api.js заменяется запросами,
   а страницы кабинета, сторы и шапка остаются как есть.

   КЛЮЧИ
     gg-session    { userId } — кто вошёл в этом браузере;
     gg-users      { version: 1, byId, byPhone } — в записи пользователя лежат
                   профиль, адреса, избранное и лист ожидания:
                   { profile, addresses, favorites, waitlist };
     gg-favorites  { version: 1, items } — избранное гостя;
     gg-codes      { version: 1, byPhone } — выданные коды входа: когда
                   отправлен, сколько попыток осталось (нужно api.js для
                   expired, attempts_exhausted и rate_limit).

   ВСЁ В TRY/CATCH. В приватном режиме чтение и запись бросают исключение.
   Тогда записи живут в памяти модуля по тем же ключам: вход, избранное
   и корзина работают до перезагрузки страницы.

   НИЧЕГО НЕ ДЕЛАЕТ ПРИ ИМПОРТЕ: ни чтения, ни подписок. Модуль попадает
   в сборку Битрикса через шапку и корзину, и там он не должен работать вовсе.
   ============================================================================ */

export const SESSION_KEY = 'gg-session'
export const USERS_KEY = 'gg-users'
export const GUEST_FAVORITES_KEY = 'gg-favorites'
const CODES_KEY = 'gg-codes'
const VERSION = 1

/** Запасное хранилище на случай недоступного localStorage. */
const memory = new Map()

/**
 * Чтение. Если localStorage бросил исключение — берём из памяти модуля.
 * Если он доступен, но запись в него не прошла раньше, память тоже главнее:
 * в ней лежит то, что не удалось сохранить.
 */
export function readKey(key) {
  if (memory.has(key)) return memory.get(key)
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    memory.delete(key)
    return true
  } catch {
    memory.set(key, value)
    return false
  }
}

export function removeKey(key) {
  memory.delete(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* приватный режим: записи в хранилище и не было */
  }
}

/* ---------------------------------------------------------------- сессия */

export function loadSession() {
  const data = readKey(SESSION_KEY)
  return data && typeof data.userId === 'string' ? data : null
}

export const saveSession = (userId) => writeKey(SESSION_KEY, { userId })

export const clearSession = () => removeKey(SESSION_KEY)

/* ---------------------------------------------------------- пользователи */

const emptyUsers = () => ({ version: VERSION, byId: {}, byPhone: {} })

export function loadUsers() {
  const data = readKey(USERS_KEY)
  if (!data || data.version !== VERSION || !data.byId || !data.byPhone) return emptyUsers()
  return data
}

export const saveUsers = (users) => writeKey(USERS_KEY, { ...users, version: VERSION })

/** Запись пользователя: { profile, addresses, favorites, waitlist } или null. */
export const loadUserRecord = (userId) => loadUsers().byId[userId] || null

/** Меняет запись пользователя функцией и сохраняет. Возвращает новую запись. */
export function updateUserRecord(userId, change) {
  const users = loadUsers()
  const current = users.byId[userId]
  if (!current) return null
  const next = change({
    profile: current.profile,
    addresses: current.addresses || [],
    favorites: current.favorites || [],
    // Записи, сделанные до 22.09.2026, листа ожидания не имеют.
    waitlist: current.waitlist || [],
  })
  users.byId[userId] = next
  saveUsers(users)
  return next
}

/* ------------------------------------------------------ избранное гостя */

export function loadGuestFavorites() {
  const data = readKey(GUEST_FAVORITES_KEY)
  return data && data.version === VERSION && Array.isArray(data.items) ? data.items : []
}

export const saveGuestFavorites = (items) => writeKey(GUEST_FAVORITES_KEY, { version: VERSION, items })

export const clearGuestFavorites = () => removeKey(GUEST_FAVORITES_KEY)

/* ------------------------------------------------------------ коды входа */

export function loadCodes() {
  const data = readKey(CODES_KEY)
  return data && data.version === VERSION && data.byPhone ? data.byPhone : {}
}

export const saveCodes = (byPhone) => writeKey(CODES_KEY, { version: VERSION, byPhone })

/* ------------------------------------------------------- соседние вкладки */

/**
 * Изменение ключа в соседней вкладке. Событие storage приходит только
 * в чужие вкладки, свои изменения сюда не возвращаются.
 */
export function onExternalChange(keys, fn) {
  window.addEventListener('storage', (event) => {
    if (event.key === null || keys.includes(event.key)) fn(event.key)
  })
}
