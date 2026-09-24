// =============================================================================
// Коробки и партии: как сайт понял каждый товар с торговыми предложениями.
//
// ТОЛЬКО ЧТЕНИЕ. Ничего не создаёт и не меняет — ни в каталоге, ни в корзине.
//
// ЗАЧЕМ. С 24.09.2026 способ продажи товара с предложениями выбирает не код,
// а данные выгрузки (include/boxes.php в шаблоне): коробки на выбор, развес,
// штучные партии или заявка менеджеру. Выгрузку поправят — товары начнут
// продаваться правильно сами, без заливки. Этот скрипт показывает, что
// именно сайт видит сейчас, одной таблицей, без хождения по карточкам.
//
// Логика — та же самая, что на сайте: скрипт подключает файлы шаблона
// и зовёт gg_sale_info и gg_item_kind, а не повторяет их.
//
// КАК ЗАПУСКАТЬ:
//   npm run stand:php -- bitrix/install/gg-boxes-check.php
// Или: Настройки → Инструменты → Командная PHP-строка, вставить целиком.
// =============================================================================

$mode = 'check'; // check — другого режима нет

if (!defined('SITE_TEMPLATE_PATH')) {
    define('SITE_TEMPLATE_PATH', '/bitrix/templates/grandgurme');
}
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/catalog.php';

if (!CModule::IncludeModule('iblock') || !CModule::IncludeModule('catalog')) {
    echo "Модули iblock и catalog не подключены — остановлено\n";
    return;
}

$out = static function (string $line): void {
    echo $line . "\n";
};

// ---- Все товары с предложениями ---------------------------------------------

// Только каталог 1С: у демо-инфоблоков одежды свои товары с предложениями.
$ids = [];
$res = CIBlockElement::GetList([], ['IBLOCK_ID' => gg_map()['iblockId'], 'CATALOG_TYPE' => \Bitrix\Catalog\ProductTable::TYPE_SKU], false, false, ['ID']);
while ($row = $res->Fetch()) {
    $ids[] = (int)$row['ID'];
}
$out('Товаров с торговыми предложениями: ' . count($ids));
if (!$ids) {
    return;
}

$live = gg_products_live($ids);
$goods = gg_goods_info_for_ids($ids);
$sale = gg_sale_info($ids);

// Все предложения, включая те, что сайт отбросил, — для предупреждений.
$raw = [];
$lists = CCatalogSku::getOffersList($ids, gg_map()['iblockId'], ['ACTIVE' => 'Y'], ['ID', 'NAME'], []) ?: [];
$offerIds = [];
foreach ($lists as $parentId => $offers) {
    foreach ($offers as $offerId => $row) {
        $offerIds[] = (int)$offerId;
        $raw[(int)$parentId][(int)$offerId] = ['name' => (string)$row['NAME']];
    }
}
if ($offerIds) {
    $res = \Bitrix\Catalog\ProductTable::getList(['filter' => ['@ID' => $offerIds], 'select' => ['ID', 'QUANTITY']]);
    $q = [];
    while ($row = $res->fetch()) {
        $q[(int)$row['ID']] = (float)$row['QUANTITY'];
    }
    foreach ($raw as $parentId => $offers) {
        foreach ($offers as $offerId => $row) {
            $raw[$parentId][$offerId]['q'] = $q[$offerId] ?? 0.0;
        }
    }
}

$modeNames = [
    'box' => 'коробки на выбор',
    'weighed' => 'развес (остаток — сумма партии)',
    'batch' => 'штучные партии',
    'none' => 'купить нечего — заявка',
    '' => 'нет активных предложений — заявка',
];
$byMode = [];
foreach ($ids as $id) {
    $byMode[$sale[$id]['mode'] ?? ''][] = $id;
}

$out('');
foreach ($modeNames as $key => $title) {
    $out(str_pad((string)count($byMode[$key] ?? []), 4, ' ', STR_PAD_LEFT) . '  ' . $title);
}

$fmtKg = static fn(float $kg): string => rtrim(rtrim(number_format($kg, 3, ',', ''), '0'), ',');

foreach ($modeNames as $key => $title) {
    if (empty($byMode[$key])) {
        continue;
    }
    $out('');
    $out('== ' . mb_strtoupper(mb_substr($title, 0, 1)) . mb_substr($title, 1) . ' ==');
    foreach ($byMode[$key] as $id) {
        $s = $sale[$id] ?? null;
        $name = (string)($goods[$id]['name'] ?? $id);
        $kind = gg_item_kind($live[$id]);
        $kindText = ['stock' => 'в наличии', 'preorder' => 'под заказ', 'request' => 'через менеджера'][$kind];
        $line = '#' . $id . ' ' . $name . ' — ' . $kindText;

        if ($s && $s['mode'] === 'box') {
            $weights = array_column($s['packs'], 'g');
            $line .= $weights
                ? ', ' . count($weights) . ' ' . gg_box_word($s['noun'], count($weights)) . ' ' . min($weights) . '–' . max($weights) . ' г, номинал '
                    . $s['nominalG'] . ' г, на витрине «' . gg_box_label($s['noun'], $s['nominalG']) . '» за '
                    . gg_price((float)gg_pack_price((float)$s['price'], $s['nominalG']))
                : ', свободных нет';
        } elseif ($s && $s['mode'] === 'weighed') {
            $line .= ', ' . $fmtKg($s['stock']) . ' кг, продаётся килограммами';
        } elseif ($s && $s['mode'] === 'batch') {
            $line .= ', ' . count($s['offers']) . ' ' . gg_plural(count($s['offers']), 'партия', 'партии', 'партий')
                . ', ' . (int)$s['stock'] . ' шт., ' . gg_price($s['price']);
        }
        $out($line);

        // Предупреждения: что сайт отбросил и почему.
        $priced = array_flip(array_column($s['offers'] ?? [], 'id'));
        foreach (($raw[$id] ?? []) as $offerId => $offer) {
            $why = [];
            if (!isset($priced[$offerId])) {
                $why[] = 'нет цены';
            }
            if (($offer['q'] ?? 0) < 0) {
                $why[] = 'отрицательный остаток ' . $fmtKg($offer['q']);
            }
            if ($s && in_array($s['mode'], ['box', 'weighed'], true) && ($offer['q'] ?? 0) > GG_PACK_MAX_KG) {
                $why[] = 'остаток ' . $fmtKg($offer['q']) . ' — больше одной коробки';
            }
            if ($why) {
                $out('    ⚠ предложение ' . $offerId . ': ' . implode(', ', $why));
            }
        }
    }
}
