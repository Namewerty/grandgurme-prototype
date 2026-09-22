<?php
/**
 * Вход по номеру телефона, личный кабинет и всё, что к ним относится.
 *
 * Это серверная сторона того, что в прототипе делает src/js/account/api.js.
 * Имена функций, аргументы и форма ответов повторяют записку
 * PERENOS-kabinet-i-izbrannoe.md: страницы кабинета знают только их.
 *
 * ВХОД ТОЛЬКО ПО НОМЕРУ И ОДНОРАЗОВОМУ КОДУ. Паролей нет, входа по почте нет.
 * Учётная запись Битрикса заводится сама при первом подтверждённом коде:
 * логин `gg<десять цифр>`, пароль случайный и никому не нужен.
 *
 * ГДЕ ЛЕЖАТ ДАННЫЕ (bitrix/install/gg-account-install.php):
 *   gg_auth_code   выданные коды: когда, сколько попыток, использован ли
 *   gg_address     адреса доставки
 *   gg_favorite    избранное (include/favorites.php)
 *   gg_order_meta  телефон и получение заказа — по телефону гостевой заказ
 *                  находит покупателя при первом входе с этим номером
 *
 * КОД ПОКА НЕ УХОДИТ В СМС. На стенде нет СМС-провайдера, поэтому
 * gg_auth_send_code() возвращает канал 'stand' и страница входа показывает
 * код прямо на экране — но только тому, кто разблокировал стенд ссылкой
 * `?stand=<ключ>` (см. gg_stand_unlocked). Появится провайдер — код уйдёт
 * в СМС, и ветка 'stand' перестанет работать сама.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: СМС-провайдер и стоимость сообщения.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/checkout.php';
require_once __DIR__ . '/favorites.php';

/* Те же значения, что в src/js/account/api.js.
   ⚠ ПОДТВЕРДИТЬ: длину кода и интервалы задаёт провайдер СМС. */
const GG_CODE_LENGTH = 6;
const GG_RESEND_SECONDS = 60;
const GG_MAX_ATTEMPTS = 3;
const GG_CODE_TTL_MINUTES = 10;
const GG_MAX_CODES_PER_HOUR = 5;

/** Больше десяти адресов в кабинете не держим — как в прототипе. */
const GG_ADDRESS_MAX = 10;

/** Записей в списке «Заказы и заявки» за один заход. */
const GG_HISTORY_PAGE = 20;

/**
 * Ключ, которым открывается показ кода на стенде: `/account/login/?stand=<ключ>`.
 * Стенд закрыт от индексации, но адрес его открыт, и показывать код всем
 * подряд нельзя: по чужому номеру можно было бы войти в чужой кабинет.
 */
const GG_STAND_KEY = 'grandgurme-2026';
const GG_STAND_COOKIE = 'gg_stand';

/* -------------------------------------------------------------------------
   Кто сейчас на сайте
   ------------------------------------------------------------------------- */

function gg_current_user_id(): int
{
    global $USER;
    return ($USER instanceof CUser && $USER->IsAuthorized()) ? (int)$USER->GetID() : 0;
}

/**
 * Покупатель для разметки: те же поля, что у User в прототипе.
 * Пустой ответ — гость.
 */
function gg_account_user(): ?array
{
    if (array_key_exists('GG_USER', $GLOBALS)) {
        return $GLOBALS['GG_USER'];
    }
    $id = gg_current_user_id();
    if (!$id) {
        return $GLOBALS['GG_USER'] = null;
    }

    $rs = CUser::GetByID($id);
    $row = $rs ? $rs->Fetch() : null;
    if (!$row) {
        return $GLOBALS['GG_USER'] = null;
    }

    return $GLOBALS['GG_USER'] = [
        'id' => $id,
        'phone' => gg_phone_digits((string)($row['PERSONAL_PHONE'] ?? '')),
        'name' => trim((string)($row['NAME'] ?? '')),
        'lastName' => trim((string)($row['LAST_NAME'] ?? '')),
        'email' => trim((string)($row['EMAIL'] ?? '')),
        'marketing' => (string)($row['UF_GG_MARKETING'] ?? '') === '1',
        'createdAt' => (string)($row['DATE_REGISTER'] ?? ''),
    ];
}

/** Сбросить кеш пользователя — после входа, выхода и правки профиля. */
function gg_account_user_reset(): void
{
    unset($GLOBALS['GG_USER']);
}

/* -------------------------------------------------------------------------
   Стенд: показ кода на экране
   ------------------------------------------------------------------------- */

/** Ключ из адреса запоминается в cookie на сутки. */
function gg_stand_unlock(): void
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    if ((string)$request->get('stand') !== GG_STAND_KEY) {
        return;
    }
    setcookie(GG_STAND_COOKIE, '1', [
        'expires' => time() + 86400,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE[GG_STAND_COOKIE] = '1';
}

function gg_stand_unlocked(): bool
{
    gg_stand_unlock();
    return (string)($_COOKIE[GG_STAND_COOKIE] ?? '') === '1';
}

/* -------------------------------------------------------------------------
   Коды входа
   ------------------------------------------------------------------------- */

/** Последний выданный код по номеру. */
function gg_auth_last_code(string $phone): ?array
{
    $conn = \Bitrix\Main\Application::getConnection();
    $sql = "SELECT * FROM gg_auth_code WHERE PHONE = '" . $conn->getSqlHelper()->forSql($phone) . "'"
        . ' ORDER BY ID DESC LIMIT 1';
    $row = $conn->query($sql)->fetch();
    return $row ?: null;
}

/** Сколько кодов выдано по номеру за последний час. */
function gg_auth_codes_last_hour(string $phone): int
{
    $conn = \Bitrix\Main\Application::getConnection();
    $sql = "SELECT COUNT(*) AS CNT FROM gg_auth_code WHERE PHONE = '" . $conn->getSqlHelper()->forSql($phone) . "'"
        . " AND ISSUED_AT > '" . date('Y-m-d H:i:s', time() - 3600) . "'";
    $row = $conn->query($sql)->fetch();
    return (int)($row['CNT'] ?? 0);
}

/**
 * Запросить код.
 *
 * @return array ok: resendIn, codeLength, channel, code (только стенд);
 *               иначе error: rate_limit + retryIn
 */
function gg_auth_request_code(string $phone): array
{
    if (strlen($phone) !== 10) {
        return ['ok' => false, 'error' => 'invalid_phone'];
    }

    $last = gg_auth_last_code($phone);
    if ($last && (string)$last['USED'] === 'N') {
        $age = time() - strtotime((string)$last['ISSUED_AT']);
        $fresh = $age < GG_RESEND_SECONDS;
        $alive = $age < GG_CODE_TTL_MINUTES * 60 && (int)$last['ATTEMPTS'] < GG_MAX_ATTEMPTS;
        if ($fresh && $alive) {
            // Код моложе минуты и ещё принимается — новый не выдаём.
            return [
                'ok' => true,
                'resendIn' => GG_RESEND_SECONDS - $age,
                'codeLength' => GG_CODE_LENGTH,
                'channel' => 'repeat',
                'code' => (string)$last['CODE'],
            ];
        }
    }

    if (gg_auth_codes_last_hour($phone) >= GG_MAX_CODES_PER_HOUR) {
        return ['ok' => false, 'error' => 'rate_limit', 'retryIn' => 3600];
    }

    $code = (string)random_int(10 ** (GG_CODE_LENGTH - 1), 10 ** GG_CODE_LENGTH - 1);
    $conn = \Bitrix\Main\Application::getConnection();
    $helper = $conn->getSqlHelper();
    $conn->queryExecute(
        'INSERT INTO gg_auth_code (PHONE, CODE, ISSUED_AT, ATTEMPTS, USED, IP) VALUES ('
        . "'" . $helper->forSql($phone) . "', "
        . "'" . $helper->forSql($code) . "', "
        . "'" . date('Y-m-d H:i:s') . "', 0, 'N', "
        . "'" . $helper->forSql(substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45)) . "')"
    );

    $channel = gg_auth_send_code($phone, $code);

    return [
        'ok' => true,
        'resendIn' => GG_RESEND_SECONDS,
        'codeLength' => GG_CODE_LENGTH,
        'channel' => $channel,
        'code' => $code,
    ];
}

/**
 * Отправка кода. Есть модуль сообщений и настроенный отправитель — уходит СМС;
 * нет — канал 'stand', код показывает страница входа.
 */
