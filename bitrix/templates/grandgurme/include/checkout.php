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
 * ТРИ РЕЖИМА (16.09.2026): только заказ, заказ и заявка, только заявка —
 * по содержимому корзины (gg_cart_mode). Порядок отправки: сначала заказ;
 * не создался — ошибка на форме, и заявка тоже не создаётся. Заказ создан,
 * а заявка нет — страница успеха заказа со строкой «Заявку отправить не
 * удалось, позвоните нам». Заявка — include/requests.php.
 *
 * ОПЛАТА В ЗАКАЗ НЕ ПИШЕТСЯ. На стенде стоят демонстрационные платёжные
 * системы «1С-Битрикс» (ЮMoney, Терминалы, Наложенный платёж) — ни одна
 * из них не та, что подключена у компании. Выбранный способ уезжает
 * в комментарий к заказу, документ оплаты создаёт менеджер.
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: какие платёжные системы заводить.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

require_once __DIR__ . '/cart.php';
require_once __DIR__ . '/requests.php';

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
   Режим страницы — от содержимого корзины (checkout-page.js прототипа).
   ------------------------------------------------------------------------- */

/** Тексты режимов — src/data/checkout-copy.js → modes. */
function gg_checkout_modes(): array
{
    return [
        'order' => [
            'title' => 'Оформление заказа',
            'lead' => 'Без регистрации: нужны только контакты и адрес.',
            'submit' => 'Подтвердить заказ',
        ],
        'both' => [
            'title' => 'Заказ и заявка',
            'lead' => 'Контакты общие. Заказ оплачиваете на сайте, по заявке менеджер свяжется отдельно.',
            'submit' => 'Подтвердить заказ и отправить заявку',
        ],
        'request' => [
            'title' => 'Заявка менеджеру',
            'lead' => 'Оставьте контакты: менеджер уточнит цену и срок поставки и свяжется с вами.',
            'submit' => 'Отправить заявку',
        ],
    ];
}

/** Что лежит в корзине — от этого зависит состав страницы. */
function gg_checkout_plan(array $state): array
{
    $totals = $state['totals'];
    $mode = gg_cart_mode($totals);
    return [
        'mode' => $mode,
        'hasOrder' => $mode !== 'request',
        'hasRequest' => $mode !== 'order',
        'canSplit' => $totals['order']['hasStock'] && $totals['order']['hasPreorder'],
        'orderLines' => $state['orderLines'],
        'requestLines' => $state['requestLines'],
        'stockLines' => array_values(array_filter($state['orderLines'], static fn($l) => $l['kind'] === 'stock')),
        'preorderLines' => array_values(array_filter($state['orderLines'], static fn($l) => $l['kind'] === 'preorder')),
        'readyAt' => (int)$totals['order']['readyAt'],
        'today' => gg_day_start(),
        'totals' => $totals,
    ];
}

/** Выбрано ли разделение на две доставки. */
function gg_checkout_split(array $post, array $plan): string
{
    return ($plan['canSplit'] && ($post['split'] ?? '') === 'two') ? 'two' : 'one';
}

/* -------------------------------------------------------------------------
   Проверка полей. Тексты ошибок — из src/data/checkout-copy.js.
   ------------------------------------------------------------------------- */

