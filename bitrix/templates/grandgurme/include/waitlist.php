<?php
/**
 * Лист ожидания: кнопка «Сообщить о поступлении» на карточке, страница
 * /account/waitlist/, счётчик в меню кабинета, письмо о поступлении.
 *
 * ГДЕ ЛЕЖИТ. Таблица `gg_waitlist` (bitrix/install/gg-waitlist-install.php),
 * рядом с избранным и адресами. Штатной подпиской модуля каталога
 * (`b_catalog_subscribe`) не пользуемся: записка PERENOS-ikra-menyu-ozhidanie.md
 * предлагала её, но Денис 23.09.2026 решил иначе — у штатной подписки своя
 * форма записи, свои письма и свой список в кабинете, и всё это пришлось бы
 * выворачивать под разметку прототипа. Четыре поля своей таблицы дают ровно
 * ту границу данных, что у api.js прототипа.
 *
 * ГОСТЕВОГО ЛИСТА НЕТ. Сообщение уходит на номер кабинета, поэтому подписка
 * только у вошедшего. Гость, нажавший кнопку, видит окно входа
 * (src/js/account/login-dialog.js), и подписка ставится сразу после кода.
 *
 * СТАТУС НЕ ХРАНИТСЯ. `waiting` / `arrived` / `gone` считаются при каждой
 * отрисовке по живому остатку и активности товара — как waitlistStatus
 * в прототипе. В таблице только «кто чего ждёт и с какого дня».
 *
 * БЕЗ СКРИПТА ТОЖЕ РАБОТАЕТ. Кнопка — обычная форма POST с возвратом на ту же
 * страницу; скрипт (src/bitrix/catalog-hydrate.js) перехватывает нажатие
 * и обновляет кнопку без перезагрузки.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/account.php';

/** Больше ста позиций в листе не держим: лишние уходят снизу, как в прототипе. */
const GG_WAIT_MAX = 100;

/* -------------------------------------------------------------------------
   Список
   ------------------------------------------------------------------------- */

/** ID листа ожидания, новые сверху. Гость — пустой список. */
function gg_wait_raw(): array
{
    $userId = gg_current_user_id();
    if ($userId <= 0) {
        return [];
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $rows = $conn->query(
        'SELECT PRODUCT_ID FROM gg_waitlist WHERE USER_ID = ' . $userId
        . ' ORDER BY CREATED_AT DESC, ID DESC LIMIT ' . GG_WAIT_MAX
    )->fetchAll();
    return array_map(static fn($row) => (int)$row['PRODUCT_ID'], $rows);
}

/**
 * ID листа с оставшимися в каталоге товарами и признаком «снят с продажи».
 *
 * Снятые с продажи из листа НЕ удаляются, в отличие от избранного: человек
 * просил сообщить, и строка «Больше не продаётся» — это ответ на его просьбу.
 * Убирает её он сам.
 *
 * @return array [ID => bool живой ли товар], в порядке листа
 */
function gg_wait_alive(): array
{
    if (isset($GLOBALS['GG_WAIT_ALIVE'])) {
        return $GLOBALS['GG_WAIT_ALIVE'];
    }
    $raw = gg_wait_raw();
    $out = [];
    if ($raw && CModule::IncludeModule('iblock')) {
        $res = CIBlockElement::GetList(
            [],
            ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'ID' => $raw],
            false,
            false,
            ['ID']
        );
        $alive = [];
        while ($row = $res->Fetch()) {
            $alive[(int)$row['ID']] = true;
        }
        foreach ($raw as $id) {
            $out[$id] = isset($alive[$id]);
        }
    }
    return $GLOBALS['GG_WAIT_ALIVE'] = $out;
}

function gg_wait_ids(): array
{
    return array_keys(gg_wait_alive());
}

function gg_wait_has(int $id): bool
{
    return array_key_exists($id, gg_wait_alive());
}

function gg_wait_count(): int
{
    return count(gg_wait_alive());
}

