<?php
/**
 * «Заказ принят» — /order-success?n=<номер заказа>&r=<номер заявки>.
 *
 * Любого из параметров может не быть — как в src/js/checkout/success-page.js:
 *   только n — «Заказ №… принят», шаги заказа и состав;
 *   n и r    — то же и отдельный блок «Заявка №… у менеджера»;
 *   только r — «Заявка №… отправлена», шаги заявки и состав.
 * Нет ни того, ни другого — содержимое /404.
 *
 * СОСТАВ ПОКАЗЫВАЕТСЯ ТОЛЬКО СВОЕЙ СЕССИИ. Номер в адресе можно набрать
 * руками, поэтому состав, адрес и способ связи отдаются лишь тому, кто
 * оформлял в этой сессии. Из другого браузера остаются номер и общие шаги.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: порядок работы с заявкой и срок ответа
 * менеджера. Строк про оплату у заявки нет намеренно.
 */
define('GG_PAGE_CLASS', 'page-order');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/checkout.php';

$number = (string)($_GET['n'] ?? '');
$requestNumber = (string)($_GET['r'] ?? '');
$number = preg_match('/^\d+$/', $number) ? $number : '';
$requestNumber = preg_match('/^\d+$/', $requestNumber) ? $requestNumber : '';

if ($number === '' && $requestNumber === '') {
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

$title = $number !== '' ? 'Заказ №' . $number . ' принят' : 'Заявка №' . $requestNumber . ' отправлена';
$APPLICATION->SetTitle($title . ' — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$own = $number !== '' ? gg_own_order($number) : null;
$ownRequest = $requestNumber !== '' ? gg_own_request($requestNumber) : null;
$ways = gg_contact_ways();
$way = $ownRequest && isset($ways[$ownRequest['contactWay']]) ? $ways[$ownRequest['contactWay']]['how'] : '';

/* Состав заказа — из самого заказа, а не из снимка: цена и количество могли
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
                $items[] = [
                    'name' => gg_item_title((string)$item->getField('NAME'), $pack),
                    'note' => $pack,
                    'qty' => (int)$item->getQuantity(),
                    'sum' => (float)$item->getPrice() * (int)$item->getQuantity(),
                ];
            }
        }
    } catch (\Throwable $e) {
        $items = [];
    }
}

/* Шаги заказа. Две отгрузки — два шага доставки со своими датами. */
$steps = [['title' => 'Менеджер подтвердит состав и сумму', 'text' => 'Позвоним или напишем на номер из заказа']];
if ($own) {
    $ready = (int)$own['readyAt'];
    $sameDay = gg_day_start((int)$own['createdAt']) === gg_day_start($ready);
    $steps[] = ['title' => 'Соберём заказ', 'text' => $sameDay ? 'В день заказа' : 'К ' . gg_format_day_month($ready)];

    $pickup = $own['method'] === 'pickup';
    $whereFor = static function (array $shipment) use ($own): string {
        $day = gg_day_from_iso((string)$shipment['date']);
        $when = trim(implode(', ', array_filter([$day ? gg_format_day_month($day) : '', (string)$shipment['interval']])));
        return trim(implode(' · ', array_filter([$when, (string)$own['address']])));
    };
    $shipments = $own['shipments'] ?? [];
    if (count($shipments) === 2) {
        $steps[] = ['title' => $pickup ? 'Товары в наличии будут ждать вас в бутике' : 'Привезём товары в наличии', 'text' => $whereFor($shipments[0])];
        $steps[] = ['title' => $pickup ? 'Товары под заказ будут ждать вас в бутике' : 'Привезём товары под заказ', 'text' => $whereFor($shipments[1])];
    } else {
        $steps[] = ['title' => $pickup ? 'Будем ждать вас в бутике' : 'Привезём в выбранный интервал', 'text' => $shipments ? $whereFor($shipments[0]) : ''];
    }
} else {
    $steps[] = ['title' => 'Соберём заказ', 'text' => ''];
    $steps[] = ['title' => 'Привезём в выбранный интервал', 'text' => ''];
}

/* Шаги заявки. */
$requestSteps = [
    ['title' => 'Менеджер свяжется с вами', 'text' => $way !== '' ? mb_strtoupper(mb_substr($way, 0, 1)) . mb_substr($way, 1) . ', на номер из заявки' : ''],
    ['title' => 'Уточнит цену и срок поставки', 'text' => ''],
];

$contacts = gg()['contacts'];

$stepsList = static function (array $list): string {
    $html = '<ol class="order-steps">';
    foreach ($list as $i => $s) {
        $html .= '<li class="order-steps__item">'
            . '<span class="order-steps__num" aria-hidden="true">' . ($i + 1) . '</span>'
            . '<span class="order-steps__body"><span class="order-steps__title">' . gg_e($s['title']) . '</span>'
            . (trim((string)$s['text']) !== '' ? '<span class="order-steps__text">' . gg_e($s['text']) . '</span>' : '')
            . '</span></li>';
    }
    return $html . '</ol>';
};

$requestItems = static function (?array $request): string {
    if (!$request || empty($request['items'])) {
        return '';
    }
    $html = '<section class="order-done__block" aria-labelledby="request-items">'
        . '<h2 class="co-label" id="request-items">Состав заявки</h2><ul class="order-lines">';
    foreach ($request['items'] as $item) {
        $html .= '<li class="order-lines__row"><span class="order-lines__name">' . gg_e($item['name'])
            . '<span class="order-lines__note">' . gg_e(trim($item['note'] . ' × ' . $item['qty'])) . '</span></span></li>';
    }
    return $html . '</ul></section>';
};
?>
<div class="container">
  <div class="order-done">
    <h1 class="order-done__title"><?= gg_e($title) ?></h1>
<?php if ($number !== ''): ?>
    <p class="order-done__lead">Подтверждение отправили на почту и в СМС</p>
<?php elseif ($way !== ''): ?>
    <p class="order-done__lead">Менеджер свяжется с вами: <?= gg_e($way) ?></p>
<?php endif; ?>

<?php if ($own && !empty($own['requestFailed'])): ?>
    <p class="ready-line co-note" role="alert"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>Заявку отправить не удалось, позвоните нам: <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a></span></p>
<?php endif; ?>

<?php if ($number !== ''): ?>
    <section class="order-done__block" aria-labelledby="order-next">
      <h2 class="co-label" id="order-next">Что дальше</h2>
      <?= $stepsList($steps) ?>
    </section>

<?php   if ($items): ?>
    <section class="order-done__block" aria-labelledby="order-items">
      <h2 class="co-label" id="order-items">Состав заказа</h2>
      <ul class="order-lines">
<?php     foreach ($items as $item): ?>
        <li class="order-lines__row">
          <span class="order-lines__name"><?= gg_e($item['name']) ?>
            <span class="order-lines__note"><?= gg_e(trim($item['note'] . ' × ' . $item['qty'], ' ')) ?></span>
          </span>
          <span class="order-lines__sum"><?= gg_e(gg_price((float)$item['sum'])) ?></span>
        </li>
<?php     endforeach; ?>
      </ul>
      <p class="order-lines__total"><span>Итого</span><span><?= gg_e(gg_price((float)$orderTotal)) ?></span></p>
    </section>
<?php   endif; ?>
<?php endif; ?>

<?php if ($requestNumber !== '' && $number !== ''): ?>
    <section class="order-done__block order-done__request" aria-labelledby="request-next">
      <h2 class="order-done__subtitle" id="request-next">Заявка №<?= gg_e($requestNumber) ?> у менеджера</h2>
      <?= $stepsList($requestSteps) ?>
    </section>
    <?= $requestItems($ownRequest) ?>
<?php elseif ($requestNumber !== ''): ?>
    <section class="order-done__block" aria-labelledby="request-next">
      <h2 class="co-label" id="request-next">Что дальше</h2>
      <?= $stepsList($requestSteps) ?>
    </section>
    <?= $requestItems($ownRequest) ?>
<?php endif; ?>

    <section class="order-done__block" aria-labelledby="order-contacts">
      <h2 class="co-label" id="order-contacts">Если нужно что-то поменять</h2>
      <p class="order-done__contacts">
        <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a>
        <a href="<?= gg_e($contacts['whatsapp']) ?>" target="_blank" rel="noopener">WhatsApp</a>
        <a href="<?= gg_e($contacts['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
      </p>
    </section>

    <?php /* Кнопки «Мои заказы» здесь нет: кабинета на стенде нет. */ ?>
    <div class="order-done__actions">
      <a class="btn btn--solid" href="/catalog">В каталог</a>
    </div>
  </div>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
