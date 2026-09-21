<?php
/**
 * Личные данные /account/profile/.
 *
 * Разметка — src/js/account/pages/profile.js: form.acc-form (имя, фамилия,
 * почта, телефон текстом, уведомления, «Сохранить»), под ней .acc-form__foot
 * («Выйти» и «Удалить личный кабинет»).
 *
 * БЕЗ JS. Формы — POST на этот же адрес, действие — в gg_profile_action
 * (save | phone_request | phone_resend | phone_confirm | phone_cancel |
 * delete); «Выйти» — gg_account_action=logout из каркаса
 * (gg_account_handle_post). Ответ всегда редирект (PRG); ошибки и введённое
 * переживают его одной отрисовкой в $_SESSION['GG_PROFILE_FLASH'].
 * «Сохранить» не выключается, пока ничего не изменено: включать её без
 * скрипта было бы нечем.
 *
 * СМЕНА НОМЕРА — панель на месте строки телефона, открывается адресом
 * ?phone=1: «Новый номер» → «Получить код» → код → «Подтвердить». Шаг с
 * кодом устроен как на входе (deploy-src/account/login/index.php): ячейки
 * рисует src/js/account/code-input.js, таймер считается при отрисовке, код
 * на стенде показывается только разблокированному стенду (gg_stand_unlocked).
 * Номер, которому выдан код, и состояние шага лежат в
 * $_SESSION['GG_PHONE_CHANGE']:
 *   phone   десять цифр нового номера;
 *   resend  время, когда можно запросить новый код;
 *   code    код для показа на стенде;
 *   locked  код больше не примут (attempts_exhausted | expired | no_code) —
 *           поле выключено, новый код можно запросить сразу.
 * Страница без ?phone=1 это состояние сбрасывает: «Изменить номер» всегда
 * начинается с чистого поля.
 *
 * ПАНЕЛЬ СТОИТ ВНУТРИ ФОРМЫ ПРОФИЛЯ, а формы не вкладываются. Поля и кнопки
 * панели принадлежат отдельной скрытой форме #pf-phone-form (атрибут form),
 * поэтому Enter в поле нового номера или кода отправляет её, а не профиль, —
 * то же, ради чего прототип перехватывает Enter скриптом.
 *
 * УДАЛЕНИЕ КАБИНЕТА — подтверждение по адресу ?remove=1: <dialog open>
 * прямо на странице, «Удалить кабинет» — POST delete → gg_account_delete()
 * → главная; «Оставить» — ссылка обратно. Без showModal() затемнения
 * под окном нет.
 * ⚠ ПОДТВЕРДИТЬ У ЮРИСТА: порядок удаления и что остаётся у магазина.
 */
define('GG_PAGE_CLASS', 'page-account');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

$self = '/account/profile/';
$phoneUrl = $self . '?phone=1';

/* Гость уходит на вход с возвратом сюда, и только потом разбираются формы. */
$user = gg_require_user();
gg_account_handle_post($self);

/** Код, который можно показать на стенде: СМС не ушли и стенд разблокирован. */
$standCodeOf = static function (array $result): string {
    $channel = (string)($result['channel'] ?? '');
    if (!in_array($channel, ['stand', 'repeat'], true) || !gg_stand_unlocked()) {
        return '';
    }
    return (string)($result['code'] ?? '');
};

/** «Слишком много попыток» — тот же текст, что у rateLimit на входе. */
$rateLimitText = static function (array $result): string {
    $minutes = max(1, (int)ceil((int)($result['retryIn'] ?? 60) / 60));
    return 'Слишком много попыток. Попробуйте через ' . $minutes . ' мин.';
};

/** Ошибка запроса кода на новый номер (requestPhoneChange прототипа). */
$phoneErrorText = static function (array $result) use ($rateLimitText): string {
    return match ((string)($result['error'] ?? '')) {
        'phone_taken' => 'Этот номер уже привязан к другому кабинету',
        'same_phone' => 'Это ваш нынешний номер',
        'invalid_phone' => 'В номере должно быть десять цифр после +7',
        default => $rateLimitText($result),
    };
};

/** Ошибки шага с кодом — login.code.errors из account-copy.js. */
$codeErrorText = static function (string $error, int $attemptsLeft = 0): string {
    return match ($error) {
        'incomplete' => 'Введите все цифры кода',
        'wrong_code' => 'Код не подошёл. Осталось попыток: ' . $attemptsLeft,
        'attempts_exhausted' => 'Попытки закончились — запросите новый код',
        default => 'Код устарел — запросите новый',
    };
};

