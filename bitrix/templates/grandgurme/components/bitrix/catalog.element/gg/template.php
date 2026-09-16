<?php
/**
 * Карточка товара.
 *
 * Разметка повторяет карточку прототипа (src/js/product/product-page.js).
 * Галерея здесь одна и сразу собрана сервером: фотографий в выгрузке 1С нет
 * ни у одной позиции, переключать нечего, и лента миниатюр не рисуется.
 *
 * НАЗВАНИЕ, ВЕС И АРТИКУЛ (16.09.2026) — include/product-info.php.
 * Как на grandgurme.ru: над заголовком мелко артикул, заголовок — название
 * для печати, под ним вес («50 г», у весового товара «100 г»), цена — за
 * этот вес. Характеристик, упаковки и кодов из 1С карточка не показывает:
 * в выгрузке они заведены разными словами, характеристики будут заводиться
 * отдельно. Фасовки соседних позиций капсулами убраны по той же причине —
 * подписями капсул были сырые значения «Упаковки».
 *
 * ВИД ПОЗИЦИИ (16.09.2026) — gg_item_kind: метка и одно предложение под
 * ценой. «В наличии» и «под заказ» кладутся в корзину (action=ADD2BASKET,
 * запрос перехватывает /product/index.php, чтобы показать тост), «по заявке»
 * — в заявку менеджеру (gg_action=request_add, include/requests.php).
 * Кнопки «Заказать у менеджера» больше нет: её место заняла «Добавить
 * в заявку».
 *
 * СТЕППЕР И «В КОРЗИНУ» — ОДНА ФОРМА, и форма эта и есть .pbuy__actions:
 * отдельная обёртка сломала бы ряд кнопок, а без формы количество пришлось
 * бы дописывать в адрес скриптом. Без JS форма работает как есть, скрипт
 * только оживляет кнопки − и + (src/bitrix/qty-hydrate.js).
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();
/** @var array $arParams */
/** @var array $arResult */
/** @var CMain $APPLICATION */

require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/catalog.php';

$cat = gg_catalog_category((string)($arParams['GG_CATEGORY_SLUG'] ?? ''));

/* Название для печати, вес, весовой ли товар и артикул (product-info.php). */
$goods = gg_goods_info_for_ids([(int)$arResult['ID']])[(int)$arResult['ID']]
    ?? ['name' => (string)$arResult['NAME'], 'weight' => '', 'weighed' => false, 'article' => ''];

$price = gg_item_price($arResult);

/* Вид считает только gg_item_kind: цена, живой остаток, CAN_BUY компонента
   и раздел витрины. Раздел карточки ($cat) определён по разделам товара
   с учётом вложенности — см. /product/index.php. */
$kind = gg_item_kind($arResult, $cat);
$kindText = [
    'stock' => 'Доставим день в день по Москве',
    'preorder' => 'Закажем и привезём к ' . gg_format_day_month(gg_add_days(gg_day_start(), GG_PREORDER_DAYS)),
    'request' => 'Менеджер уточнит цену и срок поставки и свяжется с вами. Оплатить этот товар на сайте нельзя.',
][$kind];

/* Заголовок — название для печати целиком, как на grandgurme.ru. */
$title = $goods['name'];
$alt = $title . ($goods['weight'] !== '' ? ', ' . $goods['weight'] : '');

/* Вторая кнопка. У позиции без цены она называется «Узнать цену» и ведёт
   туда же: виджета эксперта на Битриксе пока нет, заявку принимают
   контакты. */
$secondLabel = $price === null ? 'Узнать цену' : 'Спросить эксперта';

/* Адрес формы — сам текущий адрес карточки. GetCurPage под правилом
   обработки адресов вернул бы физический /product/index.php. */
$formAction = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);

?>
<div class="product-page">
  <div class="container">
    <nav class="crumbs" aria-label="Хлебные крошки">
      <a href="/">Главная</a>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <a href="/catalog">Каталог</a>
