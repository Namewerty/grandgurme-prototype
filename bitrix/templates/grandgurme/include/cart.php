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
 * ТОВАР С ПРЕДЛОЖЕНИЯМИ (24.09.2026, boxes.php). В корзине Битрикса лежат
 * предложения — коробки, партии, развес, — а строка корзины одна на товар:
 * gg_basket_lines собирает предложения обратно. Такая строка адресуется
 * не ID строки Битрикса, а 'p<ID товара>', и её количество — у коробок
 * число коробок, у партий — штуки по всем партиям. Сколько и каких
 * предложений положить, решает gg_basket_put.
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
 *
 * Предложения одного товара — одна строка (boxes.php):
 *   'id'        'p<ID товара>' — адрес строки в формах корзины;
 *   'items'     ID строк Битрикса, по возрастанию — в порядке добавления;
 *   'basketProductIds' — ID предложений: по ним заказ раскладывается по
 *               отгрузкам;
 *   'box'       у коробок: выбранные коробки, свободные коробки товара
 *               и всё, что нужно окну «Выбрать другие».
 * Обычный товар — строка на строку Битрикса, 'id' — её ID, как раньше.
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
    usort($items, static fn($a, $b) => (int)$a->getId() <=> (int)$b->getId());

    $basketIds = array_map(static fn($item) => (int)$item->getProductId(), $items);
    $parents = gg_offer_parents($basketIds);
    $productIds = array_values(array_unique(array_map(static fn($id) => $parents[$id] ?? $id, $basketIds)));
    $props = gg_props_for_ids($productIds, ['UPAKOVKA', 'CML2_ARTICLE']);
    $elements = gg_elements_for_ids($productIds);
    $live = gg_products_live($productIds);
    /* Название для печати и вес — как в каталоге и карточке (product-info.php). */
    $goods = gg_goods_info_for_ids($productIds);

    $lines = [];
    foreach ($items as $item) {
        $basketId = (int)$item->getProductId();
        $pid = $parents[$basketId] ?? $basketId;
        $key = isset($parents[$basketId]) ? 'p' . $pid : (string)(int)$item->getId();
        $data = $live[$pid] ?? ['id' => $pid, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];
        $sale = $data['sale'] ?? null;
        $price = (float)$item->getPrice();
        $q = (float)$item->getQuantity();

        if (!isset($lines[$key])) {
            $name = (string)($goods[$pid]['name'] ?? ($elements[$pid]['NAME'] ?? $item->getField('NAME')));
            $code = (string)($elements[$pid]['CODE'] ?? '');
            $lines[$key] = [
                'id' => $key,
                'productId' => $pid,
                'items' => [],
                'basketProductIds' => [],
                'code' => $code,
                'name' => $name,
                'note' => gg_line_weight($goods[$pid] ?? null),
                'article' => trim((string)($props[$pid]['CML2_ARTICLE'] ?? '')),
                'href' => $code !== '' ? '/product/' . $code : '/catalog',
                'price' => $price > 0 ? $price : null,
                'qty' => 0,
                'sum' => 0.0,
                'max' => GG_MAX_QTY,
                'kind' => gg_item_kind($data),
                'box' => null,
            ];
            if ($sale && $sale['mode'] === 'box') {
                $lines[$key]['box'] = [
                    'noun' => $sale['noun'],
                    'nominalG' => $sale['nominalG'],
                    'pricePerKg' => $price > 0 ? $price : (float)$sale['price'],
                    'packIds' => [],
                    'weights' => [],
                    'free' => array_map(static fn($pack) => ['id' => (string)$pack['id'], 'weightG' => $pack['g']], $sale['packs']),
                ];
                $lines[$key]['max'] = count($sale['packs']);
            }
        }

        $line = &$lines[$key];
        $line['items'][] = (int)$item->getId();
        $line['basketProductIds'][] = $basketId;
        if ($line['box'] !== null) {
            /* Коробка: количество строки Битрикса — её вес в килограммах. */
            $g = (int)round($q * 1000);
            $line['box']['packIds'][] = (string)$basketId;
            $line['box']['weights'][] = $g;
            $line['qty'] += 1;
            $line['sum'] += gg_pack_price((float)$line['box']['pricePerKg'], $g);
        } else {
            $line['qty'] += max(1, (int)round($q));
            $line['sum'] += $price * max(1, (int)round($q));
        }
        unset($line);
    }

    foreach ($lines as &$line) {
        if ($line['box'] !== null) {
            $line['note'] = gg_box_note($line['box']['noun'], $line['box']['weights']);
            $line['max'] = max($line['max'], $line['qty']);
        }
    }
    unset($line);
    return array_values($lines);
}

