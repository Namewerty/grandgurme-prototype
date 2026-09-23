<?php
/**
 * Обвязка шаблона: данные, иконки и сборка шапки, панелей и подвала.
 *
 * ЧТО ЗДЕСЬ РИСУЕТСЯ НА СЕРВЕРЕ И ПОЧЕМУ ИМЕННО ЭТО.
 * Верхняя полоса, шапка, обе выпадающие панели, мобильное меню и подвал —
 * это карта сайта. Она обязана лежать в исходном html: её читает поисковик,
 * по ней ходят с клавиатуры, и она должна работать при выключенном JS.
 * Секции главной страницы при этом по-прежнему собирает скрипт — это
 * осознанный технический долг первого захода, см. README шаблона.
 *
 * Разметка здесь ПОВТОРЯЕТ разметку прототипа до класса: стили общие,
 * и любое расхождение сразу видно как сломанная вёрстка. Тексты и адреса
 * не переписаны руками, а приезжают из generated.php (сборка из src/data).
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();

/** Данные прототипа. Читаются один раз за хит. */
function gg(): array
{
    static $data = null;
    if ($data === null) {
        $data = include __DIR__ . '/generated.php';
    }
    return $data;
}

/**
 * Карта витрины: разделы сайта ← разделы инфоблока 4.
 *
 * Поверх карты накладываются тексты из админки (инфоблок «Разделы витрины»,
 * см. catalog-admin.php). Записи нет — карта работает как раньше, поэтому
 * разделы переводятся на админку по одному.
 */
function gg_map(): array
{
    static $map = null;
    if ($map === null) {
        $map = include __DIR__ . '/catalog-map.php';
        require_once __DIR__ . '/catalog-admin.php';
        $map = gg_map_apply_overrides($map);
    }
    return $map;
}

function gg_e($s): string
{
    return htmlspecialcharsbx((string)$s);
}

/**
 * Есть ли медиафайл на сервере — по манифесту mediaFiles из generated.php.
 *
 * На Битриксе отсутствующий файл уходит в urlrewrite.php и поднимает ядро CMS,
 * поэтому промах рисуется заглушкой без src. Список составляет
 * scripts/media-manifest.mjs, тот же список лежит в JS-бандле (media.js).
 * Адреса вне /media/ манифест не описывает — они считаются существующими.
 */
function gg_media_exists(string $src): bool
{
    if ($src === '') {
        return false;
    }
    $path = preg_split('/[?#]/', $src)[0];
    if (strncmp($path, '/media/', 7) !== 0) {
        return true;
    }
    return isset(gg()['mediaFiles'][$path]);
}

/**
 * Кадр для media.js: <span data-media>, если файл есть, и готовая заглушка,
 * если нет. Заглушка повторяет разметку markMissing из src/js/media.js —
 * без <img> и без src, так что запроса за файлом не будет вовсе.
 */
function gg_media_slot(string $slotClass, string $src, string $ratio, string $frameClass, string $alt): string
{
    if (gg_media_exists($src)) {
        return '<span class="' . gg_e($slotClass) . '" data-media="image"'
            . ' data-src="' . gg_e($src) . '" data-ratio="' . gg_e($ratio) . '"'
            . ' data-class="' . gg_e($frameClass) . '" data-alt="' . gg_e($alt) . '"></span>';
    }

    $file = basename(preg_split('/[?#]/', $src)[0]);
    $label = str_replace(['/', ' '], [':', ''], $ratio);

    return '<div class="media ' . gg_e($frameClass) . ' is-missing"'
        . ' style="--media-ratio: ' . gg_e(str_replace([':', '/'], ' / ', $label)) . '">'
        . '<span class="media__note">' . gg_e($file . ' · ' . $label) . '</span>'
        . '</div>';
}

/** Иконка из набора прототипа. Отсутствующий ключ — пустая строка, не ошибка. */
function gg_icon(string $key): string
{
    $icons = gg()['icons'] ?? [];
    return $icons[$key] ?? '';
}

/** Адрес раздела витрины. */
function gg_category_url(string $slug): string
{
    return '/catalog/' . $slug;
}

/** Адрес подкатегории: фильтр внутри страницы раздела, своего адреса нет. */
function gg_sub_url(string $categorySlug, string $subSlug): string
{
    return gg_category_url($categorySlug) . '?sub=' . rawurlencode($subSlug);
}

