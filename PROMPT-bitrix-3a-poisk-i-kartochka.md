# Стенд Битрикса: поиск, название для печати, вес и артикул — дополнение к этапам 0 и 2

Дополнение к `PROMPT-bitrix-3-zakaz-i-zayavka.md`. Этапы, правила и проверки
оттуда остаются в силе; меняются этап 0 (таблица сверки), этап 2 (архив
и проверки карточек) и откат. Код — коммит «Битрикс: живой поиск, название
для печати, вес и артикул как на grandgurme.ru» поверх `82132be`.

## Что добавилось и что поменялось против PROMPT-bitrix-3

- **Поиск.** Подсказки в шапке и страница `/search/` ищут по товарам витрины
  на сервере (`include/search.php`, `/search/suggest.php`). Демо-страница
  `/search/index.php` с `bitrix:search.page` заменена страницей в разметке
  каталога. Поиск понимает формы слов («икра белуги»), недописанное слово
  («икра бел»), артикул и код 1С.
- **Витрина как на grandgurme.ru.** В сетке каталога, поиске и подсказках —
  название, вес и цена, больше ничего. Подписи «Упаковка» и «Артикул» под
  названием в сетке убраны. У весового товара (единица «кг») — «100 г»
  и цена за 100 г.
- **Карточка:** над названием мелко «Артикул …», под названием вес. Строки
  «Вид рыбы · Линейка», капсул «Фасовка» и блока «Характеристики» больше нет.
  Метка вида, кнопки и обещания — как в PROMPT-bitrix-3. «Хранение» — только
  у чёрной икры.
- **Название для печати** (поле «ПолноеНаименование» 1С → «Описание для
  анонса») — везде вместо рабочего наименования. Рабочее — запасное, для
  20 позиций с браком в 1С.
- **Корзина, заявка, «Заказ принят»:** под названием вес. У весового товара
  «1 кг»: корзина Битрикса считает килограммами, цена строки — за килограмм.

## Этап 0 — вместо сниппета и таблицы из PROMPT-bitrix-3

```php
$root = $_SERVER['DOCUMENT_ROOT'];
$files = [
    '/bitrix/templates/grandgurme/assets/css/app.css' => ['a9c2652ca622482cad4174d56e9e3fc8', '461532b1349b2f9b855697958b2054c2', '4cb0e53784dbbcbb73db089995b0dce7'],
    '/bitrix/templates/grandgurme/assets/js/app.js' => ['48fb317df24ab597faf71516412ea8a5', '848e4da395a34967e99e065e308f36b2', 'b1beec0eba2090985b2b26f697c630a3'],
    '/bitrix/templates/grandgurme/include/generated.php' => ['daf6a27559361e3853c7caa348f7b6e9', '9bd7f0ad010bf4f20764313ec2e0a2b9', '6ca16c4a493d2b4ffea50bec182ca443'],
    '/bitrix/templates/grandgurme/include/catalog.php' => ['a9f631798e32c534c26c5d6f8199511e', '6667933a769f12f16dfea445c09cc11c', '44f8ac55224574f8ab88720b2076ec14'],
    '/bitrix/templates/grandgurme/include/catalog-map.php' => ['47414ec5ace1e4e093da8f4274a36f38', '0ee8aaf9ba33957dcf6ba48271dcc4ce', '0ee8aaf9ba33957dcf6ba48271dcc4ce'],
    '/bitrix/templates/grandgurme/include/cart.php' => ['6b84d0119ecc80da2d177829516cbfd5', '395c6f962c1b16e2f500db8b63d25268', 'c160427ecf84b03093d0b6abeae105b4'],
    '/bitrix/templates/grandgurme/include/checkout.php' => ['1b7035f1bee19a5f2c30421db1c17ed6', '08d16e224779fb3375701a807e8455fa', '08d16e224779fb3375701a807e8455fa'],
    '/bitrix/templates/grandgurme/include/requests.php' => ['', '75baeb54d130a5571db3707fd8cde38a', '59ca2ac485bedc050892aead896bbe50'],
    '/bitrix/templates/grandgurme/include/fn.php' => ['cbd57cfd8ab16562a558655c3af88170', '3d9990268b9104f6be8c3d94183050da', '3d9990268b9104f6be8c3d94183050da'],
    '/bitrix/templates/grandgurme/include/search.php' => ['', '', '94f822bd920bd76e13eec949ea8fa453'],
    '/bitrix/templates/grandgurme/include/product-info.php' => ['', '', '0f53062843430cfa998a730887ff2e80'],
    '/bitrix/templates/grandgurme/components/bitrix/catalog.section/gg/template.php' => ['856f4e35654fd5e46c4bccc1dcd87077', 'e48b7d7df5419767583da1072c44c24c', '992fefb9f0cb000b7204e9d1ad084fab'],
    '/bitrix/templates/grandgurme/components/bitrix/catalog.element/gg/template.php' => ['aef72617ab4e196bc0721d5ae77a3d72', '6969fb380ce2efd52d911b26880af692', '9e70c95d65970bf7b594eb012dfe19ff'],
    '/cart/index.php' => ['3c84fa8a5ae17142ad5c542e5faeb916', '288cf4216518a71cd03beb2a3a1ea608', '288cf4216518a71cd03beb2a3a1ea608'],
    '/checkout/index.php' => ['e69e229e6cbb9f67e499d11bf1fc6480', 'b193e56b6a898b7be963d6036eb09deb', 'b193e56b6a898b7be963d6036eb09deb'],
    '/order-success/index.php' => ['2f83ec18906e3b9c34806976dd8881cd', '8c3f894c1980d055fe2b0352abc2e5ae', '192b20d93ea4a390d88bc50747fcedb4'],
    '/delivery/index.php' => ['8ee4a2fe96ec90155e1891bff9424488', '52502d570264eaedb39b8462d84f5854', '52502d570264eaedb39b8462d84f5854'],
    '/product/index.php' => ['186a4c1c22d71061b1e7e46022efa613', '73c0f5007fad826042900255c0db88a1', '561d9582755e1ed4f20ec1b3ae843473'],
    '/search/index.php' => ['7df8d3026f558dfb597703e641bc1228', '', 'c481190dcfa93944ccc70466795f08ec'],
    '/search/suggest.php' => ['', '', '476038e57f4d368398f92992dad0e5c2'],
];
foreach ($files as $path => [$old, $mid, $new]) {
    $f = $root . $path;
    if (!is_file($f)) {
        echo ($old === '' ? 'НЕТ ФАЙЛА (новый, ок)' : 'НЕТ ФАЙЛА (!)') . "  $path\n";
        continue;
    }
    $md5 = md5(str_replace("\r\n", "\n", file_get_contents($f)));
    $state = $md5 === $old ? 'c6f918c' : ($md5 === $new ? 'УЖЕ ЗАЛИТ' : ($mid !== '' && $md5 === $mid ? 'ЗАЛИТ ZAKAZ' : 'РАСХОДИТСЯ'));
    echo str_pad($state, 12) . "  $md5  $path\n";
}
```