/** Строка корзины по адресу из формы: ID строки Битрикса или 'p<ID товара>'. */
function gg_basket_line(string $id): ?array
{
    foreach (gg_basket_lines() as $line) {
        if ((string)$line['id'] === $id) {
            return $line;
        }
    }
    return null;
}

/** Убрать строки Битрикса по ID. Корзину сохраняет вызывающий. */
function gg_basket_delete(array $itemIds): void
{
    $basket = gg_basket();
    if (!$basket) {
        return;
    }
    foreach ($itemIds as $itemId) {
        $item = $basket->getItemById((int)$itemId);
        if ($item) {
            $item->delete();
        }
    }
}

/**
 * Положить товар в корзину Битрикса — предложениями, если они у него есть.
 *
 *   обычный товар — как раньше, строкой товара;
 *   коробки       — отмеченные в карточке ($packIds), недостающие ближайшие
 *                   к номиналу; каждая коробка — строка предложения
 *                   с количеством, равным её весу. Больше свободных не
 *                   кладётся: 'limit' — текст тоста о пределе;
 *   развес        — килограммы на предложение с самым большим остатком;
 *   партии        — штуки по партиям, старшая первой (gg_batch_split).
 *
 * @return array{ok: bool, added: int, limit: string}
 */
function gg_basket_put(int $id, int $qty, array $packIds = []): array
{
    $qty = max(1, min(GG_MAX_QTY, $qty));
    $fail = ['ok' => false, 'added' => 0, 'limit' => ''];
    if ($id <= 0 || !CModule::IncludeModule('catalog') || !CModule::IncludeModule('sale')) {
        return $fail;
    }

    $live = gg_products_live([$id])[$id] ?? null;
    $sale = $live['sale'] ?? null;
    $add = static function (int $productId, float $quantity, bool $merge): bool {
        try {
            $result = \Bitrix\Catalog\Product\Basket::addProduct(
                ['PRODUCT_ID' => $productId, 'QUANTITY' => $quantity],
                [],
                ['USE_MERGE' => $merge ? 'Y' : 'N']
            );
            return $result->isSuccess();
        } catch (\Throwable $e) {
            return false;
        }
    };

    if (!$live || !$live['sku']) {
        $ok = $add($id, $qty, true);
        gg_basket(true);
        return ['ok' => $ok, 'added' => $ok ? $qty : 0, 'limit' => ''];
    }
    if (!$sale || $sale['mode'] === 'none') {
        return $fail;
    }

    /* Что от этого товара уже лежит в корзине: ID предложения => количество. */
    $inBasket = [];
    foreach ((gg_basket() ?: []) as $item) {
        if (!$item->isDelay()) {
            $inBasket[(int)$item->getProductId()] = ($inBasket[(int)$item->getProductId()] ?? 0) + (float)$item->getQuantity();
        }
    }

    $added = 0;
    $limit = '';
    if ($sale['mode'] === 'box') {
        $offerIds = array_column($sale['offers'], 'id');
        $taken = array_values(array_filter(array_keys($inBasket), static fn($offerId) => in_array($offerId, $offerIds, true)));
        $chosen = gg_box_choose($sale, $qty, $packIds, $taken);
        foreach ($chosen as $pack) {
            if ($add($pack['id'], $pack['kg'], false)) {
                $added++;
            }
        }
        if ($added < $qty) {
            $n = count($sale['packs']);
            $limit = 'На складе ' . $n . ' ' . gg_box_word($sale['noun'], $n) . ', больше положить нельзя';
        }
    } elseif ($sale['mode'] === 'weighed') {
        $added = $add($sale['offers'][0]['id'], $qty, true) ? $qty : 0;
    } else {
        /* Партии: остаток каждой — минус то, что уже лежит в корзине. */
        $offers = array_map(static function ($offer) use ($inBasket) {
            $offer['q'] = max(0.0, $offer['q'] - ($inBasket[$offer['id']] ?? 0));
            return $offer;
        }, $sale['offers']);
        foreach (gg_batch_split($offers, $qty) as $offerId => $n) {
            if ($add((int)$offerId, $n, true)) {
                $added += $n;
            }
        }
    }

    gg_basket(true);
    return ['ok' => $added > 0, 'added' => $added, 'limit' => $limit];
}