<?php if ($cat): ?>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <a href="<?= gg_e(gg_category_url($cat['slug'])) ?>"><?= gg_e($cat['name']) ?></a>
<?php endif; ?>
      <span class="crumbs__sep" aria-hidden="true"></span>
      <span class="crumbs__current" aria-current="page"><?= gg_e($title) ?></span>
    </nav>

    <div class="ptop">
      <div class="pgallery" data-gallery>
        <div class="pgallery__main"><?= gg_product_shot($arResult, $alt, 'pgallery__photo') ?></div>
      </div>

      <div class="pbuy">
<?php if ($goods['article'] !== ''): ?>
        <p class="pbuy__article">Артикул <?= gg_e($goods['article']) ?></p>
<?php endif; ?>
        <h1 class="pbuy__title"><?= gg_e($title) ?></h1>
<?php if ($goods['weight'] !== ''): ?>
        <p class="pbuy__line"><?= gg_e($goods['weight']) ?></p>
<?php endif; ?>
        <p class="pbuy__price"><?= gg_e(gg_price(gg_shelf_price($price, $goods['weighed']))) ?></p>
        <div class="pbuy__kind">
          <?= gg_stock_tag($kind) ?>
          <p class="pbuy__kind-text"><?= gg_e($kindText) ?></p>
        </div>

        <?php /* Одна форма на оба пути: «в корзину» — ADD2BASKET, «в заявку» —
                 request_add. POST с проверкой сессии; без JS работает как есть. */ ?>
        <form class="pbuy__actions" method="post" action="<?= gg_e($formAction) ?>">
          <?= bitrix_sessid_post() ?>
<?php if ($kind === 'request'): ?>
          <input type="hidden" name="gg_action" value="request_add">
<?php else: ?>
          <input type="hidden" name="action" value="ADD2BASKET">
<?php endif; ?>
          <input type="hidden" name="id" value="<?= (int)$arResult['ID'] ?>">
          <div class="qty" data-qty-hydrate role="group" aria-label="Количество">
            <button type="button" class="qty__btn" data-step="-1" aria-label="Меньше"><?= gg_icon('minus') ?></button>
            <input class="qty__value" type="text" inputmode="numeric" autocomplete="off"
                   name="quantity" value="1" min="1" max="99" maxlength="2" aria-label="Количество">
            <button type="button" class="qty__btn" data-step="1" aria-label="Больше"><?= gg_icon('plus') ?></button>
          </div>
          <button type="submit" class="btn btn--solid"><?= $kind === 'request' ? 'Добавить в заявку' : 'В корзину' ?></button>
          <a class="btn" href="/contacts"><?= gg_e($secondLabel) ?></a>
        </form>

        <?php /* Обещания и их иконки — те же три, что в прототипе
                 (src/data/product-copy.js). Иконка обязательна: строка
                 свёрстана сеткой «22px + текст», и без первой колонки
                 текст переносится по одному слову. */ ?>
        <ul class="pbuy__promises">
<?php foreach ([
    ['coldChain', 'Непрерывная холодовая цепь до двери'],
    ['sameDay', 'Доставка день в день по Москве и области'],
    ['docStamp', 'Документы на партию по запросу'],
] as [$icon, $text]): ?>
          <li class="pbuy__promise">
            <span class="pbuy__promise-icon" aria-hidden="true"><?= gg_icon($icon) ?></span>
            <span><?= gg_e($text) ?></span>
          </li>
<?php endforeach; ?>
        </ul>
      </div>
    </div>

    <div class="pblocks">
<?php if (($cat['slug'] ?? '') === 'chernaya-ikra'): ?>
      <?php /* Текст про осетровую икру — только ей. До 16.09 он стоял на всех
               карточках, включая шоколад и чай. */ ?>
      <section class="pblock">
        <h2 class="pblock__title">Хранение</h2>
        <div class="pblock__text">
          <p>Осетровую икру держат при температуре от −4 до −2 °С. Открытую банку съедают в течение трёх суток и не хранят в морозильной камере: кристаллы льда рвут оболочку икринки.</p>
        </div>
      </section>
<?php endif; ?>
    </div>
  </div>
</div>
