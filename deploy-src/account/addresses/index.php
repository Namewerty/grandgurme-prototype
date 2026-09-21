<?php
/**
 * Адреса доставки /account/addresses/.
 *
 * Разметка — src/js/account/pages/addresses.js: карточки по две в ряд от
 * 768px, последняя клетка — кнопка «Добавить адрес» размером с карточку.
 * ФОРМА ОТКРЫВАЕТСЯ НА МЕСТЕ: при изменении — вместо карточки, при
 * добавлении — вместо кнопки. Удаление подтверждается там же, на месте
 * карточки. Модальных окон нет.
 *
 * БЕЗ JS. Каждая кнопка — submit с полем gg_address_action:
 *   add | edit | confirm_delete   открыть форму или подтверждение;
 *   cancel                        закрыть;
 *   save | delete | default       записать.
 * Ответ всегда редирект (PRG). Что открыто на месте, говорит адрес:
 * ?add=1, ?edit=<id>, ?confirm=<id> — открыто одно, остальное игнорируется.
 *
 * КНОПКИ КАРТОЧКИ СТОЯТ ВНЕ ФОРМЫ. Разметка карточки — article, внутри
 * p.addr-card__actions, и форму туда не вложить. Поэтому у каждой
 * карточки своя пустая скрытая форма (#addr-<id>: sessid и id), а кнопки
 * ссылаются на неё атрибутом form — так же сделано «Изменить номер» на входе.
 *
 * ОШИБКИ ФОРМЫ ПЕРЕЖИВАЮТ РЕДИРЕКТ одной отрисовкой: введённое и тексты
 * ошибок лежат в $_SESSION['GG_ADDRESS_FORM'] и возвращаются в поля.
 * Тексты — checkout-copy.js → receive (форма та же, что на оформлении)
 * и account-copy.js → addresses.
 *
 * Правила — gg_address_save(): не больше GG_ADDRESS_MAX адресов, повтор
 * улицы с квартирой — duplicate, первый адрес становится основным сам,
 * удалили основной — основным становится самый ранний.
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

$self = '/account/addresses/';

/* Гость уходит на вход с возвратом сюда, и только потом разбираются формы. */
gg_require_user();
gg_account_handle_post($self);

$texts = [
    'streetError' => 'Укажите улицу и номер дома',
    'duplicate' => 'Такой адрес уже сохранён',
    'limit' => 'Можно сохранить до 10 адресов',
];

/* -------------------------------------------------------------------------
   Формы
   ------------------------------------------------------------------------- */

$action = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? (string)($_POST['gg_address_action'] ?? '') : '';

if ($action !== '') {
    if (!check_bitrix_sessid()) {
        LocalRedirect($self);
    }
    $id = max(0, (int)($_POST['id'] ?? 0));
    /* Адрес только свой: gg_address_by_id() ищет в списке вошедшего. */
    $own = $id > 0 ? gg_address_by_id($id) : null;

    if ($action === 'add') {
        LocalRedirect($self . '?add=1');
    }
    if ($action === 'edit' && $own) {
        LocalRedirect($self . '?edit=' . $id);
    }
    if ($action === 'confirm_delete' && $own) {
        LocalRedirect($self . '?confirm=' . $id);
    }
    if ($action === 'delete' && $own) {
        gg_address_delete($id);
    }
    /* Проверка своего адреса обязательна: gg_address_set_default() сначала
       снимает отметку со всех, и чужой id оставил бы кабинет без основного. */
    if ($action === 'default' && $own) {
        gg_address_set_default($id);
    }

    if ($action === 'save') {
        $values = [
            'label' => trim((string)($_POST['label'] ?? '')),
            'street' => trim((string)($_POST['street'] ?? '')),
            'apartment' => trim((string)($_POST['apartment'] ?? '')),
            'intercom' => trim((string)($_POST['intercom'] ?? '')),
            'isDefault' => !empty($_POST['isDefault']),
        ];
        /* Правка адреса, которого уже нет (удалили в другой вкладке), —
           просто назад к списку. */
        if ($id > 0 && !$own) {
            LocalRedirect($self);
        }

        /* focus — куда поставить курсор после редиректа: как в прототипе,
           на улицу при ошибке улицы и повторе, на «Сохранить» при лимите. */
        $errors = [];
        $focus = 'street';
        if ($values['street'] === '') {
            $errors['street'] = $texts['streetError'];
        } else {
            $result = gg_address_save(['id' => $id] + $values);
            if (!empty($result['ok'])) {
                LocalRedirect($self);
            }
            $error = (string)($result['error'] ?? '');
            if (!empty($result['errors']['street'])) {
                $errors['street'] = (string)$result['errors']['street'];
            } elseif ($error === 'duplicate') {
                $errors['form'] = $texts['duplicate'];
            } elseif ($error === 'limit') {
                $errors['form'] = $texts['limit'];
                $focus = 'submit';
            } else {
                // not_found и прочее: сохранять нечего, форма больше не нужна.
                LocalRedirect($self);
            }
        }

        $_SESSION['GG_ADDRESS_FORM'] = [
            'key' => $id > 0 ? 'edit:' . $id : 'add',
            'values' => $values,
            'errors' => $errors,
            'focus' => $focus,
        ];
        LocalRedirect($id > 0 ? $self . '?edit=' . $id : $self . '?add=1');
    }

    /* cancel, выполненные delete и default, чужой или пропавший id. */
    LocalRedirect($self);
}

