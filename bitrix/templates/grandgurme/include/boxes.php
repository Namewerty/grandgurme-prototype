<?php
/**
 * Товар с торговыми предложениями: коробки, партии, развес (24.09.2026).
 *
 * ЧТО ПРИХОДИТ ИЗ 1С. Выгрузка заводит у товара торговые предложения
 * (инфоблок 5, связь CML2_LINK) — по одному на партию. Склад лежит на
 * предложениях, у самого товара остаток ноль, а Битрикс товар с
 * предложениями в корзину не берёт вовсе: «только конкретное предложение».
 * Поэтому покупается предложение, а витрина по-прежнему показывает товар.
 * Разбор выгрузки — RAZVEDKA-korobok.md, решения прототипа — PERENOS-korobki.md.
 *
 * ЧЕТЫРЕ СПОСОБА ПРОДАЖИ, И ВЫБИРАЕТ ИХ НЕ КОД, А ДАННЫЕ. Сайт смотрит на
 * предложения каждого товара при каждой отрисовке — выгрузку поправят,
 * и товар сам начнёт продаваться правильно, без заливки:
 *
 *   box      предложения в килограммах, и у каждого остаток, похожий на
 *            вес одной коробки (больше нуля и не больше GG_PACK_MAX_KG).
 *            Одно предложение — одна коробка, её остаток — её вес, цена
 *            предложения — за килограмм. Покупатель выбирает коробку
 *            в карточке (как в прототипе); в корзину ложится предложение
 *            с количеством, равным весу коробки, — ровно то, что ждёт 1С
 *            от весового товара. Свободных коробок нет — «через менеджера»:
 *            номинала у такой позиции не знает никто, и оценить сумму
 *            коробки под заказ не из чего;
 *   weighed  предложения в килограммах, но остаток больше GG_PACK_MAX_KG —
 *            это уже не одна коробка, а сумма партии. Выбирать коробку
 *            не из чего, и позиция продаётся как остальной весовой товар
 *            сайта: килограммами, с предложения с самым большим остатком;
 *   batch    штучный товар (банки, слайсы): предложения — партии в штуках.
 *            Количество раскладывается по партиям с остатком, старшая
 *            первой; сверх остатка — на последнюю (предзаказ разрешён
 *            настройкой «покупка при отсутствии»);
 *   none     ни у одного предложения нет цены — купить нечего, позиция
 *            идёт заявкой менеджеру, как раньше.
 *
 * КОРЗИНА ХРАНИТ ПРЕДЛОЖЕНИЯ, СТРАНИЦА ПОКАЗЫВАЕТ ТОВАР. В sale.basket лежат
 * строки предложений; корзина, оформление, «Заказ принят» и кабинет
 * собирают их обратно в одну строку товара (cart.php, gg_order_lines).
 *
 * ЦЕНЫ БЕЗ КОПЕЕК, как решил Денис 23.09.2026: цена коробки округляется до
 * рубля (12 900 ₽ × 0,174 кг = 2 244,6 → 2 245 ₽). Битрикс при этом хранит
 * точную сумму по весу — её же получает 1С, — и итог заказа в админке может
 * отличаться от показанного на сайте на копейки. ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

/**
 * Больше этого — не одна коробка, а сумма партии. Самая тяжёлая единица
 * на 24.09.2026 — пласт лосося 1,486 кг, коробки — 0,14–0,72 кг.
 */
const GG_PACK_MAX_KG = 3.0;

/** Инфоблок предложений и свойство связи — у каталога они одни. */
function gg_sku_info(): ?array
{
    static $info = false;
    if ($info !== false) {
        return $info;
    }
    $info = null;
    if (CModule::IncludeModule('catalog')) {
        $row = CCatalogSku::GetInfoByProductIBlock(gg_map()['iblockId']);
        $info = $row ? $row : null;
    }
    return $info;
}

/** Единицы измерения каталога: ID → «кг», «шт». */
function gg_measure_symbols(): array
{
    static $out = null;
    if ($out !== null) {
        return $out;
    }
    $out = [];
    if (CModule::IncludeModule('catalog')) {
        $res = CCatalogMeasure::getList();
        while ($row = $res->Fetch()) {
            $out[(int)$row['ID']] = mb_strtolower(trim((string)($row['SYMBOL_RUS'] ?: $row['MEASURE_TITLE'])));
        }
    }
    return $out;
}

