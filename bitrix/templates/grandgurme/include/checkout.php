<?php
/**
 * Оформление заказа: проверка полей, телефон, создание заказа.
 *
 * ПРОВЕРКА ЖИВЁТ НА СЕРВЕРЕ. В прототипе она была на клиенте
 * (src/js/checkout/validate.js) — правила перенесены слово в слово, вместе
 * с текстами ошибок. Ошибка показывается под полем, поле помечается
 * aria-invalid, введённое возвращается в форму: заставлять человека
 * набирать адрес заново из-за забытой галочки нельзя.
 *
 * РЕГИСТРАЦИИ НЕТ НИ В КАКОМ ВИДЕ. Заказ пишется на анонимного покупателя
 * магазина: заводить учётную запись за человека, который её не просил, —
 * это регистрация, только молча. Если заказы должны попадать в кабинет,
 * нужно включать создание покупателя по телефону — это отдельное решение
 * со своей ценой (пароль, вход, персональные данные).
 *
 * ОПЛАТА В ЗАКАЗ НЕ ПИШЕТСЯ. На стенде стоят демонстрационные платёжные
 * системы «1С-Битрикс» (ЮMoney, Терминалы, Наложенный платёж) — ни одна
 * из них не та, что подключена у компании. Выбранный способ уезжает
 * в комментарий к заказу, документ оплаты создаёт менеджер.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие платёжные системы заводить.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/cart.php';

/** Лента дней на оформлении: две недели вперёд, включая сегодня. */
const GG_DAYS_AHEAD = 14;

/**
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: интервалы доставки и самовывоза.
 * Четыре значения поставлены по общей практике курьерских служб Москвы —
 * настоящих интервалов у нас нет, как нет и часа отсечки на «сегодня».
 */
function gg_intervals(): array
{
    return ['10:00–14:00', '14:00–18:00', '18:00–22:00', 'В течение дня'];
}

/**
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: подключён ли эквайринг и оплата курьеру
 * картой или только наличными. В подвале сейчас значатся Sber Pay и СБП.
 */
function gg_payment_options(): array
{
    return [
        ['value' => 'card', 'label' => 'Картой онлайн'],
        ['value' => 'sbp', 'label' => 'СБП'],
        ['value' => 'on-receipt', 'label' => 'При получении'],
    ];
}

/**
 * Пункты самовывоза.
 *
 * Пункт ОДИН — флагманский бутик в Москве: оформление на сайте доставляет
 * по Москве, и забрать московский заказ в Дубае нельзя. С одним пунктом
 * блок показывается без радиокнопки: переключатель из одного значения —
 * это брак, а не выбор.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: номер дома и часы работы. Известно только
 * «ЖК „Золотой“ на Софийской набережной».
 */
function gg_pickup_points(): array
{
    return [
        [
            'id' => 'moscow-flagship',
            'city' => 'Москва',
            'name' => 'Флагманский бутик',
            'address' => 'ЖК «Золотой», Софийская набережная',
            'hours' => 'Ежедневно, 10:00–22:00', // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА
        ],
    ];
}

/* -------------------------------------------------------------------------
   Телефон
   ------------------------------------------------------------------------- */

/**
 * Десять цифр номера без кода страны. Понимает «+7 925…», «8 925…»,
 * «7925…» и вставку из буфера со скобками и дефисами.
 */
function gg_phone_digits(string $value): string
{
    $raw = trim($value);
    $digits = preg_replace('/\D+/', '', $raw);
    if (strncmp($raw, '+7', 2) === 0) {
        $digits = substr($digits, 1);
    } elseif (strlen($digits) === 11 && ($digits[0] === '7' || $digits[0] === '8')) {
        $digits = substr($digits, 1);
    }
    return substr((string)$digits, 0, 10);
}

/** «+7 925 466-66-46». */
function gg_phone_format(string $digits): string
{
    if ($digits === '') {
        return '';
    }
    $out = '+7 ' . substr($digits, 0, 3);
    if (strlen($digits) > 3) {
        $out .= ' ' . substr($digits, 3, 3);
    }
    if (strlen($digits) > 6) {
        $out .= '-' . substr($digits, 6, 2);
    }
    if (strlen($digits) > 8) {
        $out .= '-' . substr($digits, 8, 2);
    }
    return $out;
}

