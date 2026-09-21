<?php
/**
 * Вход /account/login/.
 *
 * ТРИ ШАГА НА ОДНОМ АДРЕСЕ, как в прототипе (src/js/account/pages/login.js):
 *   1. телефон и согласие  → gg_auth_request_code();
 *   2. код из СМС          → gg_auth_verify_code();
 *   3. «Как к вам обращаться» — только для номера, которого у нас ещё не было,
 *      → gg_account_save_profile().
 * Номер уже знаком — после шага 2 сразу переход на back.
 *
 * ВХОД И РЕГИСТРАЦИЯ — ОДИН СЦЕНАРИЙ. Паролей, входа по почте и кнопок
 * зарубежных сервисов нет (решение 17.09.2026, см. src/data/account-copy.js).
 *
 * БЕЗ JS СТРАНИЦА РАБОТАЕТ. Каждый шаг — обычная форма POST на этот же адрес.
 * Какую форму прислали, говорит имя и значение нажатой кнопки
 * (gg_login_action), а какой шаг показывать — сессия Битрикса:
 *   GG_LOGIN_PHONE   десять цифр номера, которому выдан код;
 *   GG_LOGIN_STEP    'phone' | 'code' | 'profile';
 *   GG_LOGIN_RESEND  время, когда можно запросить новый код;
 *   GG_LOGIN_CODE    код для показа на стенде (см. ниже);
 *   GG_LOGIN_ERROR   ошибка шага с кодом, живёт до первой отрисовки.
 *
 * ШАГ С КОДОМ ОТВЕЧАЕТ РЕДИРЕКТОМ (PRG) и удачно, и с ошибкой: обновление
 * страницы иначе отправляло бы тот же код второй раз и тратило попытку
 * (их всего GG_MAX_ATTEMPTS). Шаги 1 и 3 при ошибке рисуются сразу — они
 * ничего не меняют на сервере, зато возвращают человеку введённое.
 *
 * ЧЕГО СЕРВЕР БЕЗ СКРИПТА НЕ УМЕЕТ:
 *   — цифры в ячейках кода рисует src/js/account/code-input.js: настоящее
 *     поле одно и лежит поверх ячеек, ячейки — только вид (aria-hidden);
 *   — таймер «через 0:59» считается один раз, при отрисовке; дотикивает его
 *     тот же скрипт, без него строку обновляет перезагрузка.
 *
 * КОД НА СТЕНДЕ. СМС-провайдера нет (include/account.php → gg_auth_send_code),
 * поэтому код показывается прямо на странице — но только тому, кто открыл
 * стенд ссылкой `?stand=<ключ>` (gg_stand_unlocked): по чужому номеру иначе
 * можно было бы войти в чужой кабинет. Появится провайдер — канал станет
 * 'sms', и показывать станет нечего.
 */
define('GG_PAGE_CLASS', 'page-account page-login');

require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/header.php');
require_once $_SERVER['DOCUMENT_ROOT'] . SITE_TEMPLATE_PATH . '/include/account.php';

$APPLICATION->SetTitle('Вход — №1 Гранд Гурмэ');
$APPLICATION->SetPageProperty('robots', 'noindex, nofollow');

$post = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? $_POST : [];

/* Куда вернуть после входа. Проверка дословно та же, что у safeBack
   в прототипе: только путь этого же сайта и не обратно на вход. */
$back = gg_safe_back((string)($_REQUEST['back'] ?? ''));

/* Пришли со страницы «Заказ принят» — номер подставим из этого заказа
   или заявки (getRecordPhone прототипа). */
$from = (string)($_REQUEST['from'] ?? '');
$orderNumber = trim((string)($_REQUEST['n'] ?? ''));
$requestNumber = trim((string)($_REQUEST['r'] ?? ''));

/** Адрес самой страницы: action всех форм и цель редиректов. */
$params = ['back' => $back];
if ($from === 'order' || $from === 'request') {
    $params['from'] = $from;
    if ($orderNumber !== '') {
        $params['n'] = $orderNumber;
    }
    if ($requestNumber !== '') {
        $params['r'] = $requestNumber;
    }
}
$self = '/account/login/?' . http_build_query($params);

/* Вошедший на странице входа сразу уходит на back. Исключение — шаг 3:
   кабинет на нём уже создан, а имя ещё не спрашивали. */
