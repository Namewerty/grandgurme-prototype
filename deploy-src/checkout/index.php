<?php
/**
 * Оформление /checkout. Одна страница, без шагов-вкладок и без регистрации.
 *
 * ГРАММАТИКА — БЛОКИ ДРУГ ПОД ДРУГОМ через волосяную линию, каждый с крупной
 * цифрой слева и подписью-надзаголовком. Никаких рамок вокруг групп полей:
 * страницы оформления чаще всего выпадают из сайта именно из-за них.
 *
 * ПРОВЕРКА НА СЕРВЕРЕ. Ошибка — текстом под полем, поле помечено
 * aria-invalid, введённое возвращается в форму. Разметка и тексты —
 * src/js/checkout/checkout-page.js и src/data/checkout-copy.js.
 *
 * СЕРВЕР РИСУЕТ ОБА БЛОКА СПОСОБА ПОЛУЧЕНИЯ. Без скрипта переключатель
 * ничего бы не переключал, а два видимых блока лучше мёртвой капсулы.
 * Со скриптом (src/bitrix/purchase-hydrate.js) виден только выбранный —
 * блоки помечены data-panel. Поля адреса при самовывозе не проверяются
 * и в заказ не уезжают.
 */
define('GG_PAGE_CLASS', 'page-checkout');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/checkout.php';

