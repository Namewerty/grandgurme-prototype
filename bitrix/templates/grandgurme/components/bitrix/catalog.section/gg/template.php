<?php
/**
 * Список товаров раздела витрины.
 *
 * Разметка повторяет страницу категории прототипа (src/js/catalog/category-page.js)
 * до класса: стили общие, и любое расхождение сразу видно как сломанная вёрстка.
 * Отличие одно и оно осознанное — фильтры здесь ссылки, а не кнопки: страница
 * рисуется сервером, перезагрузка честнее мигающей выдачи без JS.
 *
 * Оси раскладываются по трём видам, как в прототипе: главная ось строкой
 * капсул, вторая — строкой табов, остальное уходит в раскрывающийся список
 * рядом с сортировкой. Семь пилюль с кружками счётчиков, развёрнутые в строку,
 * забирали внимание у самой выдачи.
 *
 * СТРОКА «НАЛИЧИЕ» стоит над строкой «Фильтры» на всех разделах, в одном и
 * том же месте (renderStockRow прототипа). Левая капсула — не кнопка: это база
 * выдачи, выключить её нельзя, и обещать переключатель, который не
 * переключается, нечестно. Правая работает как чекбокс и живёт в ?stock=all.
 * Порядок выдачи (наличие, потом под заказ) считает gg_catalog_page.
 *
 * ВИД ПОЗИЦИИ (16.09.2026). Под ценой — метка .stock-tag для «под заказ»
 * и «по заявке» (gg_item_kind, gg_stock_tag). У «в наличии» метки в сетке
 * нет: наличие здесь норма. Приглушённого кадра и приписки «· под заказ»
 * к фасовке больше нет. Кнопки добавления в сетке стенда нет.
 *
 * Кадров у товаров нет ни одного: фотографии в выгрузку 1С не попали.
 * Пока файла нет, на месте кадра стоит знак марки (gg_product_shot).
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
$sortKey = gg_catalog_sort_key();
$sorts = gg_catalog_sorts();

/* Наличие по выбранному и по разделу целиком. Разница нужна одной строке:
   «сейчас со склада нет» — факт о разделе, «по выбранному со склада нет» —
   о выборе. Сказать первое, когда на складе четыре банки осетра, значит
   соврать о разделе. */
$stock = gg_stock_view($cat, $picked);
$sectionStock = gg_catalog_stock_counts($cat, []);

$page = gg_catalog_page($cat, $picked, $sortKey);
$found = $page['total'];
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

/* Оси, которые разворачиваются в строку, и оси, которые уходят в список. */
$railFacets = [];
$dropFacets = [];
foreach (gg_catalog_facets($cat) as $facet) {
    if (($facet['style'] ?? 'chips') === 'pills') {
        $dropFacets[] = $facet;
    } else {
        $railFacets[] = $facet;
    }
}
$chevron = gg_icon('chevronDown');
$resetUrl = gg_catalog_reset_url($cat);

/* Счётчик над сеткой. Три случая, и каждый говорит о своём: под заказ нет
   вовсе — обычное «Найдено N товаров»; на складе нет — только привоз;
   есть и то и другое — сколько сейчас и сколько ещё можно привезти. */
if ($found === 0 || $stock['preorder'] === 0) {
    $foundText = 'Найдено <b>' . gg_e(gg_plural_goods($found)) . '</b>';
} elseif ($stock['inStock'] === 0) {
    $foundText = '<b>' . (int)$stock['preorder'] . ' под заказ</b>';
} else {
    $foundText = '<b>' . (int)$stock['inStock'] . ' в наличии</b>, ещё ' . (int)$stock['preorder'] . ' под заказ';
}

/* Порядок выдачи задаётся списком ID: компонент отдаёт двенадцать позиций
   страницы в своём порядке, а группы «наличие / под заказ» и выбор человека
   уже сведены в gg_catalog_page. */
