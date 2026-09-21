// =============================================================================
// Личный кабинет и избранное: таблицы, пользовательское поле и свойство заявки.
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка, вставить
// файл целиком (строки <?php нет намеренно) и выполнить. Скрипт идемпотентный:
// повторный запуск ничего не дублирует и печатает, что уже есть.
//
// ЧТО СОЗДАЁТСЯ.
//   gg_auth_code    коды входа по номеру телефона: выдача, попытки, срок
//   gg_favorite     избранное вошедшего покупателя
//   gg_address      сохранённые адреса доставки
//   gg_order_meta   телефон заказа цифрами и получение (дата, интервал,
//                   адрес, способ оплаты): по телефону гостевой заказ находит
//                   своего покупателя при первом входе с этим номером
//   UF_GG_MARKETING  согласие на новости и предложения (поле пользователя)
//   свойство USER_ID у инфоблока «Заявки менеджеру» (gg_requests)
//
// ПОЧЕМУ СВОИ ТАБЛИЦЫ, А НЕ ШТАТНЫЕ СУЩНОСТИ. Профили заказа sale и списки
// «отложенных» в корзине по форме не совпадают с тем, что показывает кабинет
// прототипа, и их пришлось бы выворачивать. Четыре простые таблицы дают ту же
// границу данных, что api.js в прототипе (PERENOS-kabinet-i-izbrannoe.md).
//
// УДАЛЕНИЕ — bitrix/install/gg-account-uninstall.php.
// =============================================================================

$say = static function (string $line): void { echo $line . "\n"; };
$conn = \Bitrix\Main\Application::getConnection();

$tables = [
    'gg_auth_code' => "
        CREATE TABLE gg_auth_code (
            ID int(11) NOT NULL AUTO_INCREMENT,
            PHONE varchar(10) NOT NULL,
            CODE varchar(8) NOT NULL,
            ISSUED_AT datetime NOT NULL,
            ATTEMPTS int(11) NOT NULL DEFAULT 0,
            USED char(1) NOT NULL DEFAULT 'N',
            IP varchar(45) NULL,
            PRIMARY KEY (ID),
            INDEX IX_GG_AUTH_CODE_PHONE (PHONE, ISSUED_AT)
        )",
    'gg_favorite' => "
        CREATE TABLE gg_favorite (
            ID int(11) NOT NULL AUTO_INCREMENT,
            USER_ID int(11) NOT NULL,
            PRODUCT_ID int(11) NOT NULL,
            ADDED_AT datetime NOT NULL,
            PRIMARY KEY (ID),
            UNIQUE KEY UX_GG_FAVORITE (USER_ID, PRODUCT_ID)
        )",
    'gg_address' => "
        CREATE TABLE gg_address (
            ID int(11) NOT NULL AUTO_INCREMENT,
            USER_ID int(11) NOT NULL,
            LABEL varchar(60) NULL,
            STREET varchar(255) NOT NULL,
            APARTMENT varchar(60) NULL,
            INTERCOM varchar(60) NULL,
            IS_DEFAULT char(1) NOT NULL DEFAULT 'N',
            CREATED_AT datetime NOT NULL,
            PRIMARY KEY (ID),
            INDEX IX_GG_ADDRESS_USER (USER_ID, CREATED_AT)
        )",
    'gg_order_meta' => "
        CREATE TABLE gg_order_meta (
            ORDER_ID int(11) NOT NULL,
            PHONE varchar(10) NOT NULL,
            DATA mediumtext NULL,
            CREATED_AT datetime NOT NULL,
            PRIMARY KEY (ORDER_ID),
            INDEX IX_GG_ORDER_META_PHONE (PHONE)
        )",
];

foreach ($tables as $name => $sql) {
    if ($conn->isTableExists($name)) {
        $say('Таблица ' . $name . ' — уже есть');
        continue;
    }
    $conn->queryExecute($sql);
    $say('Таблица ' . $name . ' — создана');
}

// ---- Поле пользователя: согласие на новости -------------------------------

$field = 'UF_GG_MARKETING';
$exists = false;
$rs = CUserTypeEntity::GetList([], ['ENTITY_ID' => 'USER', 'FIELD_NAME' => $field]);
if ($rs->Fetch()) {
    $exists = true;
}
if ($exists) {
    $say('Поле пользователя ' . $field . ' — уже есть');
} else {
    $type = new CUserTypeEntity();
    $id = (int)$type->Add([
        'ENTITY_ID' => 'USER',
        'FIELD_NAME' => $field,
        'USER_TYPE_ID' => 'boolean',
        'MULTIPLE' => 'N',
        'MANDATORY' => 'N',
        'SETTINGS' => ['DEFAULT_VALUE' => 0],
        'EDIT_FORM_LABEL' => ['ru' => 'Новости и предложения', 'en' => 'Marketing consent'],
        'LIST_COLUMN_LABEL' => ['ru' => 'Новости и предложения', 'en' => 'Marketing consent'],
    ]);
    $say($id > 0 ? ('Поле пользователя ' . $field . ' — создано, ID ' . $id) : ('Поле ' . $field . ' создать не удалось'));
}

// ---- Свойство USER_ID у инфоблока заявок ----------------------------------

if (!CModule::IncludeModule('iblock')) {
    $say('Модуль iblock недоступен — свойство заявки не проверено');
    return;
}

$iblockId = 0;
$rs = CIBlock::GetList([], ['CODE' => 'gg_requests', 'CHECK_PERMISSIONS' => 'N']);
if ($row = $rs->Fetch()) {
    $iblockId = (int)$row['ID'];
}
if (!$iblockId) {
    $say('Инфоблок gg_requests не найден — сначала gg-requests-install.php');
    return;
}

$propRs = CIBlockProperty::GetList([], ['IBLOCK_ID' => $iblockId, 'CODE' => 'USER_ID', 'CHECK_PERMISSIONS' => 'N']);
if ($propRs->Fetch()) {
    $say('Свойство USER_ID у gg_requests — уже есть');
} else {
    $prop = new CIBlockProperty();
    $propId = (int)$prop->Add([
        'IBLOCK_ID' => $iblockId,
        'NAME' => 'ID покупателя',
        'CODE' => 'USER_ID',
        'PROPERTY_TYPE' => 'N',
        'SORT' => 900,
        'MULTIPLE' => 'N',
        'IS_REQUIRED' => 'N',
        'HINT' => 'Заполняется сайтом: кабинет показывает заявки этого покупателя',
    ]);
    $say($propId > 0 ? ('Свойство USER_ID у gg_requests — создано, ID ' . $propId) : 'Свойство USER_ID создать не удалось');
}

$say('');
$say('Готово. Инфоблок заявок: ID ' . $iblockId);
$say('Дальше: залить архив стенда с файлами кабинета и проверить /account/login/.');
