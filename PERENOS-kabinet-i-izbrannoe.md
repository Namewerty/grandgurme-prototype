# Перенос входа, кабинета и избранного на 1С-Битрикс

Записка для Cowork: что сделано в прототипе 17.09.2026 и что должен повторить
стенд `bitrix.grandgurme.ru`. PHP здесь нет намеренно — только границы, формы
данных, события и разметка, которую ждут общие модули.

Прототип: `https://grandgurme-prototype.vercel.app`. Показ кабинета без ввода
кода — `/account?demo=account` (данные вымышленные, см. раздел 5).

> ⚠ До переноса архив стенда из `main` заливать нельзя: `generated.php` уже
> ведёт сердце шапки на `/favorites`, а человека — на `/account`, страниц под
> ними на стенде нет. Сначала страницы, потом архив.

---

## 1. Граница

Устройство то же, что у корзины: **страницы знают только `api.js` и сторы**.

| Файл | Что это | На Битриксе |
|---|---|---|
| `src/js/account/api.js` | единственная граница данных входа, кабинета и избранного | заменяется запросами к серверу — те же имена, аргументы и ответы |
| `src/js/account/storage.js` | сессия, пользователи, избранное гостя, коды (localStorage) | не нужен |
| `src/js/cart/storage.js` | корзина, заказы, заявки (localStorage) | как и раньше — `sale.basket`, `sale.order`, инфоблок заявок |
| `src/js/account/session.js` | `currentUser()` синхронно, событие `account:change` | `currentUser()` читает пользователя из серверной разметки (например, `<body data-user='{"id":…,"name":…,"phone":…}'>`), остальное остаётся |
| `src/js/favorites/store.js` | избранное в памяти, событие `favorites:change` | остаётся; первое состояние берёт из `peekFavorites()` — на сервере это данные из разметки страницы |
| `src/js/favorites/toggle.js`, `src/js/account/layout.js`, `order-row.js`, `code-input.js`, `pages/*` | разметка и поведение | остаются как есть либо рисуются сервером с теми же классами |
| `src/js/account/demo.js` | демонстрация | **не переносится** |

Новые модули ничего не делают при импорте: состояние читается при первом вызове.
Через `header.js` и `cart/storage.js` в сборку Битрикса уже сейчас попадают
`session.js`, `favorites/store.js`, `account/storage.js`, `account/api.js`
и `account-copy.js` — но шапка в режиме `ssr` их не вызывает, а корзина гостя
читает прежний ключ `gg-cart`. Страницы кабинета, `/favorites`, `account.css`,
`status-tag.css`, `code-input.css`, `dialog.css` в `src/bitrix/main.js` **не
подключены** — единственная новая строка там `components/form.css`.

---

## 2. Страницы

Точка входа прототипа — `src/account.js`, страница выбирается по
`location.pathname`. Все страницы — обычные формы: у полей `name`, у форм
`method="post"`, у кнопок `type`.

