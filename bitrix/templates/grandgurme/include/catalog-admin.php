<?php
/**
 * ТЕКСТЫ РАЗДЕЛА ВИТРИНЫ ИЗ АДМИНКИ. Пилот на «Бакалее», 23.09.2026.
 *
 * ЗАЧЕМ. Название и лид раздела живут в карте витрины (catalog-map.php),
 * то есть в коде: чтобы поправить строку под заголовком, нужен разработчик,
 * сборка и заливка архива. Здесь появляется второй источник — инфоблок
 * «Разделы витрины» (gg_catalog_sections). Если для слага заведена запись,
 * её тексты перекрывают карту; если записи нет, всё работает ровно как
 * раньше. Поэтому переводить разделы можно по одному, а не все сразу.
 *
 * ЧТО ПЕРЕКРЫВАЕТСЯ: название (оно же в крошках, в мега-панели, в подвале,
 * в поиске и в блоке «Не только икра» на главной — источник один, gg_map),
 * лид под заголовком, заголовок окна браузера и описание для поиска.
 *
 * ЧТО НЕ ПЕРЕКРЫВАЕТСЯ И ОСТАЁТСЯ В КАРТЕ: какие разделы 1С входят в раздел
 * витрины, подразделы, оси фильтра и предзаказ. Это сопоставление с учётом
 * и справочниками 1С: ошибка в нём даёт пустую выдачу, а не кривой текст,
 * и место ему в коде рядом с объяснением, почему сделано именно так.
 *
 * КЕШ. Чтение кешируется на сутки и помечено тегом инфоблока: сохранение
 * записи в админке сбрасывает кеш само, ждать нечего. Права не проверяются
 * (CHECK_PERMISSIONS => N) — инфоблок служебный и закрыт от посетителей,
 * а тексты из него нужны всем.
 *
 * ОТКАТ. Снять галочку активности у записи или удалить её: страница сразу
 * возвращается к тексту из карты. Инфоблок целиком убирает
 * bitrix/install/gg-catalog-sections-uninstall.php.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

/** Код инфоблока с текстами разделов витрины. ID нигде не зашит. */
const GG_CATALOG_SECTIONS_CODE = 'gg_catalog_sections';

/**
 * Записи из админки: слаг => тексты. Пустой массив — инфоблока нет,
 * и это нормальное состояние для всех разделов, кроме переведённых.
 *
 * @return array{iblockId:int, items:array<string, array{id:int, name:string, lead:string, seoTitle:string, seoDesc:string}>}
 */
function gg_catalog_admin(): array
{
    static $data = null;
    if ($data !== null) {
        return $data;
    }

    $empty = ['iblockId' => 0, 'items' => []];

    if (!CModule::IncludeModule('iblock')) {
        $data = $empty;
        return $data;
    }

    $cacheDir = '/gg/catalog-sections';
    $cache = Bitrix\Main\Data\Cache::createInstance();

    if ($cache->initCache(86400, 'gg_catalog_sections_v1', $cacheDir)) {
        $vars = $cache->getVars();
        $data = is_array($vars) && isset($vars['items']) ? $vars : $empty;
        return $data;
    }

    $tagged = Bitrix\Main\Application::getInstance()->getTaggedCache();
    $cache->startDataCache();
    $tagged->startTagCache($cacheDir);

    $data = $empty;

    $iblock = CIBlock::GetList([], [
        'TYPE' => 'gg_service',
        'CODE' => GG_CATALOG_SECTIONS_CODE,
        'CHECK_PERMISSIONS' => 'N',
    ])->Fetch();

    if ($iblock) {
        $iblockId = (int)$iblock['ID'];
        $data['iblockId'] = $iblockId;
        $tagged->registerTag('iblock_id_' . $iblockId);

        $rows = CIBlockElement::GetList(
            ['SORT' => 'ASC', 'ID' => 'ASC'],
            ['IBLOCK_ID' => $iblockId, 'ACTIVE' => 'Y', 'CHECK_PERMISSIONS' => 'N'],
            false,
            false,
            ['ID', 'NAME', 'CODE', 'PROPERTY_LEAD', 'PROPERTY_SEO_TITLE', 'PROPERTY_SEO_DESC']
        );
        while ($row = $rows->Fetch()) {
            $slug = trim((string)$row['CODE']);
            if ($slug === '') {
                continue;
            }
            $data['items'][$slug] = [
                'id' => (int)$row['ID'],
                'name' => trim((string)$row['NAME']),
                'lead' => trim((string)$row['PROPERTY_LEAD_VALUE']),
                'seoTitle' => trim((string)$row['PROPERTY_SEO_TITLE_VALUE']),
                'seoDesc' => trim((string)$row['PROPERTY_SEO_DESC_VALUE']),
            ];
        }
    }

    $tagged->endTagCache();
    $cache->endDataCache($data);

    return $data;
}