/** Кадр подкатегории в каталожной панели. */
function gg_nav_image(string $categorySlug, string $subSlug): string
{
    return '/media/nav/' . $categorySlug . '-' . $subSlug . '.jpg';
}

/** Панели, которые действительно поднимаются. Отсюда же берётся шеврон. */
function gg_has_panel($key): bool
{
    return $key === 'catalog' || $key === 'company';
}

/* -------------------------------------------------------------------------
   Живое дерево каталога.

   Названия и порядок берутся из карты витрины, а количество товаров —
   из инфоблока прямо сейчас. Раздел, в котором не осталось активных
   товаров, из панели уходит сам: обещать покупателю пустую страницу
   хуже, чем показать на одну строку меньше.
   ------------------------------------------------------------------------- */

/** ID раздела → число активных товаров в нём и его подразделах. */
function gg_section_counts(array $ids): array
{
    $counts = [];
    if (!$ids || !CModule::IncludeModule('iblock')) {
        return $counts;
    }

    $res = CIBlockSection::GetList(
        ['LEFT_MARGIN' => 'ASC'],
        [
            'IBLOCK_ID' => gg_map()['iblockId'],
            'ID' => $ids,
            'ACTIVE' => 'Y',
            'CNT_ACTIVE' => 'Y',
            'ELEMENT_SUBSECTIONS' => 'Y',
        ],
        true,
        ['ID', 'NAME', 'ELEMENT_CNT']
    );
    while ($row = $res->Fetch()) {
        $counts[(int)$row['ID']] = (int)$row['ELEMENT_CNT'];
    }
    return $counts;
}

/**
 * Дерево витрины с живыми количествами.
 *
 * Если модуль инфоблоков недоступен или запрос ничего не вернул, дерево
 * отдаётся как есть, без чисел: меню в шапке — не то место, где можно
 * позволить себе падение из-за каталога.
 */
function gg_catalog_tree(): array
{
    static $tree = null;
    if ($tree !== null) {
        return $tree;
    }

    $map = gg_map();
    /* Витрины («Икра») в дерево не идут: страница у них есть, а раздела
       каталога — нет. Каталог состоит из разделов, и панель, подвал, сетка
       на /catalog и карта разделов для поиска перечисляют именно их. */
    $map['categories'] = array_values(array_filter(
        $map['categories'],
        static fn(array $cat): bool => empty($cat['showcase'])
    ));
    $ids = [];
    foreach ($map['categories'] as $cat) {
        foreach ($cat['sections'] as $id) {
            $ids[] = (int)$id;
        }
        foreach ($cat['subs'] as $sub) {
            if (($sub['type'] ?? '') === 'section' && !empty($sub['section'])) {
                $ids[] = (int)$sub['section'];
            }
        }
    }
    $counts = gg_section_counts(array_values(array_unique($ids)));
    $known = !empty($counts);

    $tree = [];
    foreach ($map['categories'] as $cat) {
        $total = 0;
        foreach ($cat['sections'] as $id) {
            $total += $counts[(int)$id] ?? 0;
        }
        // Пустой раздел не показываем — но только если числа вообще известны.
        if ($known && $total === 0) {
            continue;
        }

        $subs = [];
        foreach ($cat['subs'] as $sub) {
            if (($sub['type'] ?? '') === 'section') {
                $cnt = $counts[(int)$sub['section']] ?? 0;
                if ($known && $cnt === 0) {
                    continue;
                }
                $sub['count'] = $cnt;
            } else {
                // Фасет: числа по нему сейчас нет, свойства ещё не сопоставлены.
                $sub['count'] = null;
            }
            $subs[] = $sub;
        }

        $cat['subs'] = array_slice($subs, 0, 8); // панель — витрина, а не полный список
        $cat['count'] = $total;
        $tree[] = $cat;
    }

    return $tree;
}

/* ------------------------------------------------------------ полоса */

function gg_topbar_link(array $item): string
{
    $ext = !empty($item['external']) ? ' target="_blank" rel="noopener"' : '';
    return '<a class="topbar__link" href="' . gg_e($item['href']) . '"' . $ext . '>' . gg_e($item['label']) . '</a>';
}

