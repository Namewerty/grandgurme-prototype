<?php
/**
 * Что витрина показывает о товаре из выгрузки 1С: название, вес, цену, артикул.
 *
 * ПРАВИЛО ВИТРИНЫ — КАК НА grandgurme.ru. В сетке каталога у товара только
 * название, вес и цена. Весовой товар (базовая единица «кг») показывается
 * «100 г» с ценой за 100 г. В карточке над названием мелкой строкой артикул.
 * Характеристики, упаковку, коды и прочие признаки на витрину не выводим:
 * в 1С они заведены разными словами («х/к» и «Холодное копчение», «Коробка»
 * и «Банка стекло 180 г»), и показанные как есть они превращают каталог
 * в набор разнородных подписей. Характеристики появятся, когда их заведут
 * единообразно (требования — claude/trebovaniya-k-vygruzke-1c.md в проекте).
 *
 * НАЗВАНИЕ ДЛЯ ПЕЧАТИ. 1С отдаёт его в обмене полем «ПолноеНаименование»,
 * модуль обмена Битрикса кладёт его в «Описание для анонса» (PREVIEW_TEXT).
 * Рабочее наименование (NAME) собрано под склад: «Сиг Тушка г/к Вакуум фас.»;
 * название для печати — под человека: «Сиг горячего копчения». Запасной
 * вариант — рабочее наименование — только для явного брака: пусто, служебная
 * строка «<Рабочее наименование будет сформировано по шаблону>», одно слово
 * («Чай») при рабочем наименовании из трёх слов и больше.
 *
 * ВЕС. Одно правило для всех разделов: число с единицей (г, кг, мл, л,
 * «60х2 г») берётся из первого источника, где оно есть: свойство «Вес нетто»,
 * свойство «Нетто», свойство «Упаковка», название для печати, рабочее
 * наименование. Пишется всегда одинаково: «50 г», «0,5 л», «60 × 2 г».
 * Веса нет нигде — строки веса у товара нет, выдумывать её нельзя.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

/** Пробелы, пустые скобки и хвостовые пробелы из учётных строк. */
function gg_clean_text(string $value): string
{
    $value = str_replace('()', '', $value);
    $value = preg_replace('/\s+/u', ' ', $value);
    return trim((string)$value);
}

/** Название для печати годится на витрину. */
function gg_print_name_usable(string $print, string $name): bool
{
    $print = gg_clean_text($print);
    if ($print === '' || mb_strpos($print, '<') !== false || mb_stripos($print, 'будет сформировано') !== false) {
        return false;
    }
    $printWords = count(preg_split('/\s+/u', $print));
    $nameWords = count(preg_split('/\s+/u', gg_clean_text($name)));
    return !($printWords === 1 && $nameWords >= 3);
}

/** Название товара для витрины: для печати, если годится, иначе рабочее. */
function gg_display_name(string $name, ?string $print): string
{
    $print = (string)$print;
    return gg_print_name_usable($print, $name) ? gg_clean_text($print) : gg_clean_text($name);
}

/**
 * Названия для витрины по списку ID — одним запросом.
 *
 * @return array ID → название
 */
function gg_display_names_for_ids(array $ids): array
{
    $out = [];
    foreach (gg_goods_info_for_ids($ids) as $id => $info) {
        $out[$id] = $info['name'];
    }
    return $out;
}

/** Вес из строки: «Банка металл 50 г» → «50 г», «саше 60х2г» → «60 × 2 г». */
function gg_weight_from_text(string $text): string
{
    $text = str_replace(['×', '*'], 'х', $text);
    if (!preg_match('/(\d+(?:[.,]\d+)?)\s*(?:[xх]\s*(\d+(?:[.,]\d+)?)\s*)?(кг|гр|г|мл|л)(?!\p{L})/iu', $text, $m)) {
        return '';
    }
    $number = static function (string $value): string {
        $value = str_replace('.', ',', $value);
        return (string)preg_replace('/,0+$/', '', $value);
    };
    $unit = mb_strtolower($m[3]);
    if ($unit === 'гр') {
        $unit = 'г';
    }
    return ($m[2] ?? '') !== ''
        ? $number($m[1]) . ' × ' . $number($m[2]) . ' ' . $unit
        : $number($m[1]) . ' ' . $unit;
}

