<?php
/**
 * Заказы и заявки /account/orders.
 *
 * Список записей кабинета: строки — gg_order_row() (разметка .order-row
 * из src/js/account/order-row.js), новые сверху, по 20 за раз.
 *
 * КАПСУЛЫ «ВСЕ / ЗАКАЗЫ / ЗАЯВКИ» — ТОЛЬКО КОГДА ЕСТЬ ОБА ТИПА. Фильтр
 * из одного значения — это брак, а не выбор; ровно так же ведёт себя
 * прототип (orders.js). Выбор живёт в адресе: ?type=orders|requests.
 *
 * «ПОКАЗАТЬ ЕЩЁ» — ССЫЛКА, А НЕ КНОПКА. Без JS дописать строки в список
 * нечем, поэтому страница перезагружается с ?page=N: gg_account_history()
 * отдаёт первые N×20 записей — то же самое, что видно в прототипе после
 * нажатия. Адрес при этом можно переслать или открыть в новой вкладке.
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

/* Гость уходит на вход с возвратом сюда, и только потом разбираются формы:
   «Выйти» нажимает тот, кто ещё вошёл. */
gg_require_user();
gg_account_handle_post('/account/orders/');

$APPLICATION->SetTitle('Заказы и заявки — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$filters = ['all' => 'Все', 'orders' => 'Заказы', 'requests' => 'Заявки'];
$type = isset($filters[(string)($_GET['type'] ?? '')]) ? (string)$_GET['type'] : 'all';
$page = max(1, (int)($_GET['page'] ?? 1));

$history = gg_account_history($type, $page);
$showCaps = $history['hasOrders'] && $history['hasRequests'];

/** Адрес этой же страницы с другим фильтром или следующей порцией. */
$hrefFor = static function (string $key, int $page = 1): string {
    $params = [];
    if ($key !== 'all') {
        $params['type'] = $key;
    }
    if ($page > 1) {
        $params['page'] = $page;
    }
    return '/account/orders/' . ($params ? '?' . http_build_query($params) : '');
};

gg_account_frame_open('orders', [['label' => 'Заказы и заявки']]);
?>
      <h1 class="acc-title">Заказы и заявки</h1>

<?php if ($showCaps): ?>
      <nav class="caps acc-caps" aria-label="Что показать">
<?php   foreach ($filters as $key => $label): $active = $key === $type; ?>
        <a class="cap<?= $active ? ' is-active' : '' ?>" href="<?= gg_e($hrefFor($key)) ?>" data-type="<?= gg_e($key) ?>"<?= $active ? ' aria-current="true"' : '' ?>><span class="cap__face"><?= gg_e($label) ?></span></a>
<?php   endforeach; ?>
      </nav>
<?php endif; ?>

      <div class="order-rows">
<?php if (!$history['total']): ?>
        <div class="acc-empty">
          <span class="acc-empty__icon" aria-hidden="true"><?= gg_icon('receipt') ?></span>
          <h2 class="acc-empty__title">Заказов пока нет</h2>
          <p class="acc-empty__text">Когда оформите заказ, здесь будут его статус и состав.</p>
          <a class="btn btn--solid" href="/catalog">В каталог</a>
        </div>
<?php else: ?>
<?php   foreach ($history['items'] as $row): ?>
        <?= gg_order_row($row) ?>
<?php   endforeach; ?>
<?php endif; ?>
      </div>

<?php if ($history['hasMore']): ?>
      <p class="acc-more">
        <a class="btn" href="<?= gg_e($hrefFor($type, $page + 1)) ?>">Показать ещё</a>
      </p>
<?php endif; ?>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
