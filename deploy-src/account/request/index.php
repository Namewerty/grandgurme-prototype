<?php
/**
 * Заявка /account/request?r=<номер>.
 *
 * Заголовок, дата и статус · «Что дальше» — два шага со страницы «Заказ
 * принят» (у закрытой заявки блока нет) · состав: цена каталога
 * приглушённо или «Цена по запросу» · вопрос менеджеру, если был · ссылка
 * на заказ, если заявка ушла вместе с ним · связь с менеджером.
 * Разметка — src/js/account/pages/request.js.
 *
 * ⚠ ЧТО МЕНЕДЖЕР ДЕЛАЕТ С ЗАЯВКОЙ ДАЛЬШЕ, МЫ НЕ ЗНАЕМ (⚠ ПОДТВЕРДИТЬ
 * У ЗАКАЗЧИКА): обещаний про оплату и сроки здесь нет намеренно.
 *
 * ЦЕНЫ В ЗАЯВКЕ — ОРИЕНТИР, А НЕ СУММА К ОПЛАТЕ: они приглушены
 * (.acc-line__sum.is-estimate), итога у заявки нет.
 *
 * Чужая заявка не отдаётся: gg_account_request() ищет только у вошедшего.
 * Нет r, r не из цифр, заявка чужая или не найдена — «Заявка не найдена».
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

$raw = (string)($_GET['r'] ?? '');
$number = preg_match('/^\d+$/', $raw) ? $raw : '';
$self = '/account/request/' . ($number !== '' ? '?r=' . rawurlencode($number) : '');

gg_require_user();
gg_account_handle_post($self);

$request = $number !== '' ? gg_account_request($number) : null;
$title = $number !== '' ? 'Заявка №' . $number : 'Заявка не найдена';
$notFound = [
    'title' => 'Заявка не найдена',
    'text' => 'Возможно, она оформлена на другой номер. Войдите с номером, который указывали в заявке.',
    'all' => 'Все заказы и заявки',
    'relogin' => 'Войти с другим номером',
];

$APPLICATION->SetTitle(($request ? $title : $notFound['title']) . ' — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

gg_account_frame_open('orders', [
    ['label' => 'Заказы и заявки', 'href' => '/account/orders/'],
    ['label' => $title],
]);

if (!$request) {
    gg_account_not_found($notFound);
    gg_account_frame_close();
    echo gg_flash_toast();
    require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
    die();
}

$contacts = gg()['contacts'];

/* Способ связи в инфоблоке лежит значением списка («Позвонить»), а в коде
   он же зовётся ключом ('call') — принимаем и то, и другое. */
$way = '';
foreach (gg_contact_ways() as $key => $item) {
    if ($key === (string)$request['contactWay'] || $item['label'] === (string)$request['contactWay']) {
        $way = $item['how'];
        break;
    }
}
$wayText = $way !== ''
    ? mb_strtoupper(mb_substr($way, 0, 1)) . mb_substr($way, 1) . ', на номер из заявки'
    : '';

$steps = [
    ['title' => 'Менеджер свяжется с вами', 'text' => $wayText],
    ['title' => 'Уточнит цену и срок поставки', 'text' => ''],
];
?>
      <h1 class="acc-title"><?= gg_e($title) ?></h1>
      <p class="acc-sub acc-sub--row">
        <span>от <?= gg_e(gg_account_date((string)$request['createdAt'])) ?></span>
        <?= gg_status_tag((string)$request['status']) ?>
      </p>

<?php if ((string)$request['status'] !== 'closed'): ?>
      <section class="acc-block">
        <h2 class="co-label">Что дальше</h2>
        <ol class="order-steps">
<?php   foreach ($steps as $i => $step): ?>
          <li class="order-steps__item">
            <span class="order-steps__num" aria-hidden="true"><?= $i + 1 ?></span>
            <span class="order-steps__body">
              <span class="order-steps__title"><?= gg_e($step['title']) ?></span>
<?php     if ($step['text'] !== ''): ?>
              <span class="order-steps__text"><?= gg_e($step['text']) ?></span>
<?php     endif; ?>
            </span>
          </li>
<?php   endforeach; ?>
        </ol>
      </section>
<?php endif; ?>

      <section class="acc-block">
        <h2 class="co-label">Состав заявки</h2>
        <ul class="acc-lines">
<?php foreach ($request['items'] as $item):
    $qty = max(1, (int)($item['qty'] ?? 1));
    $price = $item['price'] ?? null;
    /* Цена каталога — приглушённо: это ориентир, а не сумма к оплате. */
    $sum = $price === null ? 'Цена по запросу' : gg_price((float)$price * $qty);
    $code = (string)($item['code'] ?? '');
    $note = trim((string)($item['pack'] ?? '') . ' × ' . $qty);
?>
          <li class="acc-line">
            <span class="acc-line__shot"><?= gg_product_shot(['CODE' => $code], '', 'media--compact') ?></span>
            <span class="acc-line__text">
              <a class="acc-line__name" href="<?= gg_e($code !== '' ? '/product/' . $code : '/catalog') ?>"><?= gg_e($item['name'] ?? '') ?></a>
              <span class="acc-line__note"><?= gg_e($note) ?></span>
            </span>
            <span class="acc-line__sum is-estimate"><?= gg_e($sum) ?></span>
          </li>
<?php endforeach; ?>
        </ul>
      </section>

<?php if (trim((string)$request['question']) !== ''): ?>
      <section class="acc-block acc-block--plain">
        <h2 class="co-label">Вопрос менеджеру</h2>
        <p><?= gg_e($request['question']) ?></p>
      </section>
<?php endif; ?>

<?php if ((string)$request['orderNumber'] !== ''): ?>
      <p class="acc-order__request">
        <a class="acc-rows__row" href="/account/order/?n=<?= gg_e(rawurlencode((string)$request['orderNumber'])) ?>">
          <span class="acc-rows__label">Отправлена вместе с заказом №<?= gg_e($request['orderNumber']) ?></span>
          <span class="acc-rows__chevron" aria-hidden="true"><?= gg_icon('chevronRight') ?></span>
        </a>
      </p>
<?php endif; ?>

      <section class="acc-block acc-block--plain">
        <h2 class="co-label">Связь с менеджером</h2>
        <p class="acc-contact">
          <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a>
          <a href="<?= gg_e($contacts['whatsapp']) ?>" target="_blank" rel="noopener">WhatsApp</a>
          <a href="<?= gg_e($contacts['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
        </p>
      </section>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
