// =============================================================================
// Откат «Разделов витрины»: удаление инфоблока gg_catalog_sections.
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка, вставить
// файл целиком и «Выполнить». Сначала с $mode = 'check'.
//
// ЧТО БУДЕТ С САЙТОМ. Ничего не сломается: без инфоблока catalog-admin.php
// возвращает пустой список, и все разделы берут тексты из карты витрины
// (include/catalog-map.php), как до пилота. Заголовок «Бакалеи» снова станет
// «Бакалея и консервация».
//
// Тип инфоблоков gg_service НЕ удаляется: в нём живут заявки менеджеру.
// =============================================================================

$mode = 'check'; // check | uninstall

if (!CModule::IncludeModule('iblock')) {
    echo "Модуль iblock не подключён — остановлено\n";
    return;
}

$out = static function (string $line): void {
    echo $line . "\n";
};

$iblock = CIBlock::GetList([], [
    'TYPE' => 'gg_service',
    'CODE' => 'gg_catalog_sections',
    'CHECK_PERMISSIONS' => 'N',
])->Fetch();

if (!$iblock) {
    $out('Инфоблок gg_catalog_sections не найден — удалять нечего.');
    return;
}

$iblockId = (int)$iblock['ID'];
$count = 0;
$rows = CIBlockElement::GetList([], ['IBLOCK_ID' => $iblockId, 'CHECK_PERMISSIONS' => 'N'], false, false, ['ID', 'NAME', 'CODE']);
while ($row = $rows->Fetch()) {
    $count++;
    $out("  запись {$row['CODE']}: «{$row['NAME']}»");
}
$out("Инфоблок gg_catalog_sections: ID {$iblockId}, записей {$count}.");

if ($mode !== 'uninstall') {
    $out("Проверка. Чтобы удалить — поменять первую строку на \$mode = 'uninstall'.");
    return;
}

if (CIBlock::Delete($iblockId)) {
    $out('Инфоблок удалён вместе с записями. Разделы снова берут тексты из карты витрины.');
} else {
    global $APPLICATION;
    $ex = $APPLICATION->GetException();
    $out('Инфоблок не удалён: ' . ($ex ? $ex->GetString() : 'причина не названа'));
}
