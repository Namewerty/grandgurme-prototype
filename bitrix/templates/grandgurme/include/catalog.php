<?php
/**
 * Витрина каталога: разбор адреса, фильтры, счётчики, наличие.
 *
 * ЧТО ЗДЕСЬ ЛЕЖИТ И ЧЕГО ЗДЕСЬ НЕТ.
 * Здесь только логика выборки: какой раздел 1С показать под адресом витрины,
 * как превратить ?sub=beluga в фильтр по свойству, сколько товаров в разделе
 * и что из них лежит на складе. Разметка живёт в шаблонах компонентов,
 * тексты — в карте витрины.
 *
 * ПОЧЕМУ НЕ SEF КОМПЛЕКСНОГО КОМПОНЕНТА. Адрес раздела витрины
 * (/catalog/chernaya-ikra) и символьный код раздела 1С (ikra_chernaya)
 * — разные строки, и так и задумано: учётное дерево собрано под товароведа.
 * Комплексный bitrix:catalog умеет разбирать только собственные коды,
 * поэтому адрес разбираем сами по карте витрины, а дальше зовём родные
 * catalog.section и catalog.element с готовым SECTION_ID и фильтром.
 *
 * МОДЕЛЬ НАЛИЧИЯ (см. README прототипа, раздел «Корзина и оформление»).
 * База выдачи — то, что есть на складе. Позиции под заказ добавляются
 * параметром ?stock=all и идут ПОСЛЕ наличия при любой сортировке.
 * Если по выбранному со склада нет ничего, под заказ показывается
 * принудительно: пустая сетка читается как поломка сайта, а не как
 * «со склада нет». Считается по выбранному, а не по разделу — иначе
 * человек, нажавший «Белугу», получил бы пустую страницу при восемнадцати
 * позициях под заказ.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/fn.php';
/* Название для печати, характеристики и код товара (16.09.2026). */
require_once __DIR__ . '/product-info.php';
/* Тексты разделов из админки и кнопка «Изменить» в режиме правки (23.09.2026). */
require_once __DIR__ . '/catalog-admin.php';

/** Сколько дней везём то, чего нет на складе. Подтверждено заказчиком. */
const GG_PREORDER_DAYS = 7;

/** Больше 99 банок за раз — это уже разговор с менеджером, а не форма. */
const GG_MAX_QTY = 99;

/** Сколько карточек на странице выдачи. */
const GG_PAGE_SIZE = 12;

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

/**
 * Оси фильтра раздела.
 *
 * Своих осей в карте витрины нет, а подразделы 1С есть (бакалея, напитки,
 * сладости, снеки, товары для дома) — строка капсул собирается из них сама
 * (22.09.2026): «Масло, соусы, специи», «Оливки и маслины»… Ключ sub —
 * тот же, что у ссылок мега-панели: раньше /catalog/bakaleya?sub=olivki-masliny
 * открывал весь раздел, теперь открывает оливки. Одна подкатегория строку
 * не собирает: выбирать не из чего.
 */
function gg_catalog_facets(array $cat): array
{
    if (isset($cat['facets'])) {
        return $cat['facets'];
    }
    $options = [];
    foreach ($cat['subs'] ?? [] as $sub) {
        if (($sub['type'] ?? '') === 'section' && !empty($sub['section'])) {
            $options[] = ['slug' => $sub['slug'], 'name' => $sub['name'], 'sections' => [(int)$sub['section']]];
        }
    }
    if (count($options) < 2) {
        return [];
    }
    return [[
        'key' => 'sub',
        'label' => 'Вид',
        'style' => 'chips',
        'anyLabel' => 'Все',
        'options' => $options,
    ]];
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
            if (empty($option['sections']) && empty($option['names']) && empty($option['elements'])) {
                $ids = gg_prop_enum_ids($facet['prop'], $option['values']);
                /* Значения нет в справочнике — показываем пустую выдачу, а не весь
                   раздел: молча снятый фильтр хуже честного «ничего не нашлось». */
                $filter['PROPERTY_' . $facet['prop']] = $ids ?: [-1];
            } else {
                $filter[] = gg_facet_option_filter($facet, $option);
            }
        }
    }

    return $filter;
}

