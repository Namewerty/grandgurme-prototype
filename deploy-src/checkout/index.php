<?php
/**
 * Оформление /checkout. Одна страница, без шагов-вкладок и без регистрации.
 *
 * ТРИ РЕЖИМА ПО СОДЕРЖИМОМУ КОРЗИНЫ — как в src/js/checkout/checkout-page.js:
 *   только заказ   — Контакты · Как получить · Когда · Оплата · Комментарий · Согласие;
 *   заказ и заявка — … · Оплата · Заявка менеджеру · Комментарий · Согласие;
 *   только заявка  — Контакты · Заявка менеджеру · Согласие.
 * Нумерация сквозная по показанным шагам.
 *
 * ДВЕ ДОСТАВКИ. Когда в заказе есть и наличие, и под заказ, шаг «Когда»
 * начинается с выбора «одной / двумя». Сервер рисует ОБА подблока: без
 * скрипта переключатель ничего бы не прятал. Со скриптом
 * (src/bitrix/purchase-hydrate.js) виден только выбранный. Подблоки двух
 * доставок проверяются только при выбранном «двумя».
 *
 * ПОРЯДОК ОТПРАВКИ: сначала заказ; не создался — ошибка на форме, заявка
 * тоже не создаётся. Заказ создан, заявка нет — страница успеха заказа со
 * строкой «Заявку отправить не удалось, позвоните нам».
 *
 * КОРОБКИ (24.09.2026). Перед отправкой корзина сверяется со складом
 * (gg_cart_sync): коробку, которую купили, пока человек заполнял форму,
 * заменяет ближайшая свободная. Тогда заказ НЕ отправляется — над формой
 * сообщение, сумма в сводке уже новая, следующее нажатие отправляет. Так
 * же делал прототип (verifyBoxes, src/data/checkout-copy.js → boxes).
 *
 * ПРОВЕРКА НА СЕРВЕРЕ. Ошибка — текстом под полем, поле помечено
 * aria-invalid, введённое возвращается в форму. Тексты —
 * src/data/checkout-copy.js.
 */
define('GG_PAGE_CLASS', 'page-checkout');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/checkout.php';

$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$state = gg_cart_state();

/* Оформлять нечего — возвращаем в корзину: там пустое состояние с выходами. */
if ($state['totals']['positions'] === 0) {
    LocalRedirect('/cart/');
}

$plan = gg_checkout_plan($state);
$mode = gg_checkout_modes()[$plan['mode']];
$totals = $plan['totals'];
$readyAt = $plan['readyAt'];
$today = $plan['today'];
$points = gg_pickup_points();
$ways = gg_contact_ways();

$APPLICATION->SetTitle($mode['title'] . ' — №1 Гранд Гурмэ');

$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? $_POST : [];
$errors = [];
$formError = '';

/* Кабинет (21.09.2026). Вошедшему контакты подставлены из профиля, адрес —
   из сохранённых: выбранная карточка адреса заполняет поля до проверки,
   поэтому проверка и заказ о кабинете ничего не знают. Гостю — строка
   «Покупали у нас раньше? Войдите». Тексты — src/data/account-copy.js → checkout. */
$ggUser = gg_account_user();
$ggAddresses = $ggUser ? gg_address_list() : [];
$ggAddressChoice = 'new';
if ($ggAddresses) {
    $ggAddressChoice = (string)$ggAddresses[0]['id'];
    foreach ($ggAddresses as $a) {
        if ($a['isDefault']) {
            $ggAddressChoice = (string)$a['id'];
        }
    }
}
if ($post && $ggUser && isset($post['address'])) {
    $ggAddressChoice = (string)$post['address'];
    $saved = $ggAddressChoice !== 'new' ? gg_address_by_id((int)$ggAddressChoice) : null;
    if ($saved) {
        $post['street'] = $saved['street'];
        $post['apartment'] = $saved['apartment'];
        $post['intercom'] = $saved['intercom'];
    } else {
        $ggAddressChoice = 'new';
    }
}
$ggPrefill = $ggUser ? [
    'name' => trim($ggUser['name'] . ' ' . $ggUser['lastName']),
    'phone' => gg_phone_format($ggUser['phone']),
    'email' => $ggUser['email'],
] : [];

/* Коробку заменили при открытии страницы — сказать сразу, а не молча
   показать другую сумму. */
if (!$post && $state['boxNotices']) {
    $formError = implode(' ', $state['boxNotices']) . ' Проверьте сумму.';
}

