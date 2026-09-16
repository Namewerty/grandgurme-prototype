<?php
/**
 * Корзина: заказ из sale.basket, заявка из cookie, группы, итоги, тексты.
 *
 * ГРАНИЦА ТА ЖЕ, ЧТО В ПРОТОТИПЕ. В прототипе состав корзины лежал
 * в localStorage (src/js/cart/storage.js), а страницы работали через
 * store.js и не знали, откуда он берётся. Здесь вместо storage.js —
 * \Bitrix\Sale\Basket для заказа и cookie gg_request для заявки
 * (include/requests.php), а тексты сводки (src/js/cart/summary.js,
 * src/data/cart-copy.js) перенесены слово в слово.
 *
 * ОДНА КОРЗИНА НА ТРИ ВИДА ПОЗИЦИИ (gg_item_kind в catalog.php):
 *   stock, preorder — лежат в корзине Битрикса и уходят в заказ;
 *   request         — лежат в cookie и уходят менеджеру заявкой.
 * В заказе нет позиций «по запросу»: итог заказа всегда точная сумма.
 *
 * ВИД СЧИТАЕТСЯ ПО ЖИВЫМ ДАННЫМ ПРИ КАЖДОЙ ОТРИСОВКЕ, и хранилище следует
 * за видом (gg_cart_sync): позиция корзины, ставшая заявкой, переезжает
 * в cookie, позиция заявки, которую снова можно купить, — в корзину.
 *
 * ПОЧЕМУ НЕ ШАБЛОН sale.basket.basket. Разметка корзины обязана совпасть
 * с прототипом до класса — стили общие. Родной компонент приносит свой
 * JS на тысячи строк и свою разметку.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/requests.php';

/** Порядок видов везде: группы корзины, сводка, отгрузки. */
const GG_KINDS = ['stock', 'preorder', 'request'];

/* -------------------------------------------------------------------------
   Состав корзины
   ------------------------------------------------------------------------- */

/** Корзина текущего покупателя. null — модуль магазина недоступен. */
function gg_basket(bool $reload = false): ?\Bitrix\Sale\Basket
{
    static $basket = false;
    if ($basket !== false && !$reload) {
        return $basket;
    }
    $basket = null;
    if (!CModule::IncludeModule('sale')) {
        return null;
    }
    try {
        $basket = \Bitrix\Sale\Basket::loadItemsForFUser(
            \Bitrix\Sale\Fuser::getId(),
            \Bitrix\Main\Context::getCurrent()->getSite()
        );
    } catch (\Throwable $e) {
        $basket = null;
    }
    return $basket;
}

/**
 * Строки корзины Битрикса простыми массивами: разметка о Битриксе не знает.
 * Вид строки — по живому остатку, цене и доступности товара.
 */
function gg_basket_lines(): array
{
    $basket = gg_basket();
    if (!$basket) {
        return [];
    }

    $items = [];
    foreach ($basket as $item) {
        if (!$item->isDelay()) {
            $items[] = $item;
        }
    }
    if (!$items) {
        return [];
    }

    $productIds = array_map(static fn($item) => (int)$item->getProductId(), $items);
    $props = gg_props_for_ids($productIds, ['UPAKOVKA', 'CML2_ARTICLE']);
    $elements = gg_elements_for_ids($productIds);
    $live = gg_products_live($productIds);
    /* Название для печати и вес — как в каталоге и карточке (product-info.php). */
    $goods = gg_goods_info_for_ids($productIds);

    $lines = [];
    foreach ($items as $item) {
        $pid = (int)$item->getProductId();
        $name = (string)($goods[$pid]['name'] ?? ($elements[$pid]['NAME'] ?? $item->getField('NAME')));
        $code = (string)($elements[$pid]['CODE'] ?? '');
        $price = (float)$item->getPrice();
        $data = $live[$pid] ?? ['id' => $pid, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];

        $lines[] = [
            'id' => (int)$item->getId(),
            'productId' => $pid,
            'code' => $code,
            'name' => $name,
            'note' => gg_line_weight($goods[$pid] ?? null),
            'article' => trim((string)($props[$pid]['CML2_ARTICLE'] ?? '')),
            'href' => $code !== '' ? '/product/' . $code : '/catalog',
            'price' => $price > 0 ? $price : null,
            'qty' => max(1, (int)$item->getQuantity()),
            'kind' => gg_item_kind($data),
        ];
    }
    return $lines;
}

