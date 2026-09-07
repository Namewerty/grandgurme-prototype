/* ============================================================================
   Разметка кольца прогресса. Логика заполнения и подписи — в scroll.js.

   Кольцо 44px, r = 20, тонкий золотой stroke, внутри номер текущей остановки.
   Справа мелкой строкой — её название. Живёт в левом нижнем углу: правый
   занят виджетом эксперта.

   aria-hidden: это дублирующий индикатор, положение в документе скринридер
   и так знает по заголовкам секций.
   ============================================================================ */

export function renderProgressRing(mount) {
  if (!mount) return

  mount.className = 'progress-ring'
  mount.setAttribute('aria-hidden', 'true')
  mount.innerHTML = `
    <span class="progress-ring__dial">
      <svg class="progress-ring__svg" viewBox="0 0 44 44">
        <circle class="progress-ring__track" cx="22" cy="22" r="20"></circle>
        <circle class="progress-ring__bar" cx="22" cy="22" r="20"></circle>
      </svg>
      <span class="progress-ring__num">01</span>
    </span>
    <span class="progress-ring__label"></span>
  `
}