| Путь на сервере | md5 `c6f918c` | md5 архива `…-zakaz.zip` | md5 нового архива |
|---|---|---|---|
| `/bitrix/templates/grandgurme/assets/css/app.css` | `a9c2652ca622482cad4174d56e9e3fc8` | `461532b1349b2f9b855697958b2054c2` | `4cb0e53784dbbcbb73db089995b0dce7` |
| `/bitrix/templates/grandgurme/assets/js/app.js` | `48fb317df24ab597faf71516412ea8a5` | `848e4da395a34967e99e065e308f36b2` | `b1beec0eba2090985b2b26f697c630a3` |
| `/bitrix/templates/grandgurme/include/generated.php` | `daf6a27559361e3853c7caa348f7b6e9` | `9bd7f0ad010bf4f20764313ec2e0a2b9` | `6ca16c4a493d2b4ffea50bec182ca443` |
| `/bitrix/templates/grandgurme/include/catalog.php` | `a9f631798e32c534c26c5d6f8199511e` | `6667933a769f12f16dfea445c09cc11c` | `44f8ac55224574f8ab88720b2076ec14` |
| `/bitrix/templates/grandgurme/include/catalog-map.php` | `47414ec5ace1e4e093da8f4274a36f38` | `0ee8aaf9ba33957dcf6ba48271dcc4ce` | `0ee8aaf9ba33957dcf6ba48271dcc4ce` |
| `/bitrix/templates/grandgurme/include/cart.php` | `6b84d0119ecc80da2d177829516cbfd5` | `395c6f962c1b16e2f500db8b63d25268` | `c160427ecf84b03093d0b6abeae105b4` |
| `/bitrix/templates/grandgurme/include/checkout.php` | `1b7035f1bee19a5f2c30421db1c17ed6` | `08d16e224779fb3375701a807e8455fa` | `08d16e224779fb3375701a807e8455fa` |
| `/bitrix/templates/grandgurme/include/requests.php` | — | `75baeb54d130a5571db3707fd8cde38a` | `59ca2ac485bedc050892aead896bbe50` |
| `/bitrix/templates/grandgurme/include/fn.php` | `cbd57cfd8ab16562a558655c3af88170` | `3d9990268b9104f6be8c3d94183050da` | `3d9990268b9104f6be8c3d94183050da` |
| `/bitrix/templates/grandgurme/include/search.php` | — | — | `94f822bd920bd76e13eec949ea8fa453` |
| `/bitrix/templates/grandgurme/include/product-info.php` | — | — | `0f53062843430cfa998a730887ff2e80` |
| `/bitrix/templates/grandgurme/components/bitrix/catalog.section/gg/template.php` | `856f4e35654fd5e46c4bccc1dcd87077` | `e48b7d7df5419767583da1072c44c24c` | `992fefb9f0cb000b7204e9d1ad084fab` |
| `/bitrix/templates/grandgurme/components/bitrix/catalog.element/gg/template.php` | `aef72617ab4e196bc0721d5ae77a3d72` | `6969fb380ce2efd52d911b26880af692` | `9e70c95d65970bf7b594eb012dfe19ff` |
| `/cart/index.php` | `3c84fa8a5ae17142ad5c542e5faeb916` | `288cf4216518a71cd03beb2a3a1ea608` | `288cf4216518a71cd03beb2a3a1ea608` |
| `/checkout/index.php` | `e69e229e6cbb9f67e499d11bf1fc6480` | `b193e56b6a898b7be963d6036eb09deb` | `b193e56b6a898b7be963d6036eb09deb` |
| `/order-success/index.php` | `2f83ec18906e3b9c34806976dd8881cd` | `8c3f894c1980d055fe2b0352abc2e5ae` | `192b20d93ea4a390d88bc50747fcedb4` |
| `/delivery/index.php` | `8ee4a2fe96ec90155e1891bff9424488` | `52502d570264eaedb39b8462d84f5854` | `52502d570264eaedb39b8462d84f5854` |
| `/product/index.php` | `186a4c1c22d71061b1e7e46022efa613` | `73c0f5007fad826042900255c0db88a1` | `561d9582755e1ed4f20ec1b3ae843473` |
| `/search/index.php` | `7df8d3026f558dfb597703e641bc1228` | — | `c481190dcfa93944ccc70466795f08ec` |
| `/search/suggest.php` | — | — | `476038e57f4d368398f92992dad0e5c2` |