/** Сбросить кеш после записи на той же странице. */
function gg_wait_reset(): void
{
    unset($GLOBALS['GG_WAIT_ALIVE'], $GLOBALS['GG_WAIT_ENTRIES']);
}

/**
 * Статус записи — считается по каталогу, как waitlistStatus прототипа.
 *
 *   gone     товара в каталоге больше нет (снят с продажи);
 *   arrived  товар есть и лежит на складе — можно брать;
 *   waiting  товар есть, склада нет — ждём.
 */
function gg_wait_status(int $id, ?array $live = null): string
{
    if (!(gg_wait_alive()[$id] ?? false)) {
        return 'gone';
    }
    $live = $live ?? (gg_products_live([$id])[$id] ?? null);
    return $live && (float)$live['quantity'] > 0 ? 'arrived' : 'waiting';
}

/**
 * Записи листа со всем, что нужно странице и ajax-ответу.
 *
 * Снимок позиции той же формы, что у прототипа: id, slug, name, note, href,
 * image, addedAt. Плюс то, что прототипу взять неоткуда: статус, вид позиции
 * и цена — они считаются здесь по живому каталогу.
 */
function gg_wait_entries(): array
{
    if (isset($GLOBALS['GG_WAIT_ENTRIES'])) {
        return $GLOBALS['GG_WAIT_ENTRIES'];
    }
    $alive = gg_wait_alive();
    $ids = array_keys($alive);
    if (!$ids) {
        return $GLOBALS['GG_WAIT_ENTRIES'] = [];
    }

    $added = [];
    $userId = gg_current_user_id();
    if ($userId > 0) {
        $conn = \Bitrix\Main\Application::getConnection();
        $rows = $conn->query('SELECT PRODUCT_ID, CREATED_AT FROM gg_waitlist WHERE USER_ID = ' . $userId)->fetchAll();
        foreach ($rows as $row) {
            $added[(int)$row['PRODUCT_ID']] = gg_account_timestamp((string)$row['CREATED_AT']);
        }
    }

    $elements = gg_elements_for_ids($ids);
    $goods = gg_goods_info_for_ids($ids);
    $live = gg_products_live($ids);

    $entries = [];
    foreach ($ids as $id) {
        $element = $elements[$id] ?? null;
        $info = $goods[$id] ?? ['name' => '', 'weight' => '', 'weighed' => false];
        $item = $live[$id] ?? ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];
        $status = gg_wait_status($id, $item);
        $name = (string)($info['name'] !== '' ? $info['name'] : ($element['NAME'] ?? 'Позиция ' . $id));

        $entries[] = [
            'id' => $id,
            'slug' => (string)($element['CODE'] ?? ''),
            'name' => $name,
            'note' => (string)$info['weight'],
            'href' => $element ? gg_product_url($element) : '/catalog',
            'image' => '',
            'element' => $element,
            'addedAt' => $added[$id] ?? 0,
            'status' => $status,
            'kind' => gg_item_kind($item),
            'price' => gg_price(gg_shelf_price($item['price'], (bool)$info['weighed'])),
        ];
    }

    /* Порядок страницы: поступившие, ожидаемые, снятые; внутри групп новые
       сверху (лист уже отсортирован по дате). */
    $weight = ['arrived' => 0, 'waiting' => 1, 'gone' => 2];
    usort($entries, static function (array $a, array $b) use ($weight): int {
        $byStatus = ($weight[$a['status']] ?? 9) <=> ($weight[$b['status']] ?? 9);
        return $byStatus !== 0 ? $byStatus : ($b['addedAt'] <=> $a['addedAt']);
    });

    return $GLOBALS['GG_WAIT_ENTRIES'] = $entries;
}

/** Сколько позиций из листа уже поступило — строка на обзоре кабинета. */
function gg_wait_arrived_count(): int
{
    $n = 0;
    foreach (gg_wait_entries() as $entry) {
        if ($entry['status'] === 'arrived') {
            $n++;
        }
    }
    return $n;
}

