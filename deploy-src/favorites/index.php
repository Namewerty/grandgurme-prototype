<?php
/**
 * Избранное /favorites/.
 *
 * РАБОТАЕТ БЕЗ ВХОДА. У гостя список лежит в cookie и страница идёт во всю
 * ширину контейнера с плашкой «Войдите…»; у вошедшего — каркас кабинета
 * и сетка в колонках 4–12 (.fav--account). Откуда берутся ID, решает
 * include/favorites.php: страница о хранилище не знает.
 *
 * СНИМКОВ ПОЗИЦИИ ЗДЕСЬ НЕТ. В прототипе избранное держит цену и наличие
 * копией — там нет сервера. Здесь хранятся только ID, а цена, остаток
 * и вид позиции считаются при каждой отрисовке (gg_products_live,
 * gg_item_kind), поэтому карточка избранного и карточка каталога никогда
 * не расходятся.
 *
 * КАПСУЛЫ ПО ВИДУ — только те виды, что есть, и только если их два и больше:
 * фильтр из одного значения — брак, а не выбор. Выбор живёт в адресе,
 * ?kind=stock|preorder|request; на сервере это ссылки, а не кнопки.
 *
 * РАЗМЕТКА КАРТОЧКИ — та же, что в сетке каталога
 * (components/bitrix/catalog.section/gg/template.php), плюс сердце в углу
 * кадра. Кнопки «в корзину» в сетке стенда нет ни там, ни здесь.
 */
define('GG_PAGE_CLASS', 'page-account page-favorites');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/favorites.php';

/* Сердце — обычная форма POST; разбирается до вывода и отвечает редиректом. */
gg_fav_handle_post();

$user = gg_account_user();
if ($user) {
    /* Формы каркаса кабинета: «Выйти». Гостю каркас не рисуется. */
    gg_account_handle_post('/favorites/');
}

$APPLICATION->SetTitle('Избранное — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

/* Снятые с продажи позиции уходят из хранилища здесь же, строка о них
   показывается один раз (gg_fav_ids). */
$dropped = 0;
$ids = gg_fav_ids($dropped);
$count = count($ids);

$live = gg_products_live($ids);
$goods = gg_goods_info_for_ids($ids);
$elements = gg_elements_for_ids($ids);

/* Карточки в порядке избранного — новые сверху. */
$cards = [];
foreach ($ids as $id) {
    if (!isset($elements[$id])) {
        continue;
    }
    $element = $elements[$id];
    $info = $goods[$id] ?? ['name' => (string)$element['NAME'], 'weight' => '', 'weighed' => false];
    $item = $live[$id] ?? ['id' => $id, 'price' => null, 'quantity' => 0.0, 'canBuy' => false];
    $title = (string)$info['name'];
    $weight = (string)$info['weight'];

    $cards[] = [
        'id' => $id,
        'element' => $element,
        'kind' => gg_item_kind($item),
        'title' => $title,
        'weight' => $weight,
        'price' => gg_price(gg_shelf_price($item['price'], $info)),
        'href' => gg_product_url($element),
        'alt' => $title . ($weight !== '' ? ', ' . $weight : ''),
    ];
}

/* Виды, которые в избранном есть. Порядок — KINDS прототипа. */
$labels = gg_fav_kind_labels();
$kinds = [];
foreach (array_keys($labels) as $key) {
    foreach ($cards as $card) {
        if ($card['kind'] === $key) {
            $kinds[] = $key;
            break;
        }
    }
}

$kind = (string)($_GET['kind'] ?? '');
if (!in_array($kind, $kinds, true)) {
    $kind = '';
}
$shown = $kind === '' ? $cards : array_values(array_filter($cards, static fn($card) => $card['kind'] === $kind));

if ($user) {
    gg_account_frame_open('favorites', [['label' => 'Избранное']]);
    ?>
      <div class="fav fav--account">
<?php
} else {
    ?>
<div class="container">
  <nav class="crumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a>
    <span class="crumbs__sep" aria-hidden="true"></span>
    <span class="crumbs__current" aria-current="page">Избранное</span>
  </nav>

  <div class="fav">
<?php
}
?>
        <h1 class="acc-title">Избранное</h1>
<?php if ($count): ?>
        <p class="acc-sub"><?= gg_e(gg_plural_goods($count)) ?></p>
<?php endif; ?>

<?php if (!$user && $count): ?>
        <?php /* Плашка нужна только там, где есть что терять: у гостя
                 с пустым избранным она предлагает войти ради ничего. */ ?>
        <div class="fav__guest">
          <p>Избранное сохранено в этом браузере. Войдите по номеру телефона, чтобы оно было с вами на любом устройстве.</p>
          <a class="btn" href="<?= gg_e(gg_login_url('/favorites/')) ?>">Войти</a>
        </div>
<?php endif; ?>

<?php if ($dropped > 0): ?>
        <p class="fav__dropped"><?= gg_e(gg_plural_goods($dropped) . ($dropped === 1 ? ' больше не продаётся' : ' больше не продаются') . ' — убрали из избранного') ?></p>
<?php endif; ?>

<?php if (count($kinds) >= 2): ?>
        <nav class="caps fav__caps" aria-label="Вид позиции">
          <a class="cap<?= $kind === '' ? ' is-active' : '' ?>" href="/favorites/" data-kind=""<?= $kind === '' ? ' aria-current="true"' : '' ?>><span class="cap__face">Все</span></a>
<?php   foreach ($kinds as $key): $on = $key === $kind; ?>
          <a class="cap<?= $on ? ' is-active' : '' ?>" href="/favorites/?kind=<?= gg_e($key) ?>" data-kind="<?= gg_e($key) ?>"<?= $on ? ' aria-current="true"' : '' ?>><span class="cap__face"><?= gg_e($labels[$key]) ?></span></a>
<?php   endforeach; ?>
        </nav>
<?php endif; ?>

<?php if (!$count): ?>
        <div class="acc-empty">
          <span class="acc-empty__icon" aria-hidden="true"><?= gg_icon('heart') ?></span>
          <h2 class="acc-empty__title">В избранном пока пусто</h2>
          <p class="acc-empty__text">Отмечайте товары сердцем в каталоге и на карточке товара — они соберутся здесь.</p>
          <a class="btn btn--solid" href="/catalog">В каталог</a>
        </div>
<?php else: ?>
        <div class="fav__grid">
<?php   foreach ($shown as $card): ?>
          <article class="product">
            <div class="product__frame">
              <a class="product__shot" href="<?= gg_e($card['href']) ?>" tabindex="-1" aria-hidden="true"><?= gg_product_shot($card['element'], $card['alt']) ?></a>
              <?= gg_fav_button((int)$card['id'], $card['title']) ?>
              <?= gg_cart_add_button((int)$card['id'], $card['kind'], $card['alt']) ?>
            </div>
            <div class="product__body">
              <h3 class="product__name"><a href="<?= gg_e($card['href']) ?>"><?= gg_e($card['title']) ?></a></h3>
<?php     if ($card['weight'] !== ''): ?>
              <p class="product__note"><?= gg_e($card['weight']) ?></p>
<?php     endif; ?>
              <p class="product__price"><?= gg_e($card['price']) ?></p>
<?php     if ($card['kind'] !== 'stock'): ?>
              <p class="product__tag"><?= gg_stock_tag($card['kind']) ?></p>
<?php     endif; ?>
            </div>
          </article>
<?php   endforeach; ?>
        </div>
<?php endif; ?>
<?php
if ($user) {
    ?>
      </div>
<?php
    gg_account_frame_close();
} else {
    ?>
  </div>
</div>
<?php
}

echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
