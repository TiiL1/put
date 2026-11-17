/* Путь к квартире: прокачка. Опыт считается из записей (смены, недели, отложенные деньги, вехи, доли цели),
   поэтому его нельзя накрутить или потерять: поправил смену, опыт пересчитался. Чистые функции без DOM. */
const Game = (() => {
  'use strict';
  const C = Core;

  // ---------------------------------------------------------------- правила опыта
  const XP = {
    hour: 10,     // за час на линии
    hourCap: 12,  // после 12 ч за рулём риск аварии примерно вдвое выше: опыт за них не растёт
    app: 5,       // внёс сумму из Яндекс Про
    dayOff: 30,   // вышел в плановый выходной
    week: 150,    // неделя закрыта: часов не меньше плана
    per1000: 1,   // за каждые 1 000 ₸, отложенные кнопкой Отложил
    goalStep: 400, // каждые 10% цели по отметкам денег
    own: 50,      // своё задание
  };
  // опыт за вехи пути (id из Core.milestones)
  const QUEST_XP = { 'otb-open': 300, 'otb-2026': 300, license: 800, kaspi: 200, taxi: 500, check4w: 400, car: 1000, gas: 300 };
  const questXp = id => QUEST_XP[id] || (/^otb-y\d{4}$/.test(id) ? 500 : 0);

  // ---------------------------------------------------------------- уровни и звания
  // до следующего уровня: 200, 300, 400… опыта; всего к уровню L: 200(L−1) + 50(L−1)(L−2)
  const cum = L => 200 * (L - 1) + 50 * (L - 1) * (L - 2);
  function levelOf(xp) {
    let L = 1;
    while (cum(L + 1) <= xp) L++;
    const a = cum(L), b = cum(L + 1);
    return { level: L, xp, from: a, to: b, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
  }
  const RANKS = [[1, 'Пешеход'], [5, 'Ученик'], [9, 'Новичок'], [14, 'Водитель'], [20, 'Таксист'], [27, 'Профи'], [35, 'Ас'], [44, 'Мастер дорог'], [54, 'Легенда Астаны'], [65, 'Хозяин ключей']];
  function rankOf(L) {
    let i = 0;
    while (i + 1 < RANKS.length && RANKS[i + 1][0] <= L) i++;
    return { title: RANKS[i][1], i, next: RANKS[i + 1] ? { level: RANKS[i + 1][0], title: RANKS[i + 1][1] } : null };
  }
  // цвета машины на дороге: открываются с уровнем
  const SKINS = [
    { id: 'taxi', name: 'Такси', level: 1, body: '#FFC83D', shade: '#E0A818' },
    { id: 'white', name: 'Белая', level: 5, body: '#EEF1F8', shade: '#B9C0D3' },
    { id: 'mint', name: 'Мятная', level: 10, body: '#3DDC91', shade: '#1C9A61' },
    { id: 'blue', name: 'Синяя', level: 15, body: '#5AA8FF', shade: '#2F6FC2' },
    { id: 'violet', name: 'Фиолетовая', level: 20, body: '#9C8CFF', shade: '#5B4BD6' },
    { id: 'red', name: 'Красная', level: 30, body: '#FF6B5E', shade: '#C2392D' },
    { id: 'night', name: 'Ночная', level: 40, body: '#2A3150', shade: '#FFC83D' },
    { id: 'gold', name: 'Золотая', level: 50, body: '#FFD86B', shade: '#C98A12' },
  ];
  const skinOf = (st, L) => { const s = SKINS.find(x => x.id === st.set.skin); return s && s.level <= L ? s : SKINS[0]; };

  // ---------------------------------------------------------------- достижения
  // check(ctx) → дата получения или null; ctx собирается один раз из записей
  const BADGES = [
    { id: 'first-shift', icon: 'wheel', color: 'yellow', title: 'Первая смена', hint: 'Внеси первую смену', xp: 200, check: c => c.firstShift },
    { id: 'streak-7', icon: 'flame', color: 'orange', title: '7 смен подряд', hint: 'Не пропускай плановые смены', xp: 100, check: c => c.streakAt[7] },
    { id: 'streak-30', icon: 'flame', color: 'orange', title: '30 смен подряд', hint: 'Месяц без пропусков', xp: 500, check: c => c.streakAt[30] },
    { id: 'streak-100', icon: 'flame', color: 'orange', title: '100 смен подряд', hint: 'Железная дисциплина', xp: 2000, check: c => c.streakAt[100] },
    { id: 'week-full', icon: 'check', color: 'green', title: 'Неделя закрыта', hint: 'Часов за неделю не меньше плана', xp: 150, check: c => c.firstWeek },
    { id: 'dayoff', icon: 'bolt', color: 'yellow', title: 'Выходной в работу', hint: 'Выйди в плановый выходной', xp: 100, check: c => c.firstDayOff },
    { id: 'hours-100', icon: 'clock', color: 'violet', title: '100 часов', hint: '100 часов на линии', xp: 200, check: c => c.hoursAt[100] },
    { id: 'hours-1000', icon: 'clock', color: 'violet', title: '1 000 часов', hint: '1 000 часов на линии', xp: 1000, check: c => c.hoursAt[1000] },
    { id: 'hours-3000', icon: 'clock', color: 'violet', title: '3 000 часов', hint: '3 000 часов на линии', xp: 2000, check: c => c.hoursAt[3000] },
    { id: 'precise', icon: 'receipt', color: 'blue', title: 'Точный учёт', hint: '20 смен с суммой из приложения', xp: 200, check: c => c.appAt[20] },
    { id: 'saver', icon: 'piggy', color: 'blue', title: 'Копилка', hint: 'Первый раз отложи деньги', xp: 100, check: c => c.firstSave },
    { id: 'money-1m', icon: 'coins', color: 'green', title: 'Первый миллион', hint: 'Активы от 1 000 000 ₸', xp: 500, check: c => c.naAt(1e6) },
    { id: 'half', icon: 'flag', color: 'green', title: 'Половина пути', hint: 'Половина цели', xp: 1000, check: c => c.naAt(c.target / 2) },
    { id: 'debt-free', icon: 'key', color: 'yellow', title: 'Без долгов', hint: 'Закрой кредит за машину', xp: 1500, check: c => c.debtFree },
    { id: 'otb-full', icon: 'bank', color: 'blue', title: 'Полная премия', hint: 'За год в Отбасы 200 МРП', xp: 800, check: c => c.otbFull },
    { id: 'goal', icon: 'house', color: 'gold', title: 'Цель', hint: 'Активы дошли до цели', xp: 5000, check: c => c.naAt(c.target) },
  ];

  // всё, что нужно для проверок, одним проходом по записям
  function context(st, iso) {
    const g = st.set, days = Object.keys(st.shifts).filter(d => d <= iso).sort();
    const c = { target: g.target, firstShift: null, firstDayOff: null, firstWeek: null, firstSave: null, debtFree: null, otbFull: null, streakAt: {}, hoursAt: {}, appAt: {}, weeks: [], best: 0, hours: 0, shifts: 0, saved: 0 };
    let hours = 0, apps = 0;
    for (const d of days) {
      const x = st.shifts[d]; if (!x || !(x.h > 0)) continue;
      c.firstShift = c.firstShift || d;
      if (C.planHours(st, d) === 0 && C.phaseOn(g, d) !== 'pre') c.firstDayOff = c.firstDayOff || d;
      const h0 = hours; hours += +x.h; c.shifts++;
      for (const t of [100, 1000, 3000]) if (h0 < t && hours >= t) c.hoursAt[t] = d;
      if (x.app > 0) { apps++; if (apps === 20) c.appAt[20] = d; }
    }
    // серия: плановые смены подряд с записью; выходные не рвут серию
    if (days.length) {
      let n = 0;
      for (let d = days[0]; d <= iso; d = C.isoAdd(d, 1)) {
        const p = C.planHours(st, d), x = st.shifts[d], worked = x && x.h > 0;
        if (p > 0) { if (worked) n++; else if (d < iso) n = 0; }
        else if (worked) n++;
        for (const t of [7, 30, 100]) if (n >= t && !c.streakAt[t]) c.streakAt[t] = d;
        if (n > c.best) c.best = n;
      }
    }
    c.hours = hours;
    // недели: закрыта, если вся неделя прошла и часов не меньше плана
    if (g.taxiFrom && g.taxiFrom <= iso) {
      for (let mon = C.monday(g.taxiFrom); C.isoAdd(mon, 6) < iso; mon = C.isoAdd(mon, 7)) {
        let plan = 0, fact = 0;
        for (let i = 0; i < 7; i++) { const d = C.isoAdd(mon, i); plan += C.planHours(st, d); const x = st.shifts[d]; if (x && x.h > 0) fact += +x.h; }
        if (plan > 0 && fact >= plan) { c.weeks.push({ d: C.isoAdd(mon, 6), plan, fact }); c.firstWeek = c.firstWeek || C.isoAdd(mon, 6); }
      }
    }
    // деньги: отметки и пополнения по порядку
    const line = C.moneyLine(st, iso), yearPut = {};
    let hadLoan = false, prevOtb = null;
    for (const p of line) {
      const m = p.x;
      if (C.isAdd(m)) { if (m.add > 0) { c.firstSave = c.firstSave || m.d; c.saved += +m.add; } }
      else if ((m.loan || 0) > 0) hadLoan = true;
      else if (hadLoan && (m.car || 0) > 0 && !c.debtFree) c.debtFree = m.d;
      if (prevOtb != null && p.otb > prevOtb) {
        const y = p.d.slice(0, 4); yearPut[y] = (yearPut[y] || 0) + (p.otb - prevOtb);
        if (!c.otbFull && yearPut[y] >= (y < '2027' ? g.otbCap26 : g.otbCap)) c.otbFull = p.d;
      }
      prevOtb = p.otb;
    }
    c.naAt = v => { for (const p of line) if (p.na >= v) return p.d; return null; };
    c.line = line;
    return c;
  }

  // ---------------------------------------------------------------- журнал опыта
  function ledger(st, iso, fc, ctx) {
    const g = st.set, out = [], c = ctx || context(st, iso);
    const push = (d, xp, kind, text) => { if (xp > 0) out.push({ d, xp: Math.round(xp), kind, text }); };
    for (const [d, x] of Object.entries(st.shifts)) {
      if (d > iso || !x || !(x.h > 0)) continue;
      const h = +x.h, off = C.planHours(st, d) === 0 && C.phaseOn(g, d) !== 'pre';
      push(d, Math.min(h, XP.hourCap) * XP.hour + (x.app > 0 ? XP.app : 0) + (off ? XP.dayOff : 0), 'shift', (off ? 'Выходной в работу: ' : 'Смена ') + C.num1(h) + ' ч');
    }
    for (const w of c.weeks) push(w.d, XP.week, 'week', 'Неделя закрыта: ' + C.num1(w.fact) + ' из ' + C.num1(w.plan) + ' ч');
    for (const p of c.line) if (C.isAdd(p.x) && p.x.add > 0) push(p.d, Math.floor(p.x.add / 1000) * XP.per1000, 'save', 'Отложил ' + C.money(+p.x.add));
    // каждые 10% цели сверх того, что было на старте
    if (c.line.length && g.target > 0) {
      const step = g.target / 10;
      let top = Math.floor(c.line[0].na / step);
      for (const p of c.line) {
        const k = Math.min(10, Math.floor(p.na / step));
        for (let j = top + 1; j <= k; j++) push(p.d, XP.goalStep, 'goal', (j * 10) + '% цели');
        top = Math.max(top, k);
      }
    }
    const ms = C.milestones(st, iso, fc);
    for (const x of ms) if (x.done && x.kind === 'task') push(x.doneOn > iso ? iso : x.doneOn, questXp(x.id), 'quest', 'Веха: ' + x.title);
    for (const q of st.quests || []) if (q.done) push(q.done > iso ? iso : q.done, XP.own, 'quest', 'Задание: ' + q.title);
    for (const b of BADGES) { const d = b.check(c); if (d) push(d, b.xp, 'badge', 'Достижение: ' + b.title); }
    out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    return out;
  }

  // ---------------------------------------------------------------- игрок: уровень, звание, достижения
  function player(st, iso, fc) {
    const c = context(st, iso), L = ledger(st, iso, fc, c), xp = L.reduce((s, e) => s + e.xp, 0), lv = levelOf(xp);
    const badges = BADGES.map(b => { const d = b.check(c); return { id: b.id, icon: b.icon, color: b.color, title: b.title, hint: b.hint, xp: b.xp, on: d || null }; });
    const todayXp = L.filter(e => e.d === iso).reduce((s, e) => s + e.xp, 0);
    const weekXp = L.filter(e => e.d >= C.monday(iso)).reduce((s, e) => s + e.xp, 0);
    return Object.assign(lv, { rank: rankOf(lv.level), ledger: L, badges, todayXp, weekXp, skin: skinOf(st, lv.level), stats: { best: c.best, hours: c.hours, shifts: c.shifts, saved: c.saved } });
  }

  // сколько опыта даст смена (для подсказки до сохранения)
  function shiftXp(st, iso, h, app) {
    if (!(h > 0)) return 0;
    const off = C.planHours(st, iso) === 0 && C.phaseOn(st.set, iso) !== 'pre';
    return Math.min(h, XP.hourCap) * XP.hour + (app > 0 ? XP.app : 0) + (off ? XP.dayOff : 0);
  }

  // задания: вехи пути с опытом + свои задания, ближайшие сверху
  function quests(st, iso, fc) {
    const ms = C.milestones(st, iso, fc).filter(x => x.kind === 'task').map(x => Object.assign({}, x, { xp: questXp(x.id), own: false }));
    const own = (st.quests || []).map(q => ({ id: q.id, title: q.title, date: q.date || '', kind: 'task', hint: q.hint || '', done: !!q.done, doneOn: q.done || null, xp: XP.own, own: true }));
    const all = ms.concat(own);
    const open = all.filter(x => !x.done).sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : 1);
    const done = all.filter(x => x.done).sort((a, b) => a.doneOn < b.doneOn ? 1 : -1);
    return { open, done };
  }

  return { XP, QUEST_XP, questXp, cum, levelOf, RANKS, rankOf, SKINS, skinOf, BADGES, context, ledger, player, shiftXp, quests };
})();
if (typeof module !== 'undefined') module.exports = Game;