/* -------------------------------------------------------------------------
   Запись
   ------------------------------------------------------------------------- */

/**
 * Подписаться. Повтор ничего не дублирует (уникальный ключ), при переполнении
 * уходят самые старые записи.
 *
 * @return bool удалось ли
 */
function gg_wait_add(int $id): bool
{
    $userId = gg_current_user_id();
    if ($userId <= 0 || $id <= 0 || !CModule::IncludeModule('iblock')) {
        return false;
    }
    $res = CIBlockElement::GetList([], ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'ID' => $id], false, false, ['ID']);
    if (!$res->Fetch()) {
        return false;
    }

    $conn = \Bitrix\Main\Application::getConnection();
    $conn->queryExecute(
        'INSERT INTO gg_waitlist (USER_ID, PRODUCT_ID, CREATED_AT) VALUES ('
        . $userId . ', ' . $id . ", '" . date('Y-m-d H:i:s') . "')"
        . ' ON DUPLICATE KEY UPDATE CREATED_AT = VALUES(CREATED_AT)'
    );

    /* Предел на пользователя: самые старые записи уходят. */
    $conn->queryExecute(
        'DELETE FROM gg_waitlist WHERE USER_ID = ' . $userId . ' AND ID NOT IN ('
        . 'SELECT ID FROM (SELECT ID FROM gg_waitlist WHERE USER_ID = ' . $userId
        . ' ORDER BY CREATED_AT DESC, ID DESC LIMIT ' . GG_WAIT_MAX . ') t)'
    );
    gg_wait_reset();
    return true;
}

/** Отписаться. */
function gg_wait_remove(int $id): bool
{
    $userId = gg_current_user_id();
    if ($userId <= 0 || $id <= 0) {
        return false;
    }
    $conn = \Bitrix\Main\Application::getConnection();
    $conn->queryExecute('DELETE FROM gg_waitlist WHERE USER_ID = ' . $userId . ' AND PRODUCT_ID = ' . $id);
    gg_wait_reset();
    return true;
}

/* -------------------------------------------------------------------------
   Тексты — src/data/product-copy.js → waitlist, account-copy.js → waitlist
   ------------------------------------------------------------------------- */

function gg_wait_texts(): array
{
    return [
        'subscribe' => 'Сообщить о поступлении',
        'subscribed' => 'Сообщим о поступлении',
        'off' => 'Не сообщать',
        'remove' => 'Убрать',
        'noteOff' => 'Пришлём СМС, когда товар появится на складе.',
        'noteOnBefore' => 'СМС придёт на {phone}. Все товары, которые вы ждёте, — в разделе',
        'noteOnLink' => '«Лист ожидания»',
        'noteOnAfter' => '.',
        'toastOn' => 'Сообщим СМС, когда товар появится',
        'toastOnAction' => 'Лист ожидания',
        'toastOff' => 'Не будем сообщать о поступлении',
        'toastUndo' => 'Вернуть',
        'toastRemoved' => 'Убрали из листа ожидания',
        'loginTitle' => 'Войдите, и мы сообщим о поступлении',
        'loginLead' => 'СМС придёт на этот номер. Кабинет создастся сам, пароль не нужен.',
        'pageTitle' => 'Лист ожидания',
        'lead' => 'Сообщим СМС на {phone}, когда товар появится на складе.',
        'itemsLabel' => 'Товары в листе ожидания',
        'since' => 'В листе с {date}',
        'emptyTitle' => 'Лист ожидания пуст',
        'emptyText' => 'Если нужного товара нет на складе, нажмите «Сообщить о поступлении» в его карточке — мы пришлём СМС, когда он появится.',
        'emptyAction' => 'Перейти в каталог',
    ];
}

