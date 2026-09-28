/**
 * Реквизиты юридического лица — один файл на весь сайт.
 *
 * Берут отсюда: /about → #company, /contacts → #company и строка копирайта
 * в подвале (src/data/footer.js). Значения — с действующего
 * grandgurme.ru/contacts (28.09.2026).
 *
 * Строка с value: null на странице не выводится (блок table).
 */

export const companyDetails = {
  name: 'ООО «№1 Гранд Гурмэ»',
  inn: '9725174233',
  kpp: '772501001',
  ogrn: '1247700777610',
  address: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: юридический адрес
  bank: null, // ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: банк, расчётный и корреспондентский счёт, БИК
}

/** Строки таблицы реквизитов: подпись и значение. */
export const companyRows = [
  { label: 'ИНН', value: companyDetails.inn },
  { label: 'КПП', value: companyDetails.kpp },
  { label: 'ОГРН', value: companyDetails.ogrn },
  { label: 'Юридический адрес', value: companyDetails.address },
  { label: 'Банк и счёт', value: companyDetails.bank },
]

/** Строка копирайта подвала: «© ООО «№1 Гранд Гурмэ», 2026. ИНН 9725174233». */
export const copyrightLine = (year) => `© ${companyDetails.name}, ${year}. ИНН ${companyDetails.inn}`