$APPLICATION->SetTitle('Оформление заказа — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$lines = gg_cart_lines();

/* Оформлять нечего — возвращаем в корзину: там пустое состояние с выходами. */
if (!$lines) {
    LocalRedirect('/cart/');
}

$totals = gg_cart_totals($lines);
$texts = gg_summary_texts($totals);
$readyAt = (int)$totals['readyAt'];
$points = gg_pickup_points();

$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? $_POST : [];
$errors = [];
$formError = '';

if ($post) {
    if (!check_bitrix_sessid()) {
        LocalRedirect('/checkout/');
    }
    $errors = gg_checkout_validate($post, $readyAt);

    if (!$errors) {
        $digits = gg_phone_digits((string)$post['phone']);

        /* Способ оплаты уезжает в комментарий словами, а не кодом: читает
           его менеджер, а не платёжный модуль. */
        $paymentLabel = '';
        foreach (gg_payment_options() as $option) {
            if ($option['value'] === (string)($post['payment'] ?? '')) {
                $paymentLabel = $option['label'];
            }
        }
        if ($totals['onRequestCount']) {
            $paymentLabel = '';
        }
        $result = gg_create_order([
            'name' => trim((string)$post['name']),
            'phone' => gg_phone_format($digits),
            'email' => trim((string)$post['email']),
            'method' => ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery',
            'street' => trim((string)($post['street'] ?? '')),
            'apartment' => trim((string)($post['apartment'] ?? '')),
            'intercom' => trim((string)($post['intercom'] ?? '')),
            'pickup' => $points[0]['city'] . ', ' . $points[0]['address'],
            'date' => (string)($post['date'] ?? ''),
            'interval' => (string)($post['interval'] ?? ''),
            'payment' => $paymentLabel,
            'comment' => trim((string)($post['comment'] ?? '')),
            'promo' => gg_promo(),
            'onRequest' => (int)$totals['onRequestCount'],
        ]);

        if ($result['ok']) {
            gg_remember_order($result['number'], [
                'id' => $result['id'],
                'date' => (string)($post['date'] ?? ''),
                'interval' => (string)($post['interval'] ?? ''),
                'method' => ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery',
                'address' => ($post['method'] ?? 'delivery') === 'pickup'
                    ? $points[0]['city'] . ', ' . $points[0]['address']
                    : trim((string)($post['street'] ?? '')),
                'onRequest' => (int)$totals['onRequestCount'],
                'readyAt' => $readyAt,
                'createdAt' => time(),
            ]);
            gg_set_promo('');
            LocalRedirect('/order-success/?n=' . rawurlencode($result['number']));
        }
        $formError = $result['error'] !== '' ? $result['error'] : 'Заказ не удалось принять, попробуйте ещё раз';
    }
}

/** Значение поля: то, что человек ввёл, или пусто. */
$v = static function (string $name, string $default = '') use ($post): string {
    return isset($post[$name]) ? trim((string)$post[$name]) : $default;
};
$method = ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery';
$interval = (string)($post['interval'] ?? '');
$payment = (string)($post['payment'] ?? 'card');
$date = (string)($post['date'] ?? gg_iso_day($readyAt));

/** Поле формы: подпись, ввод, ошибка под ним. */
$field = static function (array $o) use ($errors, $v): string {
    $id = $o['id'];
    $name = $o['name'];
    $error = $errors[$name] ?? '';
    $attrs = [
        'id="' . $id . '"',
        'name="' . $name . '"',
        'type="' . ($o['type'] ?? 'text') . '"',
        'value="' . gg_e($v($name, $o['value'] ?? '')) . '"',
        isset($o['autocomplete']) ? 'autocomplete="' . $o['autocomplete'] . '"' : '',
        isset($o['placeholder']) ? 'placeholder="' . gg_e($o['placeholder']) . '"' : '',
        isset($o['inputmode']) ? 'inputmode="' . $o['inputmode'] . '"' : '',
        empty($o['optional']) ? 'aria-required="true"' : '',
        !empty($o['mask']) ? 'data-phone-mask' : '',
        'aria-describedby="' . $id . '-error"',
        $error !== '' ? 'aria-invalid="true"' : '',
    ];
    return '<div class="field' . (!empty($o['wide']) ? ' field--wide' : '') . '">'
        . '<label class="field__label" for="' . $id . '">' . gg_e($o['label'])
        . (!empty($o['optional']) ? '<span class="field__optional"> — необязательно</span>' : '')
        . '</label>'
        . '<input class="field__input" ' . implode(' ', array_filter($attrs)) . '>'
        . '<p class="field__error" id="' . $id . '-error"' . ($error === '' ? ' hidden' : '') . '>' . gg_e($error) . '</p>'
        . '</div>';
};
?>
<div class="container">
  <nav class="crumbs" aria-label="Хлебные крошки">
    <a href="/">Главная</a>
    <span class="crumbs__sep" aria-hidden="true"></span>
    <a href="/cart/">Корзина</a>
    <span class="crumbs__sep" aria-hidden="true"></span>
    <span class="crumbs__current" aria-current="page">Оформление</span>
  </nav>

  <div class="checkout__head">
    <h1 class="checkout__title">Оформление заказа</h1>
    <p class="checkout__lead">Без регистрации: нужны только контакты и адрес.</p>
  </div>

  <div class="checkout__layout">
    <form class="checkout__form" id="checkout-form" method="post" action="/checkout/" novalidate>
      <?= bitrix_sessid_post() ?>

<?php if ($formError !== ''): ?>
      <p class="field__error" role="alert"><?= gg_e($formError) ?></p>
<?php endif; ?>

      <section class="co-step" aria-labelledby="co-contacts">
        <span class="co-step__num" aria-hidden="true">1</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-contacts">Контакты</h2>
          <div class="fields">
            <?= $field(['id' => 'co-name', 'name' => 'name', 'label' => 'Имя', 'autocomplete' => 'name']) ?>
            <?= $field(['id' => 'co-phone', 'name' => 'phone', 'label' => 'Телефон', 'type' => 'tel',
                        'autocomplete' => 'tel', 'inputmode' => 'tel', 'placeholder' => '+7 ___ ___-__-__', 'mask' => true]) ?>
            <?= $field(['id' => 'co-email', 'name' => 'email', 'label' => 'Email', 'type' => 'email',
                        'autocomplete' => 'email', 'inputmode' => 'email', 'placeholder' => 'name@example.ru']) ?>
          </div>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-receive">
        <span class="co-step__num" aria-hidden="true">2</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-receive">Как получить</h2>
          <fieldset class="group">
            <legend class="visually-hidden">Способ получения</legend>
            <div class="caps">
              <label class="cap">
                <input type="radio" name="method" value="delivery"<?= $method === 'delivery' ? ' checked' : '' ?>>
                <span class="cap__face">Доставка</span>
              </label>
              <label class="cap">
                <input type="radio" name="method" value="pickup"<?= $method === 'pickup' ? ' checked' : '' ?>>
                <span class="cap__face">Самовывоз из бутика</span>
              </label>
            </div>
          </fieldset>

          <div class="co-panel" data-panel="delivery">
            <div class="fields">
              <div class="field field--wide">
                <span class="field__label">Город</span>
                <p class="field__static">Москва</p>
                <p class="field__hint">В область и регионы оформляем через менеджера — <a href="/delivery">условия доставки</a></p>
              </div>
              <?= $field(['id' => 'co-street', 'name' => 'street', 'label' => 'Улица и дом',
                          'autocomplete' => 'address-line1', 'wide' => true]) ?>
              <?= $field(['id' => 'co-apartment', 'name' => 'apartment', 'label' => 'Квартира или офис',
                          'autocomplete' => 'address-line2', 'optional' => true]) ?>
              <?= $field(['id' => 'co-intercom', 'name' => 'intercom', 'label' => 'Домофон', 'optional' => true]) ?>
            </div>
          </div>

          <?php /* Пункт самовывоза один, и он показан блоком, а не радиокнопкой:
                   переключатель из одного значения — брак. Появится второй —
                   ряд радиокнопок включится сам. */ ?>
          <div class="co-panel" data-panel="pickup">
            <p class="field__hint">Заказ будет ждать вас здесь:</p>
            <ul class="pickup">
<?php foreach ($points as $point): ?>
              <li class="pickup__point">
                <div class="pickup__text">
                  <span class="pickup__name"><?= gg_e($point['name']) ?></span>
                  <span class="pickup__address"><?= gg_e($point['city'] . ', ' . $point['address']) ?></span>
                  <span class="pickup__hours"><?= gg_e($point['hours']) ?></span>
                </div>
              </li>
<?php endforeach; ?>
            </ul>
          </div>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-when">
        <span class="co-step__num" aria-hidden="true">3</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-when">Когда</h2>
          <fieldset class="group" aria-describedby="co-date-error">
            <legend class="field__label">Дата</legend>
            <div class="caps days">
<?php
$today = gg_day_start();
for ($i = 0; $i < GG_DAYS_AHEAD; $i++):
    $day = gg_add_days($today, $i);
    $iso = gg_iso_day($day);
    $blocked = $day < $readyAt;
    $top = $i === 0 ? 'Сегодня' : ($i === 1 ? 'Завтра' : gg_format_weekday($day));
?>
              <label class="cap cap--day">
                <input type="radio" name="date" value="<?= gg_e($iso) ?>"<?= $iso === $date ? ' checked' : '' ?><?= $blocked ? ' disabled' : '' ?>
                       aria-label="<?= gg_e($top . ', ' . gg_format_day_month($day)) ?>">
                <span class="cap__face"><?= gg_e($top) ?><span class="cap__sub"><?= gg_e(gg_format_day_short($day)) ?></span></span>
              </label>
<?php endfor; ?>
            </div>
<?php if ($totals['hasPreorder']): ?>
            <p class="field__hint">Раньше <?= gg_e(gg_format_day_month($readyAt)) ?> не успеем: в заказе есть позиции под заказ</p>
<?php endif; ?>
            <p class="field__error" id="co-date-error"<?= isset($errors['date']) ? '' : ' hidden' ?>><?= gg_e($errors['date'] ?? '') ?></p>
          </fieldset>

          <fieldset class="group" aria-describedby="co-interval-error">
            <legend class="field__label">Интервал</legend>
            <div class="caps">
<?php foreach (gg_intervals() as $option): ?>
              <label class="cap">
                <input type="radio" name="interval" value="<?= gg_e($option) ?>"<?= $interval === $option ? ' checked' : '' ?><?= isset($errors['interval']) ? ' aria-invalid="true"' : '' ?>>
                <span class="cap__face"><?= gg_e($option) ?></span>
              </label>
<?php endforeach; ?>
            </div>
            <p class="field__error" id="co-interval-error"<?= isset($errors['interval']) ? '' : ' hidden' ?>><?= gg_e($errors['interval'] ?? '') ?></p>
          </fieldset>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-payment">
        <span class="co-step__num" aria-hidden="true">4</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-payment">Оплата</h2>
<?php if ($totals['onRequestCount']): ?>
          <?php /* В заказе есть позиции по запросу — способа оплаты выбирать
                   не из чего: суммы ещё нет. */ ?>
          <p class="ready-line co-note"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>Точную сумму подтвердит менеджер и пришлёт ссылку на оплату в сообщения на ваш телефон</span></p>
<?php else: ?>
          <fieldset class="group">
            <legend class="visually-hidden">Способ оплаты</legend>
            <div class="caps">
<?php foreach (gg_payment_options() as $option): ?>
              <label class="cap">
                <input type="radio" name="payment" value="<?= gg_e($option['value']) ?>"<?= $payment === $option['value'] ? ' checked' : '' ?>>
                <span class="cap__face"><?= gg_e($option['label']) ?></span>
              </label>
<?php endforeach; ?>
            </div>
          </fieldset>
<?php endif; ?>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-comment">
        <span class="co-step__num" aria-hidden="true">5</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-comment">Комментарий</h2>
          <div class="field field--wide">
            <label class="field__label" for="co-comment-text">Что важно знать курьеру</label>
            <textarea class="field__input" id="co-comment-text" name="comment" rows="3"
                      placeholder="Например: позвонить за час, код от шлагбаума"><?= gg_e($v('comment')) ?></textarea>
          </div>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-consent-title">
        <span class="co-step__num" aria-hidden="true">6</span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-consent-title">Согласие</h2>
          <div class="field">
            <label class="check" for="co-consent">
              <input type="checkbox" id="co-consent" name="consent" value="Y"<?= !empty($post['consent']) ? ' checked' : '' ?>
                     aria-required="true" aria-describedby="co-consent-error"<?= isset($errors['consent']) ? ' aria-invalid="true"' : '' ?>>
              <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
              <span>Принимаю <a href="/terms">условия оферты</a> и соглашаюсь с <a href="/privacy">политикой конфиденциальности</a></span>
            </label>
            <p class="field__error" id="co-consent-error"<?= isset($errors['consent']) ? '' : ' hidden' ?>><?= gg_e($errors['consent'] ?? '') ?></p>
          </div>
        </div>
      </section>
    </form>

    <aside class="checkout__aside summary-sticky" aria-label="Ваш заказ">
      <div class="summary">
        <h2 class="summary__title">Ваш заказ</h2>
        <ul class="summary__items" aria-label="Состав заказа">
<?php foreach ($lines as $line): ?>
          <li class="summary__item<?= $line['inStock'] ? '' : ' is-preorder' ?>">
            <span class="summary__item-shot"><?= gg_product_shot(['CODE' => $line['code']], $line['name'], 'media--compact') ?></span>
            <span class="summary__qty" aria-hidden="true"><?= (int)$line['qty'] ?></span>
            <span class="visually-hidden"><?= gg_e($line['name'] . ', ' . $line['note'] . ' — ' . $line['qty'] . ' шт.') ?></span>
          </li>
<?php endforeach; ?>
        </ul>
        <p class="checkout__edit"><a class="link-btn" href="/cart/">Изменить состав</a></p>

        <dl class="summary__rows">
          <div class="summary__row"><dt>Сумма</dt><dd><?= gg_e($texts['sum']) ?></dd></div>
          <div class="summary__row"><dt>Доставка</dt><dd data-summary-delivery data-delivery="подтвердит менеджер" data-pickup="не нужна"><?= $method === 'pickup' ? 'не нужна' : 'подтвердит менеджер' ?></dd></div>
        </dl>
        <p class="summary__total">
          <span>Итого</span>
          <span class="summary__total-value<?= $texts['allOnRequest'] ? ' is-text' : '' ?>"><?= gg_e($texts['total']) ?></span>
        </p>
<?php if ($texts['note'] !== ''): ?>
        <p class="summary__note"><?= gg_e($texts['note']) ?></p>
<?php endif; ?>

        <button type="submit" form="checkout-form" class="btn btn--solid summary__action">Подтвердить заказ</button>
      </div>
    </aside>
  </div>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
