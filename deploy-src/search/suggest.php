<?php
/**
 * Подсказки поиска в шапке: /search/suggest.php?q=…, ответ — JSON.
 *
 * Страница без шаблона: только ядро и функции поиска. Скрипт шапки
 * (src/js/nav/search.js) зовёт её с задержкой после ввода.
 *
 * NO_KEEP_STATISTIC: запрос подсказки — не просмотр страницы. Без этого
 * каждый набранный символ считался бы хитом «Контроля активности», а он
 * блокирует IP после 200 хитов за 10 секунд.
 */
define('NO_KEEP_STATISTIC', true);
define('NO_AGENT_STATISTIC', true);
define('NO_AGENT_CHECK', true);
define('STOP_STATISTICS', true);

require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_before.php';
require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/templates/grandgurme/include/search.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, max-age=60');

echo json_encode(gg_search_suggest((string)($_GET['q'] ?? '')), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

require $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/epilog_after.php';
