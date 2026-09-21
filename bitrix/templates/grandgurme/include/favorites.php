<?php
/**
 * Избранное: сердце в сетке и на карточке, страница /favorites, счётчик
 * в шапке.
 *
 * ГДЕ ЛЕЖИТ. У гостя — cookie `gg_fav`: список ID товаров, новые сверху,
 * как у заявки менеджера (include/requests.php). У вошедшего — таблица
 * `gg_favorite` (bitrix/install/gg-account-install.php). При входе список
 * гостя переезжает в кабинет и cookie очищается — порядок входа описан
 * в include/account.php.
 *
 * ХРАНИМ ТОЛЬКО ID. В прототипе избранное держит снимок позиции: там нет
 * сервера, и цену с наличием взять неоткуда. Здесь всё наоборот — цена,
 * остаток и вид позиции считаются при каждой отрисовке через
 * gg_products_live(), поэтому список — это просто ID.
 *
 * БЕЗ СКРИПТА ТОЖЕ РАБОТАЕТ. Сердце — обычная форма с POST и возвратом на ту
 * же страницу; скрипт (src/bitrix/favorites-hydrate.js) перехватывает нажатие
 * и обновляет все сердца страницы без перезагрузки. Поэтому у кнопки есть
 * data-fav-id и data-fav-name — те же атрибуты, что у прототипа.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/requests.php';
require_once __DIR__ . '/account.php';

const GG_FAV_COOKIE = 'gg_fav';
const GG_FAV_TTL = 2592000; // 30 дней
/** Больше 200 позиций не держим — как в прототипе; лишние уходят снизу. */
const GG_FAV_MAX = 200;
/** У гостя список живёт в cookie, там место дороже. */
const GG_FAV_MAX_GUEST = 100;

/* -------------------------------------------------------------------------
   Список
   ------------------------------------------------------------------------- */

/** ID избранного: новые сверху. Сырой список, без проверки товаров. */
function gg_fav_raw(): array
{
    $userId = gg_current_user_id();
    if ($userId > 0) {
        $conn = \Bitrix\Main\Application::getConnection();
        $sql = 'SELECT PRODUCT_ID FROM gg_favorite WHERE USER_ID = ' . $userId
            . ' ORDER BY ADDED_AT DESC, ID DESC LIMIT ' . GG_FAV_MAX;
        $rows = $conn->query($sql)->fetchAll();
        return array_map(static fn($row) => (int)$row['PRODUCT_ID'], $rows);
    }

    $raw = isset($_COOKIE[GG_FAV_COOKIE]) ? (string)$_COOKIE[GG_FAV_COOKIE] : '';
    $data = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($data)) {
        return [];
    }
    $list = [];
    foreach ($data as $id) {
        $id = (int)$id;
        if ($id > 0 && !in_array($id, $list, true)) {
            $list[] = $id;
        }
        if (count($list) >= GG_FAV_MAX_GUEST) {
            break;
        }
    }
    return $list;
}

/**
 * ID избранного, из которых остались только живые товары каталога.
 * Сколько позиций отсеялось — во втором аргументе: страница пишет об этом
 * строкой «{n} больше не продаются».
 */
function gg_fav_ids(?int &$dropped = null): array
{
    if (isset($GLOBALS['GG_FAV_CACHE'])) {
        $dropped = (int)($GLOBALS['GG_FAV_DROPPED'] ?? 0);
        return $GLOBALS['GG_FAV_CACHE'];
    }

    $raw = gg_fav_raw();
    if (!$raw || !CModule::IncludeModule('iblock')) {
        $GLOBALS['GG_FAV_CACHE'] = [];
        $GLOBALS['GG_FAV_DROPPED'] = 0;
        $dropped = 0;
        return [];
    }

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

    $list = array_values(array_filter($raw, static fn($id) => isset($alive[$id])));
    $dropped = count($raw) - count($list);
    $GLOBALS['GG_FAV_CACHE'] = $list;
    $GLOBALS['GG_FAV_DROPPED'] = $dropped;

    // Снятые с продажи убираем из хранилища сразу: иначе строка про них
    // всплывала бы на каждой странице.
    if ($dropped > 0) {
        gg_fav_write($list);
    }
    return $list;
}

function gg_fav_has(int $id): bool
{
    return in_array($id, gg_fav_ids(), true);
}

function gg_fav_count(): int
{
    return count(gg_fav_ids());
}

