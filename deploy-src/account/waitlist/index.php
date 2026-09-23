<?php
/**
 * Лист ожидания /account/waitlist/.
 *
 * Разметка — src/js/account/pages/waitlist.js прототипа и записка
 * PERENOS-ikra-menyu-ozhidanie.md, раздел 3.4: строки .acc-line--wait
 * с кадром, названием, фасовкой, меткой статуса и действиями.
 *
 * ГОСТЯ ЗДЕСЬ НЕ БЫВАЕТ: подписка живёт на номере кабинета, поэтому гость
 * уходит на вход с возвратом, как на остальных страницах кабинета.
 *
 * СТАТУС СЧИТАЕТСЯ ПРИ ОТРИСОВКЕ (include/waitlist.php): «Поступил» —
 * товар лежит на складе, «Ждём поступления» — не лежит, «Больше не
 * продаётся» — товара в каталоге больше нет. В таблице статуса нет.
 *
 * ДЕЙСТВИЯ — обычные формы POST с возвратом сюда же:
 *   «В корзину» / «Добавить в заявку» у поступившей позиции кладут её
 *      в корзину или в заявку И УБИРАЮТ ИЗ ЛИСТА: человек своё дождался;
 *   «Не сообщать» и «Убрать» — снимают подписку.
 * Ajax того же адреса (?ajax=add|remove|list) описан в include/waitlist.php
 * и в записке, 3.3: им пользуется кнопка на карточке товара.
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/waitlist.php';
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/cart.php';

$self = '/account/waitlist/';

/* Ajax-ответы страницы: add, remove (POST) и list (GET). Отвечают и гостю —
   ему приходит reason = guest, по нему скрипт открывает окно входа. */
$ggAjax = (string)($_REQUEST['ajax'] ?? '');
if ($ggAjax === 'list') {
    $items = [];
    foreach (gg_wait_entries() as $entry) {
        $items[] = [
            'id' => (string)$entry['id'],
            'slug' => $entry['slug'],
            'name' => $entry['name'],
            'note' => $entry['note'],
            'href' => $entry['href'],
            'image' => $entry['image'],
            'addedAt' => $entry['addedAt'] ? date('c', $entry['addedAt']) : '',
            'status' => $entry['status'],
        ];
    }
    gg_wait_json(['items' => $items, 'count' => count($items)]);
}
if ($ggAjax === 'add' || $ggAjax === 'remove') {
    $ggId = (int)($_POST['product_id'] ?? $_GET['product_id'] ?? 0);
    if (gg_current_user_id() <= 0) {
        gg_wait_json(['ok' => false, 'reason' => 'guest']);
    }
    $ggAjax === 'add' ? gg_wait_add($ggId) : gg_wait_remove($ggId);
    gg_wait_json(['ok' => true, 'count' => gg_wait_count()]);
}

/* Гость уходит на вход с возвратом сюда, и только потом разбираются формы. */
gg_require_user();

/* «В корзину» и «Добавить в заявку» — те же обработчики, что на карточке. */
gg_request_handle_post($self);
gg_cart_add_handle($self);
gg_wait_handle_post();
gg_account_handle_post($self);

$APPLICATION->SetTitle('Лист ожидания — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$texts = gg_wait_texts();
$user = gg_account_user() ?? [];
$phone = gg_phone_format((string)($user['phone'] ?? ''));
$entries = gg_wait_entries();

gg_account_frame_open('waitlist', [['label' => $texts['pageTitle']]]);
?>
      <h1 class="acc-title"><?= gg_e($texts['pageTitle']) ?></h1>
      <p class="acc-sub"><?= gg_e(str_replace('{phone}', $phone, $texts['lead'])) ?></p>

<?php if (!$entries): ?>
      <div class="acc-empty">
        <span class="acc-empty__icon" aria-hidden="true"><?= gg_icon('bell') ?></span>
        <h2 class="acc-empty__title"><?= gg_e($texts['emptyTitle']) ?></h2>
        <p class="acc-empty__text"><?= gg_e($texts['emptyText']) ?></p>
        <a class="btn btn--solid" href="/catalog"><?= gg_e($texts['emptyAction']) ?></a>
      </div>
<?php else: ?>
      <ul class="acc-lines acc-lines--wait" aria-label="<?= gg_e($texts['itemsLabel']) ?>">
<?php   foreach ($entries as $entry): $id = (int)$entry['id']; ?>
        <li class="acc-line acc-line--wait is-<?= gg_e($entry['status']) ?>" data-wait-id="<?= $id ?>">
          <span class="acc-line__shot">
<?php     if ($entry['element']): ?>
            <?= gg_product_shot($entry['element'], $entry['name']) ?>
<?php     endif; ?>
          </span>
          <span class="acc-line__text">
            <a class="acc-line__name" href="<?= gg_e($entry['href']) ?>"><?= gg_e($entry['name']) ?></a>
<?php     if ($entry['note'] !== ''): ?>
            <span class="acc-line__note"><?= gg_e($entry['note']) ?></span>
<?php     endif; ?>
<?php     if ($entry['status'] === 'waiting' && $entry['addedAt']): ?>
            <span class="acc-line__note"><?= gg_e(str_replace('{date}', gg_format_date($entry['addedAt']), $texts['since'])) ?></span>
<?php     endif; ?>
          </span>
          <span class="acc-line__side">
            <?= gg_wait_status_tag($entry['status']) ?>
            <span class="acc-line__actions">
<?php     if ($entry['status'] === 'arrived'): ?>
              <?= gg_wait_take_button($id, $entry['kind']) ?>
<?php     endif; ?>
              <form method="post" action="<?= gg_e($self) ?>">
                <?= bitrix_sessid_post() ?>
                <input type="hidden" name="gg_wait_action" value="remove">
                <input type="hidden" name="gg_wait_id" value="<?= $id ?>">
                <button type="submit" class="link-btn" data-wait-off data-wait-id="<?= $id ?>">
                  <?= gg_e($entry['status'] === 'gone' ? $texts['remove'] : $texts['off']) ?>
                </button>
              </form>
            </span>
          </span>
        </li>
<?php   endforeach; ?>
      </ul>
<?php endif; ?>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
