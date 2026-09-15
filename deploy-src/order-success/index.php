<?php
/**
 * «Заказ принят» — /order-success?n=<номер заказа>.
 *
 * Номер берётся из адреса, а не из памяти вкладки: страницу можно
 * перезагрузить, открыть из письма или прислать ссылкой менеджеру.
 * Номера нет — показывается содержимое /404: «Заказ № принят» без номера
 * это поломка, а не страница.
 *
 * СОСТАВ ПОКАЗЫВАЕТСЯ ТОЛЬКО ПО СВОЕМУ ЗАКАЗУ. Номер в адресе можно набрать
 * руками, поэтому состав и адрес доставки отдаются лишь тому, кто оформлял
 * заказ в этой сессии. Из другого браузера остаются номер и общие шаги —
 * страница не роняется и чужого не показывает.
 */
define('GG_PAGE_CLASS', 'page-order');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/checkout.php';

$number = (string)($_GET['n'] ?? '');

if ($number === '' || !preg_match('/^\d+$/', $number)) {
    CHTTP::SetStatus('404 Not Found');
    @define('ERROR_404', 'Y');
    $APPLICATION->SetTitle('Страница не найдена');
    ?>
    <div class="page__inner">
      <p class="eyebrow">ОШИБКА 404</p>
      <h1 class="page__title">Страница не найдена</h1>
      <p class="page__p page__lead">Такого адреса на сайте нет: страница могла переехать или адрес набран с опечаткой.</p>
      <ul class="page__links">
        <li><a href="/catalog">Каталог</a></li>
        <li><a href="/cart/">Корзина</a></li>
        <li><a href="/contacts">Контакты</a></li>
        <li><a href="/">На главную</a></li>
      </ul>
    </div>
    <?php
    require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
    die();
}

$APPLICATION->SetTitle('Заказ №' . $number . ' принят — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$own = gg_own_order($number);

/* Состав — из самого заказа, а не из снимка: цена и количество могли
   поменяться при подтверждении, и показывать старое было бы враньём. */
$items = [];
$orderTotal = null;
if ($own && CModule::IncludeModule('sale')) {
    try {
        $order = \Bitrix\Sale\Order::load((int)$own['id']);
        if ($order) {
            $orderTotal = (float)$order->getPrice();
            $ids = [];
            foreach ($order->getBasket() as $item) {
                $ids[] = (int)$item->getProductId();
            }
            $props = gg_props_for_ids($ids, ['UPAKOVKA']);
            foreach ($order->getBasket() as $item) {
                $pid = (int)$item->getProductId();
                $pack = trim((string)($props[$pid]['UPAKOVKA'] ?? ''));
                $price = (float)$item->getPrice();
                $items[] = [
                    'name' => gg_item_title((string)$item->getField('NAME'), $pack),
                    'note' => $pack,
                    'qty' => (int)$item->getQuantity(),
                    'sum' => $price > 0 ? $price * (int)$item->getQuantity() : null,
                ];
            }
        }
    } catch (\Throwable $e) {
        $items = [];
    }
}

/* Шаги «что дальше». Шаг с оплатой — только если сумма уточняется. */
$steps = [['title' => 'Менеджер подтвердит состав и сумму', 'text' => 'Позвоним или напишем на номер из заказа']];

if ($own) {
    $ready = (int)$own['readyAt'];
    $sameDay = gg_day_start((int)$own['createdAt']) === gg_day_start($ready);
    $steps[] = [
        'title' => 'Соберём заказ',
        'text' => $sameDay ? 'В день заказа' : 'К ' . gg_format_day_month($ready),
    ];
    if ((int)$own['onRequest'] > 0) {
        $steps[] = [
            'title' => 'Пришлём ссылку на оплату',
            'text' => 'Как только сумма будет подтверждена — в сообщения на ваш телефон',
        ];
    }
    $day = gg_day_from_iso((string)$own['date']);
    $when = trim(implode(', ', array_filter([$day ? gg_format_day_month($day) : '', (string)$own['interval']])));
    $where = trim(implode(' · ', array_filter([$when, (string)$own['address']])));
    $steps[] = $own['method'] === 'pickup'
        ? ['title' => 'Будем ждать вас в бутике', 'text' => $where]
        : ['title' => 'Привезём в выбранный интервал', 'text' => $where];
} else {
    $steps[] = ['title' => 'Соберём заказ', 'text' => ''];
    $steps[] = ['title' => 'Привезём в выбранный интервал', 'text' => ''];
}

$contacts = gg()['contacts'];
?>
<div class="container">
  <div class="order-done">
    <h1 class="order-done__title">Заказ №<?= gg_e($number) ?> принят</h1>
    <p class="order-done__lead">Подтверждение отправили на почту и в СМС</p>

    <section class="order-done__block" aria-labelledby="order-next">
      <h2 class="co-label" id="order-next">Что дальше</h2>
      <ol class="order-steps">
<?php foreach ($steps as $i => $step): ?>
        <li class="order-steps__item">
          <span class="order-steps__num" aria-hidden="true"><?= $i + 1 ?></span>
          <span class="order-steps__body">
            <span class="order-steps__title"><?= gg_e($step['title']) ?></span>
<?php if (trim((string)$step['text']) !== ''): ?>
            <span class="order-steps__text"><?= gg_e($step['text']) ?></span>
<?php endif; ?>
          </span>
        </li>
<?php endforeach; ?>
      </ol>
    </section>

<?php if ($items): ?>
    <section class="order-done__block" aria-labelledby="order-items">
      <h2 class="co-label" id="order-items">Состав заказа</h2>
      <ul class="order-lines">
<?php foreach ($items as $item): ?>
        <li class="order-lines__row">
          <span class="order-lines__name"><?= gg_e($item['name']) ?>
            <span class="order-lines__note"><?= gg_e(trim($item['note'] . ' × ' . $item['qty'], ' ')) ?></span>
          </span>
          <span class="order-lines__sum"><?= gg_e($item['sum'] === null ? 'Цена по запросу' : gg_price((float)$item['sum'])) ?></span>
        </li>
<?php endforeach; ?>
      </ul>
      <p class="order-lines__total"><span>Итого</span><span><?=
        gg_e(((int)$own['onRequest'] > 0 || $orderTotal === null) ? 'после подтверждения' : gg_price((float)$orderTotal))
      ?></span></p>
<?php if ((int)$own['onRequest'] > 0): ?>
      <p class="summary__note"><?= (int)$own['onRequest'] === 1
        ? 'По одной позиции цену подтвердит менеджер, итог изменится'
        : 'По ' . (int)$own['onRequest'] . ' позициям цену подтвердит менеджер, итог изменится' ?></p>
<?php endif; ?>
    </section>
<?php endif; ?>

    <section class="order-done__block" aria-labelledby="order-contacts">
      <h2 class="co-label" id="order-contacts">Если нужно что-то поменять</h2>
      <p class="order-done__contacts">
        <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a>
        <a href="<?= gg_e($contacts['whatsapp']) ?>" target="_blank" rel="noopener">WhatsApp</a>
        <a href="<?= gg_e($contacts['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
      </p>
    </section>

    <?php /* Кнопки «Мои заказы» здесь нет: кабинета на стенде нет, оформление
             идёт без регистрации, и ссылка вела бы в никуда. Вернётся вместе
             с кабинетом и входом по коду из СМС. */ ?>
    <div class="order-done__actions">
      <a class="btn btn--solid" href="/catalog">В каталог</a>
    </div>
  </div>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
