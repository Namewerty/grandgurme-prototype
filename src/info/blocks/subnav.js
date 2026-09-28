/* ============================================================================
   subnav — оглавление длинной страницы. Строка капсул-якорей под первым
   экраном, липнет под шапкой. Активная капсула — секция, которая пересекла
   верхнюю треть экрана. На узкой раскладке — лента с прокруткой без полосы,
   активная капсула прокручивается в видимую часть.
   Переход по якорю — Lenis, с отступом на шапку и саму строку.
   ============================================================================ */

import { esc, section } from './_html.js'
import { ScrollTrigger, scrollToEl } from './_motion.js'

export function buildSubnav(d) {
  return section(
    'subnav',
    { ...d, title: null },
    `
    <div class="container">
      <nav class="ib-subnav__nav" aria-label="${esc(d.label)}">
        <ul class="ib-subnav__list">
          ${d.items
            .map(
              (item) => `
            <li><a class="ib-subnav__link" href="${esc(item.href)}" data-subnav-link>${esc(item.label)}</a></li>`,
            )
            .join('')}
        </ul>
      </nav>
    </div>`,
    { reveal: false },
  )
}

export function initSubnav(root) {
  const list = root.querySelector('.ib-subnav__list')
  const links = [...root.querySelectorAll('[data-subnav-link]')]
  const targets = links.map((link) => document.querySelector(link.getAttribute('href')))

  let current = -1
  const setActive = (index) => {
    current = index
    links.forEach((link, i) => {
      const on = i === index
      link.classList.toggle('is-active', on)
      if (on) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    })
    const link = links[index]
    if (!link || list.scrollWidth <= list.clientWidth) return
    // Лента: активная капсула — в видимую часть, без прокрутки страницы.
    const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2
    list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }

  targets.forEach((target, i) => {
    if (!target) return
    // Секция держит капсулу, пока её блок (и следующие блоки той же главы
    // до следующей цели) пересекает верхнюю треть экрана.
    const next = targets.slice(i + 1).find(Boolean)
    ScrollTrigger.create({
      trigger: target,
      start: 'top 33%',
      endTrigger: next || document.querySelector('#main'),
      end: next ? 'top 33%' : 'bottom 33%',
      // Ушли из своей главы, а соседняя не включилась (прыжок к началу
      // страницы или в подвал) — активной капсулы нет.
      onToggle: (self) => {
        if (self.isActive) setActive(i)
        else if (current === i) setActive(-1)
      },
    })
  })

  links.forEach((link, i) => {
    link.addEventListener('click', (event) => {
      if (!targets[i]) return
      event.preventDefault()
      event.stopPropagation()
      history.replaceState(history.state, '', link.getAttribute('href'))
      scrollToEl(targets[i])
    })
  })
}