/* -------------------------------------------------------------------------
   Что показываем
   ------------------------------------------------------------------------- */

$APPLICATION->SetTitle('Адреса доставки — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$list = gg_address_list();
$byId = [];
foreach ($list as $address) {
    $byId[$address['id']] = $address;
}

/* Что открыто на месте: { mode: edit | confirm | add, id } — как open в прототипе. */
$editId = (int)($_GET['edit'] ?? 0);
$confirmId = (int)($_GET['confirm'] ?? 0);
$open = null;
if ($editId > 0 && isset($byId[$editId])) {
    $open = ['mode' => 'edit', 'id' => $editId];
} elseif ($confirmId > 0 && isset($byId[$confirmId])) {
    $open = ['mode' => 'confirm', 'id' => $confirmId];
} elseif (!empty($_GET['add']) && count($list) < GG_ADDRESS_MAX) {
    $open = ['mode' => 'add', 'id' => 0];
}

/* Ошибки прошлой отправки — только для той же формы. */
$flash = $_SESSION['GG_ADDRESS_FORM'] ?? null;
unset($_SESSION['GG_ADDRESS_FORM']);
$flashKey = $open && $open['mode'] === 'edit' ? 'edit:' . $open['id'] : ($open && $open['mode'] === 'add' ? 'add' : '');
if (!is_array($flash) || $flashKey === '' || (string)($flash['key'] ?? '') !== $flashKey) {
    $flash = null;
}

/** «кв. 5 · домофон 5» — вторая строка карточки (addressDetails прототипа). */
$details = static fn(array $address): string => implode(' · ', array_filter([
    (string)$address['apartment'] !== '' ? 'кв. ' . $address['apartment'] : '',
    (string)$address['intercom'] !== '' ? 'домофон ' . $address['intercom'] : '',
]));

$optional = '<span class="field__optional"> · необязательно</span>';

/** Карточка адреса. Кнопки отправляют скрытую форму #addr-<id>. */
$card = static function (array $address) use ($details): void {
    $form = 'addr-' . (int)$address['id'];
    $line = $details($address);
    ?>
        <article class="addr-card">
          <h2 class="addr-card__title"><?= gg_e($address['label'] !== '' ? $address['label'] : $address['street']) ?></h2>
<?php if ($address['label'] !== ''): ?>
          <p class="addr-card__line"><?= gg_e($address['street']) ?></p>
<?php endif; ?>
<?php if ($line !== ''): ?>
          <p class="addr-card__line addr-card__line--mute"><?= gg_e($line) ?></p>
<?php endif; ?>
<?php if ($address['isDefault']): ?>
          <p class="addr-card__default">Основной</p>
<?php endif; ?>
          <p class="addr-card__actions">
            <button type="submit" class="link-btn" form="<?= gg_e($form) ?>" name="gg_address_action" value="edit">Изменить</button>
            <button type="submit" class="link-btn" form="<?= gg_e($form) ?>" name="gg_address_action" value="confirm_delete">Удалить</button>
<?php if (!$address['isDefault']): ?>
            <button type="submit" class="link-btn" form="<?= gg_e($form) ?>" name="gg_address_action" value="default">Сделать основным</button>
<?php endif; ?>
          </p>
        </article>
<?php
};

/** Подтверждение удаления на месте карточки. Фокус — на «Оставить». */
$confirmCard = static function (array $address): void {
    $form = 'addr-' . (int)$address['id'];
    ?>
        <div class="addr-card addr-card--confirm" role="group" aria-label="Удалить адрес?">
          <h2 class="addr-card__title">Удалить адрес?</h2>
          <p class="addr-card__line addr-card__line--mute"><?= gg_e($address['label'] !== '' ? $address['label'] : $address['street']) ?></p>
          <p class="addr-card__buttons">
            <button type="submit" class="btn btn--solid" form="<?= gg_e($form) ?>" name="gg_address_action" value="delete">Удалить</button>
            <button type="submit" class="btn" form="<?= gg_e($form) ?>" name="gg_address_action" value="cancel" autofocus>Оставить</button>
          </p>
        </div>
<?php
};

/**
 * Форма на месте карточки ($address) или кнопки «Добавить адрес» (null).
 * Фокус — как в прототипе: при правке на улице, при добавлении на названии;
 * после ошибки — на поле с ошибкой, после «лимита» — на «Сохранить».
 */
$addressForm = static function (?array $address, ?array $flash) use ($optional): void {
    $editing = $address !== null;
    $title = $editing ? 'Изменить адрес' : 'Новый адрес';
    $values = $flash['values'] ?? [
        'label' => $address['label'] ?? '',
        'street' => $address['street'] ?? '',
        'apartment' => $address['apartment'] ?? '',
        'intercom' => $address['intercom'] ?? '',
        'isDefault' => !empty($address['isDefault']),
    ];
    $errors = is_array($flash['errors'] ?? null) ? $flash['errors'] : [];
    $streetError = (string)($errors['street'] ?? '');
    $formError = (string)($errors['form'] ?? '');

    /* Основной адрес нельзя «разжаловать» снятием галочки: основной есть всегда. */
    $isDefaultNow = $editing && !empty($address['isDefault']);
    $checked = $isDefaultNow || !empty($values['isDefault']);

    $focus = (string)($flash['focus'] ?? '') ?: ($editing ? 'street' : 'label');
    $autofocus = static fn(string $key): string => $focus === $key ? ' autofocus' : '';
    ?>
        <form class="addr-card addr-card--form" method="post" action="/account/addresses/" novalidate aria-label="<?= gg_e($title) ?>">
          <?= bitrix_sessid_post() ?>
<?php if ($editing): ?>
          <input type="hidden" name="id" value="<?= (int)$address['id'] ?>">
<?php endif; ?>
          <h2 class="addr-card__title"><?= gg_e($title) ?></h2>
          <div class="fields">
            <div class="field field--wide">
              <label class="field__label" for="addr-label">Название<?= $optional ?></label>
              <input class="field__input" id="addr-label" name="label" type="text" autocomplete="off"
                     placeholder="Дом, работа, дача" value="<?= gg_e($values['label'] ?? '') ?>"<?= $autofocus('label') ?>>
            </div>
            <div class="field field--wide">
              <span class="field__label">Город</span>
              <p class="field__static">Москва</p>
              <p class="field__hint">В область и регионы оформляем через менеджера — <a href="/delivery">условия доставки</a></p>
            </div>
            <div class="field field--wide">
              <label class="field__label" for="addr-street">Улица и дом</label>
              <input class="field__input" id="addr-street" name="street" type="text" autocomplete="address-line1"
                     value="<?= gg_e($values['street'] ?? '') ?>" aria-required="true" aria-describedby="addr-street-error"<?= $streetError !== '' ? ' aria-invalid="true"' : '' ?><?= $autofocus('street') ?>>
              <p class="field__error" id="addr-street-error"<?= $streetError !== '' ? '' : ' hidden' ?>><?= gg_e($streetError) ?></p>
            </div>
            <div class="field">
              <label class="field__label" for="addr-apartment">Квартира или офис<?= $optional ?></label>
              <input class="field__input" id="addr-apartment" name="apartment" type="text" autocomplete="address-line2"
                     value="<?= gg_e($values['apartment'] ?? '') ?>">
            </div>
            <div class="field">
              <label class="field__label" for="addr-intercom">Домофон<?= $optional ?></label>
              <input class="field__input" id="addr-intercom" name="intercom" type="text" autocomplete="off"
                     value="<?= gg_e($values['intercom'] ?? '') ?>">
            </div>
            <div class="field field--wide">
              <label class="check" for="addr-default">
                <input type="checkbox" id="addr-default" name="isDefault" value="Y"<?= $checked ? ' checked' : '' ?><?= $isDefaultNow ? ' disabled' : '' ?>>
                <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
                <span>Сделать основным</span>
              </label>
            </div>
          </div>
          <p class="field__error" data-form-error aria-live="assertive"<?= $formError !== '' ? '' : ' hidden' ?>><?= gg_e($formError) ?></p>
          <p class="addr-card__buttons">
            <button type="submit" class="btn btn--solid" name="gg_address_action" value="save"<?= $autofocus('submit') ?>>Сохранить</button>
            <button type="submit" class="btn" name="gg_address_action" value="cancel">Отмена</button>
          </p>
        </form>
<?php
};

gg_account_frame_open('addresses', [['label' => 'Адреса доставки']]);
?>
      <h1 class="acc-title">Адреса доставки</h1>
      <p class="acc-sub">Выбранный адрес подставим при оформлении. Доставляем по Москве.</p>

<?php if (!$list && !$open): ?>
      <div class="addr-grid is-empty">
        <div class="acc-empty">
          <span class="acc-empty__icon" aria-hidden="true"><?= gg_icon('pin') ?></span>
          <h2 class="acc-empty__title">Сохранённых адресов нет</h2>
          <p class="acc-empty__text">Добавьте адрес — при оформлении не придётся вводить его заново.</p>
          <button type="submit" class="btn btn--solid" form="addr-add" name="gg_address_action" value="add">Добавить адрес</button>
        </div>
      </div>
<?php else: ?>
      <div class="addr-grid">
<?php   foreach ($list as $address):
            $here = $open && $open['id'] === $address['id'];
            if ($here && $open['mode'] === 'edit') {
                $addressForm($address, $flash);
            } elseif ($here && $open['mode'] === 'confirm') {
                $confirmCard($address);
            } else {
                $card($address);
            }
        endforeach; ?>
<?php   if ($open && $open['mode'] === 'add'): ?>
<?php     $addressForm(null, $flash); ?>
<?php   elseif (count($list) >= GG_ADDRESS_MAX): ?>
        <p class="addr-limit"><?= gg_e($texts['limit']) ?></p>
<?php   else: ?>
        <button type="submit" class="addr-card addr-card--add" form="addr-add" name="gg_address_action" value="add">
          <span class="addr-card__plus" aria-hidden="true"><?= gg_icon('plus') ?></span><span>Добавить адрес</span>
        </button>
<?php   endif; ?>
      </div>
<?php endif; ?>

<?php /* Скрытые формы кнопок карточек и «Добавить адрес» — см. шапку файла.
         Стоят после сетки: внутри неё пустая форма заняла бы клетку. */ ?>
<?php foreach ($list as $address): ?>
      <form id="addr-<?= (int)$address['id'] ?>" method="post" action="/account/addresses/" hidden>
        <?= bitrix_sessid_post() ?>
        <input type="hidden" name="id" value="<?= (int)$address['id'] ?>">
      </form>
<?php endforeach; ?>
      <form id="addr-add" method="post" action="/account/addresses/" hidden>
        <?= bitrix_sessid_post() ?>
      </form>
<?php
gg_account_frame_close();
echo gg_flash_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
