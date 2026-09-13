<?php
/**
 * Витрина каталога: разбор адреса, фильтры, счётчики.
 *
 * ЧТО ЗДЕСЬ ЛЕЖИТ И ЧЕГО ЗДЕСЬ НЕТ.
 * Здесь только логика выборки: какой раздел 1С показать под адресом витрины,
 * как превратить ?sub=beluga в фильтр по свойству и сколько товаров в разделе.
 * Разметка живёт в шаблонах компонентов, тексты — в карте витрины.
 *
 * ПОЧЕМУ НЕ SEF КОМПЛЕКСНОГО КОМПОНЕНТА. Адрес раздела витрины
 * (/catalog/chernaya-ikra) и символьный код раздела 1С (ikra_chernaya)
 * — разные строки, и так и задумано: учётное дерево собрано под товароведа.
 * Комплексный bitrix:catalog умеет разбирать только собственные коды,
 * поэтому адрес разбираем сами по карте витрины, а дальше зовём родные
 * catalog.section и catalog.element с готовым SECTION_ID и фильтром.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/fn.php';

/** Категория витрины по слагу. */
function gg_catalog_category(string $slug): ?array
{
    foreach (gg_map()['categories'] as $cat) {
        if ($cat['slug'] === $slug) {
            return $cat;
        }
    }
    return null;
}

/** Оси фильтра раздела. Их может не быть вовсе — это нормально. */
function gg_catalog_facets(array $cat): array
{
    return $cat['facets'] ?? [];
}

/**
 * Значение оси, выбранное адресом.
 *
 * Мега-панель в шапке умеет только ?sub=…: все восемь карточек чёрной икры
 * ведут одним параметром. Поэтому sub принимается как общий вход и
 * раскладывается по осям — фасовка из панели попадёт в ось фасовки,
 * а не останется неузнанной.
 */
function gg_catalog_selected(array $cat): array
{
    $picked = [];
    $sub = isset($_GET['sub']) ? (string)$_GET['sub'] : '';

    foreach (gg_catalog_facets($cat) as $facet) {
        $key = $facet['key'];
        $value = isset($_GET[$key]) ? (string)$_GET[$key] : '';

        if ($value === '' && $sub !== '') {
            foreach ($facet['options'] as $option) {
                if ($option['slug'] === $sub) {
                    $value = $sub;
                    break;
                }
            }
        }

        $picked[$key] = '';
        foreach ($facet['options'] as $option) {
            if ($option['slug'] === $value) {
                $picked[$key] = $value;
                break;
            }
        }
    }
    return $picked;
}

/**
 * ID значений списочного свойства по их текстам.
 *
 * Фильтровать список по строке (PROPERTY_RYBA_VALUE) Битрикс умеет не везде
 * одинаково, а по ID значения — везде. Один запрос на свойство за хит.
 */
function gg_prop_enum_ids(string $code, array $values): array
{
    static $cache = [];

    if (!isset($cache[$code])) {
        $cache[$code] = [];
        if (CModule::IncludeModule('iblock')) {
            $res = CIBlockPropertyEnum::GetList(
                ['SORT' => 'ASC'],
                ['IBLOCK_ID' => gg_map()['iblockId'], 'CODE' => $code]
            );
            while ($row = $res->Fetch()) {
                $cache[$code][$row['VALUE']] = (int)$row['ID'];
            }
        }
    }

    $ids = [];
    foreach ($values as $value) {
        if (isset($cache[$code][$value])) {
            $ids[] = $cache[$code][$value];
        }
    }
    return $ids;
}

/**
 * Фильтр элементов для раздела витрины.
 *
 * Раздел витрины — это раздел (или несколько разделов) 1С плюс, если так
 * решено в карте, отдельные позиции по ID. Паюсная икра у «Гранд Гурмэ»
 * лежит не в «Икре чёрной», а в корне инфоблока: в учёте это править нельзя,
 * на витрине показать нужно.
 */