/* -------------------------------------------------------------------------
   Проверка полей. Тексты ошибок — из src/data/checkout-copy.js.
   ------------------------------------------------------------------------- */

function gg_checkout_validate(array $post, int $readyAt): array
{
    $errors = [];
    $method = ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery';

    if (trim((string)($post['name'] ?? '')) === '') {
        $errors['name'] = 'Как к вам обращаться?';
    }

    $digits = gg_phone_digits((string)($post['phone'] ?? ''));
    if ($digits === '') {
        $errors['phone'] = 'Укажите телефон — по нему менеджер подтвердит заказ';
    } elseif (strlen($digits) < 10) {
        $errors['phone'] = 'В номере должно быть десять цифр после +7';
    }

    $email = trim((string)($post['email'] ?? ''));
    if ($email === '') {
        $errors['email'] = 'Укажите почту — туда придёт подтверждение';
    } elseif (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $email)) {
        $errors['email'] = 'Проверьте адрес: в нём должны быть @ и домен';
    }

    /* Улица нужна только доставке: при самовывозе поле не проверяется. */
    if ($method === 'delivery' && trim((string)($post['street'] ?? '')) === '') {
        $errors['street'] = 'Укажите улицу и номер дома';
    }

    if (!in_array((string)($post['interval'] ?? ''), gg_intervals(), true)) {
        $errors['interval'] = 'Выберите удобный интервал';
    }

    /* День раньше готовности заказа выбрать нельзя: капсула выключена,
       но форму можно отправить и мимо неё. */
    $day = gg_day_from_iso((string)($post['date'] ?? ''));
    if ($day === null || $day < $readyAt) {
        $errors['date'] = 'Выберите дату не раньше готовности заказа';
    }

    if (empty($post['consent'])) {
        $errors['consent'] = 'Без согласия мы не можем принять заказ';
    }

    return $errors;
}

/* -------------------------------------------------------------------------
   Создание заказа
   ------------------------------------------------------------------------- */

/**
 * Свойства заказа типа плательщика «Физическое лицо» на стенде:
 * 1 Ф.И.О., 2 E-Mail, 3 Телефон, 4 Индекс, 5 Город, 6 Местоположение,
 * 7 Адрес доставки. Это демонстрационный набор «1С-Битрикс».
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какой набор свойств нужен на самом деле
 * (домофон, квартира и комментарий курьеру сейчас уезжают в комментарий
 * к заказу, отдельных свойств под них нет).
 */
function gg_order_props_map(): array
{
    return ['FIO' => 1, 'EMAIL' => 2, 'PHONE' => 3, 'ZIP' => 4, 'CITY' => 5, 'LOCATION' => 6, 'ADDRESS' => 7];
}

/** Службы доставки стенда: 2 — курьером, 3 — самовывоз. */
function gg_delivery_id(string $method): int
{
    return $method === 'pickup' ? 3 : 2;
}

/**
 * Создать заказ по данным формы.
 *
 * @return array ['ok' => bool, 'number' => string, 'id' => int, 'error' => string]
 */
