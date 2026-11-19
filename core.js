/* Путь к квартире: расчётное ядро. Чистые функции без DOM.
   Даты: день 'YYYY-MM-DD', месяц 'YYYY-MM'. Деньги в тенге.
   Помесячная модель: движок notes/calc/taksi_cobalt_2026-11-14/scenarios_2026-11-17/model_tb (сверено 17.11.2026),
   цифры такси из исследования 18.11.2026 (notes/2026-11-18-econom-skolko-ostaetsya.md, final_calc.py): комиссии и чаевые,
   сезон, разгон новичка, усталость сверх 12 ч, пропуски смен, расходы своей машины на км. Аренда, своя машина в кредит Kaspi
   с досрочкой, Отбасы с премией 20% и переносом сверх потолка, износ машины. */
const Core = (() => {
  'use strict';

  // ---------------------------------------------------------------- настройки по умолчанию (общие цифры исследования)
  // Цены ноября 2026. Исследование 18.11 считало в ценах июля 2027 (услуги x1,06), такие суммы здесь поделены на 1,06
  const DEF = {
    target: 4000000,          // цель: активы = деньги + Отбасы + машина − кредит
    deadline: '',             // срок цели (пусто: 3 года от первого запуска, см. datesFrom)
    start: '2026-11',         // от этого месяца растут цены (расходы и жизнь)
    living: 240000,           // жизнь в месяц на такси, цены ноября 2026 (сумма конвертов env)
    gCost: 9, gRev: 4.5,      // рост цен и выручки, % в год
    // оплата пассажиров за час на линии (Картой + Наличными), ₸: летний месяц опытного водителя (после первых двух месяцев),
    // в ценах июля 2027. Исследование 18.11 держит тариф ровным до июля 2027 (rBase), дальше выручка растёт на gRev.
    // Вероятно 2 900, плохой месяц 2 500, хороший 3 400. Зиму, разгон новичка и рост прогноз накладывает сам
    R: 2900, rBase: '2027-07',
    rLog: true,               // считать прогноз по своим сменам, когда записано 10 смен с цифрой приложения
    tpl: [12, 12, 12, 12, 12, 12, 0], // план часов по дням недели: Пн..Вс
    preTpl: [5, 5, 5, 5, 5, 8, 0], // до такси: часы подработки (пешая доставка) по дням Пн..Вс, рядом с автошколой
    preRate: 750,             // до такси: ₸ в час на руки (Яндекс Еда пешком зимой: 550 плохо, 850 обычно; 17.11.2026)
    preLiving: 177000,        // до такси: жизнь в месяц (сумма конвертов envPre)
    env: { home: 100000, food: 70000, other: 30000, fun: 40000 },    // конверты месяца на такси, цены ноября 2026 (сумма = living)
    envPre: { home: 100000, food: 55000, other: 12000, fun: 10000 }, // конверты до такси (сумма = preLiving)
    preOnce: 225000,          // разовые траты до первой смены: автошкола ~165 000, тёплая одежда ~45 000, сумка, медкнижка, залог
    startBuf: 150000,         // нужно на старт такси: неделя аренды вперёд, бензин, залог, еда до первых выплат (Яндекс Гараж 17.11.2026)
    why: '', whyOn: '',       // зачем тебе квартира, своими словами
    otbOpen: '', license: '', taxiFrom: '', carFrom: '', preFrom: '', preOnceDate: '', // даты пути, по умолчанию от первого запуска
    // аренда у Первого в Яндекс Гараже: 10 000 в день + 5,9% (дешевле всех по сумме, 6/1, выходной не оплачивается).
    // Расход средний за год: летом (апрель-октябрь) 9,5 л, зимой (ноябрь-март) 11,5 л на 100 км.
    // Прочее в месяц: связь и мелочи 8 120, штрафы 5 000, резерв на повреждения 4 000, сборы парка за вывод и пополнение 1 500 (июль 2027)
    rentDay: 10000, park: 5.9, rentL100: 10.33, rentOther: 17566, rentLostPay: 70, // за пропущенный день аренда всё равно платится на 70%
    lostMe: 0.7,              // свои пропуски смен в месяц: болезнь, документы, блок, сбой Яндекса
    // своя около 2,5 млн напрямую с Яндексом, без парка, Kaspi 2,515% в месяц на 60 месяцев: платёж 73 040 (калькулятор Kolesa 18.11.2026).
    // Расход средний за год, по сезонам как у аренды. lost: дни в ремонте в месяц.
    // Ремонт старого автомата 11,8 ₸ на км в ценах июля 2027; repair: свой резерв в месяц сверх этого (по умолчанию нет)
    price: 2500000, down: 10, rate: 2.515, months: 60, l100: 10.5, repairKm: 11.13, repair: 0, v36: 1750000, lost: 1.2,
    fuel: 'petrol', petrol: 255, gas: 112, gasX: 1.2, gasCost: 240000, gasFrom: '',
    skin: 'taxi',             // цвет машины на дороге (открываются с уровнем)
    // комиссия Яндекса в Экономе 16,5% (17% худший случай), соцплатежи 4,1%, чаевые +1,1% от оплаты пассажиров (скриншот Астаны 27.09.2026)
    yandex: 16.5, tax: 4.1, tips: 1.1, kmH: 17.5, wash26: 22000, phone: 5660,
    // разовое при покупке своей машины (own_car_costs.json startup, июль 2027 / 1,06): страховки за первый год, регистрация без новых
    // номеров 7 040, диагностика до покупки; buyOther: первое ТО после покупки 100 000, аптечка, огнетушитель и знак 10 000,
    // держатель и зарядка телефона 8 000, проверка истории 700. Всё кроме взноса растёт с ценами к месяцу покупки
    ogpo: 80872, osgop: 13282, regFee: 6642, diag: 15990, buyOther: 111981,
    // масло 3,11 и шины 2,29 ₸ на км (июль 2027); техосмотр 19 080 и налог на транспорт 10 336 в год;
    // ownOther: парковка 3 180, резерв на ДТП 4 680, штрафы 5 000 в месяц (июль 2027)
    oil: 22000, oilKm: 7500, tires: 129600, tiresKm: 60000, taxTech: 27751, ownOther: 12132,
    season: true,             // сезон выручки и расхода по месяцам (false: ровно весь год)
    ramp: true,               // разгон новичка: первые 30 дней такси 87%, следующие 30 дней 97%
    otbLoan: 50000, otbCap: 938600, otbCap26: 865000, otbPrem: 20, otbRate: 2,
    ds: 0,                    // договорная сумма Отбасы (0: вдвое больше цели, половина своя, половина заём)
    maxWeek: 72,              // потолок часов в неделю: прогноз и советы не просят больше
  };
  // версии значений по умолчанию (set.res). Сохранённое значение, равное значению по умолчанию своей версии, миграция меняет на новое.
  // res 2: исследование 18.11.2026 (OLD_DEF: что было до него); res 3: разовое при покупке машины по исследованию (OLD_DEF2: что было в res 2)
  const RES = 3;
  const OLD_DEF = { R: 3000, yandex: 17, tax: 4, kmH: 17.1, rentL100: 10.5, rentOther: 7071, l100: 11, repair: 45000, rate: 2.509,
    phone: 5990, ogpo: 79002, osgop: 14079, taxTech: 27653, oil: 20200, tires: 122000 };
  const OLD_DEF2 = { regFee: 20180 };
  // ---------------------------------------------------------------- такси по исследованию 18.11.2026
  // сезон оплаты пассажиров по месяцам (слабые данные): январь-февраль мороз, онлайн-учёба и Рамадан, осень сильнее
  const SEASON = [0.88, 0.88, 0.95, 1, 1, 1, 1, 1, 1.05, 1.05, 1.05, 1.05];
  const FUEL_S = 9.5 / 10.33, FUEL_W = 11.5 / 10.33, WINTER_FUEL = [11, 12, 1, 2, 3];
  const RAMP = [0.87, 0.97];  // новичок: первые 30 дней такси, следующие 30 дней, дальше как опытный
  const LATE = 0.95;          // часы сверх 12 в смене: устаёшь, выручка 95%, а км и бензин полные
  const effH = x => x > 12 ? 12 + (x - 12) * LATE : x;
  const seasonOf = (g, mk) => g.season === false ? 1 : SEASON[+mk.slice(5) - 1];
  const fuelSeason = (g, mk) => g.season === false ? 1 : WINTER_FUEL.indexOf(+mk.slice(5)) >= 0 ? FUEL_W : FUEL_S;
  // лимит самозанятого 300 МРП в месяц на оплату пассажиров и бонусы: 1 297 500 в 2026, 1 407 900 с 2027 (МРП 4 693). Выше нужно ИП
  const seLimit = mk => mk < '2027' ? 1297500 : 1407900;

  // ---------------------------------------------------------------- даты
  const pad = n => String(n).padStart(2, '0');
  const ISO_D = /^\d{4}-\d{2}-\d{2}$/;
  const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  // для проверок и снимков экрана: адрес с #today=YYYY-MM-DD подменяет сегодняшний день
  const today = () => { const m = typeof location !== 'undefined' && /today=(\d{4}-\d{2}-\d{2})/.exec(location.hash || ''); return m ? m[1] : isoOf(new Date()); };
  const mkOf = iso => iso.slice(0, 7);
  const mkAdd = (mk, n) => { const [y, m] = mk.split('-').map(Number); const t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + '-' + pad(((t % 12) + 12) % 12 + 1); };
  const mkDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const dim = mk => { const [y, m] = mk.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const ms = iso => Date.parse(iso + 'T00:00:00Z');
  const dow = iso => (new Date(ms(iso)).getUTCDay() + 6) % 7; // 0 = Пн
  const isoAdd = (iso, n) => { const d = new Date(ms(iso)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const isoDiff = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
  const monday = iso => isoAdd(iso, -dow(iso));
  const byDate = (a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.t || 0) - (b.t || 0);
  const moneyKey = m => [m.d, m.t || 0, m.kind || 's', m.add || 0, m.cash || 0, m.otb || 0, m.car || 0, m.loan || 0].join('|');
  // удалить и запомнить когда: при слиянии с другим устройством удалённое не вернётся
  const forget = (s, path) => { (s.del = s.del || {})[path] = Date.now(); };
  const addYears = (iso, n) => { const y = +iso.slice(0, 4) + n; return iso.slice(5) === '02-29' && dim(y + '-02') < 29 ? y + '-02-28' : y + iso.slice(4); };

  // ---------------------------------------------------------------- формат
  const NB = ' ';
  const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const DOWL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const plural = (n, f) => { const a = Math.abs(Math.round(n)) % 100, b = a % 10; return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2]; };
  const grp = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const money = (n, sign) => (n < 0 ? '−' : sign && n > 0 ? '+' : '') + grp(n) + NB + '₸';
  const mln = n => (n < 0 ? '−' : '') + (Math.abs(n) / 1e6).toFixed(Math.abs(n) >= 1e7 ? 1 : 2).replace('.', ',') + NB + 'млн' + NB + '₸';
  const num1 = n => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const dateLong = iso => +iso.slice(8) + ' ' + MONG[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
  const dateShort = iso => +iso.slice(8) + ' ' + MONG[+iso.slice(5, 7) - 1];
  const monthName = mk => MON[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4);
  const daysText = n => num1(n) + NB + (Number.isInteger(Math.round(n * 10) / 10) ? plural(n, ['день', 'дня', 'дней']) : 'дня');
  function untilText(from, to) {
    const d = isoDiff(from, to);
    if (d === 0) return 'сегодня';
    if (d === 1) return 'завтра';
    if (d < 0) return 'просрочено на ' + Math.abs(d) + NB + plural(-d, ['день', 'дня', 'дней']);
    if (d < 62) return 'через ' + d + NB + plural(d, ['день', 'дня', 'дней']);
    const m = Math.round(d / 30.44);
    return 'через ' + m + NB + plural(m, ['месяц', 'месяца', 'месяцев']);
  }

  // ---------------------------------------------------------------- состояние
  const ENV = ['home', 'food', 'other', 'fun'], ENV_TITLE = { home: 'Жильё', food: 'Еда', other: 'Связь и проезд', fun: 'Хотелки' };
  const envSum = e => ENV.reduce((s, k) => s + (+(e && e[k]) || 0), 0);
  // даты пути по умолчанию от первого запуска: подработка через неделю, Отбасы через 2 недели, права через 4 с лишним месяца, своя машина через 5 месяцев такси, срок 3 года
  function datesFrom(t) {
    const license = isoAdd(t, 160), taxiFrom = isoAdd(license, 5); // курс 2-2,5 месяца и очередь на автодром Астаны: права в апреле-июне (17.11.2026)
    return { deadline: addYears(t, 3), otbOpen: isoAdd(t, 13), license, taxiFrom, carFrom: mkAdd(mkOf(taxiFrom), 5) + '-01', preFrom: isoAdd(t, 7), preOnceDate: isoAdd(t, 6) };
  }
  function newState(t) {
    t = t || today();
    return { v: 1, created: t, updated: 0, set: Object.assign({}, DEF, datesFrom(t), { tpl: DEF.tpl.slice(), preTpl: DEF.preTpl.slice(), env: Object.assign({}, DEF.env), envPre: Object.assign({}, DEF.envPre), res: RES }), base: null, money: [], shifts: {}, over: {}, done: {}, quests: [], months: {}, mood: {}, del: {}, car: null, bad: {}, diary: {}, live: null, sleep: {}, reload: {} };
  }
  // цифры исследования 18.11: старое значение по умолчанию становится новым, своё значение остаётся. Один раз (set.res),
  // поэтому если потом сам поставишь старое число, миграция его не тронет
  function migrateRes(set, s0) {
    const r = s0.res > 0 ? s0.res : 1;
    if (r >= RES) return;
    if (r < 2) {
      for (const k of Object.keys(OLD_DEF)) if (s0[k] === OLD_DEF[k]) set[k] = DEF[k];
      // свой резерв на ремонт в месяц остаётся как был, тогда ремонт на км не добавляем, чтобы не считать дважды
      if (s0.repair != null && s0.repair !== OLD_DEF.repair && s0.repairKm == null) set.repairKm = 0;
      if (s0.battery === 828) delete set.battery; // аккумулятор теперь внутри ремонта на км
    }
    // значения res 2 (до res 2 они были такими же), которые поменялись в res 3
    for (const k of Object.keys(OLD_DEF2)) if (!(r < 2 && k in OLD_DEF) && s0[k] === OLD_DEF2[k]) set[k] = DEF[k];
    set.res = RES;
  }
  // план (st.base) считается только из записей и настроек. Если его считала старая модель, пересчитываем один раз новой
  // с той же даты и по тем записям, что были известны в тот день (прошлые и уже запланированные к концу того дня)
  function rebuildBase(s) {
    const b = s.base, from = b.from, end = ms(from) + 864e5;
    const known = s.money.filter(x => x.d <= from || (x.t > 0 && x.t < end));
    return makeBase(Object.assign({}, s, { money: known }), from);
  }
  function migrate(s) {
    if (!s || typeof s !== 'object') return newState();
    const out = Object.assign(newState(s.created), s);
    out.set = Object.assign({}, DEF, datesFrom(out.created), s.set || {});
    migrateRes(out.set, s.set || {});
    // конверты: старые настройки без них раскладываем из общей суммы жизни
    for (const [k, total] of [['env', out.set.living], ['envPre', out.set.preLiving]]) {
      const e = Object.assign({}, DEF[k], out.set[k] || {}), sum = envSum(e);
      if (!s.set || !s.set[k]) { const f = sum > 0 ? total / sum : 0; for (const x of ENV) e[x] = Math.round(DEF[k][x] * f / 1000) * 1000; e.home += total - envSum(e); }
      out.set[k] = e;
    }
    out.set.living = envSum(out.set.env); out.set.preLiving = envSum(out.set.envPre);
    if (!out.months || typeof out.months !== 'object') out.months = {};
    out.set.tpl = (out.set.tpl || DEF.tpl).slice(0, 7).map(x => +x || 0);
    while (out.set.tpl.length < 7) out.set.tpl.push(0);
    for (const k of ['shifts', 'over', 'done', 'del', 'bad', 'diary', 'sleep', 'reload']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    // смена с таймером: {d, start, brk: [[с, по]], on (начало перерыва), end}
    if (!out.live || typeof out.live !== 'object' || !out.live.d || !(out.live.start > 0)) out.live = null; else if (!Array.isArray(out.live.brk)) out.live.brk = [];
    // старые копии с целью без даты: день, когда поставил цель, не должен каждый день переезжать на сегодня
    if (out.set.why && !out.set.whyOn) out.set.whyOn = out.created;
    if (!Array.isArray(out.money)) out.money = [];
    if (!Array.isArray(out.quests)) out.quests = [];
    out.money = out.money.filter(m => m && m.d).sort(byDate);
    if (!out.car || typeof out.car !== 'object' || !out.car.on || !(out.car.price > 0)) out.car = null;
    // ключ к заметкам из Ноушена (base64url, 32 байта)
    if (!out.kb || typeof out.kb !== 'object' || typeof out.kb.k !== 'string' || !/^[\w-]{43}$/.test(out.kb.k)) out.kb = null;
    applyCar(out);
    if (!(s.set && s.set.res >= RES) && out.base && typeof out.base === 'object' && ISO_D.test(out.base.from || '') && Array.isArray(out.base.rows)) {
      try { out.base = rebuildBase(out); } catch (e) { /* старый план остаётся */ }
    }
    out.v = 1;
    return out;
  }

  // ---------------------------------------------------------------- план часов и фазы
  function planHours(st, iso, noOver) {
    const g = st.set, o = !noOver && st.over ? st.over[iso] : null;
    if (g.taxiFrom && iso >= g.taxiFrom) return o != null ? +o : +(g.tpl[dow(iso)] || 0);
    if (g.preFrom && iso >= g.preFrom) return o != null ? +o : +((g.preTpl || [])[dow(iso)] || 0);
    return 0;
  }
  function phaseOn(g, iso) {
    if (!g.taxiFrom || iso < g.taxiFrom) return 'pre';
    return g.carFrom && iso >= g.carFrom ? 'own' : 'rent';
  }
  // фаза дня по факту: своя машина, только когда она есть (в сверке или отмечена веха), иначе ещё аренда
  function phaseAt(st, iso) {
    const ph = phaseOn(st.set, iso);
    // записанная своя машина: с даты покупки (если такси уже началось)
    if (st.car && st.car.on) return ph === 'pre' ? 'pre' : iso >= st.car.on ? 'own' : 'rent';
    if (ph !== 'own') return ph;
    const m = lastMoney(st, iso);
    return (m && (m.car || 0) > 0) || (st.done && st.done.car && st.done.car <= iso) ? 'own' : 'rent';
  }
  // фаза месяца: своя машина с месяца покупки; аренда, если смены такси начинаются в этом месяце (дни до них считаются отдельно)
  function phaseOfMonth(g, mk) {
    const last = mk + '-' + pad(dim(mk));
    if (!g.taxiFrom || g.taxiFrom > last) return 'pre';
    return g.carFrom && mkOf(g.carFrom) <= mk ? 'own' : 'rent';
  }
  // жизнь за месяц: свой план месяца (st.months), если задан, иначе обычные конверты с ростом цен
  const hasOv = ov => !!ov && ENV.some(k => ov[k] != null);
  function lifeOf(st, mk, pre) {
    const ov = st.months && st.months[mk];
    if (hasOv(ov)) return envSum(ov);
    const g = st.set;
    return (pre ? g.preLiving : g.living) * growth(g, mk)[0];
  }
  // рост к месяцу mk: расходы и жизнь от start, выручка ровная до rBase (тариф исследования 18.11 до июля 2027) и дальше растёт на gRev
  const growth = (g, mk) => [Math.pow(1 + g.gCost / 100, mkDiff(g.start, mk) / 12), Math.pow(1 + g.gRev / 100, Math.max(0, mkDiff(g.rBase || g.start, mk)) / 12)];
  // аренда в сутки: до rBase держится как в Гараже на 18.11 (в исследовании и в июле 2027 те же 10 000), дальше растёт с ценами
  const rentF = (g, mk) => Math.pow(1 + g.gCost / 100, Math.max(0, mkDiff(g.rBase || g.start, mk)) / 12);
  const rentOf = (g, mk) => g.rentDay * rentF(g, mk);
  // доля оплаты пассажиров, которая остаётся в цифре Яндекс Про: минус комиссия Яндекса, парк (только аренда) и соцплатежи, плюс чаевые.
  // Своя машина работает напрямую с Яндексом, без парка (0,805; аренда у Первого 0,746)
  const keepOf = (g, ph) => 1 - g.yandex / 100 - g.tax / 100 - (ph === 'rent' ? g.park / 100 : 0) + (g.tips || 0) / 100;
  // разгон новичка по дням от первой смены такси
  const rampOf = (g, iso) => g.ramp === false || !g.taxiFrom || iso < g.taxiFrom ? 1 : (d => d < 30 ? RAMP[0] : d < 60 ? RAMP[1] : 1)(isoDiff(g.taxiFrom, iso));
  // выручка дня от уровня опытного водителя: сезон месяца и разгон новичка
  const revF = (g, iso) => seasonOf(g, mkOf(iso)) * rampOf(g, iso);
  // масло, шины и ремонт своей машины на 1 км, цены ноября 2026
  const perKm = g => g.oil / g.oilKm + g.tires / g.tiresKm + (g.repairKm || 0);
  // постоянные расходы своей машины в месяц без страховок: связь, техосмотр и налог, свой резерв на ремонт, парковка, резерв на ДТП, штрафы
  const ownFixed = g => g.phone + g.taxTech / 12 + (g.repair || 0) + (g.ownOther || 0);
  // газ на своей машине: с месяца установки (пусто: сразу с покупки)
  const gasOnDay = (g, iso, ph) => g.fuel === 'gas' && ph === 'own' && (!g.gasFrom || g.gasFrom <= iso);
  const gasOnMonth = (g, mk, ph) => g.fuel === 'gas' && ph === 'own' && (!g.gasFrom || mkOf(g.gasFrom) <= mk);
  function fuelPerHour(g, mk, ph, gas) {
    const fc = growth(g, mk)[0], fs = fuelSeason(g, mk);
    if (ph === 'rent') return g.kmH * g.rentL100 * fs / 100 * g.petrol * fc;
    if (ph === 'own') { if (gas == null) gas = gasOnMonth(g, mk, ph); return g.kmH * g.l100 * fs * (gas ? g.gasX : 1) / 100 * (gas ? g.gas : g.petrol) * fc; }
    return 0;
  }
  // часы и смены по плану за месяц, начиная с дня from (правки дней учитываются). add: часов сверху к каждой смене такси.
  // h, sh: такси; e: часы с усталостью (сверх 12 в смене по 0,95); er: то же с разгоном новичка; preH, preSh, preDays: подработка и дни до такси
  function monthPlan(st, mk, from, add) {
    const g = st.set; let h = 0, sh = 0, e = 0, er = 0, preH = 0, preSh = 0, preDays = 0; const n = dim(mk);
    for (let d = 1; d <= n; d++) {
      const iso = mk + '-' + pad(d);
      if (from && iso < from) continue;
      const pre = !g.taxiFrom || iso < g.taxiFrom;
      if (pre) preDays++;
      let x = planHours(st, iso);
      if (x > 0) { if (pre) { preH += x; preSh++; } else { x += add || 0; const ex = effH(x); h += x; sh++; e += ex; er += ex * rampOf(g, iso); } }
    }
    return { h, sh, e, er, preH, preSh, preDays };
  }

  // ---------------------------------------------------------------- помесячный прогноз
  const annuity = (L, r, n) => r ? L * r / (1 - Math.pow(1 + r, -n)) : L / n;
  // ---------------------------------------------------------------- своя машина и кредит за неё
  // st.car: {name, on (дата покупки), price, v36 (цена продажи через 3 года), loan: {sum, pay, months, first} или null, mt (t сверки при покупке), u}.
  // Досрочное гашение: запись денег {kind: 'add', move: true, to: 'loan', add, mode: 'term' (меньше срок) или 'pay' (меньше платёж)}
  const addMonths = (iso, n) => { const mk = mkAdd(mkOf(iso), n); return mk + '-' + pad(Math.min(+iso.slice(8), dim(mk))); };
  // месячная ставка по сумме, платежу и сроку: подбираем, пока аннуитет не совпадёт с платежом
  function loanRate(sum, pay, n) {
    if (!(sum > 0) || !(pay > 0) || !(n > 0) || pay * n <= sum) return 0;
    let lo = 0, hi = 0.5;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (annuity(sum, mid, n) > pay) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }
  // планировщик берёт цену, срок и ставку записанной машины, чтобы старые формулы считали её, а не шаблон
  function applyCar(s) {
    const c = s.car, g = s.set;
    if (!c || !g) return s;
    g.price = c.price; g.v36 = c.v36 > 0 ? Math.min(c.v36, c.price) : Math.round(c.price * 0.75); g.carFrom = c.on;
    const L = c.loan;
    if (L && L.sum > 0 && L.pay > 0 && L.months > 0) { g.down = Math.max(0, Math.min(100, (1 - L.sum / c.price) * 100)); g.months = L.months; g.rate = loanRate(L.sum, L.pay, L.months) * 100; }
    else g.down = 100;
    return s;
  }
  // кредит по графику на дату iso: платёж раз в месяц со дня первого платежа, досрочные гашения из записей денег.
  // Сверка после записи машины с остатком кредита сильнее графика: дальше он идёт от неё
  function loanPlan(st, iso) {
    const c = st.car, L = c && c.loan;
    if (!L || !(L.sum > 0) || !(L.pay > 0) || !(L.months > 0)) return null;
    const r = loanRate(L.sum, L.pay, L.months), first = L.first || addMonths(c.on, 1);
    const due = k => addMonths(first, k);
    const ev = st.money.filter(x => x.d >= c.on && (isAdd(x) ? x.move && x.to === 'loan' : x.loan != null && (x.t || 0) !== (c.mt || -1) && (x.t || 0) >= (c.mt || 0))).sort(byDate);
    let bal = L.sum, pay = L.pay, k = 0, j = 0, intPaid = 0, paid = 0, extra = 0, closed = null;
    const apply = x => {
      if (isAdd(x)) {
        const a = Math.min(bal, Math.max(0, +x.add || 0)); bal -= a; extra += a; paid += a;
        if (x.mode === 'pay' && bal > 0.5 && L.months - k > 0) pay = annuity(bal, r, L.months - k);
      } else bal = Math.max(0, +x.loan || 0);
      if (bal < 0.5 && !closed) { bal = 0; closed = x.d; }
    };
    while (bal > 0.5 && k < 600) {
      const d = due(k);
      while (j < ev.length && ev[j].d < d && ev[j].d <= iso) apply(ev[j++]);
      if (bal <= 0.5 || d > iso) break;
      const it = bal * r, p = Math.min(pay, bal + it);
      bal += it - p; intPaid += it; paid += p; k++;
      if (bal < 0.5) { bal = 0; closed = closed || d; }
    }
    while (j < ev.length && ev[j].d <= iso) apply(ev[j++]);
    // дальше по графику: сколько платежей осталось и сколько процентов впереди
    let b = bal, kk = k, intLeft = 0;
    while (b > 0.5 && kk < 600) { const it = b * r, p = Math.min(pay, b + it); if (p <= it) { kk = 600; break; } b += it - p; intLeft += it; kk++; }
    return { r, rate: r * 1200, sum: L.sum, pay, bal, paid, intPaid, extra, closed, next: bal > 0.5 ? due(k) : null, left: kk - k, end: bal > 0.5 ? due(kk - 1) : closed,
      intLeft, end0: due(L.months - 1), int0: Math.max(0, L.pay * L.months - L.sum) };
  }
  // как изменится кредит после досрочного гашения: для подсказки до сохранения
  function payoffPreview(st, iso, add, mode) {
    const now = loanPlan(st, iso);
    if (!now || !(add > 0)) return { now, next: now };
    const t = Object.assign({}, st, { money: st.money.concat([{ d: iso, kind: 'add', move: true, to: 'loan', add, mode, t: Date.now() }]) });
    return { now, next: loanPlan(t, iso) };
  }
  // примерная цена своей машины на дату: от цены покупки к цене через 3 года по прямой
  function carNow(st, iso) {
    const c = st.car; if (!c) return 0;
    const v36 = c.v36 > 0 ? Math.min(c.v36, c.price) : c.price * 0.75, months = Math.max(0, isoDiff(c.on, iso)) / 30.44;
    return Math.max(0, Math.round(c.price - (c.price - v36) * months / 36));
  }
  const carValue = (g, age) => Math.max(0, g.price - (g.price - g.v36) * age / 36);
  // разовое при покупке своей машины в месяц mk: взнос от цены плюс страховки, регистрация, диагностика, первое ТО и мелочи с ростом цен
  const startCost = (g, mk) => g.price * g.down / 100 + (g.ogpo + g.osgop + g.regFee + g.diag + (g.buyOther || 0)) * (mk ? growth(g, mk)[0] : 1);

  // деньги месяца после жизни, без платежа по кредиту. frac: какая доля месяца ещё впереди.
  // rev: оплата пассажиров (и подработка), по ней лимит самозанятого; free: что остаётся после машины и жизни
  function workMonth(g, mk, R, ph, hrs, age, frac, gas, lf) {
    const [fc, fr] = growth(g, mk), n = dim(mk);
    lf = lf || { pre: g.preLiving * fc, taxi: g.living * fc };
    // дни до первой смены такси: подработка и жизнь до такси
    const preF = hrs.preDays != null ? Math.min(frac, hrs.preDays / n) : ph === 'pre' ? frac : 0, taxF = Math.max(0, frac - preF);
    const preInc = (hrs.preH || 0) * g.preRate, preLife = lf.pre * preF;
    if (ph === 'pre') return { rev: preInc, free: preInc - preLife };
    // пропущенные смены: свои (болезнь, документы, блок, сбой Яндекса), на своей машине ещё дни в ремонте
    const lost = ((g.lostMe || 0) + (ph === 'own' ? g.lost || 0 : 0)) * taxF;
    const k = hrs.sh > 0 ? Math.max(hrs.sh - lost, 0) / hrs.sh : 1;
    // выручка по часам с усталостью и разгоном новичка, км и бензин по всем часам
    const eh = hrs.er != null ? hrs.er : hrs.e != null ? hrs.e : hrs.h;
    const h = hrs.h * k, sh = hrs.sh * k, km = g.kmH * h, rev = R * fr * seasonOf(g, mk) * eh * k, keep = keepOf(g, ph);
    const wash = g.wash26 * sh / 26 * fc, life = lf.taxi * taxF + preLife;
    if (ph === 'rent') {
      // аренда за отработанные дни и за часть пропущенных
      const rent = rentOf(g, mk) * (sh + (hrs.sh - sh) * (g.rentLostPay != null ? g.rentLostPay : 100) / 100);
      return { rev: rev + preInc, free: rev * keep + preInc - rent - fuelPerHour(g, mk, ph) * h - wash - g.rentOther * fc * taxF - life };
    }
    const fuel = fuelPerHour(g, mk, ph, gas) * h;
    const other = ownFixed(g) * fc * taxF + perKm(g) * km * fc;
    const ai = Math.ceil(age - 1e-9), ins = ai > 0 && ai % 12 === 0 ? (g.ogpo + g.osgop) * fc : 0; // возраст бывает дробным, если прогноз с середины месяца
    return { rev: rev + preInc, free: rev * keep + preInc - fuel - wash - other - ins - life };
  }

  // часы месяца по плану. o.fixed: {h, sh} на весь месяц (для сверки с моделями); o.extraWeek: часов в неделю сверх плана,
  // они ложатся поровну на смены такси этого месяца (сверх 12 ч в смене по 0,95, бензин за все часы)
  function hoursOf(st, mk, ph, frac, from, o) {
    const g = st.set;
    if (o.fixed) {
      if (ph === 'pre') return { h: 0, sh: 0 };
      const sh = o.fixed.sh * frac, x = o.fixed.sh > 0 ? o.fixed.h / o.fixed.sh : 0, e = sh * effH(x);
      return { h: o.fixed.h * frac, sh, e, er: e * rampOf(g, mk + '-15') };
    }
    if (o.plan === false) return { h: 0, sh: 0 };
    let hrs = monthPlan(st, mk, from);
    if (o.extraWeek > 0 && ph !== 'pre' && hrs.sh > 0) {
      const days = Math.max(0, dim(mk) * frac - (hrs.preDays || 0));
      hrs = monthPlan(st, mk, from, o.extraWeek * days / 7 / hrs.sh);
    }
    return hrs;
  }

  // s0: {iso, cash, otb, car, loan, owned, carAge, yc, yi, carry, pend}; o: {R, extraWeek, months, plan, events, fixed, forceCar}
  // ряды: деньги, Отбасы, машина, кредит и активы на конец месяца; rev: оплата пассажиров за месяц. seOver: первый месяц выше лимита самозанятого.
  // Машину прогноз покупает в первый месяц с carFrom, когда денег хватает на взнос и оформление; warn: не хватило в первый раз.
  // forceCar: купить в срок, даже если денег нет (деньги уходят в минус), afterBuy: сколько осталось сразу после покупки.
  // Со своей машиной на руках всегда держим запас startBuf (зима, ремонт): в досрочку и в Отбасы идёт только то, что сверху.
  // negOwn: первый месяц со своей машиной, когда деньги всё равно ушли в минус
  function project(st, s0, o) {
    o = o || {};
    const g = st.set, R = o.R || g.R, r = s0.r != null ? s0.r : g.rate / 100, out = [];
    const pay = s0.pay != null ? s0.pay : annuity(g.price * (1 - g.down / 100), r, g.months);
    let cash = s0.cash || 0, otb = s0.otb || 0, loan = s0.loan || 0, owned = !!s0.owned, age = s0.carAge || 0;
    let carV = owned ? (s0.car != null ? s0.car : carValue(g, age)) : 0;
    let yc = s0.yc || 0, yi = s0.yi || 0, carry = s0.carry || 0, pend = s0.pend || 0;
    let warn = null, closed = null, bought = null, seOver = null, afterBuy = null, negOwn = null;
    const keep = g.startBuf || 0;
    let gasDone = owned && g.fuel === 'gas' && (!g.gasFrom || g.gasFrom <= s0.iso);
    const mk0 = mkOf(s0.iso), N = o.months || Math.max(24, mkDiff(mk0, mkOf(g.deadline)) + 40);
    const slopeCar = owned ? Math.max(0, (g.price - g.v36) / 36) : 0, carMk = g.carFrom ? mkOf(g.carFrom) : null;
    let mk = mk0;
    for (let i = 0; i < N; i++, mk = mkAdd(mk, 1)) {
      const frac = i === 0 ? (dim(mk) - +s0.iso.slice(8) + 1) / dim(mk) : 1;
      if (o.events && o.events[mk]) cash += o.events[mk];
      if (pend && (+mk.slice(5) === 3 || (i === 0 && +mk.slice(5) > 3))) { otb += pend; pend = 0; }
      let ph = phaseOfMonth(g, mk);
      if (ph === 'own' && !owned) {
        const sc = startCost(g, mk);
        if (cash >= sc - 0.5 || o.forceCar) {
          cash -= sc; loan = g.price * (1 - g.down / 100); carV = g.price; owned = true; age = 0; bought = mk; afterBuy = cash;
          const x = Math.min(Math.max(cash - keep, 0), loan); if (x > 0 && (x >= pay - 0.5 || x >= loan - 0.5)) { loan -= x; cash -= x; }
        } else { ph = 'rent'; if (!warn) warn = { mk, short: sc - cash, need: sc }; }
      }
      if (owned && g.fuel === 'gas' && !gasDone && (!g.gasFrom || mkOf(g.gasFrom) <= mk)) { cash -= g.gasCost * growth(g, mk)[0]; gasDone = true; }
      const hrs = hoursOf(st, mk, ph, frac, i === 0 ? s0.iso : null, o);
      const wm = workMonth(g, mk, R, ph, hrs, owned ? age : 0, frac, ph === 'own' && gasDone, { pre: lifeOf(st, mk, true), taxi: lifeOf(st, mk, false) });
      // лимит самозанятого за календарный месяц, до срока цели: неполный первый месяц не судим, а после срока
      // выручка в прогнозе растёт, а лимит в нём стоит на МРП 2027
      if (!seOver && frac >= 1 && (!g.deadline || mk <= mkOf(g.deadline)) && wm.rev > seLimit(mk)) seOver = mk;
      let A = wm.free, due = 0, oc = 0;
      if (owned && loan > 0) { const it = loan * r * frac; due = Math.min(pay * frac, loan + it); loan += it - due; if (loan < 0.5) { loan = 0; closed = closed || mk; } }
      A -= due;
      if (A < 0) cash += A;
      else {
        if (cash < 0) { const x = Math.min(A, -cash); cash += x; A -= x; }
        if (ph === 'pre') cash += A;
        else if (!owned) {
          // на аренде с машиной в плане всё свободное копим на руках до покупки: взнос, оформление, запас startBuf и зима до покупки
          // (лишнее при покупке уйдёт в досрочку). Так запас на старт (runway) точен: добавленное сегодня доживает до покупки 1:1.
          // Без машины в плане держим запас startBuf, сверху 50 000 в Отбасы
          if (carMk) cash += A;
          else { let x = Math.min(Math.max(0, keep - cash), A); cash += x; A -= x; x = Math.min(g.otbLoan * frac, A); otb += x; yc += x; oc += x; A -= x; cash += A; }
        } else if (loan > 0) {
          // сначала запас до startBuf (после зимы), потом Отбасы, остальное в досрочку сверх запаса
          if (cash < keep) { const x = Math.min(A, keep - cash); cash += x; A -= x; }
          const x = Math.min(g.otbLoan * frac, A); otb += x; yc += x; oc += x; A -= x; cash += A;
          const spare = cash - keep;
          if (spare >= pay - 0.5 || spare >= loan - 0.5) { const y = Math.min(spare, loan); loan -= y; cash -= y; if (loan < 0.5) { loan = 0; closed = closed || mk; } }
        } else {
          if (cash < keep) { const x = Math.min(A, keep - cash); cash += x; A -= x; }
          const x = A + Math.max(0, cash - keep); otb += x; yc += x; oc += x; cash = Math.min(cash, keep);
        }
      }
      const it = otb * g.otbRate / 100 / 12 * frac; otb += it; yi += it;
      if (+mk.slice(5) === 12) { const base = yc + yi + carry, cap = mk < '2027' ? g.otbCap26 : g.otbCap, rew = Math.min(base, cap); pend += rew * g.otbPrem / 100; carry = base - rew; yc = 0; yi = 0; }
      if (owned) { age += frac; carV = slopeCar && s0.owned ? Math.max(0, carV - slopeCar * frac) : carValue(g, age); if (cash < -0.5 && !negOwn) negOwn = mk; }
      out.push({ mk, ph, h: hrs.h, rev: wm.rev, free: wm.free, cash, otb, oc, pend, car: carV, loan, na: cash + otb + pend + carV - loan });
    }
    return { rows: out, warn, closed, bought, seOver, afterBuy, negOwn };
  }

  // когда активы дойдут до цели: внутри месяца по прямой. na0 и from: точка старта
  function crossDate(rows, target, na0, from) {
    let prev = na0, prevIso = from;
    for (const r of rows) {
      const end = r.mk + '-' + pad(dim(r.mk));
      if (r.na >= target) {
        const span = Math.max(1, isoDiff(prevIso, end));
        const f = r.na === prev ? 1 : Math.min(1, Math.max(0, (target - prev) / (r.na - prev)));
        return { iso: isoAdd(prevIso, Math.round(f * span)), slope: (r.na - prev) / span };
      }
      prev = r.na; prevIso = end;
    }
    return null;
  }
  // активы на дату по рядам прогноза (по прямой между концами месяцев)
  function valueAt(rows, na0, from, iso) {
    if (iso <= from) return na0;
    let prev = na0, prevIso = from;
    for (const r of rows) {
      const end = r.mk + '-' + pad(dim(r.mk));
      if (iso <= end) { const span = Math.max(1, isoDiff(prevIso, end)); return prev + (r.na - prev) * isoDiff(prevIso, iso) / span; }
      prev = r.na; prevIso = end;
    }
    return prev;
  }

  // ---------------------------------------------------------------- деньги: отметки и оценка на сегодня
  // записи денег: отметка (сколько всего сейчас) или пополнение {kind: 'add', add, to: 'cash'|'otb'} поверх отметки.
  // В один день порядок по t (время записи): пополнение после отметки прибавляется, до неё уже учтено в отметке.
  const isAdd = m => m.kind === 'add';
  const naOf = m => isAdd(m) ? 0 : (m.cash || 0) + (m.otb || 0) + (m.car || 0) - (m.loan || 0);
  const lastMoney = (st, iso) => { let m = null; for (const x of st.money) if (!isAdd(x) && (!iso || x.d <= iso)) m = x; return m; };
  const after = (x, m) => !m || x.d > m.d || (x.d === m.d && (x.t || 0) > (m.t || 0));
  // все записи вместе с запланированной разовой тратой до такси (автошкола и прочее), если она задана.
  // Перевод в Отбасы {kind: 'add', move: true}: с денег на депозит, активы не меняются.
  function entries(st) {
    const g = st.set;
    if (!(g.preOnce > 0) || !g.preOnceDate) return st.money;
    return st.money.concat([{ d: g.preOnceDate, kind: 'add', add: -g.preOnce, to: 'cash', t: -1, plan: true, note: 'разовые траты до такси' }]).sort(byDate);
  }
  // переводы (move): с денег в Отбасы или в досрочное гашение кредита, активы не меняются
  function addsSince(st, m, iso) {
    const r = { cash: 0, otb: 0, loan: 0 };
    for (const x of entries(st)) {
      if (!isAdd(x) || x.d > iso || !after(x, m)) continue;
      const a = +x.add || 0;
      if (x.move) { r.cash -= a; if (x.to === 'loan') r.loan -= a; else r.otb += a; } else r[x.to === 'otb' ? 'otb' : 'cash'] += a;
    }
    return r;
  }
  // активы по записям: отметка задаёт сумму, пополнение прибавляет, перевод в Отбасы не меняет
  function moneyLine(st, iso) {
    const out = []; let na = null, otb = 0;
    for (const x of entries(st)) {
      if (iso && x.d > iso) break;
      if (isAdd(x)) { if (na == null) continue; const a = +x.add || 0; if (!x.move) na += a; if (x.to === 'otb') otb += a; }
      else { na = naOf(x); otb = x.otb || 0; }
      out.push({ d: x.d, na, otb, x });
    }
    return out;
  }
  // будущие записи (запланированные траты) для прогноза: по месяцам
  function futureEvents(st, iso) {
    const ev = {};
    for (const x of entries(st)) if (isAdd(x) && !x.move && x.d > iso) ev[mkOf(x.d)] = (ev[mkOf(x.d)] || 0) + (+x.add || 0);
    return ev;
  }
  // состояние Отбасы на дату: взносы этого года, премия за прошлый год (пока её не видно в сверке), перенос сверх потолка
  function otbState(st, iso) {
    const g = st.set, y = +iso.slice(0, 4), line = moneyLine(st, iso), put = {};
    let prev = null;
    for (const p of line) { if (prev != null && p.otb !== prev) { const yy = +p.d.slice(0, 4); put[yy] = (put[yy] || 0) + (p.otb - prev); } prev = p.otb; }
    const capOf = yy => yy < 2027 ? g.otbCap26 : g.otbCap, marks = line.filter(p => !isAdd(p.x)).map(p => p.d);
    const seenBy = yy => marks.some(d => d >= (yy + 1) + '-03-01'); // премия за год yy видна в сверке с 1 марта следующего
    const years = Object.keys(put).map(Number).sort((a, b) => a - b), prem = {};
    let carry = 0;
    for (let yy = years.length ? years[0] : y; yy < y; yy++) {
      const base = Math.max(0, (put[yy] || 0) - (prem[yy - 1] && seenBy(yy - 1) ? prem[yy - 1] : 0)) + carry, rew = Math.min(base, capOf(yy));
      prem[yy] = rew * g.otbPrem / 100; carry = base - rew;
    }
    const premPrev = prem[y - 1] || 0, credited = premPrev > 0 && seenBy(y - 1);
    return { yc: Math.max(0, (put[y] || 0) - (credited ? premPrev : 0)), carry, pend: credited ? 0 : premPrev };
  }

  // выручка в час по записанным сменам (что платят пассажиры, до комиссий и без чаевых).
  // R: уровень для прогноза как у настройки R (летний месяц опытного, цены rBase), без сезона, разгона новичка и усталости сверх 12 ч
  // (прогноз накладывает их сам); raw: как есть, (Картой + Наличными) / часы, в ценах своих месяцев. car: только смены на аренде или на своей
  function measuredR(st, iso, days, car) {
    const g = st.set; let rh = 0, eh = 0, gh = 0, h = 0, n = 0;
    const from = days ? isoAdd(iso, -days) : '0000';
    for (const [d, x] of Object.entries(st.shifts)) {
      if (d > iso || d < from || !x || !(x.h > 0) || !(x.app > 0)) continue;
      const ph = phaseAt(st, d); if (ph === 'pre' || (car && ph !== car)) continue;
      const gross = x.app / keepOf(g, ph);
      rh += gross / growth(g, mkOf(d))[1] / revF(g, d); eh += effH(+x.h); gh += gross; h += +x.h; n++;
    }
    return n ? { R: rh / eh, raw: gh / h, n, h } : { R: null, raw: null, n: 0, h: 0 };
  }
  const usedR = (st, iso, cache) => {
    if (cache) { const k = mkOf(iso); if (!cache.has(k)) cache.set(k, usedR(st, k + '-' + pad(dim(k)))); return cache.get(k); }
    const m = measuredR(st, iso, 120); return st.set.rLog && m.n >= 10 ? m.R : st.set.R;
  };

  // выручка часов смены в цифре Яндекс Про без записанной суммы: уровень x рост x сезон x разгон, сверх 12 ч по 0,95
  const appOf = (st, iso, h, cache) => { const g = st.set, ph = phaseAt(st, iso); return usedR(st, iso, cache) * growth(g, mkOf(iso))[1] * revF(g, iso) * effH(h) * keepOf(g, ph); };
  // топливо и износ за час (масло, шины и ремонт только у своей машины)
  const hourCost = (st, iso, ph) => { const g = st.set, mk = mkOf(iso); return fuelPerHour(g, mk, ph, gasOnDay(g, iso, ph)) + (ph === 'own' ? perKm(g) * g.kmH * growth(g, mk)[0] : 0); };
  // сколько остаётся с одного дня работы: деньги в руки минус топливо, мойка, аренда и износ за этот день
  function dayMoney(st, iso, h, app, cache) {
    const g = st.set, ph = phaseAt(st, iso);
    if (!(h > 0)) return { income: 0, costs: 0, net: 0, ph };
    if (ph === 'pre') { const income = app > 0 ? +app : g.preRate * h; return { income, costs: 0, net: income, ph }; }
    const fc = growth(g, mkOf(iso))[0];
    const income = app > 0 ? +app : appOf(st, iso, h, cache); // выручку в час считаем, только если суммы нет
    const costs = hourCost(st, iso, ph) * h + g.wash26 / 26 * fc + (ph === 'rent' ? rentOf(g, mkOf(iso)) : 0);
    return { income, costs, net: income - costs, ph };
  }
  // постоянные расходы за день (жизнь, связь, резерв на ремонт), они идут и в выходные.
  // m: последняя отметка; со своей машиной ещё проценты по кредиту и износ машины
  function dayFixed(st, iso, m) {
    const g = st.set, mk = mkOf(iso), fc = growth(g, mk)[0], ph = phaseAt(st, iso), n = dim(mk);
    if (ph === 'pre') return lifeOf(st, mk, true) / n;
    const extra = ph === 'rent' ? g.rentOther : ownFixed(g);
    let v = (lifeOf(st, mk, false) + extra * fc) / n;
    if (ph === 'own' && m && (m.car || 0) > 0) {
      const lp = st.car && st.car.loan ? loanPlan(st, iso) : null;
      v += ((lp ? lp.bal * lp.r : (m.loan || 0) * g.rate / 100) + Math.max(0, g.price - g.v36) / 36) / n;
    }
    return v;
  }
  // из них износ машины за день: в оценке он уменьшает цену машины, а не деньги
  const dayDep = (st, iso, m) => phaseAt(st, iso) === 'own' && m && (m.car || 0) > 0 ? Math.max(0, st.set.price - st.set.v36) / 36 / dim(mkOf(iso)) : 0;
  // аренда или своя по твоим сменам на аренде за 30 дней: сколько осталось на аренде и сколько осталось бы на своей машине по плану.
  // Расходы месяца (своя: постоянные со страховками и платёж Kaspi; аренда: связь и мелочи) и дни своей в ремонте берём на долю этих смен
  // в обычном месяце по плану (f = смены / смены месяца). Плановый день аренды без смены всё равно стоит 70% аренды (rentLostPay).
  // Карточка с 12 смен: по нескольким сменам месячные расходы делятся плохо
  function rentVsOwn(st, iso) {
    const g = st.set, from = isoAdd(iso, -30); let rent = 0, own = 0, n = 0, h = 0, missed = 0, lostRent = 0;
    for (let d = isoAdd(from, 1); d <= iso; d = isoAdd(d, 1)) {
      if (phaseAt(st, d) !== 'rent') continue;
      const x = st.shifts[d], mk = mkOf(d), fc = growth(g, mk)[0];
      if (x && x.h > 0 && x.app > 0) {
        const gross = x.app / keepOf(g, 'rent');
        rent += dayMoney(st, d, +x.h, +x.app).net;
        own += gross * keepOf(g, 'own') - (fuelPerHour(g, mk, 'own', g.fuel === 'gas') + perKm(g) * g.kmH * fc) * x.h - g.wash26 / 26 * fc;
        n++; h += +x.h;
      } else if (d < iso && !(x && x.h > 0) && planHours(st, d) > 0) { missed++; lostRent += rentOf(g, mk) * (g.rentLostPay != null ? g.rentLostPay : 100) / 100; }
    }
    if (n < 12) return null;
    const fc = growth(g, mkOf(iso))[0], pay = g.down < 100 ? annuity(g.price * (1 - g.down / 100), g.rate / 100, g.months) : 0;
    const P = (g.tpl || []).filter(x => x > 0).length * 30 / 7, f = P > 0 ? Math.min(1, n / P) : 1;
    const ownFix = (ownFixed(g) + (g.ogpo + g.osgop) / 12) * fc * f;
    // своя машина бывает в ремонте: из смен месяца столько не было бы
    const kOwn = Math.max(0, 1 - (g.lost || 0) / Math.max(P, n));
    const carMk = g.carFrom && mkOf(g.carFrom) > mkOf(iso) ? mkOf(g.carFrom) : mkOf(iso);
    return { n, h, f, missed, rent: rent - g.rentOther * fc * f - lostRent, own: own * kOwn - ownFix - pay * f, pay, start: startCost(g, carMk) };
  }
  // оценка активов на сегодня: последняя отметка + смены после неё − постоянные расходы.
  // Считаем только до последней внесённой смены: дни без записей не тянут оценку вниз.
  // смена после сверки: позже по дате или в тот же день, но внесена позже
  const shiftAfter = (d, x, m) => d > m.d || (d === m.d && !!x && (x.t || 0) > (m.t || 0));
  function estimate(st, iso) {
    const m = lastMoney(st, iso);
    if (!m) return null;
    const cache = new Map();
    let lastLog = null;
    for (const [d, x] of Object.entries(st.shifts)) if (d <= iso && shiftAfter(d, x, m) && (!lastLog || d > lastLog)) lastLog = d;
    let add = 0, dep = 0, logged = 0, missed = 0;
    for (let d = isoAdd(m.d, 1); d < iso; d = isoAdd(d, 1)) {
      const x = st.shifts[d];
      if (!x && planHours(st, d) > 0) missed++;
    }
    if (lastLog) {
      for (let d = m.d; d <= lastLog; d = isoAdd(d, 1)) {
        const x = st.shifts[d];
        if (x && x.h > 0 && shiftAfter(d, x, m)) { add += dayMoney(st, d, +x.h, +x.app || 0, cache).net; logged++; }
        if (d > m.d) { add -= dayFixed(st, d, m); dep += dayDep(st, d, m); }
      }
    }
    const ad = addsSince(st, m, iso);
    return { base: m, na: naOf(m) + add + ad.cash + ad.otb - ad.loan, add, dep, adds: ad, logged, missed, from: m.d, to: lastLog || m.d, todayIn: lastLog === iso };
  }

  // старт прогноза с сегодняшнего дня по последней отметке
  function startState(st, iso) {
    const g = st.set, m = lastMoney(st, iso) || { d: iso, cash: 0, otb: 0, car: 0, loan: 0 };
    const est = estimate(st, iso);
    // смена за сегодня уже в оценке: прогноз начинается с завтра
    const from = est && est.todayIn ? isoAdd(iso, 1) : iso;
    const owned = (m.car || 0) > 0;
    const carAge = owned && g.carFrom && g.carFrom <= from ? mkDiff(mkOf(g.carFrom), mkOf(from)) : 0;
    const ob = otbState(st, from), ad = est ? est.adds : { cash: 0, otb: 0, loan: 0 }, dep = est ? est.dep || 0 : 0;
    // кредит по графику на сегодня; платежи по нему с последней сверки ушли из денег (активы те же)
    const lp = st.car && st.car.loan && owned ? loanPlan(st, iso) : null, loan = lp ? lp.bal : Math.max(0, (m.loan || 0) + (ad.loan || 0));
    const cash = (m.cash || 0) + (est ? est.add : 0) + dep + ad.cash - (ad.loan || 0) - ((m.loan || 0) - loan);
    return { iso: from, cash, otb: (m.otb || 0) + ad.otb, car: Math.max(0, (m.car || 0) - dep), loan, owned, carAge, yc: ob.yc, yi: 0, carry: ob.carry, pend: ob.pend, pay: lp ? lp.pay : null, r: lp ? lp.r : null };
  }

  // ---------------------------------------------------------------- прогноз, план и отставание
  function forecast(st, iso, o) {
    o = o || {};
    const s0 = o.s0 || startState(st, iso), na0 = s0.cash + s0.otb + s0.car - s0.loan, R = o.R || usedR(st, iso);
    const p = project(st, s0, { R, extraWeek: o.extraWeek || 0, events: o.events || futureEvents(st, iso) });
    const goal = crossDate(p.rows, st.set.target, na0, iso);
    return Object.assign(p, { s0, na0, goal, R });
  }
  // план на старте: с ним сравнивается, впереди ты или отстаёшь
  function makeBase(st, iso) {
    const s0 = startState(st, iso), na0 = s0.cash + s0.otb + s0.car - s0.loan;
    const p = project(st, s0, { R: st.set.R, events: futureEvents(st, iso) });
    return { from: iso, na0, rows: p.rows.map(r => ({ mk: r.mk, na: Math.round(r.na) })) };
  }
  // насколько впереди плана: в днях, когда план растёт, иначе в тенге
  function versusPlan(st, iso, na) {
    const b = st.base; if (!b) return null;
    const planNow = valueAt(b.rows, b.na0, b.from, iso), diff = na - planNow;
    const ahead = valueAt(b.rows, b.na0, b.from, isoAdd(iso, 30)), back = valueAt(b.rows, b.na0, b.from, isoAdd(iso, -30));
    const slope = (ahead - back) / 60;
    if (slope < 1000) return { planNow, diff, days: null };
    // день, когда план доходит до текущих активов
    let lo = isoAdd(iso, -1500), hi = isoAdd(iso, 1500);
    if (valueAt(b.rows, b.na0, b.from, hi) < na) return { planNow, diff, days: isoDiff(iso, hi) };
    if (valueAt(b.rows, b.na0, b.from, lo) > na) return { planNow, diff, days: isoDiff(iso, lo) };
    for (let k = 0; k < 40 && isoDiff(lo, hi) > 1; k++) { const mid = isoAdd(lo, Math.floor(isoDiff(lo, hi) / 2)); if (valueAt(b.rows, b.na0, b.from, mid) < na) lo = mid; else hi = mid; }
    return { planNow, diff, days: isoDiff(iso, hi) };
  }
  // на сколько дней раньше цель от денег сверх плана
  function daysFor(fc, amount) {
    if (!fc || !fc.goal || !(fc.goal.slope > 0)) return null;
    return amount / fc.goal.slope;
  }
  // сколько часов в неделю добавить, чтобы успеть к сроку (0, если уже успеваешь)
  function needExtra(st, iso) {
    const dl = st.set.deadline, f0 = forecast(st, iso);
    if (f0.goal && f0.goal.iso <= dl) return { extra: 0, slackDays: isoDiff(f0.goal.iso, dl), fc: f0 };
    if (phaseOn(st.set, isoAdd(dl, -1)) === 'pre') return { extra: null, fc: f0 };
    // не больше потолка часов в неделю: сверх него советовать часы нельзя
    const cap = st.set.maxWeek > 0 ? st.set.maxWeek : 72, week = (st.set.tpl || []).reduce((a, b) => a + (+b || 0), 0);
    let lo = 0, hi = Math.max(0, Math.min(48, cap - week));
    const base = { s0: f0.s0, R: f0.R, events: futureEvents(st, iso) };
    const ok = x => { const f = forecast(st, iso, Object.assign({ extraWeek: x }, base)); return f.goal && f.goal.iso <= dl; };
    if (!(hi > 0) || !ok(hi)) return { extra: null, fc: f0, capped: cap - week < 48, cap };
    for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    return { extra: Math.ceil(hi * 2) / 2, fc: f0 };
  }

  // ---------------------------------------------------------------- штамп и раскладка смены
  // штамп за заработок в час, не за длину: в такси по выручке пассажиров в час, в доставке по деньгам на руки (цены ноября 2026).
  // Такси по исследованию 18.11: B от плохого месяца (2 500), A от вероятного (2 900), S от хорошего (3 400), S+ как на соревнованиях (3 900)
  const GRADES = [['S+', 3900, 1400], ['S', 3400, 1100], ['A', 2900, 850], ['B', 2500, 650], ['C', 0, 0]];
  function gradeOf(st, d, h, app) {
    if (!(h > 0) || !(app > 0)) return null;
    const g = st.set, ph = phaseAt(st, d), fr = growth(g, mkOf(d))[1], perH = app / h, pre = ph === 'pre';
    const v = pre ? perH / fr : perH / keepOf(g, ph) / fr, i = GRADES.findIndex(x => v >= (pre ? x[2] : x[1])), nv = i > 0 ? (pre ? GRADES[i - 1][2] : GRADES[i - 1][1]) : 0;
    // v и пороги в ценах rBase (штамп не дешевеет с ростом выручки), vN: те же числа в ценах дня смены, их и показываем
    return { g: GRADES[i][0], v, vN: v * fr, perH, ph, next: i > 0 ? { g: GRADES[i - 1][0], v: nv, vN: nv * fr } : null };
  }
  // куда ушли деньги пассажиров за смену: примерная раскладка по модели, и доля жизни на эту смену
  function shiftMoney(st, d, h, app) {
    const g = st.set, ph = phaseAt(st, d), mk = mkOf(d), fc = growth(g, mk)[0], dm = dayMoney(st, d, h, app);
    const mp = monthPlan(st, mk), shifts = Math.max(1, (mp.sh || 0) + (mp.preSh || 0)), fixed = dayFixed(st, d, lastMoney(st, d)) * dim(mk) / shifts;
    if (ph === 'pre') return { ph, app: dm.income, net: dm.net, fixed, goal: dm.net - fixed, day: dayFixed(st, d, lastMoney(st, d)) };
    const gross = dm.income / keepOf(g, ph);
    return { ph, gross, yandex: gross * g.yandex / 100, park: ph === 'rent' ? gross * g.park / 100 : 0, tax: gross * g.tax / 100, tips: gross * (g.tips || 0) / 100, app: dm.income,
      rent: ph === 'rent' ? rentOf(g, mk) : 0, fuel: fuelPerHour(g, mk, ph, gasOnDay(g, d, ph)) * h, wash: g.wash26 / 26 * fc,
      wear: ph === 'own' ? perKm(g) * g.kmH * h * fc : 0, net: dm.net, fixed, goal: dm.net - fixed, day: dayFixed(st, d, lastMoney(st, d)) };
  }
  // ---------------------------------------------------------------- три замка Отбасы
  // Заём 50/50 под 3,5-5% дают, когда депозиту 3 года, на нём половина договорной суммы (ДС) и оценочный показатель от 16.
  // ОП = сумма (деньги на счёте x 2% x время) / (ДС / 1000): считаем помесячно и примерно; ОП из приложения банка сильнее расчёта
  const OP_TIERS = [[16, 5, 6], [20, 4.8, 7], [25, 4.5, 8], [29, 4.2, 9], [35, 4, 10], [41, 3.8, 11], [45, 3.7, 12], [48, 3.5, 14], [53, 3.5, 16], [57, 3.5, 18], [61, 3.5, 21], [66, 3.5, 23], [74, 3.5, 25]];
  const tierOf = op => { let t = null; for (const x of OP_TIERS) if (op >= x[0]) t = { op: x[0], rate: x[1], years: x[2] }; return t; };
  function otbLocks(st, iso, fc) {
    const g = st.set, ds = g.ds > 0 ? g.ds : 2 * g.target, open = g.otbOpen;
    if (!open || !(ds > 0)) return null;
    const k = 0.02 / 12 / (ds / 1000), half = ds / 2, line = moneyLine(st, iso), rows = fc ? fc.rows : [], nowMk = mkOf(iso);
    const an = st.money.filter(m => !isAdd(m) && m.op > 0 && m.d <= iso).sort(byDate).pop() || null;
    // остаток: по записям до сегодня, дальше по прогнозу на конец месяца
    const histBal = end => { let v = 0; for (const p of line) { if (p.d > end) break; v = p.otb || 0; } return v; };
    const futBal = mk => { const r = rows.find(x => x.mk === mk); return r ? r.otb : null; };
    // остаток x дни с from по to: каждая сумма работает со дня, когда её положили, как считает банк
    const balDays = (from, to) => {
      if (from > to) return 0;
      let s = 0, d = from, v = histBal(isoAdd(from, -1));
      for (const p of line) { if (p.d < from) continue; if (p.d > to) break; s += Math.max(0, v) * isoDiff(d, p.d); d = p.d; v = p.otb || 0; }
      return s + Math.max(0, v) * (isoDiff(d, to) + 1);
    };
    const bal0 = histBal(iso), l1 = addYears(open, 3), lastMk = rows.length ? rows[rows.length - 1].mk : nowMk, opAt = {}, balAt = {};
    let op = 0, opNow = 0, l2 = null, l3 = null, interim = null, prev = null;
    for (let i = 0, mk = mkOf(open); i < 600 && mk <= lastMk; i++, mk = mkAdd(mk, 1)) {
      const D = dim(mk), end = mk + '-' + pad(D), first = mk === mkOf(open) ? open : mk + '-01';
      let bal;
      if (mk <= nowMk) {
        const lim = mk < nowMk ? end : iso;
        // ОП из приложения банка на дату сверки сильнее расчёта, после неё копим дальше
        if (an && mkOf(an.d) === mk && an.d >= first) op = an.op + balDays(isoAdd(an.d, 1), lim) * k / D;
        else op += balDays(first, lim) * k / D;
        bal = mk < nowMk ? histBal(end) : bal0;
        if (mk === nowMk) { opNow = op; op += Math.max(0, bal0) * k * isoDiff(iso, end) / D; prev = Math.max(bal0, futBal(mk) || 0); }
      } else {
        // будущий месяц: деньги приходят в течение месяца, берём среднее между концом прошлого и этого
        const cur = futBal(mk); if (cur == null) break;
        const p0 = prev != null ? prev : bal0;
        op += Math.max(0, (p0 + cur) / 2) * k * (mk === mkOf(open) ? (D - +open.slice(8) + 1) / D : 1);
        bal = cur; prev = cur;
      }
      opAt[mk] = op; balAt[mk] = bal;
      // даты замков по последнему пересечению: если банк или сверка показали меньше, дата сдвигается
      if (bal < half - 0.5) l2 = null;
      else if (!l2) l2 = mk <= nowMk ? (line.find(p => mkOf(p.d) === mk && p.otb >= half - 0.5) || { d: first }).d : end;
      if (op < 16) l3 = null; else if (!l3) l3 = end;
      if (op >= 5 && bal >= half - 0.5) { if (!interim) interim = end; } else interim = null;
    }
    const buy = l2 && l3 ? [l1, l2, l3].sort().pop() : null, opBuy = buy && opAt[mkOf(buy)] != null ? opAt[mkOf(buy)] : null;
    // сколько депозит пустой прямо сейчас: с открытия или с дня, когда остаток стал нулём
    let since = open;
    for (const p of line) { if (p.d > iso) break; if ((p.otb || 0) > 0) since = null; else if (since == null) since = p.d < open ? open : p.d; }
    const emptyMonths = bal0 <= 0 && since && since <= iso ? Math.floor(isoDiff(since, iso) / 30.44) : 0;
    return { ds, open, half, opNow, bal: bal0, anchored: an ? an.d : null,
      locks: [{ k: 'time', date: l1, ok: iso >= l1 }, { k: 'half', date: l2, ok: bal0 >= half - 0.5, now: bal0 }, { k: 'op', date: l3, ok: opNow >= 16, now: opNow }],
      buy, interim, tier: tierOf(opBuy != null ? opBuy : opNow), opBuy, tiers: OP_TIERS, emptyMonths, opAt, balAt };
  }
  // ---------------------------------------------------------------- смены: день, неделя, месяц
  // сколько остаётся с x часов смены без аренды и мойки за выход: выручка после комиссий (сверх 12 ч по 0,95) минус топливо и износ
  function hoursMoney(st, iso, x, cache) {
    const g = st.set, ph = phaseAt(st, iso);
    if (!(x > 0)) return 0;
    if (ph === 'pre') return g.preRate * x;
    return appOf(st, iso, x, cache) - hourCost(st, iso, ph) * x;
  }
  // сколько остаётся с обычного часа (до 12 ч в смене)
  const hourValue = (st, iso) => hoursMoney(st, iso, 1);
  // мойка и аренда за выход на смену
  function shiftCost(st, iso) {
    const g = st.set, ph = phaseAt(st, iso), fc = growth(g, mkOf(iso))[0];
    return ph === 'pre' ? 0 : g.wash26 / 26 * fc + (ph === 'rent' ? rentOf(g, mkOf(iso)) : 0);
  }
  // день: эффект на цель считается от разницы в часах с планом (выручка за час как в среднем, сверх 12 ч в смене по 0,95)
  function shiftDay(st, iso, fc) {
    const plan = planHours(st, iso), x = st.shifts[iso] || null;
    if (!x) return { iso, plan, fact: null, app: null, delta: 0, money: 0, days: 0 };
    const fact = +x.h || 0, app = +x.app || 0;
    let moneyDelta = fact === plan ? 0 : hoursMoney(st, iso, fact) - hoursMoney(st, iso, plan);
    if (plan === 0 && fact > 0) moneyDelta -= shiftCost(st, iso);
    if (plan > 0 && fact === 0) moneyDelta += shiftCost(st, iso);
    const d = daysFor(fc, moneyDelta);
    return { iso, plan, fact, app, delta: fact - plan, money: moneyDelta, days: d == null ? 0 : d, net: dayMoney(st, iso, fact, app).net };
  }
  function rangeStats(st, from, to, fc, until) {
    let plan = 0, fact = 0, app = 0, money = 0, days = 0, logged = 0, planDays = 0, factDays = 0;
    for (let d = from; d <= to; d = isoAdd(d, 1)) {
      const p = planHours(st, d); const past = !until || d <= until;
      if (past) { plan += p; if (p > 0) planDays++; }
      const s = shiftDay(st, d, fc);
      if (s.fact != null) { fact += s.fact; app += s.app; money += s.money; days += s.days; logged++; if (s.fact > 0) factDays++; }
    }
    return { from, to, plan, fact, app, money, days, logged, planDays, factDays, perHour: fact > 0 && app > 0 ? app / fact : null };
  }
  const weekStats = (st, iso, fc, until) => rangeStats(st, monday(iso), isoAdd(monday(iso), 6), fc, until);
  const monthStats = (st, mk, fc, until) => rangeStats(st, mk + '-01', mk + '-' + pad(dim(mk)), fc, until);
  // сколько плановых смен подряд записано (до вчера; сегодняшняя засчитывается, если уже внесена)
  function streak(st, iso) {
    let n = 0, d = st.shifts[iso] ? iso : isoAdd(iso, -1);
    for (let k = 0; k < 2000; k++, d = isoAdd(d, -1)) {
      if (d < (st.set.taxiFrom || d)) break;
      const p = planHours(st, d), x = st.shifts[d];
      if (p > 0) { if (x && x.h > 0) n++; else break; }
      else if (x && x.h > 0) n++;
    }
    return n;
  }
  // уровень оплаты пассажиров в час против исследования 18.11: плохой месяц 2 500, вероятный 2 900, хороший 3 400, соревнования от 3 900.
  // R без сезона, разгона новичка и роста (measuredR.R, цены rBase), иначе зима, первые недели и рост цен сдвигали бы вывод
  const P50 = 2900;
  function scenarioOf(R) {
    if (!R) return null;
    if (R < 2700) return { key: 'bad', name: 'ниже вероятных 2 900' };
    if (R < 3150) return { key: 'mid', name: 'около вероятных 2 900' };
    if (R < 3900) return { key: 'good', name: 'выше вероятных 2 900' };
    return { key: 'top', name: 'как на соревнованиях водителей' };
  }
  // цифра приложения за 12 часов по выручке пассажиров в час (в ценах дня) на той машине, что в этот день (или на машине ph)
  const appPer12 = (st, iso, R, ph) => { ph = ph || phaseAt(st, iso); return ph === 'pre' ? null : R * 12 * keepOf(st.set, ph); };

  // ---------------------------------------------------------------- цифры смен (экран «Цифры»)
  // оплата пассажиров в час по отчётам водителей Астаны, только Эконом с понятной основой (исследование 18.11.2026, earnings_reports.csv,
  // столбец gross_per_hour): S2 замеры смен от 7,5 ч (Байга Такси Колёса, Леди-батл, Демежан, удачное воскресенье) и S5 оценки
  // водителей про обычный полный день (2 614, 2 955, 3 333: обычные дни 2 600-3 300)
  const DRIVERS = [4814, 4329, 3789, 3448, 4076, 4535, 3713, 5080, 2614, 2955, 3333];
  // кредит за свою машину ещё открыт: по графику записанной машины, иначе по последней сверке или по плану (взнос меньше 100%)
  function loanOpen(st, iso) {
    const lp = st.car && st.car.loan ? loanPlan(st, iso) : null;
    if (lp) return lp.bal > 0.5;
    if (st.car) return false;
    const m = lastMoney(st, iso);
    return m && (m.car || 0) > 0 ? (m.loan || 0) > 0 : st.set.down < 100;
  }
  // платёж Kaspi в месяц на дату: по графику записанной машины, иначе по плану
  function loanPayAt(st, iso) {
    const g = st.set, lp = st.car && st.car.loan ? loanPlan(st, iso) : null;
    if (lp) return lp.bal > 0.5 ? lp.pay : 0;
    return g.down < 100 ? annuity(g.price * (1 - g.down / 100), g.rate / 100, g.months) : 0;
  }
  // план такси на весь месяц для порогов: неделя такси и правки дней с первой смены, без разгона новичка
  function taxiMonth(st, mk) {
    const g = st.set; let h = 0, sh = 0, e = 0;
    for (let d = 1; d <= dim(mk); d++) {
      const iso = mk + '-' + pad(d), x = g.taxiFrom && iso >= g.taxiFrom ? planHours(st, iso) : +((g.tpl || [])[dow(iso)] || 0);
      if (x > 0) { h += x; sh++; e += effH(x); }
    }
    return { h, sh, e, er: e, preDays: 0 };
  }
  // пороги месяца по модели приложения: сколько нужно в Яндекс Про, чтобы после жизни осталось 0 и 150 000 в Отбасы.
  // Месяц как в прогнозе: твой план месяца, жизнь (конверты с ростом цен или свой план месяца), сезон и расход топлива месяца, пропуски;
  // своя машина ещё со страховками по 1/12 и платежом Kaspi, пока кредит открыт. Деньги месяца линейны по выручке: порог по двум точкам.
  // kind 'rent', 'loan' или 'free'; at: цифра Яндекс Про за 12 ч в ценах месяца, до сотни, как на экране; R: те же пороги в оплате
  // пассажиров в час. ph: посчитать для аренды или своей машины (по умолчанию машина на эту дату). null: в месяце нет смен по плану
  const TARGET = 150000;
  function zonesAt(st, iso, ph) {
    const g = st.set, mk = mkOf(iso), fc = growth(g, mk)[0];
    ph = ph || (phaseAt(st, iso) === 'own' ? 'own' : 'rent');
    const kind = ph === 'own' ? (loanOpen(st, iso) ? 'loan' : 'free') : 'rent', hrs = taxiMonth(st, mk);
    const lost = (g.lostMe || 0) + (ph === 'own' ? g.lost || 0 : 0), hW = hrs.sh > 0 ? hrs.h * Math.max(0, hrs.sh - lost) / hrs.sh : 0;
    if (!(hW > 0)) return null;
    const life = lifeOf(st, mk, false), gas = ph === 'own' && gasOnMonth(g, mk, 'own');
    // деньги месяца без выручки: минус машина, мойка, бензин и жизнь (возраст 0,5: годовые страховки ниже по 1/12)
    const b = workMonth(g, mk, 0, ph, hrs, 0.5, 1, gas, { pre: 0, taxi: life }).free;
    const fixed = (ph === 'own' ? (g.ogpo + g.osgop) / 12 * fc : 0) + (kind === 'loan' ? loanPayAt(st, iso) : 0), k = keepOf(g, ph);
    // нужно в Яндекс Про за месяц: цель + машина и жизнь; делим на часы на линии и умножаем на 12
    const at = [TARGET, 0].map(t => Math.round((t + fixed - b) / hW * 12 / 100) * 100);
    return { kind, at, R: at.map(v => v / 12 / k), mk, sh: hrs.sh, h: hrs.h / hrs.sh, life, season: seasonOf(g, mk) };
  }
  // зона цифры за 12 ч: g от 150 000 в Отбасы, y после жизни плюс, r после жизни минус
  const zoneOf = (Z, v) => v >= Z.at[0] ? 'g' : v >= Z.at[1] ? 'y' : 'r';
  const WINTER = [12, 1, 2], SUMMER = [6, 7, 8];
  function shiftStats(st, iso) {
    const g = st.set, all = [], sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
    for (const [d, x] of Object.entries(st.shifts || {})) {
      if (d > iso || !x || !(x.h > 0)) continue;
      const ph = phaseAt(st, d), h = +x.h, app = x.app > 0 ? +x.app : 0, fr = growth(g, mkOf(d))[1], taxi = ph !== 'pre';
      // выручка пассажиров в час в ценах rBase (до июля 2027 тариф ровный): так месяцы, сезоны, аренда и своя машина сравниваются честно
      all.push({ d, h, app, taxi, ph, fr, rev: app && taxi ? app / h / keepOf(g, ph) / fr : null });
    }
    all.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    const kind = all.some(x => x.taxi && x.app) ? 'taxi' : all.some(x => x.app) ? 'pre' : null;
    const paid = all.filter(x => x.app && (kind === 'taxi') === x.taxi), d30 = isoAdd(iso, -29), d90 = isoAdd(iso, -89), mk = mkOf(iso);
    const perH = list => { const h = sum(list, x => x.h); return h ? sum(list, x => x.app) / h : null; };
    // зоны за 30 дней: только смены на той машине, что сейчас, по цифре приложения за 12 ч в ценах этого месяца.
    // Пороги считает модель на этот месяц (zonesAt), до сотни, как на экране, и смена сравнивается с ними же
    const phT = phaseAt(st, iso), own = phT === 'own', G = growth(g, mk)[1], kT = keepOf(g, phT === 'pre' ? 'rent' : phT);
    const Z = phT === 'pre' ? null : zonesAt(st, iso), zoneAt = Z ? Z.at : null;
    const at12 = rev => Math.round(rev * 12 * kT * G);
    const zl = kind === 'taxi' && Z ? paid.filter(x => x.d >= d30 && (x.ph === 'own') === own) : [], zh = sum(zl, x => x.h);
    // other: смены в окне на другой машине (первые недели после покупки), чтобы экран сказал, что считает только свою
    const other = kind === 'taxi' ? paid.filter(x => x.d >= d30 && (x.ph === 'own') !== own).length : 0;
    const zones = { g: 0, y: 0, r: 0, n: zl.length, own, kind: Z ? Z.kind : null, R: Z ? Z.R : null, Z, other, at: mk, avg: null, avgR: null, top: null };
    for (const x of zl) zones[zoneOf(Z, at12(x.rev))]++;
    // вывод по средней цифре за 12 ч (взвешенной по часам), как в исследовании, а не по самой частой зоне
    if (zh) { zones.avgR = sum(zl, x => x.rev * x.h) / zh; zones.avg = at12(zones.avgR); zones.top = zoneOf(Z, zones.avg); }
    // по месяцам за год: в приложении за час, как показывает Яндекс Про
    const months = [];
    for (let i = 11; i >= 0; i--) { const m = mkAdd(mk, -i), list = paid.filter(x => x.d.slice(0, 7) === m); months.push({ mk: m, perH: perH(list), n: list.length, winter: WINTER.indexOf(+m.slice(5)) >= 0 }); }
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => { const list = paid.filter(x => x.d >= d90 && dow(x.d) === i); return { i, perH: perH(list), n: list.length }; });
    // зима против лета в ценах rBase, от 3 смен в каждом сезоне: в такси по выручке пассажиров в час,
    // чтобы переход с аренды на свою машину не выдавал себя за сезон; в доставке по деньгам в час
    const seas = mon => { const list = paid.filter(x => mon.indexOf(+x.d.slice(5, 7)) >= 0), h = sum(list, x => x.h); return { n: list.length, v: h ? sum(list, x => kind === 'taxi' ? x.rev * x.h : x.app / x.fr) / h : null }; };
    const w = seas(WINTER), su = seas(SUMMER), season = w.n >= 3 && su.n >= 3 ? { diff: w.v / su.v - 1, nw: w.n, ns: su.n } : null;
    // твоё место среди водителей: выручка пассажиров в час за 30 дней, от 3 смен такси; отчёты переводим в цены этого месяца
    const r30 = paid.filter(x => x.taxi && x.d >= d30), rh = sum(r30, x => x.h), rev = rh ? sum(r30, x => x.app / keepOf(g, x.ph)) / rh : null, drivers = DRIVERS.map(v => v * G);
    const me = kind === 'taxi' && r30.length >= 3 ? { rev, above: drivers.filter(v => v < rev).length, total: drivers.length, n: r30.length } : null;
    // вероятно в эти дни: 2 900 опытного летом с ростом выручки, сезоном и разгоном новичка тех же смен (как measuredR, только наоборот),
    // поэтому водитель ровно на уровне исследования стоит на этой линии и зимой, и в первые недели. Без смен: сезон этого месяца
    const likely = rh ? sum(r30, x => P50 * x.fr * revF(g, x.d) * effH(x.h)) / rh : P50 * G * seasonOf(g, mk);
    // лучшая смена по деньгам в час из Яндекс Про, а не по сумме, чтобы не хвалить переработку; от 6 ч, чтобы не выиграл короткий час пик
    const val = x => x.app / x.h, best = paid.filter(x => x.h >= 6).reduce((b, x) => !b || val(x) > val(b) ? x : b, null);
    // средняя смена за 30 дней только по той работе, что сейчас: смены доставки по 5-8 ч не смешиваем со сменами такси
    const tNow = phaseAt(st, iso) !== 'pre', mon = all.filter(x => x.d.slice(0, 7) === mk), last = all.filter(x => x.d >= d30 && x.taxi === tNow);
    return { kind, zones, months, days, season, me, drivers, zoneAt, likely, likelyBase: P50 * G,
      tiles: { shifts: mon.length, hours: sum(mon, x => x.h), avgLen: last.length ? sum(last, x => x.h) / last.length : null, best: best ? { d: best.d, h: best.h, perH: best.app / best.h } : null } };
  }
  // студия по Отбасы 50/50, как в модели исследования (model_tb.first_deal и afford.py, без наличных и машины).
  // Цена на ползунке сегодняшняя и до месяца покупки растёт на 10% в год (g_flat). Договорная сумма равна цене в месяц покупки,
  // в оплату идёт весь депозит S, заём = цена - S. ОП x ДС / 1000 от ДС не зависит, значит ОП(цена) = ОП x ДС / цена.
  // Покупка в первый месяц прогноза, когда депозиту 3 года и либо депозита хватает без займа (как noloan_needs_op = False),
  // либо на нём половина цены и ОП(цена) от 16
  const FLAT_G = 10;
  function studio(st, iso, fc, price, gFlat) {
    const L = otbLocks(st, iso, fc), t0 = OP_TIERS[0], now = mkOf(iso), gf = gFlat != null ? gFlat : FLAT_G;
    const at = mk => price * Math.pow(1 + gf / 100, mkDiff(now, mk) / 12);
    const deal = (P, loan, tier) => { const n = tier ? tier.years * 12 : 0, pay = loan > 0 ? annuity(loan, tier.rate / 100 / 12, n) : 0; return { at: P, own: P - loan, loan, tier, pay, over: loan > 0 ? pay * n - loan : 0 }; };
    const rough = () => deal(price, price / 2, { op: t0[0], rate: t0[1], years: t0[2] });
    // депозит ещё не указан: грубо, пополам и по самому низкому ОП, в сегодняшних ценах
    if (!L) return Object.assign({ price, rough: true }, rough());
    const t1 = mkOf(L.locks[0].date), months = Object.keys(L.opAt).sort();
    // в текущем месяце opAt и остаток уже на конец месяца: «уже сейчас» только если замки открыты сегодня
    const today = P => { const S0 = Math.max(0, L.bal), okT = iso >= L.locks[0].date, okD = S0 >= P || (S0 >= P / 2 - 0.5 && L.opNow * L.ds / P >= 16); return { now: okT && okD, from: !okT && okD ? L.locks[0].date : null }; };
    for (const mk of months) {
      if (mk < t1 || mk < now) continue;
      const P = at(mk), S = Math.max(0, L.balAt[mk]), op = L.opAt[mk] * L.ds / P, base = Object.assign({ price, buy: mk, dep: S, ds: L.ds }, mk === now ? today(P) : {});
      if (S >= P) return Object.assign(base, deal(P, 0, null));
      if (S >= P / 2 - 0.5 && op >= 16) return Object.assign(base, { op }, deal(P, P - S, tierOf(op)));
    }
    // за горизонтом прогноза: чего не хватает в последнем месяце; плитки грубо, пополам и по ОП 16
    const lm = months[months.length - 1], P = lm ? at(lm) : price, S = lm ? Math.max(0, L.balAt[lm]) : Math.max(0, L.bal), op = lm ? L.opAt[lm] * L.ds / P : 0;
    return Object.assign({ price, beyond: true, dep: S, ds: L.ds, needTime: !lm || lm < t1, needHalf: S < P / 2 - 0.5, needOp: S < P && op < 16 }, rough());
  }

  // ---------------------------------------------------------------- путь: вехи и этапы
  function milestones(st, iso, fc) {
    const g = st.set, L = [];
    const add = (id, title, date, kind, hint) => { if (date) L.push({ id, title, date, kind, hint, done: !!st.done[id], doneOn: st.done[id] || null }); };
    add('otb-open', 'Открыть депозит Отбасы', g.otbOpen, 'task', 'Бесплатно и без первого взноса, прямо в приложении банка. Срок 3 года считается с открытия, поэтому открыть лучше сразу, а класть позже.');
    if (st.created < '2027') add('otb-2026', 'Положить на Отбасы ради премии за 2026 год', '2026-12-31', 'task', 'Только если остаётся запас на старт такси. Иначе хватит депозита с минимальным взносом: срок 3 года уже идёт.');
    if (g.preFrom) add('selfemp', 'Самозанятость и выход в доставку', g.preFrom, 'task', 'Оформить статус самозанятого и выйти на первую смену доставки.');
    if (g.preFrom) add('reg', 'Временная регистрация в Астане', isoAdd(g.preFrom, 20), 'task', 'Без неё после месяца в городе штраф. Хостелы её почти не делают, договорись с хозяином жилья.');
    add('license', 'Права', g.license, 'task', 'Коробку в права больше не пишут: сдал на автомате, ездить можно и на механике.');
    add('kaspi', 'Заявка на автокредит', g.carFrom ? isoAdd(g.carFrom, -30) : g.license, 'task', 'Банки смотрят подтверждённый доход за 6 месяцев: выписки Яндекс Про и взносы. Многие банки берут с 21 года. Спроси в банке заранее, засчитают ли доход самозанятого.');
    add('taxi', 'Первая смена', g.taxiFrom, 'task', 'Записывай за каждую смену крупную цифру Яндекс Про и часы на линии.');
    // 4 недели смен: пороги аренды на этот месяц по твоему плану и жизни (zonesAt), а не числа летнего месяца исследования
    if (g.taxiFrom) { const d4 = isoAdd(g.taxiFrom, 28), Z = zonesAt(st, d4, 'rent');
      add('check4w', '4 недели смен: решить про аренду', d4, 'task', Z ? `На аренде от ${money(Z.at[0])} за 12 ч в Яндекс Про можно класть 150 000 в Отбасы. Меньше ${money(Z.at[1])} после жизни минус: тогда своя машина как можно раньше. Это по твоему плану и жизни на ${monthName(Z.mk)}.`
        : 'Сравни свою цифру за 12 ч в Яндекс Про с порогами на экране Цифры.'); }
    add('car', 'Своя машина', g.carFrom, 'task', 'Проверить машину и коробку на СТО до покупки. Работать напрямую с Яндексом, без парка.');
    // газ не веха и не опыт: Яндекс Про в Астане на очной проверке требует машину без ГБО (исследование 18.11)
    if (fc && fc.closed) add('loan', 'Кредит за машину закрыт', fc.closed + '-' + pad(dim(fc.closed)), 'auto', 'Всё свободное идёт в досрочку.');
    for (let y = 2027; y <= +g.deadline.slice(0, 4); y++) {
      const put = otbYear(fc, y), s = Math.round(put / 10000) * 10000;
      add('otb-y' + y, 'Отбасы: взносы за ' + y + ' год', y + '-12-31', 'task', (fc ? 'По прогнозу за год около ' + money(s) + '. ' : '') + 'Премия 20% от взносов, до 200 МРП в год, остаток переносится на следующий год.');
    }
    if (fc && fc.goal) add('goal', money(g.target) + ' активов', fc.goal.iso, 'auto', 'Срок: ' + dateLong(g.deadline) + '.');
    else add('goal', money(g.target) + ' активов', g.deadline, 'fixed', 'Срок цели.');
    add('otb-3y', 'Депозиту 3 года: можно покупать по схеме 50/50', g.otbOpen ? addYears(g.otbOpen, 3) : '', 'fixed', 'С этого дня Отбасы даёт заём под 50/50.');
    L.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    return L;
  }
  // сколько по прогнозу ляжет в Отбасы за год (для текущего года вместе с уже внесённым)
  function otbYear(fc, y) {
    if (!fc) return 0;
    let x = fc.s0 && fc.s0.iso.slice(0, 4) === String(y) ? fc.s0.yc || 0 : 0;
    for (const r of fc.rows) if (r.mk.slice(0, 4) === String(y)) x += r.oc || 0;
    return x;
  }
  // конверты месяца: что нужно оплатить заработком смен (жизнь и обязательное по машине), по очереди
  function monthNeed(st, mk) {
    const g = st.set, fc = growth(g, mk)[0], last = mk + '-' + pad(dim(mk)), ov = st.months && st.months[mk], n = dim(mk);
    let ph = phaseOfMonth(g, mk);
    if (ph === 'own' && phaseAt(st, last) !== 'own') ph = 'rent';
    const pre = ph === 'pre', own = hasOv(ov), preDays = pre ? n : monthPlan(st, mk).preDays, tf = (n - preDays) / n;
    // в месяц первой смены такси конверты смешиваются: дни до неё по конвертам до такси
    const env = ENV.map(k => ({ key: k, title: ENV_TITLE[k], v: own ? +ov[k] || 0 : Math.round(((+g.envPre[k] || 0) * preDays + (+g.env[k] || 0) * (n - preDays)) / n * fc / 1000) * 1000 }));
    let car = 0;
    if (ph === 'rent') car = g.rentOther * fc * tf;
    if (ph === 'own') {
      const m = lastMoney(st, last);
      const lp = st.car && st.car.loan ? loanPlan(st, mk + '-01') : null;
      car = ownFixed(g) * fc + (lp ? (lp.bal > 0 ? lp.pay : 0) : m && m.loan > 0 ? annuity(g.price * (1 - g.down / 100), g.rate / 100, g.months) : 0);
    }
    if (car > 0) env.splice(1, 0, { key: 'car', title: ph === 'own' ? 'Машина и кредит' : 'Парк и мелочи', v: Math.round(car / 1000) * 1000 });
    return { mk, pre, own, mixed: preDays > 0 && preDays < n, env, total: env.reduce((s, x) => s + x.v, 0) };
  }
  // машины для такси: цены (медианы Kolesa), расход и простои как в исследовании 17.11.2026 (cars_model.py, downtime.py).
  // Ремонт на км: автомат около 2,5 млн по исследованию 18.11 (11,8 ₸ в ценах июля 2027), у остальных в той же пропорции, что их резерв 17.11
  const CARS = [
    { id: 'cobalt', name: 'Cobalt автомат', how: 'кредит, взнос 10%', price: 2500000, down: 10, v36: 1750000, l100: 10.5, repairKm: 11.13, lost: 1.2 },
    { id: 'nexia3', name: 'Nexia R3 механика', how: 'кредит, взнос 10%', price: 2980000, down: 10, v36: 2300000, l100: 9, repairKm: 8.66, lost: 0.6 },
    { id: 'priora', name: 'Приора механика', how: 'кредит, взнос 10%', price: 2250000, down: 10, v36: 1800000, l100: 10.5, repairKm: 11.13, lost: 1.2 },
    { id: 'nexia', name: 'Nexia 2005-2014 механика', how: 'за наличные', price: 1100000, down: 100, v36: 850000, l100: 9.5, repairKm: 12.37, lost: 1.6 },
    { id: 'vaz', name: 'ВАЗ 2110 механика', how: 'за наличные', price: 685000, down: 100, v36: 500000, l100: 10.5, repairKm: 13.6, lost: 2 },
  ];
  // топливо своей машины в месяц по плану: бензин и газ, расход по сезону месяца
  function fuelMonth(g, mk) {
    const tpl = g.tpl || [], n = tpl.reduce((s, x) => s + (+x || 0), 0) * 52 / 12, sh = tpl.filter(x => x > 0).length * 52 / 12;
    const k = sh > 0 ? Math.max(0, (sh - (g.lost || 0) - (g.lostMe || 0)) / sh) : 1, km = g.kmH * n * k, fc = growth(g, mk)[0], fs = fuelSeason(g, mk);
    return { petrol: km * g.l100 * fs / 100 * g.petrol * fc, gas: km * g.l100 * fs * g.gasX / 100 * g.gas * fc };
  }
  // запас денег к первой смене такси: сколько будет на руках и сколько нужно на старт
  function runway(st, fc, iso) {
    const g = st.set;
    if (!fc || !g.taxiFrom || iso >= g.taxiFrom) return null;
    const tm = mkOf(g.taxiFrom);
    let at = fc.s0.cash, low = at, lowMk = mkOf(iso), neg = at < 0 ? mkOf(iso) : null;
    for (const r of fc.rows) {
      if (r.mk >= tm) break;
      at = r.cash;
      if (r.cash < low) { low = r.cash; lowMk = r.mk; }
      if (r.cash < 0 && !neg) neg = r.mk;
    }
    // дни месяца первой смены до неё: подработка и жизнь до такси, плюс траты, запланированные на этот месяц
    const cur = tm === mkOf(fc.s0.iso), mp = monthPlan(st, tm, cur ? fc.s0.iso : null);
    let ev = 0;
    for (const x of entries(st)) if (isAdd(x) && !x.move && x.d > iso && x.d < g.taxiFrom && mkOf(x.d) === tm) ev += +x.add || 0;
    at += ev + mp.preH * g.preRate - lifeOf(st, tm, true) * mp.preDays / dim(tm);
    if (at < low) { low = at; lowMk = tm; }
    if (at < 0 && !neg) neg = tm;
    let workDays = 0;
    for (let d = fc.s0.iso; d < g.taxiFrom; d = isoAdd(d, 1)) if (planHours(st, d) > 0) workDays++;
    // сколько нужно к первой смене: чтобы аренда до своей машины и её покупка в срок (взнос и оформление) не опустили деньги ниже
    // запаса на старт (startBuf). Прогноз с покупкой в срок, даже если денег не хватает: самая низкая точка денег от первой смены
    // до покупки и в миг сразу после неё (дальше прогноз сам кладёт свободное в досрочку). Без своей машины в плане:
    // первые 3 месяца такси
    const carMk = !st.car && g.carFrom ? mkOf(g.carFrom) : null, endMk = carMk ? (carMk > tm ? carMk : tm) : mkAdd(tm, 2);
    const pf = project(st, fc.s0, { R: fc.R, events: futureEvents(st, iso), forceCar: true, months: mkDiff(mkOf(fc.s0.iso), endMk) + 1 });
    let lowT = at;
    for (const r of pf.rows) if (r.mk >= tm && (carMk ? r.mk < endMk : r.mk <= endMk) && r.cash < lowT) lowT = r.cash;
    if (carMk && pf.afterBuy != null && pf.afterBuy < lowT) lowT = pf.afterBuy;
    const need = g.startBuf + Math.max(0, at - lowT), short = Math.max(0, need - at);
    return { at, low, lowMk, neg, need, buf: g.startBuf, carMk, short, workDays, extraH: short > 0 && workDays > 0 && g.preRate > 0 ? short / g.preRate / workDays : 0 };
  }
  const PHASES = ['Подготовка', 'Права', 'Аренда', 'Своя машина и кредит', 'Копим в Отбасы', 'Покупка квартиры'];
  function phaseNow(st, iso, fc) {
    const g = st.set;
    let n;
    if (iso < g.license && !st.done.license) n = iso < isoAdd(g.license, -180) ? 1 : 2;
    else if (!g.taxiFrom || iso < g.taxiFrom) n = 2;
    else if (g.carFrom && iso >= g.carFrom && (!fc || !fc.closed || iso <= fc.closed + '-31')) n = 4;
    else if (!g.carFrom || iso < g.carFrom) n = 3;
    else n = 5;
    if (g.otbOpen && iso >= addYears(g.otbOpen, 3)) n = 6;
    return { n, total: PHASES.length, title: PHASES[n - 1] };
  }

  // ---------------------------------------------------------------- подсказки и похвала
  function dayMessage(st, iso, fc) {
    const s = shiftDay(st, iso, fc);
    if (s.fact == null) return null;
    const dd = Math.abs(s.days) >= 0.05 ? daysText(Math.abs(s.days)) : null;
    if (s.plan === 0 && s.fact > 0) return { tone: 'good', text: 'Выходной в работу: ' + money(s.money, true) + (dd ? ', цель ближе на ' + dd : '') + '.' };
    if (s.delta > 0) return { tone: 'good', text: '+' + num1(s.delta) + NB + 'ч сверх плана' + (dd ? ': цель ближе на ' + dd : '') + '.' };
    if (s.delta < 0) return { tone: 'warn', text: num1(s.delta).replace('-', '−') + NB + 'ч от плана' + (dd ? ': цель дальше на ' + dd : '') + '. Можно добрать на неделе.' };
    return { tone: 'ok', text: 'Смена по плану. Так держать.' };
  }

  // доход самозанятого за календарный месяц по записанным сменам и лимит: в лимит идёт весь доход месяца вместе,
  // в такси оплата пассажиров (в ценах своего дня), до такси заработок на доставке (исследование 18.11, taxes.json)
  function seMonth(st, mk) {
    let taxi = 0, pre = 0;
    for (const [d, x] of Object.entries(st.shifts)) if (d.slice(0, 7) === mk && x && x.app > 0) { const ph = phaseAt(st, d); if (ph === 'pre') pre += +x.app; else taxi += x.app / keepOf(st.set, ph); }
    const gross = taxi + pre;
    return { gross, taxi, pre, lim: seLimit(mk), share: gross / seLimit(mk) };
  }

  return {
    DEF, OLD_DEF, OLD_DEF2, RES, datesFrom, newState, migrate, today, isoAdd, isoDiff, mkOf, mkAdd, mkDiff, dim, dow, monday, addYears, pad,
    plural, money, mln, num1, grp, dateLong, dateShort, monthName, daysText, untilText, DOW, DOWL, MON, MONG,
    planHours, phaseOn, phaseOfMonth, monthPlan, keepOf, fuelPerHour, growth, rentF, rentOf, annuity, carValue, startCost, workMonth, project,
    addMonths, loanRate, applyCar, loanPlan, payoffPreview, carNow, gradeOf, GRADES, shiftMoney, otbLocks, OP_TIERS, tierOf,
    ENV, ENV_TITLE, envSum, lifeOf, monthNeed, CARS, fuelMonth,
    phaseAt, shiftAfter, hasOv, moneyKey, forget, rentVsOwn, crossDate, valueAt, naOf, isAdd, byDate, lastMoney, entries, addsSince, moneyLine, futureEvents, otbState, runway, measuredR, usedR, dayMoney, dayFixed, estimate, startState,
    forecast, makeBase, versusPlan, daysFor, needExtra, hourValue, hoursMoney, shiftCost, shiftDay, rangeStats, weekStats, monthStats, streak, scenarioOf, appPer12,
    milestones, otbYear, phaseNow, PHASES, dayMessage, shiftStats, studio, DRIVERS, P50, TARGET, zonesAt, zoneOf, loanOpen, loanPayAt, taxiMonth,
    SEASON, RAMP, LATE, effH, seasonOf, rampOf, fuelSeason, seLimit, seMonth,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