/**
 * Товар по предложению. ID обычного товара в ответ не попадает.
 *
 * @return array ID предложения => ID товара
 */
function gg_offer_parents(array $ids): array
{
    static $cache = [];
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $missing = array_values(array_diff($ids, array_keys($cache)));
    if ($missing) {
        foreach ($missing as $id) {
            $cache[$id] = 0;
        }
        if (CModule::IncludeModule('catalog')) {
            foreach ((CCatalogSku::getProductList($missing) ?: []) as $offerId => $row) {
                $cache[(int)$offerId] = (int)$row['ID'];
            }
        }
    }
    $out = [];
    foreach ($ids as $id) {
        if ($cache[$id] ?? 0) {
            $out[$id] = $cache[$id];
        }
    }
    return $out;
}

/**
 * Как продаётся каждый товар с предложениями. Только для товаров
 * с предложениями — остальных в ответе нет.
 *
 * @return array ID товара => [
 *   'mode'     => 'box'|'weighed'|'batch'|'none',
 *   'price'    => ?float   за кг (box, weighed) или за штуку (batch),
 *   'stock'    => float    box — свободных коробок, weighed — кг, batch — штук,
 *   'packs'    => [['id' => ID предложения, 'g' => вес, 'kg' => остаток]] по возрастанию веса (box),
 *   'nominalG' => int      номинал — медиана весов свободных коробок (box),
 *   'offers'   => [['id', 'q', 'price']] с ценой, старшие первыми,
 *   'noun'     => 'коробка'|'упаковка',
 * ]
 */