| Адрес | Корневой класс | Блоки | Вызовы `api.js` |
|---|---|---|---|
| `/account/login` | `main.page-account.page-login` → `.login` | `.login__col > .login__form` (шаги: формы `.login__step`), `.login__media` (кадр `/media/brand/boutique-detail-01.jpg`, от 1024px) | шаг 1: `getRecordPhone` при `?from=order&n=` / `?from=request&r=`, `requestCode` по «Получить код»; шаг 2: `verifyCode` (сам, когда введены все цифры, или по «Войти»), `requestCode` по «Отправить код ещё раз»; шаг 3: `completeProfile` по «Готово» |
| `/account` | `main.page-account` → `.acc` (`.acc__side` + `.acc__main`) | `h1.acc-title`, `.acc-sub` (телефон), `section.acc-block` «Сейчас в работе» / последняя запись / `.acc-empty`, `section.acc-block` «Избранное» (`.fav__grid--row`), `nav.acc-rows` (уже 1024px), `.acc-contact` | `getHistory({ type: 'all', page: 1 })` при открытии; `reorder(n)` по «Повторить заказ»; избранное — из стора |
| `/account/orders` | то же | `h1`, `nav.caps.acc-caps` (только если есть оба типа), `.order-rows > a.order-row`, «Показать ещё» | `getHistory({ type, page })` при открытии, смене капсулы (`?type=orders|requests`) и по «Показать ещё» |
| `/account/order?n=` | то же, внутри `.acc-order` (`__main` + `aside.summary-sticky > .summary`) | `h1`, `.acc-sub--row` (дата, `.status-tag`), `section.ship` на отгрузку (`ol.ship-steps`, `.ship__receive`, `ul.acc-lines`), «Получение», «Оплата», ссылка на заявку | `getOrder(n)` при открытии; `reorder(n)`; `logout()` по «Войти с другим номером» |
| `/account/request?r=` | то же | `h1`, статус, `ol.order-steps` «Что дальше» (нет у закрытой), `ul.acc-lines` (сумма `is-estimate`), вопрос, ссылка на заказ, связь | `getRequest(r)` при открытии |
| `/account/addresses` | то же | `.addr-grid`: `article.addr-card`, `form.addr-card--form` на месте карточки или кнопки, `.addr-card--confirm` на месте карточки, `button.addr-card--add` | `getAddresses()` при открытии и после каждого изменения; `saveAddress`, `deleteAddress`, `setDefaultAddress` |
| `/account/profile` | то же | `form.acc-form` (имя, фамилия, почта, `.acc-form__phone`, уведомления), `.acc-form__foot`, `dialog.dialog` | `saveProfile`; `requestPhoneChange` → `confirmPhoneChange`; `logout`; `deleteAccount` |
| `/favorites` | гость: `main.page-account.page-favorites` → `.fav`; вошедший: каркас кабинета, `.fav.fav--account` | `h1`, «{n} товаров», `.fav__guest` (только гость и непустое), `.fav__dropped`, `nav.caps.fav__caps` (виды, если их два и больше; `?kind=stock|preorder|request`), `.fav__grid` из карточек каталога | только стор избранного (`list`, `dropped`, `confirmDropped`) |

Гость на любом адресе кабинета, кроме входа и `/favorites`, уходит на
`/account/login?back=<путь с параметрами>` (`location.replace`). `/account/order`
без `n` или с `n` не из цифр — «Заказ не найден»; то же для заявки.

**Каркас** (`layout.js`): крошки «Главная / Личный кабинет / …»; от 1024px
липкое меню в колонках 1–3 (`.acc__link`, текущий — `aria-current="page"` и линия
2px `--caspian` слева), содержимое в колонках 4–12. Уже 1024px меню нет, на обзоре
те же пункты строками (`nav.acc-rows`).

---

## 3. Формы данных и функции `api.js`

```
User      { id, phone, name, lastName, email, marketing, createdAt }
Address   { id, label, street, apartment, intercom, isDefault, createdAt }

Order     запись заказа, как её кладёт submitCheckout
          ({ number, createdAt, contact, receive, addressId, shipments, payment,
             comment, promo, items, totals }), плюс:
          userId          кому принадлежит, null у гостевого до привязки
          status          статус заказа
          shipments[i].status   статус отгрузки
          requestNumber   номер заявки, ушедшей вместе с заказом, или null

Request   { number, createdAt, contact, items, contactWay, question,
            orderNumber, userId, status }   (новая заявка — 'new')

HistoryRow { type: 'order' | 'request', number, createdAt, status,
             total (у заявки null), positions,
             previews: [{ src, alt }] (до четырёх),
             receive: { method: 'delivery' | 'pickup' | null,
                        dates: [ { date, interval } ] } }
```

`phone` в аргументах — десять цифр без +7. В записях заказов телефон хранится
отформатированным, сравнение — по цифрам. Статус заказа с двумя отгрузками —
статус той, что дальше от получения (`orderStatus` в `api.js`: accepted <
waiting < assembling < on_way / ready < done; `canceled` — отдельно). Все функции
асинхронные; `resendIn` и `retryIn` — секунды.