$pendingProfile = (string)($_SESSION['GG_LOGIN_STEP'] ?? '') === 'profile';
if (gg_account_user() && !$pendingProfile) {
    unset($_SESSION['GG_LOGIN_PHONE'], $_SESSION['GG_LOGIN_STEP'], $_SESSION['GG_LOGIN_RESEND'], $_SESSION['GG_LOGIN_CODE']);
    LocalRedirect($back);
}

/** Код, который можно показать на стенде: СМС не ушли и стенд разблокирован. */
$standCodeOf = static function (array $result): string {
    $channel = (string)($result['channel'] ?? '');
    if (!in_array($channel, ['stand', 'repeat'], true) || !gg_stand_unlocked()) {
        return '';
    }
    return (string)($result['code'] ?? '');
};

/** «Слишком много попыток» — тот же текст, что у rateLimit в прототипе. */
$rateLimitText = static function (array $result): string {
    $minutes = max(1, (int)ceil((int)($result['retryIn'] ?? 60) / 60));
    return 'Слишком много попыток. Попробуйте через ' . $minutes . ' мин.';
};

/* -------------------------------------------------------------------------
   Формы
   ------------------------------------------------------------------------- */

$errors = [];
$action = (string)($post['gg_login_action'] ?? '');

if ($action !== '') {
    if (!check_bitrix_sessid()) {
        LocalRedirect($self);
    }
    $phone = (string)($_SESSION['GG_LOGIN_PHONE'] ?? '');

    /* Шаг 1: номер и согласие. */
    if ($action === 'request') {
        $digits = gg_phone_digits((string)($post['phone'] ?? ''));
        if ($digits === '') {
            $errors['phone'] = 'Введите номер телефона';
        } elseif (strlen($digits) < 10) {
            $errors['phone'] = 'В номере должно быть десять цифр после +7';
        }
        if (empty($post['consent'])) {
            $errors['consent'] = 'Без согласия мы не можем отправить код';
        }

        if (!$errors) {
            $result = gg_auth_request_code($digits);
            if (!empty($result['ok'])) {
                $_SESSION['GG_LOGIN_PHONE'] = $digits;
                $_SESSION['GG_LOGIN_STEP'] = 'code';
                $_SESSION['GG_LOGIN_RESEND'] = time() + (int)($result['resendIn'] ?? GG_RESEND_SECONDS);
                $_SESSION['GG_LOGIN_CODE'] = $standCodeOf($result);
                LocalRedirect($self);
            }
            $errors['form'] = (string)($result['error'] ?? '') === 'rate_limit'
                ? $rateLimitText($result)
                : 'В номере должно быть десять цифр после +7';
        }
    }

    /* Шаг 2: «Изменить номер» — назад на шаг 1 с сохранённым номером. */
    if ($action === 'change') {
        $_SESSION['GG_LOGIN_STEP'] = 'phone';
        LocalRedirect($self);
    }

    /* Шаг 2: «Отправить код ещё раз». Код моложе минуты Битрикс не
       перевыпускает — вернётся прежний и остаток таймера (канал 'repeat'). */
    if ($action === 'resend' && $phone !== '') {
        $result = gg_auth_request_code($phone);
        if (!empty($result['ok'])) {
            $_SESSION['GG_LOGIN_RESEND'] = time() + (int)($result['resendIn'] ?? GG_RESEND_SECONDS);
            $_SESSION['GG_LOGIN_CODE'] = $standCodeOf($result);
            LocalRedirect($self);
        }
        $_SESSION['GG_LOGIN_ERROR'] = [
            'resend' => (string)($result['error'] ?? '') === 'rate_limit' ? $rateLimitText($result) : '',
        ];
        LocalRedirect($self);
    }

    /* Шаг 2: «Войти». */
    if ($action === 'verify' && $phone !== '') {
        $result = gg_auth_verify_code($phone, (string)($post['code'] ?? ''));

        if (!empty($result['ok'])) {
            unset($_SESSION['GG_LOGIN_PHONE'], $_SESSION['GG_LOGIN_RESEND'], $_SESSION['GG_LOGIN_CODE']);
            if (!empty($result['isNew'])) {
                $_SESSION['GG_LOGIN_STEP'] = 'profile';
                LocalRedirect($self);
            }
            unset($_SESSION['GG_LOGIN_STEP']);
            LocalRedirect($back);
        }

        $error = (string)($result['error'] ?? '');
        $texts = [
            'incomplete' => 'Введите все цифры кода',
            'wrong_code' => 'Код не подошёл. Осталось попыток: ' . (int)($result['attemptsLeft'] ?? 0),
            'attempts_exhausted' => 'Попытки закончились — запросите новый код',
            'expired' => 'Код устарел — запросите новый',
            /* Ответ, которого в прототипе нет: кабинет не завёлся. */
            'user_failed' => 'Не получилось завести кабинет. Попробуйте ещё раз или позвоните нам',
        ];
        /* attempts_exhausted, expired и no_code: код больше не примут —
           поле выключено, а новый код даём запросить сразу, не дожидаясь
           таймера (так же ведёт себя createCodeStep в прототипе). */
        $locked = in_array($error, ['attempts_exhausted', 'expired', 'no_code'], true);
        if ($locked) {
            $_SESSION['GG_LOGIN_RESEND'] = time();
        }
        $_SESSION['GG_LOGIN_ERROR'] = [
            'code' => $texts[$error] ?? $texts['expired'],
            'locked' => $locked,
        ];
        LocalRedirect($self);
    }

    /* Шаг 3: «Заполнить позже» — кабинет создан, имя останется пустым. */
    if ($action === 'later') {
        unset($_SESSION['GG_LOGIN_STEP']);
        LocalRedirect($back);
    }

    /* Шаг 3: «Готово». */
    if ($action === 'profile') {
        if (trim((string)($post['name'] ?? '')) === '') {
            $errors['name'] = 'Как к вам обращаться?';
        }
        /* Почта необязательна, но введённая проверяется вместе с именем —
           обе ошибки сразу, как completeProfile в прототипе. */
        $email = trim((string)($post['email'] ?? ''));
        if ($email !== '' && !check_email($email)) {
            $errors['email'] = 'Проверьте адрес: в нём должны быть @ и домен';
        }
        if (!$errors) {
            $result = gg_account_save_profile([
                'name' => (string)($post['name'] ?? ''),
                'email' => (string)($post['email'] ?? ''),
                'marketing' => !empty($post['marketing']),
            ]);
            if (!empty($result['ok'])) {
                unset($_SESSION['GG_LOGIN_STEP']);
                LocalRedirect($back);
            }
            $errors = array_filter([
                'name' => (string)($result['errors']['name'] ?? ''),
                'email' => (string)($result['errors']['email'] ?? ''),
            ], static fn($text) => $text !== '');
        }
    }
}

