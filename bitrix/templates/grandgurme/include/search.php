<?php
/**
 * Поиск по витрине: подсказки в шапке и страница /search/.
 *
 * ЧТО БЫЛО СЛОМАНО (16.09.2026).
 * 1. Подсказки в шапке искали не по сайту, а по данным прототипа, зашитым
 *    в app.js: там 74 выдуманных и снятых с выгрузки 20.08 позиций, у чёрной
 *    икры нет цен, и на первой же такой позиции отрисовка падала — панель
 *    оставалась пустой («икра белуги» не предлагала ничего). Ссылки подсказок
 *    вели на слаги прототипа, которых на стенде нет.
 * 2. «Показать все результаты» открывал /search/ — страницу демо-магазина
 *    с компонентом search.page, настроенным на инфоблоки демо-одежды. Товары
 *    1С (тип инфоблока 1c_catalog) в его фильтр не входили вовсе, поэтому
 *    «ничего не найдено» было ответом на любой запрос.
 *
 * КАК ИЩЕМ ТЕПЕРЬ. Запрос режется на слова, у каждого слова берётся основа
 * морфологией модуля поиска («белуги» → «белуг», «осетровая» → «осетр»),
 * и товар подходит, если каждая основа встречается в его тексте: рабочем
 * наименовании, названии для печати или описании (SEARCHABLE_CONTENT
 * инфоблока), либо в артикуле или коде 1С. Сравнение в базе не различает
 * регистр и «ё». Основа ищется подстрокой, поэтому недописанное слово
 * («икра бел») уже находит белугу — это и нужно подсказкам.
 *
 * Полнотекстовый индекс модуля поиска здесь не используется: он ищет только
 * целые слова и не видит недописанное, а подсказки работают именно на нём.
 * Товаров меньше тысячи, запрос по ним подстрокой занимает миллисекунды.
 *
 * Ищем только по витрине: разделы из карты (catalog-map.php) и отдельные
 * позиции оттуда же. «Канцтовары» и служебные позиции в выдачу не попадают.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/catalog.php';

/** Сколько карточек на странице результатов. */
const GG_SEARCH_PAGE_SIZE = 24;

/**
 * Прилагательные, основа которых не совпадает с названием в учёте:
 * «осетровая икра» лежит в 1С как «Икра чёрная Осётр».
 */
function gg_search_synonyms(): array
{
    return [
        'ОСЕТРОВ' => 'ОСЕТР',
        'ОСЕТРИН' => 'ОСЕТР',
        'БЕЛУЖ' => 'БЕЛУГ',
        'СЕВРЮЖ' => 'СЕВРЮГ',
        'ЛОСОСЕВ' => 'ЛОСОС',
        'ЩУЧ' => 'ЩУК',
        'КРАБОВ' => 'КРАБ',
        'КРЕВЕТОЧ' => 'КРЕВЕТК',
        'ГРЕБЕШК' => 'ГРЕБЕШ',
        'СЕМГ' => 'СЕМГ',
    ];
}

/** Иконка раздела в подсказках — те же знаки, что в каталожной панели. */
function gg_search_category_icon(string $slug): string
{
    $icons = [
        'chernaya-ikra' => 'catCaviarBlack',
        'krasnaya-ikra' => 'catCaviarRed',
        'ryba' => 'catFish',
        'moreprodukty-kraby' => 'catCrab',
        'podarochnye-nabory' => 'catGift',
        'bakaleya' => 'catGrocery',
        'napitki' => 'catDrink',
        'sladosti' => 'catDessert',
        'sneki-orehi' => 'catSnack',
        'tovary-dlya-doma' => 'catHome',
    ];
    return $icons[$slug] ?? 'search';
}

/** По каким ещё словам находится раздел. */
function gg_search_category_words(): array
{
    return [
        'chernaya-ikra' => 'икра осетр белуга севрюга стерлядь паюсная caviar',
        'krasnaya-ikra' => 'икра лосось кета горбуша нерка кижуч щука вобла',
        'ryba' => 'рыба лосось семга форель палтус осетр сиг омуль нерка копченая слабосоленая вяленая балык филе',
        'moreprodukty-kraby' => 'краб креветка гребешок морепродукты',
        'podarochnye-nabory' => 'подарок набор подарочный',
        'bakaleya' => 'масло соус специи мед варенье джем оливки маслины каперсы артишоки консервы аджика хрен горчица майонез кетчуп',
        'napitki' => 'сок морс смузи чай напитки',
        'sladosti' => 'печенье вафли шоколад конфеты мармелад зефир пастила сладости',
        'sneki-orehi' => 'чипсы снеки сухарики крекеры хлебцы орехи сухофрукты',
        'tovary-dlya-doma' => 'стирка посуда аромат диффузор дом',
    ];
}

