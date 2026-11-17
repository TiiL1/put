/* Путь к квартире: прокачка. Опыт считается из записей (смены, задания дня, недели, боссы, рекорды, деньги, вехи),
   поэтому его нельзя накрутить или потерять: поправил смену, всё пересчиталось. Чистые функции без DOM. */
const Game = (() => {
  'use strict';
  const C = Core;

  // ---------------------------------------------------------------- правила опыта
  const XP = {
    hour: 10,          // за час работы (такси или подработка), без потолка
    comboStep: 0.05,   // комбо: каждая смена серии подряд +5% к опыту за часы
    comboMax: 1.5,     // но не больше ×1,5
    app: 5,            // внёс сумму из приложения
    dayOff: 30,        // вышел в плановый выходной
    planDay: 20,       // задание дня: отработал план
    moneyDay: 40,      // задание дня: заработок не ниже цели дня
    ordersDay: 30,     // задание дня: заказов не меньше цели
    week: 150,         // неделя закрыта: часов не меньше плана
    weekPlus: 100,     // и ещё 6 ч сверху
    boss: 500,         // босс месяца: часов за месяц не меньше плана месяца
    paid: 100,         // жизнь на месяц оплачена сменами
    record: 100,       // личный рекорд
    rest: 50,          // выходной, когда энергия была ниже половины
    mood: 5,           // отметил, как ты сегодня
    per1000: 1,        // за каждые 1 000 ₸, переведённые в Отбасы
    tile: 150,         // плитка квартиры: каждая 1/25 цели по сверкам денег
    tiles: 25,
    own: 50,           // своё задание
  };
  const QUEST_XP = { 'otb-open': 300, 'otb-2026': 300, license: 800, kaspi: 200, taxi: 500, check4w: 400, car: 1000, gas: 300, selfemp: 200, reg: 150 };
  const QUEST_TITLE = { 'otb-open': 'Открыть депозит Отбасы', 'otb-2026': 'Отбасы ради премии за 2026 год', license: 'Права', kaspi: 'Заявка на автокредит', taxi: 'Первая смена в такси', check4w: '4 недели смен', car: 'Своя машина', gas: 'Газ', selfemp: 'Самозанятость и доставка', reg: 'Временная регистрация' };
  const questXp = id => QUEST_XP[id] || (/^otb-y\d{4}$/.test(id) ? 500 : 0);
  const questTitle = id => QUEST_TITLE[id] || (/^otb-y\d{4}$/.test(id) ? 'Отбасы: взносы за ' + id.slice(5) + ' год' : 'Веха');
  const comboOf = (n, step) => Math.min(XP.comboMax, 1 + (step || XP.comboStep) * Math.max(0, n - 1));
  // ---------------------------------------------------------------- навыки: очко за каждые 2 уровня, у навыка до 3 ступеней
  const PERKS = [
    { id: 'combo', br: 'Работа', icon: 'flame', title: 'Разгон', lvl: [3, 10, 20], text: r => 'Комбо растёт на ' + (5 + r) + '% за смену серии' },
    { id: 'marathon', br: 'Работа', icon: 'clock', title: 'Марафонец', lvl: [3, 12, 24], text: r => '+' + (10 * r) + '% опыта за часы после 10-го в смене' },
    { id: 'hunter', br: 'Работа', icon: 'target', title: 'Охотник', lvl: [6, 14, 26], text: r => 'Задание дня по заказам: +' + (30 + 15 * r) + ' XP' },
    { id: 'boss', br: 'Работа', icon: 'shield', title: 'Боец', lvl: [10, 20, 30], text: r => 'Босс месяца: +' + (500 + 125 * r) + ' XP' },
    { id: 'piggy', br: 'Деньги', icon: 'piggy', title: 'Вкладчик', lvl: [3, 10, 20], text: r => (1 + r) + ' XP за каждые 1 000 ₸ в Отбасы' },
    { id: 'books', br: 'Деньги', icon: 'receipt', title: 'Счетовод', lvl: [3, 8, 16], text: r => 'Сумма за день в смене: +' + (5 + 5 * r) + ' XP' },
    { id: 'builder', br: 'Деньги', icon: 'house', title: 'Строитель', lvl: [8, 16, 28], text: r => 'Плитка квартиры: +' + (150 + 50 * r) + ' XP' },
    { id: 'econ', br: 'Деньги', icon: 'wallet', title: 'Экономист', lvl: [10, 20, 30], text: r => 'Жизнь на месяц оплачена: +' + (100 + 50 * r) + ' XP' },
    { id: 'sleep', br: 'Голова', icon: 'moon', title: 'Крепкий сон', lvl: [3, 10, 20], text: r => 'За ночь энергия +' + (22 + 2 * r) + ' вместо 22' },
    { id: 'ice', br: 'Голова', icon: 'snow', title: 'Ледяное сердце', lvl: [6, 14, 26], text: r => 'Заморозка серии каждые ' + (14 - 2 * r) + ' смен' + (r >= 3 ? ', копится до трёх' : '') },
    { id: 'mode', br: 'Голова', icon: 'heart', title: 'Режим', lvl: [3, 8, 16], text: r => 'Отметка настроения: +' + (5 + 5 * r) + ' XP' },
    { id: 'breath', br: 'Голова', icon: 'bolt', title: 'Второе дыхание', lvl: [10, 20, 30], text: r => 'Отдых при низкой энергии: +' + (50 + 50 * r) + ' XP' },
  ];
  const pointsOf = L => Math.floor(L / 2);
  const rk = (st, id, d) => { const a = st.perks && st.perks[id]; if (!Array.isArray(a)) return 0; let n = 0; for (const x of a) if (!d || x <= d) n++; return Math.min(3, n); };
  const comboAt = (st, n, d) => comboOf(n, XP.comboStep + 0.01 * rk(st, 'combo', d));
  // сундук: 50-150 опыта, у каждого дня своё число (не меняется при перерисовке)
  const chestXp = iso => { let h = 7; for (const ch of iso) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return 50 + h % 101; };
  // усталость за день: до 8 ч по 2 пункта в час, дальше по 4
  const drain = h => h <= 8 ? h * 2 : 16 + (h - 8) * 4;
  const median = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const BOSS = ['Январская стужа', 'Февральский буран', 'Мартовская слякоть', 'Апрельский ливень', 'Майская лень', 'Июньская жара', 'Июльский зной', 'Августовская пыль', 'Сентябрьская хандра', 'Октябрьский ветер', 'Ноябрьский гололёд', 'Декабрьский мороз'];
  const bossName = mk => BOSS[+mk.slice(5) - 1];

  // ---------------------------------------------------------------- уровни, звания, гараж
  // до следующего уровня: 200, 300, 400… опыта; всего к уровню L: 200(L−1) + 50(L−1)(L−2)
  const cum = L => 200 * (L - 1) + 50 * (L - 1) * (L - 2);
  function levelOf(xp) {
    let L = 1;
    while (cum(L + 1) <= xp) L++;
    const a = cum(L), b = cum(L + 1);
    return { level: L, xp, from: a, to: b, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
  }
  const RANKS = [[1, 'Пешеход'], [4, 'Курьер'], [8, 'Ученик'], [12, 'Новичок за рулём'], [16, 'Водитель'], [21, 'Таксист'], [26, 'Опытный таксист'],
    [32, 'Профи'], [38, 'Ас'], [44, 'Мастер'], [51, 'Ветеран дорог'], [58, 'Король смен'], [65, 'Легенда Астаны'], [73, 'Почти дома'], [82, 'Хозяин ключей']];
  function rankOf(L) {
    let i = 0;
    while (i + 1 < RANKS.length && RANKS[i + 1][0] <= L) i++;
    return { title: RANKS[i][1], i, next: RANKS[i + 1] ? { level: RANKS[i + 1][0], title: RANKS[i + 1][1] } : null };
  }
  const SKINS = [
    { id: 'taxi', name: 'Жёлтая', level: 1, body: '#FFC83D', shade: '#E0A818' },
    { id: 'white', name: 'Белая', level: 5, body: '#EEF1F8', shade: '#B9C0D3' },
    { id: 'mint', name: 'Мятная', level: 10, body: '#3DDC91', shade: '#1C9A61' },
    { id: 'blue', name: 'Синяя', level: 15, body: '#5AA8FF', shade: '#2F6FC2' },
    { id: 'violet', name: 'Фиолетовая', level: 20, body: '#9C8CFF', shade: '#5B4BD6' },
    { id: 'red', name: 'Красная', level: 30, body: '#FF6B5E', shade: '#C2392D' },
    { id: 'night', name: 'Ночная', level: 40, body: '#2A3150', shade: '#FFC83D' },
    { id: 'gold', name: 'Золотая', level: 50, body: '#FFD86B', shade: '#C98A12' },
    { id: 'neon', name: 'Неоновая', level: 60, body: '#2EF2FF', shade: '#0B8FA3' },
    { id: 'pink', name: 'Розовая', level: 70, body: '#FF7AC6', shade: '#C2408A' },
  ];
  const skinOf = (st, L) => { const s = SKINS.find(x => x.id === st.set.skin); return s && s.level <= L ? s : SKINS[0]; };

  // ---------------------------------------------------------------- награды: бронза, серебро, золото и особые
  const BADGES = [];
  const tierOf = (i, n) => i === n - 1 ? 'gold' : i >= Math.floor(n / 2) ? 'silver' : 'bronze';
  function series(base, cat, icon, list, cur, hint) {
    list.forEach(([k, xp, title], i) => BADGES.push({ id: base + '-' + k, cat, icon, color: tierOf(i, list.length), title, hint: hint(k), xp, need: () => k, cur }));
  }
  const one = (id, cat, icon, color, title, hint, xp, need, cur) => BADGES.push({ id, cat, icon, color, title, hint, xp, need: need || (() => 1), cur: cur || (c => c.at[id] ? 1 : 0) });
  const pl = (n, f) => n + ' ' + C.plural(n, f);
  series('shifts', 'Смены', 'wheel', [[1, 200, 'Первая смена'], [10, 150, '10 смен'], [50, 400, '50 смен'], [100, 800, '100 смен'], [250, 1500, '250 смен'], [500, 3000, '500 смен']], c => c.shifts, k => 'Внеси ' + pl(k, ['смену', 'смены', 'смен']));
  series('hours', 'Часы', 'clock', [[50, 100, '50 часов'], [100, 200, '100 часов'], [250, 300, '250 часов'], [500, 500, '500 часов'], [1000, 1000, '1 000 часов'], [2000, 1500, '2 000 часов'], [3000, 2000, '3 000 часов'], [5000, 3000, '5 000 часов']], c => c.hours, k => C.grp(k) + ' часов работы');
  series('streak', 'Серия', 'flame', [[3, 50, '3 подряд'], [7, 100, '7 подряд'], [14, 200, '14 подряд'], [30, 500, '30 подряд'], [60, 1000, '60 подряд'], [100, 2000, '100 подряд']], c => c.best, k => pl(k, ['смена', 'смены', 'смен']) + ' подряд. Выходные по плану серию не рвут');
  series('weeks', 'Недели', 'check', [[1, 150, 'Неделя закрыта'], [4, 300, '4 недели'], [12, 600, '12 недель'], [26, 1000, 'Полгода недель'], [52, 2000, 'Год недель']], c => c.weeks.length, k => 'Закрой ' + pl(k, ['неделю', 'недели', 'недель']) + ' без недобора');
  series('paid', 'Месяц', 'wallet', [[1, 150, 'Месяц оплачен'], [3, 400, '3 месяца оплачено'], [12, 1500, 'Год оплачен']], c => c.paid.length, k => 'Оплати сменами жизнь на ' + pl(k, ['месяц', 'месяца', 'месяцев']));
  series('dayoff', 'Сверх плана', 'bolt', [[1, 100, 'Выходной в работу'], [5, 250, '5 выходных в работу'], [20, 600, '20 выходных в работу']], c => c.dayOffs, k => 'Выйди в плановый выходной ' + k + ' раз');
  one('long-13', 'Сверх плана', 'bolt', 'orange', 'Длинная смена', 'Смена 13 часов и больше', 150, () => 13, c => Math.min(13, c.longest));
  one('long-15', 'Сверх плана', 'bolt', 'orange', 'Марафон', 'Смена 15 часов и больше', 300, () => 15, c => Math.min(15, c.longest));
  series('apps', 'Учёт', 'receipt', [[20, 200, 'Точный учёт'], [100, 600, 'Бухгалтер']], c => c.apps, k => 'Внеси сумму из приложения ' + k + ' раз');
  series('orders', 'Учёт', 'receipt', [[100, 200, '100 заказов'], [1000, 800, '1 000 заказов'], [5000, 2000, '5 000 заказов']], c => c.orders, k => C.grp(k) + ' заказов (вноси число заказов в смене)');
  one('save-1', 'Деньги', 'piggy', 'blue', 'Копилка', 'Первый перевод в Отбасы', 100);
  series('saved', 'Деньги', 'piggy', [[100000, 200, '100 000 в Отбасы'], [500000, 500, '500 000 в Отбасы'], [1000000, 1000, 'Миллион в Отбасы']], c => c.saved, k => 'Переведи в Отбасы ' + C.money(k));
  series('na', 'Деньги', 'coins', [[1000000, 500, 'Первый миллион'], [2000000, 800, 'Два миллиона'], [3000000, 1000, 'Три миллиона']], c => c.naMax, k => 'Активы от ' + C.money(k) + ' по сверке денег');
  one('half', 'Деньги', 'flag', 'green', 'Половина пути', 'Половина цели по сверке денег', 1000, c => c.target / 2, c => c.naMax);
  one('goal', 'Деньги', 'house', 'gold', 'Цель', 'Активы дошли до цели', 5000, c => c.target, c => c.naMax);
  one('otb-full', 'Деньги', 'bank', 'blue', 'Полная премия', 'За год в Отбасы 200 МРП', 800, c => c.cap, c => c.otbYearMax);
  one('own-car', 'Машина', 'car', 'yellow', 'Своя машина', 'Машина в активах по сверке денег', 500);
  one('early-1', 'Машина', 'bolt', 'green', 'Досрочка', 'Погаси часть кредита за машину досрочно', 200);
  one('debt-free', 'Машина', 'key', 'gold', 'Без долгов', 'Кредит за машину закрыт', 1500);
  series('rec', 'Рекорды', 'trophy', [[1, 100, 'Первый рекорд'], [10, 500, '10 рекордов']], c => c.recs.length, k => 'Побей свой рекорд ' + k + ' раз');
  series('boss', 'Боссы', 'trophy', [[1, 300, 'Первый босс'], [3, 600, 'Гроза боссов'], [12, 2000, 'Год без поражений']], c => c.bosses.length, k => 'Победи ' + pl(k, ['босса', 'боссов', 'боссов']) + ' месяца');
  series('chest', 'Задания', 'star', [[1, 100, 'Первый сундук'], [10, 400, '10 сундуков'], [50, 1500, '50 сундуков']], c => c.chests, k => 'Выполни все задания дня ' + k + ' раз');
  one('ownq-5', 'Задания', 'star', 'violet', 'Сам себе начальник', 'Выполни 5 своих заданий', 200, () => 5, c => c.ownDone);
  one('winter', 'Особые', 'snow', 'blue', 'Пережил зиму', '40 смен с декабря по февраль', 1000, () => 40, c => c.winterMax);
  one('rest-1', 'Голова', 'moon', 'green', 'Умный отдых', 'Отдохни в выходной, когда энергия ниже половины', 150);
  series('mood', 'Голова', 'heart', [[7, 150, 'Слышу себя'], [30, 400, 'Дневник энергии']], c => c.moods, k => 'Отмечай, как ты, ' + k + ' дней');
  one('why', 'Голова', 'heart', 'green', 'Знаю зачем', 'Напиши в настройках, зачем тебе квартира', 100);

  // ---------------------------------------------------------------- всё из записей одним проходом
  function context(st, iso) {
    const g = st.set, sh = st.shifts || {}, moods = st.mood || {};
    const c = { target: g.target > 0 ? g.target : 0, cap: g.otbCap, at: {}, shifts: 0, hours: 0, longest: 0, apps: 0, orders: 0, dayOffs: 0, best: 0, streak: 0, freezes: 0,
      combo: 1, streakOn: {}, energy: 100, energyOn: {}, dq: {}, weeks: [], recs: [], bosses: [], paid: [], rests: [], chests: 0, moods: 0, winterMax: 0,
      saved: 0, naMax: 0, otbYearMax: 0, tiles: [], tile: 0, tileN: 0, tileStart: 0, ownDone: 0, boss: null, month: null };
    const mark = (k, d) => { if (k && !c.at[k]) c.at[k] = d; };
    const logged = Object.keys(sh).filter(d => d <= iso).sort();
    const from = [logged[0], g.preFrom, g.taxiFrom].filter(d => d && d <= iso).sort()[0];
    let n = 0, frz = 0, since = 0, E = 100, wH = 0, wP = 0, weeksDone = 0, bestWeek = 0, bestDay = 0, bestMonth = 0, monthApp = 0, monthsDone = 0;
    const hist = { pre: { app: [], ord: [] }, taxi: { app: [], ord: [] } }, rc = new Map(), months = [];
    let partial = false;
    let bm = null, hp = 0, dmg = 0, beaten = null, need = 0, earned = 0, paidOn = null;
    const winter = {};
    if (from) for (let d = from; d <= iso; d = C.isoAdd(d, 1)) {
      const p = C.planHours(st, d), x = sh[d], h = x && x.h > 0 ? +x.h : 0, app = x && x.app > 0 ? +x.app : 0, ord = x && x.orders > 0 ? +x.orders : 0, worked = h > 0, past = d < iso;
      const mk = C.mkOf(d), mo = +mk.slice(5);
      if (mk !== bm) { // новый месяц: босс (часы по плану на весь месяц) и счёт: жизнь оплачена
        if (bm) months.push({ mk: bm, need, earned, paidOn, partial });
        bm = mk; hp = 0; dmg = 0; beaten = null; monthApp = 0; earned = 0; paidOn = null; need = C.monthNeed(st, mk).total; partial = d > mk + '-01';
        // будущие дни месяца без разовых правок: поставить всё в выходные и победить босса нельзя
        for (let k = 1; k <= C.dim(mk); k++) { const dd = mk + '-' + C.pad(k); hp += C.planHours(st, dd, dd > iso); }
      }
      // задания дня: цели по деньгам и заказам от медианы прошлых 10 смен той же работы (доставка и такси отдельно)
      const H = hist[C.phaseOn(g, d) === 'pre' ? 'pre' : 'taxi'], appH = H.app, ordH = H.ord;
      const mT = appH.length >= 3 ? Math.ceil(median(appH.slice(-10)) * 1.05 / 500) * 500 : null;
      const oT = ordH.length >= 3 ? Math.round(median(ordH.slice(-10))) + 1 : null;
      if (p > 0 || worked) {
        const q = { plan: p, moneyT: mT, ordersT: oT, planDone: p > 0 && h >= p, moneyDone: mT != null && app >= mT, ordersDone: oT != null && ord >= oT };
        q.avail = (p > 0 ? 1 : 0) + (mT != null ? 1 : 0) + (oT != null ? 1 : 0);
        q.done = (q.planDone ? 1 : 0) + (q.moneyDone ? 1 : 0) + (q.ordersDone ? 1 : 0);
        q.chest = q.avail >= 2 && q.done === q.avail ? chestXp(d) : 0;
        if (q.chest) c.chests++;
        c.dq[d] = q;
      }
      if (app > 0) appH.push(app);
      if (ord > 0) ordH.push(ord);
      // серия с заморозками: каждые 14 смен подряд дают защиту от одного пропуска (не больше двух)
      const ice = rk(st, 'ice', d), every = 14 - 2 * ice, maxF = ice >= 3 ? 3 : 2;
      if (worked) { n++; since++; if (since >= every) { frz = Math.min(maxF, frz + 1); since = 0; } }
      else if (p > 0 && past) { if (frz > 0) frz--; else { n = 0; since = 0; } }
      c.streakOn[d] = n;
      for (const t of [3, 7, 14, 30, 60, 100]) if (n >= t) mark('streak-' + t, d);
      if (n > c.best) c.best = n;
      // энергия: ночь восстанавливает, работа тратит, выходной даёт больше
      const Eprev = E;
      E = Math.min(100, E + 22 + 2 * rk(st, 'sleep', d)) - drain(h) + (worked || !past ? 0 : 30);
      const md = moods[d];
      if (md) E += md <= 2 ? -8 : md >= 4 ? 4 : 0;
      E = Math.max(0, Math.min(100, E));
      c.energyOn[d] = E;
      if (!worked && p === 0 && past && Eprev < 50 && logged[0] && d > logged[0]) { c.rests.push(d); mark('rest-1', d); }
      if (worked) {
        c.shifts++; const h0 = c.hours; c.hours += h;
        for (const t of [1, 10, 50, 100, 250, 500]) if (c.shifts >= t) mark('shifts-' + t, d);
        for (const t of [50, 100, 250, 500, 1000, 2000, 3000, 5000]) if (h0 < t && c.hours >= t) mark('hours-' + t, d);
        if (h > c.longest) c.longest = h;
        if (h >= 13) mark('long-13', d);
        if (h >= 15) mark('long-15', d);
        if (p === 0) { c.dayOffs++; for (const t of [1, 5, 20]) if (c.dayOffs >= t) mark('dayoff-' + t, d); }
        if (app > 0) { c.apps++; for (const t of [20, 100]) if (c.apps >= t) mark('apps-' + t, d); }
        if (ord > 0) { const o0 = c.orders; c.orders += ord; for (const t of [100, 1000, 5000]) if (o0 < t && c.orders >= t) mark('orders-' + t, d); }
        if (mo === 12 || mo <= 2) { const wk = mo === 12 ? +d.slice(0, 4) : +d.slice(0, 4) - 1; winter[wk] = (winter[wk] || 0) + 1; c.winterMax = Math.max(c.winterMax, winter[wk]); if (winter[wk] >= 40) mark('winter', d); }
        if (app > 0) { if (c.apps > 5 && app > bestDay) c.recs.push({ d, kind: 'day', v: app }); bestDay = Math.max(bestDay, app); }
        monthApp += app;
        earned += C.dayMoney(st, d, h, app, rc).net;
        if (!paidOn && need > 0 && earned >= need) { paidOn = d; c.paid.push({ mk, d }); }
      }
      // босс месяца
      dmg += h;
      if (!beaten && hp > 0 && dmg >= hp) { beaten = d; c.bosses.push({ mk, d, name: bossName(mk) }); }
      if (mk === C.mkOf(iso)) { c.boss = { mk, name: bossName(mk), hp, dmg, beaten }; c.month = { mk, need, earned, paidOn }; }
      // неделя закрывается в воскресенье, когда она прошла
      wH += h; wP += p;
      if (C.dow(d) === 6) {
        if (past) {
          if (wP > 0 && wH >= wP) c.weeks.push({ d, plan: wP, fact: wH, plus: wH >= wP + 6 });
          if (wH > 0) { if (weeksDone >= 2 && wH > bestWeek) c.recs.push({ d, kind: 'week', v: wH }); bestWeek = Math.max(bestWeek, wH); weeksDone++; }
        }
        wH = 0; wP = 0;
      }
      // месяц закрывается в последний день: рекорд заработка за месяц
      if (+d.slice(8) === C.dim(mk) && past && monthApp > 0 && !partial) {
        if (monthsDone >= 1 && monthApp > bestMonth) c.recs.push({ d, kind: 'month', v: monthApp });
        bestMonth = Math.max(bestMonth, monthApp); monthsDone++;
      }
    }
    c.streak = n; c.freezes = frz; c.combo = comboAt(st, n, iso); c.energy = from ? E : 100; c.months = months;
    const nth = (arr, t) => arr[t - 1] && arr[t - 1].d;
    for (const t of [1, 4, 12, 26, 52]) mark('weeks-' + t, nth(c.weeks, t));
    for (const t of [1, 3, 12]) mark('paid-' + t, nth(c.paid, t));
    for (const t of [1, 10]) mark('rec-' + t, nth(c.recs, t));
    for (const t of [1, 3, 12]) mark('boss-' + t, nth(c.bosses, t));
    const chestDays = Object.keys(c.dq).filter(d => c.dq[d].chest).sort();
    for (const t of [1, 10, 50]) mark('chest-' + t, chestDays[t - 1]);
    const moodDays = Object.keys(moods).filter(d => d <= iso).sort();
    c.moods = moodDays.length;
    for (const t of [7, 30]) mark('mood-' + t, moodDays[t - 1]);
    // деньги: сверки, переводы в Отбасы, плитки квартиры
    const line = C.moneyLine(st, iso), yearPut = {}, tileV = c.target / XP.tiles;
    let hadLoan = false, prevOtb = null;
    let top = line.length && tileV > 0 ? Math.min(XP.tiles, Math.floor(Math.max(0, line[0].na) / tileV)) : 0;
    c.tile = tileV; c.tileStart = top;
    for (const p of line) {
      const m = p.x;
      if (C.isAdd(m)) {
        if (m.to === 'otb' && m.add > 0) { mark('save-1', m.d); c.saved += +m.add; for (const t of [100000, 500000, 1000000]) if (c.saved >= t) mark('saved-' + t, m.d); }
        if (m.to === 'loan' && m.move && m.add > 0) mark('early-1', m.d);
      } else {
        if ((m.car || 0) > 0) mark('own-car', m.d);
        if ((m.loan || 0) > 0) hadLoan = true; else if (hadLoan && (m.car || 0) > 0) mark('debt-free', m.d);
      }
      if (prevOtb != null && p.otb > prevOtb) {
        const y = p.d.slice(0, 4); yearPut[y] = (yearPut[y] || 0) + (p.otb - prevOtb);
        c.otbYearMax = Math.max(c.otbYearMax, yearPut[y]);
        if (yearPut[y] >= (y < '2027' ? g.otbCap26 : g.otbCap)) mark('otb-full', p.d);
      }
      prevOtb = p.otb;
      c.naMax = Math.max(c.naMax, p.na);
      for (const t of [1000000, 2000000, 3000000]) if (p.na >= t) mark('na-' + t, p.d);
      if (c.target > 0 && p.na >= c.target / 2) mark('half', p.d);
      if (c.target > 0 && p.na >= c.target) mark('goal', p.d);
      if (tileV > 0) { const k = Math.min(XP.tiles, Math.floor(Math.max(0, p.na) / tileV)); for (let j = top + 1; j <= k; j++) c.tiles.push({ d: p.d, j }); top = Math.max(top, k); }
    }
    c.tileN = top; c.line = line;
    // кредит за записанную машину закрыт по графику или досрочно
    const lpc = C.loanPlan(st, iso); if (lpc && lpc.closed) mark('debt-free', lpc.closed);
    const ownDone = (st.quests || []).filter(q => q.done && q.done <= iso).map(q => q.done).sort();
    c.ownDone = ownDone.length;
    mark('ownq-5', ownDone[4]);
    if (g.why && String(g.why).trim()) mark('why', g.whyOn && g.whyOn <= iso ? g.whyOn : st.created && st.created <= iso ? st.created : iso);
    return c;
  }

  // опыт за саму смену: часы с комбо (и «Марафонец» после 10-го часа), сумма, выход в выходной
  function shiftBase(st, d, h, app, p, cb) {
    return h * XP.hour * cb + Math.max(0, h - 10) * XP.hour * cb * 0.1 * rk(st, 'marathon', d) + (app > 0 ? XP.app + 5 * rk(st, 'books', d) : 0) + (p === 0 ? XP.dayOff : 0);
  }
  // ---------------------------------------------------------------- журнал опыта
  function ledger(st, iso, fc, ctx) {
    const c = ctx || context(st, iso), sh = st.shifts || {}, out = [];
    const push = (d, xp, kind, text) => { if (xp > 0) out.push({ d, xp: Math.round(xp), kind, text }); };
    for (const d of Object.keys(sh)) {
      const x = sh[d]; if (d > iso || !x || !(x.h > 0)) continue;
      const h = +x.h, p = C.planHours(st, d), cb = comboAt(st, c.streakOn[d] || 1, d);
      push(d, shiftBase(st, d, h, x.app, p, cb), 'shift', (p === 0 ? 'Выходной в работу: ' : 'Смена ') + C.num1(h) + ' ч' + (cb > 1.001 ? ', комбо ×' + C.num1(cb) : ''));
    }
    for (const [d, q] of Object.entries(c.dq)) {
      if (q.planDone) push(d, XP.planDay, 'day', 'Задание дня: план');
      if (q.moneyDone) push(d, XP.moneyDay, 'day', 'Задание дня: заработок');
      if (q.ordersDone) push(d, XP.ordersDay + 15 * rk(st, 'hunter', d), 'day', 'Задание дня: заказы');
      if (q.chest) push(d, q.chest, 'chest', 'Сундук дня');
    }
    for (const w of c.weeks) push(w.d, XP.week + (w.plus ? XP.weekPlus : 0), 'week', 'Неделя закрыта: ' + C.num1(w.fact) + ' из ' + C.num1(w.plan) + ' ч');
    for (const p of c.paid) push(p.d, XP.paid + 50 * rk(st, 'econ', p.d), 'paid', 'Жизнь на ' + C.MON[+p.mk.slice(5) - 1] + ' оплачена');
    for (const b of c.bosses) push(b.d, XP.boss + 125 * rk(st, 'boss', b.d), 'boss', 'Босс побеждён: ' + b.name);
    for (const r of c.recs) push(r.d, XP.record, 'record', r.kind === 'day' ? 'Рекорд дня: ' + C.money(r.v) : r.kind === 'week' ? 'Рекорд недели: ' + C.num1(r.v) + ' ч' : 'Рекорд месяца: ' + C.money(r.v));
    for (const d of c.rests) push(d, XP.rest + 50 * rk(st, 'breath', d), 'rest', 'Восстановление');
    for (const d of Object.keys(st.mood || {})) if (d <= iso) push(d, XP.mood + 5 * rk(st, 'mode', d), 'mood', 'Отметка: как ты');
    for (const p of c.line) if (C.isAdd(p.x) && p.x.to === 'otb' && p.x.add > 0) push(p.d, Math.floor(p.x.add / 1000) * (XP.per1000 + rk(st, 'piggy', p.d)), 'save', 'В Отбасы ' + C.money(+p.x.add));
    // досрочное гашение тоже приближает цель: меньше процентов
    for (const p of c.line) if (C.isAdd(p.x) && p.x.move && p.x.to === 'loan' && p.x.add > 0) push(p.d, Math.floor(p.x.add / 1000) * (XP.per1000 + rk(st, 'piggy', p.d)), 'save', 'Досрочно по кредиту ' + C.money(+p.x.add));
    for (const t of c.tiles) push(t.d, XP.tile + 50 * rk(st, 'builder', t.d), 'tile', 'Плитка квартиры ' + t.j + ' из ' + XP.tiles);
    for (const [id, d] of Object.entries(st.done || {})) if (questXp(id) && d) push(d > iso ? iso : d, questXp(id), 'quest', 'Веха: ' + questTitle(id));
    for (const q of st.quests || []) if (q.done && q.done <= iso) push(q.done, XP.own, 'quest', 'Задание: ' + q.title);
    for (const b of BADGES) if (c.at[b.id]) push(c.at[b.id], b.xp, 'badge', 'Награда: ' + b.title);
    out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    return out;
  }

  // ---------------------------------------------------------------- игрок
  function player(st, iso, fc) {
    const c = context(st, iso), L = ledger(st, iso, fc, c), xp = L.reduce((s, e) => s + e.xp, 0), lv = levelOf(xp);
    const badges = BADGES.map(b => { const need = b.need(c), cur = Math.max(0, Math.min(need, b.cur(c) || 0)); return { id: b.id, cat: b.cat, icon: b.icon, color: b.color, title: b.title, hint: b.hint, xp: b.xp, on: c.at[b.id] || null, cur, need, pct: need > 0 ? cur / need : 0 }; });
    const mon = C.monday(iso);
    return Object.assign(lv, {
      rank: rankOf(lv.level), ledger: L, badges, skin: skinOf(st, lv.level),
      todayXp: L.filter(e => e.d === iso).reduce((s, e) => s + e.xp, 0), weekXp: L.filter(e => e.d >= mon).reduce((s, e) => s + e.xp, 0),
      streak: c.streak, freezes: c.freezes, combo: c.combo, energy: c.energy, dq: c.dq[iso] || null, boss: c.boss, month: c.month, recs: c.recs,
      tiles: { n: c.tileN, start: c.tileStart, total: XP.tiles, value: c.tile },
      stats: { best: c.best, hours: c.hours, shifts: c.shifts, saved: c.saved, orders: c.orders, bosses: c.bosses.length, chests: c.chests, paid: c.paid.length },
      skills: skills(st, lv.level, iso), attrs: attrs(st, iso, c),
    });
  }
  // навыки игрока: ступени, что откроется дальше, свободные очки
  function skills(st, L, iso) {
    const list = PERKS.map(pk => { const r = rk(st, pk.id), nextLvl = r < 3 ? pk.lvl[r] : null; return Object.assign({}, pk, { r, nextLvl, can: r < 3 && L >= nextLvl, now: r ? pk.text(r) : '', next: r < 3 ? pk.text(r + 1) : '' }); });
    const spent = list.reduce((s, x) => s + x.r, 0), total = pointsOf(L);
    return { list, total, spent, free: total - spent };
  }
  // характеристики персонажа из записей за 4 недели: уровень 1-10, значение и совет
  function attrs(st, iso, c) {
    const g = st.set, lv = x => Math.max(1, Math.min(10, Math.round(x)));
    let h = 0, plan = 0, done = 0, eSum = 0, eN = 0;
    for (let d = C.isoAdd(iso, -27); d <= iso; d = C.isoAdd(d, 1)) {
      const p = C.planHours(st, d), x = st.shifts[d], w = x && x.h > 0 ? +x.h : 0;
      h += w;
      if (p > 0 && d < iso) { plan++; if (w >= p) done++; }
      if (c.energyOn[d] != null) { eSum += c.energyOn[d]; eN++; }
    }
    const recent = Object.keys(st.shifts).filter(d => d <= iso && st.shifts[d].h > 0 && st.shifts[d].app > 0).sort().slice(-10);
    let ratio = null;
    if (recent.length >= 3) {
      let got = 0, exp = 0;
      for (const d of recent) {
        const x = st.shifts[d], ph = C.phaseOn(g, d);
        got += +x.app;
        exp += ph === 'pre' ? g.preRate * x.h : g.R * C.growth(g, C.mkOf(d))[1] * C.keepOf(g, ph) * x.h;
      }
      ratio = exp > 0 ? got / exp : null;
    }
    const closed = (c.months || []).filter(x => !x.partial && x.earned > 0).pop(), m = c.month && c.month.paidOn ? c.month : closed;
    const thrift = m && m.earned > 0 ? (m.earned - m.need) / m.earned : null;
    const out = [
      { key: 'stam', title: 'Выносливость', icon: 'clock', lvl: lv(h / 4 / 8), val: C.num1(Math.round(h / 4)) + ' ч в неделю', tip: 'Часы в неделю за последние 4 недели. 70-80 ч = максимум.' },
      { key: 'disc', title: 'Дисциплина', icon: 'check', lvl: plan ? lv(done / plan * 10) : 1, val: plan ? done + ' из ' + plan + ' ' + C.plural(plan, ['смены', 'смен', 'смен']) + ' по плану' : 'нет смен', tip: 'Сколько плановых смен закрыто полностью за 4 недели.' },
      { key: 'grip', title: 'Хватка', icon: 'target', lvl: ratio == null ? 1 : lv(1 + (ratio - 0.7) / 0.6 * 9), val: ratio == null ? 'внеси суммы 3 смен' : C.money(Math.round(recent.reduce((s, d) => s + st.shifts[d].app / st.shifts[d].h, 0) / recent.length)) + ' в час', tip: 'Заработок в час против плана. Растёт от часов пик, хороших районов и Экспресса в спад.' },
      { key: 'thrift', title: 'Бережливость', icon: 'piggy', lvl: thrift == null ? 1 : lv(1 + (thrift + 0.5) * 9), val: thrift == null ? 'ещё нет закрытого месяца' : (thrift >= 0 ? C.money(Math.round(m.earned - m.need)) + ' сверх жизни за ' + C.MON[+m.mk.slice(5) - 1] : 'за ' + C.MON[+m.mk.slice(5) - 1] + ' жизнь покрыта на ' + C.money(Math.round(m.earned))), tip: 'Сколько заработка остаётся сверх конвертов за последний закрытый месяц.' },
      { key: 'rec', title: 'Восстановление', icon: 'battery', lvl: eN ? lv(eSum / eN / 10) : 10, val: eN ? 'энергия ' + Math.round(eSum / eN) + ' в среднем' : 'энергия полная', tip: 'Средняя энергия за 4 недели. Сон и выходные держат её.' },
    ];
    const weak = out.slice().sort((a, b) => a.lvl - b.lvl)[0];
    return { list: out, weak };
  }

  // опыт за смену до сохранения: часы с комбо, сумма, выходной и задания дня
  function preview(st, iso, h, app, orders) {
    if (!(h > 0)) return { xp: 0, parts: [], combo: 1, q: null };
    const tmp = Object.assign({}, st, { shifts: Object.assign({}, st.shifts, { [iso]: { h, app: app || 0, orders: orders || 0 } }) });
    const c = context(tmp, iso), p = C.planHours(st, iso), cb = comboAt(st, c.streakOn[iso] || 1, iso), q = c.dq[iso] || {};
    const parts = [['часы', h * XP.hour * cb + Math.max(0, h - 10) * XP.hour * cb * 0.1 * rk(st, 'marathon', iso)]];
    if (app > 0) parts.push(['сумма', XP.app + 5 * rk(st, 'books', iso)]);
    if (p === 0) parts.push(['выходной', XP.dayOff]);
    if (q.planDone) parts.push(['план дня', XP.planDay]);
    if (q.moneyDone) parts.push(['заработок дня', XP.moneyDay]);
    if (q.ordersDone) parts.push(['заказы дня', XP.ordersDay + 15 * rk(st, 'hunter', iso)]);
    if (q.chest) parts.push(['сундук', q.chest]);
    return { xp: Math.round(parts.reduce((s, x) => s + x[1], 0)), parts, combo: cb, q };
  }
  // опыт за часы, сумму и выходной (без заданий дня)
  function shiftXp(st, iso, h, app) {
    if (!(h > 0)) return 0;
    return Math.round(h * XP.hour + (app > 0 ? XP.app : 0) + (C.planHours(st, iso) === 0 ? XP.dayOff : 0));
  }

  // задания: вехи пути с опытом и свои задания, ближайшие сверху
  function quests(st, iso, fc) {
    const ms = C.milestones(st, iso, fc).filter(x => x.kind === 'task').map(x => Object.assign({}, x, { xp: questXp(x.id), own: false }));
    const seen = new Set(ms.map(x => x.id));
    for (const [id, d] of Object.entries(st.done || {})) if (!seen.has(id) && questXp(id)) ms.push({ id, title: questTitle(id), date: d, kind: 'task', hint: '', done: true, doneOn: d, xp: questXp(id), own: false });
    const own = (st.quests || []).map(q => ({ id: q.id, title: q.title, date: q.date || '', kind: 'task', hint: q.hint || '', done: !!q.done, doneOn: q.done || null, xp: XP.own, own: true }));
    const all = ms.concat(own), key = x => x.date || '9999';
    return { open: all.filter(x => !x.done).sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0),
      done: all.filter(x => x.done).sort((a, b) => (a.doneOn || '') < (b.doneOn || '') ? 1 : -1) };
  }
  // совет по энергии
  function energyTip(e, frz, off) {
    if (e >= 70) return { tone: 'good', text: off ? 'Силы есть. Выходной твой.' : 'Силы есть. Хороший день, чтобы закрыть план.' };
    if (e >= 40) return { tone: 'ok', text: 'Нормально. Перерыв каждые 2 часа держит темп.' };
    if (e >= 20) return { tone: 'warn', text: 'Устал. Ближайший выходной не трать на работу: отдых сейчас даст бонус.' };
    return { tone: 'warn', text: 'Батарейка почти пустая. За рулём уставшим опасно: возьми выходной.' + (frz ? ' Заморозка сохранит серию.' : '') };
  }

  // опыт с учётом изученных навыков на день d: для подписей и подсказок, те же формулы, что в ledger
  const xpOf = (st, d) => Object.assign({}, XP, {
    app: XP.app + 5 * rk(st, 'books', d), ordersDay: XP.ordersDay + 15 * rk(st, 'hunter', d), paid: XP.paid + 50 * rk(st, 'econ', d),
    boss: XP.boss + 125 * rk(st, 'boss', d), rest: XP.rest + 50 * rk(st, 'breath', d), mood: XP.mood + 5 * rk(st, 'mode', d),
    per1000: XP.per1000 + rk(st, 'piggy', d), tile: XP.tile + 50 * rk(st, 'builder', d), comboStep: XP.comboStep + 0.01 * rk(st, 'combo', d),
  });
  return { XP, xpOf, QUEST_XP, questXp, questTitle, cum, levelOf, RANKS, rankOf, SKINS, skinOf, BADGES, PERKS, pointsOf, rk, context, ledger, player, preview, shiftXp, quests, comboOf, bossName, energyTip };
})();
if (typeof module !== 'undefined') module.exports = Game;
