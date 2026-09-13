<?php
/**
 * Шаблон «№1 Гранд Гурмэ». Низ страницы.
 *
 * Скрипт подключается модулем и в самом конце: он поднимает скролл-движок
 * по готовым размерам и оживляет уже отрисованную сервером разметку.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();
/** @var CMain $APPLICATION */
?>
</main>

<footer id="site-footer" class="footer section--dark">
  <?php gg_footer(); ?>
</footer>

<?php gg_progress_ring(); ?>
<div id="expert-widget"></div>

<noscript>
  <p style="padding:2rem;font-family:system-ui">
    Часть страницы (секции главной и анимации) собирается скриптом.
    Каталог, меню и подвал работают и без него.
  </p>
</noscript>

<script type="module" src="<?= gg_asset('/assets/js/app.js') ?>"></script>
</body>
</html>
