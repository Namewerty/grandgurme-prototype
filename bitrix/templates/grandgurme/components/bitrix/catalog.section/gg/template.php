<?php
/**
 * Список товаров раздела витрины.
 *
 * Разметка повторяет страницу категории прототипа (src/js/catalog/category-page.js)
 * до класса: стили общие, и любое расхождение сразу видно как сломанная вёрстка.
 * Отличие одно и оно осознанное — фильтры здесь ссылки, а не кнопки: страница
 * рисуется сервером, перезагрузка честнее мигающей выдачи без JS.
 *
 * Кадров у товаров нет ни одного: фотографии в выгрузку 1С не попали.
 * Поэтому кадр рисуется той же заглушкой, что и на главной (gg_media_slot),
 * и запроса за несуществующим файлом не делает.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();
/** @var array $arParams */
/** @var array $arResult */
/** @var CMain $APPLICATION */

require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/catalog.php';

$cat = gg_catalog_category((string)($arParams['GG_CATEGORY_SLUG'] ?? ''));
if (!$cat) {
    return;
}

$picked = gg_catalog_selected($cat);
$total = gg_catalog_total($cat);
$found = gg_catalog_count($cat, $picked);
$sortKey = gg_catalog_sort_key();
$sorts = gg_catalog_sorts();
$share = $total > 0 ? max(0, min(100, $found / $total * 100)) : 0;

/** Значение оси, выбранное сейчас, как читаемое имя. */
$appliedChips = [];
foreach (gg_catalog_facets($cat) as $facet) {
    $slug = $picked[$facet['key']] ?? '';
    if ($slug === '') {
        continue;
    }
    foreach ($facet['options'] as $option) {
        if ($option['slug'] === $slug) {
            $appliedChips[] = [
                'label' => $option['name'],
                'href' => gg_catalog_url($cat, $picked, $facet['key'], ''),
            ];
        }
    }
}
?>
<div class="catalog">
  <div class="container">
    <nav class="crumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <a href="/catalog">Каталог</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <span class="crumbs__current" aria-current="page"><?= gg_e($cat['name']) ?></span>
    </nav>

    <div class="catalog__head">
      <h1 class="catalog__title"><?= gg_e($cat['name']) ?></h1>
      <p class="catalog__lead"><?= gg_e($cat['lead']) ?></p>
    </div>

    <div class="facets" data-facets>
<?php foreach (gg_catalog_facets($cat) as $facet):
    $style = $facet['style'] ?? 'chips';
    $current = $picked[$facet['key']] ?? '';
    $itemClass = $style === 'tabs' ? 'tab' : ($style === 'pills' ? 'pill' : 'chip');
    $railClass = $style === 'tabs' ? 'tabs' : ($style === 'pills' ? 'facets__bar' : 'chips');
?>
      <div class="facets__row<?= $style === 'pills' ? ' facets__row--bar' : '' ?>">
        <span class="facets__label"><?= gg_e($facet['label']) ?></span>
        <div class="<?= $style === 'pills' ? 'facets__bar' : 'facets__rail ' . $railClass ?>">
          <a class="<?= $itemClass ?><?= $current === '' ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_url($cat, $picked, $facet['key'], '')) ?>"><?= gg_e($facet['anyLabel'] ?? 'Все') ?></a>
<?php foreach ($facet['options'] as $option):
        $on = $current === $option['slug'];
        $count = gg_catalog_count($cat, array_merge($picked, [$facet['key'] => $option['slug']]));
        /* Вариант, под который в разделе нет ни одного товара, не показываем:
           фильтр, ведущий в пустоту, — это обещание, которого нет за чем. */
        if ($count === 0 && !$on) {
            continue;
        }
?>
          <a class="<?= $itemClass ?><?= $on ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_url($cat, $picked, $facet['key'], $on ? '' : $option['slug'])) ?>"><?= gg_e($option['name']) ?><?php if ($style === 'pills' && $count): ?><span class="pill__count"><?= $count ?></span><?php endif; ?></a>
