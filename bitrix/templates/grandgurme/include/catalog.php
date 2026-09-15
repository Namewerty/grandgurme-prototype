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

/** Сколько дней везём то, чего нет на складе. Подтверждено заказчиком. */
const GG_PREORDER_DAYS = 7;

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