/**
 * Количество строки товара с предложениями. Коробки: меньше — уходят
 * последние добавленные, больше — докладываются ближайшие к номиналу.
 * Партии и развес раскладываются заново.
 */
function gg_basket_line_set_qty(array $line, int $qty): void
{
    $basket = gg_basket();
    if (!$basket) {
        return;
    }
    $qty = max(0, min(GG_MAX_QTY, $qty));
    if ($line['box'] !== null) {
        $have = count($line['items']);
        if ($qty < $have) {
            gg_basket_delete(array_slice($line['items'], $qty));
            $basket->save();
            gg_basket(true);
        } elseif ($qty > $have) {
            gg_basket_put((int)$line['productId'], $qty - $have);
        }
        return;
    }
    gg_basket_delete($line['items']);
    $basket->save();
    gg_basket(true);
    if ($qty > 0) {
        gg_basket_put((int)$line['productId'], $qty);
    }
}

/**
 * Другие коробки из окна «Выбрать другие»: строка становится ровно этим
 * набором. Коробки, которых уже нет среди свободных, не кладутся;
 * недостающие до прежнего количества подбирает gg_basket_put.
 */
function gg_basket_line_set_packs(array $line, array $packIds): void
{
    $basket = gg_basket();
    if (!$basket || $line['box'] === null) {
        return;
    }
    $free = array_flip(array_map(static fn($pack) => (int)$pack['id'], $line['box']['free']));
    $want = [];
    foreach ($packIds as $packId) {
        $packId = (int)$packId;
        if (isset($free[$packId]) && !in_array($packId, $want, true)) {
            $want[] = $packId;
        }
    }
    $want = array_slice($want, 0, count($line['items']));
    if (!$want) {
        return;
    }

    $keep = [];
    $drop = [];
    foreach ($line['items'] as $i => $itemId) {
        $offerId = (int)$line['box']['packIds'][$i];
        if (in_array($offerId, $want, true)) {
            $keep[] = $offerId;
        } else {
            $drop[] = $itemId;
        }
    }
    gg_basket_delete($drop);
    $basket->save();
    gg_basket(true);

    $new = array_values(array_diff($want, $keep));
    $missing = count($line['items']) - count($want);
    if ($new || $missing > 0) {
        gg_basket_put((int)$line['productId'], count($new) + max(0, $missing), $new);
    }
}

/**
 * Хранилище следует за видом. Возвращает уведомления для строки над группами.
 *
 * Позиция корзины, ставшая заявкой, уходит из корзины Битрикса в cookie.
 * Позиция заявки, которую снова можно купить, кладётся в корзину; не принял
 * Битрикс — остаётся в заявке молча. Запускается один раз за хит.
 *
 * КОРОБКИ (24.09.2026). Выбранную коробку могли купить, пока она лежала
 * в корзине: резерв у Битрикса появляется только с заказом. Такая коробка
 * меняется на ближайшую к номиналу из свободных, об этом — уведомление;
 * свободных нет — коробка уходит из корзины. Оформление по этим
 * уведомлениям (gg_box_notices) заказ не отправляет, а просит проверить
 * сумму — как проверка перед отправкой в прототипе.
 */