function gg_topbar_item(array $item): string
{
    if (empty($item['menu'])) {
        return gg_topbar_link($item);
    }

    $links = '';
    foreach ($item['menu'] as $sub) {
        $ext = !empty($sub['external']) ? ' target="_blank" rel="noopener"' : '';
        $links .= '<a class="topbar__pop-link" role="menuitem" href="' . gg_e($sub['href']) . '"' . $ext . '>' . gg_e($sub['label']) . '</a>';
    }

    return '<span class="topbar__menu" data-topbar-menu>'
        . '<a class="topbar__link topbar__link--menu" href="' . gg_e($item['href']) . '" aria-haspopup="menu" aria-expanded="false">'
        . gg_e($item['label'])
        . '<span class="topbar__caret" aria-hidden="true">' . gg_icon('chevronDown') . '</span></a>'
        . '<span class="topbar__pop" role="menu" hidden>' . $links . '</span>'
        . '</span>';
}

function gg_topbar(): void
{
    $topbar = gg()['topbar'];
    $sep = '<span class="topbar__sep" aria-hidden="true"></span>';

    $start = implode($sep, array_map('gg_topbar_link', $topbar['start']));
    $end = implode($sep, array_map('gg_topbar_item', $topbar['end']));
    ?>
    <div id="topbar" class="topbar">
      <div class="container">
        <div class="topbar__inner">
          <p class="topbar__item"><?= $start ?></p>
          <p class="topbar__item topbar__item--end"><?= $end ?></p>
        </div>
      </div>
    </div>
    <?php
}

/* ------------------------------------------------------------- шапка */

function gg_nav_link(array $item): string
{
    $opens = gg_has_panel($item['panel'] ?? null);
    $chevron = $opens ? '<span class="nav__chevron" aria-hidden="true">' . gg_icon('chevronDown') . '</span>' : '';
    $attr = $opens ? ' data-panel-trigger="' . gg_e($item['panel']) . '"' : '';
    $cls = 'nav__link' . ($opens ? ' nav__link--panel' : '');

    return '<a class="' . $cls . '" href="' . gg_e($item['href']) . '"' . $attr . '>' . gg_e($item['label']) . $chevron . '</a>';
}

function gg_action_link(array $item): string
{
    if (($item['action'] ?? '') === 'search') {
        return '<button class="search-btn" type="button" data-search-trigger aria-haspopup="dialog">'
            . '<span class="search-btn__icon" aria-hidden="true">' . gg_icon($item['key']) . '</span>'
            . '<span class="search-btn__text search-btn__text--full" aria-hidden="true">' . gg_e($item['field']) . '</span>'
            . '<span class="search-btn__text search-btn__text--short" aria-hidden="true">' . gg_e($item['short']) . '</span>'
            . '<span class="visually-hidden">' . gg_e($item['label']) . '</span>'
            . '</button>';
    }

    if (($item['key'] ?? '') === 'heart') {
        return gg_header_favorites_link($item);
    }
    if (($item['key'] ?? '') === 'user') {
        return gg_header_account_link($item);
    }

    return '<a class="icon-btn" href="' . gg_e($item['href']) . '">'
        . gg_icon($item['key'])
        . '<span class="visually-hidden">' . gg_e($item['label']) . '</span>'
        . '</a>';
}

/**
 * Сердце в шапке: счётчик того же вида, что у корзины, скрыт при нуле.
 * Разметка — из записки PERENOS-kabinet-i-izbrannoe.md, раздел 6: скрипт
 * в режиме ssr её не трогает, число считает сервер.
 */
function gg_header_favorites_link(array $item): string
{
    require_once __DIR__ . '/favorites.php';
    $n = gg_fav_count();
    $label = $n ? 'Избранное, товаров: ' . $n : 'Избранное';
    return '<a class="icon-btn fav-btn" href="/favorites/">'
        . gg_icon('heart')
        . '<span class="fav-btn__count" data-count="' . $n . '" aria-hidden="true">' . $n . '</span>'
        . '<span class="visually-hidden">' . gg_e($label) . '</span>'
        . '</a>';
}

/**
 * Человек в шапке. Гость — «Войти» на /account/login/. Вошедший — «Личный
 * кабинет», а если у него есть имя, вместо иконки круг с первой буквой.
 */