/* -------------------------------------------------------------------------
   Что показываем
   ------------------------------------------------------------------------- */

$phone = (string)($_SESSION['GG_LOGIN_PHONE'] ?? '');
$user = gg_account_user();

$step = (string)($_SESSION['GG_LOGIN_STEP'] ?? 'phone');
if (!in_array($step, ['phone', 'code', 'profile'], true) || ($action === 'request' && $errors)) {
    $step = 'phone';
}
if ($step === 'code' && $phone === '') {
    $step = 'phone';
}
if ($step === 'profile' && !$user) {
    // Кабинета уже нет (вышли в другой вкладке) — начинаем сначала.
    $step = 'phone';
}

/* Ошибка шага с кодом приехала редиректом и живёт одну отрисовку. */
$flash = (array)($_SESSION['GG_LOGIN_ERROR'] ?? []);
unset($_SESSION['GG_LOGIN_ERROR']);
$codeError = (string)($flash['code'] ?? '');
$codeLocked = !empty($flash['locked']);
$resendError = (string)($flash['resend'] ?? '');

$resendIn = max(0, (int)($_SESSION['GG_LOGIN_RESEND'] ?? 0) - time());
$standCode = gg_stand_unlocked() ? (string)($_SESSION['GG_LOGIN_CODE'] ?? '') : '';

/** 59 → «0:59». */
$clock = static fn(int $seconds): string => intdiv($seconds, 60) . ':' . str_pad((string)($seconds % 60), 2, '0', STR_PAD_LEFT);

/* Что стоит в поле телефона на шаге 1. */
$phoneValue = '';
$consentOn = false;
if ($action === 'request') {
    $phoneValue = trim((string)($post['phone'] ?? ''));
    $consentOn = !empty($post['consent']);
} elseif ($phone !== '') {
    /* Вернулись с «Изменить номер»: согласие человек уже давал. */
    $phoneValue = gg_phone_format($phone);
    $consentOn = true;
} elseif ($from === 'order' || $from === 'request') {
    $phoneValue = gg_phone_format(gg_login_record_phone($from, $orderNumber, $requestNumber));
}
?>
<div class="container">
  <div class="login">
    <div class="login__col">
      <div class="login__form">