if ($post) {
    if (!check_bitrix_sessid()) {
        LocalRedirect('/checkout/');
    }
    $errors = gg_checkout_validate($post, $plan);

    if ($state['boxNotices']) {
        /* Коробку заменили на этом же нажатии — заказ не отправляем. */
        $formError = implode(' ', $state['boxNotices']) . ' Проверьте сумму и оформите заказ ещё раз.';
    } elseif (!$errors && gg_request_is_spam($post)) {
        $formError = 'Заявку отправить не удалось, позвоните нам';
    } elseif (!$errors) {
        $name = trim((string)$post['name']);
        $phone = gg_phone_format(gg_phone_digits((string)$post['phone']));
        $email = trim((string)($post['email'] ?? ''));
        $method = ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery';
        $pickup = $points[0]['city'] . ', ' . $points[0]['address'];
        $shipments = gg_checkout_shipments($post, $plan);
        $orderNumber = '';
        $orderId = 0;

        /* 1. Заказ. */
        if ($plan['hasOrder']) {
            /* Способ оплаты уезжает в комментарий словами, а не кодом: читает
               его менеджер, а не платёжный модуль. */
            $paymentLabel = '';
            foreach (gg_payment_options() as $option) {
                if ($option['value'] === (string)($post['payment'] ?? '')) {
                    $paymentLabel = $option['label'];
                }
            }
            $result = gg_create_order([
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'method' => $method,
                'street' => trim((string)($post['street'] ?? '')),
                'apartment' => trim((string)($post['apartment'] ?? '')),
                'intercom' => trim((string)($post['intercom'] ?? '')),
                'pickup' => $pickup,
                'shipments' => $shipments,
                'payment' => $paymentLabel,
                'comment' => trim((string)($post['comment'] ?? '')),
                'promo' => gg_promo(),
            ]);
            if (!$result['ok']) {
                $formError = $result['error'] !== '' ? $result['error'] : 'Заказ не удалось принять, попробуйте ещё раз';
            } else {
                $orderNumber = $result['number'];
                $orderId = $result['id'];
            }
        }

        /* 2. Заявка — только если заказ создан или его не было. */
        $requestNumber = '';
        $requestFailed = false;
        if ($formError === '' && $plan['hasRequest']) {
            $way = isset($ways[(string)($post['contact_way'] ?? '')]) ? (string)$post['contact_way'] : 'call';
            $request = gg_request_create([
                'name' => $name,
                'phone' => $phone,
                'email' => $email,
                'contactWay' => $way,
                'question' => trim((string)($post['question'] ?? '')),
                'orderNumber' => $orderNumber,
                'lines' => $plan['requestLines'],
            ]);
            if ($request['ok']) {
                $requestNumber = (string)$request['id'];
                gg_request_save([]);
                gg_remember_request($requestNumber, [
                    'contactWay' => $way,
                    'items' => array_map(static fn($line) => [
                        'name' => $line['name'],
                        'note' => $line['note'],
                        'qty' => (int)$line['qty'],
                    ], $plan['requestLines']),
                ]);
            } elseif ($plan['hasOrder']) {
                $requestFailed = true;
            } else {
                $formError = $request['error'];
            }
        }

        if ($formError === '') {
            /* Кабинет: получение заказа и телефон цифрами — по ним заказ
               найдёт покупателя при входе (include/account.php). */
            if ($plan['hasOrder'] && $orderId > 0) {
                gg_order_meta_save($orderId, gg_phone_digits($phone), [
                    'method' => $method,
                    'receive' => $method === 'pickup'
                        ? ['point' => ['name' => $points[0]['name'], 'address' => $pickup]]
                        : [
                            'city' => 'Москва',
                            'street' => trim((string)($post['street'] ?? '')),
                            'apartment' => trim((string)($post['apartment'] ?? '')),
                            'intercom' => trim((string)($post['intercom'] ?? '')),
                        ],
                    'shipments' => array_map(static fn($s) => [
                        'kind' => $s['kind'],
                        'label' => $s['label'],
                        'date' => $s['date'],
                        'interval' => $s['interval'],
                        'items' => $s['productIds'] ?? [],
                    ], $shipments),
                    'payment' => $paymentLabel ?? '',
                    'comment' => trim((string)($post['comment'] ?? '')),
                    'requestNumber' => $requestNumber,
                ]);
            }
            if ($ggUser && $requestNumber !== '' && CModule::IncludeModule('iblock')) {
                CIBlockElement::SetPropertyValuesEx((int)$requestNumber, gg_request_iblock_id(), ['USER_ID' => $ggUser['id']]);
            }
            if ($ggUser && $plan['hasOrder'] && $method === 'delivery' && $ggAddressChoice === 'new'
                && !empty($post['save_address'])) {
                // Повтор и одиннадцатый адрес молча не сохраняются — как в прототипе.
                gg_address_save([
                    'street' => trim((string)($post['street'] ?? '')),
                    'apartment' => trim((string)($post['apartment'] ?? '')),
                    'intercom' => trim((string)($post['intercom'] ?? '')),
                ]);
            }

            $query = [];
            if ($plan['hasOrder']) {
                gg_remember_order($orderNumber, [
                    'id' => $orderId,
                    'shipments' => array_map(static fn($s) => [
                        'kind' => $s['kind'],
                        'date' => $s['date'],
                        'interval' => $s['interval'],
                    ], $shipments),
                    'method' => $method,
                    'address' => $method === 'pickup' ? $pickup : trim((string)($post['street'] ?? '')),
                    'readyAt' => $readyAt,
                    'createdAt' => time(),
                    'requestFailed' => $requestFailed,
                ]);
                gg_set_promo('');
                $query[] = 'n=' . rawurlencode($orderNumber);
            }
            if ($requestNumber !== '') {
                $query[] = 'r=' . rawurlencode($requestNumber);
            }
            LocalRedirect('/order-success/?' . implode('&', $query));
        }
    }
}

