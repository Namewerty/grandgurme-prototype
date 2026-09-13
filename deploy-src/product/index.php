<?php
/**
 * Карточка товара: /product/<символьный код>.
 *
 * Символьный код приезжает из 1С транслитом («ikra_chyernaya_beluga_...»),
 * своих слагов у товаров нет и придумывать их нельзя: на следующей выгрузке
 * они разойдутся с учётом. По коду же товар находится однозначно.
 *
 * Раздел витрины определяется по разделу 1С, в котором товар лежит, —
 * по той же карте, что и весь каталог. Он нужен для хлебных крошек
 * и для набора характеристик.
 */
define('GG_PAGE_CLASS', 'page-product');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/catalog.php';

$path = (string)parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$rest = trim(substr($path, strlen('/product')), '/');
$parts = $rest !== '' ? explode('/', $rest) : [];
$code = $parts ? $parts[0] : '';
if ($code === 'index.php') {
    $code = '';
}

$element = null;
if ($code !== '' && CModule::IncludeModule('iblock')) {
    $res = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => gg_map()['iblockId'], 'ACTIVE' => 'Y', 'CODE' => $code],
        false,
        ['nTopCount' => 1],
        ['ID', 'NAME', 'CODE', 'IBLOCK_SECTION_ID']
    );
    $element = $res->Fetch() ?: null;
}

if (!$element) {
    CHTTP::SetStatus('404 Not Found');
    @define('ERROR_404', 'Y');
    $APPLICATION->SetTitle('Товар не найден');
    echo '<div class="product-page"><div class="container"><div class="catalog__head">'
        . '<h1 class="catalog__title">Товар не найден</h1>'
        . '<p class="catalog__lead">Такой позиции на витрине нет. <a href="/catalog">Вернуться в каталог</a>.</p>'
        . '</div></div></div>';
} else {
    /** Раздел витрины, которому принадлежит товар. */
    $slug = '';
    $sectionId = (int)$element['IBLOCK_SECTION_ID'];
    foreach (gg_map()['categories'] as $candidate) {
        $own = in_array($sectionId, array_map('intval', $candidate['sections']), true);
        $extra = in_array((int)$element['ID'], array_map('intval', $candidate['extraElements'] ?? []), true);
        if ($own || $extra) {
            $slug = $candidate['slug'];
            break;
        }
    }

    $APPLICATION->SetTitle($element['NAME'] . ' — №1 Гранд Гурмэ');

    $APPLICATION->IncludeComponent(
        'bitrix:catalog.element',
        'gg',
        [
            'IBLOCK_TYPE' => '1c_catalog',
            'IBLOCK_ID' => 4,
            'ELEMENT_ID' => (int)$element['ID'],
            'ELEMENT_CODE' => '',
            'SECTION_ID' => 0,
            'SECTION_CODE' => '',
            'SECTION_URL' => '/catalog/' . $slug,
            'DETAIL_URL' => '/product/#ELEMENT_CODE#',
            'PROPERTY_CODE' => ['RYBA', 'KATEGORIYA', 'UPAKOVKA', 'ATRIBUT', 'CML2_ARTICLE'],
            'PRICE_CODE' => ['Интернет-магазин'],
            'SHOW_PRICE_COUNT' => '1',
            'PRICE_VAT_INCLUDE' => 'Y',
            'CONVERT_CURRENCY' => 'N',
            'USE_PRICE_COUNT' => 'N',
            'BASKET_URL' => '/personal/basket.php',
            'ACTION_VARIABLE' => 'action',
            'PRODUCT_ID_VARIABLE' => 'id',
            'PRODUCT_QUANTITY_VARIABLE' => 'quantity',
            'PRODUCT_PROPS_VARIABLE' => 'prop',
            'ADD_PROPERTIES_TO_BASKET' => 'N',
            'PARTIAL_PRODUCT_PROPERTIES' => 'N',
            'USE_COMPARE' => 'N',
            'DISPLAY_COMPARE' => 'N',
            'SET_TITLE' => 'N',
            'SET_BROWSER_TITLE' => 'N',
            'SET_META_KEYWORDS' => 'N',
            'SET_META_DESCRIPTION' => 'N',
            'SET_LAST_MODIFIED' => 'N',
            'SET_STATUS_404' => 'Y',
            'SHOW_404' => 'N',
            'MESSAGE_404' => '',
            'ADD_SECTIONS_CHAIN' => 'N',
            'ADD_ELEMENT_CHAIN' => 'N',
            'DISPLAY_PREVIEW_TEXT_MODE' => 'E',
            'LINK_IBLOCK_TYPE' => '',
            'LINK_IBLOCK_ID' => '',
            'LINK_PROPERTY_SID' => '',
            'LINK_ELEMENTS_URL' => '',
            'USE_VOTE_RATING' => 'N',
            'USE_COMMENTS' => 'N',
            'BRAND_USE' => 'N',
            'CACHE_TYPE' => 'N',
            'CACHE_TIME' => 0,
            'CACHE_GROUPS' => 'Y',
            'GG_CATEGORY_SLUG' => $slug,
        ]
    );
}

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