function gg_checkout_validate(array $post, array $plan): array
{
    $errors = [];

    if (trim((string)($post['name'] ?? '')) === '') {
        $errors['name'] = 'Как к вам обращаться?';
    }

    $digits = gg_phone_digits((string)($post['phone'] ?? ''));
    if ($digits === '') {
        $errors['phone'] = 'Укажите телефон — по нему менеджер подтвердит заказ';
    } elseif (strlen($digits) < 10) {
        $errors['phone'] = 'В номере должно быть десять цифр после +7';
    }

    /* Email обязателен, когда есть заказ: туда уходит подтверждение.
       У одной заявки поле необязательное, но введённое должно быть адресом. */
    $email = trim((string)($post['email'] ?? ''));
    if ($email === '') {
        if ($plan['hasOrder']) {
            $errors['email'] = 'Укажите почту — туда придёт подтверждение';
        }
    } elseif (!preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u', $email)) {
        $errors['email'] = 'Проверьте адрес: в нём должны быть @ и домен';
    }

    if ($plan['hasOrder']) {
        $method = ($post['method'] ?? 'delivery') === 'pickup' ? 'pickup' : 'delivery';
        /* Улица нужна только доставке: при самовывозе поле не проверяется. */
        if ($method === 'delivery' && trim((string)($post['street'] ?? '')) === '') {
            $errors['street'] = 'Укажите улицу и номер дома';
        }

        $readyAt = $plan['readyAt'];
        $today = $plan['today'];
        $dateError = 'Выберите дату не раньше готовности заказа';

        if (gg_checkout_split($post, $plan) === 'two') {
            /* Две доставки: наличие — с сегодня до дня перед готовностью,
               под заказ — от дня готовности. Проверяются только при «двумя». */
            foreach (['stock', 'preorder'] as $key) {
                if (!in_array((string)($post['interval_' . $key] ?? ''), gg_intervals(), true)) {
                    $errors['interval_' . $key] = 'Выберите удобный интервал';
                }
            }
            $stockDay = gg_day_from_iso((string)($post['date_stock'] ?? ''));
            if ($stockDay === null || $stockDay < $today || $stockDay >= $readyAt) {
                $errors['date_stock'] = 'Выберите дату до готовности заказа';
            }
            /* Верхняя граница — последний день ленты: от готовности на
               GG_DAYS_AHEAD дней. Дату за лентой можно прислать только мимо формы. */
            $preorderDay = gg_day_from_iso((string)($post['date_preorder'] ?? ''));
            if ($preorderDay === null || $preorderDay < $readyAt || $preorderDay > gg_add_days($readyAt, GG_DAYS_AHEAD - 1)) {
                $errors['date_preorder'] = $dateError;
            }
        } else {
            if (!in_array((string)($post['interval'] ?? ''), gg_intervals(), true)) {
                $errors['interval'] = 'Выберите удобный интервал';
            }
            /* День раньше готовности заказа выбрать нельзя: капсула выключена,
               но форму можно отправить и мимо неё. */
            $day = gg_day_from_iso((string)($post['date'] ?? ''));
            if ($day === null || $day < $readyAt || $day > gg_add_days($today, GG_DAYS_AHEAD - 1)) {
                $errors['date'] = $dateError;
            }
        }
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

/**
 * Код местоположения «Москва» из справочника магазина. Справочник на стенде
 * загружен (≈ 4 300 записей, 17.09.2026), город ищется по названию: коды
 * местоположений между установками Битрикса не совпадают. '' — не нашли.
 */
function gg_moscow_location_code(): string
{
    static $code = null;
    if ($code !== null) {
        return $code;
    }
    $code = '';
    try {
        $row = \Bitrix\Sale\Location\LocationTable::getList([
            'filter' => ['=NAME.NAME' => 'Москва', '=NAME.LANGUAGE_ID' => 'ru', '=TYPE.CODE' => 'CITY'],
            'select' => ['CODE'],
            'limit' => 1,
        ])->fetch();
        $code = $row ? (string)$row['CODE'] : '';
    } catch (\Throwable $e) {
        $code = '';
    }
    return $code;
}

/** Службы доставки стенда: 2 — курьером, 3 — самовывоз. */
function gg_delivery_id(string $method): int
{
    return $method === 'pickup' ? 3 : 2;
}

/**
 * Отгрузки заказа по данным формы.
 *
 * @return array [['kind' => 'all'|'stock'|'preorder', 'label' => string, 'date' => iso, 'interval' => string, 'productIds' => int[]|null]]
 */
function gg_checkout_shipments(array $post, array $plan): array
{
    if (gg_checkout_split($post, $plan) === 'two') {
        return [
            [
                'kind' => 'stock',
                'label' => 'Товары в наличии',
                'date' => (string)($post['date_stock'] ?? ''),
                'interval' => (string)($post['interval_stock'] ?? ''),
                'productIds' => array_column($plan['stockLines'], 'productId'),
            ],
            [
                'kind' => 'preorder',
                'label' => 'Товары под заказ',
                'date' => (string)($post['date_preorder'] ?? ''),
                'interval' => (string)($post['interval_preorder'] ?? ''),
                'productIds' => array_column($plan['preorderLines'], 'productId'),
            ],
        ];
    }
    return [[
        'kind' => 'all',
        'label' => '',
        'date' => (string)($post['date'] ?? ''),
        'interval' => (string)($post['interval'] ?? ''),
        'productIds' => null,
    ]];
}

/** «23 сентября, 10:00–14:00». */
function gg_shipment_when(array $shipment): string
{
    $day = gg_day_from_iso($shipment['date']);
    return ($day ? gg_format_day_month($day) : $shipment['date']) . ', ' . $shipment['interval'];
}

/**
 * Создать заказ по данным формы.
 *
 * ДВЕ ОТГРУЗКИ — ДВЕ ЗАПИСИ В ShipmentCollection на ту же службу доставки:
 * в первую позиции «в наличии», во вторую — «под заказ». В поле COMMENTS
 * каждой отгрузки — её дата и интервал, в комментарии к заказу — обе строки.
 * Стоимость второй доставки не считается: ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА,
 * пока её называет менеджер.
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

        /* Отгрузки. Служба доставки берётся из существующих на стенде —
           новых мы не заводим: это решение заказчика. */
        $shipmentCollection = $order->getShipmentCollection();
        $service = \Bitrix\Sale\Delivery\Services\Manager::getObjectById(gg_delivery_id($data['method']));
        $where = $data['method'] === 'pickup' ? 'Самовывоз' : 'Доставка';

        foreach ($data['shipments'] as $plan) {
            $shipment = $shipmentCollection->createItem($service);
            $shipmentItems = $shipment->getShipmentItemCollection();
            $wanted = $plan['productIds'] === null ? null : array_flip(array_map('intval', $plan['productIds']));
            foreach ($basket as $item) {
                if ($wanted !== null && !isset($wanted[(int)$item->getProductId()])) {
                    continue;
                }
                $shipmentItem = $shipmentItems->createItem($item);
                $shipmentItem->setQuantity($item->getQuantity());
            }
            $shipment->setField('CURRENCY', $order->getCurrency());
            /* Стоимость доставки в заказ не считается (17.09.2026). У службы
               «Доставка курьером» на стенде демонстрационная цена 500 ₽ за
               отгрузку: заказ с двумя доставками получал бы +1 000 ₽ к сумме,
               которую человек видел в корзине и на оформлении («Доставка —
               рассчитаем при оформлении»). Пока зон и цен нет, сумма заказа
               равна сумме товаров, доставку добавляет менеджер.
               ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: зоны и стоимость доставки — тогда
               эту строку убрать и завести цены в службе доставки. */
            /* Именно так: setBasePriceDelivery(0, true) на sale 26 цену не
               фиксирует — пересчёт возвращает 500 ₽ (проверено на стенде). */
            $shipment->setFields(['CUSTOM_PRICE_DELIVERY' => 'Y', 'BASE_PRICE_DELIVERY' => 0, 'PRICE_DELIVERY' => 0]);
            $shipment->setField(
                'COMMENTS',
                trim(($plan['label'] !== '' ? $plan['label'] . '. ' : '') . $where . ': ' . gg_shipment_when($plan))
            );
        }

        /* Свойства. Пишем ровно то, что человек дал. Местоположение —
           Москва из справочника магазина: сайт возит только по Москве, а без
           местоположения заказ в админке не проходит проверку ограничений
           служб доставки. Индекс не пишем: его человек не вводил. */
        $props = $order->getPropertyCollection();
        $map = gg_order_props_map();
        $values = [
            'FIO' => $data['name'],
            'EMAIL' => $data['email'],
            'PHONE' => $data['phone'],
            'CITY' => 'Москва',
            'LOCATION' => gg_moscow_location_code(),
            'ADDRESS' => $data['method'] === 'pickup'
                ? ('Самовывоз: ' . $data['pickup'])
                : trim($data['street'] . ($data['apartment'] !== '' ? ', ' . $data['apartment'] : '')),
        ];
        foreach ($values as $code => $value) {
            $item = $props->getItemByOrderPropertyId($map[$code]);
            if ($item && $value !== '') {
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
 * домофон, день и интервал (при двух доставках — обе строки), способ
 * оплаты, промокод и слово покупателя. Строки «Позиций по запросу» больше
 * нет: позиции без цены уходят заявкой, в заказ они не попадают.
 */
function gg_order_comment(array $data): string
{
    $rows = [];
    if (count($data['shipments']) > 1) {
        foreach ($data['shipments'] as $shipment) {
            $rows[] = $shipment['label'] . ': ' . gg_shipment_when($shipment);
        }
    } else {
        $rows[] = 'Когда: ' . gg_shipment_when($data['shipments'][0]);
    }
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