/* -------------------------------------------------------------------------
   Формы
   ------------------------------------------------------------------------- */

$action = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? (string)($_POST['gg_profile_action'] ?? '') : '';

if ($action !== '') {
    if (!check_bitrix_sessid()) {
        LocalRedirect($self);
    }
    $change = is_array($_SESSION['GG_PHONE_CHANGE'] ?? null) ? $_SESSION['GG_PHONE_CHANGE'] : [];
    $pending = (string)($change['phone'] ?? '');

    /* Имя, фамилия, почта, уведомления. Проверяется только почта. */
    if ($action === 'save') {
        $values = [
            'name' => trim((string)($_POST['name'] ?? '')),
            'lastName' => trim((string)($_POST['lastName'] ?? '')),
            'email' => trim((string)($_POST['email'] ?? '')),
            'marketing' => !empty($_POST['marketing']),
        ];
        $result = gg_account_save_profile($values);
        if (!empty($result['ok'])) {
            gg_account_toast_set('Сохранили');
            LocalRedirect($self);
        }
        $_SESSION['GG_PROFILE_FLASH'] = [
            'values' => $values,
            'errors' => array_filter([
                'name' => (string)($result['errors']['name'] ?? ''),
                'email' => (string)($result['errors']['email'] ?? ''),
            ], static fn(string $text): bool => $text !== ''),
        ];
        LocalRedirect($self);
    }

    /* Смена номера, шаг 1: «Получить код». */
    if ($action === 'phone_request') {
        $raw = trim((string)($_POST['newPhone'] ?? ''));
        $digits = gg_phone_digits($raw);
        $error = $digits === ''
            ? 'Введите номер телефона'
            : (strlen($digits) < 10 ? 'В номере должно быть десять цифр после +7' : '');

        if ($error === '') {
            $result = gg_account_phone_change_request($digits);
            if (!empty($result['ok'])) {
                $_SESSION['GG_PHONE_CHANGE'] = [
                    'phone' => $digits,
                    'resend' => time() + (int)($result['resendIn'] ?? GG_RESEND_SECONDS),
                    'code' => $standCodeOf($result),
                    'locked' => '',
                ];
                LocalRedirect($phoneUrl);
            }
            $error = $phoneErrorText($result);
        }
        unset($_SESSION['GG_PHONE_CHANGE']);
        $_SESSION['GG_PROFILE_FLASH'] = ['newPhone' => $raw, 'errors' => ['newPhone' => $error]];
        LocalRedirect($phoneUrl);
    }

    /* Шаг 2: «Отправить код ещё раз». Код моложе минуты не перевыпускается —
       вернётся прежний и остаток таймера (канал 'repeat'). */
    if ($action === 'phone_resend' && $pending !== '') {
        $result = gg_account_phone_change_request($pending);
        if (!empty($result['ok'])) {
            $_SESSION['GG_PHONE_CHANGE']['resend'] = time() + (int)($result['resendIn'] ?? GG_RESEND_SECONDS);
            $_SESSION['GG_PHONE_CHANGE']['code'] = $standCodeOf($result);
            $_SESSION['GG_PHONE_CHANGE']['locked'] = '';
            LocalRedirect($phoneUrl);
        }
        if ((string)($result['error'] ?? '') === 'rate_limit') {
            $_SESSION['GG_PROFILE_FLASH'] = ['errors' => ['resend' => $rateLimitText($result)]];
        } else {
            /* Номер успели занять, пока шёл код, — назад к полю номера. */
            unset($_SESSION['GG_PHONE_CHANGE']);
            $_SESSION['GG_PROFILE_FLASH'] = [
                'newPhone' => gg_phone_format($pending),
                'errors' => ['newPhone' => $phoneErrorText($result)],
            ];
        }
        LocalRedirect($phoneUrl);
    }

    /* Шаг 2: «Подтвердить». Отвечает редиректом и с ошибкой: обновление
       страницы иначе отправило бы тот же код ещё раз и потратило попытку. */
    if ($action === 'phone_confirm' && $pending !== '') {
        $locked = (string)($change['locked'] ?? '');
        if ($locked !== '') {
            // Поле выключено, код всё равно не примут — повторяем причину.
            $_SESSION['GG_PROFILE_FLASH'] = ['errors' => ['code' => $codeErrorText($locked)]];
            LocalRedirect($phoneUrl);
        }

        /* Неполный код попытку не тратит: gg_account_phone_change_confirm()
           длину не проверяет, поэтому проверяем здесь, как createCodeStep. */
        $code = preg_replace('/\D+/', '', (string)($_POST['code'] ?? ''));
        if (strlen($code) < GG_CODE_LENGTH) {
            $_SESSION['GG_PROFILE_FLASH'] = ['errors' => ['code' => $codeErrorText('incomplete')]];
            LocalRedirect($phoneUrl);
        }

        $result = gg_account_phone_change_confirm($pending, $code);
        if (!empty($result['ok'])) {
            unset($_SESSION['GG_PHONE_CHANGE']);
            gg_account_toast_set('Номер изменён');
            LocalRedirect($self);
        }

        $error = (string)($result['error'] ?? '');
        if ($error === 'phone_taken') {
            unset($_SESSION['GG_PHONE_CHANGE']);
            $_SESSION['GG_PROFILE_FLASH'] = [
                'newPhone' => gg_phone_format($pending),
                'errors' => ['newPhone' => $phoneErrorText($result)],
            ];
            LocalRedirect($phoneUrl);
        }
        if ($error !== 'wrong_code') {
            /* attempts_exhausted, expired, no_code: код больше не примут —
               поле выключено, новый код даём запросить сразу, не дожидаясь
               таймера (так же ведёт себя createCodeStep в прототипе). */
            $_SESSION['GG_PHONE_CHANGE']['locked'] = $error !== '' ? $error : 'expired';
            $_SESSION['GG_PHONE_CHANGE']['resend'] = time();
        }
        $_SESSION['GG_PROFILE_FLASH'] = [
            'errors' => ['code' => $codeErrorText($error, (int)($result['attemptsLeft'] ?? 0))],
        ];
        LocalRedirect($phoneUrl);
    }

    if ($action === 'phone_cancel') {
        unset($_SESSION['GG_PHONE_CHANGE']);
        LocalRedirect($self);
    }

    /* Удаление: профиль, адреса и избранное; заказы и заявки остаются
       у магазина. Выход — внутри gg_account_delete(). */
    if ($action === 'delete') {
        unset($_SESSION['GG_PHONE_CHANGE'], $_SESSION['GG_PROFILE_FLASH']);
        gg_account_delete();
        LocalRedirect('/');
    }

    /* Шаг с кодом без номера в сессии (сессия истекла) и неизвестное действие. */
    LocalRedirect(str_starts_with($action, 'phone_') ? $phoneUrl : $self);
}

