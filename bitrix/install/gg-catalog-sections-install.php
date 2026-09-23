// =============================================================================
// Тексты разделов витрины в админке: инфоблок «Разделы витрины».
//
// КАК ЗАПУСКАТЬ. Настройки → Инструменты → Командная PHP-строка. Вставить
// содержимое файла целиком (строки <?php в нём нет намеренно) и «Выполнить».
// На сервер файл не заливается и в архив не входит.
//
// ИДЕМПОТЕНТНЫЙ. Повторный запуск ничего не дублирует и НЕ ПЕРЕЗАПИСЫВАЕТ
// тексты: запись, заведённая раньше, остаётся как есть вместе с правками,
// сделанными в админке. Создаётся только то, чего нет.
//
// ЧТО СОЗДАЁТ:
//   - инфоблок gg_catalog_sections «Разделы витрины» в типе gg_service;
//   - свойства LEAD, SEO_TITLE, SEO_DESC;
//   - запись «Бакалея и консервы» (код bakaleya) с текстами прототипа.
//
// КАК ЭТО РАБОТАЕТ НА САЙТЕ. include/catalog-admin.php читает инфоблок по
// коду и накладывает тексты на карту витрины. Раздел без записи работает
// по карте, как раньше, поэтому переводить разделы можно по одному.
//
// Удаление — gg-catalog-sections-uninstall.php рядом.
// ИЛИ ПО SSH: npm run stand:php -- bitrix/install/gg-catalog-sections-install.php --mode=<режим>
// =============================================================================

$mode = 'check'; // check | install

if (!CModule::IncludeModule('iblock')) {
    echo "Модуль iblock не подключён — остановлено\n";
    return;
}

$out = static function (string $line): void {
    echo $line . "\n";
};
$dry = $mode !== 'install';
$out($dry ? 'РЕЖИМ ПРОВЕРКИ: ничего не создаётся, только показываю, что будет.' : 'РЕЖИМ УСТАНОВКИ.');

// ---- 1. Тип инфоблоков (уже есть от заявок, но проверим) --------------------