<?php endforeach; ?>
        </div>
      </div>
<?php endforeach; ?>

      <div class="facets__row facets__row--bar">
        <span class="facets__label">Сортировка</span>
        <div class="facets__bar">
<?php foreach ($sorts as $key => $sort): ?>
          <a class="pill pill--sort<?= $key === $sortKey ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_sort_url($cat, $picked, $key)) ?>"><b><?= gg_e($sort['label']) ?></b></a>
<?php endforeach; ?>
        </div>
      </div>
    </div>

    <div class="catalog__rule" aria-hidden="true"><span style="width: <?= round($share, 2) ?>%"></span></div>

    <div class="catalog__status">
      <p class="catalog__found">Найдено <b><?= gg_e(gg_plural_goods($found)) ?></b></p>
      <div><?php if ($appliedChips): ?><a class="link-btn" href="<?= gg_e(gg_category_url($cat['slug'])) ?>">Сбросить всё</a><?php endif; ?></div>
    </div>

    <div class="catalog__applied<?= $appliedChips ? '' : ' is-empty' ?>">
<?php foreach ($appliedChips as $chip): ?>
      <a class="applied" href="<?= gg_e($chip['href']) ?>"><?= gg_e($chip['label']) ?><span class="applied__x" aria-hidden="true"><?= gg_icon('close') ?></span></a>
<?php endforeach; ?>
    </div>

<?php if (empty($arResult['ITEMS'])): ?>
    <div class="catalog__grid is-empty">
      <div class="empty">
        <h2 class="empty__title">Ничего не нашлось</h2>
        <p class="empty__hint">Попробуйте снять фильтр или сбросить всё</p>
        <a class="btn" href="<?= gg_e(gg_category_url($cat['slug'])) ?>">Сбросить фильтры</a>
      </div>
    </div>
<?php else: ?>
    <div class="catalog__grid">
<?php
    /* Свойства для всей страницы выдачи — одним запросом, см. gg_props_for_ids. */
    $ggPagePropsById = gg_props_for_ids(array_column($arResult['ITEMS'], 'ID'), ['UPAKOVKA', 'RYBA', 'KATEGORIYA', 'CML2_ARTICLE']);
    foreach ($arResult['ITEMS'] as $item):
        $price = gg_item_price($item);
        $inStock = gg_item_quantity($item) > 0;
        $props = gg_item_props($item) + ($ggPagePropsById[(int)$item['ID']] ?? []);
        $note = $props['UPAKOVKA'] ?? ($props['CML2_ARTICLE'] ?? '');
        if (!$inStock) {
            $note = $note !== '' ? $note . ' · Под заказ' : 'Под заказ';
        }
        $href = gg_product_url($item);
        $alt = $item['NAME'] . ($note !== '' ? ', ' . $note : '');
?>
      <article class="product<?= $inStock ? '' : ' product--muted' ?>">
        <div class="product__frame">
          <a class="product__shot" href="<?= gg_e($href) ?>" tabindex="-1" aria-hidden="true"><?=
            gg_media_slot('', '/media/products/' . $item['CODE'] . '.jpg', '1:1', 'product__photo', $alt)
          ?></a>
        </div>
        <div class="product__body">
          <h3 class="product__name"><a href="<?= gg_e($href) ?>"><?= gg_e($item['NAME']) ?></a></h3>
          <p class="product__note"><?= gg_e($note) ?></p>
          <p class="product__price"><?= gg_e(gg_price($price)) ?></p>
        </div>
      </article>
<?php endforeach; ?>
    </div>

<?php if (!empty($arResult['NAV_STRING'])): ?>
    <div class="catalog__more"><?= $arResult['NAV_STRING'] ?></div>
<?php endif; ?>
<?php endif; ?>
  </div>
</div>