function gg_header_account_link(array $item): string
{
    require_once __DIR__ . '/account.php';
    $user = gg_account_user();
    if (!$user) {
        $request = \Bitrix\Main\Context::getCurrent()->getRequest();
        $path = (string)parse_url((string)$request->getRequestUri(), PHP_URL_PATH);
        // С самой страницы входа возврат не нужен; с остальных — на них же.
        $href = strncmp($path, '/account/login', 14) === 0 ? '/account/login/' : gg_login_url();
        return '<a class="icon-btn" href="' . gg_e($href) . '">'
            . gg_icon('user')
            . '<span class="visually-hidden">Войти</span>'
            . '</a>';
    }
    $name = $user['name'];
    if ($name === '') {
        return '<a class="icon-btn" href="/account/">'
            . gg_icon('user')
            . '<span class="visually-hidden">Личный кабинет</span>'
            . '</a>';
    }
    return '<a class="icon-btn is-user" href="/account/">'
        . '<span class="user-initial" aria-hidden="true">' . gg_e(mb_strtoupper(mb_substr($name, 0, 1))) . '</span>'
        . '<span class="visually-hidden">' . gg_e('Личный кабинет, ' . $name) . '</span>'
        . '</a>';
}

/** Ссылки входа и избранного в мобильном меню: текст по состоянию. */
function gg_nav_meta_item(array $item): array
{
    if (($item['key'] ?? '') === 'heart') {
        require_once __DIR__ . '/favorites.php';
        $n = gg_fav_count();
        return ['href' => '/favorites/', 'label' => $n ? 'Избранное · ' . $n : 'Избранное'];
    }
    if (($item['key'] ?? '') === 'user') {
        require_once __DIR__ . '/account.php';
        $user = gg_account_user();
        if (!$user) {
            return ['href' => '/account/login/', 'label' => 'Войти'];
        }
        return ['href' => '/account/', 'label' => $user['name'] !== '' ? $user['name'] . ' · кабинет' : 'Личный кабинет'];
    }
    return $item;
}

/**
 * Логотип. Над первым экраном он белый, дальше — тёмный; страница объявляет
 * наличие первого экрана константой GG_HERO до подключения шапки. Дальше
 * скрипт следит за этим сам (см. applyHeaderSkin в прототипе).
 */
function gg_logo(bool $hero): string
{
    $brand = gg()['brand'];
    $name = gg()['brandName'];
    $src = $hero ? $brand['logoWhite'] : $brand['logo'];
    $href = $hero ? '#hero' : '/';

    // Файла нет — вордмарк сразу, как делает createLogo в media.js при ошибке.
    $inner = gg_media_exists($src)
        ? '<img src="' . gg_e($src) . '" alt="' . gg_e($name['num'] . ' ' . $name['name']) . '">'
        : '<span class="wordmark"><span class="wordmark__num">' . gg_e($name['num']) . '</span><span>' . gg_e($name['name']) . '</span></span>';

    return '<a class="header__logo" href="' . gg_e($href) . '" aria-label="' . gg_e($name['num'] . ' ' . $name['name'] . ' — на главную') . '">'
        . $inner
        . '</a>';
}

/**
 * Число товаров в корзине. Считается на сервере, скриптом не подменяется.
 *
 * ШТУКИ, А НЕ СТРОКИ. Раньше считались строки корзины, и три банки одной
 * позиции давали в шапке единицу, тогда как сама корзина писала «Товаров 3».
 * Два числа про одно и то же на одном экране читаются как ошибка счёта.
 * Отложенные позиции в счёт не идут: их в заказе нет.
 *
 * ЗАЯВКА ТОЖЕ СЧИТАЕТСЯ (16.09.2026): её позиции лежат на той же странице
 * корзины, только в cookie, а не в sale.basket (include/requests.php).
 */
function gg_cart_count(): int
{
    if (!CModule::IncludeModule('sale')) {
        return 0;
    }
    try {
        $basket = \Bitrix\Sale\Basket::loadItemsForFUser(
            \Bitrix\Sale\Fuser::getId(),
            \Bitrix\Main\Context::getCurrent()->getSite()
        );
        $count = 0;
        foreach ($basket as $item) {
            if ($item->isDelay()) {
                continue;
            }
            $count += (int)$item->getQuantity();
        }
        require_once __DIR__ . '/requests.php';
        return $count + gg_request_count();
    } catch (\Throwable $e) {
        return 0;
    }
}

