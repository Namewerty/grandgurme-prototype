/* ============================================================================
   Переключатель версий главной. ЧЕРНОВИК НА ВЫБРОС.

   Зачем: на показе не набирать адреса руками.

   ЖИВЁТ ТОЛЬКО НА ЧЕРНОВИКАХ (/alt, /alt2). Основную главную не трогаем —
   значит, и кнопки там нет. Обратный переход делает браузерная «назад»
   или адресная строка.

   ⚠ ПРО УГОЛ. В задании сказано «правый нижний угол занят кольцом прогресса
   и виджетом эксперта — поэтому левый». По коду это не так: кольцо стоит
   в ЛЕВОМ нижнем (src/styles/components/progress-ring.css), виджет эксперта —
   в правом (components/expert.css). Заняты оба угла, и свободного нижнего
   угла на странице нет вовсе.

   Поэтому капсула стоит в левом нижнем, но НАД кольцом, а не рядом с ним:
   отступ снизу отсчитан от высоты кольца (44px) плюс зазор. Правый угол
   не годится совсем — виджет эксперта раскрывает оттуда панель, а на
   мобильном она разворачивается во всю ширину экрана.

   Формально это отступление от буквы задания; по сути — единственный способ
   выполнить требование «ни на что не наезжает».

   /alt2 (23.09.2026). Вторая альтернативная главная — витрина разделов,
   характер икры и происхождение (src/alt2/). Капсула та же и живёт на обоих
   черновиках, /alt и /alt2: у /alt2 свои стили, поэтому правила капсулы
   повторены в src/alt2/alt2.css. На основной главной капсулы по-прежнему нет.
   ============================================================================ */

import { ROUTES } from '../data/routes.js'

/* short — подпись уже 768px. С тремя полными подписями капсула на 375px
   занимает 322px и правым краем упирается в виджет эксперта; короткие
   подписи держат её в левой половине экрана. Полная — в aria-label. */
const VERSIONS = [
  { label: 'Основная', short: 'Основная', href: ROUTES.home },
  { label: 'Альтернативная', short: 'Альт.', href: '/alt' },
  { label: 'Альтернативная 2', short: 'Альт. 2', href: '/alt2' },
]

/** Адреса, на которых капсула показывается. */
const SHOWN_ON = ['/alt', '/alt2']

const NARROW = window.matchMedia('(max-width: 767px)')

/** Текущий адрес без хвостового слеша — им помечаем активную ссылку. */
const here = () => location.pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1')

export function initAltSwitch() {
  const at = here()

  // Страховка от переиспользования: на основной главной капсулы быть не должно.
  if (!SHOWN_ON.includes(at)) return

  const box = document.createElement('nav')
  box.className = 'alt-switch'
  box.setAttribute('aria-label', 'Версия страницы')

  box.innerHTML = VERSIONS.map(({ label, href }) => {
    const current = href === at
    return `<a class="alt-switch__link${current ? ' is-current' : ''}" href="${href}" aria-label="${label}"${
      current ? ' aria-current="page"' : ''
    }>${label}</a>`
  }).join('')

  const links = [...box.querySelectorAll('.alt-switch__link')]
  const relabel = () => {
    links.forEach((link, i) => {
      link.textContent = NARROW.matches ? VERSIONS[i].short : VERSIONS[i].label
    })
  }
  relabel()
  NARROW.addEventListener?.('change', relabel)

  document.body.appendChild(box)
}
