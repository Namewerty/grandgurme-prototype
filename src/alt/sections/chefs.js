/* ============================================================================
   #chefs — «Ресторанам и отелям». Светлая, не полноэкранная.
   Только в альтернативной версии. ЧЕРНОВИК НА ВЫБРОС.

   Место в порядке: сразу после #proof, перед #shop. Почему именно там —
   в src/alt/data/chefs.js.

   ФОН СВЕТЛЫЙ. Тёмная секция сразу после тёмного #proof слепила бы два
   разворота в один.

   ⚠ ПОБОЧНЫЙ ЭФФЕКТ, КОТОРЫЙ ПРИДЁТСЯ РЕШАТЬ ПРИ ПЕРЕНОСЕ: ритм фонов
   меняется. Светлых секций между #proof и подвалом становится шесть против
   четырёх до #proof, и тёмный разворот перестаёт делить страницу пополам.
   В альтернативе принимаем как есть.

   Раскладка — разворот на две колонки: слева текст и две ссылки, справа кадр
   и три факта строками с волосяными разделителями. Сетка, а не карточки:
   блок объясняет одну мысль, и дробить её на плитки нечем.

   Анимация — общий data-reveal плюс прочерчивание волосяных линий слева
   направо, как в #why. Ничего нового не изобретаем.
   ============================================================================ */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { chefsCopy, chefsFacts, chefsMedia } from '../data/chefs.js'

gsap.registerPlugin(ScrollTrigger)

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* --------------------------------------------------------------- разметка */

export function buildChefs(item) {
  const section = document.createElement('section')
  section.id = item.id
  section.className = 'section chefs'
  section.setAttribute('data-reveal-section', '')
  section.setAttribute('aria-labelledby', `${item.id}-title`)

  const facts = chefsFacts
    .map(
      (text) => `
      <li class="chefs__fact">
        <span class="chefs__rule" aria-hidden="true"></span>
        <span class="chefs__fact-text">${text}</span>
      </li>`,
    )
    .join('')

  section.innerHTML = `
    <div class="section__layer">
      <div class="container">
        <div class="chefs__grid">
          <div class="chefs__text">
            <p class="eyebrow" data-reveal>${chefsCopy.eyebrow}</p>
            <h2 id="${item.id}-title" class="chefs__title" data-reveal>${chefsCopy.title}</h2>

            <p class="t-lead" data-reveal>${chefsCopy.business}</p>
            <p class="t-lead" data-reveal>${chefsCopy.home}</p>

            <p class="chefs__actions" data-reveal>
              <a class="btn" href="${chefsCopy.action.href}">${chefsCopy.action.label}</a>
              <a class="chefs__secondary" href="${chefsCopy.secondary.href}">${chefsCopy.secondary.label}</a>
            </p>
          </div>

          <div class="chefs__aside" data-reveal>
            <div data-media="image" data-class="chefs__media" data-src="${chefsMedia.src}"
                 data-ratio="${chefsMedia.ratio}" data-alt="${chefsMedia.alt}"></div>

            <ul class="chefs__facts" data-chefs-facts>
              ${facts}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `

  return section
}

/* ------------------------------------------------------------------- init */

/**
 * Волосяные линии трёх фактов прочерчиваются слева направо каскадом, когда
 * блок вошёл в кадр. Тот же приём и та же линия, что у строк в #why.
 *
 * Предсостояние ставится здесь, а не в CSS: у линии, спрятанной классом,
 * не было бы задержки между соседями, и все три появлялись бы разом.
 * При prefers-reduced-motion не трогаем их вовсе — линии сразу целые.
 */
export function initChefs() {
  const section = document.querySelector('#chefs')
  const rules = section?.querySelectorAll('.chefs__rule')
  if (!rules?.length || REDUCED) return

  gsap.set(rules, { scaleX: 0, transformOrigin: 'left center' })

  ScrollTrigger.create({
    trigger: section,
    start: 'top 82%',
    once: true,
    onEnter: () => {
      gsap.to(rules, {
        scaleX: 1,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.09,
        delay: 0.2,
        // Инлайновый transform снимаем: иначе он остаётся на линии
        // и мешает ей пересчитаться при смене ширины окна.
        onComplete: () => gsap.set(rules, { clearProps: 'transform' }),
      })
    },
  })
}
