<?php
/**
 * Карточка товара.
 *
 * Разметка повторяет карточку прототипа (src/js/product/product-page.js).
 * Галерея здесь одна и сразу собрана сервером: фотографий в выгрузке 1С нет
 * ни у одной позиции, переключать нечего, и лента миниатюр не рисуется.
 *
 * Характеристики берутся из заполненных свойств — список и порядок задаёт
 * карта витрины (ключ specs). Свойств у чёрной икры четыре плюс артикул;
 * остальные сто двадцать свойств стандарта GS1 в выгрузке пустые, и строки
 * с прочерками карточке только мешают. Строки «В наличии — N шт» здесь
 * больше нет: статус стоит под ценой, а число банок на складе покупателю
 * ничего не решает.
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

/** Значение свойства как читаемая строка. */
$ggProps = gg_item_props($arResult)
    + (gg_props_for_ids([(int)$arResult['ID']], ['RYBA', 'KATEGORIYA', 'UPAKOVKA', 'ATRIBUT', 'CML2_ARTICLE'])[(int)$arResult['ID']] ?? []);
$val = static function (string $code) use ($ggProps): string {
    return trim((string)($ggProps[$code] ?? ''));
};

$price = gg_item_price($arResult);
$inStock = gg_item_quantity($arResult) > 0;

$species = $val('RYBA');
$line = $val('KATEGORIYA');
$pack = $val('UPAKOVKA');
$attr = $val('ATRIBUT');
$subtitle = implode(' · ', array_filter([$species, $line]));

/* Соседние фасовки той же линейки: у икры человек выбирает между банкой 50 г
   и банкой на килограмм, и это единственная ось, по которой позиции внутри
   линейки различаются. Запрос один, без цен — здесь нужны только адреса. */
$siblings = [];
if ($cat && $species !== '' && CModule::IncludeModule('iblock')) {
    $filter = gg_catalog_filter($cat);
    $filter['IBLOCK_ID'] = gg_map()['iblockId'];
    $filter['PROPERTY_RYBA'] = gg_prop_enum_ids('RYBA', [$species]);
    if ($line !== '') {
        $filter['PROPERTY_KATEGORIYA'] = gg_prop_enum_ids('KATEGORIYA', [$line]);
    }
    $res = CIBlockElement::GetList(
        ['NAME' => 'ASC'],
        $filter,
        false,
        ['nTopCount' => 12],
        ['ID', 'NAME', 'CODE', 'PROPERTY_UPAKOVKA']
    );
    while ($row = $res->Fetch()) {
        $label = trim((string)($row['PROPERTY_UPAKOVKA_VALUE'] ?? ''));
        if ($label === '') {
            continue;
        }
        $siblings[] = [
            'label' => $label,
            'href' => gg_product_url($row),
            'current' => (int)$row['ID'] === (int)$arResult['ID'],
        ];
    }
}

$alt = $arResult['NAME'] . ($pack !== '' ? ', ' . $pack : '');

/* Заголовок без хвоста фасовки: она стоит строкой ниже капсулами. */
$title = gg_item_title((string)$arResult['NAME'], $pack);

/* Статус под ценой. «Доставка день в день», а не «доставка сегодня»:
   часа отсечки в данных нет, и к вечеру «сегодня» стало бы неправдой. */
$status = $inStock
    ? 'В наличии · доставка день в день по Москве'
    : 'Под заказ · привезём примерно за ' . GG_PREORDER_DAYS . ' дней';

/* Вторая кнопка. У позиции без цены она называется «Узнать цену» и ведёт
   туда же: виджета эксперта на Битриксе пока нет, заявку принимают
   контакты. */
$secondLabel = $price === null ? 'Узнать цену' : 'Спросить эксперта';

/* Адрес формы — сам текущий адрес карточки. GetCurPage под правилом
   обработки адресов вернул бы физический /product/index.php. */
$formAction = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);

$specs = [];
foreach (($cat['specs'] ?? []) as $spec) {
    $value = $val($spec['prop']);
    if ($value !== '') {
        $specs[] = ['term' => $spec['label'], 'value' => $value];
    }
}
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
        <h1 class="pbuy__title"><?= gg_e($title) ?></h1>
<?php if ($subtitle !== ''): ?>
        <p class="pbuy__line"><?= gg_e($subtitle . ($attr !== '' ? ' · ' . $attr : '')) ?></p>
<?php endif; ?>
        <p class="pbuy__price"><?= gg_e(gg_price($price)) ?></p>
        <p class="pbuy__status<?= $inStock ? '' : ' is-preorder' ?>">
          <span class="pbuy__status-mark" aria-hidden="true">⬦</span><?= gg_e($status) ?>
        </p>

<?php if (count($siblings) > 1): ?>
        <div class="pbuy__row">
          <span class="pbuy__label">Фасовка</span>
          <div class="pbuy__chips" role="group" aria-label="Фасовка">
<?php foreach ($siblings as $sibling): ?>
            <a class="chip<?= $sibling['current'] ? ' is-active' : '' ?>" href="<?= gg_e($sibling['href']) ?>"><?= gg_e($sibling['label']) ?></a>
<?php endforeach; ?>
          </div>
        </div>
<?php endif; ?>

<?php if ($inStock): ?>
        <form class="pbuy__actions" method="get" action="<?= gg_e($formAction) ?>">
          <input type="hidden" name="action" value="ADD2BASKET">
          <input type="hidden" name="id" value="<?= (int)$arResult['ID'] ?>">
          <div class="qty" data-qty-hydrate role="group" aria-label="Количество">
            <button type="button" class="qty__btn" data-step="-1" aria-label="Меньше"><?= gg_icon('minus') ?></button>
            <input class="qty__value" type="text" inputmode="numeric" autocomplete="off"
                   name="quantity" value="1" min="1" max="99" maxlength="2" aria-label="Количество">
            <button type="button" class="qty__btn" data-step="1" aria-label="Больше"><?= gg_icon('plus') ?></button>
          </div>
          <button type="submit" class="btn btn--solid">В корзину</button>
          <a class="btn" href="/contacts"><?= gg_e($secondLabel) ?></a>
        </form>
<?php else: ?>
        <?php /* Позиция под заказ в корзину не кладётся: в настройках
                 торгового каталога «Разрешить покупку при отсутствии товара»
                 стоит «Нет», и Битрикс такую позицию в корзину не примет.
                 Пока настройку не включили — честная кнопка к менеджеру,
                 а не кнопка, которая молча ничего не делает. */ ?>
        <div class="pbuy__actions">
          <a class="btn btn--solid" href="/contacts">Заказать у менеджера</a>
          <a class="btn" href="/contacts"><?= gg_e($secondLabel) ?></a>
        </div>
<?php endif; ?>

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
<?php if ($specs): ?>
      <section class="pblock">
        <h2 class="pblock__title">Характеристики</h2>
        <dl class="pspecs">
<?php foreach ($specs as $row): ?>
          <div class="pspecs__row">
            <dt><?= gg_e($row['term']) ?></dt>
            <dd><?= gg_e($row['value']) ?></dd>
          </div>
<?php endforeach; ?>
        </dl>
      </section>
<?php endif; ?>

      <section class="pblock">
        <h2 class="pblock__title">Хранение</h2>
        <div class="pblock__text">
          <p>Осетровую икру держат при температуре от −4 до −2 °С. Открытую банку съедают в течение трёх суток и не хранят в морозильной камере: кристаллы льда рвут оболочку икринки.</p>
        </div>
      </section>
    </div>
  </div>
</div>
