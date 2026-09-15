<?php
/**
 * Корзина и оформление: чтение sale.basket, итоги, тексты сводки, даты.
 *
 * ГРАНИЦА ТА ЖЕ, ЧТО В ПРОТОТИПЕ. В прототипе состав корзины лежал
 * в localStorage (src/js/cart/storage.js), а страницы работали через
 * store.js и не знали, откуда он берётся. Здесь вместо storage.js —
 * \Bitrix\Sale\Basket, а тексты сводки (src/js/cart/summary.js) и правила
 * дат (src/data/fulfillment.js) перенесены слово в слово.
 *
 * ПОЧЕМУ НЕ ШАБЛОН sale.basket.basket. Разметка корзины обязана совпасть
 * с прототипом до класса — стили общие. Родной компонент приносит свой
 * JS на тысячи строк и свою разметку, и переписать её дешевле один раз
 * здесь, чем чинить расхождения после каждого обновления ядра.
 *
 * НАЛИЧИЕ СТРОКИ СЧИТАЕТСЯ ПО ТЕКУЩЕМУ ОСТАТКУ ТОВАРА, а не по снимку
 * в момент добавления: между «положил в корзину» и «оформил» проходит
 * время, и обещать «доставим сегодня» по вчерашнему остатку нельзя.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';

/** Больше 99 банок за раз — это уже разговор с менеджером, а не форма. */
const GG_MAX_QTY = 99;

/* -------------------------------------------------------------------------
   Состав корзины
   ------------------------------------------------------------------------- */

