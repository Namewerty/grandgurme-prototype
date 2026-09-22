<?php
/**
 * Результаты поиска: /search/?q=…
 *
 * Раньше здесь стояла страница демо-магазина с компонентом search.page,
 * настроенным на инфоблоки демо-одежды: товары 1С в него не попадали,
 * и на любой запрос он отвечал «ничего не найдено». Теперь выдача та же,
 * что у подсказок в шапке (include/search.php), а карточки — те же, что
 * в каталоге.
 */
define('GG_PAGE_CLASS', 'page-catalog');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/search.php';

$APPLICATION->SetPageProperty('robots', 'noindex, follow');

$query = gg_search_query((string)($_GET['q'] ?? ''));
$ids = mb_strlen($query) >= 2 ? gg_search_ids($query) : [];
$categories = mb_strlen($query) >= 2 ? array_slice(gg_search_categories($query), 0, 8) : [];

$total = count($ids);
$pages = max(1, (int)ceil($total / GG_SEARCH_PAGE_SIZE));
$page = max(1, min($pages, (int)($_GET['page'] ?? 1)));
$cards = gg_search_cards(array_slice($ids, ($page - 1) * GG_SEARCH_PAGE_SIZE, GG_SEARCH_PAGE_SIZE));

$APPLICATION->SetTitle($query !== '' ? 'Поиск: ' . $query . ' — №1 Гранд Гурмэ' : 'Поиск — №1 Гранд Гурмэ');

$pageUrl = static function (int $n) use ($query): string {
    $params = ['q' => $query];
    if ($n > 1) {
        $params['page'] = $n;
    }
    return '?' . http_build_query($params);
};

/* Популярные запросы для пустой выдачи — только те, что точно находят товары. */
$popular = ['икра белуги', 'осётр', 'красная икра', 'лосось', 'краб', 'оливки', 'чай'];
?>
<div class="catalog search-page">
  <div class="container">
    <nav class="crumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <span class="crumbs__current" aria-current="page">Поиск</span>
    </nav>

    <div class="catalog__head">
      <h1 class="catalog__title"><?= $query !== '' ? '«' . gg_e($query) . '»' : 'Поиск' ?></h1>
    </div>

    <form class="search-page__form" action="/search/" method="get" role="search">
      <label class="visually-hidden" for="search-page-q">Поиск по каталогу</label>
      <span class="search-page__icon" aria-hidden="true"><?= gg_icon('search') ?></span>
      <input class="search-page__input" id="search-page-q" type="search" name="q"
             value="<?= gg_e($query) ?>" placeholder="Икра, рыба, крабы, подарочные наборы…"
             autocomplete="off" spellcheck="false" enterkeyhint="search">
      <button class="btn btn--solid search-page__submit" type="submit">Найти</button>
    </form>

<?php if ($categories): ?>
    <div class="facets">
      <div class="facets__row">
        <span class="facets__label">Разделы</span>
        <div class="facets__rail chips">
<?php   foreach ($categories as $cat): ?>
          <a class="chip" href="<?= gg_e($cat['href']) ?>"><?= gg_e($cat['name']) ?><?php if (!empty($cat['parent'])): ?><span class="chip__num">· <?= gg_e($cat['parent']) ?></span><?php endif; ?></a>
<?php   endforeach; ?>
        </div>
      </div>
    </div>
<?php endif; ?>

<?php if ($query !== '' && $total > 0): ?>
    <div class="catalog__status">
      <p class="catalog__found">Найдено <b><?= gg_e(gg_plural_goods($total)) ?></b></p>
      <div></div>
    </div>

    <div class="catalog__grid">
<?php   foreach ($cards as $card):
            $alt = $card['name'] . ($card['note'] !== '' ? ', ' . $card['note'] : '');
?>
      <article class="product">
        <div class="product__frame">
          <a class="product__shot" href="<?= gg_e($card['href']) ?>" tabindex="-1" aria-hidden="true"><?= gg_product_shot($card['row'], $alt) ?></a>
          <?= gg_fav_button((int)$card['id'], $card['name']) ?>
          <?= gg_cart_add_button((int)$card['id'], $card['kind'], $alt) ?>
        </div>
        <div class="product__body">
          <h3 class="product__name"><a href="<?= gg_e($card['href']) ?>"><?= gg_e($card['name']) ?></a></h3>
<?php     if ($card['note'] !== ''): ?>
          <p class="product__note"><?= gg_e($card['note']) ?></p>
<?php     endif; ?>
          <p class="product__price"><?= gg_e($card['price']) ?></p>
<?php     if ($card['kind'] !== 'stock'): ?>
          <p class="product__tag"><?= gg_stock_tag($card['kind']) ?></p>
<?php     endif; ?>
        </div>
      </article>
<?php   endforeach; ?>
    </div>

<?php   if ($pages > 1): ?>
    <div class="catalog__more">
      <nav class="pager" aria-label="Страницы результатов">
<?php     if ($page > 1): ?>
        <a class="chip pager__link" rel="prev" href="<?= gg_e($pageUrl($page - 1)) ?>">Назад</a>
<?php     endif; ?>
<?php     for ($n = 1; $n <= $pages; $n++): ?>
<?php       if ($n === $page): ?>
        <span class="chip is-active" aria-current="page"><?= $n ?></span>
<?php       else: ?>
        <a class="chip pager__link" href="<?= gg_e($pageUrl($n)) ?>"><?= $n ?></a>
<?php       endif; ?>
<?php     endfor; ?>
<?php     if ($page < $pages): ?>
        <a class="chip pager__link" rel="next" href="<?= gg_e($pageUrl($page + 1)) ?>">Вперёд</a>
<?php     endif; ?>
      </nav>
    </div>
<?php   endif; ?>

<?php else: ?>
    <div class="catalog__grid is-empty">
      <div class="empty">
<?php   if ($query === ''): ?>
        <h2 class="empty__title">Что ищем?</h2>
        <p class="empty__hint">Название, вид рыбы, бренд, артикул или код товара</p>
<?php   else: ?>
        <h2 class="empty__title">Ничего не нашлось</h2>
        <p class="empty__hint">Проверьте раскладку и опечатки или посмотрите весь ассортимент — в каталоге есть фильтры по сорту и фасовке.</p>
<?php   endif; ?>
        <div class="chips search-page__popular">
<?php   foreach ($popular as $item): ?>
          <a class="chip" href="?<?= gg_e(http_build_query(['q' => $item])) ?>"><?= gg_e($item) ?></a>
<?php   endforeach; ?>
        </div>
        <a class="btn" href="/catalog">Открыть каталог</a>
      </div>
    </div>
<?php endif; ?>
  </div>
</div>
<?php
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
