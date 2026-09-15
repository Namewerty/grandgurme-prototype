<?php
/**
 * Корзина /cart.
 *
 * ГРАММАТИКА САЙТА, А НЕ МАГАЗИННЫЙ ШАБЛОН. Строки состава разделены
 * волосяными линиями, без рамок и заливок — как города в #offline и пункты
 * #why. Карточка с заливкой одна: липкая сводка справа.
 *
 * ПОЧЕМУ СВОЯ СТРАНИЦА, А НЕ sale.basket.basket. Разметка обязана совпасть
 * с прототипом (src/js/cart/cart-page.js) до класса — стили общие, — а
 * шаблон родного компонента приносит свою разметку и свой JS на тысячи
 * строк. Здесь состав читается через \Bitrix\Sale\Basket, а изменения идут
 * обычными POST-формами с проверкой сессии и возвратом на ту же страницу
 * (PRG): обновление страницы не повторяет действие.
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

$lines = gg_cart_lines();
$totals = gg_cart_totals($lines);
$texts = gg_summary_texts($totals);
?>
<div class="container">
  <nav class="crumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a>
    <span class="crumbs__sep" aria-hidden="true"></span>
    <span class="crumbs__current" aria-current="page">Корзина</span>
  </nav>

  <div class="cart__head">
    <h1 class="cart__title" tabindex="-1">Корзина</h1>
    <p class="cart__positions"><?= $lines ? gg_e(gg_positions_label($totals['positions'])) : '' ?></p>
  </div>

<?php if (!$lines): ?>
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
    <ul class="cart-list" aria-label="Состав корзины">
<?php foreach ($lines as $line): ?>
      <li class="cart-line<?= $line['inStock'] ? '' : ' is-preorder' ?>" data-id="<?= (int)$line['id'] ?>">
        <a class="cart-line__shot" href="<?= gg_e($line['href']) ?>" tabindex="-1" aria-hidden="true"><?=
          gg_product_shot(['CODE' => $line['code']], $line['name'], 'cart-line__photo media--compact')
        ?></a>

        <?php /* Одна форма на строку: количество и крестик. Скрытая кнопка
                 «Обновить» стоит в разметке раньше крестика, поэтому Enter
                 в поле количества пересчитывает строку, а не удаляет её. */ ?>
        <form class="cart-line__body" method="post" action="/cart/">
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="gg_action" value="qty">
          <input type="hidden" name="line" value="<?= (int)$line['id'] ?>">

          <h2 class="cart-line__name"><a href="<?= gg_e($line['href']) ?>"><?= gg_e($line['name']) ?></a></h2>
          <p class="cart-line__note"><?= gg_e(gg_line_note($line)) ?></p>
          <?= gg_qty_stepper((int)$line['qty'], 'Количество: ' . $line['name'], true, 'sm', 'cart-line__qty') ?>
          <button type="submit" class="visually-hidden">Обновить количество</button>
          <p class="cart-line__sum<?= $line['price'] === null ? ' is-request' : '' ?>"><?= gg_e(gg_line_sum($line)) ?></p>
          <button type="submit" class="icon-btn cart-line__remove" name="gg_remove" value="1"
                  aria-label="Убрать из корзины: <?= gg_e($line['name']) ?>"><?= gg_icon('close') ?></button>
        </form>
      </li>
<?php endforeach; ?>
    </ul>

    <aside class="cart__aside summary-sticky" aria-label="Итог заказа">
      <p class="ready-line cart__ready">
        <span class="ready-line__mark" aria-hidden="true">⬦</span><span><?= gg_e($texts['ready']) ?></span>
      </p>

      <div class="summary">
        <h2 class="summary__title">Итог заказа</h2>
        <dl class="summary__rows">
          <div class="summary__row"><dt>Товаров</dt><dd><?= gg_e($texts['count']) ?></dd></div>
          <div class="summary__row"><dt>Сумма</dt><dd><?= gg_e($texts['sum']) ?></dd></div>
<?php if ($texts['onRequest'] !== ''): ?>
          <div class="summary__row"><dt>Позиций по запросу</dt><dd><?= gg_e($texts['onRequest']) ?></dd></div>
<?php endif; ?>
          <div class="summary__row"><dt>Доставка</dt><dd>рассчитаем при оформлении</dd></div>
        </dl>
        <p class="summary__total">
          <span>Итого</span>
          <span class="summary__total-value<?= $texts['allOnRequest'] ? ' is-text' : '' ?>"><?= gg_e($texts['total']) ?></span>
        </p>
<?php if ($texts['note'] !== ''): ?>
        <p class="summary__note"><?= gg_e($texts['note']) ?></p>
<?php endif; ?>

        <a class="btn btn--solid summary__action" href="/checkout/"><?= gg_e($texts['checkout']) ?></a>

        <?php /* Промокод открыт всегда. В прототипе поле пряталось под
                 ссылкой «У меня есть промокод», но переключатель на сервере
                 без JS не раскрывается, а ссылка, которая ничего не делает,
                 хуже лишнего поля. Проверки кода нет: его читает менеджер
                 при подтверждении. */ ?>
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
      </div>
    </aside>
  </div>

  <div class="cart-bar">
    <p class="cart-bar__total">
      <span class="cart-bar__label">Итого</span>
      <span class="cart-bar__value<?= $texts['allOnRequest'] ? ' is-text' : '' ?>"><?= gg_e($texts['total']) ?></span>
    </p>
    <a class="btn btn--solid" href="/checkout/"><?= gg_e($texts['checkout']) ?></a>
  </div>
<?php endif; ?>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
