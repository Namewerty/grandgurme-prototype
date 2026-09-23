<?php
/**
 * Витрина каталога: /catalog/ и /catalog/<slug>.
 *
 * Адрес разбирается здесь, а не комплексным компонентом: адреса витрины
 * заданы картой (include/catalog-map.php) и намеренно не совпадают
 * с символьными кодами разделов 1С. Подробнее — в include/catalog.php.
 *
 * Всё, что глубже /catalog/, приводит сюда правилом обработки адресов
 * (Настройки → Обработка адресов): физического файла под /catalog/<slug>
 * нет и не будет.
 *
 * СТРАНИЦУ ВЫДАЧИ СОБИРАЕТ НЕ КОМПОНЕНТ. Порядок «наличие, потом под заказ
 * при любой сортировке» — три уровня, а компонент принимает два, поэтому
 * список ID страницы считает gg_catalog_page, а компоненту достаётся готовая
 * дюжина по фильтру ID. Разбивка по страницам живёт в параметре ?page=.
 */
/* Класс страницы читает шапка: у каталога плотная шапка и своя раскладка,
   первого экрана здесь нет. */
define('GG_PAGE_CLASS', 'page-catalog');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/catalog.php';

/** Слаг раздела из адреса. Пустой — значит открыт корень каталога. */
$path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$rest = trim(substr($path, strlen('/catalog')), '/');
$parts = $rest !== '' ? explode('/', $rest) : [];
$slug = $parts ? $parts[0] : '';
if ($slug === 'index.php') {
    $slug = '';
}

