<?php
/**
 * Корзина /cart.
 *
 * ГРАММАТИКА САЙТА, А НЕ МАГАЗИННЫЙ ШАБЛОН. Строки состава разделены
 * волосяными линиями, без рамок и заливок — как города в #offline и пункты
 * #why. Карточка с заливкой одна: липкая сводка справа.
 *
 * ГРУППЫ ПО ВИДУ ПОЗИЦИИ: «В наличии», «Под заказ», «Заявка менеджеру»
 * (gg_item_kind). Заголовки групп показываются всегда, даже когда группа
 * одна: строка под заголовком — обещание по срокам. Разметка и тексты —
 * src/js/cart/cart-page.js и src/data/cart-copy.js.
 *
 * ЗАКАЗ И ЗАЯВКА ХРАНЯТСЯ ПО-РАЗНОМУ: заказ — корзина Битрикса, заявка —
 * cookie gg_request (include/requests.php). Вид считается при каждой
 * отрисовке, и позиция переезжает между ними сама (gg_cart_sync);
 * уведомление об этом стоит над группами.
 *
 * БЕЗ JS СТРАНИЦА РАБОТАЕТ. Количество меняется формой (скрытая кнопка
 * «Обновить» — она же обработчик Enter в поле), крестик — вторая кнопка
 * той же формы. Скрипт только оживляет − и + и отправляет форму сам.
 */
define('GG_PAGE_CLASS', 'page-cart');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/cart.php';

gg_cart_handle_post('/cart/');