function gg_cart_sync(): array
{
    static $notices = null;
    if ($notices !== null) {
        return $notices;
    }
    $notices = [];

    $basket = gg_basket();

    /* Коробки, которых больше нет среди свободных. */
    if ($basket) {
        $changed = false;
        foreach (gg_basket_lines() as $line) {
            if ($line['box'] === null) {
                continue;
            }
            $free = [];
            foreach ($line['box']['free'] as $pack) {
                $free[(int)$pack['id']] = (int)$pack['weightG'];
            }
            foreach ($line['items'] as $i => $itemId) {
                $offerId = (int)$line['box']['packIds'][$i];
                $oldG = (int)$line['box']['weights'][$i];
                $item = $basket->getItemById($itemId);
                if (!$item) {
                    continue;
                }
                if (isset($free[$offerId])) {
                    /* Коробку перевесили в 1С — количество следует за весом. */
                    if ($free[$offerId] !== $oldG) {
                        $item->setField('QUANTITY', $free[$offerId] / 1000);
                        $changed = true;
                    }
                    continue;
                }
                $item->delete();
                $changed = true;
                $inLine = array_map('intval', $line['box']['packIds']);
                $packs = array_map(static fn($pack) => ['id' => (int)$pack['id'], 'g' => (int)$pack['weightG'], 'kg' => $pack['weightG'] / 1000], $line['box']['free']);
                $next = gg_pick_packs($packs, 1, (int)$line['box']['nominalG'], $inLine)[0] ?? null;
                $word = gg_box_words($line['box']['noun']);
                if ($next) {
                    $basket->save();
                    gg_basket_put((int)$line['productId'], 1, [$next['id']]);
                    $basket = gg_basket();
                    gg_box_notices(gg_ucfirst($word['acc'][0]) . ' ' . $oldG . ' г («' . $line['name'] . '») только что купили. Положили '
                        . $next['g'] . ' г — ' . gg_price((float)gg_pack_price((float)$line['box']['pricePerKg'], $next['g'])) . '.');
                } else {
                    gg_box_notices($word['titlePlural'] . ' «' . $line['name'] . '» закончились — убрали из корзины.');
                }
            }
        }
        if ($changed) {
            $basket->save();
            gg_basket(true);
            $basket = gg_basket();
        }
        $notices = array_merge($notices, gg_box_notices());
    }

    $toRequest = array_filter(gg_basket_lines(), static fn($line) => $line['kind'] === 'request');
    if ($basket && $toRequest) {
        $list = gg_request_list();
        foreach ($toRequest as $line) {
            gg_basket_delete($line['items']);
            $list[$line['productId']] = min(GG_MAX_QTY, ($list[$line['productId']] ?? 0) + (int)$line['qty']);
            $notices[] = '«' . $line['name'] . '» закончилась на складе — перенесли в заявку менеджеру';
        }
        $basket->save();
        gg_request_save($list);
        gg_basket(true);
    }

    $toOrder = array_filter(gg_request_lines(), static fn($line) => gg_item_kind($line['live']) !== 'request');
    if ($toOrder && CModule::IncludeModule('catalog') && CModule::IncludeModule('sale')) {
        foreach ($toOrder as $line) {
            $result = gg_basket_put((int)$line['productId'], (int)$line['qty']);
            if ($result['ok']) {
                gg_request_remove((int)$line['productId']);
                $notices[] = '«' . $line['name'] . '» снова можно заказать — перенесли в заказ';
            }
        }
    }

    return $notices;
}

/**
 * Уведомления о коробках, которые купили, пока они лежали в корзине.
 * С аргументом — добавить, без — прочитать. Живут до конца хита.
 */
function gg_box_notices(?string $add = null): array
{
    static $list = [];
    if ($add !== null) {
        $list[] = $add;
    }
    return $list;
}