/**
 * Условие опции, собранной не только из списочного свойства (22.09.2026).
 *
 * У чёрной икры каждая опция — значение одного свойства из справочника 1С.
 * У остальных разделов так не выходит: вид рыбы и способ обработки в 1С
 * заведены у половины позиций, и разными словами («х/к», «Холодное
 * копчение»), а 109 позиций рыбы лежат в самом разделе «Рыба» без
 * подраздела. Поэтому опция может собираться из трёх источников сразу,
 * через ИЛИ:
 *
 *   values   — значения списочного свойства facet['prop'], как у икры;
 *   sections — ID разделов 1С (подраздел «Рыба холодного копчения»);
 *   elements — ID отдельных позиций (паюсная икра лежит в корне инфоблока,
 *              а на витрине «Икра» относится к чёрной);
 *   names    — подстроки рабочего наименования («х/к», «лосос»). Сравнение
 *              в базе не различает регистр и «ё» (utf8mb4_0900_ai_ci).
 *
 * Списки подстрок сверены с выгрузкой 22.09.2026 — см. карту витрины.
 * Не нашлось ни одного источника — пустая выдача, как у икры.
 */
function gg_facet_option_filter(array $facet, array $option): array
{
    $or = ['LOGIC' => 'OR'];

    if (!empty($option['values']) && !empty($facet['prop'])) {
        $ids = gg_prop_enum_ids($facet['prop'], $option['values']);
        if ($ids) {
            $or[] = ['PROPERTY_' . $facet['prop'] => $ids];
        }
    }
    if (!empty($option['sections'])) {
        $or[] = ['SECTION_ID' => array_map('intval', $option['sections']), 'INCLUDE_SUBSECTIONS' => 'Y'];
    }
    if (!empty($option['elements'])) {
        $or[] = ['ID' => array_map('intval', $option['elements'])];
    }
    foreach ($option['names'] ?? [] as $needle) {
        $needle = trim((string)$needle);
        if ($needle !== '') {
            $or[] = ['%NAME' => $needle];
        }
    }

    return count($or) > 1 ? $or : ['ID' => -1];
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

/* -------------------------------------------------------------------------
   Наличие.
   ------------------------------------------------------------------------- */

/** Показывать ли позиции под заказ по адресу (?stock=all). */
function gg_stock_on(): bool
{
    return isset($_GET['stock']) && (string)$_GET['stock'] === 'all';
}

/**
 * Разбивка набора по наличию: сколько со склада, сколько под заказ.
 *
 * Остаток живой: '>CATALOG_QUANTITY' => 0 при подключённом модуле catalog.
 * Позиции без карточки торгового каталога в наличие не попадают — и это
 * правильно: остатка у них нет вовсе.
 */
function gg_catalog_stock_counts(array $cat, array $picked = []): array
{
    static $cache = [];
    $key = $cat['slug'] . '|' . implode(',', $picked);
    if (isset($cache[$key])) {
        return $cache[$key];
    }

    $total = gg_catalog_count($cat, $picked);
    $inStock = 0;

    if ($total > 0 && CModule::IncludeModule('iblock') && CModule::IncludeModule('catalog')) {
        $filter = gg_catalog_filter($cat, $picked);
        $filter['IBLOCK_ID'] = gg_map()['iblockId'];
        $filter['>CATALOG_QUANTITY'] = 0;
        $inStock = (int)CIBlockElement::GetList([], $filter, []);
    }

    return $cache[$key] = [
        'inStock' => $inStock,
        'preorder' => max(0, $total - $inStock),
        'total' => $total,
    ];
}

/**
 * Что показывать по наличию для набора, прошедшего фильтры.
 *
 * forced — со склада нет ничего, а под заказ есть: показываем под заказ
 * принудительно, без параметра в адресе.
 */
function gg_stock_view(array $cat, array $picked = []): array
{
    $counts = gg_catalog_stock_counts($cat, $picked);
    $forced = $counts['inStock'] === 0 && $counts['preorder'] > 0;

    return $counts + [
        'forced' => $forced,
        'showPreorder' => $forced || gg_stock_on(),
    ];
}

/**
 * Сколько позиций человек увидит при таком наборе фильтров.
 *
 * ЭТИМ ЖЕ СЧИТАЮТСЯ ЧИСЛА У ОПЦИЙ ФИЛЬТРОВ. Иначе у «Белуги», которой нет
 * на складе, стоял бы ноль и опция пропала бы из строки, хотя под заказ
 * её восемнадцать позиций.
 */
function gg_catalog_count_shown(array $cat, array $picked = []): int
{
    $view = gg_stock_view($cat, $picked);
    return $view['showPreorder'] ? $view['total'] : $view['inStock'];
}

/** Идентификаторы набора в порядке сортировки. Только ID — запрос лёгкий. */
function gg_catalog_ids(array $cat, array $picked, array $sort, bool $inStockOnly = false): array
{
    if (!CModule::IncludeModule('iblock')) {
        return [];
    }
    $filter = gg_catalog_filter($cat, $picked);
    $filter['IBLOCK_ID'] = gg_map()['iblockId'];
    if ($inStockOnly) {
        if (!CModule::IncludeModule('catalog')) {
            return [];
        }
        $filter['>CATALOG_QUANTITY'] = 0;
    }

    /* Порядок собирается по одному ключу: поле сортировки может совпасть
       с NAME, и в литерале массива второй ключ затёр бы выбор человека. */
    $order = [];
    $order[$sort['field']] = $sort['order'];
    if (!isset($order['NAME'])) {
        $order['NAME'] = 'ASC';
    }
    $order['ID'] = 'ASC';
    $res = CIBlockElement::GetList($order, $filter, false, false, ['ID']);

    $ids = [];
    while ($row = $res->Fetch()) {
        $ids[] = (int)$row['ID'];
    }
    return $ids;
}

/**
 * Страница выдачи: какие ID и в каком порядке показать.
 *
 * Номер страницы живёт в своём параметре ?page=, а не в PAGEN_1 родного
 * компонента: компонент получает готовый список из двенадцати ID и о
 * страницах не знает вовсе, иначе на второй странице он разбил бы по
 * страницам ещё и её.
 *
 * ПОЧЕМУ ПОРЯДОК СЧИТАЕТСЯ ЗДЕСЬ, А НЕ СОРТИРОВКОЙ КОМПОНЕНТА.
 * «Под заказ после наличия при любой сортировке» — это три уровня порядка
 * (наличие, выбор человека, имя), а компонент принимает два. Сортировка по
 * CATALOG_AVAILABLE дала бы третий, но она зависит от настройки «разрешить
 * покупку при отсутствии товара»: включат её ради предзаказа — и порядок
 * перестанет отличать склад от привоза. Поэтому два запроса за ID, склейка
 * и своя разбивка по страницам; компонент получает готовый список.
 */
function gg_catalog_page(array $cat, array $picked, string $sortKey, int $perPage = GG_PAGE_SIZE): array
{
    static $cache = [];
    $cacheKey = $cat['slug'] . '|' . implode(',', $picked) . '|' . $sortKey . '|' . $perPage;
    if (isset($cache[$cacheKey])) {
        return $cache[$cacheKey];
    }

    $view = gg_stock_view($cat, $picked);
    $sorts = gg_catalog_sorts();
    $sort = $sorts[$sortKey] ?? reset($sorts);

    $all = gg_catalog_ids($cat, $picked, $sort);
    $inStock = array_flip(gg_catalog_ids($cat, $picked, $sort, true));

    $first = [];
    $rest = [];
    foreach ($all as $id) {
        if (isset($inStock[$id])) {
            $first[] = $id;
        } else {
            $rest[] = $id;
        }
    }

    $ordered = $view['showPreorder'] ? array_merge($first, $rest) : $first;

    $total = count($ordered);
    $pages = max(1, (int)ceil($total / $perPage));
    $page = (int)($_GET['page'] ?? 1);
    $page = max(1, min($pages, $page));

    return $cache[$cacheKey] = [
        'ids' => array_slice($ordered, ($page - 1) * $perPage, $perPage),
        'total' => $total,
        'pages' => $pages,
        'page' => $page,
        'perPage' => $perPage,
    ];
}

/* -------------------------------------------------------------------------
   Адреса.

   Параметр stock сохраняется во всех ссылках фильтров и сортировок: человек
   включил показ под заказ один раз, и снимать этот выбор за него при первом
   же нажатии на фасету нельзя.
   ------------------------------------------------------------------------- */

/** Общая часть запроса: выбранные оси, сортировка, наличие. */
function gg_catalog_query(array $cat, array $picked, array $override = []): array
{
    $query = [];
    foreach (gg_catalog_facets($cat) as $facet) {
        $key = $facet['key'];
        $current = array_key_exists($key, $override) ? $override[$key] : ($picked[$key] ?? '');
        if ($current !== '') {
            $query[$key] = $current;
        }
    }

    $sort = array_key_exists('sort', $override) ? $override['sort'] : (string)($_GET['sort'] ?? '');
    if ($sort !== '' && $sort !== 'alpha' && isset(gg_catalog_sorts()[$sort])) {
        $query['sort'] = $sort;
    }

    $stock = array_key_exists('stock', $override) ? $override['stock'] : (gg_stock_on() ? 'all' : '');
    if ($stock === 'all') {
        $query['stock'] = 'all';
    }

    return $query;
}

/**
 * Адрес внутри страницы раздела — только строка запроса.
 *
 * ПОЧЕМУ НЕ ОТ КОРНЯ. Скрипт помечает текущую страницу в меню, проходя по
 * всем ссылкам документа: у кого путь совпал с location.pathname, тот
 * получает is-active и aria-current (markCurrentLinks в
 * src/js/sections/header.js). У фасет, сортировок и страниц путь тот же
 * самый — и после загрузки скрипта ВСЕ капсулы фильтров выглядели
 * выбранными, а страницы пагинации — текущими.
 *
 * Ссылка вида «?sub=beluga» решает это честно: она и правда меняет только
 * строку запроса, а скрипт её пропускает (он смотрит только на ссылки,
 * начинающиеся со слэша). Пустой набор даёт «?» — тот же адрес без
 * параметров.
 *
 * С 15.09.2026 markCurrentLinks ограничен навигацией (шапка, панели,
 * мобильное меню, подвал) и страницу раздела больше не трогает. Ссылки
 * остались относительными: они и по смыслу меняют только строку запроса,
 * а переписывать проверенный на стенде код ради вкуса незачем.
 */
function gg_catalog_build_url(array $cat, array $query): string
{
    return $query ? '?' . http_build_query($query) : '?';
}

/** Адрес раздела с заданным набором осей. Пустое значение убирает ось. */
function gg_catalog_url(array $cat, array $picked, string $key = '', string $value = ''): string
{
    $override = $key !== '' ? [$key => $value] : [];
    return gg_catalog_build_url($cat, gg_catalog_query($cat, $picked, $override));
}

/** Адрес раздела с другой сортировкой, оси и наличие сохраняются. */
function gg_catalog_sort_url(array $cat, array $picked, string $sortKey): string
{
    return gg_catalog_build_url($cat, gg_catalog_query($cat, $picked, ['sort' => $sortKey]));
}

/** Адрес раздела с включённым или выключенным показом под заказ. */
function gg_catalog_stock_url(array $cat, array $picked, bool $on): string
{
    return gg_catalog_build_url($cat, gg_catalog_query($cat, $picked, ['stock' => $on ? 'all' : '']));
}

/**
 * «Сбросить всё»: снимает фасеты, но оставляет сортировку и наличие.
 *
 * Ни сортировка, ни капсула «и под заказ» фильтрами не считаются — они
 * меняют порядок и базу выдачи, а не сужают её. Сбрасывать вместе с
 * фильтрами то, чего человек фильтром не назначал, значит отменять
 * два его решения вместо одного.
 */
function gg_catalog_reset_url(array $cat): string
{
    $empty = [];
    foreach (gg_catalog_facets($cat) as $facet) {
        $empty[$facet['key']] = '';
    }
    return gg_catalog_build_url($cat, gg_catalog_query($cat, $empty));
}

/** Адрес страницы выдачи. Всё остальное сохраняется. */
function gg_catalog_page_url(array $cat, array $picked, int $page): string
{
    $query = gg_catalog_query($cat, $picked);
    if ($page > 1) {
        $query['page'] = $page;
    }
    return gg_catalog_build_url($cat, $query);
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

/** Склонение: 1 товар, 2 товара, 5 товаров. */
function gg_plural_goods(int $n): string
{
    return $n . ' ' . gg_plural($n, 'товар', 'товара', 'товаров');
}

/** Склонение по числу. */
function gg_plural(int $n, string $one, string $few, string $many): string
{
    $ten = $n % 100;
    $unit = $n % 10;
    if ($ten > 10 && $ten < 20) {
        return $many;
    }
    if ($unit === 1) {
        return $one;
    }
    if ($unit >= 2 && $unit <= 4) {
        return $few;
    }
    return $many;
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

/**
 * Название товара без хвоста фасовки.
 *
 * 1С присылает фасовку в самом названии: «Икра чёрная Белуга ДАЙМОНД Банка
 * металл 1000 г». В карточке фасовка и так стоит второй строкой, и в сетке
 * название ломалось на две строки ради повтора. Хвост снимается только когда
 * он дословно совпадает со значением упаковки — иначе название остаётся как есть.
 */
function gg_item_title(string $name, string $pack): string
{
    $name = trim($name);
    $pack = trim($pack);
    if ($pack === '' || $name === '') {
        return $name;
    }
    $tail = mb_substr($name, -mb_strlen($pack));
    if (mb_strtolower($tail) !== mb_strtolower($pack)) {
        return $name;
    }
    /* Хвостовая пунктуация снимается регуляркой с /u: rtrim режет байты,
       и на «…ДАЙМОНД » он отгрыз бы половину буквы Д. */
    $short = preg_replace('/[\s,.·\-–—]+$/u', '', mb_substr($name, 0, mb_strlen($name) - mb_strlen($pack)));
    return $short !== '' ? $short : $name;
}

/**
 * Кадр товара.
 *
 * Фотографий в выгрузке нет ни у одной позиции, и служебная заглушка с именем
 * файла в сетке из двенадцати карточек читается как страница в работе.
 * Пока файла нет — волосяной знак по фону поверхности; как только кадр появится
 * в /media/products, сюда вернётся обычный слот прототипа.
 */
function gg_product_shot(array $item, string $alt, string $frameClass = 'product__photo'): string
{
    $src = '/media/products/' . (string)($item['CODE'] ?? '') . '.jpg';
    if (gg_media_exists($src)) {
        return gg_media_slot('', $src, '1:1', $frameClass, $alt);
    }
    return '<div class="media ' . gg_e($frameClass) . ' is-blank" style="--media-ratio: 1 / 1"'
        . ' role="img" aria-label="' . gg_e($alt) . '">'
        . '<span class="blank__mark" aria-hidden="true">' . gg_icon('emptyFish') . '</span></div>';
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

    /* ТОВАР С ТОРГОВЫМИ ПРЕДЛОЖЕНИЯМИ (23.09.2026). У коробок рыбы
       (19 позиций, CATALOG_TYPE = 3) цена «Интернет-магазин» стоит у самого
       товара — её кладёт обмен с 1С, — но каталожные компоненты цену родителя
       не отдают: по их модели цена живёт в предложениях. Получалось, что
       подсказка поиска (она читает цену прямо из базы, gg_products_live)
       писала «1 290 ₽», а карточка и сетка — «Цена по запросу». Читаем
       из того же места, что и поиск, чтобы три места не спорили. */
    $id = (int)($item['ID'] ?? 0);
    return $id ? (gg_products_live([$id])[$id]['price'] ?? null) : null;
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

/**
 * Остаток на складе.
 *
 * ЧИСЛО ДРОБНОЕ, И ОКРУГЛЯТЬ ЕГО НЕЛЬЗЯ. В выгрузке 1С встречаются остатки
 * вроде 0,5 кг: приведение к int превращало такую позицию в ноль, и товар,
 * который запрос со складским фильтром вернул как имеющийся, карточка
 * подписывала «под заказ». Сравниваем с нулём как есть.
 */
function gg_item_quantity(array $item): float
{
    if (isset($item['CATALOG_QUANTITY'])) {
        return (float)$item['CATALOG_QUANTITY'];
    }
    if (isset($item['PRODUCT']['QUANTITY'])) {
        return (float)$item['PRODUCT']['QUANTITY'];
    }
    return 0.0;
}

/**
 * Остатки по списку ID — одним запросом.
 *
 * Нужны корзине и оформлению: там нет результата каталожного компонента,
 * а наличие строки считается по ТЕКУЩЕМУ остатку товара, а не по снимку,
 * сделанному в момент добавления.
 *
 * Остаток дробный — см. gg_item_quantity.
 *
 * @return array ID товара → остаток
 */
function gg_quantities_for_ids(array $ids): array
{
    $out = [];
    $ids = array_values(array_unique(array_map('intval', $ids)));
    if (!$ids || !CModule::IncludeModule('catalog')) {
        return $out;
    }

    $res = \Bitrix\Catalog\ProductTable::getList([
        'filter' => ['@ID' => $ids],
        'select' => ['ID', 'QUANTITY'],
    ]);
    while ($row = $res->fetch()) {
        $out[(int)$row['ID']] = (float)$row['QUANTITY'];
    }
    return $out;
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

/**
 * Название, код и раздел по списку ID — одним запросом.
 *
 * @return array ID → ['NAME' => …, 'CODE' => …]
 */
function gg_elements_for_ids(array $ids): array
{
    $out = [];
    $ids = array_values(array_unique(array_map('intval', $ids)));
    if (!$ids || !CModule::IncludeModule('iblock')) {
        return $out;
    }
    $res = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $ids],
        false,
        false,
        ['ID', 'NAME', 'CODE', 'IBLOCK_SECTION_ID']
    );
    while ($row = $res->Fetch()) {
        $out[(int)$row['ID']] = $row;
    }
    return $out;
}

/* -------------------------------------------------------------------------
   Вид позиции: stock | preorder | request (16.09.2026).

   Та же модель, что kindOf в src/data/fulfillment.js прототипа, и считается
   она ТОЛЬКО здесь — шаблоны, корзина и оформление вид не угадывают:

     stock     есть на складе и есть цена — заказать и оплатить;
     preorder  нет на складе, есть цена, раздел витрины с 'fulfillment' =>
               'preorder' в карте («Рыба», «Красная икра» со всеми
               подразделами и extraElements) — заказать и оплатить,
               привезём через GG_PREORDER_DAYS дней;
     request   всё остальное — заявка менеджеру. Сюда же позиция без цены
               при любом наличии и позиция, которую Битрикс купить не даст
               (компонент не отдал CAN_BUY, у товара AVAILABLE = N).

   Вид считается при каждой отрисовке по живому остатку и цене: снимков,
   как в прототипе, здесь нет.
   ------------------------------------------------------------------------- */

/** Метка вида — разметка .stock-tag до класса, как stockTagHtml прототипа. */
function gg_stock_tag(string $kind): string
{
    $icons = ['stock' => 'check', 'preorder' => 'clock', 'request' => 'dialog'];
    $texts = gg_kind_labels();
    if (!isset($texts[$kind])) {
        return '';
    }
    return '<span class="stock-tag stock-tag--' . $kind . '">'
        . '<span class="stock-tag__icon" aria-hidden="true">' . gg_icon($icons[$kind]) . '</span>'
        . '<span class="stock-tag__text">' . gg_e($texts[$kind]) . '</span>'
        . '</span>';
}

/** Тексты меток — src/data/cart-copy.js → kinds. */
function gg_kind_labels(): array
{
    return [
        'stock' => 'В наличии',
        'preorder' => 'Под заказ · ' . gg_days_label(GG_PREORDER_DAYS),
        'request' => 'Через менеджера',
    ];
}

/** «7 дней», «1 день», «3 дня». */
function gg_days_label(int $n): string
{
    return $n . ' ' . gg_plural($n, 'день', 'дня', 'дней');
}

/** Корень раздела инфоблока с границами дерева. Кеш на хит. */
function gg_section_bounds(int $id): ?array
{
    static $cache = [];
    if (array_key_exists($id, $cache)) {
        return $cache[$id];
    }
    $cache[$id] = null;
    if (CModule::IncludeModule('iblock')) {
        $row = CIBlockSection::GetList(
            [],
            ['IBLOCK_ID' => gg_map()['iblockId'], 'ID' => $id],
            false,
            ['ID', 'LEFT_MARGIN', 'RIGHT_MARGIN']
        )->Fetch();
        if ($row) {
            $cache[$id] = ['left' => (int)$row['LEFT_MARGIN'], 'right' => (int)$row['RIGHT_MARGIN']];
        }
    }
    return $cache[$id];
}

/**
 * Разделы инфоблока, где работает предзаказ: разделы витрины с
 * 'fulfillment' => 'preorder' и ВСЕ вложенные в них. Один запрос на корень.
 *
 * @return array ID раздела => true
 */
function gg_preorder_section_ids(): array
{
    static $ids = null;
    if ($ids !== null) {
        return $ids;
    }
    $ids = [];
    if (!CModule::IncludeModule('iblock')) {
        return $ids;
    }
    foreach (gg_map()['categories'] as $cat) {
        if (($cat['fulfillment'] ?? '') !== 'preorder') {
            continue;
        }
        foreach (array_map('intval', $cat['sections']) as $rootId) {
            $root = gg_section_bounds($rootId);
            if (!$root) {
                continue;
            }
            $res = CIBlockSection::GetList(
                [],
                ['IBLOCK_ID' => gg_map()['iblockId'], '>=LEFT_MARGIN' => $root['left'], '<=RIGHT_MARGIN' => $root['right']],
                false,
                ['ID']
            );
            while ($row = $res->Fetch()) {
                $ids[(int)$row['ID']] = true;
            }
        }
    }
    return $ids;
}

/**
 * Лежит ли товар в разделе с предзаказом — по всем его разделам инфоблока
 * (привязок бывает несколько) и по extraElements карты.
 *
 * @return array ID товара => bool
 */
function gg_preorder_items(array $ids): array
{
    static $cache = [];
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $missing = array_values(array_diff($ids, array_keys($cache)));

    if ($missing) {
        $extra = [];
        foreach (gg_map()['categories'] as $cat) {
            if (($cat['fulfillment'] ?? '') === 'preorder') {
                foreach (($cat['extraElements'] ?? []) as $extraId) {
                    $extra[(int)$extraId] = true;
                }
            }
        }
        foreach ($missing as $id) {
            $cache[$id] = isset($extra[$id]);
        }
        $sections = gg_preorder_section_ids();
        if ($sections && CModule::IncludeModule('iblock')) {
            $res = CIBlockElement::GetElementGroups($missing, true, ['ID', 'IBLOCK_ELEMENT_ID']);
            while ($row = $res->Fetch()) {
                if (isset($sections[(int)$row['ID']])) {
                    $cache[(int)$row['IBLOCK_ELEMENT_ID']] = true;
                }
            }
        }
    }

    $out = [];
    foreach ($ids as $id) {
        $out[$id] = $cache[$id] ?? false;
    }
    return $out;
}

/**
 * Раздел витрины товара с учётом вложенности разделов и extraElements.
 *
 * Раньше /product/index.php сверял только IBLOCK_SECTION_ID с разделами
 * карты, и товар из подраздела («Рыба» → «Слабосолёная») оставался без
 * раздела витрины: без крошек и без набора характеристик.
 */
function gg_item_category_slug(int $id): string
{
    if (!$id || !CModule::IncludeModule('iblock')) {
        return '';
    }
    $groups = [];
    $res = CIBlockElement::GetElementGroups($id, true, ['ID', 'LEFT_MARGIN', 'RIGHT_MARGIN']);
    while ($row = $res->Fetch()) {
        $groups[] = ['left' => (int)$row['LEFT_MARGIN'], 'right' => (int)$row['RIGHT_MARGIN']];
    }
    foreach (gg_map()['categories'] as $cat) {
        /* Витрина — не раздел товара: у карточки в крошках должен стоять
           «Чёрная икра», а не «Икра». */
        if (!empty($cat['showcase'])) {
            continue;
        }
        if (in_array($id, array_map('intval', $cat['extraElements'] ?? []), true)) {
            return $cat['slug'];
        }
        foreach (array_map('intval', $cat['sections']) as $rootId) {
            $root = gg_section_bounds($rootId);
            if (!$root) {
                continue;
            }
            foreach ($groups as $group) {
                if ($group['left'] >= $root['left'] && $group['right'] <= $root['right']) {
                    return $cat['slug'];
                }
            }
        }
    }
    return '';
}

/**
 * Тип цены, из которого витрина берёт цены, — по названию, как PRICE_CODE
 * у компонентов каталога. ID в код не зашиваем.
 */
function gg_price_group_id(): int
{
    static $id = null;
    if ($id !== null) {
        return $id;
    }
    $id = 0;
    if (CModule::IncludeModule('catalog')) {
        $row = \Bitrix\Catalog\GroupTable::getList([
            'filter' => ['=NAME' => 'Интернет-магазин'],
            'select' => ['ID'],
            'limit' => 1,
        ])->fetch();
        $id = $row ? (int)$row['ID'] : 0;
    }
    return $id;
}

/**
 * Живые данные для вида по списку ID: остаток, доступность к покупке
 * (AVAILABLE учитывает «Разрешить покупку при отсутствии товара») и цена
 * типа «Интернет-магазин». Два запроса на весь список.
 *
 * @return array ID => ['id', 'price' => ?float, 'quantity' => float, 'canBuy' => bool]
 */
function gg_products_live(array $ids): array
{
    static $cache = [];
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) {
        return [];
    }
    $missing = array_values(array_diff($ids, array_keys($cache)));

    if ($missing) {
        foreach ($missing as $id) {
            $cache[$id] = ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false, 'sku' => false];
        }
        if (CModule::IncludeModule('catalog')) {
            $res = \Bitrix\Catalog\ProductTable::getList([
                'filter' => ['@ID' => $missing],
                'select' => ['ID', 'QUANTITY', 'AVAILABLE', 'TYPE'],
            ]);
            while ($row = $res->fetch()) {
                $id = (int)$row['ID'];
                /* TYPE = 3 — товар с торговыми предложениями. Битрикс такой
                   товар в корзину не принимает вовсе: «только конкретное
                   предложение» (проверено сухим прогоном 23.09.2026). */
                $sku = (int)($row['TYPE'] ?? 0) === \Bitrix\Catalog\ProductTable::TYPE_SKU;
                $cache[$id]['quantity'] = (float)$row['QUANTITY'];
                $cache[$id]['sku'] = $sku;
                $cache[$id]['canBuy'] = !$sku && ($row['AVAILABLE'] ?? 'N') === 'Y';
            }

            $group = gg_price_group_id();
            if ($group) {
                $res = \Bitrix\Catalog\PriceTable::getList([
                    'filter' => ['@PRODUCT_ID' => $missing, '=CATALOG_GROUP_ID' => $group],
                    'select' => ['PRODUCT_ID', 'PRICE'],
                ]);
                while ($row = $res->fetch()) {
                    if ((float)$row['PRICE'] > 0) {
                        $cache[(int)$row['PRODUCT_ID']]['price'] = (float)$row['PRICE'];
                    }
                }
            }
        }
    }

    $out = [];
    foreach ($ids as $id) {
        $out[$id] = $cache[$id];
    }
    return $out;
}

/**
 * Товары с торговыми предложениями (23.09.2026).
 *
 * У «Гранд Гурмэ» это коробки рыбы: 19 позиций, у каждой десяток предложений —
 * конкретных партий с весом в коде серии. Битрикс не даёт положить такой товар
 * в корзину («Нельзя добавить в корзину товар с торговыми предложениями —
 * только конкретное предложение»), поэтому вид у них всегда «через менеджера»,
 * сколько бы цены и остатка ни стояло у родителя. Это временно: когда коробки
 * доедут (PERENOS-korobki.md), покупать будут предложение, а не родителя.
 *
 * @return array ID товара => bool
 */
function gg_sku_parents(array $ids): array
{
    $out = [];
    foreach (gg_products_live($ids) as $id => $live) {
        $out[$id] = (bool)($live['sku'] ?? false);
    }
    return $out;
}

/**
 * Вид позиции.
 *
 * $item — либо результат каталожного компонента (ID, цены, остаток, CAN_BUY),
 * либо простой массив ['id', 'price', 'quantity', 'canBuy'] из
 * gg_products_live — так его собирают корзина и заявка.
 *
 * $cat — раздел витрины, если он известен наверняка (страница раздела):
 * тогда предзаказ определяется по нему, без запроса разделов. null — по
 * разделам самого товара.
 */
function gg_item_kind(array $item, ?array $cat = null): string
{
    if (array_key_exists('price', $item)) {
        $id = (int)($item['id'] ?? 0);
        $price = $item['price'] !== null ? (float)$item['price'] : null;
        $quantity = (float)($item['quantity'] ?? 0);
        $canBuy = $item['canBuy'] ?? null;
    } else {
        $id = (int)($item['ID'] ?? 0);
        $price = gg_item_price($item);
        $quantity = gg_item_quantity($item);
        $canBuy = array_key_exists('CAN_BUY', $item) ? in_array($item['CAN_BUY'], [true, 'Y'], true) : null;
    }

    /* Оплатить то, у чего нет суммы, нельзя. */
    if ($price === null || $price <= 0) {
        return 'request';
    }
    /* Битрикс эту позицию в корзину не примет. */
    if ($canBuy === false) {
        return 'request';
    }
    /* Товар с торговыми предложениями — тоже не примет, и компонент об этом
       не говорит: CAN_BUY он у родителя не заполняет вовсе (gg_sku_parents). */
    if ($id && ($item['sku'] ?? null) !== false && (gg_sku_parents([$id])[$id] ?? false)) {
        return 'request';
    }
    if ($quantity > 0) {
        return 'stock';
    }

    $preorder = $cat !== null
        ? (($cat['fulfillment'] ?? '') === 'preorder')
        : (gg_preorder_items([$id])[$id] ?? false);

    return $preorder ? 'preorder' : 'request';
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

/**
 * «17 сентября 2026» — дата оформления в кабинете (formatDate прототипа).
 * Год нужен: в истории заказов лежат записи прошлых лет.
 */
function gg_format_date(int $ts): string
{
    return gg_format_day_month($ts) . ' ' . date('Y', $ts);
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