function gg_header(bool $hero): void
{
    $d = gg();
    $count = gg_cart_count();
    ?>
    <div class="container">
      <div class="header__inner">
        <div class="header__side header__side--start">
          <button class="icon-btn burger" type="button" aria-expanded="false" aria-controls="nav-panel">
            <span class="burger__box" aria-hidden="true"></span>
            <span class="visually-hidden">Открыть меню</span>
          </button>

          <a class="catalog-btn" href="<?= gg_e($d['navCatalog']['href']) ?>" data-panel-trigger="<?= gg_e($d['navCatalog']['panel']) ?>">
            <span class="catalog-btn__icon" aria-hidden="true"><?= gg_icon('menuLines') ?></span>
            <span class="catalog-btn__label"><?= gg_e($d['navCatalog']['label']) ?></span>
            <span class="catalog-btn__chevron" aria-hidden="true"><?= gg_icon('chevronDown') ?></span>
          </a>

          <nav class="nav" aria-label="Разделы">
            <?= implode('', array_map('gg_nav_link', $d['navPrimary'])) ?>
          </nav>
        </div>

        <?= gg_logo($hero) ?>

        <div class="header__side header__side--end">
          <nav class="nav" aria-label="О компании">
            <?= implode('', array_map('gg_nav_link', $d['navSecondary'])) ?>
          </nav>

          <div class="header__actions">
            <?= implode('', array_map('gg_action_link', $d['navActions'])) ?>
            <a class="icon-btn cart-btn" href="<?= gg_e($d['cart']['href']) ?>">
              <?= gg_icon('cart') ?>
              <span class="cart-btn__count" data-count="<?= $count ?>"><?= $count ?></span>
              <span class="visually-hidden">Корзина, товаров: <?= $count ?></span>
            </a>
          </div>
        </div>
      </div>
    </div>
    <?php
}

/* ------------------------------------------------- каталожная панель */

function gg_catalog_panel(): void
{
    $map = gg_map();
    $tree = gg_catalog_tree();
    $default = $map['default'];
    ?>
    <div class="megapanel megapanel--catalog" id="megapanel-catalog" data-panel="catalog"
         data-default="<?= gg_e($default) ?>" aria-hidden="true">
      <div class="megapanel__scroll">
        <div class="container">
          <div class="megapanel__inner">

            <nav class="megapanel__cats" aria-label="Категории каталога">
              <?php foreach ($tree as $cat): ?>
                <a class="megacat<?= $cat['slug'] === $default ? ' is-active' : '' ?>"
                   href="<?= gg_e(gg_category_url($cat['slug'])) ?>"
                   data-cat="<?= gg_e($cat['slug']) ?>" aria-controls="pane-<?= gg_e($cat['slug']) ?>">
                  <span class="megacat__name"><?= gg_e($cat['name']) ?></span>
                </a>
              <?php endforeach; ?>
            </nav>

            <div class="megapanel__panes">
              <?php foreach ($tree as $cat): ?>
                <section class="megapane<?= $cat['slug'] === $default ? ' is-active' : '' ?>"
                         id="pane-<?= gg_e($cat['slug']) ?>" data-pane="<?= gg_e($cat['slug']) ?>"
                         aria-label="<?= gg_e($cat['name']) ?>">
                  <?php if ($cat['subs']): ?>
                    <ul class="megagrid">
                      <?php foreach ($cat['subs'] as $sub): ?>
                        <li class="megagrid__cell">
                          <a class="navcard" href="<?= gg_e(gg_sub_url($cat['slug'], $sub['slug'])) ?>">
                            <?= gg_media_slot(
                                'navcard__media',
                                gg_nav_image($cat['slug'], $sub['slug']),
                                '4:3',
                                'navcard__frame',
                                $cat['name'] . ' — ' . $sub['name']
                            ) ?>
                            <span class="navcard__name"><?= gg_e($sub['name']) ?></span>
                          </a>
                        </li>
                      <?php endforeach; ?>
                    </ul>
                  <?php else: ?>
                    <p class="megapane__lead"><?= gg_e($cat['lead']) ?></p>
                  <?php endif; ?>
                  <a class="megapane__all" href="<?= gg_e(gg_category_url($cat['slug'])) ?>">
                    Все товары раздела «<?= gg_e($cat['name']) ?>»
                  </a>
                </section>
              <?php endforeach; ?>
            </div>

            <aside class="megapanel__promo" aria-label="Подборки">
              <?php foreach ($map['collections'] as $c): ?>
                <a class="promocard" href="<?= gg_e($c['href']) ?>">
                  <?= gg_media_slot('promocard__media', $c['image'], $c['ratio'], 'promocard__frame', $c['title']) ?>
                  <span class="promocard__title"><?= gg_e($c['title']) ?></span>
                  <span class="promocard__text"><?= gg_e($c['text']) ?></span>
                </a>
              <?php endforeach; ?>
            </aside>

          </div>

          <div class="megapanel__foot">
            <a class="megapanel__all" href="/catalog">
              Открыть весь каталог
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/></svg>
            </a>
            <p class="megapanel__quick">
              <a href="/catalog/chernaya-ikra">Чёрная икра</a>
              <a href="/gifts">Подарки</a>
            </p>
          </div>
        </div>
      </div>
    </div>
    <?php
}