$APPLICATION->SetTitle('Корзина — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$state = gg_cart_state();
$totals = $state['totals'];
$texts = gg_summary_texts($totals);
$readyAt = (int)$totals['order']['readyAt'];
$hasLines = $totals['positions'] > 0;
?>
<div class="container">
  <nav class="crumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a>
    <span class="crumbs__sep" aria-hidden="true"></span>
    <span class="crumbs__current" aria-current="page">Корзина</span>
  </nav>

  <div class="cart__head">
    <h1 class="cart__title" tabindex="-1">Корзина</h1>
    <p class="cart__positions"><?= $hasLines ? gg_e(gg_positions_label($totals['positions'])) : '' ?></p>
  </div>

<?php if ($state['notices']): ?>
  <ul class="cart__notices" role="status">
<?php foreach ($state['notices'] as $notice): ?>
    <li class="ready-line"><span class="ready-line__mark" aria-hidden="true">⬦</span><span><?= gg_e($notice) ?></span></li>
<?php endforeach; ?>
  </ul>
<?php endif; ?>

<?php if (!$hasLines): ?>
  <?php /* Пустая корзина: две кнопки, а не ноль. Пустой экран без выходов
           читается как тупик, а вторая кнопка ведёт на флагман — с него
           начинают чаще всего. */ ?>
  <div class="cart-empty">
    <h2 class="cart-empty__title">В корзине пока пусто</h2>
    <p class="cart-empty__text">Добавленное сохранится здесь, даже если закрыть страницу.</p>
    <div class="cart-empty__actions">
      <a class="btn btn--solid" href="/catalog">В каталог</a>
      <a class="btn" href="/catalog/chernaya-ikra">Чёрная икра</a>
    </div>
  </div>
<?php else: ?>
  <div class="cart__layout">
    <div class="cart__groups" aria-label="Состав корзины" role="region">
<?php foreach ($state['groups'] as $kind => $lines):
    $group = gg_group_texts($kind, $readyAt);
    $isRequest = $kind === 'request';
?>
      <section class="cart-group" aria-labelledby="cart-group-<?= $kind ?>" data-group="<?= $kind ?>">
        <div class="cart-group__head">
          <h2 class="cart-group__title" id="cart-group-<?= $kind ?>"><?= gg_e($group['title']) ?></h2>
          <p class="cart-group__count"><?= gg_e(gg_positions_label(count($lines))) ?></p>
        </div>
        <p class="cart-group__lead cart-group__lead--<?= $kind ?>">
          <span class="cart-group__icon" aria-hidden="true"><?= gg_kind_icon($kind) ?></span><span><?= gg_e($group['lead']) ?></span>
        </p>
        <ul class="cart-list" aria-label="<?= gg_e($group['title']) ?>">
<?php foreach ($lines as $line):
        $sumClass = $line['price'] === null ? ' is-request' : ($isRequest ? ' is-estimate' : '');
?>
          <li class="cart-line" data-id="<?= (int)$line['id'] ?>">
            <a class="cart-line__shot" href="<?= gg_e($line['href']) ?>" tabindex="-1" aria-hidden="true"><?=
              gg_product_shot(['CODE' => $line['code']], $line['name'], 'cart-line__photo media--compact')
            ?></a>

            <?php /* Одна форма на строку: количество и крестик. Скрытая кнопка
                     «Обновить» стоит в разметке раньше крестика, поэтому Enter
                     в поле количества пересчитывает строку, а не удаляет её.
                     Строка заявки уходит в свой обработчик (request_qty). */ ?>
            <form class="cart-line__body" method="post" action="/cart/">
              <?= bitrix_sessid_post() ?>
              <input type="hidden" name="gg_action" value="<?= $isRequest ? 'request_qty' : 'qty' ?>">
              <input type="hidden" name="line" value="<?= (int)$line['id'] ?>">

              <h3 class="cart-line__name"><a href="<?= gg_e($line['href']) ?>"><?= gg_e($line['name']) ?></a></h3>
<?php if (trim((string)$line['note']) !== ''): ?>
              <p class="cart-line__note"><?= gg_e($line['note']) ?></p>
<?php endif; ?>
              <?= gg_qty_stepper((int)$line['qty'], 'Количество: ' . $line['name'], true, 'sm', 'cart-line__qty') ?>
              <button type="submit" class="visually-hidden">Обновить количество</button>
              <p class="cart-line__sum<?= $sumClass ?>"><?= gg_e(gg_line_sum($line)) ?></p>
              <button type="submit" class="icon-btn cart-line__remove" name="gg_remove" value="1"
                      aria-label="Убрать из корзины: <?= gg_e($line['name']) ?>"><?= gg_icon('close') ?></button>
            </form>
          </li>
<?php endforeach; ?>
        </ul>
      </section>
<?php endforeach; ?>
    </div>

    <aside class="cart__aside summary-sticky" aria-label="Итог заказа">
      <div class="summary">
<?php if ($texts['showOrder']): ?>
        <div class="summary__order">
          <h2 class="summary__title">Итог заказа</h2>
          <dl class="summary__rows">
            <div class="summary__row"><dt>Товаров</dt><dd><?= gg_e($texts['count']) ?></dd></div>
            <div class="summary__row"><dt>Сумма</dt><dd><?= gg_e($texts['sum']) ?></dd></div>
            <div class="summary__row"><dt>Доставка</dt><dd>рассчитаем при оформлении</dd></div>
          </dl>
          <p class="summary__total">
            <span>Итого</span>
            <span class="summary__total-value"><?= gg_e($texts['total']) ?></span>
          </p>
<?php   if ($texts['splitHint'] !== ''): ?>
          <p class="ready-line summary__hint">
            <span class="ready-line__mark" aria-hidden="true">⬦</span><span><?= gg_e($texts['splitHint']) ?></span>
          </p>
<?php   endif; ?>
        </div>
<?php endif; ?>

<?php if ($texts['showRequest']): ?>
        <div class="summary__request<?= $texts['showOrder'] ? '' : ' is-alone' ?>">
          <h2 class="summary__subtitle">Заявка менеджеру</h2>
          <p class="summary__note"><?= gg_e($texts['requestNote']) ?></p>
        </div>
<?php endif; ?>

        <a class="btn btn--solid summary__action" href="/checkout/"><?= gg_e($texts['checkout']) ?></a>

<?php if ($texts['showOrder']): ?>
        <?php /* Промокод открыт всегда и только при заказе: к заявке его
                 применить не к чему. В прототипе поле прячется под ссылкой,
                 но переключатель на сервере без JS не раскрывается. */ ?>
        <form class="cart__promo" method="post" action="/cart/">
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="gg_action" value="promo">
          <div class="cart__promo-field" id="cart-promo">
            <label class="field__label" for="cart-promo-input">Промокод</label>
            <input class="field__input" id="cart-promo-input" type="text" name="promo" autocomplete="off"
                   value="<?= gg_e(gg_promo()) ?>" aria-describedby="cart-promo-hint">
            <p class="field__hint" id="cart-promo-hint">Проверит менеджер при подтверждении заказа</p>
          </div>
          <button type="submit" class="link-btn">Применить промокод</button>
        </form>
<?php endif; ?>
      </div>
    </aside>
  </div>

  <div class="cart-bar">
    <p class="cart-bar__total">
      <span class="cart-bar__label"><?= gg_e($texts['barLabel']) ?></span>
      <span class="cart-bar__value<?= $texts['mode'] === 'request' ? ' is-text' : '' ?>"><?= gg_e($texts['barValue']) ?></span>
    </p>
    <a class="btn btn--solid cart-bar__action" href="/checkout/"><span class="cart-bar__long"><?= gg_e($texts['checkout']) ?></span><span class="cart-bar__short" aria-hidden="true">Оформить</span></a>
  </div>
<?php endif; ?>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