/**
 * Хранилище следует за видом. Возвращает уведомления для строки над группами.
 *
 * Позиция корзины, ставшая заявкой, уходит из корзины Битрикса в cookie.
 * Позиция заявки, которую снова можно купить, кладётся в корзину; не принял
 * Битрикс — остаётся в заявке молча. Запускается один раз за хит.
 */
function gg_cart_sync(): array
{
    static $notices = null;
    if ($notices !== null) {
        return $notices;
    }
    $notices = [];

    $basket = gg_basket();
    $toRequest = array_filter(gg_basket_lines(), static fn($line) => $line['kind'] === 'request');
    if ($basket && $toRequest) {
        $list = gg_request_list();
        foreach ($toRequest as $line) {
            $item = $basket->getItemById($line['id']);
            if (!$item) {
                continue;
            }
            $item->delete();
            $list[$line['productId']] = min(GG_MAX_QTY, ($list[$line['productId']] ?? 0) + (int)$line['qty']);
            $notices[] = '«' . $line['name'] . '» закончилась на складе — перенесли в заявку менеджеру';
        }
        $basket->save();
        gg_request_save($list);
        gg_basket(true);
    }

    $toOrder = array_filter(gg_request_lines(), static fn($line) => gg_item_kind($line['live']) !== 'request');
    if ($toOrder && CModule::IncludeModule('catalog') && CModule::IncludeModule('sale')) {
        $moved = false;
        foreach ($toOrder as $line) {
            try {
                $result = \Bitrix\Catalog\Product\Basket::addProduct(
                    ['PRODUCT_ID' => $line['productId'], 'QUANTITY' => $line['qty']],
                    [],
                    ['USE_MERGE' => 'Y']
                );
                $ok = $result->isSuccess();
            } catch (\Throwable $e) {
                $ok = false;
            }
            if ($ok) {
                gg_request_remove((int)$line['productId']);
                $notices[] = '«' . $line['name'] . '» снова можно заказать — перенесли в заказ';
                $moved = true;
            }
        }
        if ($moved) {
            gg_basket(true);
        }
    }

    return $notices;
}

/**
 * Всё, что нужно корзине и оформлению, одним вызовом: переносы, строки
 * заказа и заявки, итоги.
 */
function gg_cart_state(): array
{
    $notices = gg_cart_sync();
    $orderLines = array_values(array_filter(gg_basket_lines(), static fn($line) => $line['kind'] !== 'request'));
    $requestLines = gg_request_lines();

    return [
        'notices' => $notices,
        'orderLines' => $orderLines,
        'requestLines' => $requestLines,
        'groups' => gg_group_lines(array_merge($orderLines, $requestLines)),
        'totals' => gg_cart_totals($orderLines, $requestLines),
    ];
}

/** Строки, разложенные по видам в порядке групп; пустых групп нет. */
function gg_group_lines(array $lines): array
{
    $groups = [];
    foreach (GG_KINDS as $kind) {
        $items = array_values(array_filter($lines, static fn($line) => $line['kind'] === $kind));
        if ($items) {
            $groups[$kind] = $items;
        }
    }
    return $groups;
}

/**
 * Итоги — та же форма, что getTotals() в src/js/cart/store.js.
 *   count, positions — все виды: бейдж шапки и «5 позиций» под заголовком;
 *   order   — count, positions, sum, hasStock, hasPreorder, readyAt;
 *   request — count, positions.
 */
function gg_cart_totals(array $orderLines, array $requestLines): array
{
    $orderCount = 0;
    $sum = 0.0;
    $hasStock = false;
    $hasPreorder = false;
    foreach ($orderLines as $line) {
        $orderCount += (int)$line['qty'];
        $sum += (float)$line['price'] * (int)$line['qty'];
        $hasStock = $hasStock || $line['kind'] === 'stock';
        $hasPreorder = $hasPreorder || $line['kind'] === 'preorder';
    }
    $requestCount = (int)array_sum(array_column($requestLines, 'qty'));

    return [
        'count' => $orderCount + $requestCount,
        'positions' => count($orderLines) + count($requestLines),
        'order' => [
            'count' => $orderCount,
            'positions' => count($orderLines),
            'sum' => $sum,
            'hasStock' => $hasStock,
            'hasPreorder' => $hasPreorder,
            'readyAt' => gg_ready_date($hasPreorder),
        ],
        'request' => [
            'count' => $requestCount,
            'positions' => count($requestLines),
        ],
    ];
}