| Функция | Ответ | Что делает прототип |
|---|---|---|
| `requestCode(phone)` | `{ ok, resendIn, codeLength }` \| `{ ok: false, error: 'rate_limit', retryIn }` | СМС нет. Запись кода по номеру: когда выдан, три попытки, журнал выдач за час. Предыдущий код моложе 60 с и ещё принимается — новый не выдаётся, возвращается остаток таймера. Шестой код за час — `rate_limit` |
| `verifyCode(phone, code)` | `{ ok, isNew, user }` \| `wrong_code` + `attemptsLeft` \| `attempts_exhausted` \| `expired` | подходит `123456`. Третья неверная попытка — `attempts_exhausted`, код больше не принимается. Старше 10 минут — `expired`. Успех: номер новый — создаётся пользователь без имени (`isNew: true`); затем порядок входа из раздела 7 |
| `getRecordPhone({ order, request })` | десять цифр или `''` | телефон из заказа или заявки этого браузера — для подстановки на входе со страницы «Заказ принят». На сервере — только из заказа текущей сессии |
| `completeProfile({ name, email, marketing })` | `{ ok, user }` \| `{ ok: false, errors }` | имя обязательно, почта — нет (`optionalEmail`) |
| `getUser()` | `User` \| `null` | |
| `logout()` | | удаляет сессию, затем `account:change`. Корзина остаётся в кабинете |
| `getHistory({ type, page })` | `{ items, total, hasOrders, hasRequests }` | записи с `userId` вошедшего, новые сверху, по 20. `hasOrders` / `hasRequests` — нужны капсулам |
| `getOrder(number)` / `getRequest(number)` | запись \| `null` | только свои: сверка по `userId`, а не по телефону — после смены номера заказы остаются |
| `reorder(number)` | `{ added, skipped: [name] }` | кладёт через `add()` корзины. Позиция найдена в каталоге по слагу — цена, наличие и кадр из каталога; слага в каталоге нет — снята с продажи, в `skipped`; слага нет вовсе (витрина главной) — из снимка |
| `getAddresses()` | `[Address]` | |
| `saveAddress(address)` | `{ ok, address }` \| `{ ok: false, errors }` \| `error: 'limit' \| 'duplicate'` | с `id` — правка, без — новый. Одиннадцатый — `limit`; та же улица и квартира — `duplicate`. Первый адрес — основной сам |
| `deleteAddress(id)` | | удалили основной — основным становится самый ранний по `createdAt` |
| `setDefaultAddress(id)` | | |
| `saveProfile({ name, lastName, email, marketing })` | `{ ok, user }` \| `{ ok: false, errors }` | проверяется только почта |
| `requestPhoneChange(phone)` | как `requestCode` \| `phone_taken` \| `same_phone` | `same_phone` — добавлено: ввели свой же номер |
| `confirmPhoneChange(code)` | `{ ok, user }` \| ошибки как у `verifyCode` | меняет номер в профиле; заказы остаются |
| `deleteAccount()` | `{ ok: true }` | удаляет профиль, адреса, избранное и корзину пользователя; заказы и заявки остаются |
| `getFavorites()` | `[снимок]` | у вошедшего — из кабинета, у гостя — из браузера |
| `addFavorite(snapshot, index = 0)` | | `index` — место для «Вернуть». Не больше 200, при переполнении уходят самые старые |
| `removeFavorite(id)` | | |
| `peekFavorites()` | `[снимок]` синхронно | первая отрисовка: счётчик шапки нужен сразу. На сервере — данные из разметки |
| `openSession(user, { mergeGuest })` | | порядок входа; экспортируется только ради `demo.js` |

Снимок избранного: `id, slug, name, note, href, image, price, inStock,
categorySlug, fulfillment, addedAt`; вид считает `kindOf` при чтении.

Значения в начале `api.js` с пометкой `⚠ ПОДТВЕРДИТЬ: на Битриксе значение
задаёт ядро`: `CODE_LENGTH = 6`, `RESEND_SECONDS = 60`, `MAX_ATTEMPTS = 3`,
`CODE_TTL_MINUTES = 10`, `MAX_CODES_PER_HOUR = 5`. Сверить с ядром при переносе.

`submitCheckout` (`src/js/checkout/submit.js`): новый заказ — `status: 'accepted'`,
каждая отгрузка — `accepted`, заявка — `new`; `requestNumber` у заказа, если
заявка ушла вместе с ним; `userId` из `contact.userId`; при `order.saveAddress`
зовёт `saveAddress` (повтор и одиннадцатый адрес молча не сохраняются).

---

## 4. События