if ($slug === '') {
    $APPLICATION->SetTitle('Каталог — №1 Гранд Гурмэ');
    ?>
    <div class="catalog">
      <div class="container">
        <nav class="crumbs" aria-label="Хлебные крошки">
          <a href="/">Главная</a>
          <span class="crumbs__sep" aria-hidden="true"></span>
          <span class="crumbs__current" aria-current="page">Каталог</span>
        </nav>
        <div class="catalog__head">
          <h1 class="catalog__title">Каталог</h1>
          <p class="catalog__lead">Разделы витрины. Названия и порядок — из карты витрины, количества считаются по инфоблоку прямо сейчас.</p>
        </div>
        <div class="facets" data-facets>
          <div class="facets__row">
            <span class="facets__label">Разделы</span>
            <div class="facets__rail chips">
              <?php foreach (gg_catalog_tree() as $node): ?>
                <a class="chip" href="<?= gg_e(gg_category_url($node['slug'])) ?>"><?= gg_e($node['name']) ?><?php if (!empty($node['count'])): ?><span class="pill__count"><?= (int)$node['count'] ?></span><?php endif; ?></a>
              <?php endforeach; ?>
            </div>
          </div>
        </div>
      </div>
    </div>
    <?php
} else {
    $cat = gg_catalog_category($slug);

    if (!$cat) {
        CHTTP::SetStatus('404 Not Found');
        @define('ERROR_404', 'Y');
        $APPLICATION->SetTitle('Раздел не найден');
        echo '<div class="catalog"><div class="container"><div class="catalog__head">'
            . '<h1 class="catalog__title">Раздел не найден</h1>'
            . '<p class="catalog__lead">Такого раздела на витрине нет. <a href="/catalog">Вернуться в каталог</a>.</p>'
            . '</div></div></div>';
    } else {
        $picked = gg_catalog_selected($cat);
        $sortKey = gg_catalog_sort_key();
        $sort = gg_catalog_sorts()[$sortKey];
        $page = gg_catalog_page($cat, $picked, $sortKey);

        /* Заголовок окна и описание для поиска берутся из админки, если они
           там заполнены (инфоблок «Разделы витрины»); иначе собираются из
           названия и лида, как раньше. */
        $seoTitle = trim((string)($cat['seoTitle'] ?? ''));
        $seoDesc = trim((string)($cat['seoDesc'] ?? ''));
        $APPLICATION->SetTitle($seoTitle !== '' ? $seoTitle : $cat['name'] . ' — купить в №1 Гранд Гурмэ');
        $APPLICATION->SetPageProperty('description', $seoDesc !== '' ? $seoDesc : $cat['lead']);

        /* Фильтр уезжает компоненту глобальной переменной: так работают все
           родные компоненты каталога, и свой велосипед здесь не нужен.
           Список ID — уже отобранная и упорядоченная страница; пустой список
           даёт честную пустую выдачу, а не весь раздел. */
        $GLOBALS['ggFilter'] = gg_catalog_filter($cat, $picked);
        $GLOBALS['ggFilter']['ID'] = $page['ids'] ?: [-1];

        $APPLICATION->IncludeComponent(
            'bitrix:catalog.section',
            'gg',
            [
                'IBLOCK_TYPE' => '1c_catalog',
                'IBLOCK_ID' => 4,
                'SECTION_ID' => 0,
                'SECTION_CODE' => '',
                'SECTION_USER_FIELDS' => [],
                'ELEMENT_SORT_FIELD' => $sort['field'],
                'ELEMENT_SORT_ORDER' => $sort['order'],
                'ELEMENT_SORT_FIELD2' => 'NAME',
                'ELEMENT_SORT_ORDER2' => 'ASC',
                'FILTER_NAME' => 'ggFilter',
                'INCLUDE_SUBSECTIONS' => 'Y',
                'SHOW_ALL_WO_SECTION' => 'Y',
                'PROPERTY_CODE' => ['RYBA', 'KATEGORIYA', 'UPAKOVKA', 'ATRIBUT', 'CML2_ARTICLE'],
                'PRICE_CODE' => ['Интернет-магазин'],
                'USE_PRICE_COUNT' => 'N',
                'SHOW_PRICE_COUNT' => '1',
                'PRICE_VAT_INCLUDE' => 'Y',
                'CONVERT_CURRENCY' => 'N',
                'HIDE_NOT_AVAILABLE' => 'N',
                /* Страница уже нарезана: компоненту отдаётся не больше дюжины
                   ID, и своей разбивки по страницам у него быть не должно —
                   иначе на второй странице он разбил бы по страницам её. */
                'PAGE_ELEMENT_COUNT' => 100,
                'LINE_ELEMENT_COUNT' => 4,
                'DETAIL_URL' => '/product/#ELEMENT_CODE#',
                'BASKET_URL' => '/cart/',
                'ACTION_VARIABLE' => 'action',
                'PRODUCT_ID_VARIABLE' => 'id',
                'SECTION_ID_VARIABLE' => 'SECTION_ID',
                'PRODUCT_QUANTITY_VARIABLE' => 'quantity',
                'PRODUCT_PROPS_VARIABLE' => 'prop',
                'CACHE_TYPE' => 'N',
                'CACHE_TIME' => 0,
                'CACHE_FILTER' => 'N',
                'CACHE_GROUPS' => 'Y',
                'SET_TITLE' => 'N',
                'SET_BROWSER_TITLE' => 'N',
                'SET_META_KEYWORDS' => 'N',
                'SET_META_DESCRIPTION' => 'N',
                'SET_LAST_MODIFIED' => 'N',
                'ADD_SECTIONS_CHAIN' => 'N',
                'DISPLAY_COMPARE' => 'N',
                'DISPLAY_TOP_PAGER' => 'N',
                'DISPLAY_BOTTOM_PAGER' => 'N',
                'PAGER_TITLE' => 'Товары',
                'PAGER_SHOW_ALWAYS' => 'N',
                'PAGER_TEMPLATE' => 'gg',
                'PAGER_DESC_NUMBERING' => 'N',
                'PAGER_SHOW_ALL' => 'N',
                'PAGER_BASE_LINK_ENABLE' => 'N',
                'GG_CATEGORY_SLUG' => $cat['slug'],
            ]
        );
    }
}

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