function gg_sale_info(array $parentIds): array
{
    static $cache = [];
    $parentIds = array_values(array_unique(array_filter(array_map('intval', $parentIds))));
    $missing = array_values(array_diff($parentIds, array_keys($cache)));

    if ($missing && gg_sku_info() && CModule::IncludeModule('iblock')) {
        foreach ($missing as $id) {
            $cache[$id] = null;
        }

        /* Предложения: активные, у всех товаров одним запросом. */
        $lists = CCatalogSku::getOffersList($missing, gg_map()['iblockId'], ['ACTIVE' => 'Y'], ['ID'], []) ?: [];
        $offerIds = [];
        foreach ($lists as $offers) {
            foreach ($offers as $offerId => $row) {
                $offerIds[] = (int)$offerId;
            }
        }

        $products = [];
        $prices = [];
        if ($offerIds) {
            $res = \Bitrix\Catalog\ProductTable::getList([
                'filter' => ['@ID' => $offerIds],
                'select' => ['ID', 'QUANTITY', 'MEASURE'],
            ]);
            while ($row = $res->fetch()) {
                $products[(int)$row['ID']] = $row;
            }
            $group = gg_price_group_id();
            if ($group) {
                $res = \Bitrix\Catalog\PriceTable::getList([
                    'filter' => ['@PRODUCT_ID' => $offerIds, '=CATALOG_GROUP_ID' => $group],
                    'select' => ['PRODUCT_ID', 'PRICE'],
                ]);
                while ($row = $res->fetch()) {
                    if ((float)$row['PRICE'] > 0) {
                        $prices[(int)$row['PRODUCT_ID']] = (float)$row['PRICE'];
                    }
                }
            }
        }

        /* Слово для коробки — по названию товара: «Лосось … (в коробке)»
           продаётся коробками, пласт в вакууме и корюшка — упаковками. */
        $names = [];
        $res = CIBlockElement::GetList([], ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $missing], false, false, ['ID', 'NAME', 'PREVIEW_TEXT']);
        while ($row = $res->Fetch()) {
            $names[(int)$row['ID']] = $row['NAME'] . ' ' . $row['PREVIEW_TEXT'];
        }

        $symbols = gg_measure_symbols();
        foreach ($lists as $parentId => $offers) {
            $parentId = (int)$parentId;
            $ids = array_map('intval', array_keys($offers));
            sort($ids);

            $rows = [];
            $kg = false;
            foreach ($ids as $offerId) {
                if (!isset($prices[$offerId])) {
                    continue;
                }
                $product = $products[$offerId] ?? null;
                if (($symbols[(int)($product['MEASURE'] ?? 0)] ?? '') === 'кг') {
                    $kg = true;
                }
                $rows[] = ['id' => $offerId, 'q' => (float)($product['QUANTITY'] ?? 0), 'price' => $prices[$offerId]];
            }

            $info = [
                'mode' => 'none',
                'price' => $rows ? $rows[0]['price'] : null,
                'stock' => 0.0,
                'packs' => [],
                'nominalG' => 0,
                'offers' => $rows,
                'noun' => mb_stripos((string)($names[$parentId] ?? ''), 'короб') !== false ? 'коробка' : 'упаковка',
            ];

            if ($rows && $kg) {
                $packs = [];
                $heavy = [];
                foreach ($rows as $row) {
                    if ($row['q'] > 0 && $row['q'] <= GG_PACK_MAX_KG) {
                        $packs[] = ['id' => $row['id'], 'g' => (int)round($row['q'] * 1000), 'kg' => $row['q']];
                    } elseif ($row['q'] > GG_PACK_MAX_KG) {
                        $heavy[] = $row;
                    }
                }
                if ($packs || !$heavy) {
                    usort($packs, static fn($a, $b) => $a['g'] <=> $b['g'] ?: $a['id'] <=> $b['id']);
                    $info['mode'] = 'box';
                    $info['packs'] = $packs;
                    $info['stock'] = (float)count($packs);
                    $info['nominalG'] = gg_median(array_column($packs, 'g'));
                    $info['price'] = $packs ? gg_offer_price($rows, $packs[0]['id']) : $info['price'];
                } else {
                    usort($heavy, static fn($a, $b) => $b['q'] <=> $a['q']);
                    $info['mode'] = 'weighed';
                    $info['offers'] = [$heavy[0]];
                    $info['price'] = $heavy[0]['price'];
                    $info['stock'] = array_sum(array_column($heavy, 'q'));
                }
            } elseif ($rows) {
                $info['mode'] = 'batch';
                $info['stock'] = array_sum(array_map(static fn($row) => max(0.0, $row['q']), $rows));
            }

            $cache[$parentId] = $info;
        }
    }

    $out = [];
    foreach ($parentIds as $id) {
        if (!empty($cache[$id])) {
            $out[$id] = $cache[$id];
        }
    }
    return $out;
}

/** Цена предложения из уже прочитанных строк. */
function gg_offer_price(array $rows, int $offerId): ?float
{
    foreach ($rows as $row) {
        if ($row['id'] === $offerId) {
            return $row['price'];
        }
    }
    return null;
}

/** Медиана весов — номинал коробки (median в src/data/boxes.js). */
function gg_median(array $values): int
{
    $values = array_values(array_filter($values, 'is_numeric'));
    sort($values);
    $n = count($values);
    if (!$n) {
        return 0;
    }
    $mid = intdiv($n, 2);
    return $n % 2 ? (int)$values[$mid] : (int)round(($values[$mid - 1] + $values[$mid]) / 2);
}

/** Цена коробки до рубля — packPrice в src/data/boxes.js. */
function gg_pack_price(float $pricePerKg, int $weightG): int
{
    return (int)round($pricePerKg * $weightG / 1000);
}

/**
 * n коробок, самых близких к номиналу; при равенстве — более лёгкая
 * (pickPacks в src/data/boxes.js). $exclude — ID предложений, которые брать
 * нельзя. Результат в порядке близости к номиналу: так их и добавляют,
 * чтобы при уменьшении количества уходили самые далёкие.
 */
function gg_pick_packs(array $packs, int $n, int $nominalG, array $exclude = []): array
{
    $skip = array_flip(array_map('intval', $exclude));
    $list = array_values(array_filter($packs, static fn($pack) => !isset($skip[$pack['id']])));
    usort($list, static fn($a, $b) => abs($a['g'] - $nominalG) <=> abs($b['g'] - $nominalG) ?: $a['g'] <=> $b['g']);
    return array_slice($list, 0, max(0, $n));
}