/** Значение поля: то, что человек ввёл, или пусто. */
$v = static function (string $name, string $default = '') use ($post, $ggPrefill): string {
    if (isset($post[$name])) {
        return trim((string)$post[$name]);
    }
    return (string)($ggPrefill[$name] ?? $default);
};
$method = ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery';
$split = gg_checkout_split($post, $plan);
$payment = (string)($post['payment'] ?? 'card');
$contactWay = isset($ways[(string)($post['contact_way'] ?? '')]) ? (string)$post['contact_way'] : 'call';

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

/**
 * Лента дней и интервалы одной отгрузки.
 * $key — '' | 'stock' | 'preorder'; дни раньше $blockedBefore выключены.
 */
$shipmentFields = static function (string $key, int $from, int $length, int $blockedBefore, string $hint = '') use ($post, $errors, $today): string {
    $suffix = $key !== '' ? '_' . $key : '';
    $checkedDate = (string)($post['date' . $suffix] ?? gg_iso_day(max($from, $blockedBefore)));
    $interval = (string)($post['interval' . $suffix] ?? '');
    $intervalError = $errors['interval' . $suffix] ?? '';
    $dateError = $errors['date' . $suffix] ?? '';

    $html = '<fieldset class="group" aria-describedby="co-date' . $suffix . '-error">'
        . '<legend class="field__label">Дата</legend><div class="caps days">';
    for ($i = 0; $i < $length; $i++) {
        $day = gg_add_days($from, $i);
        $iso = gg_iso_day($day);
        $top = $day === $today ? 'Сегодня' : ($day === gg_add_days($today, 1) ? 'Завтра' : gg_format_weekday($day));
        $html .= '<label class="cap cap--day">'
            . '<input type="radio" name="date' . $suffix . '" value="' . gg_e($iso) . '"'
            . ($iso === $checkedDate ? ' checked' : '') . ($day < $blockedBefore ? ' disabled' : '')
            . ' aria-label="' . gg_e($top . ', ' . gg_format_day_month($day)) . '">'
            . '<span class="cap__face">' . gg_e($top) . '<span class="cap__sub">' . gg_e(gg_format_day_short($day)) . '</span></span>'
            . '</label>';
    }
    $html .= '</div>'
        . ($hint !== '' ? '<p class="field__hint">' . gg_e($hint) . '</p>' : '')
        . '<p class="field__error" id="co-date' . $suffix . '-error"' . ($dateError === '' ? ' hidden' : '') . '>' . gg_e($dateError) . '</p>'
        . '</fieldset>';

    $html .= '<fieldset class="group" aria-describedby="co-interval' . $suffix . '-error">'
        . '<legend class="field__label">Интервал</legend><div class="caps">';
    foreach (gg_intervals() as $option) {
        $html .= '<label class="cap">'
            . '<input type="radio" name="interval' . $suffix . '" value="' . gg_e($option) . '"'
            . ($interval === $option ? ' checked' : '') . ($intervalError !== '' ? ' aria-invalid="true"' : '') . '>'
            . '<span class="cap__face">' . gg_e($option) . '</span></label>';
    }
    $html .= '</div><p class="field__error" id="co-interval' . $suffix . '-error"' . ($intervalError === '' ? ' hidden' : '') . '>'
        . gg_e($intervalError) . '</p></fieldset>';
    return $html;
};