/** Запрос как его видит поиск: без лишних пробелов и знаков, до 100 символов. */
function gg_search_query(string $q): string
{
    $q = preg_replace('/[^\p{L}\p{N}\-\/\s]+/u', ' ', $q);
    $q = preg_replace('/\s+/u', ' ', (string)$q);
    return mb_substr(trim((string)$q), 0, 100);
}

/**
 * Слова запроса и их основы. Слово короче двух знаков отбрасывается;
 * число остаётся числом («113», «50»), код вида «ЦБ-00002077» — целиком.
 *
 * @return array [['word' => исходное в верхнем регистре, 'stem' => основа], …]
 */
function gg_search_terms(string $q): array
{
    $terms = [];
    $hasStemming = CModule::IncludeModule('search') && function_exists('stemming');
    $synonyms = gg_search_synonyms();

    foreach (preg_split('/\s+/u', gg_search_query($q)) as $word) {
        $upper = mb_strtoupper(str_replace(['ё', 'Ё'], ['е', 'Е'], $word));
        if (mb_strlen($upper) < 2) {
            continue;
        }

        $stem = $upper;
        if (preg_match('/^\p{L}+$/u', $upper) && mb_strlen($upper) > 3 && $hasStemming) {
            $stems = array_keys((array)stemming($word, 'ru'));
            $candidate = $stems ? (string)$stems[0] : '';
            $candidate = str_replace('Ё', 'Е', $candidate);
            /* Основа короче трёх букв цепляет что попало («ИК» в «ИКЕБАНА»). */
            if (mb_strlen($candidate) >= 3) {
                $stem = $candidate;
            }
        }
        $stem = $synonyms[$stem] ?? $stem;

        $terms[] = ['word' => $upper, 'stem' => $stem];
    }
    return $terms;
}

/** Фильтр «всё, что есть на витрине». */
function gg_search_showcase_filter(): array
{
    $sections = [];
    $extra = [];
    foreach (gg_map()['categories'] as $cat) {
        /* Витрины не перечисляем: их разделы уже пришли от настоящих разделов. */
        if (!empty($cat['showcase'])) {
            continue;
        }
        foreach ($cat['sections'] as $id) {
            $sections[] = (int)$id;
        }
        foreach (($cat['extraElements'] ?? []) as $id) {
            $extra[] = (int)$id;
        }
    }

    $filter = ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y'];
    $scope = ['SECTION_ID' => array_values(array_unique($sections)), 'INCLUDE_SUBSECTIONS' => 'Y'];
    $filter[] = $extra ? ['LOGIC' => 'OR', $scope, ['ID' => array_values(array_unique($extra))]] : $scope;
    return $filter;
}

/**
 * Значения справочника «Рыба», подходящие под основу слова (23.09.2026).
 *
 * Вид рыбы в поисковый индекс инфоблока не входит: свойство RYBA заведено
 * с SEARCHABLE = N, а индекс собран из рабочего наименования и названия для
 * печати. Сейчас вид стоит в самом названии («Икра красная Кета …»), и «кета»
 * находится случайно. Но название для печати 1С может поправить в любой
 * выгрузке — «Икра кеты» слова «кета» уже не содержит, — и тогда поиск по виду
 * пропал бы молча. Поэтому вид ищется ещё и по свойству.
 *
 * @return int[] ID значений справочника
 */
function gg_search_species_enum_ids(string $stem): array
{
    static $values = null;
    if ($values === null) {
        $values = [];
        if (CModule::IncludeModule('iblock')) {
            $res = CIBlockPropertyEnum::GetList([], ['IBLOCK_ID' => gg_map()['iblockId'], 'CODE' => 'RYBA']);
            while ($row = $res->Fetch()) {
                $values[(int)$row['ID']] = mb_strtoupper(str_replace(['ё', 'Ё'], 'Е', (string)$row['VALUE']));
            }
        }
    }
    $ids = [];
    foreach ($values as $id => $text) {
        if ($stem !== '' && mb_strpos($text, $stem) !== false) {
            $ids[] = $id;
        }
    }
    return $ids;
}

/** Условие «слово нашлось в тексте позиции ИЛИ в её виде рыбы». */
function gg_search_term_filter(array $term): array
{
    $byText = ['%SEARCHABLE_CONTENT' => $term['stem']];
    $species = gg_search_species_enum_ids($term['stem']);
    return $species ? ['LOGIC' => 'OR', $byText, ['PROPERTY_RYBA' => $species]] : $byText;
}

