// =============================================================================
// Заявки менеджеру: инфоблок и почтовое событие.
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка. Вставить
// содержимое этого файла целиком (строки <?php в нём нет намеренно: командная
// строка исполняет код как есть) и нажать «Выполнить».
// На сервер файл НЕ заливается и в архив не входит.
//
// ИДЕМПОТЕНТНЫЙ. Повторный запуск ничего не дублирует: всё, что уже есть,
// находится по коду и печатается строкой «уже есть».
//
// ЧТО СОЗДАЁТ:
//   - тип инфоблоков gg_service «Сайт: служебное»;
//   - инфоблок gg_requests «Заявки менеджеру»: сайт s1, без индексации
//     в поиске, без документооборота, группе «Все пользователи» — «Нет доступа»;
//   - свойства CUSTOMER_NAME, PHONE, EMAIL, CONTACT_WAY, ITEMS, ITEMS_JSON,
//     QUESTION, ORDER_NUMBER, STATUS;
//   - тип почтового события GG_MANAGER_REQUEST и почтовый шаблон к нему.
//
// Код шаблона (include/requests.php) находит инфоблок по коду gg_requests,
// значения списков — по XML_ID. ID в код не зашиты.
//
// Удаление — gg-requests-uninstall.php рядом.
// ИЛИ ПО SSH: npm run stand:php -- bitrix/install/gg-requests-install.php --mode=<режим>
// =============================================================================

if (!CModule::IncludeModule('iblock')) {
    echo "Модуль iblock не подключён — остановлено\n";
    return;
}

$out = static function (string $line): void {
    echo $line . "\n";
};

// ---- 1. Тип инфоблоков ------------------------------------------------------

$typeId = 'gg_service';
if (CIBlockType::GetByID($typeId)->Fetch()) {
    $out("Тип инфоблоков {$typeId}: уже есть");
} else {
    $type = new CIBlockType();
    $ok = $type->Add([
        'ID' => $typeId,
        'SECTIONS' => 'N',
        'IN_RSS' => 'N',
        'SORT' => 900,
        'LANG' => [
            'ru' => ['NAME' => 'Сайт: служебное', 'ELEMENT_NAME' => 'Элемент'],
            'en' => ['NAME' => 'Site: service', 'ELEMENT_NAME' => 'Element'],
        ],
    ]);
    if (!$ok) {
        $out('Тип инфоблоков не создан: ' . $type->LAST_ERROR);
        return;
    }
    $out("Тип инфоблоков {$typeId}: создан");
}

// ---- 2. Инфоблок ------------------------------------------------------------

$iblock = CIBlock::GetList([], ['TYPE' => $typeId, 'CODE' => 'gg_requests', 'CHECK_PERMISSIONS' => 'N'])->Fetch();
if ($iblock) {
    $iblockId = (int)$iblock['ID'];
    $out("Инфоблок gg_requests: уже есть, ID {$iblockId}");
} else {
    $ib = new CIBlock();
    $iblockId = (int)$ib->Add([
        'IBLOCK_TYPE_ID' => $typeId,
        'LID' => ['s1'],
        'CODE' => 'gg_requests',
        'API_CODE' => 'GgRequests',
        'NAME' => 'Заявки менеджеру',
        'ACTIVE' => 'Y',
        'SORT' => 100,
        'INDEX_ELEMENT' => 'N',
        'INDEX_SECTION' => 'N',
        'WORKFLOW' => 'N',
        'BIZPROC' => 'N',
        'VERSION' => 2,
        'LIST_PAGE_URL' => '',
        'DETAIL_PAGE_URL' => '',
        'SECTION_PAGE_URL' => '',
        // Группа 2 — «Все пользователи (в том числе неавторизованные)»: нет доступа.
        'GROUP_ID' => ['2' => 'D'],
        'ELEMENTS_NAME' => 'Заявки',
        'ELEMENT_NAME' => 'Заявка',
        'ELEMENT_ADD' => 'Добавить заявку',
        'ELEMENT_EDIT' => 'Изменить заявку',
        'ELEMENT_DELETE' => 'Удалить заявку',
    ]);
    if (!$iblockId) {
        $out('Инфоблок не создан: ' . $ib->LAST_ERROR);
        return;
    }
    $out("Инфоблок gg_requests: создан, ID {$iblockId}");
}

