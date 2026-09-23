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

/**
 * Лист ожидания: письмо о поступлении. Зовёт агент раз в час
 * (bitrix/install/gg-waitlist-install.php).
 *
 * ЧТО ДЕЛАЕТ. По записям gg_waitlist, у которых ещё нет NOTIFIED_AT, смотрит
 * живой остаток и цену товара. Позиция появилась на складе и её можно купить —
 * уходит письмо GG_WAITLIST_ARRIVED, и в записи ставится NOTIFIED_AT: письмо
 * отправляется один раз. Сама запись остаётся в листе, пока человек её не
 * уберёт, — на странице она станет «Поступил».
 *
 * ПОЧТЫ НЕТ — ПИСЬМА НЕТ. У покупателя, вошедшего по номеру телефона, почта
 * не спрашивается. Тогда NOTIFIED_AT не ставится (вдруг почту допишут
 * в профиле), а запись просто показывается на странице как «Поступил».
 *
 * СМС ЗДЕСЬ ЖЕ. Когда в модуле «Служба сообщений» появится провайдер, СМС
 * отправляется рядом с CEvent::Send — отдельного места для этого не нужно.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: текст письма (шаблон GG_WAITLIST_ARRIVED)
 * и текст будущей СМС.
 */
function GGWaitlistNotify()
{
	$agent = 'GGWaitlistNotify();';
	$conn = \Bitrix\Main\Application::getConnection();
	if (!$conn->isTableExists('gg_waitlist')) {
		return $agent;
	}
	if (!CModule::IncludeModule('iblock') || !CModule::IncludeModule('catalog')) {
		return $agent;
	}

	$rows = $conn->query('SELECT ID, USER_ID, PRODUCT_ID FROM gg_waitlist WHERE NOTIFIED_AT IS NULL LIMIT 500')->fetchAll();
	if (!$rows) {
		return $agent;
	}

	$productIds = array_values(array_unique(array_map(static fn($r) => (int)$r['PRODUCT_ID'], $rows)));

	/* Остаток и доступность к покупке — одним запросом на всех. */
	$stock = [];
	$res = \Bitrix\Catalog\ProductTable::getList([
		'filter' => ['@ID' => $productIds],
		'select' => ['ID', 'QUANTITY', 'AVAILABLE'],
	]);
	while ($row = $res->fetch()) {
		$stock[(int)$row['ID']] = (float)$row['QUANTITY'] > 0 && ($row['AVAILABLE'] ?? 'N') === 'Y';
	}

	/* Название и символьный код — для письма. Только активные товары. */
	$names = [];
	$res = CIBlockElement::GetList([], ['ID' => $productIds, 'ACTIVE' => 'Y'], false, false, ['ID', 'NAME', 'CODE', 'PREVIEW_TEXT']);
	while ($row = $res->Fetch()) {
		$print = trim((string)$row['PREVIEW_TEXT']);
		$names[(int)$row['ID']] = [
			'name' => $print !== '' && strpos($print, '<') === false ? $print : (string)$row['NAME'],
			'code' => (string)$row['CODE'],
		];
	}

	$site = 's1';
	$host = (string)\Bitrix\Main\Config\Option::get('main', 'server_name', 'bitrix.grandgurme.ru');
	$sent = 0;

	foreach ($rows as $row) {
		$productId = (int)$row['PRODUCT_ID'];
		if (empty($stock[$productId]) || !isset($names[$productId])) {
			continue;
		}
		$user = CUser::GetByID((int)$row['USER_ID'])->Fetch();
		$email = trim((string)($user['EMAIL'] ?? ''));
		if ($email === '' || strpos($email, '@') === false) {
			continue; // почты нет — письма нет, запись остаётся ждать
		}

		CEvent::Send('GG_WAITLIST_ARRIVED', $site, [
			'EMAIL_TO' => $email,
			'USER_NAME' => trim((string)($user['NAME'] ?? '')) !== '' ? $user['NAME'] : 'покупатель',
			'PRODUCT_NAME' => $names[$productId]['name'],
			'PRODUCT_URL' => 'https://' . $host . '/product/' . $names[$productId]['code'],
			'CATALOG_URL' => 'https://' . $host . '/catalog',
		]);
		$conn->queryExecute("UPDATE gg_waitlist SET NOTIFIED_AT = '" . date('Y-m-d H:i:s') . "' WHERE ID = " . (int)$row['ID']);
		$sent++;
	}

	if ($sent > 0) {
		AddMessage2Log('Лист ожидания: отправлено писем о поступлении — ' . $sent, 'gg');
	}
	return $agent;
}
