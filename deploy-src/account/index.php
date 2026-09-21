<?php
/**
 * Обзор кабинета /account/.
 *
 * Блоки сверху вниз — как в прототипе (src/js/account/pages/overview.js):
 * приветствие и телефон · «Сейчас в работе» (до трёх записей) либо последняя
 * запись, либо пустое состояние · «Избранное» (до четырёх карточек; пустое —
 * блока нет) · пункты кабинета строками (nav.acc-rows, только уже 1024px,
 * где бокового меню нет) · строка связи.
 *
 * «В РАБОТЕ» — заказ не получен и не отменён, заявка не закрыта. Берутся из
 * первой порции истории (gg_account_history('all', 1)), новые сверху.
 * Ссылка «Все заказы и заявки» — когда в истории есть что-то сверх
 * показанного: так считает прототип (total > active.length).
 *
 * «ПОВТОРИТЬ ЗАКАЗ» — ФОРМА POST с gg_account_action=reorder: позиции кладёт
 * gg_account_reorder(), сообщение уезжает тостом, страница перезагружается
 * (gg_account_handle_post). У последней заявки кнопки нет.
 *
 * СЕРДЦЕ НА КАРТОЧКЕ ИЗБРАННОГО — тоже форма POST на этот адрес, поэтому
 * gg_fav_handle_post() стоит здесь до вывода, как на /favorites/.
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

/* Гость уходит на вход с возвратом сюда, и только потом разбираются формы:
   «Выйти», «Повторить заказ» и сердце нажимает тот, кто ещё вошёл. */
$user = gg_require_user();
gg_fav_handle_post();
gg_account_handle_post('/account/');

$APPLICATION->SetTitle('Личный кабинет — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$name = trim((string)($user['name'] ?? ''));
$contacts = gg()['contacts'];

/* ---- в работе / последняя запись / пусто ---------------------------------- */

$history = gg_account_history('all', 1);
$rows = $history['items'];

$isActive = static fn(array $row): bool => (string)$row['type'] === 'order'
    ? !in_array((string)$row['status'], ['done', 'canceled'], true)
    : (string)$row['status'] !== 'closed';
$active = array_slice(array_values(array_filter($rows, $isActive)), 0, 3);
$last = $rows[0] ?? null;

/* ---- избранное ------------------------------------------------------------ */

$favIds = gg_fav_ids();
$favCount = count($favIds);
$favCards = gg_account_fav_cards(array_slice($favIds, 0, 4));

gg_account_frame_open('overview', []);
?>
      <h1 class="acc-title"><?= gg_e($name !== '' ? 'Здравствуйте, ' . $name : 'Личный кабинет') ?></h1>
      <p class="acc-sub"><?= gg_e(gg_phone_format((string)($user['phone'] ?? ''))) ?></p>

      <section class="acc-block">
<?php if ($active): ?>
        <h2 class="acc-block__title">Сейчас в работе</h2>
        <div class="order-rows">
<?php   foreach ($active as $row): ?>
          <?= gg_order_row($row) ?>
<?php   endforeach; ?>
        </div>
<?php   if ((int)$history['total'] > count($active)): ?>
        <p class="acc-more"><a class="link-btn" href="/account/orders/">Все заказы и заявки</a></p>
<?php   endif; ?>
<?php elseif ($last): $isOrder = (string)$last['type'] === 'order'; ?>
        <h2 class="acc-block__title"><?= gg_e($isOrder ? 'Последний заказ' : 'Последняя заявка') ?></h2>
        <div class="order-rows">
          <?= gg_order_row($last) ?>
        </div>
        <div class="acc-actions">
<?php   if ($isOrder): ?>
          <form method="post" action="/account/">
            <?= bitrix_sessid_post() ?>
            <input type="hidden" name="gg_account_action" value="reorder">
            <input type="hidden" name="number" value="<?= gg_e($last['number']) ?>">
            <button type="submit" class="btn">Повторить заказ</button>
          </form>
<?php   endif; ?>
          <a class="link-btn" href="/account/orders/">Все заказы и заявки</a>
        </div>
<?php else: ?>
        <div class="acc-empty">
          <span class="acc-empty__icon" aria-hidden="true"><?= gg_icon('receipt') ?></span>
          <h2 class="acc-empty__title">Здесь появятся ваши заказы</h2>
          <p class="acc-empty__text">Оформите первый заказ — статус и состав будут видны здесь.</p>
          <a class="btn btn--solid" href="/catalog">В каталог</a>
        </div>
<?php endif; ?>
      </section>

<?php if ($favCards): ?>
      <section class="acc-block">
        <div class="acc-block__head">
          <h2 class="acc-block__title">Избранное</h2>
          <a class="link-btn" href="/favorites/"><?= gg_e('Всё избранное · ' . $favCount) ?></a>
        </div>
        <div class="fav__grid fav__grid--row">
<?php   foreach ($favCards as $card): ?>
          <?= gg_account_fav_card($card) ?>
<?php   endforeach; ?>
        </div>
      </section>
<?php endif; ?>

<?php /* Строки кабинета — до строки связи, как в прототипе; каркас второй
         раз их не напечатает. */ ?>
<?php gg_account_section_rows(); ?>

      <p class="acc-contact">
        <span>Вопрос по заказу?</span>
        <a href="<?= gg_e($contacts['phoneHref']) ?>"><?= gg_e($contacts['phone']) ?></a>
        <a href="<?= gg_e($contacts['whatsapp']) ?>" target="_blank" rel="noopener">WhatsApp</a>
        <a href="<?= gg_e($contacts['telegram']) ?>" target="_blank" rel="noopener">Telegram</a>
      </p>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