/** Статусы записи — accountCopy.waitlist.statuses. */
function gg_wait_statuses(): array
{
    return [
        'waiting' => ['label' => 'Ждём поступления', 'icon' => 'clock', 'tone' => 'caspian', 'mark' => 'caspian'],
        'arrived' => ['label' => 'Поступил', 'icon' => 'check', 'tone' => 'fg', 'mark' => 'caspian'],
        'gone' => ['label' => 'Больше не продаётся', 'icon' => 'close', 'tone' => 'mute', 'mark' => 'mute'],
    ];
}

function gg_wait_status_tag(string $code): string
{
    $status = gg_wait_statuses()[$code] ?? null;
    if (!$status) {
        return '';
    }
    return '<span class="status-tag status-tag--tone-' . gg_e($status['tone'])
        . ' status-tag--mark-' . gg_e($status['mark']) . '">'
        . '<span class="status-tag__icon" aria-hidden="true">' . gg_icon($status['icon']) . '</span>'
        . '<span class="status-tag__text">' . gg_e($status['label']) . '</span>'
        . '</span>';
}

/* -------------------------------------------------------------------------
   Кнопка на карточке
   ------------------------------------------------------------------------- */

/**
 * Показывать ли кнопку: только у позиции, которая идёт заявкой менеджеру
 * и которой нет на складе (записка, 3.1). У «в наличии» и «под заказ»
 * кнопки нет — их можно просто купить.
 */
function gg_wait_button_shown(string $kind, float $quantity): bool
{
    return $kind === 'request' && $quantity <= 0;
}

/**
 * Блок кнопки под .pbuy__actions. Сервер рисует его сразу в нужном состоянии,
 * без мигания: подписан человек или нет, известно здесь же.
 *
 * $formId — форма лежит отдельно (gg_wait_form): ряд .pbuy__actions сам
 * является формой «в корзину», а вложенных форм HTML не допускает.
 */
function gg_wait_block(int $id, string $formId = 'gg-wait-form'): string
{
    $texts = gg_wait_texts();
    $on = gg_wait_has($id);
    $user = gg_account_user();
    $phone = gg_phone_format((string)($user['phone'] ?? ''));

    $button = '<button type="submit" class="btn pbuy__wait-btn' . ($on ? ' is-on' : '') . '"'
        . ' form="' . gg_e($formId) . '"'
        . ($on ? ' aria-disabled="true"' : '')
        . ' data-wait-on data-wait-id="' . $id . '">'
        . '<span class="pbuy__wait-icon" aria-hidden="true">' . gg_icon($on ? 'check' : 'bell') . '</span>'
        . gg_e($on ? $texts['subscribed'] : $texts['subscribe'])
        . '</button>';

    $off = $on
        ? '<button type="submit" class="link-btn pbuy__wait-off" form="' . gg_e($formId) . '-off"'
            . ' data-wait-off data-wait-id="' . $id . '">' . gg_e($texts['off']) . '</button>'
        : '';

    $note = $on
        ? '<p class="pbuy__wait-note">'
            . gg_e(str_replace('{phone}', $phone, $texts['noteOnBefore'])) . ' '
            . '<a href="/account/waitlist/">' . gg_e($texts['noteOnLink']) . '</a>'
            . gg_e($texts['noteOnAfter']) . '</p>'
        : '<p class="pbuy__wait-note">' . gg_e($texts['noteOff']) . '</p>';

    return '<div class="pbuy__wait" data-wait>'
        . '<div class="pbuy__wait-row">' . $button . $off . '</div>'
        . $note
        . '</div>';
}

/** Формы для кнопок блока — печатаются вне формы «в корзину». */
function gg_wait_forms(int $id, string $formId = 'gg-wait-form'): string
{
    $action = gg_e(gg_wait_back_url());
    $fields = static fn(string $act): string => bitrix_sessid_post()
        . '<input type="hidden" name="gg_wait_action" value="' . $act . '">'
        . '<input type="hidden" name="gg_wait_id" value="' . $id . '">';

    return '<form class="wait-form" id="' . gg_e($formId) . '" method="post" action="' . $action . '">' . $fields('add') . '</form>'
        . '<form class="wait-form" id="' . gg_e($formId) . '-off" method="post" action="' . $action . '">' . $fields('remove') . '</form>';
}

