<?php
/**
 * Заявка менеджеру: список в cookie, обработчики, сохранение и письмо.
 *
 * ПОЧЕМУ НЕ КОРЗИНА БИТРИКСА. Позицию без цены Битрикс в корзину не примет,
 * а всё, что лежит в корзине, попадает в заказ и дальше в обмен с 1С.
 * Заявка — не заказ: оплатить её нельзя, цену и срок называет менеджер.
 * Поэтому до отправки её состав живёт в cookie gg_request, а отправленная
 * заявка — элемент отдельного инфоблока «Заявки менеджеру» (код gg_requests,
 * тип gg_service), который в заказы магазина и в обмен не попадает.
 * Менеджеру уходит письмо — почтовое событие GG_MANAGER_REQUEST.
 * Инфоблок и событие создаёт bitrix/install/gg-requests-install.php.
 *
 * COOKIE: JSON {"<ID товара>": количество}, не больше 30 позиций, 30 дней,
 * path=/, Secure, HttpOnly, SameSite=Lax. Пишется нативным setcookie() до
 * LocalRedirect, читается из $_COOKIE. При каждом чтении сервер проверяет,
 * что товары существуют и активны: удалённая из каталога позиция из заявки
 * молча пропадает.
 *
 * ВИД ПОЗИЦИИ СЧИТАЕТСЯ ЗАНОВО ПРИ КАЖДОЙ ОТРИСОВКЕ (gg_item_kind). Позиция
 * заявки, которую теперь можно купить, переезжает в корзину — это делает
 * gg_cart_sync в cart.php.
 *
 * Тексты — src/data/cart-copy.js и checkout-copy.js прототипа.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';

const GG_REQUEST_COOKIE = 'gg_request';
const GG_REQUEST_MAX_ITEMS = 30;
const GG_REQUEST_TTL = 2592000; // 30 дней

/** Защита от спама: не больше трёх заявок с одной сессии за 10 минут. */
const GG_REQUEST_RATE_LIMIT = 3;
const GG_REQUEST_RATE_WINDOW = 600;

/** Инфоблок заявок ищется по коду; ID в код не зашивается. */
const GG_REQUEST_IBLOCK_CODE = 'gg_requests';
const GG_REQUEST_IBLOCK_TYPE = 'gg_service';

/** Скрытое поле-ловушка на оформлении: человек его не видит и не заполняет. */
const GG_REQUEST_TRAP = 'gg_company_site';

/* -------------------------------------------------------------------------
   Состав заявки в cookie
   ------------------------------------------------------------------------- */

/** Сырой список из cookie: ID => количество, без проверки товаров. */
function gg_request_raw(): array
{
    $raw = isset($_COOKIE[GG_REQUEST_COOKIE]) ? (string)$_COOKIE[GG_REQUEST_COOKIE] : '';
    $data = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return [];
    }
    $list = [];
    foreach ($data as $id => $qty) {
        $id = (int)$id;
        $qty = (int)$qty;
        if ($id > 0 && $qty > 0) {
            $list[$id] = min(GG_MAX_QTY, $qty);
        }
        if (count($list) >= GG_REQUEST_MAX_ITEMS) {
            break;
        }
    }
    return $list;
}

/**
 * Состав заявки: только существующие и активные товары каталога.
 * Кеш на хит; gg_request_save его обновляет.
 */
function gg_request_list(?array $replace = null): array
{
    static $list = null;
    if ($replace !== null) {
        return $list = $replace;
    }
    if ($list !== null) {
        return $list;
    }
    $list = [];
    $raw = gg_request_raw();
    if (!$raw || !CModule::IncludeModule('iblock')) {
        return $list;
    }
    $res = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'ID' => array_keys($raw)],
        false,
        false,
        ['ID']
    );
    $alive = [];
    while ($row = $res->Fetch()) {
        $alive[(int)$row['ID']] = true;
    }
    foreach ($raw as $id => $qty) {
        if (isset($alive[$id])) {
            $list[$id] = $qty;
        }
    }
    return $list;
}