/* --------------------------------------------------- панель «Компания» */

function gg_company_panel(): void
{
    $panel = gg()['companyPanel'];
    $feature = $panel['feature'] ?? null;
    ?>
    <div class="megapanel megapanel--company" id="megapanel-company" data-panel="company" aria-hidden="true">
      <div class="megapanel__scroll">
        <div class="container">
          <div class="infopanel">
            <?php foreach ($panel['columns'] as $col): ?>
              <div class="infocol">
                <h3 class="infocol__title eyebrow"><?= gg_e($col['title']) ?></h3>
                <ul class="infocol__list">
                  <?php foreach ($col['links'] as $l): ?>
                    <li><a class="infocol__link" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a></li>
                  <?php endforeach; ?>
                </ul>
              </div>
            <?php endforeach; ?>

            <?php if ($feature): ?>
              <aside class="infofeature" aria-label="<?= gg_e($feature['title']) ?>">
                <a class="infofeature__link" href="<?= gg_e($feature['action']['href']) ?>">
                  <?= gg_media_slot(
                      'infofeature__media',
                      $feature['image']['src'],
                      $feature['image']['ratio'],
                      'infofeature__frame',
                      $feature['image']['alt']
                  ) ?>
                  <span class="infofeature__title"><?= gg_e($feature['title']) ?></span>
                  <span class="infofeature__text"><?= gg_e($feature['text']) ?></span>
                  <span class="infofeature__action">
                    <?= gg_e($feature['action']['label']) ?>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5"/></svg>
                  </span>
                </a>
              </aside>
            <?php endif; ?>
          </div>
        </div>
      </div>
    </div>
    <?php
}

/* ------------------------------------------------- мобильное меню */

function gg_nav_panel(): void
{
    $d = gg();
    $links = array_merge([$d['navCatalog']], $d['navPrimary']);
    $meta = [];
    foreach ($d['topbar']['start'] as $i) {
        $meta[] = $i;
    }
    foreach ($d['navActions'] as $i) {
        if (($i['action'] ?? '') !== 'search') {
            $meta[] = gg_nav_meta_item($i);
        }
    }
    foreach ($d['topbar']['end'] as $i) {
        foreach ($i['menu'] ?? [$i] as $sub) {
            $meta[] = $sub;
        }
    }
    ?>
    <div id="nav-panel" class="nav-panel" aria-hidden="true">
      <div class="container">
        <div class="nav-panel__head">
          <span class="wordmark">
            <span class="wordmark__num"><?= gg_e($d['brandName']['num']) ?></span><span><?= gg_e($d['brandName']['name']) ?></span>
          </span>
          <button class="icon-btn" type="button" data-nav-close>
            <?= gg_icon('close') ?>
            <span class="visually-hidden">Закрыть меню</span>
          </button>
        </div>

        <div class="nav-panel__body">
          <nav class="nav-panel__list" aria-label="Разделы">
            <?php foreach ($links as $l): ?>
              <a class="nav-panel__link" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a>
            <?php endforeach; ?>
          </nav>

          <nav class="nav-panel__cols" aria-label="Информация">
            <?php foreach ($d['companyPanel']['columns'] as $col): ?>
              <div class="nav-panel__col">
                <h2 class="nav-panel__col-title eyebrow"><?= gg_e($col['title']) ?></h2>
                <?php foreach ($col['links'] as $l): ?>
                  <a class="nav-panel__sublink" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a>
                <?php endforeach; ?>
              </div>
            <?php endforeach; ?>
          </nav>

          <div class="nav-panel__meta">
            <?php foreach ($meta as $l): ?>
              <a href="<?= gg_e($l['href']) ?>"<?= !empty($l['external']) ? ' target="_blank" rel="noopener"' : '' ?>><?= gg_e($l['label']) ?></a>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
    </div>
    <?php
}