/**
 * Название, вес, признак весового товара и артикул по списку ID — одним запросом.
 *
 * КОРОБКИ (24.09.2026, boxes.php). Весовой товар, который продаётся
 * коробками, на витрине — стандарт, как решил Денис 23.09: «Коробка 200 г»
 * (номинал — медиана весов свободных коробок) и цена такой коробки, без «≈».
 * Тогда 'weighed' => false, а в 'box' — номинал, цена за килограмм и слово.
 *
 * @return array ID → ['name' => …, 'weight' => «50 г»|«100 г»|«Коробка 200 г»|'', 'weighed' => bool,
 *                     'article' => …, 'box' => null|['nominalG', 'pricePerKg', 'noun']]
 */
function gg_goods_info_for_ids(array $ids): array
{
    static $cache = [];
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $missing = array_values(array_diff($ids, array_keys($cache)));

    if ($missing && CModule::IncludeModule('iblock')) {
        $weighedIds = [];
        $res = CIBlockElement::GetList(
            [],
            ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $missing],
            false,
            false,
            ['ID', 'NAME', 'PREVIEW_TEXT', 'PROPERTY_VES_NETTO', 'PROPERTY_OBYEM', 'PROPERTY_UPAKOVKA',
                'PROPERTY_CML2_BASE_UNIT', 'PROPERTY_CML2_ARTICLE']
        );
        while ($row = $res->Fetch()) {
            $id = (int)$row['ID'];
            $weighed = mb_strtolower(trim((string)$row['PROPERTY_CML2_BASE_UNIT_VALUE'])) === 'кг';

            $weight = '';
            if ($weighed) {
                $weight = '100 г';
            } else {
                foreach (['PROPERTY_VES_NETTO_VALUE', 'PROPERTY_OBYEM_VALUE', 'PROPERTY_UPAKOVKA_VALUE', 'PREVIEW_TEXT', 'NAME'] as $key) {
                    $weight = gg_weight_from_text((string)($row[$key] ?? ''));
                    if ($weight !== '') {
                        break;
                    }
                }
            }

            $cache[$id] = [
                'name' => gg_display_name((string)$row['NAME'], (string)$row['PREVIEW_TEXT']),
                'weight' => $weight,
                'weighed' => $weighed,
                'article' => trim((string)$row['PROPERTY_CML2_ARTICLE_VALUE']),
                'box' => null,
            ];
            if ($weighed) {
                $weighedIds[] = $id;
            }
        }

        /* Весовой товар с коробками: стандартный вес и цена вместо «100 г».
           Кеш выше уже заполнен — gg_sale_info может спросить отсюда же. */
        if ($weighedIds && function_exists('gg_products_live')) {
            foreach (gg_products_live($weighedIds) as $id => $live) {
                $sale = $live['sale'] ?? null;
                if (!$sale || $sale['mode'] !== 'box' || !$sale['packs'] || $sale['price'] === null) {
                    continue;
                }
                $cache[$id]['weight'] = gg_box_label($sale['noun'], $sale['nominalG']);
                $cache[$id]['weighed'] = false;
                $cache[$id]['box'] = ['nominalG' => $sale['nominalG'], 'pricePerKg' => $sale['price'], 'noun' => $sale['noun']];
            }
        }
    }

    $out = [];
    foreach ($ids as $id) {
        if (isset($cache[$id])) {
            $out[$id] = $cache[$id];
        }
    }
    return $out;
}

/**
 * Цена на витрине. У весового товара цена в 1С стоит за килограмм,
 * а витрина показывает 100 г — делим на десять, как на grandgurme.ru.
 * У товара в коробках — цена коробки номинального веса, до рубля.
 *
 * $info — строка gg_goods_info_for_ids или, по-старому, признак весового.
 */
function gg_shelf_price(?float $price, $info): ?float
{
    if ($price === null) {
        return null;
    }
    if (is_array($info) && !empty($info['box'])) {
        return (float)gg_pack_price((float)$info['box']['pricePerKg'], (int)$info['box']['nominalG']);
    }
    $weighed = is_array($info) ? !empty($info['weighed']) : (bool)$info;
    return $weighed ? round($price / 10, 2) : $price;
}

/**
 * Вес в строке корзины, заявки и заказа. У весового товара количество
 * в корзине Битрикса считается килограммами, и цена строки — за килограмм,
 * поэтому здесь «1 кг», а не «100 г» витрины.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: шаг продажи весовых товаров (100 г или 1 кг) —
 * это решение весового сценария, до него корзина продаёт килограммами.
 */
function gg_line_weight(?array $goods): string
{
    if (!$goods) {
        return '';
    }
    return $goods['weighed'] ? '1 кг' : $goods['weight'];
}