/** Записать список целиком (уже проверенный). */
function gg_fav_write(array $ids): void
{
    $ids = array_values(array_unique(array_map('intval', array_filter($ids, static fn($id) => (int)$id > 0))));
    $userId = gg_current_user_id();

    if ($userId > 0) {
        $conn = \Bitrix\Main\Application::getConnection();
        $conn->queryExecute('DELETE FROM gg_favorite WHERE USER_ID = ' . $userId);
        $now = time();
        $rows = [];
        foreach (array_slice($ids, 0, GG_FAV_MAX) as $i => $id) {
            // Новые сверху: чем раньше в списке, тем свежее отметка.
            $rows[] = '(' . $userId . ', ' . $id . ", '" . date('Y-m-d H:i:s', $now - $i) . "')";
        }
        if ($rows) {
            $conn->queryExecute('INSERT INTO gg_favorite (USER_ID, PRODUCT_ID, ADDED_AT) VALUES ' . implode(',', $rows));
        }
        return;
    }

    $ids = array_slice($ids, 0, GG_FAV_MAX_GUEST);
    $options = [
        'expires' => $ids ? time() + GG_FAV_TTL : time() - 3600,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    $value = $ids ? json_encode(array_values($ids)) : '';
    setcookie(GG_FAV_COOKIE, $value, $options);
    if ($ids) {
        $_COOKIE[GG_FAV_COOKIE] = $value;
    } else {
        unset($_COOKIE[GG_FAV_COOKIE]);
    }
}

/**
 * Добавить позицию. $index — место в списке (для «Вернуть» после удаления).
 * Товара нет или он выключен — false.
 */
function gg_fav_add(int $id, int $index = 0): bool
{
    if ($id <= 0 || !CModule::IncludeModule('iblock')) {
        return false;
    }
    $res = CIBlockElement::GetList([], ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'ID' => $id], false, false, ['ID']);
    if (!$res->Fetch()) {
        return false;
    }
    $ids = gg_fav_ids();
    $ids = array_values(array_filter($ids, static fn($cur) => $cur !== $id));
    $index = max(0, min($index, count($ids)));
    array_splice($ids, $index, 0, [$id]);
    gg_fav_write($ids);
    gg_fav_reset();
    return true;
}

/** Убрать позицию. Возвращает её прежнее место — его помнит кнопка «Вернуть». */
function gg_fav_remove(int $id): int
{
    $ids = gg_fav_ids();
    $index = array_search($id, $ids, true);
    if ($index === false) {
        return -1;
    }
    unset($ids[$index]);
    gg_fav_write(array_values($ids));
    gg_fav_reset();
    return (int)$index;
}

/** Сбросить кеш списка — после записи на той же странице. */
function gg_fav_reset(): void
{
    unset($GLOBALS['GG_FAV_CACHE'], $GLOBALS['GG_FAV_DROPPED']);
}

/* -------------------------------------------------------------------------
   Перенос избранного гостя в кабинет
   ------------------------------------------------------------------------- */

/**
 * Список гостя переезжает к вошедшему: объединение без повторов, гостевые
 * позиции сверху (они только что отмечены), затем прежние из кабинета.
 * Cookie очищается. Вызывается из gg_auth_open_session().
 */
function gg_fav_merge_guest(int $userId): void
{
    $raw = isset($_COOKIE[GG_FAV_COOKIE]) ? (string)$_COOKIE[GG_FAV_COOKIE] : '';
    $guest = $raw !== '' ? json_decode($raw, true) : null;
    $guest = is_array($guest) ? array_map('intval', $guest) : [];

    $conn = \Bitrix\Main\Application::getConnection();
    $rows = $conn->query('SELECT PRODUCT_ID FROM gg_favorite WHERE USER_ID = ' . $userId . ' ORDER BY ADDED_AT DESC, ID DESC')->fetchAll();
    $mine = array_map(static fn($row) => (int)$row['PRODUCT_ID'], $rows);

    $merged = [];
    foreach (array_merge($guest, $mine) as $id) {
        $id = (int)$id;
        if ($id > 0 && !in_array($id, $merged, true)) {
            $merged[] = $id;
        }
    }
    $merged = array_slice($merged, 0, GG_FAV_MAX);

    $conn->queryExecute('DELETE FROM gg_favorite WHERE USER_ID = ' . $userId);
    $now = time();
    $values = [];
    foreach ($merged as $i => $id) {
        $values[] = '(' . $userId . ', ' . $id . ", '" . date('Y-m-d H:i:s', $now - $i) . "')";
    }
    if ($values) {
        $conn->queryExecute('INSERT INTO gg_favorite (USER_ID, PRODUCT_ID, ADDED_AT) VALUES ' . implode(',', $values));
    }

    setcookie(GG_FAV_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Lax']);
    unset($_COOKIE[GG_FAV_COOKIE]);
}

/* -------------------------------------------------------------------------
   Разметка
   ------------------------------------------------------------------------- */

/** Тексты сердца — те же ключи, что в src/data/account-copy.js → favorites. */
function gg_fav_texts(): array
{
    return [
        'add' => 'Добавить в избранное',
        'remove' => 'Убрать из избранного',
        'toastAdded' => 'Добавили в избранное',
        'toastAddedAction' => 'Перейти',
        'toastRemoved' => 'Убрали из избранного',
        'toastUndo' => 'Вернуть',
    ];
}

/**
 * Кнопка-сердце. Внутри формы: без скрипта нажатие уходит POST-ом и
 * возвращает на ту же страницу, со скриптом — перехватывается.
 *
 * Если кнопка должна стоять внутри чужой формы (карточка товара: ряд
 * .pbuy__actions — это форма «В корзину»), передайте $formId: тогда
 * возвращается одна кнопка с атрибутом form, а саму форму выводит
 * gg_fav_form() где-нибудь вне той формы — вложенных форм HTML не допускает.
 *
 * @param int $id       ID товара
 * @param string $name  название — для подписи скринридеру
 * @param string $class класс кнопки: product__fav в сетке, pbuy__fav на карточке
 */
function gg_fav_button(int $id, string $name, string $class = 'product__fav', string $formId = ''): string
{
    $texts = gg_fav_texts();
    $active = gg_fav_has($id);
    $label = ($active ? $texts['remove'] : $texts['add']) . ': ' . $name;

    $button = '<button type="submit" class="' . gg_e($class) . ($active ? ' is-active' : '') . '"'
        . ($formId !== '' ? ' form="' . gg_e($formId) . '"' : '')
        . ' data-fav-id="' . $id . '" data-fav-name="' . gg_e($name) . '"'
        . ' aria-pressed="' . ($active ? 'true' : 'false') . '"'
        . ' aria-label="' . gg_e($label) . '">'
        . gg_icon('heart')
        . '</button>';

    if ($formId !== '') {
        return $button;
    }
    return '<form class="fav-form" method="post" action="' . gg_e(gg_fav_back_url()) . '">'
        . gg_fav_form_fields($id)
        . $button
        . '</form>';
}

/** Отдельная форма для кнопки с атрибутом form (см. gg_fav_button). */
function gg_fav_form(int $id, string $formId): string
{
    return '<form class="fav-form" id="' . gg_e($formId) . '" method="post" action="' . gg_e(gg_fav_back_url()) . '">'
        . gg_fav_form_fields($id)
        . '</form>';
}

function gg_fav_form_fields(int $id): string
{
    return bitrix_sessid_post()
        . '<input type="hidden" name="gg_fav_action" value="' . (gg_fav_has($id) ? 'remove' : 'add') . '">'
        . '<input type="hidden" name="gg_fav_id" value="' . $id . '">';
}

/** Адрес возврата для формы сердца — текущая страница без служебных параметров. */
function gg_fav_back_url(): string
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    $uri = new \Bitrix\Main\Web\Uri($request->getRequestUri());
    $uri->deleteParams(['gg_fav_action', 'gg_fav_id', 'gg_fav_index', 'sessid']);
    return $uri->getUri();
}