function gg_auth_send_code(string $phone, string $code): string
{
    try {
        if (!\Bitrix\Main\Loader::includeModule('messageservice')) {
            return 'stand';
        }
        $senders = \Bitrix\MessageService\Sender\SmsManager::getSenders();
        foreach ($senders as $sender) {
            if (!$sender->canUse()) {
                continue;
            }
            $fromList = $sender->getFromList();
            $from = $fromList ? (string)($fromList[0]['id'] ?? '') : '';
            $result = \Bitrix\MessageService\Sender\SmsManager::sendMessage([
                'SENDER_ID' => $sender->getId(),
                'MESSAGE_FROM' => $from,
                'MESSAGE_TO' => '+7' . $phone,
                'MESSAGE_BODY' => 'Код для входа: ' . $code,
            ]);
            if ($result->isSuccess()) {
                return 'sms';
            }
        }
    } catch (\Throwable $e) {
        // Провайдера нет или он отказал — остаёмся на стендовом канале.
    }
    return 'stand';
}

/**
 * Проверить код.
 *
 * @return array ok: isNew, userId; иначе error: wrong_code + attemptsLeft,
 *               attempts_exhausted, expired, no_code
 */
function gg_auth_verify_code(string $phone, string $code): array
{
    $code = preg_replace('/\D+/', '', $code);
    $last = gg_auth_last_code($phone);
    if (!$last || (string)$last['USED'] === 'Y') {
        return ['ok' => false, 'error' => 'no_code'];
    }

    $conn = \Bitrix\Main\Application::getConnection();
    $id = (int)$last['ID'];
    $age = time() - strtotime((string)$last['ISSUED_AT']);
    $attempts = (int)$last['ATTEMPTS'];

    if ($attempts >= GG_MAX_ATTEMPTS) {
        return ['ok' => false, 'error' => 'attempts_exhausted'];
    }
    if ($age > GG_CODE_TTL_MINUTES * 60) {
        return ['ok' => false, 'error' => 'expired'];
    }
    if (strlen($code) !== GG_CODE_LENGTH) {
        return ['ok' => false, 'error' => 'incomplete'];
    }

    if (!hash_equals((string)$last['CODE'], $code)) {
        $attempts++;
        $conn->queryExecute('UPDATE gg_auth_code SET ATTEMPTS = ' . $attempts . ' WHERE ID = ' . $id);
        return $attempts >= GG_MAX_ATTEMPTS
            ? ['ok' => false, 'error' => 'attempts_exhausted']
            : ['ok' => false, 'error' => 'wrong_code', 'attemptsLeft' => GG_MAX_ATTEMPTS - $attempts];
    }

    $conn->queryExecute("UPDATE gg_auth_code SET USED = 'Y' WHERE ID = " . $id);

    $userId = gg_auth_find_user($phone);
    $isNew = $userId === 0;
    if ($isNew) {
        $userId = gg_auth_create_user($phone);
        if ($userId === 0) {
            return ['ok' => false, 'error' => 'user_failed'];
        }
    }

    gg_auth_open_session($userId, $phone);

    return ['ok' => true, 'isNew' => $isNew, 'userId' => $userId];
}

/** Покупатель по номеру. 0 — такого ещё нет. */
function gg_auth_find_user(string $phone): int
{
    $rs = CUser::GetList('ID', 'ASC', ['LOGIN_EQUAL' => 'gg' . $phone], ['FIELDS' => ['ID']]);
    $row = $rs->Fetch();
    return $row ? (int)$row['ID'] : 0;
}

/** Завести покупателя: логин из номера, случайный пароль, группа покупателей. */
function gg_auth_create_user(string $phone): int
{
    $user = new CUser();
    $password = md5(random_bytes(16));
    $id = (int)$user->Add([
        'LOGIN' => 'gg' . $phone,
        'PASSWORD' => $password,
        'CONFIRM_PASSWORD' => $password,
        'PERSONAL_PHONE' => gg_phone_format($phone),
        'ACTIVE' => 'Y',
        'GROUP_ID' => gg_customer_groups(),
        'EXTERNAL_AUTH_ID' => '',
    ]);
    return $id;
}

/** Группы нового покупателя: «Покупатели», если такая есть на сайте. */
function gg_customer_groups(): array
{
    $groups = [];
    $rs = CGroup::GetList('c_sort', 'asc', ['STRING_ID' => 'CUSTOMERS']);
    while ($row = $rs->Fetch()) {
        $groups[] = (int)$row['ID'];
    }
    if (!$groups) {
        $rs = CGroup::GetList('c_sort', 'asc', ['NAME' => 'Покупател%']);
        while ($row = $rs->Fetch()) {
            $groups[] = (int)$row['ID'];
        }
    }
    return $groups;
}

/**
 * Открыть сессию покупателя. Порядок тот же, что в openSession прототипа:
 * гостевые заказы и заявки с этим номером переходят к нему, избранное гостя
 * и корзина гостя сливаются, и только потом появляется сессия.
 */
function gg_auth_open_session(int $userId, string $phone): void
{
    global $USER;

    // Корзину гостя запоминаем ДО авторизации: после неё текущим станет
    // список покупателя, и гостевой уже не прочитать.
    $guestBasket = gg_basket_snapshot();

    gg_bind_guest_orders($userId, $phone);
    gg_bind_guest_requests($userId, $phone);
    gg_fav_merge_guest($userId);

    $USER->Authorize($userId);
    gg_account_user_reset();
    gg_fav_reset();

    gg_basket_merge($guestBasket);
}

/** Выход: сессия закрывается, корзина остаётся в кабинете. */
function gg_auth_logout(): void
{
    global $USER;
    $USER->Logout();
    gg_account_user_reset();
    gg_fav_reset();
}

/* -------------------------------------------------------------------------
   Корзина при входе
   ------------------------------------------------------------------------- */

/** Снимок корзины: ID товара => количество. */
function gg_basket_snapshot(): array
{
    $basket = gg_basket(true);
    if (!$basket) {
        return [];
    }
    $out = [];
    foreach ($basket as $item) {
        if ($item->isDelay()) {
            continue;
        }
        $out[(int)$item->getProductId()] = max(1, (int)$item->getQuantity());
    }
    return $out;
}

/**
 * Слить корзину гостя с корзиной кабинета: одинаковые позиции не удваиваются,
 * остаётся большее из двух количеств. Битрикс при авторизации переносит
 * корзину сам и количества складывает — поэтому после переноса количество
 * выставляется заново, а не добавляется.
 */
function gg_basket_merge(array $guest): void
{
    if (!$guest || !CModule::IncludeModule('sale') || !CModule::IncludeModule('catalog')) {
        return;
    }
    $basket = gg_basket(true);
    if (!$basket) {
        return;
    }

    $mine = [];
    foreach ($basket as $item) {
        if (!$item->isDelay()) {
            $mine[(int)$item->getProductId()] = $item;
        }
    }

    foreach ($guest as $productId => $qty) {
        $target = min(GG_MAX_QTY, max($qty, isset($mine[$productId]) ? (int)$mine[$productId]->getQuantity() : 0));
        if (isset($mine[$productId])) {
            if ((int)$mine[$productId]->getQuantity() !== $target) {
                $mine[$productId]->setField('QUANTITY', $target);
            }
            continue;
        }
        try {
            \Bitrix\Catalog\Product\Basket::addProduct(
                ['PRODUCT_ID' => $productId, 'QUANTITY' => $target],
                [],
                ['USE_MERGE' => 'N']
            );
        } catch (\Throwable $e) {
            // Позицию, которую Битрикс не принял, молча пропускаем.
        }
    }

    try {
        $basket->save();
    } catch (\Throwable $e) {
        // Корзина не сохранилась — вход от этого не отменяется.
    }
    gg_basket(true);
}

/* -------------------------------------------------------------------------
   Привязка гостевых заказов и заявок
   ------------------------------------------------------------------------- */