/* -------------------------------------------------------------------------
   Слова. Оба слова женского рода, поэтому остальная грамматика текстов
   прототипа («выбрать другую», «отмечено 2 из 2») у них общая.
   ------------------------------------------------------------------------- */

/** Формы слова: именительный (1, 2, 5), винительный (1, 2, 5), с большой буквы. */
function gg_box_words(string $noun): array
{
    return $noun === 'упаковка'
        ? ['nom' => ['упаковка', 'упаковки', 'упаковок'], 'acc' => ['упаковку', 'упаковки', 'упаковок'], 'title' => 'Упаковка', 'titlePlural' => 'Упаковки']
        : ['nom' => ['коробка', 'коробки', 'коробок'], 'acc' => ['коробку', 'коробки', 'коробок'], 'title' => 'Коробка', 'titlePlural' => 'Коробки'];
}

/** «коробка / коробки / коробок» по числу. */
function gg_box_word(string $noun, int $n, bool $acc = false): string
{
    $forms = gg_box_words($noun)[$acc ? 'acc' : 'nom'];
    return gg_plural($n, $forms[0], $forms[1], $forms[2]);
}

/** «204 г», «204 и 206 г», «174, 176 и 178 г» — weightsText прототипа. */
function gg_weights_text(array $weights): string
{
    $weights = array_map('intval', $weights);
    sort($weights);
    if (!$weights) {
        return '';
    }
    if (count($weights) === 1) {
        return $weights[0] . ' г';
    }
    $last = array_pop($weights);
    return implode(', ', $weights) . ' и ' . $last . ' г';
}

/** Подпись строки корзины и заказа: «Коробка 204 г», «Коробки 202 и 204 г». */
function gg_box_note(string $noun, array $weights): string
{
    $words = gg_box_words($noun);
    return (count($weights) === 1 ? $words['title'] : $words['titlePlural']) . ' ' . gg_weights_text($weights);
}

/** «Коробка 200 г» — номинал в сетке, поиске, избранном и заявке. */
function gg_box_label(string $noun, int $nominalG): string
{
    return gg_box_words($noun)['title'] . ' ' . $nominalG . ' г';
}

/**
 * Тексты селектора и окна выбора для скрипта (src/bitrix/box-hydrate.js).
 * Шаблоны — из src/data/product-copy.js и cart-copy.js прототипа, слово
 * подставлено здесь: у пласта в вакууме «упаковка», а не «коробка».
 */
function gg_box_js_copy(string $noun): array
{
    $w = gg_box_words($noun);
    return [
        'row' => $w['title'],
        'trigger' => $w['title'] . ' {weights}',
        'triggerLabel' => 'Вес: {weights}. Открыть список',
        'listLabel' => $w['titlePlural'] . ' на складе',
        'count' => 'Отмечено {k} из {n}',
        'hint' => 'Чтобы выбрать другую, снимите отметку с одной из выбранных.',
        'perBox' => 'за ' . $w['acc'][0] . ' {w} г',
        'perBoxes' => 'за {n} {word} · {weights}',
        'words' => $w['nom'],
        'wordsAcc' => $w['acc'],
        'limit' => 'На складе {n} {word}',
        'dialogLead' => '{per100} за 100 г. Отметьте {n} {word} из тех, что есть на складе.',
        'dialogCount' => 'Выбрано {k} из {n}',
        'done' => 'Готово',
        'cancel' => 'Отмена',
        'auto' => 'Подобрать автоматически',
        'pick' => 'Выбрать другие',
        'pickOne' => 'Выбрать другую',
    ];
}

/* -------------------------------------------------------------------------
   Корзина: сколько и каких предложений положить.
   ------------------------------------------------------------------------- */

/**
 * Разложить количество штучного товара по партиям: старшая первой, сколько
 * в ней есть; остаток — на последнюю (предзаказ).
 *
 * @return array ID предложения => количество
 */