// ---- 3. Свойства ------------------------------------------------------------

$properties = [
    ['CODE' => 'CUSTOMER_NAME', 'NAME' => 'Имя', 'PROPERTY_TYPE' => 'S', 'SORT' => 100],
    ['CODE' => 'PHONE', 'NAME' => 'Телефон', 'PROPERTY_TYPE' => 'S', 'SORT' => 110],
    ['CODE' => 'EMAIL', 'NAME' => 'Email', 'PROPERTY_TYPE' => 'S', 'SORT' => 120],
    [
        'CODE' => 'CONTACT_WAY',
        'NAME' => 'Как связаться',
        'PROPERTY_TYPE' => 'L',
        'LIST_TYPE' => 'L',
        'SORT' => 130,
        'VALUES' => [
            ['XML_ID' => 'call', 'VALUE' => 'Позвонить', 'SORT' => 10, 'DEF' => 'Y'],
            ['XML_ID' => 'whatsapp', 'VALUE' => 'WhatsApp', 'SORT' => 20, 'DEF' => 'N'],
            ['XML_ID' => 'telegram', 'VALUE' => 'Telegram', 'SORT' => 30, 'DEF' => 'N'],
        ],
    ],
    // Таблица: название, фасовка, артикул, количество, цена каталога или
    // «по запросу», ссылка на товар.
    ['CODE' => 'ITEMS', 'NAME' => 'Позиции', 'PROPERTY_TYPE' => 'S', 'USER_TYPE' => 'HTML', 'SORT' => 140],
    // Тот же состав строкой JSON — для будущей автоматизации.
    ['CODE' => 'ITEMS_JSON', 'NAME' => 'Позиции (JSON)', 'PROPERTY_TYPE' => 'S', 'ROW_COUNT' => 5, 'COL_COUNT' => 60, 'SORT' => 150],
    ['CODE' => 'QUESTION', 'NAME' => 'Вопрос менеджеру', 'PROPERTY_TYPE' => 'S', 'ROW_COUNT' => 3, 'COL_COUNT' => 60, 'SORT' => 160],
    ['CODE' => 'ORDER_NUMBER', 'NAME' => 'Номер заказа, если заявка ушла вместе с ним', 'PROPERTY_TYPE' => 'S', 'SORT' => 170],
    [
        'CODE' => 'STATUS',
        'NAME' => 'Статус',
        'PROPERTY_TYPE' => 'L',
        'LIST_TYPE' => 'L',
        'SORT' => 180,
        'VALUES' => [
            ['XML_ID' => 'new', 'VALUE' => 'Новая', 'SORT' => 10, 'DEF' => 'Y'],
            ['XML_ID' => 'work', 'VALUE' => 'В работе', 'SORT' => 20, 'DEF' => 'N'],
            ['XML_ID' => 'closed', 'VALUE' => 'Закрыта', 'SORT' => 30, 'DEF' => 'N'],
        ],
    ],
];

$propIds = [];
foreach ($properties as $fields) {
    $existing = CIBlockProperty::GetList([], ['IBLOCK_ID' => $iblockId, 'CODE' => $fields['CODE']])->Fetch();
    if ($existing) {
        $propIds[$fields['CODE']] = (int)$existing['ID'];
        $out("Свойство {$fields['CODE']}: уже есть, ID {$existing['ID']}");
        // Значения списка дописываются, если их не хватает.
        if (!empty($fields['VALUES'])) {
            foreach ($fields['VALUES'] as $value) {
                $has = CIBlockPropertyEnum::GetList([], ['PROPERTY_ID' => $existing['ID'], 'XML_ID' => $value['XML_ID']])->Fetch();
                if (!$has) {
                    (new CIBlockPropertyEnum())->Add(['PROPERTY_ID' => $existing['ID']] + $value);
                    $out("  значение {$value['XML_ID']}: добавлено");
                }
            }
        }
        continue;
    }
    $prop = new CIBlockProperty();
    $id = (int)$prop->Add(['IBLOCK_ID' => $iblockId, 'ACTIVE' => 'Y', 'MULTIPLE' => 'N', 'IS_REQUIRED' => 'N'] + $fields);
    if (!$id) {
        $out("Свойство {$fields['CODE']} не создано: " . $prop->LAST_ERROR);
        continue;
    }
    $propIds[$fields['CODE']] = $id;
    $out("Свойство {$fields['CODE']}: создано, ID {$id}");
}