/** «коробку» → «Коробку»: mb_ucfirst есть только с PHP 8.4. */
function gg_ucfirst(string $text): string
{
    return mb_strtoupper(mb_substr($text, 0, 1)) . mb_substr($text, 1);
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
        'boxNotices' => gg_box_notices(),
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
        $sum += (float)($line['sum'] ?? (float)$line['price'] * (int)$line['qty']);
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
    if ($line['price'] === null) {
        return 'Цена по запросу';
    }
    return gg_price((float)($line['sum'] ?? (float)$line['price'] * (int)$line['qty']));
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

    $lineId = (string)($_POST['line'] ?? '');
    $line = $lineId !== '' ? gg_basket_line($lineId) : null;

    /* Удаление приходит своим полем, а не значением gg_action: у строки
       одна форма на количество и на крестик, и два одноимённых поля в ней
       разбирались бы по порядку в теле запроса — то есть как повезёт. */
    if (isset($_POST['gg_remove'])) {
        $action = 'remove';
    }

    if ($line) {
        if ($action === 'remove') {
            gg_basket_delete($line['items']);
            $basket->save();
        } elseif ($action === 'qty') {
            $qty = (int)($_POST['quantity'] ?? 0);
            if (strncmp($lineId, 'p', 1) === 0) {
                /* Строка товара с предложениями — своя раскладка (boxes.php). */
                gg_basket_line_set_qty($line, $qty);
            } else {
                $item = $basket->getItemById((int)$line['items'][0]);
                if ($item && $qty <= 0) {
                    $item->delete();
                } elseif ($item) {
                    $item->setField('QUANTITY', min(GG_MAX_QTY, $qty));
                }
                $basket->save();
            }
        } elseif ($action === 'packs') {
            /* «Выбрать другие» — окно выбора коробок (src/bitrix/box-hydrate.js). */
            $packs = $_POST['packs'] ?? [];
            gg_basket_line_set_packs($line, is_array($packs) ? $packs : []);
        }
    }

    LocalRedirect($back);
}

/**
 * Положить позицию туда, куда её пускает вид: «в наличии» и «под заказ» —
 * в корзину Битрикса, «по заявке» — в заявку менеджеру (cookie).
 *
 * Одна функция на все кнопки: форма карточки товара (gg_cart_add_handle)
 * и кнопка в углу кадра сетки (gg_cart_quick_add_handle). Вид считается
 * по живым данным в момент нажатия: позиция могла кончиться, пока открыта
 * страница, и тогда она уходит в заявку, а не молча пропадает.
 *
 * @return array{ok: bool, kind: string, toast: string}
 */
function gg_cart_put(int $id, int $qty = 1, array $packIds = []): array
{
    $qty = max(1, min(GG_MAX_QTY, $qty));
    $fail = ['ok' => false, 'kind' => '', 'toast' => ''];
    if ($id <= 0 || !CModule::IncludeModule('catalog') || !CModule::IncludeModule('sale')) {
        return $fail;
    }

    $live = gg_products_live([$id])[$id] ?? null;
    $kind = $live ? gg_item_kind($live) : 'request';

    if ($kind !== 'request') {
        $result = gg_basket_put($id, $qty, $packIds);
        if ($result['ok']) {
            return ['ok' => true, 'kind' => $kind, 'toast' => $result['limit'] !== '' ? $result['limit'] : gg_toast_text($kind)];
        }
        /* Все свободные коробки уже в корзине — это предел, а не заявка. */
        if ($result['limit'] !== '') {
            return ['ok' => true, 'kind' => $kind, 'toast' => $result['limit']];
        }
        /* Битрикс позицию не принял — значит, её можно только заявить. */
    }

    if (gg_request_add($id, $qty)) {
        return ['ok' => true, 'kind' => 'request', 'toast' => gg_toast_text('request')];
    }
    return $fail;
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

    /* Коробки, отмеченные в карточке: packs[] — ID предложений. */
    $packs = $_REQUEST['packs'] ?? [];
    $result = gg_cart_put((int)($_REQUEST['id'] ?? 0), (int)($_REQUEST['quantity'] ?? 1), is_array($packs) ? $packs : [$packs]);
    if ($result['ok']) {
        gg_flash_toast_set($result['toast']);
    }
    LocalRedirect($back);
}

