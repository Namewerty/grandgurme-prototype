// =============================================================================
// Удаление всего, что создал gg-requests-install.php.
//
// Настройки → Инструменты → Командная PHP-строка, вставить целиком.
// ⚠ ВМЕСТЕ С ИНФОБЛОКОМ УДАЛЯЮТСЯ ВСЕ СОХРАНЁННЫЕ ЗАЯВКИ. Перед запуском
// выгрузить их, если они нужны. Повторный запуск безопасен.
// =============================================================================

if (!CModule::IncludeModule('iblock')) {
    echo "Модуль iblock не подключён — остановлено\n";
    return;
}

$eventName = 'GG_MANAGER_REQUEST';

$res = CEventMessage::GetList('id', 'asc', ['TYPE_ID' => $eventName]);
$found = false;
while ($row = $res->Fetch()) {
    CEventMessage::Delete((int)$row['ID']);
    echo "Почтовый шаблон ID {$row['ID']}: удалён\n";
    $found = true;
}
if (!$found) {
    echo "Почтовых шаблонов {$eventName} нет\n";
}

if (CEventType::GetList(['TYPE_ID' => $eventName])->Fetch()) {
    CEventType::Delete($eventName);
    echo "Тип почтового события {$eventName}: удалён\n";
} else {
    echo "Типа почтового события {$eventName} нет\n";
}

$iblock = CIBlock::GetList([], ['TYPE' => 'gg_service', 'CODE' => 'gg_requests', 'CHECK_PERMISSIONS' => 'N'])->Fetch();
if ($iblock) {
    CIBlock::Delete((int)$iblock['ID']);
    echo "Инфоблок gg_requests ID {$iblock['ID']}: удалён вместе со свойствами и заявками\n";
} else {
    echo "Инфоблока gg_requests нет\n";
}

// Тип удаляется, только если в нём не осталось других инфоблоков.
if (CIBlockType::GetByID('gg_service')->Fetch()) {
    $other = CIBlock::GetList([], ['TYPE' => 'gg_service', 'CHECK_PERMISSIONS' => 'N'])->Fetch();
    if ($other) {
        echo "Тип gg_service оставлен: в нём есть инфоблок «{$other['NAME']}»\n";
    } else {
        CIBlockType::Delete('gg_service');
        echo "Тип инфоблоков gg_service: удалён\n";
    }
} else {
    echo "Типа инфоблоков gg_service нет\n";
}
