<?php
/**
 * Шаблон «№1 Гранд Гурмэ». Верх страницы.
 *
 * Порядок в <head> значим: сначала кодировка и viewport, затем ShowHead()
 * Битрикса (его meta, css и скрипты), затем инлайн-скрипт темы — он обязан
 * отработать до первой отрисовки, иначе тёмная тема мигает белым.
 *
 * Страница объявляет наличие первого экрана до подключения шапки:
 *     define('GG_HERO', true);
 *     require($_SERVER['DOCUMENT_ROOT'].'/bitrix/header.php');
 * От этого зависят цвет логотипа и прозрачность шапки над hero.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();
/** @var CMain $APPLICATION */

require_once __DIR__ . '/include/fn.php';

/* Сердце — обычная форма на любой странице с карточками: обработать её надо
   до того, как пойдёт разметка (include/favorites.php). Ответ — редирект
   на ту же страницу или JSON для скрипта. */
require_once __DIR__ . '/include/favorites.php';
gg_fav_handle_post();

$ggHero = defined('GG_HERO') && GG_HERO === true;
?><!doctype html>
<html lang="<?= LANGUAGE_ID ?>" data-theme="light">
<head>
  <meta charset="<?= LANG_CHARSET ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
<?php /* Иконки нет на сервере — пустая data:-ссылка. Без <link> браузер сам
         пойдёт за /favicon.ico, и промах снова поднимет ядро CMS. */ ?>
<?php if (gg_media_exists('/media/brand/favicon.svg')): ?>
  <link rel="icon" href="/media/brand/favicon.svg" type="image/svg+xml">
<?php else: ?>
  <link rel="icon" href="data:,">
<?php endif; ?>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Prata&display=swap">

  <link rel="stylesheet" href="<?= gg_asset('/assets/css/app.css') ?>">

<?php $APPLICATION->ShowHead(); ?>
  <?php /* Поле кода без скрипта: цифры видны в самом поле, ячейки прячутся.
           Со скриптом ячейки заполняет src/bitrix/account-hydrate.js. */ ?>
  <noscript><style>.code-input__field{color:inherit;caret-color:auto}.code-input__cells{visibility:hidden}</style></noscript>
  <title><?php $APPLICATION->ShowTitle(); ?></title>

  <script>
    /* Флаги до первой отрисовки: тема — чтобы не мигала, is-animated —
       чтобы reveal-элементы не показывались и не прятались рывком. */
    (function () {
      var root = document.documentElement
      root.classList.add('js')
      try {
        var saved = localStorage.getItem('gg-theme')
        if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved)
      } catch (e) { /* приватный режим — остаёмся на светлой */ }
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('is-animated')
    })()
  </script>
</head>
<body>
<?php $APPLICATION->ShowPanel(); ?>

<a class="skip-link" href="#main">Перейти к содержанию</a>

<?php gg_topbar(); ?>

<header id="masthead" class="header<?= $ggHero ? '' : ' is-solid' ?>" data-header>
  <?php gg_header($ggHero); ?>
  <?php gg_catalog_panel(); ?>
  <?php gg_company_panel(); ?>
</header>

<?php gg_nav_panel(); ?>

<?php /* Класс страницы объявляет сама страница до подключения шапки:
         define('GG_PAGE_CLASS', 'page-catalog'). Ровно эти классы ставит
         скрипт в прототипе, и раскладка внутренних страниц держится на них. */ ?>
<main id="main"<?= defined('GG_PAGE_CLASS') ? ' class="' . gg_e(GG_PAGE_CLASS) . '"' : '' ?><?= defined('GG_SECTIONS') && GG_SECTIONS === true ? ' data-gg-sections' : '' ?>>