function gg_batch_split(array $offers, int $qty): array
{
    $out = [];
    $left = $qty;
    foreach ($offers as $offer) {
        if ($left <= 0) {
            break;
        }
        $take = (int)min($left, max(0, floor($offer['q'])));
        if ($take > 0) {
            $out[$offer['id']] = $take;
            $left -= $take;
        }
    }
    if ($left > 0 && $offers) {
        $last = end($offers)['id'];
        $out[$last] = ($out[$last] ?? 0) + $left;
    }
    return $out;
}

/**
 * Какие коробки положить: отмеченные в карточке (если свободны и ещё не
 * в корзине), недостающие — ближайшие к номиналу. Не больше свободных.
 *
 * @return array коробки из $sale['packs']
 */
function gg_box_choose(array $sale, int $qty, array $wanted, array $taken): array
{
    $byId = [];
    foreach ($sale['packs'] as $pack) {
        $byId[$pack['id']] = $pack;
    }
    $skip = array_flip(array_map('intval', $taken));
    $out = [];
    foreach (array_map('intval', $wanted) as $id) {
        if (count($out) >= $qty) {
            break;
        }
        if (isset($byId[$id]) && !isset($skip[$id]) && !isset($out[$id])) {
            $out[$id] = $byId[$id];
        }
    }
    if (count($out) < $qty) {
        foreach (gg_pick_packs($sale['packs'], $qty - count($out), $sale['nominalG'], array_merge(array_keys($skip), array_keys($out))) as $pack) {
            $out[$pack['id']] = $pack;
        }
    }
    return array_values($out);
}

/**
 * Строки заказа, собранные по товару: предложения одного товара — одна
 * строка, как в корзине. Для «Заказ принят» и кабинета.
 *
 * $rows — [['productId', 'name', 'qty' (как в Битриксе), 'price']].
 *
 * @return array [['productId' => ID товара, 'offerIds', 'name', 'note', 'qty', 'sum', 'price', 'code']]
 */
function gg_order_lines(array $rows): array
{
    $ids = array_map(static fn($row) => (int)$row['productId'], $rows);
    $parents = gg_offer_parents($ids);
    $all = array_values(array_unique(array_merge($ids, array_values($parents))));
    $goods = gg_goods_info_for_ids($all);
    $elements = gg_elements_for_ids($all);
    $sale = gg_sale_info(array_values($parents));

    $lines = [];
    foreach ($rows as $row) {
        $pid = (int)$row['productId'];
        $parent = $parents[$pid] ?? 0;
        $key = $parent ? 'p' . $parent : 'i' . count($lines);
        $owner = $parent ?: $pid;
        $q = (float)$row['qty'];
        $price = (float)$row['price'];
        /* Коробка ли это, решает количество, а не нынешний способ продажи:
           заказ живёт дольше склада. Дробное количество в килограммах — это
           вес одной коробки (так её кладёт корзина). */
        $mode = $sale[$parent]['mode'] ?? 'none';
        $isPack = $parent && ($mode === 'box' || ($mode !== 'batch' && abs($q - round($q)) > 0.0001));

        if (!isset($lines[$key])) {
            $code = (string)($elements[$owner]['CODE'] ?? '');
            $lines[$key] = [
                'productId' => $owner,
                'offerIds' => [],
                'code' => $code,
                'name' => (string)($goods[$owner]['name'] ?? ($elements[$owner]['NAME'] ?? $row['name'])),
                'note' => gg_line_weight($goods[$owner] ?? null),
                'qty' => 0,
                'sum' => 0.0,
                'price' => $price > 0 ? $price : null,
                'weights' => [],
                'noun' => $sale[$parent]['noun'] ?? 'коробка',
                'pack' => $isPack,
            ];
        }
        $lines[$key]['offerIds'][] = $pid;
        if ($isPack) {
            $g = (int)round($q * 1000);
            $lines[$key]['weights'][] = $g;
            $lines[$key]['qty'] += 1;
            $lines[$key]['sum'] += gg_pack_price($price, $g);
        } else {
            $lines[$key]['qty'] += max(1, (int)round($q));
            $lines[$key]['sum'] += $price * $q;
        }
    }

    foreach ($lines as &$line) {
        if ($line['pack'] && $line['weights']) {
            $line['note'] = gg_box_note($line['noun'], $line['weights']);
        }
    }
    unset($line);
    return array_values($lines);
}