/* -------------------------------------------------------------------------
   Что показываем
   ------------------------------------------------------------------------- */

$APPLICATION->SetTitle('Личные данные — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$phoneOpen = !empty($_GET['phone']);
$removeOpen = !empty($_GET['remove']);

if (!$phoneOpen) {
    unset($_SESSION['GG_PHONE_CHANGE']);
}
$change = is_array($_SESSION['GG_PHONE_CHANGE'] ?? null) ? $_SESSION['GG_PHONE_CHANGE'] : [];
$pending = (string)($change['phone'] ?? '');
$phoneStep = !$phoneOpen ? 'static' : ($pending !== '' ? 'code' : 'phone');

/* Ошибки и введённое прошлой отправки живут одну отрисовку. */
$flash = is_array($_SESSION['GG_PROFILE_FLASH'] ?? null) ? $_SESSION['GG_PROFILE_FLASH'] : [];
unset($_SESSION['GG_PROFILE_FLASH']);
$errors = is_array($flash['errors'] ?? null) ? $flash['errors'] : [];
$values = is_array($flash['values'] ?? null) ? $flash['values'] : [
    'name' => (string)$user['name'],
    'lastName' => (string)$user['lastName'],
    'email' => (string)$user['email'],
    'marketing' => (bool)$user['marketing'],
];
$nameError = (string)($errors['name'] ?? '');
$emailError = (string)($errors['email'] ?? '');
$newPhoneError = (string)($errors['newPhone'] ?? '');

/* Шаг с кодом. */
$locked = (string)($change['locked'] ?? '');
$codeError = (string)($errors['code'] ?? '');
if ($codeError === '' && $locked !== '') {
    // Поле выключено — причина видна и после перезагрузки.
    $codeError = $codeErrorText($locked);
}
$resendError = (string)($errors['resend'] ?? '');
$resendIn = max(0, (int)($change['resend'] ?? 0) - time());
$standCode = gg_stand_unlocked() ? (string)($change['code'] ?? '') : '';

/** 59 → «0:59». */
$clock = static fn(int $seconds): string => intdiv($seconds, 60) . ':' . str_pad((string)($seconds % 60), 2, '0', STR_PAD_LEFT);

$optional = '<span class="field__optional"> · необязательно</span>';

gg_account_frame_open('profile', [['label' => 'Личные данные']]);
?>
      <h1 class="acc-title">Личные данные</h1>

      <form class="acc-form" method="post" action="<?= gg_e($self) ?>" novalidate>
        <?= bitrix_sessid_post() ?>
        <div class="fields">
          <div class="field">
            <label class="field__label" for="pf-name">Имя</label>
            <input class="field__input" id="pf-name" name="name" type="text" autocomplete="given-name"
                   value="<?= gg_e($values['name'] ?? '') ?>"<?= $nameError !== '' ? ' aria-describedby="pf-name-error" aria-invalid="true"' : '' ?>>
<?php if ($nameError !== ''): ?>
            <?php /* Ответа ядра (CUser::Update) в прототипе нет — строка только на случай отказа. */ ?>
            <p class="field__error" id="pf-name-error"><?= gg_e($nameError) ?></p>
<?php endif; ?>
          </div>
          <div class="field">
            <label class="field__label" for="pf-last">Фамилия<?= $optional ?></label>
            <input class="field__input" id="pf-last" name="lastName" type="text" autocomplete="family-name"
                   value="<?= gg_e($values['lastName'] ?? '') ?>">
          </div>
          <div class="field field--wide">
            <label class="field__label" for="pf-email">Email<?= $optional ?></label>
            <input class="field__input" id="pf-email" name="email" type="email" autocomplete="email" inputmode="email"
                   value="<?= gg_e($values['email'] ?? '') ?>" aria-describedby="pf-email-error pf-email-hint"<?= $emailError !== '' ? ' aria-invalid="true" autofocus' : '' ?>>
            <p class="field__error" id="pf-email-error"<?= $emailError !== '' ? '' : ' hidden' ?>><?= gg_e($emailError) ?></p>
            <p class="field__hint" id="pf-email-hint">Для подтверждений заказов и чеков</p>
          </div>
        </div>

        <div class="acc-form__phone">
<?php if ($phoneStep === 'static'): ?>
          <span class="field__label">Телефон</span>
          <p class="field__static acc-form__phone-line">
            <span><?= gg_e(gg_phone_format((string)$user['phone'])) ?></span>
            <a class="link-btn" href="<?= gg_e($phoneUrl) ?>">Изменить номер</a>
          </p>
<?php elseif ($phoneStep === 'phone'): ?>
          <div class="acc-panel" role="group" aria-label="Смена номера">
            <div class="field">
              <label class="field__label" for="pf-new-phone">Новый номер</label>
              <?php /* Маску оживляет общий скрипт по data-phone-mask (src/bitrix/main.js). */ ?>
              <input class="field__input" id="pf-new-phone" name="newPhone" form="pf-phone-form" type="tel"
                     autocomplete="tel" inputmode="tel" placeholder="+7 ___ ___-__-__"
                     value="<?= gg_e($flash['newPhone'] ?? '') ?>" data-phone-mask
                     aria-required="true" aria-describedby="pf-new-phone-error"<?= $newPhoneError !== '' ? ' aria-invalid="true"' : '' ?> autofocus>
              <p class="field__error" id="pf-new-phone-error" aria-live="assertive"<?= $newPhoneError !== '' ? '' : ' hidden' ?>><?= gg_e($newPhoneError) ?></p>
            </div>
            <p class="acc-panel__buttons">
              <button type="submit" class="btn btn--solid" form="pf-phone-form" name="gg_profile_action" value="phone_request">Получить код</button>
              <button type="submit" class="btn" form="pf-phone-form" name="gg_profile_action" value="phone_cancel">Отмена</button>
            </p>
          </div>
<?php else: ?>
          <div class="acc-panel" role="group" aria-label="Смена номера">
            <p class="field__hint">Отправили СМС на <?= gg_e(gg_phone_format($pending)) ?></p>
            <div class="code-step">
              <?php /* Настоящее поле одно; ячейки под ним — только вид
                       (aria-hidden), цифры в них рисует src/js/account/code-input.js. */ ?>
              <div class="code-input<?= $codeError !== '' ? ' is-invalid' : '' ?><?= $locked !== '' ? ' is-disabled' : '' ?>"
                   style="--code-length: <?= GG_CODE_LENGTH ?>">
                <input class="code-input__field" id="pf-code" name="code" form="pf-phone-form" type="text" inputmode="numeric"
                       autocomplete="one-time-code" maxlength="<?= GG_CODE_LENGTH ?>" pattern="[0-9]*"
                       aria-label="Код из СМС" aria-describedby="pf-code-error"<?= $codeError !== '' ? ' aria-invalid="true"' : '' ?><?= $locked !== '' ? ' disabled' : ' autofocus' ?>>
                <div class="code-input__cells" aria-hidden="true"><?php for ($i = 0; $i < GG_CODE_LENGTH; $i++): ?><span class="code-input__cell"></span><?php endfor; ?></div>
              </div>

              <p class="field__error" id="pf-code-error" aria-live="assertive"<?= $codeError !== '' ? '' : ' hidden' ?>><?= gg_e($codeError) ?></p>
              <button type="submit" class="btn btn--solid code-step__submit" form="pf-phone-form" name="gg_profile_action" value="phone_confirm">Подтвердить</button>

              <p class="code-step__resend">
<?php   if ($resendError !== ''): ?>
                <?= gg_e($resendError) ?>
<?php   else: ?>
<?php     if ($resendIn > 0): ?>
                <span data-resend-timer data-resend-in="<?= (int)$resendIn ?>"><?= gg_e('Новый код можно запросить через ' . $clock($resendIn)) ?></span>
<?php     endif; ?>
                <button type="submit" class="link-btn" form="pf-phone-form" name="gg_profile_action" value="phone_resend" data-resend-button<?= $resendIn > 0 ? ' hidden' : '' ?>>Отправить код ещё раз</button>
<?php   endif; ?>
              </p>
              <p class="visually-hidden" aria-live="polite" data-resend-live></p>
<?php   if ($standCode !== ''): ?>
              <p class="code-step__prototype"><?= gg_e('Стенд: СМС не подключены, код ' . $standCode) ?></p>
<?php   endif; ?>
            </div>
            <p class="acc-panel__buttons">
              <button type="submit" class="link-btn" form="pf-phone-form" name="gg_profile_action" value="phone_cancel">Отмена</button>
            </p>
          </div>
<?php endif; ?>
        </div>

        <fieldset class="group">
          <legend class="co-label">Уведомления</legend>
          <?php /* ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: каналы рассылки и текст согласия на рекламу. */ ?>
          <label class="check" for="pf-marketing">
            <input type="checkbox" id="pf-marketing" name="marketing" value="Y"<?= !empty($values['marketing']) ? ' checked' : '' ?>>
            <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
            <span>Присылать новости и предложения</span>
          </label>
        </fieldset>

        <p><button type="submit" class="btn btn--solid" name="gg_profile_action" value="save">Сохранить</button></p>
      </form>

<?php if ($phoneOpen): ?>
      <?php /* Форма панели смены номера — см. шапку файла. Пустая и скрытая:
               её поля и кнопки стоят в панели и ссылаются сюда атрибутом form. */ ?>
      <form id="pf-phone-form" method="post" action="<?= gg_e($self) ?>" novalidate hidden>
        <?= bitrix_sessid_post() ?>
      </form>
<?php endif; ?>

      <div class="acc-form__foot">
        <form method="post" action="<?= gg_e($self) ?>">
          <?= bitrix_sessid_post() ?>
          <button type="submit" class="btn" name="gg_account_action" value="logout">Выйти</button>
        </form>
        <a class="link-btn acc-form__remove" href="<?= gg_e($self . '?remove=1') ?>">Удалить личный кабинет</a>
      </div>

<?php if ($removeOpen): ?>
      <?php /* Безопасная кнопка первой в фокусе: Enter по привычке не удаляет кабинет. */ ?>
      <dialog class="dialog" open aria-labelledby="pf-remove-title">
        <h2 class="dialog__title" id="pf-remove-title">Удалить личный кабинет?</h2>
        <p class="dialog__text">Удалим имя, почту, адреса и избранное. Заказы и заявки останутся у магазина — они нужны для учёта и гарантий. Войти по этому номеру потом можно будет только как новый покупатель.</p>
        <p class="dialog__actions">
          <button type="submit" class="btn btn--solid" form="pf-remove-form" name="gg_profile_action" value="delete">Удалить кабинет</button>
          <a class="btn" href="<?= gg_e($self) ?>" autofocus>Оставить</a>
        </p>
        <form id="pf-remove-form" method="post" action="<?= gg_e($self) ?>" hidden>
          <?= bitrix_sessid_post() ?>
        </form>
      </dialog>
<?php endif; ?>
<?php
gg_account_frame_close();
echo gg_account_toast();
require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php');