/* -------------------------------------------------------------------------
   Обработчик
   ------------------------------------------------------------------------- */

/**
 * POST сердца. Вызывается на каждой странице, где есть сердца, ДО вывода:
 * отвечает редиректом (обычная форма) или JSON (перехват скриптом).
 */
function gg_fav_handle_post(): void
{
    $request = \Bitrix\Main\Context::getCurrent()->getRequest();
    if (!$request->isPost()) {
        return;
    }
    $action = (string)$request->getPost('gg_fav_action');
    if ($action === '' || !check_bitrix_sessid()) {
        return;
    }

    $id = (int)$request->getPost('gg_fav_id');
    $index = (int)$request->getPost('gg_fav_index');
    $texts = gg_fav_texts();
    $toast = '';
    $undoIndex = -1;

    if ($action === 'add' || $action === 'restore') {
        $ok = gg_fav_add($id, $action === 'restore' ? max(0, $index) : 0);
        $toast = $ok ? $texts['toastAdded'] : '';
    } elseif ($action === 'remove') {
        $undoIndex = gg_fav_remove($id);
        $toast = $undoIndex >= 0 ? $texts['toastRemoved'] : '';
    }

    if ($request->getPost('gg_fav_ajax') === 'Y') {
        global $APPLICATION;
        if ($APPLICATION instanceof CMain) {
            $APPLICATION->RestartBuffer();
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => true,
            'id' => $id,
            'active' => gg_fav_has($id),
            'count' => gg_fav_count(),
            'toast' => $toast,
            'undoIndex' => $undoIndex,
        ], JSON_UNESCAPED_UNICODE);
        die();
    }

    if ($toast !== '') {
        // «Вернуть» без скрипта не сделать, поэтому у «Убрали» ссылки нет.
        $action === 'remove' ? gg_flash_toast_set($toast, '') : gg_flash_toast_set($toast, '/favorites/');
    }
    LocalRedirect(gg_fav_back_url());
}

/* -------------------------------------------------------------------------
   Капсулы видов на /favorites
   ------------------------------------------------------------------------- */

/**
 * Короткие названия видов для капсул — KIND_LABELS страницы избранного
 * в прототипе (src/js/account/pages/favorites.js). Не gg_kind_labels():
 * у метки «Под заказ» там ещё и срок, в капсуле он лишний. Тексты —
 * src/data/cart-copy.js → groups.stock.title, groups.preorder.title,
 * kinds.request. Порядок — KINDS из src/data/fulfillment.js.
 */
function gg_fav_kind_labels(): array
{
    return [
        'stock' => 'В наличии',
        'preorder' => 'Под заказ',
        'request' => 'Через менеджера',
    ];
}