/* ------------------------------------------------------------- подвал */

function gg_footer(): void
{
    $d = gg();

    // Каталожная колонка собирается из живого дерева, а не пишется руками:
    // иначе в подвале появятся ссылки на разделы, которых уже нет.
    $catalogLinks = [];
    foreach (gg_catalog_tree() as $cat) {
        $catalogLinks[] = ['label' => $cat['name'], 'href' => gg_category_url($cat['slug'])];
    }
    $catalogLinks[] = ['label' => 'Подарки', 'href' => '/gifts'];
    $catalogLinks[] = ['label' => 'Весь каталог', 'href' => '/catalog'];

    $columns = array_merge(
        [['title' => 'Каталог', 'links' => $catalogLinks]],
        $d['footerColumns']
    );
    ?>
    <div class="container">
      <div class="footer__inner">
        <div class="footer__lead">
          <div class="footer__brand">
            <span class="wordmark">
              <span class="wordmark__num"><?= gg_e($d['brandName']['num']) ?></span><span><?= gg_e($d['brandName']['name']) ?></span>
            </span>
            <p class="footer__tagline"><?= gg_e($d['footerTagline']) ?></p>
          </div>

          <div class="footer__aside">
            <div class="footer__social">
              <?php foreach ($d['socials'] as $s): ?>
                <a class="icon-btn" href="<?= gg_e($s['href']) ?>" target="_blank" rel="noopener">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><?= $s['icon'] ?></svg>
                  <span class="visually-hidden"><?= gg_e($s['label']) ?></span>
                </a>
              <?php endforeach; ?>
            </div>
            <div class="pay">
              <?php foreach ($d['payments'] as $p): ?>
                <span class="pay__badge"><?= gg_e($p) ?></span>
              <?php endforeach; ?>
            </div>
          </div>
        </div>

        <div class="footer__top">
          <?php foreach ($columns as $col): ?>
            <div class="footer__col">
              <h2 class="footer__col-title"><?= gg_e($col['title']) ?></h2>
              <?php foreach ($col['links'] as $l): ?>
                <a class="footer__link" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a>
              <?php endforeach; ?>
            </div>
          <?php endforeach; ?>

          <div class="footer__col">
            <h2 class="footer__col-title"><?= gg_e($d['footerContacts']['title']) ?></h2>
            <?php foreach ($d['footerContacts']['items'] as $l): ?>
              <a class="footer__link" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="footer__bottom">
          <p><?= gg_e($d['legal']['copyright'] . ', ' . date('Y')) ?> · <?= gg_e($d['legal']['disclaimer']) ?></p>
          <div class="footer__legal">
            <?php foreach ($d['legal']['links'] as $l): ?>
              <a class="footer__link" href="<?= gg_e($l['href']) ?>"><?= gg_e($l['label']) ?></a>
            <?php endforeach; ?>
            <button class="theme-toggle" type="button" data-theme-toggle aria-live="polite">
              <span class="theme-toggle__dot" aria-hidden="true"></span>
              <span data-theme-label>Тема: Светлая</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <?php
}

/** Кольцо прогресса. Заполнение и подпись поднимает scroll.js. */
function gg_progress_ring(): void
{
    ?>
    <div id="progress-ring" class="progress-ring" aria-hidden="true">
      <span class="progress-ring__dial">
        <svg class="progress-ring__svg" viewBox="0 0 44 44">
          <circle class="progress-ring__track" cx="22" cy="22" r="20"></circle>
          <circle class="progress-ring__bar" cx="22" cy="22" r="20"></circle>
        </svg>
        <span class="progress-ring__num">01</span>
      </span>
      <span class="progress-ring__label"></span>
    </div>
    <?php
}

/** Версия ассета из времени файла: правка доезжает без ручного сброса кеша. */
function gg_asset(string $rel): string
{
    $path = SITE_TEMPLATE_PATH . $rel;
    $file = $_SERVER['DOCUMENT_ROOT'] . $path;
    $v = is_file($file) ? filemtime($file) : time();
    return $path . '?v=' . $v;
}
