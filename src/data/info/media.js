/**
 * Кадры информационных страниц: путь, что в кадре (alt) и пропорция
 * файла. Пропорция нужна ленте подач: кадры там одной высоты и своей
 * ширины, и без неё лента прыгала бы, пока кадры грузятся.
 *
 * Кадры — public/media/info/, откуда и на каких условиях — ИСТОЧНИКИ.md там же.
 * ⚠ Кадры подач сняты в ресторанах и отелях, с которыми работает компания:
 * права на их использование подтвердить у заказчика до переноса на боевой сайт.
 *
 * В alt нет названий заведений — только то, что в кадре.
 */

const INFO = '/media/info'

const shot = (dir, file, alt, ratio) => ({ src: `${INFO}/${dir}/${file}.jpg`, alt, ratio })

export const infoMedia = {
  chefKiloTin: shot('partners', 'chef-kilo-tin', 'Повар держит открытую килограммовую банку икры', '1:1'),
  scallopSmoke: shot('partners', 'scallop-smoke', 'Подача с икрой в раковине гребешка, лёгкий дым', '2000:1333'),
  tartarePearlSpoon: shot('partners', 'tartare-pearl-spoon', 'Тартар с икрой и перламутровая ложка', '1280:857'),
  caviarCake: shot('partners', 'caviar-cake', 'Цилиндр из икры на тарелке', '895:1570'),
  benedictCaviar: shot('partners', 'benedict-caviar', 'Яйца бенедикт с икрой', '1:1'),
  oystersPlatter: shot('partners', 'oysters-platter', 'Устрицы с икрой на блюде', '1000:667'),
  blueDish: shot('partners', 'blue-dish', 'Сет с икрой на синей тарелке', '1274:870'),
  violetDish: shot('partners', 'violet-dish', 'Подача с икрой и фиолетовым соусом', '1254:837'),
  bliniTin: shot('partners', 'blini-tin', 'Блины с икрой и банка икры на льду', '892:2000'),
  canapesTray: shot('partners', 'canapes-tray', 'Официант несёт поднос канапе с икрой', '736:999'),
  redCaviarOyster: shot('partners', 'red-caviar-oyster', 'Устрица с красной икрой', '2000:1335'),
  silverDishToasts: shot('partners', 'silver-dish-toasts', 'Икорница с икрой и тосты', '1254:836'),
  pastaCaviar: shot('partners', 'pasta-caviar', 'Паста с икрой', '590:732'),
  eggCaviar: shot('partners', 'egg-caviar', 'Яйцо с икрой', '576:891'),
  businessJet: shot('partners', 'business-jet', 'Пассажир бизнес-джета и банка икры', '1:1'),

  seaUrchin: shot('about', 'sea-urchin', 'Чёрная икра в панцире морского ежа', '1500:2000'),
  spoonGoldPlate: shot('about', 'spoon-gold-plate', 'Ложка икры на кованой золотой тарелке', '836:1254'),

  dubaiLounge: shot('geo', 'dubai-lounge', 'Лобби отеля в Дубае', '1280:720'),

  boxBlack: shot('gifts', 'box-black', 'Шкатулка с икрой, чёрное исполнение', '1:1'),
  boxBlue: shot('gifts', 'box-blue', 'Шкатулка с икрой, синее исполнение', '1:1'),
  boxWhite: shot('gifts', 'box-white', 'Шкатулка с икрой, белое исполнение', '1:1'),
  woodRoyal: shot('gifts', 'wood-royal-beluga', 'Деревянная шкатулка с банкой Royal Beluga', '1:1'),
  woodDiamond: shot('gifts', 'wood-diamond-beluga', 'Большая деревянная шкатулка с банкой Diamond Beluga', '1:1'),
  trioSet: shot('gifts', 'trio-set', 'Набор из трёх банок икры в синем боксе', '1:1'),
  boxBlackClose: shot('gifts', 'box-black-close', 'Шкатулка с банкой икры Royal Beluga', '1:1'),
  woodDiamondClose: shot('gifts', 'wood-diamond-close', 'Банка икры, перламутровая ложка и золотой ключик в шкатулке', '1:1'),
}

/** Кадр не из /media/info: путь и alt, пропорция по месту. */
export const img = (src, alt, ratio = '1:1') => ({ src, alt, ratio })

/** Кадр из /media/info по папке и имени файла — для кадров под флагом,
    которые не должны лежать в общем списке (src/data/info/partners.js). */
export const infoShot = shot