function gg_create_order(array $data): array
{
    if (!CModule::IncludeModule('sale') || !CModule::IncludeModule('catalog')) {
        return ['ok' => false, 'error' => 'Магазин временно недоступен, позвоните нам'];
    }

    global $USER;
    $siteId = \Bitrix\Main\Context::getCurrent()->getSite();
    $userId = ($USER instanceof CUser && $USER->IsAuthorized()) ? (int)$USER->GetID() : (int)CSaleUser::GetAnonymousUserID();

    try {
        $order = \Bitrix\Sale\Order::create($siteId, $userId);
        $order->setPersonTypeId(1);

        $basket = \Bitrix\Sale\Basket::loadItemsForFUser(
            \Bitrix\Sale\Fuser::getId(),
            $siteId
        )->getOrderableItems();

        if (!$basket->count()) {
            return ['ok' => false, 'error' => 'Корзина пуста'];
        }
        $order->setBasket($basket);

        /* Отгрузка. Служба доставки берётся из существующих на стенде —
           новых мы не заводим: это решение заказчика. */
        $shipmentCollection = $order->getShipmentCollection();
        $shipment = $shipmentCollection->createItem(
            \Bitrix\Sale\Delivery\Services\Manager::getObjectById(gg_delivery_id($data['method']))
        );
        $shipmentItems = $shipment->getShipmentItemCollection();
        foreach ($basket as $item) {
            $shipmentItem = $shipmentItems->createItem($item);
            $shipmentItem->setQuantity($item->getQuantity());
        }
        $shipment->setField('CURRENCY', $order->getCurrency());

        /* Свойства. Пишем ровно то, что человек дал; местоположение
           не трогаем — справочник местоположений на стенде не загружен,
           и подставлять туда выдуманный код нельзя. */
        $props = $order->getPropertyCollection();
        $map = gg_order_props_map();
        $values = [
            'FIO' => $data['name'],
            'EMAIL' => $data['email'],
            'PHONE' => $data['phone'],
            'CITY' => 'Москва',
            'ADDRESS' => $data['method'] === 'pickup'
                ? ('Самовывоз: ' . $data['pickup'])
                : trim($data['street'] . ($data['apartment'] !== '' ? ', ' . $data['apartment'] : '')),
        ];
        foreach ($values as $code => $value) {
            $item = $props->getItemByOrderPropertyId($map[$code]);
            if ($item) {
                $item->setValue($value);
            }
        }

        $order->setField('USER_DESCRIPTION', gg_order_comment($data));

        $result = $order->save();
        if (!$result->isSuccess()) {
            return ['ok' => false, 'error' => implode(' ', $result->getErrorMessages())];
        }

        return [
            'ok' => true,
            'id' => (int)$order->getId(),
            'number' => (string)$order->getField('ACCOUNT_NUMBER'),
        ];
    } catch (\Throwable $e) {
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

/**
 * Комментарий к заказу.
 *
 * Сюда уезжает всё, под что на стенде нет свойств заказа: квартира,
 * домофон, день и интервал, способ оплаты, промокод и слово покупателя.
 * Терять это нельзя, а заводить семь свойств до разговора с заказчиком —
 * значит решать за него.
 */
function gg_order_comment(array $data): string
{
    $rows = [];
    $day = gg_day_from_iso($data['date']);
    $rows[] = 'Когда: ' . ($day ? gg_format_day_month($day) : $data['date']) . ', ' . $data['interval'];
    $rows[] = $data['method'] === 'pickup'
        ? 'Самовывоз: ' . $data['pickup']
        : 'Доставка: Москва, ' . $data['street']
            . ($data['apartment'] !== '' ? ', кв./офис ' . $data['apartment'] : '')
            . ($data['intercom'] !== '' ? ', домофон ' . $data['intercom'] : '');
    if ($data['payment'] !== '') {
        $rows[] = 'Оплата: ' . $data['payment'];
    }
    if ($data['promo'] !== '') {
        $rows[] = 'Промокод: ' . $data['promo'];
    }
    if ($data['onRequest'] > 0) {
        $rows[] = 'Позиций по запросу: ' . $data['onRequest'] . ' — сумму подтверждает менеджер';
    }
    if ($data['comment'] !== '') {
        $rows[] = 'Комментарий покупателя: ' . $data['comment'];
    }
    return implode("\n", $rows);
}

/**
 * Заказы, оформленные в этой сессии.
 *
 * Состав и шаги «что дальше» страница «Заказ принят» показывает только по
 * своему заказу: номер в адресе можно набрать руками, и отдавать по нему
 * чужой состав нельзя. Из другого браузера останутся номер и общие шаги —
 * ровно как в прототипе.
 */
function gg_remember_order(string $number, array $snapshot): void
{
    if (!isset($_SESSION['GG_ORDERS']) || !is_array($_SESSION['GG_ORDERS'])) {
        $_SESSION['GG_ORDERS'] = [];
    }
    $_SESSION['GG_ORDERS'][$number] = $snapshot;
}

function gg_own_order(string $number): ?array
{
    $list = $_SESSION['GG_ORDERS'] ?? [];
    return isset($list[$number]) && is_array($list[$number]) ? $list[$number] : null;
}