/** Записать состав. Пустой список удаляет cookie. */
function gg_request_save(array $list): void
{
    $clean = [];
    foreach ($list as $id => $qty) {
        $id = (int)$id;
        $qty = min(GG_MAX_QTY, (int)$qty);
        if ($id > 0 && $qty > 0 && count($clean) < GG_REQUEST_MAX_ITEMS) {
            $clean[$id] = $qty;
        }
    }
    gg_request_list($clean);

    $options = [
        'expires' => $clean ? time() + GG_REQUEST_TTL : time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    $value = $clean ? json_encode((object)$clean) : '';
    setcookie(GG_REQUEST_COOKIE, $value, $options);
    if ($clean) {
        $_COOKIE[GG_REQUEST_COOKIE] = $value;
    } else {
        unset($_COOKIE[GG_REQUEST_COOKIE]);
    }
}

/** Добавить позицию. false — товара нет или в заявке уже 30 позиций. */
function gg_request_add(int $id, int $qty): bool
{
    if ($id <= 0 || $qty <= 0 || !CModule::IncludeModule('iblock')) {
        return false;
    }
    $exists = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'ID' => $id],
        false,
        ['nTopCount' => 1],
        ['ID']
    )->Fetch();
    if (!$exists) {
        return false;
    }
    $list = gg_request_list();
    if (!isset($list[$id]) && count($list) >= GG_REQUEST_MAX_ITEMS) {
        return false;
    }
    $list[$id] = min(GG_MAX_QTY, ($list[$id] ?? 0) + $qty);
    gg_request_save($list);
    return true;
}

function gg_request_set_qty(int $id, int $qty): void
{
    $list = gg_request_list();
    if (!isset($list[$id])) {
        return;
    }
    if ($qty <= 0) {
        unset($list[$id]);
    } else {
        $list[$id] = min(GG_MAX_QTY, $qty);
    }
    gg_request_save($list);
}

function gg_request_remove(int $id): void
{
    $list = gg_request_list();
    unset($list[$id]);
    gg_request_save($list);
}

/** Штук в заявке — для бейджа корзины в шапке. */
function gg_request_count(): int
{
    return (int)array_sum(gg_request_list());
}

/**
 * Строки заявки простыми массивами, той же формы, что строки корзины
 * (gg_cart_lines): разметка группы о хранилище не знает.
 * Цена — каталожная, живая; у заявки она в итог не входит.
 */
function gg_request_lines(): array
{
    $list = gg_request_list();
    if (!$list) {
        return [];
    }
    $ids = array_keys($list);
    $elements = gg_elements_for_ids($ids);
    $props = gg_props_for_ids($ids, ['UPAKOVKA', 'CML2_ARTICLE']);
    $live = gg_products_live($ids);
    /* Название для печати и вес — как в каталоге и карточке (product-info.php). */
    $goods = gg_goods_info_for_ids($ids);

    $lines = [];
    foreach ($list as $id => $qty) {
        if (!isset($elements[$id])) {
            continue;
        }
        $code = (string)($elements[$id]['CODE'] ?? '');
        $lines[] = [
            'id' => $id,
            'productId' => $id,
            'code' => $code,
            'name' => (string)($goods[$id]['name'] ?? $elements[$id]['NAME']),
            'note' => gg_line_weight($goods[$id] ?? null),
            'article' => trim((string)($props[$id]['CML2_ARTICLE'] ?? '')),
            'href' => $code !== '' ? '/product/' . $code : '/catalog',
            'price' => $live[$id]['price'] ?? null,
            'qty' => (int)$qty,
            'live' => $live[$id] ?? ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false],
            'kind' => 'request',
        ];
    }
    return $lines;
}

/* -------------------------------------------------------------------------
   Тост после редиректа.

   Стенд не подтверждал добавление никак: catalog.element после ADD2BASKET
   молча уводит на ту же карточку. Общий серверный тост — сообщение в сессии,
   которое показывается один раз разметкой .toast из src/js/cart/toast.js;
   скрипт шаблона прячет его через несколько секунд (purchase-hydrate.js).
   ------------------------------------------------------------------------- */

/**
 * Тост на следующую отрисовку. Ссылка по умолчанию ведёт в корзину — так
 * было с первого захода; кабинету и избранному нужна другая ссылка или
 * никакой (21.09.2026): пустой $href — тост без ссылки.
 */
function gg_flash_toast_set(string $text, string $href = '/cart/', string $label = 'Перейти'): void
{
    $_SESSION['GG_TOAST'] = ['text' => $text, 'href' => $href, 'label' => $label];
}

function gg_flash_toast(): string
{
    $toast = $_SESSION['GG_TOAST'] ?? null;
    unset($_SESSION['GG_TOAST']);
    if (!is_array($toast) || empty($toast['text'])) {
        return '';
    }
    $href = (string)($toast['href'] ?? '');
    if ($href === '') {
        return '<div class="toast is-visible" role="status" aria-live="polite" data-server-toast>'
            . '<span>' . gg_e($toast['text']) . '</span>'
            . '</div>';
    }
    return '<div class="toast has-action is-visible" role="status" aria-live="polite" data-server-toast>'
        . '<span>' . gg_e($toast['text']) . '</span>'
        . '<a class="toast__link" href="' . gg_e($href) . '">' . gg_e((string)($toast['label'] ?? 'Перейти')) . '</a>'
        . '</div>';
}

