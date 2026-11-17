/* Путь к квартире: расчётное ядро. Чистые функции без DOM.
   Даты: день 'YYYY-MM-DD', месяц 'YYYY-MM'. Деньги в тенге.
   Помесячная модель повторяет notes/calc/taksi_cobalt_2026-11-14/scenarios_2026-11-17/model_tb (сверено 17.11.2026):
   аренда, своя машина в кредит Kaspi с досрочкой, Отбасы с премией 20% и переносом сверх потолка, износ машины. */
const Core = (() => {
  'use strict';

  // ---------------------------------------------------------------- настройки по умолчанию (общие цифры исследования)
  const DEF = {
    target: 4000000,          // цель: активы = деньги + Отбасы + машина − кредит
    deadline: '',             // срок цели (пусто: 3 года от первого запуска, см. datesFrom)
    start: '2026-11',         // от этого месяца растут цены и выручка
    living: 240000,           // жизнь в месяц на такси, цены ноября 2026 (сумма конвертов env)
    gCost: 9, gRev: 4.5,      // рост цен и выручки, % в год
    R: 3000,                  // сколько платят пассажиры за час на линии, ₸, до комиссий
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
    rentDay: 10000, park: 5.9, rentL100: 10.5, rentOther: 7071,
    price: 2500000, down: 10, rate: 2.509, months: 60, l100: 11.0, repair: 45000, v36: 1750000, lost: 1.2,
    fuel: 'petrol', petrol: 255, gas: 112, gasX: 1.2, gasCost: 240000, gasFrom: '',
    skin: 'taxi',             // цвет машины на дороге (открываются с уровнем)
    yandex: 17, tax: 4, kmH: 17.1, wash26: 22000, phone: 5990,
    ogpo: 79002, osgop: 14079, regFee: 20180, diag: 15990,
    oil: 20200, oilKm: 7500, tires: 122000, tiresKm: 60000, taxTech: 27653, battery: 828,
    otbLoan: 50000, otbCap: 938600, otbCap26: 865000, otbPrem: 20, otbRate: 2,
  };

  // ---------------------------------------------------------------- даты
  const pad = n => String(n).padStart(2, '0');
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
    return { v: 1, created: t, updated: 0, set: Object.assign({}, DEF, datesFrom(t), { tpl: DEF.tpl.slice(), preTpl: DEF.preTpl.slice(), env: Object.assign({}, DEF.env), envPre: Object.assign({}, DEF.envPre) }), base: null, money: [], shifts: {}, over: {}, done: {}, quests: [], months: {}, mood: {}, del: {}, car: null };
  }
  function migrate(s) {
    if (!s || typeof s !== 'object') return newState();
    const out = Object.assign(newState(s.created), s);
    out.set = Object.assign({}, DEF, datesFrom(out.created), s.set || {});
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
    for (const k of ['shifts', 'over', 'done', 'del']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    // старые копии с целью без даты: день, когда поставил цель, не должен каждый день переезжать на сегодня
    if (out.set.why && !out.set.whyOn) out.set.whyOn = out.created;
    if (!Array.isArray(out.money)) out.money = [];
    if (!Array.isArray(out.quests)) out.quests = [];
    out.money = out.money.filter(m => m && m.d).sort(byDate);
    if (!out.car || typeof out.car !== 'object' || !out.car.on || !(out.car.price > 0)) out.car = null;
    applyCar(out);
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
  const growth = (g, mk) => { const t = mkDiff(g.start, mk); return [Math.pow(1 + g.gCost / 100, t / 12), Math.pow(1 + g.gRev / 100, t / 12)]; };
  const keepOf = (g, ph) => 1 - g.yandex / 100 - g.tax / 100 - (ph === 'rent' ? g.park / 100 : 0);
  // газ на своей машине: с месяца установки (пусто: сразу с покупки)
  const gasOnDay = (g, iso, ph) => g.fuel === 'gas' && ph === 'own' && (!g.gasFrom || g.gasFrom <= iso);
  const gasOnMonth = (g, mk, ph) => g.fuel === 'gas' && ph === 'own' && (!g.gasFrom || mkOf(g.gasFrom) <= mk);
  function fuelPerHour(g, mk, ph, gas) {
    const fc = growth(g, mk)[0];
    if (ph === 'rent') return g.kmH * g.rentL100 / 100 * g.petrol * fc;
    if (ph === 'own') { if (gas == null) gas = gasOnMonth(g, mk, ph); return g.kmH * g.l100 * (gas ? g.gasX : 1) / 100 * (gas ? g.gas : g.petrol) * fc; }
    return 0;
  }
  // часы и смены по плану за месяц, начиная с дня from (правки дней учитываются).
  // h, sh: такси; preH, preSh, preDays: подработка и дни до первой смены такси
  function monthPlan(st, mk, from) {
    const g = st.set; let h = 0, sh = 0, preH = 0, preSh = 0, preDays = 0; const n = dim(mk);
    for (let d = 1; d <= n; d++) {
      const iso = mk + '-' + pad(d);
      if (from && iso < from) continue;
      const pre = !g.taxiFrom || iso < g.taxiFrom;
      if (pre) preDays++;
      const x = planHours(st, iso);
      if (x > 0) { if (pre) { preH += x; preSh++; } else { h += x; sh++; } }
    }
    return { h, sh, preH, preSh, preDays };
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
  const startCost = g => g.price * g.down / 100 + g.ogpo + g.osgop + g.regFee + g.diag;

  // деньги месяца после жизни, без платежа по кредиту. frac: какая доля месяца ещё впереди
  function workMonth(g, mk, R, ph, hrs, age, frac, gas, lf) {
    const [fc, fr] = growth(g, mk), n = dim(mk);
    lf = lf || { pre: g.preLiving * fc, taxi: g.living * fc };
    // дни до первой смены такси: подработка и жизнь до такси
    const preF = hrs.preDays != null ? Math.min(frac, hrs.preDays / n) : ph === 'pre' ? frac : 0, taxF = Math.max(0, frac - preF);
    const preInc = (hrs.preH || 0) * g.preRate, preLife = lf.pre * preF;
    if (ph === 'pre') return { rev: preInc, free: preInc - preLife };
    const k = ph === 'own' && hrs.sh > 0 ? Math.max(hrs.sh - g.lost * taxF, 0) / hrs.sh : 1;
    const h = hrs.h * k, sh = hrs.sh * k, km = g.kmH * h, rev = R * fr * h, keep = keepOf(g, ph);
    const wash = g.wash26 * sh / 26 * fc, life = lf.taxi * taxF + preLife;
    if (ph === 'rent') {
      return { rev: rev + preInc, free: rev * keep + preInc - g.rentDay * hrs.sh * fc - km * g.rentL100 / 100 * g.petrol * fc - wash - g.rentOther * fc * taxF - life };
    }
    const fuel = fuelPerHour(g, mk, ph, gas) * h;
    const other = (g.phone + g.taxTech / 12 + g.battery + g.repair) * fc * taxF + (g.oil / g.oilKm + g.tires / g.tiresKm) * km * fc;
    const ai = Math.ceil(age - 1e-9), ins = ai > 0 && ai % 12 === 0 ? (g.ogpo + g.osgop) * fc : 0; // возраст бывает дробным, если прогноз с середины месяца
    return { rev: rev + preInc, free: rev * keep + preInc - fuel - wash - other - ins - life };
  }

  // s0: {iso, cash, otb, car, loan, owned, carAge, yc, yi, carry, pend}; o: {R, extraWeek, months, plan, events}
  function project(st, s0, o) {
    o = o || {};
    const g = st.set, R = o.R || g.R, r = s0.r != null ? s0.r : g.rate / 100, out = [];
    const pay = s0.pay != null ? s0.pay : annuity(g.price * (1 - g.down / 100), r, g.months);
    let cash = s0.cash || 0, otb = s0.otb || 0, loan = s0.loan || 0, owned = !!s0.owned, age = s0.carAge || 0;
    let carV = owned ? (s0.car != null ? s0.car : carValue(g, age)) : 0;
    let yc = s0.yc || 0, yi = s0.yi || 0, carry = s0.carry || 0, pend = s0.pend || 0;
    let warn = null, closed = null, bought = null;
    let gasDone = owned && g.fuel === 'gas' && (!g.gasFrom || g.gasFrom <= s0.iso);
    const mk0 = mkOf(s0.iso), N = o.months || Math.max(24, mkDiff(mk0, mkOf(g.deadline)) + 40);
    const slopeCar = owned ? Math.max(0, (g.price - g.v36) / 36) : 0;
    let mk = mk0;
    for (let i = 0; i < N; i++, mk = mkAdd(mk, 1)) {
      const frac = i === 0 ? (dim(mk) - +s0.iso.slice(8) + 1) / dim(mk) : 1;
      if (o.events && o.events[mk]) cash += o.events[mk];
      if (pend && (+mk.slice(5) === 3 || (i === 0 && +mk.slice(5) > 3))) { otb += pend; pend = 0; }
      let ph = phaseOfMonth(g, mk);
      if (ph === 'own' && !owned) {
        const sc = startCost(g);
        if (cash >= sc - 0.5) {
          cash -= sc; loan = g.price * (1 - g.down / 100); carV = g.price; owned = true; age = 0; bought = mk;
          const x = Math.min(Math.max(cash, 0), loan); if (x > 0 && (x >= pay - 0.5 || x >= loan - 0.5)) { loan -= x; cash -= x; }
        } else { ph = 'rent'; if (!warn) warn = { mk, short: sc - cash }; }
      }
      if (owned && g.fuel === 'gas' && !gasDone && (!g.gasFrom || mkOf(g.gasFrom) <= mk)) { cash -= g.gasCost * growth(g, mk)[0]; gasDone = true; }
      let hrs = o.fixed ? (ph === 'pre' ? { h: 0, sh: 0 } : { h: o.fixed.h * frac, sh: o.fixed.sh * frac }) : o.plan === false ? { h: 0, sh: 0 } : monthPlan(st, mk, i === 0 ? s0.iso : null);
      if (o.extraWeek && ph !== 'pre') hrs = Object.assign({}, hrs, { h: Math.max(0, hrs.h + o.extraWeek * Math.max(0, dim(mk) * frac - (hrs.preDays || 0)) / 7) });
      const wm = workMonth(g, mk, R, ph, hrs, owned ? age : 0, frac, ph === 'own' && gasDone, { pre: lifeOf(st, mk, true), taxi: lifeOf(st, mk, false) });
      let A = wm.free, due = 0, oc = 0;
      if (owned && loan > 0) { const it = loan * r * frac; due = Math.min(pay * frac, loan + it); loan += it - due; if (loan < 0.5) { loan = 0; closed = closed || mk; } }
      A -= due;
      if (A < 0) cash += A;
      else {
        if (cash < 0) { const x = Math.min(A, -cash); cash += x; A -= x; }
        if (ph === 'pre') cash += A;
        else if (!owned) {
          const short = g.carFrom ? Math.max(0, startCost(g) - cash) : 0;
          let x = Math.min(short, A); cash += x; A -= x;
          x = Math.min(g.otbLoan * frac, A); otb += x; yc += x; oc += x; A -= x; cash += A;
        } else if (loan > 0) {
          const x = Math.min(g.otbLoan * frac, A); otb += x; yc += x; oc += x; A -= x; cash += A;
          if (cash >= pay - 0.5 || cash >= loan - 0.5) { const y = Math.min(cash, loan); loan -= y; cash -= y; if (loan < 0.5) { loan = 0; closed = closed || mk; } }
        } else { const x = A + Math.max(0, cash); otb += x; yc += x; oc += x; cash = Math.min(cash, 0); }
      }
      const it = otb * g.otbRate / 100 / 12 * frac; otb += it; yi += it;
      if (+mk.slice(5) === 12) { const base = yc + yi + carry, cap = mk < '2027' ? g.otbCap26 : g.otbCap, rew = Math.min(base, cap); pend += rew * g.otbPrem / 100; carry = base - rew; yc = 0; yi = 0; }
      if (owned) { age += frac; carV = slopeCar && s0.owned ? Math.max(0, carV - slopeCar * frac) : carValue(g, age); }
      out.push({ mk, ph, h: hrs.h, rev: wm.rev, free: wm.free, cash, otb, oc, pend, car: carV, loan, na: cash + otb + pend + carV - loan });
    }
    return { rows: out, warn, closed, bought };
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

  // выручка в час по записанным сменам (что платят пассажиры, до комиссий, в ценах ноября 2026)
  function measuredR(st, iso, days) {
    const g = st.set; let rh = 0, h = 0, n = 0;
    const from = days ? isoAdd(iso, -days) : '0000';
    for (const [d, x] of Object.entries(st.shifts)) {
      if (d > iso || d < from || !x || !(x.h > 0) || !(x.app > 0)) continue;
      const ph = phaseAt(st, d); if (ph === 'pre') continue;
      rh += x.app / keepOf(g, ph) / growth(g, mkOf(d))[1]; h += +x.h; n++;
    }
    return n ? { R: rh / h, n, h } : { R: null, n: 0, h: 0 };
  }
  const usedR = (st, iso, cache) => {
    if (cache) { const k = mkOf(iso); if (!cache.has(k)) cache.set(k, usedR(st, k + '-' + pad(dim(k)))); return cache.get(k); }
    const m = measuredR(st, iso, 120); return st.set.rLog && m.n >= 10 ? m.R : st.set.R;
  };

  // сколько остаётся с одного дня работы: деньги в руки минус топливо, мойка и аренда за этот день
  function dayMoney(st, iso, h, app, cache) {
    const g = st.set, ph = phaseAt(st, iso);
    if (!(h > 0)) return { income: 0, costs: 0, net: 0, ph };
    if (ph === 'pre') { const income = app > 0 ? +app : g.preRate * h; return { income, costs: 0, net: income, ph }; }
    const mk = mkOf(iso), [fc, fr] = growth(g, mk);
    const income = app > 0 ? +app : usedR(st, iso, cache) * fr * h * keepOf(g, ph); // выручку в час считаем, только если суммы нет
    const costs = fuelPerHour(g, mk, ph, gasOnDay(g, iso, ph)) * h + g.wash26 / 26 * fc + (ph === 'rent' ? g.rentDay * fc : 0) +
      (ph === 'own' ? (g.oil / g.oilKm + g.tires / g.tiresKm) * g.kmH * h * fc : 0);
    return { income, costs, net: income - costs, ph };
  }
  // постоянные расходы за день (жизнь, связь, резерв на ремонт), они идут и в выходные.
  // m: последняя отметка; со своей машиной ещё проценты по кредиту и износ машины
  function dayFixed(st, iso, m) {
    const g = st.set, mk = mkOf(iso), fc = growth(g, mk)[0], ph = phaseAt(st, iso), n = dim(mk);
    if (ph === 'pre') return lifeOf(st, mk, true) / n;
    const extra = ph === 'rent' ? g.rentOther : g.phone + g.taxTech / 12 + g.battery + g.repair;
    let v = (lifeOf(st, mk, false) + extra * fc) / n;
    if (ph === 'own' && m && (m.car || 0) > 0) {
      const lp = st.car && st.car.loan ? loanPlan(st, iso) : null;
      v += ((lp ? lp.bal * lp.r : (m.loan || 0) * g.rate / 100) + Math.max(0, g.price - g.v36) / 36) / n;
    }
    return v;
  }
  // из них износ машины за день: в оценке он уменьшает цену машины, а не деньги
  const dayDep = (st, iso, m) => phaseAt(st, iso) === 'own' && m && (m.car || 0) > 0 ? Math.max(0, st.set.price - st.set.v36) / 36 / dim(mkOf(iso)) : 0;
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
    let lo = 0, hi = 48;
    const base = { s0: f0.s0, R: f0.R, events: futureEvents(st, iso) };
    const ok = x => { const f = forecast(st, iso, Object.assign({ extraWeek: x }, base)); return f.goal && f.goal.iso <= dl; };
    if (!ok(hi)) return { extra: null, fc: f0 };
    for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    return { extra: Math.ceil(hi * 2) / 2, fc: f0 };
  }

  // ---------------------------------------------------------------- смены: день, неделя, месяц
  // сколько остаётся с часа сверх плана: выручка после комиссий и налога минус топливо
  function hourValue(st, iso) {
    const g = st.set, ph = phaseAt(st, iso);
    if (ph === 'pre') return g.preRate;
    const mk = mkOf(iso);
    return usedR(st, iso) * growth(g, mk)[1] * keepOf(g, ph) - fuelPerHour(g, mk, ph, gasOnDay(g, iso, ph));
  }
  // мойка и аренда за выход на смену
  function shiftCost(st, iso) {
    const g = st.set, ph = phaseAt(st, iso), fc = growth(g, mkOf(iso))[0];
    return ph === 'pre' ? 0 : g.wash26 / 26 * fc + (ph === 'rent' ? g.rentDay * fc : 0);
  }
  // день: эффект на цель считается от разницы в часах с планом (выручка за час как в среднем)
  function shiftDay(st, iso, fc) {
    const plan = planHours(st, iso), x = st.shifts[iso] || null;
    if (!x) return { iso, plan, fact: null, app: null, delta: 0, money: 0, days: 0 };
    const fact = +x.h || 0, app = +x.app || 0, v = hourValue(st, iso);
    let moneyDelta = (fact - plan) * v;
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
  // уровень по выручке в час: с каким сценарием совпадает
  function scenarioOf(R) {
    if (!R) return null;
    if (R < 2900) return { key: 'bad', name: 'плохой', hint: 'на аренде в минус: своя машина, газ и 7/0' };
    if (R < 3200) return { key: 'reliable', name: 'надёжный', hint: 'на аренде почти ничего не остаётся: своя машина как можно раньше' };
    if (R < 3700) return { key: 'mid', name: 'средний', hint: 'всё идёт по плану' };
    return { key: 'good', name: 'хороший', hint: 'можно копить и на аренде' };
  }
  // цифра приложения за 12 часов по выручке в час и фазе
  const appPer12 = (st, iso, R) => { const g = st.set, ph = phaseAt(st, iso); return ph === 'pre' ? null : R * growth(g, mkOf(iso))[1] * 12 * keepOf(g, ph); };

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
    add('taxi', 'Первая смена', g.taxiFrom, 'task', 'Записывай цифру Яндекс Про за каждую смену.');
    add('check4w', '4 недели смен: решить про аренду', g.taxiFrom ? isoAdd(g.taxiFrom, 28) : '', 'task', 'От 30 000 ₸ за 12 ч можно копить на аренде, меньше 26 600 ₸ сразу своя машина.');
    add('car', 'Своя машина', g.carFrom, 'task', 'Проверить машину и коробку на СТО до покупки.');
    if (g.fuel === 'gas') add('gas', 'Поставить газ', g.gasFrom || g.carFrom, 'task', 'Около 240 000 ₸, окупается за 2-5 месяцев.');
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
      car = (g.phone + g.taxTech / 12 + g.battery + g.repair) * fc + (lp ? (lp.bal > 0 ? lp.pay : 0) : m && m.loan > 0 ? annuity(g.price * (1 - g.down / 100), g.rate / 100, g.months) : 0);
    }
    if (car > 0) env.splice(1, 0, { key: 'car', title: ph === 'own' ? 'Машина и кредит' : 'Парк и мелочи', v: Math.round(car / 1000) * 1000 });
    return { mk, pre, own, mixed: preDays > 0 && preDays < n, env, total: env.reduce((s, x) => s + x.v, 0) };
  }
  // машины для такси: цены (медианы Kolesa), расход, ремонт и простои как в исследовании 17.11.2026 (cars_model.py, downtime.py)
  const CARS = [
    { id: 'cobalt', name: 'Cobalt автомат', how: 'кредит, взнос 10%', price: 2500000, down: 10, v36: 1750000, l100: 11, repair: 45000, lost: 1.2 },
    { id: 'nexia3', name: 'Nexia R3 механика', how: 'кредит, взнос 10%', price: 2980000, down: 10, v36: 2300000, l100: 9, repair: 35000, lost: 0.6 },
    { id: 'priora', name: 'Приора механика', how: 'кредит, взнос 10%', price: 2250000, down: 10, v36: 1800000, l100: 10.5, repair: 45000, lost: 1.2 },
    { id: 'nexia', name: 'Nexia 2005-2014 механика', how: 'за наличные', price: 1100000, down: 100, v36: 850000, l100: 9.5, repair: 50000, lost: 1.6 },
    { id: 'vaz', name: 'ВАЗ 2110 механика', how: 'за наличные', price: 685000, down: 100, v36: 500000, l100: 10.5, repair: 55000, lost: 2 },
  ];
  // топливо своей машины в месяц по плану: бензин и газ (для улучшения «газ»)
  function fuelMonth(g, mk) {
    const tpl = g.tpl || [], n = tpl.reduce((s, x) => s + (+x || 0), 0) * 52 / 12, sh = tpl.filter(x => x > 0).length * 52 / 12;
    const k = sh > 0 ? Math.max(0, (sh - g.lost) / sh) : 1, km = g.kmH * n * k, fc = growth(g, mk)[0];
    return { petrol: km * g.l100 / 100 * g.petrol * fc, gas: km * g.l100 * g.gasX / 100 * g.gas * fc };
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
    const short = Math.max(0, g.startBuf - at);
    return { at, low, lowMk, neg, need: g.startBuf, short, workDays, extraH: short > 0 && workDays > 0 && g.preRate > 0 ? short / g.preRate / workDays : 0 };
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

  return {
    DEF, datesFrom, newState, migrate, today, isoAdd, isoDiff, mkOf, mkAdd, mkDiff, dim, dow, monday, addYears, pad,
    plural, money, mln, num1, grp, dateLong, dateShort, monthName, daysText, untilText, DOW, DOWL, MON,
    planHours, phaseOn, phaseOfMonth, monthPlan, keepOf, fuelPerHour, growth, annuity, carValue, startCost, workMonth, project,
    addMonths, loanRate, applyCar, loanPlan, payoffPreview, carNow,
    ENV, ENV_TITLE, envSum, lifeOf, monthNeed, CARS, fuelMonth,
    phaseAt, shiftAfter, hasOv, moneyKey, forget, crossDate, valueAt, naOf, isAdd, byDate, lastMoney, entries, addsSince, moneyLine, futureEvents, otbState, runway, measuredR, usedR, dayMoney, dayFixed, estimate, startState,
    forecast, makeBase, versusPlan, daysFor, needExtra, hourValue, shiftCost, shiftDay, rangeStats, weekStats, monthStats, streak, scenarioOf, appPer12,
    milestones, otbYear, phaseNow, PHASES, dayMessage,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
