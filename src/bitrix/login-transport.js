/* ============================================================================
   Шаги входа окна на Битриксе: те же формы, но код выдаёт и проверяет сервер.

   Прототип держит коды в localStorage (src/js/account/api.js, код 123456).
   На стенде это делает /account/login/ — страница входа уже умеет и то,
   и другое, и ajax-ответы там ровно те же, что у api.js:

     POST /account/login/?ajax=code    phone        → { ok, resendIn, codeLength }
     POST /account/login/?ajax=verify  code         → { ok, isNew, user }

   Номер, которому выдан код, лежит в сессии Битрикса — второй запрос его
   не передаёт, и кода от чужого номера не примет.

   ОТКУДА SESSID. Проверка сессии Битрикса обязательна, а окно открывается
   с карточки товара, где рядом лежат формы кнопки «Сообщить о поступлении»
   (include/waitlist.php) — из них и берётся поле sessid. Не нашлось —
   запрос уйдёт без него и сервер честно ответит ok: false.
   ============================================================================ */

const LOGIN_URL = '/account/login/'

/** sessid Битрикса из любой формы страницы. */
function sessid() {
  return document.querySelector('input[name="sessid"]')?.value || ''
}

async function post(ajax, fields) {
  const body = new FormData()
  body.set('sessid', sessid())
  Object.entries(fields).forEach(([key, value]) => body.set(key, value))

  const response = await fetch(`${LOGIN_URL}?ajax=${ajax}`, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`login-${ajax}: ${response.status}`)
  return response.json()
}

/** Шаг 1. Ответ той же формы, что у requestCode прототипа. */
export async function requestCode(phone) {
  try {
    return await post('code', { phone })
  } catch {
    // Сети нет — окно покажет ту же строку, что при частых попытках,
    // и человек всегда может уйти на /account/login/ страницей.
    return { ok: false, error: 'rate_limit', retryIn: 60 }
  }
}

/** Шаг 2. Ответ той же формы, что у verifyCode прототипа. */
export async function verifyCode(phone, code) {
  try {
    return await post('verify', { code })
  } catch {
    return { ok: false, error: 'expired' }
  }
}