/** Тексты тоста — src/data/cart-copy.js → toast. */
function gg_toast_text(string $kind): string
{
    if ($kind === 'request') {
        return 'Добавлено в заявку менеджеру';
    }
    if ($kind === 'preorder') {
        return 'Добавлено в корзину · привезём к ' . gg_format_day_month(strtotime('+' . GG_PREORDER_DAYS . ' days', gg_day_start()));
    }
    return 'Добавлено в корзину';
}

/* -------------------------------------------------------------------------
   Обработчики: request_add, request_qty, request_remove.
   Обычные POST-формы с check_bitrix_sessid() и возвратом (PRG).
   ------------------------------------------------------------------------- */

/**
 * @param string $back куда вернуться после записи
 * @return bool false — запрос не про заявку, обработчик ничего не делал
 */
function gg_request_handle_post(string $back): bool
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return false;
    }
    $action = (string)($_POST['gg_action'] ?? '');
    if (!in_array($action, ['request_add', 'request_qty', 'request_remove'], true)) {
        return false;
    }
    if (!check_bitrix_sessid()) {
        LocalRedirect($back);
    }

    $id = (int)($_POST['line'] ?? ($_POST['id'] ?? 0));
    $qty = (int)($_POST['quantity'] ?? 0);
    if (isset($_POST['gg_remove'])) {
        $action = 'request_remove';
    }

    if ($action === 'request_add') {
        if (gg_request_add($id, max(1, $qty))) {
            gg_flash_toast_set(gg_toast_text('request'));
        }
    } elseif ($action === 'request_qty') {
        gg_request_set_qty($id, $qty);
    } elseif ($action === 'request_remove') {
        gg_request_remove($id);
    }

    LocalRedirect($back);
    return true;
}

/* -------------------------------------------------------------------------
   Отправка заявки
   ------------------------------------------------------------------------- */

/** Способы связи — src/data/checkout-copy.js → request.contactWays. */
function gg_contact_ways(): array
{
    return [
        'call' => ['label' => 'Позвонить', 'how' => 'по телефону'],
        'whatsapp' => ['label' => 'WhatsApp', 'how' => 'в WhatsApp'],
        'telegram' => ['label' => 'Telegram', 'how' => 'в Telegram'],
    ];
}

/** ID инфоблока заявок по коду. 0 — скрипт установки ещё не запускали. */
function gg_request_iblock_id(): int
{
    static $id = null;
    if ($id !== null) {
        return $id;
    }
    $id = 0;
    if (CModule::IncludeModule('iblock')) {
        $row = CIBlock::GetList([], ['TYPE' => GG_REQUEST_IBLOCK_TYPE, 'CODE' => GG_REQUEST_IBLOCK_CODE, 'CHECK_PERMISSIONS' => 'N'])->Fetch();
        $id = $row ? (int)$row['ID'] : 0;
    }
    return $id;
}

/** ID значения списочного свойства по XML_ID. */
function gg_request_enum_id(int $iblockId, string $code, string $xmlId): ?int
{
    $row = CIBlockPropertyEnum::GetList([], ['IBLOCK_ID' => $iblockId, 'CODE' => $code, 'XML_ID' => $xmlId])->Fetch();
    return $row ? (int)$row['ID'] : null;
}

/** Заполнено ли поле-ловушка. */
function gg_request_is_spam(array $post): bool
{
    return trim((string)($post[GG_REQUEST_TRAP] ?? '')) !== '';
}

/** Не больше GG_REQUEST_RATE_LIMIT заявок с сессии за GG_REQUEST_RATE_WINDOW секунд. */
function gg_request_rate_ok(): bool
{
    $now = time();
    $times = array_filter(
        (array)($_SESSION['GG_REQUEST_TIMES'] ?? []),
        static fn($t) => (int)$t > $now - GG_REQUEST_RATE_WINDOW
    );
    $_SESSION['GG_REQUEST_TIMES'] = array_values($times);
    return count($times) < GG_REQUEST_RATE_LIMIT;
}

function gg_request_rate_hit(): void
{
    $_SESSION['GG_REQUEST_TIMES'][] = time();
}

/** Таблица позиций для менеджера: свойство ITEMS и письмо. */
function gg_request_items_html(array $lines): string
{
    $host = (\Bitrix\Main\Context::getCurrent()->getRequest()->isHttps() ? 'https://' : 'http://')
        . (string)($_SERVER['HTTP_HOST'] ?? '');
    $rows = '';
    foreach ($lines as $line) {
        $rows .= '<tr>'
            . '<td>' . gg_e($line['name']) . '</td>'
            . '<td>' . gg_e($line['note']) . '</td>'
            . '<td>' . gg_e($line['article']) . '</td>'
            . '<td>' . (int)$line['qty'] . '</td>'
            . '<td>' . gg_e($line['price'] !== null ? gg_price((float)$line['price']) : 'по запросу') . '</td>'
            . '<td><a href="' . gg_e($host . $line['href']) . '">' . gg_e($host . $line['href']) . '</a></td>'
            . '</tr>';
    }
    return '<table border="1" cellpadding="4" cellspacing="0">'
        . '<tr><th>Название</th><th>Фасовка</th><th>Артикул</th><th>Кол-во</th><th>Цена каталога</th><th>Ссылка</th></tr>'
        . $rows . '</table>';
}

