/* ============================================================================
   form — заявка. Поля из данных: text | tel | email | number | date |
   textarea | select | chips. Оформление — общий form.css (.field*, .check*).
   Чипы — капсулы с множественным выбором (role="group", aria-pressed);
   single: true — один выбор. Внизу согласие со ссылками на /consent
   и /privacy: без него отправка не проходит.

   Скрытые поля: form (ключ формы), page (адрес), utm_source, utm_medium,
   utm_campaign, utm_content, utm_term из адреса страницы, segment
   (/partners: ?segment= и выбор «Тип заведения»).

   ОТПРАВКА В ПРОТОТИПЕ. Обязательные поля проверяются с подписью ошибки
   под полем, затем на месте формы — «Заявка отправлена» (success из данных).
   Никуда не отправляется: собранные поля — console.info одной строкой.
   На Битриксе заявка пишется в инфоблок «Заявки с сайта» с полем «Форма»
   и уходит письмом, как заявка менеджеру из корзины (gg_requests), —
   PERENOS-info-stranicy.md.

   Рядом с формой — колонка «Или напишите сами»: телефон, Telegram,
   WhatsApp, почта из contacts (src/data/nav.js).
   ============================================================================ */

import { esc, ext, head, inline, section } from './_html.js'
import { icons } from '../../js/icons.js'
import { reduced, scrollToEl } from './_motion.js'

const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']

const optionOf = (o) => (typeof o === 'string' ? { value: o, label: o } : o)

function field(f, d) {
  const id = `${d.form}-${f.name}`
  const opt = f.required ? '' : ` <span class="field__optional">· ${esc(d.ui.optional)}</span>`
  const err = `<p class="field__error" id="${id}-error" data-error hidden></p>`
  const req = f.required ? ' required aria-required="true"' : ''
  const auto = f.autocomplete ? ` autocomplete="${esc(f.autocomplete)}"` : ''

  if (f.type === 'chips') {
    return `
      <div class="field field--wide ib-form__chips" data-field="${esc(f.name)}">
        <p class="field__label" id="${id}-label">${esc(f.label)}${opt}</p>
        <div class="ib-chips" role="group" aria-labelledby="${id}-label" data-chips="${esc(f.name)}"${f.single ? ' data-single' : ''}>
          ${f.options
            .map(optionOf)
            .map((o) => `<button type="button" class="ib-chip" aria-pressed="false" data-value="${esc(o.value)}">${esc(o.label)}</button>`)
            .join('')}
        </div>
      </div>`
  }

  const label = `<label class="field__label" for="${id}">${esc(f.label)}${opt}</label>`

  if (f.type === 'textarea') {
    return `
      <div class="field field--wide" data-field="${esc(f.name)}">
        ${label}
        <textarea class="field__input" id="${id}" name="${esc(f.name)}" rows="4" aria-describedby="${id}-error"${req}></textarea>
        ${err}
      </div>`
  }

  if (f.type === 'select') {
    return `
      <div class="field" data-field="${esc(f.name)}">
        ${label}
        <span class="ib-select">
          <select class="field__input" id="${id}" name="${esc(f.name)}" aria-describedby="${id}-error"${req}>
            <option value="">${esc(d.ui.select)}</option>
            ${f.options.map(optionOf).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
          </select>
        </span>
        ${err}
      </div>`
  }

  const type = ['text', 'tel', 'email', 'number', 'date'].includes(f.type) ? f.type : 'text'
  const extra = type === 'number' ? ' inputmode="numeric" min="1"' : ''
  return `
    <div class="field" data-field="${esc(f.name)}">
      ${label}
      <input class="field__input" id="${id}" name="${esc(f.name)}" type="${type}" aria-describedby="${id}-error"${req}${auto}${extra}>
      ${err}
    </div>`
}

function aside(a) {
  return `
    <aside class="ib-form__aside" aria-labelledby="ib-form-aside-title" data-reveal>
      <p class="ib-form__aside-title" id="ib-form-aside-title">${esc(a.title)}</p>
      <ul class="ib-form__channels">
        ${a.items
          .map(
            (c) => `
          <li><span class="ib-form__channel-label">${esc(c.label)}</span>
            <a class="ib-form__channel" href="${esc(c.href)}"${ext(c.href, c.external)}>${esc(c.value)}</a></li>`,
          )
          .join('')}
      </ul>
    </aside>`
}