/* -------------------------------------------------------------------------
   «В корзину» из сетки (22.09.2026)

   Кнопка в углу кадра, как в прототипе (product__add в
   src/js/components/product-card.js): каталог, поиск, избранное. Это
   маленькая форма с POST — без скрипта она работает редиректом на ту же
   страницу и тостом, со скриптом (src/bitrix/catalog-hydrate.js) уходит
   запросом с gg_cart_ajax=Y, и страница не перезагружается: тост и число
   в шапке обновляются на месте.

   Обработчик стоит в header.php рядом с сердцем: сетки есть на многих
   страницах, и у каждой свой обработчик POST, который ничего о кнопке
   не знает.
   ------------------------------------------------------------------------- */

/** Кнопка «в корзину» / «в заявку» для кадра карточки в сетке. */
function gg_cart_add_button(int $id, string $kind, string $name): string
{
    $label = ($kind === 'request' ? 'В заявку' : 'В корзину') . ': ' . $name;
    return '<form class="cart-add" method="post" action="' . gg_e(gg_fav_back_url()) . '">'
        . bitrix_sessid_post()
        . '<input type="hidden" name="gg_cart_add" value="Y">'
        . '<input type="hidden" name="id" value="' . $id . '">'
        . '<button type="submit" class="product__add" data-cart-add="' . $id . '" aria-label="' . gg_e($label) . '">'
        . gg_icon('cart')
        . '</button>'
        . '</form>';
}

/**
 * POST кнопки из сетки. Вызывается в header.php до вывода: отвечает
 * JSON (скрипт) или редиректом на ту же страницу (обычная форма).
 *
 * JSON отдаётся с \CMain::FinalActions(), как sendJsonAnswer родных
 * компонентов каталога: у нового гостя корзина заводит покупателя
 * (Fuser) и ставит его cookie, а cookie Битрикса уходят только на
 * завершении хита. Голый die() оставил бы товар в корзине, которую
 * браузер не узнает.
 */
function gg_cart_quick_add_handle(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_POST['gg_cart_add'] ?? '') !== 'Y') {
        return;
    }
    $ajax = ($_POST['gg_cart_ajax'] ?? '') === 'Y';
    $back = gg_fav_back_url();

    $result = check_bitrix_sessid()
        ? gg_cart_put((int)($_POST['id'] ?? 0), (int)($_POST['quantity'] ?? 1))
        : ['ok' => false, 'kind' => '', 'toast' => ''];

    if ($ajax) {
        global $APPLICATION;
        if ($APPLICATION instanceof CMain) {
            $APPLICATION->RestartBuffer();
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($result + ['count' => gg_cart_count(), 'href' => '/cart/'], JSON_UNESCAPED_UNICODE);
        \CMain::FinalActions();
        die();
    }

    if ($result['ok']) {
        gg_flash_toast_set($result['toast']);
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
function gg_qty_stepper(int $value, string $label, bool $submit = false, string $size = '', string $extraClass = '', int $max = GG_MAX_QTY): string
{
    $mode = $submit ? ' data-qty-hydrate="submit"' : ' data-qty-hydrate';
    return '<div class="qty' . ($size === 'sm' ? ' qty--sm' : '') . ($extraClass !== '' ? ' ' . $extraClass : '') . '"' . $mode
        . ' role="group" aria-label="' . gg_e($label) . '">'
        . '<button type="button" class="qty__btn" data-step="-1" aria-label="Меньше">' . gg_icon('minus') . '</button>'
        . '<input class="qty__value" type="text" inputmode="numeric" autocomplete="off" name="quantity"'
        . ' value="' . (int)$value . '" min="1" max="' . max(1, min(GG_MAX_QTY, $max)) . '" maxlength="2"'
        . ' aria-label="' . gg_e($label) . '">'
        . '<button type="button" class="qty__btn" data-step="1" aria-label="Больше">' . gg_icon('plus') . '</button>'
        . '</div>';
}