/**
 * Накладывает тексты из админки на карту витрины.
 *
 * Пустое поле записи ничего не перекрывает: пустой лид в админке означает
 * «здесь я ничего не писал», а не «убрать строку». Убрать строку — это
 * правка карты, и делается она осознанно.
 */
function gg_map_apply_overrides(array $map): array
{
    $admin = gg_catalog_admin();
    if (!$admin['items']) {
        return $map;
    }

    foreach ($map['categories'] as &$cat) {
        $item = $admin['items'][$cat['slug']] ?? null;
        if (!$item) {
            continue;
        }
        if ($item['name'] !== '') {
            $cat['name'] = $item['name'];
        }
        if ($item['lead'] !== '') {
            $cat['lead'] = $item['lead'];
        }
        $cat['seoTitle'] = $item['seoTitle'];
        $cat['seoDesc'] = $item['seoDesc'];
        /* По нему страница рисует кнопку «Изменить» в режиме правки. */
        $cat['adminId'] = $item['id'];
    }
    unset($cat);

    return $map;
}

/**
 * Область правки для заголовка раздела: в режиме правки при наведении
 * появляется кнопка «Изменить тексты раздела» и ведёт на форму элемента.
 *
 * Возвращает id области или пустую строку — тогда страница рисуется как
 * обычно, без единого лишнего атрибута.
 */
function gg_catalog_admin_edit_area(array $cat): string
{
    global $APPLICATION;

    if (empty($cat['adminId']) || !$APPLICATION->GetShowIncludeAreas()) {
        return '';
    }

    $admin = gg_catalog_admin();
    if (!$admin['iblockId']) {
        return '';
    }

    $buttons = CIBlock::GetPanelButtons(
        $admin['iblockId'],
        (int)$cat['adminId'],
        0,
        ['SECTION_BUTTONS' => false, 'SESSID' => false]
    );
    $url = $buttons['edit']['edit_element']['ACTION_URL'] ?? '';
    if ($url === '') {
        return '';
    }

    /* ССЫЛКА КНОПКИ — ДИАЛОГ, А НЕ ПЕРЕХОД (23.09.2026). С голым адресом
       формы вкладка целиком уезжала на iblock_element_edit.php: форма без
       стилей сайта, без кнопок диалога, пользоваться нечем. Битрикс ждёт
       здесь javascript:-ссылку на BX.CAdminDialog — ровно так собирает свои
       кнопки CBitrixComponent::AddEditAction и панель включаемых областей
       (bitrix/modules/main/classes/general/main.php). */
    $areaId = 'bx_gg_cat_' . preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$cat['slug']);
    $APPLICATION->SetEditArea($areaId, [[
        'URL' => 'javascript:' . $APPLICATION->GetPopupLink([
            'URL' => $url,
            'PARAMS' => ['width' => 780, 'height' => 500],
        ]),
        'TITLE' => 'Изменить тексты раздела',
        'ICON' => 'bx-context-toolbar-edit-icon',
        'DEFAULT' => true,
    ]]);

    return $areaId;
}
