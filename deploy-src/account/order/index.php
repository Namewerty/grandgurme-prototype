<?php
/**
 * Заказ /account/order?n=<номер>.
 *
 * Слева — отгрузки (одна или две): шаги, строка получения, состав; ниже
 * «Получение», «Оплата» и ссылка на заявку, ушедшую вместе с заказом.
 * Справа — сводка .summary (тот же компонент, что в корзине и на оформлении)
 * с «Повторить заказ» и связью с менеджером; уже 1280px она стоит под
 * содержимым. Разметка — src/js/account/pages/order.js.
 *
 * ОТМЕНИТЬ ИЛИ ИЗМЕНИТЬ ЗАКАЗ ИЗ КАБИНЕТА НЕЛЬЗЯ — для этого связь
 * с менеджером (решение 17.09.2026). Статуса оплаты и кнопки «Оплатить»
 * тоже нет: онлайн-оплата не подтверждена, показываем только способ,
 * который человек выбрал при оформлении.
 *
 * ЧУЖОЙ ЗАКАЗ НЕ ОТДАЁТСЯ: gg_account_order() ищет заказ только у вошедшего.
 * Нет n, n не из цифр, заказ чужой или не найден — блок «Заказ не найден»
 * с переходом на вход с другим номером.
 *
 * «ПОВТОРИТЬ ЗАКАЗ» — ФОРМА POST, а не кнопка со скриптом: позиции кладёт
 * gg_account_reorder(), сообщение уезжает тостом в сессии, страница
 * перезагружается (gg_account_handle_post).
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

$raw = (string)($_GET['n'] ?? '');
$number = preg_match('/^\d+$/', $raw) ? $raw : '';
$self = '/account/order/' . ($number !== '' ? '?n=' . rawurlencode($number) : '');

gg_require_user();
gg_account_handle_post($self);

$order = $number !== '' ? gg_account_order($number) : null;
$title = $number !== '' ? 'Заказ №' . $number : 'Заказ не найден';
$notFound = [
    'title' => 'Заказ не найден',
    'text' => 'Возможно, он оформлен на другой номер. Войдите с номером, который указывали в заказе.',
    'all' => 'Все заказы и заявки',
    'relogin' => 'Войти с другим номером',
];

$APPLICATION->SetTitle(($order ? $title : $notFound['title']) . ' — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

gg_account_frame_open('orders', [
    ['label' => 'Заказы и заявки', 'href' => '/account/orders/'],
    ['label' => $title],
]);

if (!$order) {
    gg_account_not_found($notFound);
    gg_account_frame_close();
    echo gg_flash_toast();
    require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
    die();
}

$method = (string)$order['method'];
$canceled = $order['status'] === 'canceled';
$receive = is_array($order['receive'] ?? null) ? $order['receive'] : [];
$contacts = gg()['contacts'];

/* Отгрузок может не быть вовсе (старый заказ) — тогда состав показывается
   одним блоком со статусом самого заказа. */
$shipments = $order['shipments'] ?: [
    ['kind' => 'all', 'label' => '', 'date' => '', 'interval' => '', 'items' => [], 'status' => $order['status']],
];
$titled = count($shipments) > 1;

/* Код товара нужен кадру состава: в строках заказа его нет, берём одним
   запросом по всем позициям сразу. */
$elements = gg_elements_for_ids(array_map(static fn(array $item): int => (int)$item['productId'], $order['items']));
$items = [];
foreach ($order['items'] as $item) {
    $item['code'] = (string)($elements[(int)$item['productId']]['CODE'] ?? '');
    $items[] = $item;
}