- `c6f918c`, `ЗАЛИТ ZAKAZ` и `УЖЕ ЗАЛИТ` — можно заливать новый архив.
- `РАСХОДИТСЯ` — стоп, как в PROMPT-bitrix-3.
- Для `/search/index.php` значение `c6f918c` означает демо-страницу
  `bitrix:search.page`, которая стояла на стенде до 16.09.

## Этап 2 — архив и проверки

Залить **`grandgurme-bitrix-build-2026-09-16-zakaz-poisk.zip`** вместо
`…-zakaz.zip`. Новых файлов четыре: `include/requests.php`,
`include/search.php`, `include/product-info.php`, `/search/suggest.php`;
`/search/index.php` заменяет демо-страницу. Сбросить кеш сайта.

Проверки раздела и карточек из PROMPT-bitrix-3 остаются, с поправками
ниже: в сетке и карточке больше нет упаковки, линейки и капсул фасовки.

- **Сетка `/catalog/chernaya-ikra`:** у каждой карточки название, под ним вес
  («50 г», «113 г»), цена и, если не в наличии, метка вида. Ни упаковки, ни
  артикула под названием. **`/catalog/ryba?stock=all`:** у позиций с единицей
  «кг» — «100 г» и цена в десять раз меньше цены 1С за килограмм (на 16.09
  «Лосось филе холодного копчения классическое (пласт)» — 1 190 ₽).
  **`/catalog/bakaleya`:** у позиций без веса в данных строки веса нет вовсе.
- **Карточки** (адреса сняты со стенда 16.09):
  - `/product/ikra_chyernaya_osyetr_premium_sturgeon_banka_metall_50_g` —
    над названием «Артикул GGCVBL031», под названием «50 г», цена 7 990 ₽;
    так же на grandgurme.ru;
  - `/product/sig_tushka_g_k_vakuum_fas` — заголовок «Сиг горячего копчения»
    (рабочее наименование «Сиг Тушка г/к Вакуум фас.»), «Артикул GGRBSG002»,
    «100 г»;
  - `/product/chay_chyernyy_baykhovyy_nina_s_paris_vendome_breakfast_klassika_100_g` —
    заголовок полный (в названии для печати там одно слово «Чай»), «100 г»,
    блока «Хранение» нет;
  - нигде нет блока «Характеристики», строки «Вид рыбы · Линейка»
    и капсул «Фасовка».
- **Подсказки в шапке.** На любой странице открыть поиск, набрать «икра бел»:
  в панели чёрная икра с белугой — название, вес, цена; раздел «Чёрная икра»;
  «Показать все результаты» с числом. Строки ведут на существующие карточки.
  В сетевой вкладке запросы к `/search/suggest.php` идут не чаще чем раз
  в 250 мс набора и отвечают JSON.
- **Запросы:** «икра белуги» (~26), «осетровая икра» (~20), «сиг горячего
  копчения», «GGCVBL004» (одна позиция — Белуга РОЯЛ 125 г),
  «00-00000034» (клыкач). Числа — на 16.09, остатки и состав живые.
- **`/search/?q=икра белуги`:** страница в дизайне каталога, счётчик, строка
  разделов, карточки как в сетке; `/search/?q=фывапро` — «Ничего не нашлось»
  с популярными запросами; `/search/` без запроса — «Что ищем?».
- **Корзина** (этап 3 PROMPT-bitrix-3): под названием позиции вес; у рыбы
  с единицей «кг» — «1 кг» и цена за килограмм.
- Консоль без ошибок на `/search/`, карточке и главной с открытым поиском.

## Откат

`grandgurme-bitrix-rollback-2026-09-16.zip` (из PROMPT-bitrix-3), затем
`grandgurme-bitrix-rollback-poisk-2026-09-16.zip` (в нём демо-страница
`/search/index.php`), и удалить четыре новых файла: `include/requests.php`,
`include/search.php`, `include/product-info.php`, `/search/suggest.php`.