| Событие | `detail` | Кто рассылает | Кто подписан |
|---|---|---|---|
| `account:change` | `{ user }` | `api.js` (вход, выход, профиль, смена номера, удаление); `session.js`, когда вход поменяли в соседней вкладке | шапка (`watchAccountState`), `cart/store.js` (перечитывает корзину), `favorites/store.js` (перечитывает избранное), каркас кабинета (`watchSession`), вход, `/favorites`, оформление |
| `favorites:change` | `{ items, count }` | `favorites/store.js` | шапка (счётчик), `toggle.js` (все сердца страницы), каркас кабинета (число в меню), обзор, `/favorites` |
| `cart:change` | `{ items, totals }` | `cart/store.js` | шапка (бейдж), корзина, сводка оформления |

Соседние вкладки узнают через событие `storage`. Внешнее изменение корзины
только обновляет состояние и рассылает `cart:change`, **обратно в хранилище
не пишет** — иначе при входе в соседней вкладке корзина кабинета могла бы
записаться в чужой ключ.

**Смена входа на открытой странице**

| Страница | Вышли в другой вкладке | Вошли в другой вкладке |
|---|---|---|
| страницы кабинета | `location.replace` на вход с `back` на текущую страницу | другой пользователь — перезагрузка |
| `/account/login` | ничего | переход на `back` |
| `/favorites` | перерисовка гостевой страницы | перерисовка в каркасе кабинета |
| `/cart` | перерисовка с новой корзиной | перерисовка с новой корзиной |
| `/checkout` | корзину не переключать; над формой строка «Вход изменился в другой вкладке. Обновите страницу, чтобы оформить заказ с актуальной корзиной.» и кнопка «Обновить»; отправка выключена | то же |
| остальные | обновляется шапка | обновляется шапка |

---

## 5. Что есть только в прототипе

- `src/js/account/demo.js`: `?demo=account` (вход «Анной», +7 900 000-00-00,
  заказы 90001–90005 и 90099 чужой, заявки 9001–9002, два адреса, избранное),
  `?demo=new` на `/account/login` (шаг 3 для +7 900 000-00-01), `?demo=guest`
  (выход). Все данные вымышленные. Номера от 90001 и 9001 в счётчик настоящих
  номеров не входят.
- Код `123456` для любого номера; СМС не отправляется.
- Строка «Прототип: СМС не отправляется, код 123456» на шаге кода
  (`login.code.prototype`) — на стенде её нет.
- localStorage: `gg-session`, `gg-users`, `gg-favorites`, `gg-codes`, `gg-cart`,
  `gg-cart:<userId>`, `gg-orders`, `gg-requests`. Без localStorage записи живут
  в памяти модуля до перезагрузки.
- Задержка 250 мс у шагов входа в `api.js` — чтобы было видно ожидание.

---

## 6. Общие модули: что поменялось и какую разметку ждёт скрипт

### Шапка (`src/js/sections/header.js`, `header.css`)

`navActions` в `src/data/nav.js`: сердце → `/favorites`, человек → `/account`.
PHP рисует их как раньше (`gg_action_link`, `gg_nav_panel`), без классов.

При `initHeader({ ssr: true })` шапка состояние входа и счётчик избранного **не
трогает вовсе**. Сервер отдаёт готовое:

```html
<!-- сердце: счётчик того же вида, что у корзины, скрыт при нуле -->
<a class="icon-btn fav-btn" href="/favorites">
  <svg>…</svg>
  <span class="fav-btn__count" data-count="6" aria-hidden="true">6</span>
  <span class="visually-hidden">Избранное, товаров: 6</span>
</a>

<!-- гость -->
<a class="icon-btn" href="/account/login"><svg>…</svg><span class="visually-hidden">Войти</span></a>

<!-- вошедший с именем: круг с первой буквой вместо иконки -->
<a class="icon-btn is-user" href="/account">
  <span class="user-initial" aria-hidden="true">А</span>
  <span class="visually-hidden">Личный кабинет, Анна</span>
</a>
<!-- вошедший без имени — обычная иконка, подпись «Личный кабинет» -->
```