$items = $arResult['ITEMS'] ?? [];
if ($items && $page['ids']) {
    $byId = [];
    foreach ($items as $item) {
        $byId[(int)$item['ID']] = $item;
    }
    $items = [];
    foreach ($page['ids'] as $id) {
        if (isset($byId[$id])) {
            $items[] = $byId[$id];
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
<?php foreach ($railFacets as $facet):
    $style = $facet['style'] ?? 'chips';
    $current = $picked[$facet['key']] ?? '';
    $itemClass = $style === 'tabs' ? 'tab' : 'chip';
    $railClass = $style === 'tabs' ? 'tabs' : 'chips';
?>
      <div class="facets__row">
        <span class="facets__label"><?= gg_e($facet['label']) ?></span>
        <div class="facets__rail <?= $railClass ?>">
          <a class="<?= $itemClass ?><?= $current === '' ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_url($cat, $picked, $facet['key'], '')) ?>"><?= gg_e($facet['anyLabel'] ?? 'Все') ?></a>
<?php   foreach ($facet['options'] as $option):
            $on = $current === $option['slug'];
            /* Число у опции — сколько человек увидит, выбрав её: с тем же
               правилом наличия, что у выдачи. Иначе у «Белуги», которой нет
               на складе, стоял бы ноль и опция пропала бы из строки. */
            $count = gg_catalog_count_shown($cat, array_merge($picked, [$facet['key'] => $option['slug']]));
            /* Вариант, под который в разделе нет ни одного товара — ни со
               склада, ни под заказ, — не показываем: фильтр, ведущий
               в пустоту, — это обещание, которого нет за чем. */
            if ($count === 0 && !$on) {
                continue;
            }
?>
          <a class="<?= $itemClass ?><?= $on ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_url($cat, $picked, $facet['key'], $on ? '' : $option['slug'])) ?>"><?= gg_e($option['name']) ?></a>
<?php   endforeach; ?>
        </div>
      </div>
<?php endforeach; ?>

      <div class="facets__row">
        <span class="facets__label">Наличие</span>
        <div class="facets__rail chips">
<?php if ($stock['forced']): ?>
          <p class="stock-note"><?= $sectionStock['inStock'] === 0
              ? 'Сейчас со склада нет · показываем под заказ'
              : 'По выбранному со склада нет · показываем под заказ' ?></p>
<?php else: ?>
          <span class="chip is-active chip--base">В наличии<span class="chip__num">· <?= (int)$stock['inStock'] ?></span></span>
<?php   if ($stock['preorder'] === 0): ?>
          <span class="chip" aria-disabled="true"><span class="chip__check"><?= gg_icon('plus') ?></span>и под заказ<span class="chip__num">· 0</span></span>
<?php   else: ?>
          <a class="chip<?= gg_stock_on() ? ' is-active' : '' ?>"
             href="<?= gg_e(gg_catalog_stock_url($cat, $picked, !gg_stock_on())) ?>"
             aria-pressed="<?= gg_stock_on() ? 'true' : 'false' ?>"><span class="chip__check"><?= gg_icon('plus') ?></span>и под заказ<span class="chip__num">· <?= (int)$stock['preorder'] ?></span></a>
<?php   endif; ?>
<?php endif; ?>
        </div>
      </div>

      <div class="facets__row facets__row--bar">
        <span class="facets__label">Фильтры</span>
        <div class="facets__bar">
<?php foreach ($dropFacets as $facet):
        $key = $facet['key'];
        $current = $picked[$key] ?? '';
        $anyCount = gg_catalog_count_shown($cat, array_merge($picked, [$key => '']));
?>
          <details class="drop">
            <summary class="pill<?= $current !== '' ? ' is-active' : '' ?>"><?= gg_e($facet['label']) ?><?php
              if ($current !== ''): ?><span class="pill__count">1</span><?php endif; ?>
              <span class="pill__chevron" aria-hidden="true"><?= $chevron ?></span>
            </summary>
            <div class="drop__pop drop__pop--wide">
              <div class="pop__list" data-lenis-prevent>
                <a class="opt opt--radio<?= $current === '' ? ' is-on' : '' ?>"
                   href="<?= gg_e(gg_catalog_url($cat, $picked, $key, '')) ?>">
                  <span class="opt__radio" aria-hidden="true"></span>
                  <span class="opt__name"><?= gg_e($facet['anyLabel'] ?? 'Все') ?></span>
                  <span class="opt__count"><?= $anyCount ?></span>
                </a>
<?php   foreach ($facet['options'] as $option):
            $on = $current === $option['slug'];
            $count = gg_catalog_count_shown($cat, array_merge($picked, [$key => $option['slug']]));
            if ($count === 0 && !$on) {
                continue;
            }
?>
                <a class="opt opt--radio<?= $on ? ' is-on' : '' ?>"
                   href="<?= gg_e(gg_catalog_url($cat, $picked, $key, $on ? '' : $option['slug'])) ?>">
                  <span class="opt__radio" aria-hidden="true"></span>
                  <span class="opt__name"><?= gg_e($option['name']) ?></span>
                  <span class="opt__count"><?= $count ?></span>
                </a>
<?php   endforeach; ?>
              </div>
            </div>
          </details>
<?php endforeach; ?>
<?php if ($dropFacets): ?>
          <span class="bar__divider" aria-hidden="true"></span>
<?php endif; ?>
          <details class="drop">
            <summary class="pill pill--sort">Сортировка: <b><?= gg_e($sorts[$sortKey]['label']) ?></b>
              <span class="pill__chevron" aria-hidden="true"><?= $chevron ?></span>
            </summary>
            <div class="drop__pop">
              <div class="pop__list">
<?php foreach ($sorts as $key => $sort): ?>
                <a class="opt opt--radio<?= $key === $sortKey ? ' is-on' : '' ?>"
                   href="<?= gg_e(gg_catalog_sort_url($cat, $picked, $key)) ?>">
                  <span class="opt__radio" aria-hidden="true"></span>
                  <span class="opt__name"><?= gg_e($sort['label']) ?></span>
                </a>
<?php endforeach; ?>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <div class="catalog__rule" aria-hidden="true"><span style="width: <?= round($share, 2) ?>%"></span></div>

    <div class="catalog__status">
      <p class="catalog__found"><?= $foundText ?></p>
      <div><?php if ($appliedChips): ?><a class="link-btn" href="<?= gg_e($resetUrl) ?>">Сбросить всё</a><?php endif; ?></div>
    </div>

    <div class="catalog__applied<?= $appliedChips ? '' : ' is-empty' ?>">
<?php foreach ($appliedChips as $chip): ?>
      <a class="applied" href="<?= gg_e($chip['href']) ?>"><?= gg_e($chip['label']) ?><span class="applied__x" aria-hidden="true"><?= gg_icon('close') ?></span></a>
<?php endforeach; ?>
    </div>

<?php if (!$items): ?>
    <div class="catalog__grid is-empty">
      <div class="empty">
        <h2 class="empty__title">Ничего не нашлось</h2>
        <p class="empty__hint">Попробуйте снять фильтр или сбросить всё</p>
        <a class="btn" href="<?= gg_e($resetUrl) ?>">Сбросить фильтры</a>
      </div>
    </div>
<?php else: ?>
    <div class="catalog__grid">
<?php
    /* Свойства для всей страницы выдачи — одним запросом, см. gg_props_for_ids. */
    $ggPagePropsById = gg_props_for_ids(array_column($items, 'ID'), ['UPAKOVKA', 'RYBA', 'KATEGORIYA', 'CML2_ARTICLE']);
    foreach ($items as $item):
        $price = gg_item_price($item);
        $props = gg_item_props($item) + ($ggPagePropsById[(int)$item['ID']] ?? []);
        $pack = $props['UPAKOVKA'] ?? '';
        $title = gg_item_title((string)$item['NAME'], $pack);
        $note = $pack !== '' ? $pack : ($props['CML2_ARTICLE'] ?? '');
        $kind = gg_item_kind($item, $cat);
        $href = gg_product_url($item);
        $alt = $item['NAME'] . ($pack !== '' ? ', ' . $pack : '');
?>
      <article class="product">
        <div class="product__frame">
          <a class="product__shot" href="<?= gg_e($href) ?>" tabindex="-1" aria-hidden="true"><?= gg_product_shot($item, $alt) ?></a>
        </div>
        <div class="product__body">
          <h3 class="product__name"><a href="<?= gg_e($href) ?>"><?= gg_e($title) ?></a></h3>
          <p class="product__note"><?= gg_e($note) ?></p>
          <p class="product__price"><?= gg_e(gg_price($price)) ?></p>
<?php   if ($kind !== 'stock'): ?>
          <p class="product__tag"><?= gg_stock_tag($kind) ?></p>
<?php   endif; ?>
        </div>
      </article>
<?php endforeach; ?>
    </div>

<?php if ($page['pages'] > 1): ?>
    <div class="catalog__more">
      <nav class="pager" aria-label="Страницы каталога">
<?php   if ($page['page'] > 1): ?>
        <a class="chip pager__link" rel="prev" href="<?= gg_e(gg_catalog_page_url($cat, $picked, $page['page'] - 1)) ?>">Назад</a>
<?php   endif; ?>
<?php   for ($n = 1; $n <= $page['pages']; $n++): ?>
<?php     if ($n === $page['page']): ?>
        <span class="chip is-active" aria-current="page"><?= $n ?></span>
<?php     else: ?>
        <a class="chip pager__link" href="<?= gg_e(gg_catalog_page_url($cat, $picked, $n)) ?>"><?= $n ?></a>
<?php     endif; ?>
<?php   endfor; ?>
<?php   if ($page['page'] < $page['pages']): ?>
        <a class="chip pager__link" rel="next" href="<?= gg_e(gg_catalog_page_url($cat, $picked, $page['page'] + 1)) ?>">Вперёд</a>
<?php   endif; ?>
      </nav>
    </div>
<?php endif; ?>
<?php endif; ?>
  </div>
</div>