/** Корзина текущего покупателя. null — модуль магазина недоступен. */
function gg_basket(): ?\Bitrix\Sale\Basket
{
    static $basket = false;
    if ($basket !== false) {
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
 * Строки корзины простыми массивами: разметка о Битриксе не знает ничего.
 *
 * Порядок — наличие выше, под заказ ниже; внутри групп порядок добавления.
 */
function gg_cart_lines(): array
{
    $basket = gg_basket();
    if (!$basket) {
        return [];
    }

    $items = [];
    foreach ($basket as $item) {
        if ($item->isDelay()) {
            continue;
        }
        $items[] = $item;
    }
    if (!$items) {
        return [];
    }

    $productIds = array_map(static fn($item) => (int)$item->getProductId(), $items);
    $props = gg_props_for_ids($productIds, ['UPAKOVKA', 'CML2_ARTICLE']);
    $elements = gg_elements_for_ids($productIds);
    $quantities = gg_quantities_for_ids($productIds);

    $lines = [];
    foreach ($items as $item) {
        $pid = (int)$item->getProductId();
        $pack = trim((string)($props[$pid]['UPAKOVKA'] ?? ''));
        $name = (string)($elements[$pid]['NAME'] ?? $item->getField('NAME'));
        $code = (string)($elements[$pid]['CODE'] ?? '');
        $price = (float)$item->getPrice();

        $lines[] = [
            'id' => (int)$item->getId(),
            'productId' => $pid,
            'code' => $code,
            'name' => gg_item_title($name, $pack),
            'note' => $pack !== '' ? $pack : trim((string)($props[$pid]['CML2_ARTICLE'] ?? '')),
            'href' => $code !== '' ? '/product/' . $code : '/catalog',
            'price' => $price > 0 ? $price : null,
            'qty' => max(1, (int)$item->getQuantity()),
            'inStock' => (float)($quantities[$pid] ?? 0) > 0,
        ];
    }

    return gg_in_stock_first($lines);
}

/** В наличии — наверх, под заказ — вниз; внутри групп порядок добавления. */
function gg_in_stock_first(array $lines): array
{
    $first = [];
    $rest = [];
    foreach ($lines as $line) {
        if (!empty($line['inStock'])) {
            $first[] = $line;
        } else {
            $rest[] = $line;
        }
    }
    return array_merge($first, $rest);
}

/**
 * Итоги.
 *   count          штук товара — «Товаров 3» в сводке и бейдж шапки;
 *   positions      строк в корзине — «2 позиции» под заголовком;
 *   sum            сумма по позициям с известной ценой;
 *   onRequestCount позиций без цены;
 *   hasPreorder    есть ли позиции под заказ;
 *   readyAt        день готовности заказа целиком (timestamp).
 */
function gg_cart_totals(array $lines): array
{
    $count = 0;
    $sum = 0.0;
    $onRequest = 0;
    $hasPreorder = false;

    foreach ($lines as $line) {
        $count += (int)$line['qty'];
        if ($line['price'] === null) {
            $onRequest++;
        } else {
            $sum += (float)$line['price'] * (int)$line['qty'];
        }
        if (empty($line['inStock'])) {
            $hasPreorder = true;
        }
    }

    return [
        'count' => $count,
        'positions' => count($lines),
        'sum' => $sum,
        'onRequestCount' => $onRequest,
        'hasPreorder' => $hasPreorder,
        'readyAt' => gg_ready_date($hasPreorder),
    ];
}

/**
 * Всё, что сводка пишет словами, одним массивом.
 *
 * Главное, что здесь решается, — корзина из одних позиций «по запросу»:
 * цен по чёрной икре в выгрузке нет, и «Сумма 0 ₽ · Итого 0 ₽ · Оформить
 * заказ» читалось бы как поломка.
 */
function gg_summary_texts(array $totals): array
{
    $allOnRequest = $totals['positions'] > 0 && $totals['onRequestCount'] === $totals['positions'];

    $note = '';
    if ($allOnRequest) {
        $note = 'Цены по всем позициям подтвердит менеджер и пришлёт итог';
    } elseif ($totals['onRequestCount'] === 1) {
        $note = 'По одной позиции цену подтвердит менеджер, итог изменится';
    } elseif ($totals['onRequestCount'] > 1) {
        $note = 'По ' . $totals['onRequestCount'] . ' позициям цену подтвердит менеджер, итог изменится';
    }

    return [
        'allOnRequest' => $allOnRequest,
        'count' => (string)$totals['count'],
        'sum' => $allOnRequest ? 'по запросу' : gg_price((float)$totals['sum']),
        'total' => $allOnRequest ? 'после подтверждения' : gg_price((float)$totals['sum']),
        'onRequest' => $totals['onRequestCount'] ? (string)$totals['onRequestCount'] : '',
        'note' => $note,
        'checkout' => $allOnRequest ? 'Отправить заказ на подтверждение' : 'Оформить заказ',
        'ready' => $totals['hasPreorder']
            ? 'Заказ будет готов ' . gg_format_ready_date($totals['readyAt'])
            : 'Соберём сегодня, доставим день в день по Москве',
    ];
}

/** «Банка стекло, 113 г · в наличии». */
function gg_line_note(array $line): string
{
    $tail = !empty($line['inStock']) ? 'в наличии' : 'под заказ · до ' . GG_PREORDER_DAYS . ' дней';
    return trim((string)$line['note']) !== '' ? $line['note'] . ' · ' . $tail : $tail;
}

/** Сумма строки. Позиция без цены суммы не имеет — и не должна её изображать. */
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
   Даты.

   ДНИ КАЛЕНДАРНЫЕ, А НЕ РАБОЧИЕ. Подпись «привезём примерно за 7 дней»
   и дата «к 21 сентября» обязаны сходиться, а производственного календаря
   с праздниками у нас нет.
   ------------------------------------------------------------------------- */

/** Начало дня — все сравнения дат идут по дню, а не по секундам. */
function gg_day_start(?int $ts = null): int
{
    $ts = $ts ?? time();
    return (int)mktime(0, 0, 0, (int)date('n', $ts), (int)date('j', $ts), (int)date('Y', $ts));
}

function gg_add_days(int $ts, int $days): int
{
    return (int)strtotime('+' . $days . ' days', gg_day_start($ts));
}

/** День готовности заказа: максимум сроков по составу от сегодня. */
function gg_ready_date(bool $hasPreorder, ?int $now = null): int
{
    return gg_add_days(gg_day_start($now), $hasPreorder ? GG_PREORDER_DAYS : 0);
}

/** «21 сентября». */
function gg_format_day_month(int $ts): string
{
    $months = [
        1 => 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return (int)date('j', $ts) . ' ' . $months[(int)date('n', $ts)];
}

/** «к 21 сентября» — так дата готовности пишется везде на сайте. */
function gg_format_ready_date(int $ts): string
{
    return 'к ' . gg_format_day_month($ts);
}

/** «пн», «вт» — для ленты дней на оформлении. */
function gg_format_weekday(int $ts): string
{
    $days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return $days[(int)date('w', $ts)];
}

/** «15 сен» — вторая строка капсулы дня. */
function gg_format_day_short(int $ts): string
{
    $months = [1 => 'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return (int)date('j', $ts) . ' ' . $months[(int)date('n', $ts)];
}

/** 2026-09-21 — так день уезжает в форму и в заказ. */
function gg_iso_day(int $ts): string
{
    return date('Y-m-d', gg_day_start($ts));
}

function gg_day_from_iso(string $value): ?int
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return null;
    }
    return (int)mktime(0, 0, 0, (int)$m[2], (int)$m[3], (int)$m[1]);
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