/** order | both | request — как modeOf в src/js/cart/summary.js. */
function gg_cart_mode(array $totals): string
{
    $hasOrder = $totals['order']['positions'] > 0;
    $hasRequest = $totals['request']['positions'] > 0;
    if ($hasOrder && $hasRequest) {
        return 'both';
    }
    return $hasRequest ? 'request' : 'order';
}

/** Заголовки и строки групп — src/data/cart-copy.js → groups. */
function gg_group_texts(string $kind, int $readyAt): array
{
    $texts = [
        'stock' => ['В наличии', 'Доставим день в день по Москве'],
        'preorder' => ['Под заказ', 'Привезём к ' . gg_format_day_month($readyAt) . ' — через ' . gg_days_label(GG_PREORDER_DAYS) . ' после оформления'],
        'request' => ['Заявка менеджеру', 'Оплатить эти позиции на сайте нельзя: менеджер уточнит цену и срок поставки и свяжется с вами'],
    ];
    return ['title' => $texts[$kind][0], 'lead' => $texts[$kind][1]];
}

/** Знак вида у строки под заголовком группы. */
function gg_kind_icon(string $kind): string
{
    return gg_icon(['stock' => 'check', 'preorder' => 'clock', 'request' => 'dialog'][$kind] ?? 'check');
}

/**
 * Всё, что сводка корзины пишет словами, — summaryTexts прототипа.
 */
function gg_summary_texts(array $totals): array
{
    $mode = gg_cart_mode($totals);
    $order = $totals['order'];
    $requestCount = gg_positions_label((int)$totals['request']['positions']);
    $checkout = [
        'order' => 'Оформить заказ',
        'both' => 'Оформить заказ и заявку',
        'request' => 'Оформить заявку',
    ];

    return [
        'mode' => $mode,
        'showOrder' => $mode !== 'request',
        'showRequest' => $mode !== 'order',
        'count' => (string)$order['count'],
        'sum' => gg_price((float)$order['sum']),
        'total' => gg_price((float)$order['sum']),
        'splitHint' => ($order['hasStock'] && $order['hasPreorder'])
            ? 'Товары в наличии можно получить раньше, отдельной доставкой. Выберете при оформлении.'
            : '',
        'requestNote' => $mode === 'request'
            ? 'Менеджер уточнит цену и срок поставки и свяжется с вами. Оплатить эти позиции на сайте нельзя.'
            : $requestCount . ', в итог не входят',
        'checkout' => $checkout[$mode],
        'barLabel' => $mode === 'request' ? 'Заявка' : 'Итого',
        'barValue' => $mode === 'request' ? $requestCount : gg_price((float)$order['sum']),
    ];
}

/**
 * Сумма строки. Без цены — «Цена по запросу»; у заявки с ценой сумма
 * пишется приглушённо (is-estimate): в итог она не входит.
 */
function gg_line_sum(array $line): string
{
    return $line['price'] === null ? 'Цена по запросу' : gg_price((float)$line['price'] * (int)$line['qty']);
}

/** «2 позиции». */
function gg_positions_label(int $n): string
{
    return $n . ' ' . gg_plural($n, 'позиция', 'позиции', 'позиций');
}

/* -------------------------------------------------------------------------
   Промокод.

   Лежит в сессии, а не в свойстве корзины: проверки кода нет вовсе — его
   читает менеджер при подтверждении, — а заводить ради строки, живущей
   до оформления, свойство корзины и миграцию под него незачем. При
   оформлении код уезжает в комментарий к заказу и остаётся с заказом
   навсегда. Сессия короче корзины (30 дней) — это и есть цена решения.
   ------------------------------------------------------------------------- */

function gg_promo(): string
{
    return isset($_SESSION['GG_PROMO']) ? (string)$_SESSION['GG_PROMO'] : '';
}

function gg_set_promo(string $code): void
{
    $_SESSION['GG_PROMO'] = mb_substr(trim($code), 0, 60);
}

/* -------------------------------------------------------------------------
   Изменения корзины: обычные POST-формы и возврат на ту же страницу.

   PRG: после записи уходим редиректом, чтобы «обновить страницу» не
   повторяло действие. Проверка check_bitrix_sessid() обязательна —
   без неё форму можно отправить с чужой страницы.
   ------------------------------------------------------------------------- */

