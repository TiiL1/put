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
    living: 240000,           // жизнь в месяц, цены ноября 2026
    gCost: 9, gRev: 4.5,      // рост цен и выручки, % в год
    R: 3000,                  // сколько платят пассажиры за час на линии, ₸, до комиссий
    rLog: true,               // считать прогноз по своим сменам, когда записано 10 смен с цифрой приложения
    tpl: [12, 12, 12, 12, 12, 12, 0], // план часов по дням недели: Пн..Вс
    preSave: 0,               // до такси откладываешь в месяц
    otbOpen: '', license: '', taxiFrom: '', carFrom: '', // даты пути, по умолчанию от первого запуска
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
    if (d < 0) return 'было ' + Math.abs(d) + NB + plural(-d, ['день', 'дня', 'дней']) + ' назад';
    if (d < 62) return 'через ' + d + NB + plural(d, ['день', 'дня', 'дней']);
    const m = Math.round(d / 30.44);
    return 'через ' + m + NB + plural(m, ['месяц', 'месяца', 'месяцев']);
  }

  // ---------------------------------------------------------------- состояние
  // даты пути по умолчанию от первого запуска: Отбасы через 2 недели, права через 3 месяца, своя машина через полгода смен, срок 3 года
  function datesFrom(t) {
    const license = isoAdd(t, 90), taxiFrom = isoAdd(license, 1);
    return { deadline: addYears(t, 3), otbOpen: isoAdd(t, 13), license, taxiFrom, carFrom: mkAdd(mkOf(taxiFrom), 6) + '-01' };
  }
  function newState(t) {
    t = t || today();
    return { v: 1, created: t, updated: 0, set: Object.assign({}, DEF, datesFrom(t), { tpl: DEF.tpl.slice() }), base: null, money: [], shifts: {}, over: {}, done: {}, quests: [] };
  }
  function migrate(s) {
    if (!s || typeof s !== 'object') return newState();
    const out = Object.assign(newState(s.created), s);
    out.set = Object.assign({}, DEF, datesFrom(out.created), s.set || {});
    out.set.tpl = (out.set.tpl || DEF.tpl).slice(0, 7).map(x => +x || 0);
    while (out.set.tpl.length < 7) out.set.tpl.push(0);
    for (const k of ['shifts', 'over', 'done']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
    if (!Array.isArray(out.money)) out.money = [];
    if (!Array.isArray(out.quests)) out.quests = [];
    out.money = out.money.filter(m => m && m.d).sort(byDate);
    out.v = 1;
    return out;
  }

  // ---------------------------------------------------------------- план часов и фазы
  function planHours(st, iso) {
    const g = st.set;
    if (!g.taxiFrom || iso < g.taxiFrom) return 0;
    const o = st.over && st.over[iso];
    return o != null ? +o : +(g.tpl[dow(iso)] || 0);
  }
  function phaseOn(g, iso) {
    if (g.carFrom && iso >= g.carFrom) return 'own';
    if (g.taxiFrom && iso >= g.taxiFrom) return 'rent';
    return 'pre';
  }
  // фаза месяца: своя машина, если она есть хотя бы с середины месяца; иначе аренда, если смены уже идут
  function phaseOfMonth(g, mk) {
    const last = mk + '-' + pad(dim(mk));
    if (g.carFrom && mkOf(g.carFrom) <= mk) return 'own';
    if (g.taxiFrom && g.taxiFrom <= last) return 'rent';
    return 'pre';
  }
  const growth = (g, mk) => { const t = mkDiff(g.start, mk); return [Math.pow(1 + g.gCost / 100, t / 12), Math.pow(1 + g.gRev / 100, t / 12)]; };
  const keepOf = (g, ph) => 1 - g.yandex / 100 - g.tax / 100 - (ph === 'rent' ? g.park / 100 : 0);
  // газ на своей машине: с месяца установки (пусто: сразу с покупки)
  const gasOnMonth = (g, mk, ph) => g.fuel === 'gas' && ph === 'own' && (!g.gasFrom || mkOf(g.gasFrom) <= mk);
  function fuelPerHour(g, mk, ph, gas) {
    const fc = growth(g, mk)[0];
    if (ph === 'rent') return g.kmH * g.rentL100 / 100 * g.petrol * fc;
    if (ph === 'own') { if (gas == null) gas = gasOnMonth(g, mk, ph); return g.kmH * g.l100 * (gas ? g.gasX : 1) / 100 * (gas ? g.gas : g.petrol) * fc; }
    return 0;
  }
  // часы и смены по плану за месяц, начиная с дня from (правки дней учитываются)
  function monthPlan(st, mk, from) {
    let h = 0, sh = 0; const n = dim(mk);
    for (let d = 1; d <= n; d++) {
      const iso = mk + '-' + pad(d);
      if (from && iso < from) continue;
      const x = planHours(st, iso); if (x > 0) { h += x; sh++; }
    }
    return { h, sh };
  }

  // ---------------------------------------------------------------- помесячный прогноз
  const annuity = (L, r, n) => r ? L * r / (1 - Math.pow(1 + r, -n)) : L / n;
  const carValue = (g, age) => Math.max(0, g.price - (g.price - g.v36) * age / 36);
  const startCost = g => g.price * g.down / 100 + g.ogpo + g.osgop + g.regFee + g.diag;

  // деньги месяца после жизни, без платежа по кредиту. frac: какая доля месяца ещё впереди
  function workMonth(g, mk, R, ph, hrs, age, frac, gas) {
    const [fc, fr] = growth(g, mk);
    if (ph === 'pre') return { free: g.preSave * frac, rev: 0 };
    const k = ph === 'own' && hrs.sh > 0 ? Math.max(hrs.sh - g.lost * frac, 0) / hrs.sh : 1;
    const h = hrs.h * k, sh = hrs.sh * k, km = g.kmH * h, rev = R * fr * h, keep = keepOf(g, ph);
    const wash = g.wash26 * sh / 26 * fc, life = g.living * fc * frac;
    if (ph === 'rent') {
      return { rev, free: rev * keep - g.rentDay * hrs.sh * fc - km * g.rentL100 / 100 * g.petrol * fc - wash - g.rentOther * fc * frac - life };
    }
    const fuel = fuelPerHour(g, mk, ph, gas) * h;
    const other = (g.phone + g.taxTech / 12 + g.battery + g.repair) * fc * frac + (g.oil / g.oilKm + g.tires / g.tiresKm) * km * fc;
    const ins = (age > 0 && age % 12 === 0) ? (g.ogpo + g.osgop) * fc : 0;
    return { rev, free: rev * keep - fuel - wash - other - ins - life };
  }

  // s0: {iso, cash, otb, car, loan, owned, carAge, yc, yi, carry, pend}; o: {R, extraWeek, months, plan, events}
  function project(st, s0, o) {
    o = o || {};
    const g = st.set, R = o.R || g.R, r = g.rate / 100, out = [];
    const pay = annuity(g.price * (1 - g.down / 100), r, g.months);
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
      if (+mk.slice(5) === 3 && pend) { otb += pend; pend = 0; }
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
      if (o.extraWeek && ph !== 'pre') hrs = { h: Math.max(0, hrs.h + o.extraWeek * dim(mk) * frac / 7), sh: hrs.sh };
      const wm = workMonth(g, mk, R, ph, hrs, owned ? age : 0, frac, ph === 'own' && gasDone);
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
  function addsSince(st, m, iso) {
    const r = { cash: 0, otb: 0 };
    for (const x of st.money) if (isAdd(x) && x.d <= iso && after(x, m)) r[x.to === 'otb' ? 'otb' : 'cash'] += +x.add || 0;
    return r;
  }
  // активы по записям: отметка задаёт сумму, пополнение прибавляет
  function moneyLine(st, iso) {
    const out = []; let na = null, otb = 0;
    for (const x of st.money) {
      if (iso && x.d > iso) break;
      if (isAdd(x)) { if (na == null) continue; na += +x.add || 0; if (x.to === 'otb') otb += +x.add || 0; }
      else { na = naOf(x); otb = x.otb || 0; }
      out.push({ d: x.d, na, otb, x });
    }
    return out;
  }

  // выручка в час по записанным сменам (что платят пассажиры, до комиссий, в ценах ноября 2026)
  function measuredR(st, iso, days) {
    const g = st.set; let rh = 0, h = 0, n = 0;
    const from = days ? isoAdd(iso, -days) : '0000';
    for (const [d, x] of Object.entries(st.shifts)) {
      if (d > iso || d < from || !x || !(x.h > 0) || !(x.app > 0)) continue;
      const ph = phaseOn(g, d); if (ph === 'pre') continue;
      rh += x.app / keepOf(g, ph) / growth(g, mkOf(d))[1]; h += +x.h; n++;
    }
    return n ? { R: rh / h, n, h } : { R: null, n: 0, h: 0 };
  }
  const usedR = (st, iso) => { const m = measuredR(st, iso, 120); return st.set.rLog && m.n >= 10 ? m.R : st.set.R; };

  // сколько остаётся с одного дня работы: деньги в руки минус топливо, мойка и аренда за этот день
  function dayMoney(st, iso, h, app) {
    const g = st.set, ph = phaseOn(g, iso);
    if (ph === 'pre' || !(h > 0)) return { income: 0, costs: 0, net: 0, ph };
    const mk = mkOf(iso), [fc, fr] = growth(g, mk), R = usedR(st, iso);
    const income = app > 0 ? +app : R * fr * h * keepOf(g, ph);
    const costs = fuelPerHour(g, mk, ph, ph === 'own' ? gasOnMonth(g, mk, ph) : false) * h + g.wash26 / 26 * fc + (ph === 'rent' ? g.rentDay * fc : 0);
    return { income, costs, net: income - costs, ph };
  }
  // постоянные расходы за день (жизнь, связь, резерв на ремонт), они идут и в выходные
  function dayFixed(st, iso) {
    const g = st.set, mk = mkOf(iso), fc = growth(g, mk)[0], ph = phaseOn(g, iso), n = dim(mk);
    if (ph === 'pre') return -g.preSave / n;
    const extra = ph === 'rent' ? g.rentOther : g.phone + g.taxTech / 12 + g.battery + g.repair;
    return (g.living + extra) * fc / n;
  }
  // оценка активов на сегодня: последняя отметка + смены после неё − постоянные расходы.
  // Считаем только до последней внесённой смены: дни без записей не тянут оценку вниз.
  function estimate(st, iso) {
    const m = lastMoney(st, iso);
    if (!m) return null;
    let lastLog = null;
    for (const d of Object.keys(st.shifts)) if (d > m.d && d <= iso && (!lastLog || d > lastLog)) lastLog = d;
    let add = 0, logged = 0, missed = 0;
    for (let d = isoAdd(m.d, 1); d < iso; d = isoAdd(d, 1)) {
      const x = st.shifts[d];
      if (!x && planHours(st, d) > 0) missed++;
    }
    if (lastLog) {
      for (let d = isoAdd(m.d, 1); d <= lastLog; d = isoAdd(d, 1)) {
        const x = st.shifts[d];
        if (x && x.h > 0) { add += dayMoney(st, d, +x.h, +x.app || 0).net; logged++; }
        add -= dayFixed(st, d);
      }
    }
    const ad = addsSince(st, m, iso);
    return { base: m, na: naOf(m) + add + ad.cash + ad.otb, add, adds: ad, logged, missed, from: m.d, to: lastLog || m.d };
  }

  // старт прогноза с сегодняшнего дня по последней отметке
  function startState(st, iso) {
    const g = st.set, m = lastMoney(st, iso) || { d: iso, cash: 0, otb: 0, car: 0, loan: 0 };
    const est = estimate(st, iso);
    const owned = (m.car || 0) > 0;
    const carAge = owned && g.carFrom && g.carFrom <= iso ? mkDiff(mkOf(g.carFrom), mkOf(iso)) : 0;
    // взносы в Отбасы в этом году: пополнения и рост депозита между отметками
    let yc = 0, prevOtb = null;
    for (const p of moneyLine(st, iso)) { if (prevOtb != null && p.d.slice(0, 4) === iso.slice(0, 4) && p.otb > prevOtb) yc += p.otb - prevOtb; prevOtb = p.otb; }
    const ad = est ? est.adds : { cash: 0, otb: 0 };
    const cash = (m.cash || 0) + (est ? est.add : 0) + ad.cash;
    return { iso, cash, otb: (m.otb || 0) + ad.otb, car: m.car || 0, loan: m.loan || 0, owned, carAge, yc, yi: 0, carry: 0, pend: 0 };
  }

  // ---------------------------------------------------------------- прогноз, план и отставание
  function forecast(st, iso, o) {
    o = o || {};
    const s0 = startState(st, iso), na0 = s0.cash + s0.otb + s0.car - s0.loan;
    const p = project(st, s0, { R: o.R || usedR(st, iso), extraWeek: o.extraWeek || 0 });
    const goal = crossDate(p.rows, st.set.target, na0, iso);
    return Object.assign(p, { s0, na0, goal, R: o.R || usedR(st, iso) });
  }
  // план на старте: с ним сравнивается, впереди ты или отстаёшь
  function makeBase(st, iso) {
    const s0 = startState(st, iso), na0 = s0.cash + s0.otb + s0.car - s0.loan;
    const p = project(st, s0, { R: st.set.R });
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
    const ok = x => { const f = forecast(st, iso, { extraWeek: x }); return f.goal && f.goal.iso <= dl; };
    if (!ok(hi)) return { extra: null, fc: f0 };
    for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    return { extra: Math.ceil(hi * 2) / 2, fc: f0 };
  }

  // ---------------------------------------------------------------- смены: день, неделя, месяц
  // сколько остаётся с часа сверх плана: выручка после комиссий и налога минус топливо
  function hourValue(st, iso) {
    const g = st.set, ph = phaseOn(g, iso);
    if (ph === 'pre') return 0;
    const mk = mkOf(iso);
    return usedR(st, iso) * growth(g, mk)[1] * keepOf(g, ph) - fuelPerHour(g, mk, ph, ph === 'own' ? gasOnMonth(g, mk, ph) : false);
  }
  // мойка и аренда за выход на смену
  function shiftCost(st, iso) {
    const g = st.set, ph = phaseOn(g, iso), fc = growth(g, mkOf(iso))[0];
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
  const appPer12 = (st, iso, R) => { const g = st.set, ph = phaseOn(g, iso); return ph === 'pre' ? null : R * growth(g, mkOf(iso))[1] * 12 * keepOf(g, ph); };

  // ---------------------------------------------------------------- путь: вехи и этапы
  function milestones(st, iso, fc) {
    const g = st.set, L = [];
    const add = (id, title, date, kind, hint) => { if (date) L.push({ id, title, date, kind, hint, done: !!st.done[id], doneOn: st.done[id] || null }); };
    add('otb-open', 'Открыть депозит Отбасы', g.otbOpen, 'task', 'Договорная сумма 11 млн, тариф Баспана. Срок 3 года считается с открытия.');
    if (st.created < '2027') add('otb-2026', 'Положить на Отбасы ради премии за 2026 год', '2026-12-31', 'task', 'Премия 20% от взносов за год. Оставь деньги на взнос за машину и страховки.');
    add('license', 'Права', g.license, 'task', 'Коробку в права больше не пишут: сдал на автомате, ездить можно и на механике.');
    add('kaspi', 'Заявка в Kaspi на машину', g.license, 'task', 'Подавать, пока есть официальная зарплата: с ней кредит одобряют охотнее.');
    add('taxi', 'Первая смена', g.taxiFrom, 'task', 'Записывай цифру Яндекс Про за каждую смену.');
    add('check4w', '4 недели смен: решить про аренду', g.taxiFrom ? isoAdd(g.taxiFrom, 28) : '', 'task', 'От 30 000 ₸ за 12 ч можно копить на аренде, меньше 26 600 ₸ сразу своя машина.');
    add('car', 'Своя машина', g.carFrom, 'task', 'Проверить машину и коробку на СТО до покупки.');
    if (g.fuel === 'gas') add('gas', 'Поставить газ', g.gasFrom || g.carFrom, 'task', 'Около 240 000 ₸, окупается за 2-5 месяцев.');
    if (fc && fc.closed) add('loan', 'Кредит за машину закрыт', fc.closed + '-' + pad(dim(fc.closed)), 'auto', 'Всё свободное идёт в досрочку.');
    for (let y = Math.max(2027, +iso.slice(0, 4)); y <= +g.deadline.slice(0, 4); y++) {
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
    crossDate, valueAt, naOf, isAdd, byDate, lastMoney, addsSince, moneyLine, measuredR, usedR, dayMoney, dayFixed, estimate, startState,
    forecast, makeBase, versusPlan, daysFor, needExtra, hourValue, shiftCost, shiftDay, rangeStats, weekStats, monthStats, streak, scenarioOf, appPer12,
    milestones, otbYear, phaseNow, PHASES, dayMessage,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
