<?php
/**
 * Промах по статике в /media/ не должен поднимать ядро Битрикса.
 *
 * Веб-сервер уводит несуществующий файл в bitrix/urlrewrite.php, и каждая
 * отсутствующая картинка превращается в полноценный хит: её считает
 * «Контроль активности» и блокирует IP на 300 секунд, она попадает
 * в статистику посещаемости и на неё тратится целая отрисовка страницы.
 * Здесь запрос обрывается настоящим 404 до того, как подключатся модули.
 *
 * Убрать, когда в конфиге nginx появится честный 404 для статики.
 */
$ggPath = parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
if (
	is_string($ggPath)
	&& strpos($ggPath, '/media/') === 0
	&& strpos($ggPath, '..') === false
	&& preg_match('~\.(jpe?g|png|gif|svg|webp|avif|ico|mp4|webm|mov|m4v)$~i', $ggPath)
	&& !file_exists($_SERVER['DOCUMENT_ROOT'].rawurldecode($ggPath))
) {
	header('HTTP/1.1 404 Not Found');
	header('Content-Type: text/plain; charset=utf-8');
	echo '404 Not Found';
	die();
}