$step = 0;
$num = static function () use (&$step): int {
    return ++$step;
};

$splitTexts = [
    'delivery' => [
        'one' => ['Одной доставкой', 'Всё вместе к ' . gg_format_day_month($readyAt)],
        'two' => ['Двумя доставками', 'Сначала то, что в наличии, затем под заказ к ' . gg_format_day_month($readyAt)],
    ],
    'pickup' => [
        'one' => ['Одним визитом', 'Всё вместе к ' . gg_format_day_month($readyAt)],
        'two' => ['Двумя визитами', 'Сначала то, что в наличии, затем под заказ к ' . gg_format_day_month($readyAt)],
    ],
];
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
    <h1 class="checkout__title"><?= gg_e($mode['title']) ?></h1>
<?php
    $ggLead = $mode['lead'];
    if ($ggUser && $plan['mode'] === 'order') {
        $ggLead = $ggAddresses ? 'Контакты и адрес подставили из кабинета.' : 'Контакты подставили из кабинета.';
    }
?>
    <p class="checkout__lead"><?= gg_e($ggLead) ?></p>
  </div>

  <div class="checkout__layout">
    <form class="checkout__form" id="checkout-form" method="post" action="/checkout/" novalidate>
      <?= bitrix_sessid_post() ?>
      <?php /* Поле-ловушка против ботов: скрыто от людей и от скринридера. */ ?>
      <div class="visually-hidden" aria-hidden="true">
        <label>Сайт компании <input type="text" name="<?= GG_REQUEST_TRAP ?>" tabindex="-1" autocomplete="off"></label>
      </div>

<?php if ($formError !== ''): ?>
      <p class="field__error" role="alert"><?= gg_e($formError) ?></p>
<?php endif; ?>

<?php if (!$ggUser): ?>
      <p class="checkout__login">Покупали у нас раньше? <a href="/account/login/?back=%2Fcheckout%2F">Войдите</a> — подставим контакты и адреса.</p>
<?php endif; ?>

      <section class="co-step" aria-labelledby="co-contacts">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-contacts">Контакты</h2>
          <div class="fields">
            <?= $field(['id' => 'co-name', 'name' => 'name', 'label' => 'Имя', 'autocomplete' => 'name']) ?>
            <?= $field(['id' => 'co-phone', 'name' => 'phone', 'label' => 'Телефон', 'type' => 'tel',
                        'autocomplete' => 'tel', 'inputmode' => 'tel', 'placeholder' => '+7 ___ ___-__-__', 'mask' => true]) ?>
            <?= $field(['id' => 'co-email', 'name' => 'email', 'label' => 'Email', 'type' => 'email',
                        'autocomplete' => 'email', 'inputmode' => 'email', 'placeholder' => 'name@example.ru',
                        'optional' => !$plan['hasOrder']]) ?>
          </div>
        </div>
      </section>

<?php if ($plan['hasOrder']): ?>
      <section class="co-step" aria-labelledby="co-receive">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
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
<?php if ($ggAddresses): ?>
            <fieldset class="group">
              <legend class="field__label">Адрес доставки</legend>
              <div class="split">
<?php foreach ($ggAddresses as $a):
        $line = implode(', ', array_filter([
            $a['label'] !== '' ? $a['street'] : '',
            $a['apartment'] !== '' ? 'кв. ' . $a['apartment'] : '',
            $a['intercom'] !== '' ? 'домофон ' . $a['intercom'] : '',
        ])); ?>
                <label class="cap cap--split">
                  <input type="radio" name="address" value="<?= (int)$a['id'] ?>"<?= $ggAddressChoice === (string)$a['id'] ? ' checked' : '' ?>>
                  <span class="cap__face">
                    <span class="cap__label"><?= gg_e($a['label'] !== '' ? $a['label'] : $a['street']) ?></span>
                    <?php if ($line !== ''): ?><span class="cap__sub"><?= gg_e($line) ?></span><?php endif; ?>
                  </span>
                </label>
<?php endforeach; ?>
                <label class="cap cap--split">
                  <input type="radio" name="address" value="new"<?= $ggAddressChoice === 'new' ? ' checked' : '' ?>>
                  <span class="cap__face">
                    <span class="cap__label">Другой адрес</span>
                    <span class="cap__sub">Ввести новый</span>
                  </span>
                </label>
              </div>
            </fieldset>