<?php if ($step === 'phone'): ?>
        <form class="login__step" method="post" action="<?= gg_e($self) ?>" novalidate>
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="back" value="<?= gg_e($back) ?>">

          <p class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
          <h1 class="login__title">Вход или регистрация</h1>
          <p class="login__lead">Войдите по номеру телефона — пришлём код в СМС. Если вы у нас впервые, кабинет появится сам.</p>

          <div class="field">
            <label class="field__label" for="login-phone">Телефон</label>
            <?php /* Маску оживляет общий скрипт по атрибуту data-phone-mask
                     (src/bitrix/main.js); без него остаётся обычное поле. */ ?>
            <input class="field__input" id="login-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"
                   placeholder="+7 ___ ___-__-__" value="<?= gg_e($phoneValue) ?>" data-phone-mask
                   aria-required="true" aria-describedby="login-phone-error"<?= isset($errors['phone']) ? ' aria-invalid="true"' : '' ?>>
            <p class="field__error" id="login-phone-error"<?= isset($errors['phone']) ? '' : ' hidden' ?>><?= gg_e($errors['phone'] ?? '') ?></p>
          </div>

          <div class="field">
            <label class="check" for="login-consent">
              <input type="checkbox" id="login-consent" name="consent" value="Y"<?= $consentOn ? ' checked' : '' ?>
                     aria-required="true" aria-describedby="login-consent-error"<?= isset($errors['consent']) ? ' aria-invalid="true"' : '' ?>>
              <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
              <span>Даю <a href="/consent/">согласие на обработку персональных данных</a> и принимаю <a href="/privacy/">политику конфиденциальности</a></span>
            </label>
            <p class="field__error" id="login-consent-error"<?= isset($errors['consent']) ? '' : ' hidden' ?>><?= gg_e($errors['consent'] ?? '') ?></p>
          </div>

          <button type="submit" class="btn btn--solid login__submit" name="gg_login_action" value="request">Получить код</button>
          <p class="field__error" data-form-error aria-live="assertive"<?= isset($errors['form']) ? '' : ' hidden' ?>><?= gg_e($errors['form'] ?? '') ?></p>
          <p class="login__note">Покупали без регистрации? Войдите по тому же номеру — заказы появятся в кабинете.</p>
        </form>

<?php elseif ($step === 'code'): ?>
        <form class="login__step" method="post" action="<?= gg_e($self) ?>" novalidate>
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="back" value="<?= gg_e($back) ?>">

          <h1 class="login__title">Введите код</h1>
          <p class="login__lead">Отправили СМС на <?= gg_e(gg_phone_format($phone)) ?>
            <?php /* Кнопка принадлежит форме ниже (атрибут form). Внутри этой
                     формы она стояла бы первой кнопкой, и Enter в поле кода
                     уводил бы на шаг 1 вместо входа. */ ?>
            <button type="submit" class="link-btn login__change" form="login-change">Изменить номер</button>
          </p>

          <div class="code-step">
            <?php /* Настоящее поле одно: autocomplete="one-time-code",
                     inputmode="numeric" и подпись для скринридера. Ячейки под
                     ним — только вид (aria-hidden), цифры в них рисует
                     src/js/account/code-input.js. */ ?>
            <div class="code-input<?= $codeError !== '' ? ' is-invalid' : '' ?><?= $codeLocked ? ' is-disabled' : '' ?>"
                 style="--code-length: <?= GG_CODE_LENGTH ?>">
              <input class="code-input__field" id="login-code" name="code" type="text" inputmode="numeric"
                     autocomplete="one-time-code" maxlength="<?= GG_CODE_LENGTH ?>" pattern="[0-9]*"
                     aria-label="Код из СМС" aria-describedby="login-code-error"<?= $codeError !== '' ? ' aria-invalid="true"' : '' ?><?= $codeLocked ? ' disabled' : '' ?>>
              <div class="code-input__cells" aria-hidden="true"><?php for ($i = 0; $i < GG_CODE_LENGTH; $i++): ?><span class="code-input__cell"></span><?php endfor; ?></div>
            </div>

            <p class="field__error" id="login-code-error" aria-live="assertive"<?= $codeError !== '' ? '' : ' hidden' ?>><?= gg_e($codeError) ?></p>
            <button type="submit" class="btn btn--solid code-step__submit" name="gg_login_action" value="verify">Войти</button>

            <p class="code-step__resend">
<?php   if ($resendError !== ''): ?>
              <?= gg_e($resendError) ?>