export function buildForm(d) {
  const ui = d.ui
  const hidden = ['form', 'page', ...UTM, 'segment']
    .map((name) => `<input type="hidden" name="${name}" value="${name === 'form' ? esc(d.form) : ''}">`)
    .join('')

  return section('form', { ...d, note: d.text }, `
    <div class="container">
      <div class="ib-form__grid">
        <div class="ib-form__main">
          ${head({ ...d, note: d.text })}
          <form class="ib-form" novalidate data-ib-form="${esc(d.form)}" data-required="${esc(ui.required)}" data-email="${esc(ui.email)}" data-reveal>
            ${hidden}
            <div class="fields ib-form__fields">
              ${d.fields.map((f) => field(f, { ...d, ui })).join('')}
            </div>
            <div class="ib-form__consent">
              <label class="check">
                <input type="checkbox" name="consent" id="${esc(d.form)}-consent" aria-describedby="${esc(d.form)}-consent-error">
                <span class="check__box">${icons.check}</span>
                <span>${inline(ui.consent)}</span>
              </label>
              <p class="field__error" id="${esc(d.form)}-consent-error" data-consent-error hidden>${esc(ui.consentError)}</p>
            </div>
            <button type="submit" class="btn btn--solid ib-form__submit">${esc(d.submit)}</button>
          </form>
          <div class="ib-form__success" data-form-success role="status" tabindex="-1" hidden>
            <span class="ib-form__success-mark" aria-hidden="true">${icons.check}</span>
            <p>${esc(d.success)}</p>
          </div>
        </div>
        ${aside(ui.aside)}
      </div>
    </div>`)
}

/* ------------------------------------------------------------------- init */

export function initForm(root) {
  const form = root.querySelector('form[data-ib-form]')
  if (!form) return
  const success = root.querySelector('[data-form-success]')
  const params = new URLSearchParams(location.search)

  form.elements.page.value = location.pathname
  UTM.forEach((name) => {
    form.elements[name].value = params.get(name) || ''
  })

  /* ---- чипы ------------------------------------------------------------- */

  const groups = [...form.querySelectorAll('[data-chips]')]
  const choose = (group, value, on) => {
    const single = group.hasAttribute('data-single')
    group.querySelectorAll('.ib-chip').forEach((chip) => {
      if (chip.dataset.value === value) chip.setAttribute('aria-pressed', String(on))
      else if (single && on) chip.setAttribute('aria-pressed', 'false')
    })
    if (group.dataset.chips === 'segment') {
      const picked = group.querySelector('[aria-pressed="true"]')
      form.elements.segment.value = picked ? picked.dataset.value : ''
    }
  }
  groups.forEach((group) => {
    group.addEventListener('click', (event) => {
      const chip = event.target.closest('.ib-chip')
      if (!chip) return
      choose(group, chip.dataset.value, chip.getAttribute('aria-pressed') !== 'true')
    })
  })

  const segmentGroup = form.querySelector('[data-chips="segment"]')
  const setSegment = (key) => {
    if (!key) return
    form.elements.segment.value = key
    if (segmentGroup && segmentGroup.querySelector(`[data-value="${CSS.escape(key)}"]`)) choose(segmentGroup, key, true)
  }
  setSegment(params.get('segment'))
  document.addEventListener('ib:segment', (event) => setSegment(event.detail?.key))

  /* ---- проверка --------------------------------------------------------- */

  const showError = (fieldEl, text) => {
    const input = fieldEl.querySelector('.field__input')
    const error = fieldEl.querySelector('[data-error]')
    if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false')
    if (error) {
      error.textContent = text || ''
      error.hidden = !text
    }
  }

  const check = (fieldEl) => {
    const input = fieldEl.querySelector('.field__input')
    if (!input) return true
    const value = input.value.trim()
    if (input.required && !value) {
      showError(fieldEl, form.dataset.required)
      return false
    }
    if (input.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showError(fieldEl, form.dataset.email)
      return false
    }
    showError(fieldEl, '')
    return true
  }

  form.querySelectorAll('[data-field]').forEach((fieldEl) => {
    const input = fieldEl.querySelector('.field__input')
    input?.addEventListener('blur', () => {
      if (input.getAttribute('aria-invalid') === 'true') check(fieldEl)
    })
    input?.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') check(fieldEl)
    })
  })

  const consent = form.elements.consent
  const consentError = form.querySelector('[data-consent-error]')
  consent.addEventListener('change', () => {
    if (consent.checked) {
      consentError.hidden = true
      consent.setAttribute('aria-invalid', 'false')
    }
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const fields = [...form.querySelectorAll('[data-field]')]
    const bad = fields.filter((fieldEl) => !check(fieldEl))
    const agreed = consent.checked
    consentError.hidden = agreed
    consent.setAttribute('aria-invalid', String(!agreed))

    if (bad.length || !agreed) {
      const first = bad[0]?.querySelector('.field__input') || (!agreed ? consent : null)
      first?.focus({ preventScroll: true })
      scrollToEl(bad[0] || consent.closest('.ib-form__consent'), 32)
      return
    }

    const data = {}
    new FormData(form).forEach((value, key) => {
      if (key === 'consent') return
      data[key] = value
    })
    groups.forEach((group) => {
      const name = group.dataset.chips
      const picked = [...group.querySelectorAll('[aria-pressed="true"]')].map((chip) => chip.dataset.value)
      if (name === 'segment') return
      data[name] = picked.join(', ')
    })
    data.consent = true
    console.info(`[заявка] ${JSON.stringify(data)}`)

    form.hidden = true
    success.hidden = false
    success.focus({ preventScroll: true })
    if (!reduced()) scrollToEl(root, 0)
  })
}