function gg_catalog_filter(array $cat, array $picked = []): array
{
    $sections = array_map('intval', $cat['sections']);
    $extra = array_map('intval', $cat['extraElements'] ?? []);

    $filter = ['ACTIVE' => 'Y'];

    if ($extra) {
        $filter[] = [
            'LOGIC' => 'OR',
            ['SECTION_ID' => $sections, 'INCLUDE_SUBSECTIONS' => 'Y'],
            ['ID' => $extra],
        ];
    } else {
        $filter['SECTION_ID'] = $sections;
        $filter['INCLUDE_SUBSECTIONS'] = 'Y';
    }

    foreach (gg_catalog_facets($cat) as $facet) {
        $slug = $picked[$facet['key']] ?? '';
        if ($slug === '') {
            continue;
        }
        foreach ($facet['options'] as $option) {
            if ($option['slug'] !== $slug) {
                continue;
            }
            $ids = gg_prop_enum_ids($facet['prop'], $option['values']);
            /* Значения нет в справочнике — показываем пустую выдачу, а не весь
               раздел: молча снятый фильтр хуже честного «ничего не нашлось». */
            $filter['PROPERTY_' . $facet['prop']] = $ids ?: [-1];
        }
    }

    return $filter;
}

/** Сколько активных товаров попадает под фильтр. Запрос только на счёт. */
function gg_catalog_count(array $cat, array $picked = []): int
{
    static $cache = [];
    $key = $cat['slug'] . '|' . implode(',', $picked);
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    if (!CModule::IncludeModule('iblock')) {
        return 0;
    }
    $filter = gg_catalog_filter($cat, $picked);
    $filter['IBLOCK_ID'] = gg_map()['iblockId'];
    $cache[$key] = (int)CIBlockElement::GetList([], $filter, []);
    return $cache[$key];
}

/** Сколько активных товаров в разделе витрины без учёта фильтров. */
function gg_catalog_total(array $cat): int
{
    return gg_catalog_count($cat, []);
}

/** Адрес раздела с заданным набором осей. Пустое значение убирает ось. */
function gg_catalog_url(array $cat, array $picked, string $key = '', string $value = ''): string
{
    $query = [];
    foreach (gg_catalog_facets($cat) as $facet) {
        $current = $picked[$facet['key']] ?? '';
        if ($facet['key'] === $key) {
            $current = $value;
        }
        if ($current !== '') {
            $query[$facet['key']] = $current;
        }
    }
    if (!empty($_GET['sort'])) {
        $query['sort'] = (string)$_GET['sort'];
    }
    $url = gg_category_url($cat['slug']);
    return $query ? $url . '?' . http_build_query($query) : $url;
}

/** Сортировки раздела. Ключи совпадают с прототипом. */
function gg_catalog_sorts(): array
{
    return [
        'alpha' => ['label' => 'По алфавиту', 'field' => 'NAME', 'order' => 'ASC'],
        'price_asc' => ['label' => 'Сначала дешевле', 'field' => 'CATALOG_PRICE_2', 'order' => 'ASC'],
        'price_desc' => ['label' => 'Сначала дороже', 'field' => 'CATALOG_PRICE_2', 'order' => 'DESC'],
    ];
}

function gg_catalog_sort_key(): string
{
    $key = isset($_GET['sort']) ? (string)$_GET['sort'] : '';
    return isset(gg_catalog_sorts()[$key]) ? $key : 'alpha';
}

/** Адрес раздела с другой сортировкой, оси сохраняются. */
function gg_catalog_sort_url(array $cat, array $picked, string $sortKey): string
{
    $query = [];
    foreach (gg_catalog_facets($cat) as $facet) {
        $current = $picked[$facet['key']] ?? '';
        if ($current !== '') {
            $query[$facet['key']] = $current;
        }
    }
    if ($sortKey !== 'alpha') {
        $query['sort'] = $sortKey;
    }
    $url = gg_category_url($cat['slug']);
    return $query ? $url . '?' . http_build_query($query) : $url;
}

/** Склонение: 1 товар, 2 товара, 5 товаров. */
function gg_plural_goods(int $n): string
{
    $ten = $n % 100;
    $one = $n % 10;
    if ($ten > 10 && $ten < 20) {
        return $n . ' товаров';
    }
    if ($one === 1) {
        return $n . ' товар';
    }
    if ($one >= 2 && $one <= 4) {
        return $n . ' товара';
    }
    return $n . ' товаров';
}