Мобильное меню (`.nav-panel__meta`): те же две ссылки, новых строк нет, меняется
текст — «Войти» (на `/account/login`) или «{Имя} · кабинет» / «Личный кабинет»;
«Избранное» или «Избранное · {n}». Уже 1024px сердце и человек в шапке скрыты
селектором по адресу — он работает на разметке без классов:
`.header__actions a[href^="/account"], .header__actions a[href^="/favorites"]`.

### Карточка в сетке (`product-card.js`)

```html
<button type="button" class="product__fav is-active"
        data-fav-id="17" data-fav-name="Лосось филе слабой соли, классический"
        aria-pressed="true" aria-label="Убрать из избранного: Лосось филе…">…</button>
```

`toggle.js` по `favorites:change` обновляет **все** узлы `[data-fav-id]` с этим
`id`: класс `is-active`, `aria-pressed`, подпись. Серверной кнопке достаточно
`data-fav-id` и `data-fav-name`; нажатие на стенде — обычная форма или запрос
`addFavorite` / `removeFavorite`. На витрине главной `#shop` сердец нет.

### Карточка товара (`product-page.js`)

В `.pbuy__actions` после кнопок — `<button class="pbuy__fav" data-fav-id data-fav-name>`,
48px, активное состояние как у `.product__fav.is-active`. На стенде кнопки пока
нет: мобильное правило `.pbuy__actions .btn:last-child` оставлено ради серверной
разметки, прототип использует `.btn:has(+ .pbuy__fav)`.

### Оформление (`checkout-page.js`, `checkout.css`)

- гость: `<p class="checkout__login">Покупали у нас раньше? <a href="/account/login?back=%2Fcheckout">Войдите</a> — подставим контакты и адреса.</p>` над первым шагом;
- вошедший: имя, телефон, почта подставлены; подводка режима «только заказ» —
  «Контакты и адрес подставили из кабинета.» / «Контакты подставили из кабинета.»;
- адреса: `fieldset.group > .split > label.cap.cap--split > input[type=radio][name=address]`,
  значение — `id` адреса, последняя карточка — `value="new"`; поля нового адреса —
  `.fields[data-new-address]` (скрыты, пока выбран сохранённый);
- чекбокс `input[name=save_address]` (по умолчанию отмечен) либо строка
  «В кабинете уже 10 адресов, этот не сохраним»;
- в `payload`: `contact.userId`, `order.addressId` (или `null`) и адрес целиком
  в `order.receive`, `order.saveAddress`;
- `div.checkout__notice[data-session-notice]` — строка о смене входа.

### «Заказ принят» (`success-page.js`)

Вошедший: кнопка «Мои заказы» → `/account/order?n=…`, при одной заявке →
`/account/request?r=…`. Гость: кнопки нет, под шагами
`section.order-done__account` — заголовок, текст с номером из заказа, кнопка
«Войти» на `/account/login?from=order&n={n}&back=<закодированный /account/order?n={n}>`
(для заявки — `from=request&r=`).

### Прочее

- `cart/toast.js`: `showToast(text, action)` принимает ещё и кнопку
  `{ label, onClick }` — «Вернуть» в избранное.
- `base.css`: `.btn:disabled` — вид выключенной кнопки.
- `fulfillment.js`: `formatDate` — «17 сентября 2026».
- `validate.js`: `optionalEmail`.
- `icons.js`: `receipt`, `pin`.
- `components/form.css`: поля, капсулы и чекбокс вынесены из `checkout.css` без
  правок правил; подключён в `src/bitrix/main.js` строкой перед `checkout.css`.

### Где обращение к узлу защищено от его отсутствия

| Модуль | Узел | Что будет, если его нет |
|---|---|---|
| `header.js → watchAccountState` | сердце, человек в `.header__actions`, две ссылки в `.nav-panel__meta`, `.visually-hidden` внутри них | блок пропускается (на `/alt` сердца нет); в режиме `ssr` функция не вызывается |
| `favorites/toggle.js → syncHearts` | `[data-fav-id]` | пустой обход |
| `checkout-page.js → switchAddress` | `[data-new-address]` | выход из функции; `f.address?.value`, `f.save_address?.checked` |
| `layout.js → paintIdentity`, `paintFavoritesCount` | `[data-acc-name]`, `[data-acc-phone]`, `[data-acc-fav-count]` | пропускаются |
| `success-page.js` | запись заказа из другого браузера | текст без номера телефона |