/** Телефон и получение заказа — их пишет gg_create_order при оформлении. */
function gg_order_meta_save(int $orderId, string $phone, array $data): void
{
    if ($orderId <= 0) {
        return;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $helper = $conn->getSqlHelper();
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $conn->queryExecute(
        'REPLACE INTO gg_order_meta (ORDER_ID, PHONE, DATA, CREATED_AT) VALUES ('
        . $orderId . ", '" . $helper->forSql($phone) . "', '" . $helper->forSql((string)$json) . "', '" . date('Y-m-d H:i:s') . "')"
    );
}

function gg_order_meta(int $orderId): array
{
    $conn = \Bitrix\Main\Application::getConnection();
    $row = $conn->query('SELECT DATA FROM gg_order_meta WHERE ORDER_ID = ' . $orderId)->fetch();
    if (!$row) {
        return [];
    }
    $data = json_decode((string)$row['DATA'], true);
    return is_array($data) ? $data : [];
}

/**
 * Гостевые заказы с этим номером переходят к покупателю. Заказ, оформленный
 * без входа, лежит на анонимном покупателе магазина; здесь у него меняется
 * владелец — по номеру из gg_order_meta.
 */
function gg_bind_guest_orders(int $userId, string $phone): void
{
    if (!CModule::IncludeModule('sale')) {
        return;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $helper = $conn->getSqlHelper();
    $rows = $conn->query(
        "SELECT ORDER_ID FROM gg_order_meta WHERE PHONE = '" . $helper->forSql($phone) . "'"
    )->fetchAll();
    if (!$rows) {
        return;
    }

    $anonymous = (int)CSaleUser::GetAnonymousUserID();
    foreach ($rows as $row) {
        $orderId = (int)$row['ORDER_ID'];
        try {
            $order = \Bitrix\Sale\Internals\OrderTable::getById($orderId)->fetch();
            if (!$order) {
                continue;
            }
            $owner = (int)$order['USER_ID'];
            if ($owner === $userId || ($owner !== $anonymous && $owner !== 0)) {
                continue;
            }
            \Bitrix\Sale\Internals\OrderTable::update($orderId, ['USER_ID' => $userId]);
        } catch (\Throwable $e) {
            // Заказ не перепривязался — кабинет просто его не покажет.
        }
    }
}

/** То же для заявок менеджеру: свойство USER_ID у элемента инфоблока. */
function gg_bind_guest_requests(int $userId, string $phone): void
{
    if (!CModule::IncludeModule('iblock')) {
        return;
    }
    $iblockId = gg_request_iblock_id();
    if (!$iblockId) {
        return;
    }

    $res = CIBlockElement::GetList(
        ['ID' => 'DESC'],
        ['IBLOCK_ID' => $iblockId, '!PROPERTY_PHONE' => false],
        false,
        false,
        ['ID', 'PROPERTY_PHONE', 'PROPERTY_USER_ID']
    );
    while ($row = $res->Fetch()) {
        if ((int)($row['PROPERTY_USER_ID_VALUE'] ?? 0) > 0) {
            continue;
        }
        if (gg_phone_digits((string)($row['PROPERTY_PHONE_VALUE'] ?? '')) !== $phone) {
            continue;
        }
        CIBlockElement::SetPropertyValuesEx((int)$row['ID'], $iblockId, ['USER_ID' => $userId]);
    }
}

/* -------------------------------------------------------------------------
   Адрес возврата
   ------------------------------------------------------------------------- */

/**
 * Проверка адреса возврата — дословно как safeBack в прототипе: только путь
 * этого же сайта, не ведущий обратно на вход.
 */
function gg_safe_back(string $back): string
{
    if ($back === '') {
        return '/account/';
    }
    $back = str_replace(["\r", "\n", "\t", "\0"], '', $back);
    if ($back[0] !== '/' || strncmp($back, '//', 2) === 0 || strncmp($back, '/\\', 2) === 0) {
        return '/account/';
    }
    $path = parse_url($back, PHP_URL_PATH);
    if (!is_string($path) || strncmp($path, '/account/login', 14) === 0) {
        return '/account/';
    }
    $query = parse_url($back, PHP_URL_QUERY);
    return $path . ($query ? '?' . $query : '');
}

/** Адрес страницы входа с возвратом. */
function gg_login_url(string $back = '', array $extra = []): string
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    $back = $back !== '' ? $back : (string)$request->getRequestUri();
    $params = array_merge($extra, ['back' => gg_safe_back($back)]);
    return '/account/login/?' . http_build_query($params);
}

/** Гость на странице кабинета уходит на вход. */
function gg_require_user(): array
{
    $user = gg_account_user();
    if (!$user) {
        LocalRedirect(gg_login_url());
    }
    return $user;
}

/* -------------------------------------------------------------------------
   Адреса доставки
   ------------------------------------------------------------------------- */

function gg_address_list(): array
{
    $userId = gg_current_user_id();
    if (!$userId) {
        return [];
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $rows = $conn->query(
        'SELECT * FROM gg_address WHERE USER_ID = ' . $userId . ' ORDER BY IS_DEFAULT DESC, CREATED_AT ASC, ID ASC'
    )->fetchAll();

    return array_map(static fn($row) => [
        'id' => (int)$row['ID'],
        'label' => (string)$row['LABEL'],
        'street' => (string)$row['STREET'],
        'apartment' => (string)$row['APARTMENT'],
        'intercom' => (string)$row['INTERCOM'],
        'isDefault' => (string)$row['IS_DEFAULT'] === 'Y',
        'createdAt' => (string)$row['CREATED_AT'],
    ], $rows);
}

function gg_address_by_id(int $id): ?array
{
    foreach (gg_address_list() as $address) {
        if ($address['id'] === $id) {
            return $address;
        }
    }
    return null;
}

/**
 * Сохранить адрес: с id — правка, без — новый.
 * Ошибки: errors (поля), limit (одиннадцатый), duplicate (та же улица и квартира).
 */
function gg_address_save(array $data): array
{
    $userId = gg_current_user_id();
    if (!$userId) {
        return ['ok' => false, 'error' => 'no_user'];
    }

    $id = (int)($data['id'] ?? 0);
    $street = trim((string)($data['street'] ?? ''));
    $apartment = trim((string)($data['apartment'] ?? ''));
    $intercom = trim((string)($data['intercom'] ?? ''));
    $label = trim((string)($data['label'] ?? ''));
    $makeDefault = !empty($data['isDefault']);

    if ($street === '') {
        return ['ok' => false, 'errors' => ['street' => 'Укажите улицу и номер дома']];
    }

    $list = gg_address_list();
    if (!$id && count($list) >= GG_ADDRESS_MAX) {
        return ['ok' => false, 'error' => 'limit'];
    }
    foreach ($list as $address) {
        if ($address['id'] !== $id
            && mb_strtolower($address['street']) === mb_strtolower($street)
            && mb_strtolower($address['apartment']) === mb_strtolower($apartment)) {
            return ['ok' => false, 'error' => 'duplicate'];
        }
    }

    $conn = \Bitrix\Main\Application::getConnection();
    $helper = $conn->getSqlHelper();
    $values = [
        "LABEL = '" . $helper->forSql(mb_substr($label, 0, 60)) . "'",
        "STREET = '" . $helper->forSql(mb_substr($street, 0, 255)) . "'",
        "APARTMENT = '" . $helper->forSql(mb_substr($apartment, 0, 60)) . "'",
        "INTERCOM = '" . $helper->forSql(mb_substr($intercom, 0, 60)) . "'",
    ];

    if ($id > 0) {
        if (!gg_address_by_id($id)) {
            return ['ok' => false, 'error' => 'not_found'];
        }
        $conn->queryExecute('UPDATE gg_address SET ' . implode(', ', $values) . ' WHERE ID = ' . $id . ' AND USER_ID = ' . $userId);
    } else {
        $first = count($list) === 0;
        $conn->queryExecute(
            'INSERT INTO gg_address (USER_ID, LABEL, STREET, APARTMENT, INTERCOM, IS_DEFAULT, CREATED_AT) VALUES ('
            . $userId . ", "
            . "'" . $helper->forSql(mb_substr($label, 0, 60)) . "', "
            . "'" . $helper->forSql(mb_substr($street, 0, 255)) . "', "
            . "'" . $helper->forSql(mb_substr($apartment, 0, 60)) . "', "
            . "'" . $helper->forSql(mb_substr($intercom, 0, 60)) . "', "
            . "'" . ($first || $makeDefault ? 'Y' : 'N') . "', "
            . "'" . date('Y-m-d H:i:s') . "')"
        );
        $id = (int)$conn->getInsertedId();
        $makeDefault = $makeDefault || $first;
    }

    if ($makeDefault) {
        gg_address_set_default($id);
    }

    return ['ok' => true, 'address' => gg_address_by_id($id)];
}

function gg_address_delete(int $id): void
{
    $userId = gg_current_user_id();
    if (!$userId || $id <= 0) {
        return;
    }
    $address = gg_address_by_id($id);
    if (!$address) {
        return;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $conn->queryExecute('DELETE FROM gg_address WHERE ID = ' . $id . ' AND USER_ID = ' . $userId);

    if ($address['isDefault']) {
        // Основным становится самый ранний из оставшихся — как в прототипе.
        $row = $conn->query('SELECT ID FROM gg_address WHERE USER_ID = ' . $userId . ' ORDER BY CREATED_AT ASC, ID ASC LIMIT 1')->fetch();
        if ($row) {
            gg_address_set_default((int)$row['ID']);
        }
    }
}

function gg_address_set_default(int $id): void
{
    $userId = gg_current_user_id();
    if (!$userId || $id <= 0) {
        return;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $conn->queryExecute("UPDATE gg_address SET IS_DEFAULT = 'N' WHERE USER_ID = " . $userId);
    $conn->queryExecute("UPDATE gg_address SET IS_DEFAULT = 'Y' WHERE ID = " . $id . ' AND USER_ID = ' . $userId);
}

/* -------------------------------------------------------------------------
   Профиль
   ------------------------------------------------------------------------- */

function gg_account_save_profile(array $data): array
{
    $userId = gg_current_user_id();
    if (!$userId) {
        return ['ok' => false, 'error' => 'no_user'];
    }
    $email = trim((string)($data['email'] ?? ''));
    if ($email !== '' && !check_email($email)) {
        return ['ok' => false, 'errors' => ['email' => 'Проверьте адрес: в нём должны быть @ и домен']];
    }

    $user = new CUser();
    $ok = $user->Update($userId, [
        'NAME' => mb_substr(trim((string)($data['name'] ?? '')), 0, 50),
        'LAST_NAME' => mb_substr(trim((string)($data['lastName'] ?? '')), 0, 50),
        'EMAIL' => $email,
        'UF_GG_MARKETING' => !empty($data['marketing']) ? 1 : 0,
    ]);
    if (!$ok) {
        return ['ok' => false, 'errors' => ['name' => strip_tags((string)$user->LAST_ERROR)]];
    }
    gg_account_user_reset();
    return ['ok' => true];
}

/** Смена номера: сначала код на новый номер. */
function gg_account_phone_change_request(string $phone): array
{
    $user = gg_account_user();
    if (!$user) {
        return ['ok' => false, 'error' => 'no_user'];
    }
    if ($phone === $user['phone']) {
        return ['ok' => false, 'error' => 'same_phone'];
    }
    if (gg_auth_find_user($phone) > 0) {
        return ['ok' => false, 'error' => 'phone_taken'];
    }
    return gg_auth_request_code($phone);
}

/** Подтверждение смены номера: код проверяется без входа в чужую запись. */
function gg_account_phone_change_confirm(string $phone, string $code): array
{
    $user = gg_account_user();
    if (!$user) {
        return ['ok' => false, 'error' => 'no_user'];
    }
    if (gg_auth_find_user($phone) > 0) {
        return ['ok' => false, 'error' => 'phone_taken'];
    }

    $last = gg_auth_last_code($phone);
    if (!$last || (string)$last['USED'] === 'Y') {
        return ['ok' => false, 'error' => 'no_code'];
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $id = (int)$last['ID'];
    $age = time() - strtotime((string)$last['ISSUED_AT']);
    $attempts = (int)$last['ATTEMPTS'];

    if ($attempts >= GG_MAX_ATTEMPTS) {
        return ['ok' => false, 'error' => 'attempts_exhausted'];
    }
    if ($age > GG_CODE_TTL_MINUTES * 60) {
        return ['ok' => false, 'error' => 'expired'];
    }
    if (!hash_equals((string)$last['CODE'], preg_replace('/\D+/', '', $code))) {
        $attempts++;
        $conn->queryExecute('UPDATE gg_auth_code SET ATTEMPTS = ' . $attempts . ' WHERE ID = ' . $id);
        return $attempts >= GG_MAX_ATTEMPTS
            ? ['ok' => false, 'error' => 'attempts_exhausted']
            : ['ok' => false, 'error' => 'wrong_code', 'attemptsLeft' => GG_MAX_ATTEMPTS - $attempts];
    }
    $conn->queryExecute("UPDATE gg_auth_code SET USED = 'Y' WHERE ID = " . $id);

    $cuser = new CUser();
    $cuser->Update($user['id'], [
        'LOGIN' => 'gg' . $phone,
        'PERSONAL_PHONE' => gg_phone_format($phone),
    ]);
    gg_account_user_reset();

    return ['ok' => true];
}

/**
 * Удаление кабинета: профиль, адреса и избранное. Заказы и заявки остаются
 * у магазина — они нужны для учёта и гарантий.
 * ⚠ ПОДТВЕРДИТЬ У ЮРИСТА: порядок удаления и что остаётся у магазина.
 */
function gg_account_delete(): void
{
    $userId = gg_current_user_id();
    if (!$userId) {
        return;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $conn->queryExecute('DELETE FROM gg_favorite WHERE USER_ID = ' . $userId);
    $conn->queryExecute('DELETE FROM gg_address WHERE USER_ID = ' . $userId);

    // Учётная запись выключается и теряет номер: вход по нему заведёт нового
    // покупателя, а прежние заказы останутся у магазина.
    $cuser = new CUser();
    $cuser->Update($userId, [
        'ACTIVE' => 'N',
        'LOGIN' => 'gg-deleted-' . $userId,
        'NAME' => '',
        'LAST_NAME' => '',
        'EMAIL' => '',
        'PERSONAL_PHONE' => '',
        'UF_GG_MARKETING' => 0,
    ]);

    gg_auth_logout();
}

/* -------------------------------------------------------------------------
   Заказы и заявки кабинета
   ------------------------------------------------------------------------- */

/**
 * Статус заказа или отгрузки кодом из словаря прототипа
 * (src/data/account-copy.js → statuses).
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие статусы заказа и отгрузки показывать
 * покупателю. Пока разложено по тому, что Битрикс знает сам: отменён,
 * выполнен, отгружен, разрешена доставка, всё остальное — принят. Отгрузка
 * под заказ до сборки показывает «Ждём поставку».
 */
function gg_order_status_code(array $order, ?array $shipment = null, string $kind = 'all'): string
{
    if ((string)($order['CANCELED'] ?? 'N') === 'Y') {
        return 'canceled';
    }
    if ((string)($order['STATUS_ID'] ?? '') === 'F') {
        return 'done';
    }
    $pickup = (string)($order['GG_METHOD'] ?? 'delivery') === 'pickup';

    if ($shipment) {
        if ((string)($shipment['DEDUCTED'] ?? 'N') === 'Y') {
            return $pickup ? 'ready' : 'on_way';
        }
        if ((string)($shipment['ALLOW_DELIVERY'] ?? 'N') === 'Y') {
            return 'assembling';
        }
    }
    return $kind === 'preorder' ? 'waiting' : 'accepted';
}

/** Заказ «дальше от получения» — его статус показывается у всего заказа. */
function gg_status_weight(string $code): int
{
    $order = ['accepted' => 0, 'waiting' => 1, 'assembling' => 2, 'on_way' => 3, 'ready' => 3, 'done' => 4, 'canceled' => 5];
    return $order[$code] ?? 0;
}

/** Строки заказа: товары с кадрами и суммами. */
function gg_order_items(int $orderId): array
{
    if (!CModule::IncludeModule('sale')) {
        return [];
    }
    $rows = \Bitrix\Sale\Internals\BasketTable::getList([
        'filter' => ['ORDER_ID' => $orderId],
        'select' => ['ID', 'PRODUCT_ID', 'NAME', 'QUANTITY', 'PRICE'],
        'order' => ['ID' => 'ASC'],
    ])->fetchAll();
    if (!$rows) {
        return [];
    }

    $ids = array_map(static fn($row) => (int)$row['PRODUCT_ID'], $rows);
    $elements = gg_elements_for_ids($ids);
    $goods = gg_goods_info_for_ids($ids);

    $items = [];
    foreach ($rows as $row) {
        $pid = (int)$row['PRODUCT_ID'];
        $code = (string)($elements[$pid]['CODE'] ?? '');
        $name = (string)($goods[$pid]['name'] ?? ($elements[$pid]['NAME'] ?? $row['NAME']));
        $qty = max(1, (int)$row['QUANTITY']);
        $price = (float)$row['PRICE'];
        $items[] = [
            'productId' => $pid,
            'name' => $name,
            'note' => gg_line_weight($goods[$pid] ?? null),
            'href' => $code !== '' ? '/product/' . $code : '/catalog/',
            'price' => $price > 0 ? $price : null,
            'qty' => $qty,
            'sum' => $price * $qty,
        ];
    }
    return $items;
}

/** Заказы покупателя простыми массивами. */
function gg_user_orders(int $userId, int $limit = 100): array
{
    if (!$userId || !CModule::IncludeModule('sale')) {
        return [];
    }
    $rows = \Bitrix\Sale\Internals\OrderTable::getList([
        'filter' => ['USER_ID' => $userId],
        'select' => ['ID', 'ACCOUNT_NUMBER', 'DATE_INSERT', 'PRICE', 'STATUS_ID', 'CANCELED', 'USER_DESCRIPTION'],
        'order' => ['ID' => 'DESC'],
        'limit' => $limit,
    ])->fetchAll();

    $orders = [];
    foreach ($rows as $row) {
        $orders[] = gg_order_from_row($row);
    }
    return $orders;
}

/** Заказ по строке таблицы: добавляет получение из gg_order_meta и статусы. */
function gg_order_from_row(array $row): array
{
    $id = (int)$row['ID'];
    $meta = gg_order_meta($id);
    $row['GG_METHOD'] = (string)($meta['method'] ?? 'delivery');

    $shipments = [];
    if (CModule::IncludeModule('sale')) {
        $shipments = \Bitrix\Sale\Internals\ShipmentTable::getList([
            'filter' => ['ORDER_ID' => $id, 'SYSTEM' => 'N'],
            'select' => ['ID', 'DEDUCTED', 'ALLOW_DELIVERY', 'COMMENTS'],
            'order' => ['ID' => 'ASC'],
        ])->fetchAll();
    }

    $plans = is_array($meta['shipments'] ?? null) ? $meta['shipments'] : [];
    $list = [];
    foreach ($shipments as $i => $shipment) {
        $plan = $plans[$i] ?? [];
        $kind = (string)($plan['kind'] ?? 'all');
        $list[] = [
            'kind' => $kind,
            'label' => (string)($plan['label'] ?? ''),
            'date' => (string)($plan['date'] ?? ''),
            'interval' => (string)($plan['interval'] ?? ''),
            'items' => is_array($plan['items'] ?? null) ? array_map('intval', $plan['items']) : [],
            'status' => gg_order_status_code($row, $shipment, $kind),
        ];
    }
    if (!$list && $plans) {
        // Отгрузок в заказе нет (старый заказ) — показываем то, что записано.
        foreach ($plans as $plan) {
            $list[] = [
                'kind' => (string)($plan['kind'] ?? 'all'),
                'label' => (string)($plan['label'] ?? ''),
                'date' => (string)($plan['date'] ?? ''),
                'interval' => (string)($plan['interval'] ?? ''),
                'items' => [],
                'status' => gg_order_status_code($row, null, (string)($plan['kind'] ?? 'all')),
            ];
        }
    }

    $status = gg_order_status_code($row, $shipments[0] ?? null);
    foreach ($list as $shipment) {
        if (gg_status_weight($shipment['status']) < gg_status_weight($status)) {
            $status = $shipment['status'];
        }
    }

    return [
        'type' => 'order',
        'id' => $id,
        'number' => (string)$row['ACCOUNT_NUMBER'],
        'createdAt' => (string)$row['DATE_INSERT'],
        'total' => (float)$row['PRICE'],
        'status' => $status,
        'method' => $row['GG_METHOD'],
        'receive' => is_array($meta['receive'] ?? null) ? $meta['receive'] : [],
        'payment' => (string)($meta['payment'] ?? ''),
        'comment' => (string)($meta['comment'] ?? ''),
        'requestNumber' => (string)($meta['requestNumber'] ?? ''),
        'shipments' => $list,
    ];
}

/** Заявки покупателя простыми массивами. */
function gg_user_requests(int $userId, int $limit = 100): array
{
    if (!$userId || !CModule::IncludeModule('iblock')) {
        return [];
    }
    $iblockId = gg_request_iblock_id();
    if (!$iblockId) {
        return [];
    }

    $res = CIBlockElement::GetList(
        ['ID' => 'DESC'],
        ['IBLOCK_ID' => $iblockId, 'PROPERTY_USER_ID' => $userId],
        false,
        ['nTopCount' => $limit],
        ['ID', 'DATE_CREATE', 'PROPERTY_ITEMS_JSON', 'PROPERTY_QUESTION', 'PROPERTY_CONTACT_WAY', 'PROPERTY_ORDER_NUMBER', 'PROPERTY_STATUS']
    );

    $requests = [];
    while ($row = $res->Fetch()) {
        $items = json_decode((string)($row['PROPERTY_ITEMS_JSON_VALUE'] ?? ''), true);
        $items = is_array($items) ? $items : [];
        $statusXml = (string)($row['PROPERTY_STATUS_VALUE_XML_ID'] ?? ($row['PROPERTY_STATUS_VALUE'] ?? ''));
        $requests[] = [
            'type' => 'request',
            'id' => (int)$row['ID'],
            'number' => (string)$row['ID'],
            'createdAt' => (string)$row['DATE_CREATE'],
            'total' => null,
            'status' => gg_request_status_code($statusXml),
            'items' => $items,
            'question' => (string)($row['PROPERTY_QUESTION_VALUE'] ?? ''),
            'contactWay' => (string)($row['PROPERTY_CONTACT_WAY_VALUE'] ?? ''),
            'orderNumber' => (string)($row['PROPERTY_ORDER_NUMBER_VALUE'] ?? ''),
        ];
    }
    return $requests;
}

/** Статус заявки: значения списка инфоблока — new, in_work, closed. */
function gg_request_status_code(string $value): string
{
    $value = mb_strtolower(trim($value));
    if ($value === 'in_work' || $value === 'в работе') {
        return 'in_work';
    }
    if ($value === 'closed' || $value === 'закрыта') {
        return 'closed';
    }
    return 'new';
}

/**
 * Список «Заказы и заявки»: строки HistoryRow прототипа.
 *
 * @param string $type all | orders | requests
 */
function gg_account_history(string $type = 'all', int $page = 1): array
{
    $userId = gg_current_user_id();
    $orders = gg_user_orders($userId);
    $requests = gg_user_requests($userId);

    $rows = [];
    if ($type !== 'requests') {
        foreach ($orders as $order) {
            $items = gg_order_items($order['id']);
            $rows[] = gg_history_row_order($order, $items);
        }
    }
    if ($type !== 'orders') {
        foreach ($requests as $request) {
            $rows[] = gg_history_row_request($request);
        }
    }

    /* Новые сверху. Сравниваем временем, а не строкой: Битрикс отдаёт дату
       в формате сайта («05.10.2026»), и strcmp поставил бы октябрь перед
       сентябрём. Разбор форматов — gg_account_timestamp(). */
    usort($rows, static fn($a, $b) => gg_account_timestamp((string)$b['createdAt']) <=> gg_account_timestamp((string)$a['createdAt']));

    $total = count($rows);
    $page = max(1, $page);
    $items = array_slice($rows, 0, $page * GG_HISTORY_PAGE);

    return [
        'items' => $items,
        'total' => $total,
        'hasOrders' => (bool)$orders,
        'hasRequests' => (bool)$requests,
        'hasMore' => $total > count($items),
    ];
}

/** Кадры позиций для строки списка — до четырёх. */
function gg_history_previews(array $productIds): array
{
    $ids = array_slice(array_values(array_unique(array_map('intval', $productIds))), 0, 4);
    if (!$ids) {
        return [];
    }
    $items = gg_elements_for_ids($ids);
    $previews = [];
    foreach ($ids as $id) {
        $previews[] = ['id' => $id, 'item' => $items[$id] ?? null];
    }
    return $previews;
}

function gg_history_row_order(array $order, array $items): array
{
    $dates = [];
    foreach ($order['shipments'] as $shipment) {
        if ($shipment['date'] !== '') {
            $dates[] = ['date' => $shipment['date'], 'interval' => $shipment['interval']];
        }
    }
    $positions = count($items);

    return [
        'type' => 'order',
        'number' => $order['number'],
        'createdAt' => $order['createdAt'],
        'status' => $order['status'],
        'total' => $order['total'],
        'positions' => $positions,
        'previews' => gg_history_previews(array_map(static fn($item) => $item['productId'], $items)),
        'receive' => ['method' => $order['method'], 'dates' => $dates],
        'href' => '/account/order/?n=' . rawurlencode($order['number']),
    ];
}

function gg_history_row_request(array $request): array
{
    $ids = array_map(static fn($item) => (int)($item['id'] ?? 0), $request['items']);

    return [
        'type' => 'request',
        'number' => $request['number'],
        'createdAt' => $request['createdAt'],
        'status' => $request['status'],
        'total' => null,
        'positions' => count($request['items']),
        'previews' => gg_history_previews($ids),
        'receive' => ['method' => null, 'dates' => []],
        'href' => '/account/request/?r=' . rawurlencode($request['number']),
    ];
}

/** Заказ кабинета по номеру. Только свой: сверка по владельцу заказа. */
function gg_account_order(string $number): ?array
{
    $userId = gg_current_user_id();
    if (!$userId || $number === '' || !CModule::IncludeModule('sale')) {
        return null;
    }
    $row = \Bitrix\Sale\Internals\OrderTable::getList([
        'filter' => ['USER_ID' => $userId, 'ACCOUNT_NUMBER' => $number],
        'select' => ['ID', 'ACCOUNT_NUMBER', 'DATE_INSERT', 'PRICE', 'STATUS_ID', 'CANCELED', 'USER_DESCRIPTION'],
        'limit' => 1,
    ])->fetch();
    if (!$row) {
        return null;
    }

    $order = gg_order_from_row($row);
    $order['items'] = gg_order_items($order['id']);
    $order['positions'] = count($order['items']);
    $order['count'] = array_sum(array_map(static fn($item) => $item['qty'], $order['items']));
    return $order;
}

/** Заявка кабинета по номеру. */
function gg_account_request(string $number): ?array
{
    $userId = gg_current_user_id();
    if (!$userId || $number === '') {
        return null;
    }
    foreach (gg_user_requests($userId) as $request) {
        if ($request['number'] === $number) {
            return $request;
        }
    }
    return null;
}

/**
 * Повторить заказ: позиции уезжают в корзину или в заявку — смотря что
 * с ними сейчас. Снятые с продажи попадают в skipped.
 */
function gg_account_reorder(string $number): array
{
    $order = gg_account_order($number);
    if (!$order) {
        return ['added' => 0, 'skipped' => []];
    }

    $ids = array_map(static fn($item) => (int)$item['productId'], $order['items']);
    $live = gg_products_live($ids);
    $added = 0;
    $skipped = [];

    foreach ($order['items'] as $item) {
        $pid = (int)$item['productId'];
        $data = $live[$pid] ?? null;
        if (!$data) {
            $skipped[] = $item['name'];
            continue;
        }
        $qty = max(1, min(GG_MAX_QTY, (int)$item['qty']));
        $kind = gg_item_kind($data);

        if ($kind === 'request') {
            if (gg_request_add($pid, $qty)) {
                $added++;
            } else {
                $skipped[] = $item['name'];
            }
            continue;
        }
        try {
            $result = \Bitrix\Catalog\Product\Basket::addProduct(
                ['PRODUCT_ID' => $pid, 'QUANTITY' => $qty],
                [],
                ['USE_MERGE' => 'Y']
            );
            if ($result->isSuccess()) {
                $added++;
            } elseif (gg_request_add($pid, $qty)) {
                $added++;
            } else {
                $skipped[] = $item['name'];
            }
        } catch (\Throwable $e) {
            $skipped[] = $item['name'];
        }
    }

    return ['added' => $added, 'skipped' => $skipped];
}

/* -------------------------------------------------------------------------
   Каркас кабинета, строка заказа и метка статуса.

   Разметка повторяет прототип до класса: src/js/account/layout.js (каркас
   и строки-пункты), src/js/account/order-row.js (строка записи и метка
   статуса). Тексты — из src/data/account-copy.js, перенесены дословно.

   Каркас печатается двумя вызовами, между которыми страница пишет своё
   содержимое:

       gg_account_frame_open('orders', [['label' => 'Заказы и заявки']]);
       … содержимое .acc__main …
       gg_account_frame_close();

   $trail — крошки ПОСЛЕ «Главная / Личный кабинет»; последняя из них
   становится текущей. У страницы обзора он пустой.

   Кнопки кабинета без JS — формы POST с полем gg_account_action; их
   разбирает gg_account_handle_post() в самом начале страницы.
   ------------------------------------------------------------------------- */

/** Адрес текущей страницы — в action форм каркаса. */
function gg_account_uri(): string
{
    return (string)\Bitrix\Main\Context::getCurrent()->getRequest()->getRequestUri();
}

/** Пункты бокового меню — MENU из layout.js. */
function gg_account_menu(): array
{
    return [
        ['key' => 'overview', 'href' => '/account/', 'label' => 'Обзор', 'icon' => 'user'],
        ['key' => 'orders', 'href' => '/account/orders/', 'label' => 'Заказы и заявки', 'icon' => 'receipt'],
        ['key' => 'favorites', 'href' => '/favorites/', 'label' => 'Избранное', 'icon' => 'heart', 'counted' => true],
        ['key' => 'addresses', 'href' => '/account/addresses/', 'label' => 'Адреса', 'icon' => 'pin'],
        ['key' => 'profile', 'href' => '/account/profile/', 'label' => 'Личные данные', 'icon' => 'user'],
    ];
}

/**
 * Словарь статусов заказа, отгрузки и заявки — accountCopy.statuses.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие статусы показывать покупателю.
 * tone — цвет текста, mark — цвет знака (классы .status-tag--tone-*
 * и .status-tag--mark-*).
 */
function gg_statuses(): array
{
    return [
        'accepted' => ['label' => 'Принят', 'icon' => 'clock', 'tone' => 'fg', 'mark' => 'caspian'],
        'assembling' => ['label' => 'Собираем', 'icon' => 'clock', 'tone' => 'fg', 'mark' => 'caspian'],
        'waiting' => ['label' => 'Ждём поставку', 'icon' => 'clock', 'tone' => 'caspian', 'mark' => 'caspian'],
        'on_way' => ['label' => 'В пути', 'icon' => 'clock', 'tone' => 'fg', 'mark' => 'caspian'],
        'ready' => ['label' => 'Готов к выдаче', 'icon' => 'check', 'tone' => 'fg', 'mark' => 'caspian'],
        'done' => ['label' => 'Получен', 'icon' => 'check', 'tone' => 'fg', 'mark' => 'mute'],
        'canceled' => ['label' => 'Отменён', 'icon' => 'close', 'tone' => 'mute', 'mark' => 'mute'],
        'new' => ['label' => 'Новая', 'icon' => 'dialog', 'tone' => 'fg', 'mark' => 'gold'],
        'in_work' => ['label' => 'В работе', 'icon' => 'dialog', 'tone' => 'fg', 'mark' => 'gold'],
        'closed' => ['label' => 'Закрыта', 'icon' => 'dialog', 'tone' => 'mute', 'mark' => 'mute'],
    ];
}

/** Название статуса. Неизвестный код — пустая строка, не ошибка. */
function gg_status_label(string $code): string
{
    return (string)(gg_statuses()[$code]['label'] ?? '');
}

/** Метка статуса заказа, отгрузки или заявки (statusTagHtml прототипа). */
function gg_status_tag(string $code): string
{
    $status = gg_statuses()[$code] ?? null;
    if (!$status) {
        return '';
    }
    return '<span class="status-tag status-tag--tone-' . gg_e($status['tone'])
        . ' status-tag--mark-' . gg_e($status['mark']) . '">'
        . '<span class="status-tag__icon" aria-hidden="true">' . gg_icon($status['icon']) . '</span>'
        . '<span class="status-tag__text">' . gg_e($status['label']) . '</span>'
        . '</span>';
}

/**
 * Время записи. Битрикс отдаёт дату в формате сайта («21.09.2026 10:15:00»),
 * MySQL — «2026-09-21 10:15:00»; понимаем оба.
 */
function gg_account_timestamp(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/', $value, $m)) {
        return (int)mktime((int)($m[4] ?? 0), (int)($m[5] ?? 0), (int)($m[6] ?? 0), (int)$m[2], (int)$m[3], (int)$m[1]);
    }
    if (preg_match('/^(\d{2})\.(\d{2})\.(\d{4})(?:[ ](\d{2}):(\d{2})(?::(\d{2}))?)?/', $value, $m)) {
        return (int)mktime((int)($m[4] ?? 0), (int)($m[5] ?? 0), (int)($m[6] ?? 0), (int)$m[2], (int)$m[1], (int)$m[3]);
    }
    $ts = strtotime($value);
    return $ts === false ? 0 : (int)$ts;
}

/** «17 сентября 2026» — дата записи (createdLabel прототипа). */
function gg_account_date(string $value): string
{
    $ts = gg_account_timestamp($value);
    return $ts > 0 ? gg_format_date($ts) : '';
}

/**
 * Строка получения (receiveLine прототипа):
 *   одна доставка  «Привезём 18 сентября, 10:00–14:00»
 *   самовывоз      «Самовывоз 18 сентября, 12:00–16:00»
 *   две отгрузки   «Две доставки: 17 и 24 сентября» / «Два визита: …»
 * У отменённого заказа и у записи без дат строки нет.
 *
 * @param array $receive ['method' => 'delivery'|'pickup'|null, 'dates' => [['date','interval']]]
 */
function gg_receive_line(array $receive, string $status): string
{
    $method = (string)($receive['method'] ?? '');
    $dates = is_array($receive['dates'] ?? null) ? $receive['dates'] : [];
    if ($status === 'canceled' || $method === '' || !$dates) {
        return '';
    }

    $days = [];
    foreach ($dates as $date) {
        $day = gg_day_from_iso((string)($date['date'] ?? ''));
        if ($day) {
            $days[] = $day;
        }
    }
    if (!$days) {
        return '';
    }
    $pickup = $method === 'pickup';

    if (count($days) >= 2) {
        /* Месяц у обеих дат один — у первой он не пишется: «17 и 24 сентября». */
        $sameMonth = date('n Y', $days[0]) === date('n Y', $days[1]);
        $from = $sameMonth ? (string)(int)date('j', $days[0]) : gg_format_day_month($days[0]);
        return ($pickup ? 'Два визита: ' : 'Две доставки: ') . $from . ' и ' . gg_format_day_month($days[1]);
    }

    $interval = trim((string)($dates[0]['interval'] ?? ''));
    $date = gg_format_day_month($days[0]);
    $word = $pickup ? 'Самовывоз ' : 'Привезём ';
    return $word . $date . ($interval !== '' ? ', ' . $interval : '');
}

/**
 * Строка заказа или заявки (createOrderRow прототипа). Вся строка — одна
 * ссылка и один табстоп, внутри h3 с номером.
 *
 * @param array $row HistoryRow из gg_account_history()
 */
function gg_order_row(array $row): string
{
    $isOrder = (string)($row['type'] ?? 'order') === 'order';
    $positions = (int)($row['positions'] ?? 0);
    $previews = is_array($row['previews'] ?? null) ? $row['previews'] : [];
    $status = (string)($row['status'] ?? '');

    $line = $isOrder
        ? gg_receive_line(is_array($row['receive'] ?? null) ? $row['receive'] : [], $status)
        : gg_positions_label($positions) . ' у менеджера';

    /* alt у кадров пустой: строка уже названа номером заказа, и четыре
       подписи скринридер читал бы до самого номера. */
    $thumbs = '';
    foreach ($previews as $preview) {
        $item = is_array($preview['item'] ?? null) ? $preview['item'] : [];
        $thumbs .= gg_product_shot($item, '', 'media--compact order-row__thumb');
    }
    $rest = $positions - count($previews);
    if ($rest > 0) {
        $thumbs .= '<span class="order-row__more">+' . $rest . '</span>';
    }

    return '<a class="order-row" href="' . gg_e($row['href'] ?? '#') . '">'
        . '<div class="order-row__head">'
        . '<h3 class="order-row__title">' . gg_e(($isOrder ? 'Заказ №' : 'Заявка №') . (string)$row['number']) . '</h3>'
        . '<span class="order-row__date">' . gg_e(gg_account_date((string)($row['createdAt'] ?? ''))) . '</span>'
        . '</div>'
        . '<div class="order-row__state">'
        . gg_status_tag($status)
        . ($line !== '' ? '<span class="order-row__receive">' . gg_e($line) . '</span>' : '')
        . '</div>'
        . (($row['total'] ?? null) === null ? '' : '<span class="order-row__sum">' . gg_e(gg_price((float)$row['total'])) . '</span>')
        . '<span class="order-row__thumbs">' . $thumbs . '</span>'
        . '<span class="order-row__chevron" aria-hidden="true">' . gg_icon('chevronRight') . '</span>'
        . '</a>';
}

/**
 * Начало каркаса: крошки, боковое меню, открытый .acc__main.
 *
 * @param string $page ключ текущего пункта меню (gg_account_menu)
 * @param array  $trail крошки после «Личный кабинет»: [['label','href'?]]
 */
function gg_account_frame_open(string $page, array $trail): void
{
    $GLOBALS['GG_ACC_PAGE'] = $page;
    $user = gg_account_user() ?? [];
    $name = trim((string)($user['name'] ?? ''));
    $phone = gg_phone_format((string)($user['phone'] ?? ''));

    $crumbs = array_merge(
        [['label' => 'Главная', 'href' => '/'], ['label' => 'Личный кабинет', 'href' => '/account/']],
        array_values($trail)
    );
    $last = count($crumbs) - 1;
    $uri = gg_account_uri();
    ?>
<div class="container">
  <nav class="crumbs" aria-label="Хлебные крошки">
<?php foreach ($crumbs as $i => $crumb): ?>
<?php   if ($i === $last): ?>
    <span class="crumbs__current" aria-current="page"><?= gg_e($crumb['label']) ?></span>
<?php   else: ?>
    <a href="<?= gg_e($crumb['href'] ?? '/') ?>"><?= gg_e($crumb['label']) ?></a><span class="crumbs__sep" aria-hidden="true"></span>
<?php   endif; ?>
<?php endforeach; ?>
  </nav>

  <div class="acc">
    <aside class="acc__side" aria-label="Разделы кабинета">
      <p class="acc__name"><?= gg_e($name !== '' ? $name : 'Личный кабинет') ?></p>
      <p class="acc__phone"><?= gg_e($phone) ?></p>

      <nav class="acc__menu" aria-label="Разделы кабинета">
<?php foreach (gg_account_menu() as $item): $current = $item['key'] === $page; ?>
        <a class="acc__link<?= $current ? ' is-current' : '' ?>" href="<?= gg_e($item['href']) ?>"<?= $current ? ' aria-current="page"' : '' ?>>
          <span><?= gg_e($item['label']) ?></span>
<?php   if (!empty($item['counted'])): $count = gg_fav_count(); ?>
          <span class="acc__count"><?= $count > 0 ? (int)$count : '' ?></span>
<?php   endif; ?>
        </a>
<?php endforeach; ?>
      </nav>

<?php /* «Выйти» — форма POST: без JS кнопка обязана что-то отправлять.
         Разбирает её gg_account_handle_post() в начале страницы. */ ?>
      <form method="post" action="<?= gg_e($uri) ?>">
        <?= bitrix_sessid_post() ?>
        <button type="submit" class="link-btn acc__logout" name="gg_account_action" value="logout">Выйти</button>
      </form>
    </aside>

    <div class="acc__main">
<?php
}

/**
 * Конец каркаса. На обзоре перед закрытием печатаются пункты кабинета
 * строками (sectionLinks прототипа): уже 1024px бокового меню нет.
 * «Обзор» в списке не нужен — человек на нём и стоит.
 *
 * Страница может напечатать строки раньше сама — gg_account_section_rows():
 * на обзоре они стоят перед строкой связи .acc-contact, как в прототипе.
 * Тогда здесь их второй раз нет.
 */
function gg_account_frame_close(): void
{
    $page = (string)($GLOBALS['GG_ACC_PAGE'] ?? '');
    if ($page === 'overview' && empty($GLOBALS['GG_ACC_ROWS_DONE'])) {
        gg_account_section_rows();
    }
    ?>
    </div>
  </div>
</div>
<?php
}

/**
 * Блок «Заказ не найден» и «Заявка не найдена» — один вид, разные тексты
 * (renderNotFound прототипа). «Войти с другим номером» — форма POST:
 * выход и переход на вход с возвратом на эту же страницу.
 *
 * @param array $texts ['title','text','all','relogin'] из account-copy.js
 */
function gg_account_not_found(array $texts): void
{
    ?>
      <div class="acc-empty acc-empty--left">
        <h1 class="acc-empty__title"><?= gg_e($texts['title']) ?></h1>
        <p class="acc-empty__text"><?= gg_e($texts['text']) ?></p>
        <div class="acc-actions">
          <a class="btn btn--solid" href="/account/orders/"><?= gg_e($texts['all']) ?></a>
          <form method="post" action="<?= gg_e(gg_account_uri()) ?>">
            <?= bitrix_sessid_post() ?>
            <button type="submit" class="btn" name="gg_account_action" value="relogin"><?= gg_e($texts['relogin']) ?></button>
          </form>
        </div>
      </div>
<?php
}

/** Тост «Повторить заказ» — тексты order.reorder* из account-copy.js. */
function gg_reorder_toast(int $added, int $skipped): string
{
    if ($added <= 0) {
        return 'Эти позиции больше не продаются';
    }
    /* «Добавили 1 позицию»: после глагола — винительный падеж. */
    $n = $added . ' ' . gg_plural($added, 'позицию', 'позиции', 'позиций');
    return $skipped > 0
        ? 'Добавили ' . $n . ', ' . $skipped . ' больше не продаются'
        : 'Добавили в корзину ' . $n;
}

/**
 * Формы кабинета: «Выйти», «Войти с другим номером», «Повторить заказ».
 *
 * Зовётся страницей ДО вывода: каждое действие заканчивается редиректом,
 * а сообщение уезжает тостом в сессии (gg_flash_toast).
 *
 * @param string $back куда вернуться после действия — адрес самой страницы
 */
function gg_account_handle_post(string $back): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return;
    }
    $action = (string)($_POST['gg_account_action'] ?? '');
    if ($action === '') {
        return;
    }
    if (!check_bitrix_sessid()) {
        LocalRedirect($back);
    }

    if ($action === 'logout') {
        /* Выход уводит на главную — как signOut в прототипе. */
        gg_auth_logout();
        LocalRedirect('/');
    }

    if ($action === 'relogin') {
        gg_auth_logout();
        LocalRedirect(gg_login_url($back));
    }

    if ($action === 'reorder') {
        $result = gg_account_reorder(trim((string)($_POST['number'] ?? '')));
        gg_flash_toast_set(gg_reorder_toast((int)$result['added'], count($result['skipped'])));
    }

    LocalRedirect($back);
}

/* -------------------------------------------------------------------------
   Телефон из заказа или заявки этой сессии
   ------------------------------------------------------------------------- */

/**
 * Номер, которым оформили заказ или заявку в этой сессии. Вход со страницы
 * «Заказ принят» (`/account/login/?from=order&n=…`, `?from=request&r=…`)
 * подставляет его в поле телефона — это getRecordPhone из
 * src/js/account/api.js.
 *
 * ОТДАЁМ ТОЛЬКО СВОЁ. Номер заказа в адресе можно набрать руками, поэтому
 * запись сначала ищется среди сделанных этой сессией (gg_own_order,
 * gg_own_request), и только потом читается телефон. Из другого браузера
 * ответ пустой — как в прототипе.
 *
 * Снимок сессии самого телефона не хранит: у заказа он лежит в свойстве
 * PHONE (gg_order_props_map), у заявки — в свойстве PHONE элемента
 * инфоблока, а номер заявки — это ID её элемента (include/requests.php).
 *
 * @return string десять цифр без +7 или ''
 */
function gg_login_record_phone(string $from, string $orderNumber, string $requestNumber): string
{
    if ($from === 'order' && $orderNumber !== '') {
        $own = gg_own_order($orderNumber);
        $orderId = (int)($own['id'] ?? 0);
        if (!$own || !$orderId || !CModule::IncludeModule('sale')) {
            return '';
        }
        try {
            $order = \Bitrix\Sale\Order::load($orderId);
            if (!$order) {
                return '';
            }
            $item = $order->getPropertyCollection()->getItemByOrderPropertyId(gg_order_props_map()['PHONE']);
            return $item ? gg_phone_digits((string)$item->getValue()) : '';
        } catch (\Throwable $e) {
            // Заказ не прочитался — поле просто останется пустым.
            return '';
        }
    }

    if ($from === 'request' && $requestNumber !== '') {
        $iblockId = gg_request_iblock_id();
        if (!gg_own_request($requestNumber) || !$iblockId || !CModule::IncludeModule('iblock')) {
            return '';
        }
        $res = CIBlockElement::GetList(
            [],
            ['IBLOCK_ID' => $iblockId, 'ID' => (int)$requestNumber],
            false,
            false,
            ['ID', 'PROPERTY_PHONE']
        );
        $row = $res->Fetch();
        return $row ? gg_phone_digits((string)($row['PROPERTY_PHONE_VALUE'] ?? '')) : '';
    }

    return '';
}

/* -------------------------------------------------------------------------
   Обзор, адреса и личные данные (21.09.2026): общие куски страниц
   deploy-src/account/index.php, addresses/index.php, profile/index.php.
   ------------------------------------------------------------------------- */

/**
 * Пункты кабинета строками — nav.acc-rows (sectionLinks прототипа).
 *
 * Обзор печатает их сам, перед строкой связи: в прототипе порядок блоков
 * такой — «Сейчас в работе», «Избранное», строки, .acc-contact. Если
 * страница этого не сделала, строки печатает gg_account_frame_close()
 * в самом конце .acc__main. Второй раз они не печатаются.
 */
function gg_account_section_rows(): void
{
    $GLOBALS['GG_ACC_ROWS_DONE'] = true;
    $uri = gg_account_uri();
    ?>
      <nav class="acc-rows" aria-label="Разделы кабинета">
<?php foreach (gg_account_menu() as $item): ?>
<?php   if ($item['key'] === 'overview') { continue; } ?>
        <a class="acc-rows__row" href="<?= gg_e($item['href']) ?>">
          <span class="acc-rows__icon" aria-hidden="true"><?= gg_icon($item['icon']) ?></span>
          <span class="acc-rows__label"><?= gg_e($item['label']) ?></span>
<?php     if (!empty($item['counted'])): $count = gg_fav_count(); ?>
          <span class="acc-rows__count"><?= $count > 0 ? (int)$count : '' ?></span>
<?php     endif; ?>
          <span class="acc-rows__chevron" aria-hidden="true"><?= gg_icon('chevronRight') ?></span>
        </a>
<?php endforeach; ?>
        <form method="post" action="<?= gg_e($uri) ?>">
          <?= bitrix_sessid_post() ?>
          <button type="submit" class="acc-rows__row acc-rows__row--button" name="gg_account_action" value="logout">
            <span class="acc-rows__icon" aria-hidden="true"><?= gg_icon('close') ?></span>
            <span class="acc-rows__label">Выйти</span>
          </button>
        </form>
      </nav>
<?php
}

/**
 * Тост без ссылки: «Сохранили», «Номер изменён» — showToast(text) прототипа
 * без действия.
 *
 * Лежит в том же ключе сессии, что тост корзины (gg_flash_toast_set из
 * include/requests.php), — тост на странице всегда один. Отличие только
 * в пустом href: gg_flash_toast() ставит «Перейти» в корзину всегда, а для
 * профиля эта ссылка была бы неправдой.
 */
function gg_account_toast_set(string $text): void
{
    gg_flash_toast_set($text, '');
}

/** Разметка тоста — общий gg_flash_toast(): со ссылкой и без. */
function gg_account_toast(): string
{
    return gg_flash_toast();
}

/**
 * Карточки избранного по списку ID — данные для gg_account_fav_card().
 * Тот же расчёт, что на /favorites/: цена, остаток и вид позиции живые
 * (gg_products_live, gg_item_kind), порядок — порядок списка.
 *
 * @param int[] $ids ID товаров, новые сверху (gg_fav_ids)
 * @return array[] ['id','element','kind','title','weight','price','href','alt']
 */
function gg_account_fav_cards(array $ids): array
{
    $ids = array_values(array_filter(array_map('intval', $ids)));
    if (!$ids) {
        return [];
    }
    $live = gg_products_live($ids);
    $goods = gg_goods_info_for_ids($ids);
    $elements = gg_elements_for_ids($ids);

    $cards = [];
    foreach ($ids as $id) {
        if (!isset($elements[$id])) {
            continue;
        }
        $element = $elements[$id];
        $info = $goods[$id] ?? ['name' => (string)$element['NAME'], 'weight' => '', 'weighed' => false];
        $item = $live[$id] ?? ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];
        $title = (string)$info['name'];
        $weight = (string)$info['weight'];

        $cards[] = [
            'id' => $id,
            'element' => $element,
            'kind' => gg_item_kind($item),
            'title' => $title,
            'weight' => $weight,
            'price' => gg_price(gg_shelf_price($item['price'], (bool)$info['weighed'])),
            'href' => gg_product_url($element),
            'alt' => $title . ($weight !== '' ? ', ' . $weight : ''),
        ];
    }
    return $cards;
}

/**
 * Карточка избранного — article.product, та же разметка, что в сетке
 * /favorites/ (и в сетке каталога), с сердцем и кнопкой «в корзину»
 * в углах кадра.
 */
function gg_account_fav_card(array $card): string
{
    $html = '<article class="product">'
        . '<div class="product__frame">'
        . '<a class="product__shot" href="' . gg_e($card['href']) . '" tabindex="-1" aria-hidden="true">'
        . gg_product_shot($card['element'], (string)$card['alt'])
        . '</a>'
        . gg_fav_button((int)$card['id'], (string)$card['title'])
        . gg_cart_add_button((int)$card['id'], (string)$card['kind'], (string)$card['alt'])
        . '</div>'
        . '<div class="product__body">'
        . '<h3 class="product__name"><a href="' . gg_e($card['href']) . '">' . gg_e($card['title']) . '</a></h3>';
    if ((string)$card['weight'] !== '') {
        $html .= '<p class="product__note">' . gg_e($card['weight']) . '</p>';
    }
    $html .= '<p class="product__price">' . gg_e($card['price']) . '</p>';
    if ((string)$card['kind'] !== 'stock') {
        $html .= '<p class="product__tag">' . gg_stock_tag((string)$card['kind']) . '</p>';
    }
    return $html . '</div></article>';
}