/**
 * Главная кнопка поступившей позиции на странице листа: «В корзину»
 * у того, что можно купить, «Добавить в заявку» у остального. Тексты —
 * productCopy.buy прототипа. Кладёт позицию и убирает её из листа.
 */
function gg_wait_take_button(int $id, string $kind): string
{
    return '<form class="wait-take" method="post" action="' . gg_e(gg_wait_back_url()) . '">'
        . bitrix_sessid_post()
        . '<input type="hidden" name="gg_wait_action" value="take">'
        . '<input type="hidden" name="gg_wait_id" value="' . $id . '">'
        . '<button type="submit" class="btn btn--solid" data-wait-add="' . $id . '">'
        . gg_e($kind === 'request' ? 'Добавить в заявку' : 'В корзину')
        . '</button>'
        . '</form>';
}

/** Адрес возврата формы — текущая страница без служебных параметров. */
function gg_wait_back_url(): string
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    $uri = new \Bitrix\Main\Web\Uri($request->getRequestUri());
    $uri->deleteParams(['gg_wait_action', 'gg_wait_id', 'sessid']);
    return $uri->getUri();
}

/* -------------------------------------------------------------------------
   Обработчик
   ------------------------------------------------------------------------- */

/**
 * POST кнопки. Вызывается ДО вывода на каждой странице, где есть кнопка:
 * отвечает редиректом (обычная форма) или JSON (перехват скриптом).
 *
 * Гость сюда попадает только без скрипта — со скриптом он сначала видит окно
 * входа. Ответ гостю один и тот же: reason = guest.
 */
function gg_wait_handle_post(): void
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    if (!$request->isPost()) {
        return;
    }
    $action = (string)$request->getPost('gg_wait_action');
    if ($action === '' || !check_bitrix_sessid()) {
        return;
    }

    $id = (int)$request->getPost('gg_wait_id');
    $texts = gg_wait_texts();
    $ajax = $request->getPost('gg_wait_ajax') === 'Y';
    $guest = gg_current_user_id() <= 0;

    $toast = '';
    $toastHref = '';
    if (!$guest) {
        if ($action === 'add') {
            $toast = gg_wait_add($id) ? $texts['toastOn'] : '';
            $toastHref = $toast !== '' ? '/account/waitlist/' : '';
        } elseif ($action === 'remove') {
            $toast = gg_wait_remove($id) ? $texts['toastOff'] : '';
        } elseif ($action === 'take' && function_exists('gg_cart_put')) {
            /* «В корзину» / «Добавить в заявку» у поступившей позиции:
               человек своё дождался, и запись уходит из листа. */
            $result = gg_cart_put($id, 1);
            if ($result['ok']) {
                gg_wait_remove($id);
                $toast = (string)$result['toast'];
                $toastHref = '/cart/';
            }
        }
    }

    if ($ajax) {
        gg_wait_json($guest
            ? ['ok' => false, 'reason' => 'guest']
            : ['ok' => true, 'id' => $id, 'active' => gg_wait_has($id), 'count' => gg_wait_count(), 'toast' => $toast]);
    }

    if ($guest) {
        LocalRedirect(gg_login_url(gg_wait_back_url()));
    }
    if ($toast !== '') {
        gg_flash_toast_set($toast, $toastHref);
    }
    LocalRedirect(gg_wait_back_url());
}

/** Ответ ajax: буфер страницы сбрасывается, дальше страница не рисуется. */
function gg_wait_json(array $data): void
{
    global $APPLICATION;
    if ($APPLICATION instanceof CMain) {
        $APPLICATION->RestartBuffer();
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    die();
}