<?php   else: ?>
              <?php /* Без скрипта строка не тикает: её обновляет перезагрузка.
                       Со скриптом (src/bitrix/account-hydrate.js) таймер идёт,
                       а по нулю вместо строки появляется кнопка. */ ?>
<?php     if ($resendIn > 0): ?>
              <span data-resend-timer data-resend-in="<?= (int)$resendIn ?>">Новый код можно запросить через <?= gg_e($clock($resendIn)) ?></span>
<?php     endif; ?>
              <button type="submit" class="link-btn" name="gg_login_action" value="resend" data-resend-button<?= $resendIn > 0 ? ' hidden' : '' ?>>Отправить код ещё раз</button>
<?php   endif; ?>
            </p>
            <?php /* Место объявления «Новый код можно запросить» — его
                     заполняет скрипт, секунды скринридеру не читаются. */ ?>
            <p class="visually-hidden" aria-live="polite" data-resend-live></p>

<?php   if ($standCode !== ''): ?>
            <p class="code-step__prototype">Стенд: СМС не подключены, код <?= gg_e($standCode) ?></p>
<?php   endif; ?>
          </div>
        </form>

        <?php /* Пустая форма «Изменить номер» — см. кнопку в строке выше. */ ?>
        <form id="login-change" method="post" action="<?= gg_e($self) ?>">
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="back" value="<?= gg_e($back) ?>">
          <input type="hidden" name="gg_login_action" value="change">
        </form>

<?php else: ?>
        <form class="login__step" method="post" action="<?= gg_e($self) ?>" novalidate>
          <?= bitrix_sessid_post() ?>
          <input type="hidden" name="back" value="<?= gg_e($back) ?>">

          <h1 class="login__title">Как к вам обращаться</h1>
          <p class="login__lead">Номер <?= gg_e(gg_phone_format((string)($user['phone'] ?? ''))) ?> подтверждён. Осталось имя, остальное можно заполнить позже в кабинете.</p>

          <div class="field">
            <label class="field__label" for="login-name">Имя</label>
            <input class="field__input" id="login-name" name="name" type="text" autocomplete="given-name"
                   value="<?= gg_e($post['name'] ?? '') ?>" aria-required="true" aria-describedby="login-name-error"<?= isset($errors['name']) ? ' aria-invalid="true"' : '' ?>>
            <p class="field__error" id="login-name-error"<?= isset($errors['name']) ? '' : ' hidden' ?>><?= gg_e($errors['name'] ?? '') ?></p>
          </div>

          <div class="field">
            <label class="field__label" for="login-email">Email<span class="field__optional"> · необязательно</span></label>
            <input class="field__input" id="login-email" name="email" type="email" autocomplete="email" inputmode="email"
                   value="<?= gg_e($post['email'] ?? '') ?>" aria-describedby="login-email-error login-email-hint"<?= isset($errors['email']) ? ' aria-invalid="true"' : '' ?>>
            <p class="field__error" id="login-email-error"<?= isset($errors['email']) ? '' : ' hidden' ?>><?= gg_e($errors['email'] ?? '') ?></p>
            <p class="field__hint" id="login-email-hint">Для подтверждений заказов и чеков</p>
          </div>

          <div class="field">
            <label class="check" for="login-marketing">
              <input type="checkbox" id="login-marketing" name="marketing" value="Y"<?= !empty($post['marketing']) ? ' checked' : '' ?>>
              <span class="check__box" aria-hidden="true"><?= gg_icon('check') ?></span>
              <span>Присылать новости и предложения</span>
            </label>
          </div>

          <button type="submit" class="btn btn--solid login__submit" name="gg_login_action" value="profile">Готово</button>
          <button type="submit" class="link-btn login__later" name="gg_login_action" value="later">Заполнить позже</button>
        </form>
<?php endif; ?>

      </div>
    </div>

    <?php /* Кадр виден только от 1024px (.login__media ниже скрыт). Слот
             поднимает media.js; картинка у него ленивая, поэтому на телефоне,
             где блок скрыт, файл не грузится вовсе. media--fill растягивает
             кадр на высоту колонки формы, как fill: true в прототипе. */ ?>
    <div class="login__media">
      <?= gg_media_slot('', '/media/brand/boutique-detail-01.jpg', '3:4', 'media--fill', 'Торговый зал бутика') ?>
    </div>
  </div>
</div>
<?php require($_SERVER['DOCUMENT_ROOT'] . '/bitrix/footer.php'); ?>