$typeId = 'gg_service';
if (CIBlockType::GetByID($typeId)->Fetch()) {
    $out("Тип инфоблоков {$typeId}: уже есть");
} elseif ($dry) {
    $out("Тип инфоблоков {$typeId}: будет создан");
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

$code = 'gg_catalog_sections';
$iblock = CIBlock::GetList([], ['TYPE' => $typeId, 'CODE' => $code, 'CHECK_PERMISSIONS' => 'N'])->Fetch();
$iblockId = $iblock ? (int)$iblock['ID'] : 0;

if ($iblockId) {
    $out("Инфоблок {$code}: уже есть, ID {$iblockId}");
} elseif ($dry) {
    $out("Инфоблок {$code} «Разделы витрины»: будет создан");
} else {
    $ib = new CIBlock();
    $iblockId = (int)$ib->Add([
        'IBLOCK_TYPE_ID' => $typeId,
        'LID' => ['s1'],
        'CODE' => $code,
        'API_CODE' => 'GgCatalogSections',
        'NAME' => 'Разделы витрины',
        'ACTIVE' => 'Y',
        'SORT' => 200,
        // В поиск не отдаём: это тексты страниц каталога, а не самостоятельные
        // материалы, и в выдаче поиска по сайту им делать нечего.
        'INDEX_ELEMENT' => 'N',
        'INDEX_SECTION' => 'N',
        'WORKFLOW' => 'N',
        'BIZPROC' => 'N',
        'VERSION' => 2,
        'LIST_PAGE_URL' => '',
        'DETAIL_PAGE_URL' => '',
        'SECTION_PAGE_URL' => '',
        // Группа 2 — «Все пользователи (в том числе неавторизованные)»: нет
        // доступа. Сайт читает инфоблок с CHECK_PERMISSIONS => N.
        'GROUP_ID' => ['2' => 'D'],
        'ELEMENTS_NAME' => 'Разделы',
        'ELEMENT_NAME' => 'Раздел',
        'ELEMENT_ADD' => 'Добавить раздел',
        'ELEMENT_EDIT' => 'Изменить раздел',
        'ELEMENT_DELETE' => 'Удалить раздел',
        'DESCRIPTION' => 'Тексты разделов каталога: название на витрине, лид под заголовком и SEO. '
            . 'Код элемента — слаг раздела из адреса /catalog/&lt;слаг&gt;. '
            . 'Раздела здесь нет — сайт берёт тексты из карты витрины в коде.',
        'DESCRIPTION_TYPE' => 'html',
    ]);
    if (!$iblockId) {
        $out('Инфоблок не создан: ' . $ib->LAST_ERROR);
        return;
    }
    $out("Инфоблок {$code} «Разделы витрины»: создан, ID {$iblockId}");
}

// ---- 3. Свойства ------------------------------------------------------------

$properties = [
    [
        'CODE' => 'LEAD',
        'NAME' => 'Лид под заголовком',
        'PROPERTY_TYPE' => 'S',
        'ROW_COUNT' => 3,
        'COL_COUNT' => 60,
        'SORT' => 100,
        'HINT' => 'Строка под названием раздела. Пусто — берётся текст из карты витрины.',
    ],
    [
        'CODE' => 'SEO_TITLE',
        'NAME' => 'Заголовок окна браузера',
        'PROPERTY_TYPE' => 'S',
        'ROW_COUNT' => 2,
        'COL_COUNT' => 60,
        'SORT' => 110,
        'HINT' => 'Пусто — собирается само: «Название — купить в №1 Гранд Гурмэ».',
    ],
    [
        'CODE' => 'SEO_DESC',
        'NAME' => 'Описание для поиска',
        'PROPERTY_TYPE' => 'S',
        'ROW_COUNT' => 3,
        'COL_COUNT' => 60,
        'SORT' => 120,
        'HINT' => 'Пусто — берётся лид.',
    ],
];

foreach ($properties as $prop) {
    if (!$iblockId) {
        $out("  свойство {$prop['CODE']}: будет создано вместе с инфоблоком");
        continue;
    }
    $exists = CIBlockProperty::GetList([], ['IBLOCK_ID' => $iblockId, 'CODE' => $prop['CODE']])->Fetch();
    if ($exists) {
        $out("  свойство {$prop['CODE']}: уже есть");
        continue;
    }
    if ($dry) {
        $out("  свойство {$prop['CODE']} «{$prop['NAME']}»: будет создано");
        continue;
    }
    $obj = new CIBlockProperty();
    $id = $obj->Add($prop + [
        'IBLOCK_ID' => $iblockId,
        'ACTIVE' => 'Y',
        'MULTIPLE' => 'N',
        'IS_REQUIRED' => 'N',
    ]);
    $out($id
        ? "  свойство {$prop['CODE']}: создано"
        : "  свойство {$prop['CODE']}: ОШИБКА — " . $obj->LAST_ERROR);
}

// ---- 4. Запись раздела ------------------------------------------------------
//
// Тексты — из прототипа (src/data/catalog.js): на стенде раздел назывался
// «Бакалея и консервация» словами 1С, в прототипе — «Бакалея и консервы».
// Пилот показывает именно это: название витрины отвязано от учётного.

$element = [
    'CODE' => 'bakaleya',
    'NAME' => 'Бакалея и консервы',
    'LEAD' => 'Масла, соусы и специи, мёд и варенье, оливки, каперсы, консервы — '
        . 'то, что стоит рядом с деликатесом.',
    'SEO_TITLE' => '',
    'SEO_DESC' => '',
];

if (!$iblockId) {
    $out("Запись «{$element['NAME']}» (код {$element['CODE']}): будет создана вместе с инфоблоком");
} else {
    $exists = CIBlockElement::GetList(
        [],
        ['IBLOCK_ID' => $iblockId, 'CODE' => $element['CODE'], 'CHECK_PERMISSIONS' => 'N'],
        false,
        false,
        ['ID', 'NAME']
    )->Fetch();

    if ($exists) {
        $out("Запись {$element['CODE']}: уже есть, ID {$exists['ID']} («{$exists['NAME']}») — не трогаю");
    } elseif ($dry) {
        $out("Запись «{$element['NAME']}» (код {$element['CODE']}): будет создана");
    } else {
        $el = new CIBlockElement();
        $id = $el->Add([
            'IBLOCK_ID' => $iblockId,
            'CODE' => $element['CODE'],
            'NAME' => $element['NAME'],
            'ACTIVE' => 'Y',
            'SORT' => 100,
            'PROPERTY_VALUES' => [
                'LEAD' => $element['LEAD'],
                'SEO_TITLE' => $element['SEO_TITLE'],
                'SEO_DESC' => $element['SEO_DESC'],
            ],
        ]);
        $out($id
            ? "Запись «{$element['NAME']}»: создана, ID {$id}"
            : 'Запись не создана: ' . $el->LAST_ERROR);
    }
}

// ---- 5. Кеш -----------------------------------------------------------------

if (!$dry && $iblockId) {
    Bitrix\Main\Application::getInstance()->getTaggedCache()->clearByTag('iblock_id_' . $iblockId);
    $out('Кеш раздела витрины сброшен.');
    $out('Проверить: https://bitrix.grandgurme.ru/catalog/bakaleya — заголовок «Бакалея и консервы».');
}

if ($dry) {
    $out('');
    $out("Если всё верно — поменять первую строку на \$mode = 'install' и выполнить ещё раз.");
}