<?php endif; ?>
            <div class="fields" data-new-address>
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
<?php if ($ggUser): ?>
<?php   if (count($ggAddresses) >= GG_ADDRESS_MAX): ?>
              <p class="field__hint field--wide">В кабинете уже 10 адресов, этот не сохраним</p>
<?php   else: ?>
              <div class="field field--wide">
                <label class="check" for="co-save-address">
                  <input type="checkbox" id="co-save-address" name="save_address" value="Y"<?= !$post || !empty($post['save_address']) ? ' checked' : '' ?>>
                  <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
                  <span>Сохранить адрес в кабинете</span>
                </label>
              </div>
<?php   endif; ?>
<?php endif; ?>
            </div>
          </div>

          <?php /* Пункт самовывоза один, и он показан блоком, а не радиокнопкой:
                   переключатель из одного значения — брак. */ ?>
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
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-when">Когда</h2>
<?php
    $blockedHint = $totals['order']['hasPreorder']
        ? 'Раньше ' . gg_format_day_month($readyAt) . ' не успеем: в заказе есть позиции под заказ'
        : '';
    $single = $shipmentFields('', $today, GG_DAYS_AHEAD, $readyAt, $blockedHint);
?>
<?php if (!$plan['canSplit']): ?>
          <?= $single ?>
<?php else: ?>
          <fieldset class="group">
            <legend class="field__label">Как привезти</legend>
            <div class="split" data-split-texts="<?= gg_e(json_encode($splitTexts, JSON_UNESCAPED_UNICODE)) ?>">
<?php foreach (['one', 'two'] as $key): ?>
              <label class="cap cap--split">
                <input type="radio" name="split" value="<?= $key ?>"<?= $split === $key ? ' checked' : '' ?>>
                <span class="cap__face"><span class="cap__label" data-split-label="<?= $key ?>"><?= gg_e($splitTexts[$method][$key][0]) ?></span><span class="cap__sub" data-split-sub="<?= $key ?>"><?= gg_e($splitTexts[$method][$key][1]) ?></span></span>
              </label>
<?php endforeach; ?>
            </div>
          </fieldset>

          <div class="co-panel" data-split-panel="one">
            <?= $single ?>
          </div>

          <div class="co-panel" data-split-panel="two">
            <div class="co-sub" role="group" aria-labelledby="co-sub-stock">
              <h3 class="co-sub__title" id="co-sub-stock">Товары в наличии · <?= gg_e(gg_positions_label(count($plan['stockLines']))) ?></h3>
              <?= $shipmentFields('stock', $today, max(1, (int)round(($readyAt - $today) / 86400)), $today) ?>
            </div>
            <div class="co-sub" role="group" aria-labelledby="co-sub-preorder">
              <h3 class="co-sub__title" id="co-sub-preorder">Товары под заказ · <?= gg_e(gg_positions_label(count($plan['preorderLines']))) ?></h3>
              <?= $shipmentFields('preorder', $readyAt, GG_DAYS_AHEAD, $readyAt) ?>
            </div>
            <?php /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: стоимость второй доставки. */ ?>
            <p class="ready-line co-note"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>Стоимость каждой доставки подтвердит менеджер</span></p>
          </div>
<?php endif; ?>
        </div>
      </section>

      <section class="co-step" aria-labelledby="co-payment">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-payment">Оплата</h2>
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
<?php if ($plan['hasRequest']): ?>
          <p class="ready-line co-note"><span class="ready-line__mark" aria-hidden="true">⬦</span><span>Оплачиваете только заказ, <?= gg_e(gg_price((float)$totals['order']['sum'])) ?>. Позиции заявки менеджер подтвердит отдельно.</span></p>
<?php endif; ?>
        </div>
      </section>
<?php endif; ?>

<?php if ($plan['hasRequest']): ?>
      <section class="co-step" aria-labelledby="co-request">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-request">Заявка менеджеру</h2>
          <ul class="order-lines co-request__lines" aria-label="Позиции заявки">
<?php foreach ($plan['requestLines'] as $line): ?>
            <li class="order-lines__row">
              <span class="order-lines__name"><?= gg_e($line['name']) ?>
                <span class="order-lines__note"><?= gg_e(trim($line['note'] . ' × ' . $line['qty'])) ?></span>
              </span>
            </li>
<?php endforeach; ?>
          </ul>
          <p class="co-request__edit"><a class="link-btn" href="/cart/">Изменить состав</a></p>

          <fieldset class="group">
            <legend class="field__label">Как с вами связаться</legend>
            <div class="caps">