function gg_cart_handle_post(string $back = '/cart/'): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return;
    }
    /* Строки заявки — свой обработчик (requests.php). */
    if (gg_request_handle_post($back)) {
        return;
    }
    if (!check_bitrix_sessid()) {
        LocalRedirect($back);
    }

    $action = (string)($_POST['gg_action'] ?? '');
    $basket = gg_basket();

    if ($action === 'promo') {
        gg_set_promo((string)($_POST['promo'] ?? ''));
        LocalRedirect($back);
    }

    if (!$basket) {
        LocalRedirect($back);
    }

    $id = (int)($_POST['line'] ?? 0);
    $item = $id ? $basket->getItemById($id) : null;

    /* Удаление приходит своим полем, а не значением gg_action: у строки
       одна форма на количество и на крестик, и два одноимённых поля в ней
       разбирались бы по порядку в теле запроса — то есть как повезёт. */
    if (isset($_POST['gg_remove'])) {
        $action = 'remove';
    }

    if ($item) {
        if ($action === 'remove') {
            $item->delete();
            $basket->save();
        } elseif ($action === 'qty') {
            $qty = (int)($_POST['quantity'] ?? 0);
            if ($qty <= 0) {
                $item->delete();
            } else {
                $item->setField('QUANTITY', min(GG_MAX_QTY, $qty));
            }
            $basket->save();
        }
    }

    LocalRedirect($back);
}

/**
 * Добавление в корзину с карточки товара.
 *
 * Форма карточки по-прежнему шлёт action=ADD2BASKET, id и quantity — ровно
 * то, что понимает catalog.element. Но страница перехватывает запрос ДО
 * компонента: компонент после добавления молча уводит на ту же карточку,
 * и подтвердить добавление было нечем. Здесь позиция кладётся D7, в сессию
 * пишется тост, и только потом редирект. Модуль магазина недоступен —
 * запрос уходит компоненту как раньше.
 */
function gg_cart_add_handle(string $back): void
{
    $action = (string)($_REQUEST['action'] ?? '');
    if ($action !== 'ADD2BASKET' || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return;
    }
    if (!check_bitrix_sessid()) {
        LocalRedirect($back);
    }
    if (!CModule::IncludeModule('catalog') || !CModule::IncludeModule('sale')) {
        return;
    }

    $id = (int)($_REQUEST['id'] ?? 0);
    $qty = max(1, min(GG_MAX_QTY, (int)($_REQUEST['quantity'] ?? 1)));
    $live = gg_products_live([$id])[$id] ?? null;
    $kind = $live ? gg_item_kind($live) : 'request';

    if ($kind === 'request') {
        /* Позиция стала заявкой, пока карточка была открыта. */
        if (gg_request_add($id, $qty)) {
            gg_flash_toast_set(gg_toast_text('request'));
        }
        LocalRedirect($back);
    }

    try {
        $result = \Bitrix\Catalog\Product\Basket::addProduct(
            ['PRODUCT_ID' => $id, 'QUANTITY' => $qty],
            [],
            ['USE_MERGE' => 'Y']
        );
        if ($result->isSuccess()) {
            gg_flash_toast_set(gg_toast_text($kind));
        } elseif (gg_request_add($id, $qty)) {
            /* Битрикс позицию не принял — значит, её можно только заявить. */
            gg_flash_toast_set(gg_toast_text('request'));
        }
    } catch (\Throwable $e) {
        // Ничего не добавилось — возвращаем на карточку без тоста.
    }
    LocalRedirect($back);
}

/**
 * Степпер количества в серверной разметке.
 *
 * Разметку ждёт src/bitrix/qty-hydrate.js: он находит .qty[data-qty-hydrate],
 * оживляет кнопки − и +, а со значением "submit" ещё и отправляет форму —
 * так строка корзины пересчитывается сервером без кнопки «Обновить».
 * Без скрипта форма отправляется обычной кнопкой.
 */
function gg_qty_stepper(int $value, string $label, bool $submit = false, string $size = '', string $extraClass = ''): string
{
    $mode = $submit ? ' data-qty-hydrate="submit"' : ' data-qty-hydrate';
    return '<div class="qty' . ($size === 'sm' ? ' qty--sm' : '') . ($extraClass !== '' ? ' ' . $extraClass : '') . '"' . $mode
        . ' role="group" aria-label="' . gg_e($label) . '">'
        . '<button type="button" class="qty__btn" data-step="-1" aria-label="Меньше">' . gg_icon('minus') . '</button>'
        . '<input class="qty__value" type="text" inputmode="numeric" autocomplete="off" name="quantity"'
        . ' value="' . (int)$value . '" min="1" max="' . GG_MAX_QTY . '" maxlength="2"'
        . ' aria-label="' . gg_e($label) . '">'
        . '<button type="button" class="qty__btn" data-step="1" aria-label="Больше">' . gg_icon('plus') . '</button>'
        . '</div>';
}