// ---- 4. Почтовое событие ----------------------------------------------------

$eventName = 'GG_MANAGER_REQUEST';
$description = implode("\n", [
    '#REQUEST_ID# - номер заявки (ID элемента инфоблока)',
    '#NAME# - имя',
    '#PHONE# - телефон',
    '#EMAIL# - email',
    '#CONTACT_WAY# - как связаться',
    '#ITEMS# - позиции (HTML-таблица)',
    '#QUESTION# - вопрос менеджеру',
    '#ORDER_NUMBER# - номер заказа, если заявка ушла вместе с ним',
    '#ADMIN_LINK# - ссылка на заявку в админке',
]);

if (CEventType::GetList(['TYPE_ID' => $eventName, 'LID' => 'ru'])->Fetch()) {
    $out("Тип почтового события {$eventName}: уже есть");
} else {
    $et = new CEventType();
    $et->Add([
        'LID' => 'ru',
        'EVENT_NAME' => $eventName,
        'NAME' => 'Гранд Гурмэ: заявка менеджеру',
        'DESCRIPTION' => $description,
    ]);
    $out("Тип почтового события {$eventName}: создан");
}

// ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: адрес менеджера для заявок. Пока — «E-mail для
// уведомлений» модуля магазина, а если он пуст — адрес отправителя сайта.
$saleEmail = trim((string)COption::GetOptionString('sale', 'order_email', ''));
$emailTo = $saleEmail !== '' ? $saleEmail : '#DEFAULT_EMAIL_FROM#';

$message = CEventMessage::GetList('id', 'asc', ['TYPE_ID' => $eventName])->Fetch();
if ($message) {
    $out("Почтовый шаблон {$eventName}: уже есть, ID {$message['ID']}, получатель {$message['EMAIL_TO']}");
} else {
    $em = new CEventMessage();
    $messageId = (int)$em->Add([
        'ACTIVE' => 'Y',
        'EVENT_NAME' => $eventName,
        'LID' => ['s1'],
        'EMAIL_FROM' => '#DEFAULT_EMAIL_FROM#',
        'EMAIL_TO' => $emailTo,
        'SUBJECT' => 'Заявка №#REQUEST_ID# с сайта #SITE_NAME#',
        'BODY_TYPE' => 'html',
        'MESSAGE' => '<p><b>Заявка №#REQUEST_ID#</b></p>'
            . '<p>Имя: #NAME#<br>Телефон: #PHONE#<br>Email: #EMAIL#<br>Как связаться: #CONTACT_WAY#</p>'
            . '<p>Номер заказа: #ORDER_NUMBER#</p>'
            . '#ITEMS#'
            . '<p>Вопрос менеджеру: #QUESTION#</p>'
            . '<p><a href="#ADMIN_LINK#">Открыть заявку в админке</a></p>',
    ]);
    if ($messageId) {
        $out("Почтовый шаблон {$eventName}: создан, ID {$messageId}, получатель {$emailTo}");
    } else {
        $out("Почтовый шаблон не создан: " . $em->LAST_ERROR);
    }
}

// ---- Итог --------------------------------------------------------------------

$out('');
$out("ИТОГ: инфоблок gg_requests ID {$iblockId}");
foreach ($propIds as $code => $id) {
    $out("  {$code}: {$id}");
}