/** ID товаров, у которых артикул или код 1С совпадает с запросом целиком. */
function gg_search_by_code(string $q): array
{
    global $DB;
    $q = trim($q);
    if (mb_strlen($q) < 4 || !preg_match('/\d/u', $q)) {
        return [];
    }
    $safe = $DB->ForSql(mb_strtoupper($q));
    $iblockId = (int)gg_map()['iblockId'];
    $ids = [];
    $res = $DB->Query(
        "SELECT DISTINCT ep.IBLOCK_ELEMENT_ID ID
           FROM b_iblock_element_property ep
           JOIN b_iblock_property p ON p.ID = ep.IBLOCK_PROPERTY_ID AND p.IBLOCK_ID = {$iblockId}
          WHERE p.CODE IN ('CML2_ARTICLE', 'CML2_TRAITS')
            AND UPPER(ep.VALUE) = '{$safe}'"
    );
    while ($row = $res->Fetch()) {
        $ids[] = (int)$row['ID'];
    }
    return $ids;
}

/**
 * Найденные товары, лучшие первыми.
 *
 * Порядок: совпадение в названии важнее совпадения в описании; название,
 * которое начинается с первого слова запроса, — выше; то, что есть на
 * складе и с ценой, — выше того, что под заказ. Дальше по алфавиту.
 *
 * @return int[]
 */
function gg_search_ids(string $q): array
{
    static $cache = [];
    $key = gg_search_query($q);
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    if (!CModule::IncludeModule('iblock')) {
        return [];
    }

    $terms = gg_search_terms($q);
    $byCode = gg_search_by_code($key);
    if (!$terms && !$byCode) {
        return $cache[$key] = [];
    }

    $filter = gg_search_showcase_filter();
    if ($byCode) {
        $textFilter = ['LOGIC' => 'AND'];
        foreach ($terms as $term) {
            $textFilter[] = gg_search_term_filter($term);
        }
        $filter[] = count($textFilter) > 1
            ? ['LOGIC' => 'OR', ['ID' => $byCode], $textFilter]
            : ['ID' => $byCode];
    } else {
        foreach ($terms as $term) {
            $filter[] = gg_search_term_filter($term);
        }
    }

    $rows = [];
    $res = CIBlockElement::GetList([], $filter, false, ['nTopCount' => 500], ['ID', 'NAME', 'PREVIEW_TEXT']);
    while ($row = $res->Fetch()) {
        $rows[(int)$row['ID']] = $row;
    }
    if (!$rows) {
        return $cache[$key] = [];
    }

    $ids = array_keys($rows);
    $live = gg_products_live($ids);
    $codeHits = array_flip($byCode);

    $scored = [];
    $anyInName = false;
    foreach ($rows as $id => $row) {
        $name = mb_strtoupper(str_replace(['ё', 'Ё'], 'е', gg_display_name((string)$row['NAME'], (string)$row['PREVIEW_TEXT'])
            . ' ' . (string)$row['NAME']));
        $score = isset($codeHits[$id]) ? 100 : 0;
        $inName = true;
        foreach ($terms as $i => $term) {
            $stem = $term['stem'];
            if (preg_match('/(^|[^\p{L}])' . preg_quote($stem, '/') . '/u', $name)) {
                $score += 6;
                if ($i === 0 && mb_strpos($name, $stem) === 0) {
                    $score += 5;
                }
            } elseif (mb_strpos($name, $stem) !== false) {
                $score += 3;
            } else {
                $score += 1;
                $inName = false;
            }
        }
        $inName = $inName || isset($codeHits[$id]);
        $anyInName = $anyInName || $inName;
        if (($live[$id]['quantity'] ?? 0) > 0) {
            $score += 4;
        }
        if (($live[$id]['price'] ?? null) !== null) {
            $score += 2;
        }
        $scored[] = ['id' => $id, 'score' => $score, 'name' => $name, 'inName' => $inName];
    }

    /* Совпадение только в описании — шум, если есть совпадения в названии:
       «оливки» иначе приводили бы всё, в составе чего оливковое масло. */
    if ($anyInName) {
        $scored = array_values(array_filter($scored, static fn($row) => $row['inName']));
    }

    usort($scored, static function ($a, $b) {
        return [$b['score'], $a['name']] <=> [$a['score'], $b['name']];
    });

    return $cache[$key] = array_column($scored, 'id');
}

/**
 * Карточки для подсказок и страницы результатов в заданном порядке.
 * Как в сетке каталога: название, вес, цена и вид позиции — ничего больше.
 *
 * @return array [['id', 'name', 'note', 'price', 'href', 'kind', 'row'], …]
 */