/** Шаги отгрузки: пройденный, текущий, будущий. */
$stepsHtml = static function (array $shipment) use ($method): string {
    $base = $method === 'pickup'
        ? ['accepted', 'assembling', 'ready', 'done']
        : ['accepted', 'assembling', 'on_way', 'done'];
    /* У отгрузки под заказ после «Принят» стоит шаг «Ждём поставку». */
    $codes = (string)$shipment['kind'] === 'preorder'
        ? array_merge([$base[0], 'waiting'], array_slice($base, 1))
        : $base;

    $at = array_search((string)$shipment['status'], $codes, true);
    $at = $at === false ? 0 : (int)$at;
    $finished = (string)$shipment['status'] === 'done';

    $html = '<ol class="ship-steps" aria-label="Ход отгрузки">';
    foreach ($codes as $i => $code) {
        $state = ($i < $at || $finished) ? 'done' : ($i === $at ? 'current' : 'next');
        $note = $state === 'done' ? 'пройден' : ($state === 'current' ? 'сейчас' : '');
        $html .= '<li class="ship-steps__item is-' . $state . '"' . ($state === 'current' ? ' aria-current="step"' : '') . '>'
            . '<span class="ship-steps__dot" aria-hidden="true">' . ($state === 'done' ? gg_icon('check') : '') . '</span>'
            . '<span class="ship-steps__label">' . gg_e(gg_status_label($code)) . '</span>'
            . ($note !== '' ? '<span class="visually-hidden"> — ' . gg_e($note) . '</span>' : '')
            . '</li>';
    }
    return $html . '</ol>';
};

/** Строка состава: кадр, название ссылкой, фасовка с количеством, сумма. */
$lineRow = static function (array $line, string $sum, bool $muted = false): string {
    $note = trim((string)$line['note'] . ' × ' . (int)$line['qty']);
    $href = (string)($line['href'] ?? '');
    return '<li class="acc-line">'
        . '<span class="acc-line__shot">' . gg_product_shot(['CODE' => (string)($line['code'] ?? '')], '', 'media--compact') . '</span>'
        . '<span class="acc-line__text">'
        . '<a class="acc-line__name" href="' . gg_e($href !== '' ? $href : '/catalog') . '">' . gg_e($line['name']) . '</a>'
        . '<span class="acc-line__note">' . gg_e($note) . '</span>'
        . '</span>'
        . '<span class="acc-line__sum' . ($muted ? ' is-estimate' : '') . '">' . gg_e($sum) . '</span>'
        . '</li>';
};

/* «Получение»: пишем то, что записал оформитель. Города в записи может
   не быть — сайт возит только по Москве, и строка от этого не ломается. */
if ($method === 'pickup') {
    $point = $receive['point'] ?? '';
    $point = is_array($point)
        ? trim(implode(', ', array_filter([(string)($point['name'] ?? ''), (string)($point['address'] ?? '')])))
        : trim((string)$point);
    $receiveText = 'Самовывоз' . ($point !== '' ? ' · ' . $point : '');
} else {
    $address = implode(', ', array_filter([
        trim((string)($receive['city'] ?? '')),
        trim((string)($receive['street'] ?? '')),
        trim((string)($receive['apartment'] ?? '')) !== '' ? 'кв. ' . $receive['apartment'] : '',
        trim((string)($receive['intercom'] ?? '')) !== '' ? 'домофон ' . $receive['intercom'] : '',
    ]));
    $receiveText = 'Доставка' . ($address !== '' ? ' · ' . $address : '');
}

$payment = '';
foreach (gg_payment_options() as $option) {
    if ($option['value'] === (string)$order['payment']) {
        $payment = $option['label'];
    }
}

/* Стоимость доставки в заказ не считается — её называет менеджер. */
$deliveryValue = $method === 'pickup'
    ? 'не нужна'
    : (count($shipments) === 2 ? 'две, подтвердит менеджер' : 'подтвердит менеджер');
?>
      <div class="acc-order">
        <div class="acc-order__main">
          <h1 class="acc-title"><?= gg_e($title) ?></h1>
          <p class="acc-sub acc-sub--row">
            <span>от <?= gg_e(gg_account_date((string)$order['createdAt'])) ?></span>
            <?= gg_status_tag((string)$order['status']) ?>
          </p>
<?php if ($canceled): ?>
          <p class="acc-order__canceled">Заказ отменён</p>
<?php endif; ?>