---

## 7. Правила, которые сервер повторяет

**Порядок при успешном входе** (`openSession` в `api.js`):

1. заказы и заявки, у которых цифры телефона в контактах совпадают с номером
   и `userId` пустой, получают `userId` вошедшего;
2. избранное гостя переходит в кабинет — объединение без повторов, новые сверху,
   не больше 200; гостевое очищается;
3. гостевая корзина складывается с корзиной кабинета: одинаковые позиции не
   удваиваются — остаётся большее из двух количеств (не больше 99); гостевая
   очищается;
4. запись сессии;
5. событие `account:change`.

Выход: удаляется сессия, затем `account:change`. Корзина остаётся в кабинете,
в браузере становится пустой; избранное в браузере пустое.

**Проверка `back`** (`safeBack` в `layout.js`):
`const url = new URL(back, location.origin)`; принимается, только если
`url.origin === location.origin`, путь начинается с `/` и не начинается
с `/account/login`. Дальше используется `url.pathname + url.search`. Всё прочее —
`/account`. Проверено: `//example.com`, `https://example.com`, `/%09/example.com`,
`/\example.com`, `javascript:…`, `/account/login` дают `/account`.

**Решения, которые сервер не меняет:** вход только по телефону и коду, вход
и регистрация — один сценарий; оформление без входа остаётся; отменить или
изменить заказ из кабинета нельзя; заказы после удаления кабинета остаются
у магазина; вход по прежнему номеру после удаления — как новый покупатель
(старые заказы к нему не привязываются: у них уже стоит `userId`).

---

## 8. Какие ключи `account-copy.js` где выводятся

| Ключ | Где |
|---|---|
| `login.*` | `/account/login`; `login.code.*` — ещё и смена номера в профиле |
| `header.*` | шапка и мобильное меню |
| `nav.*`, `crumbs.*` | каркас кабинета |
| `overview.*` | `/account` |
| `row.*`, `statuses.*` | строка заказа и заявки, метка статуса, шаги отгрузки |
| `orders.*` | `/account/orders` |
| `order.*` | `/account/order`; `order.apartment`, `order.intercom` — строка «Получение» |
| `request.*` | `/account/request`; шаги «Что дальше» — из `checkout-copy.js → success.request` |
| `addresses.*` | `/account/addresses`; подписи полей адреса — `checkout-copy.js → receive` |
| `profile.*` | `/account/profile` |
| `favorites.*` | `/favorites`, подписи и тосты сердца; названия видов в капсулах — `cart-copy.js` |
| `checkout.*` | оформление: строка входа, подводки, адреса, строка о смене входа |
| `success.*` | «Заказ принят»: «Мои заказы», блок входа гостя |
| `plurals.*` | формы слов для `plural()` |

## 9. Что ждём от заказчика и юриста

СМС-провайдер и стоимость СМС; статусы заказа и отгрузки для покупателя
(словарь `statuses` — предположение); текст согласия на входе и текст согласия
на рекламу; порядок удаления кабинета и что остаётся у магазина; каналы
рассылки; онлайн-оплата и её статус в кабинете. Всё помечено в `account-copy.js`
и `api.js` словом `⚠ ПОДТВЕРДИТЬ`.

---

## 23.09.2026: что доделано и что чинилось

- **Лист ожидания** стал пятым пунктом меню кабинета (`/account/waitlist/`),
  со своим счётчиком и строкой на обзоре — записка
  `PERENOS-ikra-menyu-ozhidanie.md`, раздел 3.
- **Вход по телефону на стенде не работал для нового номера.** `CUser::Add`
  отвечал «Не указан email пользователя»: Битрикс по умолчанию требует почту,
  а вход по номеру её не спрашивает. Ни одного покупателя на стенде не было.
  Опция `main/new_user_email_required` поставлена в `N`
  (`bitrix/install/gg-account-install.php`, скрипт идемпотентный).
  Выдуманный адрес вместо почты ставить нельзя: на него ушло бы письмо
  о поступлении товара из листа ожидания.
- **Шаги входа теперь по-настоящему общие**: `createLoginFlow` принимает
  транспорт параметром, и окно входа на стенде подсовывает ему серверные
  запросы вместо `api.js` прототипа.
