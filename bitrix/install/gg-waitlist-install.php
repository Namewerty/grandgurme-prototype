// =============================================================================
// Лист ожидания: таблица, почтовое событие о поступлении и часовой агент.
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка, вставить
// файл целиком (строки <?php нет намеренно) и выполнить. Скрипт идемпотентный:
// повторный запуск ничего не дублирует и печатает, что уже есть.
//
// ЧТО СОЗДАЁТСЯ.
//   gg_waitlist            кто какого товара ждёт и с какого дня
//   GG_WAITLIST_ARRIVED    тип почтового события и шаблон письма
//   агент GGWaitlistNotify раз в час: смотрит остаток и цену по записям листа
//                          и отправляет письмо один раз на запись
//
// ПОЧЕМУ ПОЧТА, А НЕ СМС. Провайдера СМС у стенда ещё нет (README, «Что
// осталось до полного запуска»). Письмо — то же уведомление тем же местом:
// когда провайдера подключат в модуле «Служба сообщений», агент начнёт слать
// СМС там же, где сейчас зовёт CEvent::Send.
//
// ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: текст письма о поступлении и текст будущей СМС.
//
// УДАЛЕНИЕ — bitrix/install/gg-waitlist-uninstall.php.
// =============================================================================

$say = static function (string $line): void { echo $line . "\n"; };
$conn = \Bitrix\Main\Application::getConnection();

// ---- 1. Таблица -------------------------------------------------------------

if ($conn->isTableExists('gg_waitlist')) {
    $say('Таблица gg_waitlist — уже есть');
} else {
    $conn->queryExecute("
        CREATE TABLE gg_waitlist (
            ID int(11) NOT NULL AUTO_INCREMENT,
            USER_ID int(11) NOT NULL,
            PRODUCT_ID int(11) NOT NULL,
            CREATED_AT datetime NOT NULL,
            NOTIFIED_AT datetime NULL,
            PRIMARY KEY (ID),
            UNIQUE KEY UX_GG_WAITLIST (USER_ID, PRODUCT_ID),
            INDEX IX_GG_WAITLIST_USER (USER_ID, CREATED_AT)
        )");
    $say('Таблица gg_waitlist — создана');
}

// ---- 2. Почтовое событие ----------------------------------------------------

$eventName = 'GG_WAITLIST_ARRIVED';
$description = implode("\n", [
    '#PRODUCT_NAME# - название товара',
    '#PRODUCT_URL# - ссылка на карточку товара',
    '#CATALOG_URL# - ссылка на каталог',
    '#USER_NAME# - имя покупателя',
]);

if (CEventType::GetList(['TYPE_ID' => $eventName, 'LID' => 'ru'])->Fetch()) {
    $say("Тип почтового события {$eventName} — уже есть");
} else {
    (new CEventType())->Add([
        'LID' => 'ru',
        'EVENT_NAME' => $eventName,
        'NAME' => 'Гранд Гурмэ: товар из листа ожидания поступил',
        'DESCRIPTION' => $description,
    ]);
    $say("Тип почтового события {$eventName} — создан");
}

$message = CEventMessage::GetList('id', 'asc', ['TYPE_ID' => $eventName])->Fetch();
if ($message) {
    $say("Почтовый шаблон {$eventName} — уже есть, ID {$message['ID']}");
} else {
    $em = new CEventMessage();
    $messageId = (int)$em->Add([
        'ACTIVE' => 'Y',
        'EVENT_NAME' => $eventName,
        'LID' => ['s1'],
        'EMAIL_FROM' => '#DEFAULT_EMAIL_FROM#',
        'EMAIL_TO' => '#EMAIL_TO#',
        'SUBJECT' => '#PRODUCT_NAME# снова в наличии — #SITE_NAME#',
        'BODY_TYPE' => 'html',
        // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: текст письма.
        'MESSAGE' => '<p>Здравствуйте, #USER_NAME#!</p>'
            . '<p>Товар <b>#PRODUCT_NAME#</b>, который вы ждали, появился на складе.</p>'
            . '<p><a href="#PRODUCT_URL#">Открыть карточку товара</a></p>'
            . '<p><a href="#CATALOG_URL#">Перейти в каталог</a></p>',
    ]);
    $say($messageId
        ? "Почтовый шаблон {$eventName} — создан, ID {$messageId}"
        : 'Почтовый шаблон не создан: ' . $em->LAST_ERROR);
}

// ---- 3. Агент ---------------------------------------------------------------

$agent = 'GGWaitlistNotify();';
$rs = CAgent::GetList([], ['NAME' => $agent, 'MODULE_ID' => 'main']);
if ($rs->Fetch()) {
    $say('Агент GGWaitlistNotify — уже есть');
} else {
    $id = CAgent::AddAgent($agent, 'main', 'N', 3600, '', 'Y');
    $say($id ? "Агент GGWaitlistNotify — добавлен, ID {$id}, раз в час" : 'Агент добавить не удалось');
}

$say('');
$say('Готово. Сама функция GGWaitlistNotify лежит в /local/php_interface/init.php');
$say('(в репозитории — bitrix/server/local/php_interface/init.php): без неё агент');
$say('только запишется в очередь и ничего не сделает.');