<?php foreach ($ways as $value => $way): ?>
              <label class="cap">
                <input type="radio" name="contact_way" value="<?= gg_e($value) ?>"<?= $contactWay === $value ? ' checked' : '' ?>>
                <span class="cap__face"><?= gg_e($way['label']) ?></span>
              </label>
<?php endforeach; ?>
            </div>
          </fieldset>

          <div class="field field--wide">
            <label class="field__label" for="co-question">Вопрос менеджеру<span class="field__optional"> — необязательно</span></label>
            <textarea class="field__input" id="co-question" name="question" rows="3"
                      placeholder="Например: нужно к пятнице или подойдёт другая фасовка"><?= gg_e($v('question')) ?></textarea>
          </div>
        </div>
      </section>
<?php endif; ?>

<?php if ($plan['hasOrder']): ?>
      <section class="co-step" aria-labelledby="co-comment">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
        <div class="co-step__body">
          <h2 class="co-step__title" id="co-comment">Комментарий</h2>
          <div class="field field--wide">
            <label class="field__label" for="co-comment-text">Что важно знать курьеру</label>
            <textarea class="field__input" id="co-comment-text" name="comment" rows="3"
                      placeholder="Например: позвонить за час, код от шлагбаума"><?= gg_e($v('comment')) ?></textarea>
          </div>
        </div>
      </section>
<?php endif; ?>

      <section class="co-step" aria-labelledby="co-consent-title">
        <span class="co-step__num" aria-hidden="true"><?= $num() ?></span>
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

<?php $requestOnly = $plan['mode'] === 'request'; ?>
    <aside class="checkout__aside summary-sticky" aria-label="<?= $requestOnly ? 'Заявка менеджеру' : 'Ваш заказ' ?>">
      <div class="summary">
        <h2 class="summary__title"><?= $requestOnly ? 'Заявка менеджеру' : 'Ваш заказ' ?></h2>
<?php
$shots = static function (array $lines, string $label): string {
    $html = '<ul class="summary__items" aria-label="' . gg_e($label) . '">';
    foreach ($lines as $line) {
        $html .= '<li class="summary__item">'
            . '<span class="summary__item-shot">' . gg_product_shot(['CODE' => $line['code']], $line['name'], 'media--compact') . '</span>'
            . '<span class="summary__qty" aria-hidden="true">' . (int)$line['qty'] . '</span>'
            . '<span class="visually-hidden">' . gg_e($line['name'] . ($line['note'] !== '' ? ', ' . $line['note'] : '') . ' — ' . $line['qty'] . ' шт.') . '</span>'
            . '</li>';
    }
    return $html . '</ul>';
};
?>
<?php if ($plan['hasOrder']): ?>
        <?= $shots($plan['orderLines'], 'Состав заказа') ?>
<?php endif; ?>
<?php if ($plan['hasRequest']): ?>
<?php   if ($plan['hasOrder']): ?>
        <p class="summary__label">Заявка менеджеру</p>
<?php   endif; ?>
        <?= $shots($plan['requestLines'], 'Состав заявки') ?>
<?php endif; ?>
        <p class="checkout__edit"><a class="link-btn" href="/cart/">Изменить состав</a></p>

<?php if ($plan['hasOrder']): ?>
        <dl class="summary__rows">
          <div class="summary__row"><dt>Сумма</dt><dd><?= gg_e(gg_price((float)$totals['order']['sum'])) ?></dd></div>
          <div class="summary__row"><dt>Доставка</dt><dd data-summary-delivery data-delivery="подтвердит менеджер" data-delivery-two="две, подтвердит менеджер" data-pickup="не нужна"><?=
            $method === 'pickup' ? 'не нужна' : ($split === 'two' ? 'две, подтвердит менеджер' : 'подтвердит менеджер')
          ?></dd></div>
        </dl>
        <p class="summary__total">
          <span>Итого</span>
          <span class="summary__total-value"><?= gg_e(gg_price((float)$totals['order']['sum'])) ?></span>
        </p>
<?php else: ?>
        <dl class="summary__rows">
          <div class="summary__row"><dt>Позиций</dt><dd><?= (int)$totals['request']['positions'] ?></dd></div>
        </dl>
<?php endif; ?>

        <button type="submit" form="checkout-form" class="btn btn--solid summary__action"><?= gg_e($mode['submit']) ?></button>
      </div>
    </aside>
  </div>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