<?php foreach ($shipments as $shipment):
    /* Состав отгрузки — только её позиции; если в записи их нет, показываем
       весь состав заказа. */
    $ids = array_flip(array_map('intval', is_array($shipment['items'] ?? null) ? $shipment['items'] : []));
    $lines = $ids ? array_values(array_filter($items, static fn(array $item): bool => isset($ids[(int)$item['productId']]))) : [];
    $lines = $lines ?: $items;
    $shipTitle = ($titled && (string)$shipment['kind'] !== 'all')
        ? ((string)$shipment['kind'] === 'preorder' ? 'Товары под заказ · ' : 'Товары в наличии · ') . gg_positions_label(count($lines))
        : '';
    $shipReceive = gg_receive_line(
        ['method' => $method, 'dates' => [['date' => (string)$shipment['date'], 'interval' => (string)$shipment['interval']]]],
        (string)$order['status']
    );
?>
          <section class="ship">
<?php   if ($shipTitle !== ''): ?>
            <h2 class="acc-block__title"><?= gg_e($shipTitle) ?></h2>
<?php   endif; ?>
<?php   if (!$canceled): ?>
            <?= $stepsHtml($shipment) ?>
<?php   endif; ?>
<?php   if ($shipReceive !== ''): ?>
            <p class="ship__receive"><?= gg_e($shipReceive) ?></p>
<?php   endif; ?>
            <ul class="acc-lines" aria-label="Состав отгрузки">
<?php   foreach ($lines as $line): ?>
              <?= $lineRow($line, gg_line_sum($line)) ?>
<?php   endforeach; ?>
            </ul>
          </section>
<?php endforeach; ?>

          <section class="acc-block acc-block--plain">
            <h2 class="co-label">Получение</h2>
            <p><?= gg_e($receiveText) ?></p>
          </section>

<?php if ($payment !== ''): ?>
          <section class="acc-block acc-block--plain">
            <h2 class="co-label">Оплата</h2>
            <p><?= gg_e($payment) ?></p>
          </section>
<?php endif; ?>

<?php if ((string)$order['requestNumber'] !== ''): ?>
          <p class="acc-order__request">
            <a class="acc-rows__row" href="/account/request/?r=<?= gg_e(rawurlencode((string)$order['requestNumber'])) ?>">
              <span class="acc-rows__label">Вместе с заказом отправлена заявка №<?= gg_e($order['requestNumber']) ?></span>
              <span class="acc-rows__chevron" aria-hidden="true"><?= gg_icon('chevronRight') ?></span>
            </a>
          </p>
<?php endif; ?>
        </div>

        <aside class="acc-order__aside summary-sticky" aria-label="Итог">
          <div class="summary">
            <h2 class="summary__title">Итог</h2>
            <dl class="summary__rows">
              <div class="summary__row"><dt>Товаров</dt><dd><?= (int)$order['count'] ?></dd></div>
              <div class="summary__row"><dt>Сумма</dt><dd><?= gg_e(gg_price((float)$order['total'])) ?></dd></div>
              <div class="summary__row"><dt>Доставка</dt><dd><?= gg_e($deliveryValue) ?></dd></div>
            </dl>
            <p class="summary__total">
              <span>Итого</span>
              <span class="summary__total-value"><?= gg_e(gg_price((float)$order['total'])) ?></span>
            </p>

            <form method="post" action="<?= gg_e($self) ?>">
              <?= bitrix_sessid_post() ?>
              <input type="hidden" name="gg_account_action" value="reorder">
              <input type="hidden" name="number" value="<?= gg_e($order['number']) ?>">
              <button type="submit" class="btn btn--solid summary__action">Повторить заказ</button>
            </form>

            <p class="summary__note">Изменить или отменить заказ можно через менеджера</p>
            <p class="acc-contact acc-contact--stack">
              <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a>
              <a href="<?= gg_e($contacts['whatsapp']) ?>" target="_blank" rel="noopener">WhatsApp</a>
              <a href="<?= gg_e($contacts['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
            </p>
          </div>
        </aside>
      </div>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