/**
 * Сохранить заявку и отправить письмо менеджеру.
 *
 * @param array $data name, phone, email, contactWay, question, orderNumber, lines
 * @return array ['ok' => bool, 'id' => int, 'error' => string]
 */
function gg_request_create(array $data): array
{
    $fail = ['ok' => false, 'id' => 0, 'error' => 'Заявку отправить не удалось, позвоните нам'];

    if (!$data['lines'] || !CModule::IncludeModule('iblock')) {
        return $fail;
    }
    if (!gg_request_rate_ok()) {
        return ['ok' => false, 'id' => 0, 'error' => 'Слишком много заявок подряд. Попробуйте через несколько минут или позвоните нам'];
    }
    $iblockId = gg_request_iblock_id();
    if (!$iblockId) {
        return $fail;
    }

    $ways = gg_contact_ways();
    $way = isset($ways[$data['contactWay']]) ? $data['contactWay'] : 'call';
    $itemsHtml = gg_request_items_html($data['lines']);
    $itemsJson = json_encode(array_map(static fn($line) => [
        'id' => (int)$line['productId'],
        'code' => $line['code'],
        'article' => $line['article'],
        'name' => $line['name'],
        'pack' => $line['note'],
        'qty' => (int)$line['qty'],
        'price' => $line['price'],
    ], $data['lines']), JSON_UNESCAPED_UNICODE);

    $element = new CIBlockElement();
    $id = (int)$element->Add([
        'IBLOCK_ID' => $iblockId,
        'ACTIVE' => 'Y',
        'NAME' => 'Заявка: ' . $data['name'] . ', ' . date('d.m.Y H:i'),
        'PROPERTY_VALUES' => [
            'CUSTOMER_NAME' => $data['name'],
            'PHONE' => $data['phone'],
            'EMAIL' => $data['email'],
            'CONTACT_WAY' => gg_request_enum_id($iblockId, 'CONTACT_WAY', $way),
            'ITEMS' => ['VALUE' => ['TEXT' => $itemsHtml, 'TYPE' => 'HTML']],
            'ITEMS_JSON' => $itemsJson,
            'QUESTION' => $data['question'],
            'ORDER_NUMBER' => (string)$data['orderNumber'],
            'STATUS' => gg_request_enum_id($iblockId, 'STATUS', 'new'),
        ],
    ]);
    if ($id <= 0) {
        return $fail;
    }
    gg_request_rate_hit();

    $host = (\Bitrix\Main\Context::getCurrent()->getRequest()->isHttps() ? 'https://' : 'http://')
        . (string)($_SERVER['HTTP_HOST'] ?? '');
    CEvent::Send('GG_MANAGER_REQUEST', SITE_ID, [
        'REQUEST_ID' => $id,
        'NAME' => $data['name'],
        'PHONE' => $data['phone'],
        'EMAIL' => $data['email'] !== '' ? $data['email'] : '—',
        'CONTACT_WAY' => $ways[$way]['label'],
        'ITEMS' => $itemsHtml,
        'QUESTION' => $data['question'] !== '' ? $data['question'] : '—',
        'ORDER_NUMBER' => $data['orderNumber'] !== '' ? $data['orderNumber'] : '—',
        'ADMIN_LINK' => $host . '/bitrix/admin/iblock_element_edit.php?IBLOCK_ID=' . $iblockId
            . '&type=' . GG_REQUEST_IBLOCK_TYPE . '&ID=' . $id . '&lang=ru',
    ]);

    return ['ok' => true, 'id' => $id, 'error' => ''];
}

/**
 * Заявки, отправленные в этой сессии. Состав на странице «Заказ принят»
 * показывается только своей сессии — номер в адресе можно набрать руками.
 */
function gg_remember_request(string $number, array $snapshot): void
{
    if (!isset($_SESSION['GG_REQUESTS']) || !is_array($_SESSION['GG_REQUESTS'])) {
        $_SESSION['GG_REQUESTS'] = [];
    }
    $_SESSION['GG_REQUESTS'][$number] = $snapshot;
}

function gg_own_request(string $number): ?array
{
    $list = $_SESSION['GG_REQUESTS'] ?? [];
    return isset($list[$number]) && is_array($list[$number]) ? $list[$number] : null;
}
