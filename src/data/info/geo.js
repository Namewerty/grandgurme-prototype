/**
 * Точки на оси поясов (блок timezones): /partners → #where, /about → #world.
 *
 * lon — долгота, по ней точка встаёт на ось от −125° до +65°; tz — пояс для
 * местного времени (Intl.DateTimeFormat). Точки ближе 3° друг к другу блок
 * сливает в одну с подписью группы — сейчас так сливаются Нью-Йорк и Майами
 * (group ниже), подпись группы берётся отсюда же.
 *
 * Источник городов и заметок — презентация компании от 07.03.2026
 * и 1-caviar.ae.
 *
 * venues — названия заведений для карточки точки. На страницу попадают
 * только при SHOW_PARTNER_NAMES (src/data/info/flags.js): тернарный оператор
 * стоит прямо здесь, чтобы при выключенном флаге сборщик выбросил строки
 * из бандла целиком, а не прятал их разметкой.
 *
 * ⚠ ПОДТВЕРДИТЬ У ЗАКАЗЧИКА: список из презентации от 07.03.2026;
 * актуальность каждого заведения (Trump Plaza закрыт с 2014 года)
 * и письменное согласие на упоминание.
 */

import { SHOW_PARTNER_NAMES } from './flags.js'

export const geoPoints = {
  'las-vegas': {
    city: 'Лас-Вегас',
    lon: -115.1,
    tz: 'America/Los_Angeles',
    note: 'Рестораны и отели-казино',
    venues: SHOW_PARTNER_NAMES ? ['Resorts World Las Vegas', "Caspian's Rock & Roe", 'Aqua'] : [],
  },
  miami: {
    city: 'Майами',
    lon: -80.2,
    tz: 'America/New_York',
    note: 'Ресторан',
    venues: SHOW_PARTNER_NAMES ? ['Sexy Fish'] : [],
  },
  'new-york': {
    city: 'Нью-Йорк',
    lon: -74.0,
    tz: 'America/New_York',
    note: 'Рестораны Манхэттена и отели Восточного побережья',
    venues: SHOW_PARTNER_NAMES
      ? [
          'Cipriani Wall Street',
          'Serafina Manhattan',
          'Jean-Georges',
          'Aquavit',
          'Daniel',
          'Borgata Hotel Casino & Spa',
          'Trump Plaza',
        ]
      : [],
  },
  europe: {
    city: 'Монако, Куршевель, Портофино, Санкт-Мориц',
    /* Короткая подпись над точкой: четыре города в строку над осью не встают. */
    short: 'Курорты Европы',
    lon: 8.0,
    tz: 'Europe/Monaco',
    note: 'Отели и рестораны на курортах',
    venues: SHOW_PARTNER_NAMES
      ? [
          'Hôtel de Paris (Монако)',
          'Billionaire (Монако, Санкт-Мориц, Порто-Черво)',
          'Le Lana (Куршевель)',
          'Belmond Splendido (Портофино)',
          'Villa Alpabella (Форте-дей-Марми)',
        ]
      : [],
  },
  moscow: {
    city: 'Москва',
    lon: 37.6,
    tz: 'Europe/Moscow',
    note: 'Гастробутик на Софийской набережной и поставки ресторанам',
    home: true,
    venues: [],
  },
  dubai: {
    city: 'Дубай',
    lon: 55.3,
    tz: 'Asia/Dubai',
    note: 'Рестораны, отели, клубы и бизнес-авиация. Бутик на Dubai Marina',
    venues: SHOW_PARTNER_NAMES
      ? [
          'Belcanto (Dubai Opera)',
          'Sakhalin Dubai',
          'Chalet Berezka',
          'Nahaté Dubai',
          'Plumpy',
          'Josette',
          'CutFish Dubai',
          'Address Hotels + Resorts',
          'Capital Club Dubai',
          'Jetex',
        ]
      : [],
  },
}

/** Подписи групп слившихся точек: ключ — ключи точек через «+» в порядке
    с запада на восток. Нет подписи — города через « и ». */
export const geoGroups = {
  'miami+new-york': 'Нью-Йорк и Майами',
}

/** Ось, градусы долготы, и порог слияния точек.
    merge — 7°, а не 3° из задания: Майами (−80,2°) и Нью-Йорк (−74,0°)
    стоят в 6,2° друг от друга, и при 3° не сливаются — подписи наезжают
    (README, «Решения, принятые иначе»). */
export const geoAxis = { min: -125, max: 65, merge: 7 }
