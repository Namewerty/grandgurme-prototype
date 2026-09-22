/* ============================================================================
   Вход /account/login. Три шага на одной странице, адрес не меняется:
     1. телефон и согласие → requestCode;
     2. код из СМС → verifyCode (отправляется сам, когда введены все цифры);
     3. «Как к вам обращаться» — только для нового номера → completeProfile.
   Номер уже известен — после шага 2 сразу переход на back.

   Сами шаги живут в login-flow.js (22.09.2026): тем же модулем пользуется
   окно входа на карточке товара (login-dialog.js), без шага 3. Здесь —
   только каркас страницы, кадр, адрес возврата и слежение за входом
   в соседней вкладке.

   ВХОД И РЕГИСТРАЦИЯ — ОДИН СЦЕНАРИЙ. Паролей, входа по почте и кнопок
   зарубежных сервисов нет (решение 17.09.2026, см. account-copy.js).
   ============================================================================ */

import { accountCopy } from '../../../data/account-copy.js'
import { brandStory } from '../../../data/media.js'
import { createImage } from '../../media.js'
import { getRecordPhone } from '../api.js'
import { createLoginFlow } from '../login-flow.js'
import { safeBack, setTitle } from '../layout.js'
import { currentUser, onChange } from '../session.js'

const copy = accountCopy.login

/**
 * @param {HTMLElement} mount
 * @param {{ step?: 'profile' }} [options] демонстрация ?demo=new открывает
 *   сразу шаг 3 для только что созданного кабинета
 */
export async function initLoginPage(mount, { step = null } = {}) {
  const params = new URLSearchParams(location.search)
  const back = safeBack(params.get('back'))
  const leave = () => location.replace(back)

  // Вошедший на странице входа сразу уходит на back.
  if (currentUser() && step !== 'profile') {
    leave()
    return
  }

  // Пока идёт собственный вход, смену сессии вызывает эта же страница —
  // уходить нужно только на вход в соседней вкладке.
  let flow = null
  onChange(({ user }) => {
    if (user && !flow?.signingIn) leave()
  })

  setTitle(copy.pageTitle)
  mount.className = 'page-account page-login'
  mount.innerHTML = `
    <div class="container">
      <div class="login">
        <div class="login__col"><div class="login__form" data-step-host></div></div>
        <div class="login__media" data-login-media></div>
      </div>
    </div>`

  const image = brandStory.detail[0]
  mount
    .querySelector('[data-login-media]')
    .appendChild(createImage({ src: image.src, alt: copy.imageAlt, ratio: image.ratio, fill: true, loading: 'eager' }))

  // Пришли со страницы «Заказ принят» — номер подставлен из этого заказа
  // или заявки, если они есть в этом браузере.
  const from = params.get('from')
  const prefill =
    step !== 'profile' && (from === 'order' || from === 'request')
      ? await getRecordPhone({ order: params.get('n'), request: params.get('r') })
      : ''

  flow = createLoginFlow(mount.querySelector('[data-step-host]'), {
    profileStep: true,
    heading: 'h1',
    eyebrow: copy.eyebrow,
    prefill,
    start: step === 'profile' ? 'profile' : null,
    onComplete: leave,
  })
}
