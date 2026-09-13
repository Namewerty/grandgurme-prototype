<?php
/**
 * Постраничная навигация каталога.
 *
 * Своих классов здесь два (.pager и .pager__link), остальное — капсулы
 * прототипа: страница каталога уже говорит капсулами, и заводить для
 * переключателя страниц третий язык незачем.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) die();
/** @var array $arResult */

if ((int)$arResult['NavPageCount'] < 2) {
    return;
}

$query = $arResult['NavQueryString'] !== '' ? $arResult['NavQueryString'] . '&' : '';
$base = $arResult['sUrlPath'] . '?' . $query . 'PAGEN_' . (int)$arResult['NavNum'] . '=';
$current = (int)$arResult['NavPageNomer'];
$count = (int)$arResult['NavPageCount'];
?>
<nav class="pager" aria-label="Страницы каталога">
<?php if ($current > 1): ?>
  <a class="chip pager__link" rel="prev" href="<?= htmlspecialcharsbx($base . ($current - 1)) ?>">Назад</a>
<?php endif; ?>
<?php for ($page = 1; $page <= $count; $page++): ?>
<?php if ($page === $current): ?>
  <span class="chip is-active" aria-current="page"><?= $page ?></span>
<?php else: ?>
  <a class="chip pager__link" href="<?= htmlspecialcharsbx($base . $page) ?>"><?= $page ?></a>
<?php endif; ?>
<?php endfor; ?>
<?php if ($current < $count): ?>
  <a class="chip pager__link" rel="next" href="<?= htmlspecialcharsbx($base . ($current + 1)) ?>">Вперёд</a>
<?php endif; ?>
</nav>
