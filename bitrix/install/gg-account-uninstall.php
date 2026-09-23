// =============================================================================
// Откат gg-account-install.php: таблицы кабинета, поле пользователя и свойство
// заявки. Вставлять в «Командную PHP-строку» целиком.
//
// ДАННЫЕ ПРОПАДУТ: избранное, адреса и коды входа лежат в этих таблицах.
// Заказы и заявки не трогаются, учётные записи покупателей остаются.
// ИЛИ ПО SSH: npm run stand:php -- bitrix/install/gg-account-uninstall.php --mode=<режим>
// =============================================================================

$say = static function (string $line): void { echo $line . "\n"; };
$conn = \Bitrix\Main\Application::getConnection();

foreach (['gg_auth_code', 'gg_favorite', 'gg_address', 'gg_order_meta'] as $name) {
    if (!$conn->isTableExists($name)) {
        $say('Таблицы ' . $name . ' нет');
        continue;
    }
    $conn->queryExecute('DROP TABLE ' . $name);
    $say('Таблица ' . $name . ' — удалена');
}

$rs = CUserTypeEntity::GetList([], ['ENTITY_ID' => 'USER', 'FIELD_NAME' => 'UF_GG_MARKETING']);
if ($row = $rs->Fetch()) {
    $type = new CUserTypeEntity();
    $type->Delete((int)$row['ID']);
    $say('Поле пользователя UF_GG_MARKETING — удалено');
} else {
    $say('Поля UF_GG_MARKETING нет');
}

if (CModule::IncludeModule('iblock')) {
    $iblockId = 0;
    $rs = CIBlock::GetList([], ['CODE' => 'gg_requests', 'CHECK_PERMISSIONS' => 'N']);
    if ($row = $rs->Fetch()) {
        $iblockId = (int)$row['ID'];
    }
    if ($iblockId) {
        $propRs = CIBlockProperty::GetList([], ['IBLOCK_ID' => $iblockId, 'CODE' => 'USER_ID', 'CHECK_PERMISSIONS' => 'N']);
        if ($prop = $propRs->Fetch()) {
            CIBlockProperty::Delete((int)$prop['ID']);
            $say('Свойство USER_ID у gg_requests — удалено');
        } else {
            $say('Свойства USER_ID у gg_requests нет');
        }
    }
}

$say('Готово.');