function gg_search_cards(array $ids): array
{
    $ids = array_values(array_map('intval', $ids));
    if (!$ids || !CModule::IncludeModule('iblock')) {
        return [];
    }

    $elements = [];
    $res = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $ids],
        false,
        false,
        ['ID', 'NAME', 'CODE']
    );
    while ($row = $res->Fetch()) {
        $elements[(int)$row['ID']] = $row;
    }

    $goods = gg_goods_info_for_ids($ids);
    $live = gg_products_live($ids);

    $cards = [];
    foreach ($ids as $id) {
        if (!isset($elements[$id])) {
            continue;
        }
        $row = $elements[$id];
        $info = $goods[$id] ?? ['name' => (string)$row['NAME'], 'weight' => '', 'weighed' => false];
        $data = $live[$id] ?? ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];
        $cards[] = [
            'id' => $id,
            'name' => $info['name'],
            'note' => $info['weight'],
            'price' => gg_price(gg_shelf_price($data['price'], $info['weighed'])),
            'href' => gg_product_url($row),
            'kind' => gg_item_kind($data),
            'row' => $row,
        ];
    }
    return $cards;
}

/**
 * Разделы и подкатегории, подходящие под запрос.
 *
 * Сначала разделы витрины — по названию и словам gg_search_category_words.
 * Следом подкатегории (22.09.2026): опции строк фильтра на странице раздела
 * — «Белуга», «Лосось», «Холодного копчения», «Оливки и маслины». Ссылка
 * ведёт на раздел с уже выбранной опцией, в строке — имя раздела рядом
 * («Лосось · Рыба»). Подкатегория подходит, если хотя бы одно слово запроса
 * есть в ней самой (в названии или в подстроках, по которым она ищет
 * товары), а остальные — в ней или в её разделе: «икра белуги» находит
 * «Белугу» чёрной икры, но не белугу рыбного раздела, а «икра» одна
 * подкатегорий не собирает вовсе — ей хватает двух разделов икры.
 */
function gg_search_categories(string $q): array
{
    $terms = gg_search_terms($q);
    if (!$terms) {
        return [];
    }
    $words = gg_search_category_words();
    $flat = static fn(string $text): string => mb_strtoupper(str_replace(['ё', 'Ё'], 'е', $text));
    $hit = static function (string $haystack, array $term): bool {
        return mb_strpos($haystack, $term['stem']) !== false || mb_strpos($haystack, $term['word']) !== false;
    };

    $out = [];
    $subs = [];
    foreach (gg_catalog_tree() as $cat) {
        $catText = $flat($cat['name'] . ' ' . ($words[$cat['slug']] ?? ''));
        $all = true;
        foreach ($terms as $term) {
            if (!$hit($catText, $term)) {
                $all = false;
                break;
            }
        }
        if ($all) {
            $out[] = [
                'name' => $cat['name'],
                'href' => gg_category_url($cat['slug']),
                'icon' => gg_search_category_icon($cat['slug']),
            ];
        }

        foreach (gg_catalog_facets($cat) as $facet) {
            if (($facet['style'] ?? 'chips') === 'pills') {
                continue;
            }
            foreach ($facet['options'] as $option) {
                $own = $flat($option['name'] . ' ' . implode(' ', $option['names'] ?? []));
                $mine = false;
                $all = true;
                foreach ($terms as $term) {
                    if ($hit($own, $term)) {
                        $mine = true;
                    } elseif (!$hit($catText, $term)) {
                        $all = false;
                        break;
                    }
                }
                if ($mine && $all) {
                    $subs[] = [
                        'name' => $option['name'],
                        'parent' => $cat['name'],
                        'href' => gg_category_url($cat['slug']) . '?' . http_build_query([$facet['key'] => $option['slug']]),
                        'icon' => gg_search_category_icon($cat['slug']),
                    ];
                }
            }
        }
    }
    return array_merge($out, $subs);
}

/** Ответ подсказок: пять товаров, до четырёх разделов, общее число. */
function gg_search_suggest(string $q): array
{
    $query = gg_search_query($q);
    if (mb_strlen($query) < 2) {
        return ['query' => $query, 'products' => [], 'categories' => [], 'total' => 0, 'url' => '/search/'];
    }

    $ids = gg_search_ids($query);
    $categories = gg_search_categories($query);
    $products = [];
    foreach (gg_search_cards(array_slice($ids, 0, 5)) as $card) {
        unset($card['row']);
        $products[] = $card;
    }

    return [
        'query' => $query,
        'products' => $products,
        'categories' => array_slice($categories, 0, 4),
        'total' => count($ids),
        'url' => '/search/?q=' . rawurlencode($query),
    ];
}