/** Цена в формате прототипа: пробелы разрядов и рубль. */
function gg_price(?float $value): string
{
    if ($value === null) {
        return 'Цена по запросу';
    }
    $whole = round($value, 2);
    $decimals = (abs($whole - round($whole)) > 0.001) ? 2 : 0;
    return number_format($whole, $decimals, ',', ' ') . ' ₽';
}

/** Слаг товара для адреса /product/<slug>. */
function gg_product_url(array $item): string
{
    $code = (string)($item['CODE'] ?? '');
    return '/product/' . ($code !== '' ? $code : (int)$item['ID']);
}

/* -------------------------------------------------------------------------
   Чтение цены, свойств и остатка из результата родного компонента.

   У каталожных компонентов Битрикса две формы результата: старая (PRICES,
   CATALOG_QUANTITY) и нынешняя (ITEM_PRICES, PRODUCT). Какая придёт, зависит
   от версии ядра и параметров вызова, и угадывать её в шаблоне — верный
   способ однажды показать «Цена по запросу» на товаре с ценой. Читаем обе.
   ------------------------------------------------------------------------- */

/** Цена к показу. null — цены нет вовсе. */
function gg_item_price(array $item): ?float
{
    $rows = $item['ITEM_PRICES'] ?? ($item['PRICES'] ?? []);
    foreach ($rows as $row) {
        foreach (['DISCOUNT_PRICE', 'PRICE', 'DISCOUNT_VALUE', 'VALUE'] as $key) {
            if (isset($row[$key]) && (float)$row[$key] > 0) {
                return (float)$row[$key];
            }
        }
    }
    return null;
}

/** Свойства как «код → читаемая строка». */
function gg_item_props(array $item): array
{
    $out = [];
    foreach (($item['DISPLAY_PROPERTIES'] ?? []) as $code => $prop) {
        $value = $prop['DISPLAY_VALUE'] ?? ($prop['VALUE'] ?? '');
        $out[$code] = is_array($value) ? implode(', ', array_filter($value)) : trim((string)$value);
    }
    foreach (($item['PROPERTIES'] ?? []) as $code => $prop) {
        if (!empty($out[$code])) {
            continue;
        }
        $value = $prop['VALUE'] ?? '';
        $value = is_array($value) ? implode(', ', array_filter($value)) : trim((string)$value);
        if ($value !== '') {
            $out[$code] = $value;
        }
    }
    return $out;
}

/** Остаток на складе. */
function gg_item_quantity(array $item): int
{
    if (isset($item['CATALOG_QUANTITY'])) {
        return (int)$item['CATALOG_QUANTITY'];
    }
    if (isset($item['PRODUCT']['QUANTITY'])) {
        return (int)$item['PRODUCT']['QUANTITY'];
    }
    return 0;
}


/**
 * Значения свойств для списка товаров — одним запросом.
 *
 * Родные компоненты в разных версиях ядра кладут свойства то в PROPERTIES,
 * то в DISPLAY_PROPERTIES, то не кладут вовсе, если параметр PROPERTY_CODE
 * им не по нраву. Для витрины это неприемлемо: фасовка — вторая строка
 * карточки, и она обязана быть. Один запрос по списку ID надёжнее догадок.
 *
 * @return array ID товара → [код свойства => строка]
 */
function gg_props_for_ids(array $ids, array $codes): array
{
    $out = [];
    $ids = array_values(array_unique(array_map('intval', $ids)));
    if (!$ids || !$codes || !CModule::IncludeModule('iblock')) {
        return $out;
    }

    $select = ['ID'];
    foreach ($codes as $code) {
        $select[] = 'PROPERTY_' . $code;
    }

    $res = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $ids],
        false,
        false,
        $select
    );
    while ($row = $res->Fetch()) {
        $id = (int)$row['ID'];
        foreach ($codes as $code) {
            $value = $row['PROPERTY_' . $code . '_VALUE'] ?? '';
            $value = is_array($value) ? implode(', ', array_filter($value)) : trim((string)$value);
            if ($value !== '') {
                $out[$id][$code] = $value;
            }
        }
    }
    return $out;
}
