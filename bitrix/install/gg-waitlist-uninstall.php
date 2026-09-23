// =============================================================================
// Откат gg-waitlist-install.php: агент, почтовый шаблон и событие, таблица.
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка, вставить
// файл целиком. ТАБЛИЦА УДАЛЯЕТСЯ ВМЕСТЕ С ПОДПИСКАМИ — чтобы её сохранить,
// поставьте $dropTable = false.
// =============================================================================

$dropTable = true;

$say = static function (string $line): void { echo $line . "\n"; };
$conn = \Bitrix\Main\Application::getConnection();

CAgent::RemoveAgent('GGWaitlistNotify();', 'main');
$say('Агент GGWaitlistNotify — снят');

$eventName = 'GG_WAITLIST_ARRIVED';
$rs = CEventMessage::GetList('id', 'asc', ['TYPE_ID' => $eventName]);
while ($row = $rs->Fetch()) {
    CEventMessage::Delete($row['ID']);
    $say("Почтовый шаблон {$eventName} ID {$row['ID']} — удалён");
}
$rs = CEventType::GetList(['TYPE_ID' => $eventName]);
while ($row = $rs->Fetch()) {
    CEventType::Delete($row['ID']);
    $say("Тип почтового события {$eventName} — удалён");
}

if (!$dropTable) {
    $say('Таблица gg_waitlist оставлена ($dropTable = false)');
} elseif ($conn->isTableExists('gg_waitlist')) {
    $conn->queryExecute('DROP TABLE gg_waitlist');
    $say('Таблица gg_waitlist — удалена');
} else {
    $say('Таблицы gg_waitlist нет');
}

$say('');
$say('Готово. Функцию GGWaitlistNotify из /local/php_interface/init.php');
$say('убирать не обязательно: без агента её никто не зовёт.');
