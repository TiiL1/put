/* Путь к квартире: интерфейс. Главная, Смены, Деньги, Путь, Профиль. Без фреймворков. */
(() => {
  'use strict';
  const C = Core, G = Game, D = Draw, $ = s => document.querySelector(s), ic = D.ic;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const UI = { tab: 'home', week: 0, sel: null, dh: null, dapp: '', sub: null, onb: 0, allDone: false };
  try { const t = sessionStorage.getItem('put.tab'); if (t) UI.tab = t; } catch (e) { /* нет доступа */ }
  const TABS = [['home', 'Главная', 'gauge'], ['shifts', 'Смены', 'cal'], ['money', 'Деньги', 'wallet'], ['path', 'Путь', 'route'], ['me', 'Профиль', 'user']];
  const parseNum = v => { const n = Number(String(v || '').replace(/[\s  ₸]/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const fmtIn = n => n ? C.grp(n) : '';
  const S = () => Store.get();
  const days = n => n + ' ' + C.plural(n, ['день', 'дня', 'дней']);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const moneyHtml = n => C.money(n).replace(/\s₸$/, '') + '<span class="cur">\u00A0₸</span>';
  const mlnShort = n => (Math.round(n / 1e4) / 100).toString().replace('.', ',') + '\u00A0млн\u00A0₸';
  const xpChip = (x, done) => `<span class="xpc${done ? ' done' : ''}">${ic('star')}+${C.grp(x)} XP</span>`;
  let TODAY = C.today();

  // ---------------------------------------------------------------- общие расчёты экрана
  function model() {
    const st = S(); TODAY = C.today();
    const est = C.estimate(st, TODAY), na = est ? est.na : 0;
    const need = C.needExtra(st, TODAY), fc = need.fc, vs = C.versusPlan(st, TODAY, na);
    const target = st.set.target, pct = Math.max(0, Math.min(1, na / target));
    const pl = G.player(st, TODAY, fc);
    return { st, est, na, fc, need, vs, target, pct, pl, left: Math.max(0, target - na), daysLeft: C.isoDiff(TODAY, st.set.deadline) };
  }
  // впереди или отстаёшь: {tone, icon, text, short}
  function status(m) {
    const v = m.vs;
    if (!v) return null;
    if (v.days == null) {
      if (Math.abs(v.diff) < 5000) return { tone: 'plain', icon: 'check', text: 'Идёшь по плану' };
      return v.diff > 0 ? { tone: 'green', icon: 'up', text: 'Впереди плана на ' + C.money(v.diff) } : { tone: 'coral', icon: 'down', text: 'Отстаёшь на ' + C.money(-v.diff) };
    }
    if (Math.abs(v.days) < 1) return { tone: 'plain', icon: 'check', text: 'Идёшь точно по плану' };
    return v.days > 0 ? { tone: 'green', icon: 'up', text: 'Впереди плана на ' + days(v.days), short: '+' + days(v.days) }
      : { tone: 'coral', icon: 'down', text: 'Отстаёшь на ' + days(-v.days), short: '−' + days(-v.days) };
  }
  // отзыв о дне: {tone, icon, title, text}
  function praiseOf(st, d, fc, shift) {
    const tmp = shift ? Object.assign({}, st, { shifts: Object.assign({}, st.shifts, { [d]: shift }) }) : st;
    const s = C.shiftDay(tmp, d, fc);
    if (s.fact == null) return null;
    const dd = Math.abs(s.days) >= 0.05 ? C.daysText(Math.abs(s.days)) : null;
    if (s.plan > 0 && s.fact === 0) return { tone: 'warn', icon: 'moon', title: 'Пропуск смены', text: (dd ? 'Цель дальше на ' + dd + '. ' : '') + 'Можно добрать на неделе.' };
    if (s.plan === 0 && s.fact > 0) return { tone: 'good', icon: 'bolt', title: 'Выходной в работу', text: C.money(s.money, true) + ' к цели' + (dd ? ', ближе на ' + dd : '') + '.' };
    if (s.plan === 0) return { tone: 'ok', icon: 'moon', title: 'Выходной', text: 'Отдых тоже часть плана.' };
    if (s.delta > 0) return { tone: 'good', icon: 'bolt', title: 'Хорошая смена', text: '+' + C.num1(s.delta) + ' ч сверх плана' + (dd ? ': цель ближе на ' + dd : '') + '.' };
    if (s.delta < 0) return { tone: 'warn', icon: 'clock', title: 'Чуть меньше плана', text: C.num1(s.delta).replace('-', '−') + ' ч' + (dd ? ': цель дальше на ' + dd : '') + '. Можно добрать на неделе.' };
    return { tone: 'ok', icon: 'check', title: 'Смена по плану', text: 'Так держать.' };
  }
  function praiseBox(p, xp) {
    if (!p) return '';
    const cls = p.tone === 'good' ? '' : p.tone === 'warn' ? ' warn' : ' green';
    return `<div class="praise${cls}"><div class="praise-i">${ic(p.icon)}</div><div class="praise-b"><div class="praise-t">${esc(p.title)}</div><div class="praise-s">${esc(p.text)}</div></div>${xp ? xpChip(xp) : ''}</div>`;
  }
  const dateHead = iso => cap(C.DOWL[C.dow(iso)]) + ', ' + C.dateShort(iso);
  function streakPill(st) {
    const n = C.streak(st, TODAY);
    return n > 0 ? `<button class="streak" data-a="tab" data-tab="me" aria-label="Смен подряд: ${n}">${ic('flame')}${n}<small>${C.plural(n, ['смена', 'смены', 'смен'])}</small></button>` : '';
  }
  function playerStrip(pl) {
    return `<button class="player" data-a="tab" data-tab="me">${D.hex(pl.level, 40)}
      <div class="player-b"><div class="player-t"><b>${esc(pl.rank.title)}</b><span>${pl.todayXp ? '+' + C.grp(pl.todayXp) + ' XP сегодня' : 'уровень ' + pl.level}</span></div>
      <div class="xpbar"><i style="width:${(pl.pct * 100).toFixed(1)}%"></i></div>
      <div class="player-s">${C.grp(pl.into)} из ${C.grp(pl.need)} XP до ${pl.level + 1} уровня</div></div></button>`;
  }

  // ---------------------------------------------------------------- главная
  function vHome() {
    const m = model(), st = m.st, pl = m.pl, s = status(m), taxi = st.set.taxiFrom && TODAY >= st.set.taxiFrom;
    const yest = C.isoAdd(TODAY, -1), yx = st.shifts[yest], yp = taxi && yx ? praiseOf(st, yest, m.fc) : null;
    return `
    <header class="top"><div><div class="top-k">${dateHead(TODAY)}</div><h1 class="top-t">Путь к квартире</h1></div><div class="top-r">${streakPill(st)}</div></header>
    ${playerStrip(pl)}
    <section class="gauge-wrap" aria-label="Активы ${C.money(m.na)} из ${C.money(m.target)}">
      <div class="gauge">${D.gauge(m.pct, m.target)}
        <div class="g-in"><div class="g-k">Активы</div><div class="g-v">${moneyHtml(m.na)}</div><div class="g-s">из ${C.money(m.target)}</div></div>
        <div class="g-pct">${Math.floor(m.pct * 100)}<span>%</span></div></div>
      ${s ? `<div class="status"><span class="chip ${s.tone}">${ic(s.icon)}${esc(s.text)}</span></div>` : ''}
    </section>
    <div class="tiles"><div class="tile"><div class="over">Осталось</div><b>${moneyHtml(m.left)}</b></div>
      <div class="tile"><div class="over">До срока</div><b>${m.daysLeft}<small> ${C.plural(m.daysLeft, ['день', 'дня', 'дней'])}</small></b><span>${C.dateLong(st.set.deadline)}</span></div></div>
    ${todayCard(m)}
    ${yp && !st.shifts[TODAY] ? `<button class="card tap" data-a="log" data-d="${yest}" style="display:block;width:100%"><div class="over">Вчера, ${C.num1(yx.h)} ч</div>${praiseBox(yp, G.shiftXp(st, yest, +yx.h, +yx.app || 0))}</button>` : ''}
    ${forecastCard(m)}
    ${taxi ? weekCard(m) : ''}
    ${questsPreview(m)}
    ${badgesRow(pl)}
    ${notes(m)}`;
  }
  function nextDaysText(st) {
    const t1 = C.isoAdd(TODAY, 1), p1 = C.planHours(st, t1);
    let off = null;
    for (let i = 1; i <= 7; i++) { const d = C.isoAdd(TODAY, i); if (C.planHours(st, d) === 0) { off = d; break; } }
    return `Завтра <b>${p1 > 0 ? C.num1(p1) + ' ч' : 'выходной'}</b>` + (off && off !== t1 ? `<br>${C.DOW[C.dow(off)]} <b>выходной</b>` : '');
  }
  function todayCard(m) {
    const st = m.st, g = st.set, plan = C.planHours(st, TODAY), x = st.shifts[TODAY];
    if (!g.taxiFrom || TODAY < g.taxiFrom) {
      const Q = G.quests(st, TODAY, m.fc).open[0], ph = C.phaseNow(st, TODAY, m.fc);
      const d = g.taxiFrom ? C.isoDiff(TODAY, g.taxiFrom) : null;
      return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('flag')}</div><div><div class="over">Сейчас главное</div><div class="today-t">${esc(ph.title)}</div></div>
        ${d != null ? `<div class="today-side">до первой смены<br><b>${days(d)}</b></div>` : ''}</div>
        ${Q ? `<button class="quest-line" data-a="tab" data-tab="path"><span>Задание: <b>${esc(Q.title)}</b>${Q.date ? ', ' + C.untilText(TODAY, Q.date) : ''}</span>${xpChip(Q.xp)}</button>` : ''}
        <div class="btns"><button class="btn" data-a="money-add">${ic('plus')}Отложил</button></div></section>`;
    }
    if (x) {
      const p = praiseOf(st, TODAY, m.fc), xp = G.shiftXp(st, TODAY, +x.h, +x.app || 0);
      return `<section class="card"><div class="today-top"><div class="ibox green">${ic('check')}</div><div><div class="over">Сегодня внесено</div><div class="today-t">${+x.h > 0 ? 'Смена ' + C.num1(x.h) + ' ч' : 'Не работал'}</div></div>
        <div class="today-side">${nextDaysText(st)}</div></div>
        ${praiseBox(p, xp)}
        ${+x.h > 0 && !(x.app > 0) ? `<button class="quest-line" data-a="log" data-d="${TODAY}"><span>Внеси сумму из Яндекс Про</span>${xpChip(G.XP.app)}</button>` : ''}
        <div class="btns"><button class="btn ghost" data-a="log" data-d="${TODAY}">${ic('edit')}Изменить</button></div></section>`;
    }
    if (plan > 0) {
      return `<section class="card"><div class="today-top"><div class="ibox">${ic('wheel')}</div><div><div class="over">Сегодня по плану</div><div class="today-t">Смена ${C.num1(plan)} ч</div></div>
        <div class="today-side">${nextDaysText(st)}</div></div>
        <div class="quest-line"><span>Задание дня: отработать ${C.num1(plan)} ч</span>${xpChip(G.shiftXp(st, TODAY, plan, 1))}</div>
        ${quickHours(TODAY, plan)}</section>`;
    }
    return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('moon')}</div><div><div class="over">Сегодня</div><div class="today-t">Выходной</div></div>
      <div class="today-side">${nextDaysText(st)}</div></div>
      <p class="lead">Отдыхай: после отдыха смены идут легче. Если всё же выйдешь, за выходной бонус +${G.XP.dayOff} XP.</p>
      ${quickHours(TODAY, 0)}</section>`;
  }
  function quickHours(iso, plan) {
    const opts = plan > 0 ? [0, 6, plan, plan === 15 ? 14 : 15] : [4, 6, 8, 12];
    const uniq = opts.filter((h, i) => opts.indexOf(h) === i).sort((a, b) => a - b);
    return `<div class="quick">${uniq.map(h => `<button class="q${h === plan && plan > 0 ? ' plan' : ''}" data-a="quick" data-d="${iso}" data-h="${h}">${h}<small>ч</small></button>`).join('')}
      <button class="q own" data-a="log" data-d="${iso}">своё</button></div>`;
  }
  function forecastCard(m) {
    const st = m.st, dl = st.set.deadline, s = status(m);
    if (m.na >= m.target) return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Цель есть</div><div class="fc-sub">${C.money(m.na)} активов. Дальше Отбасы и квартира.</div></section>`;
    if (!m.fc.goal) return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Пока не доходит</div><div class="fc-sub">При таком плане до ${C.money(m.target)} не дойти. Нужны больше часов, газ или своя машина раньше.</div></section>`;
    const g = m.fc.goal.iso, diff = C.isoDiff(g, dl), late = diff < 0, span = Math.max(C.isoDiff(TODAY, dl), C.isoDiff(TODAY, g), 1);
    const pf = Math.max(0, Math.min(100, C.isoDiff(TODAY, g) / span * 100)), pd = Math.max(0, Math.min(100, C.isoDiff(TODAY, dl) / span * 100));
    const ex = m.need.extra;
    const sub = late ? `Позже срока на <b class="down">${days(-diff)}</b>.` + (ex ? ` Чтобы успеть, добавь <b class="down">${C.num1(ex)} ч в неделю</b>.` : ex === null ? ' Одних часов мало: газ, своя машина раньше или меньше расходов.' : '')
      : diff === 0 ? 'Ровно в срок' : `На <b>${days(diff)}</b> раньше срока`;
    return `<section class="card"><div class="between"><div class="over">Прогноз цели</div>${s && s.short ? `<span class="chip ${s.tone}">${ic(s.icon)}${esc(s.short)}</span>` : ''}</div>
      <div class="fc-date">${C.dateLong(g)}</div><div class="fc-sub">${sub}</div>
      <div class="tl"><div class="tl-track"></div><div class="tl-done" style="width:${pf.toFixed(1)}%"></div>
        <div class="tl-fl${late ? ' late' : ''}" style="left:${Math.max(8, Math.min(92, pf)).toFixed(1)}%">прогноз</div><div class="tl-dot" style="left:0"></div>
        <div class="tl-end" style="left:${pd.toFixed(1)}%"></div><div class="tl-dot ${late ? 'late' : 'fc'}" style="left:${pf.toFixed(1)}%"></div></div>
      <div class="tl-lab"><span>Сегодня</span><span>Срок ${C.dateLong(dl)}</span></div></section>`;
  }
  function weekSegs(st, mon) {
    let html = '', lab = '';
    for (let i = 0; i < 7; i++) {
      const d = C.isoAdd(mon, i), p = C.planHours(st, d), x = st.shifts[d], h = x ? +x.h : null;
      let cls = '';
      if (d === TODAY && h == null) cls = 'today';
      else if (h != null && h > 0) cls = p > 0 && h < p ? 'part' : 'full';
      else if (p === 0) cls = 'off';
      const tag = h != null && p > 0 && h > p ? `<span class="bar-tag">+${C.num1(h - p)}</span>` : h > 0 && p === 0 ? `<span class="bar-tag">+${C.num1(h)}</span>` : '';
      html += `<div class="s ${cls}">${tag}</div>`;
      lab += `<span class="${d === TODAY ? 't' : ''}">${C.DOW[i]}</span>`;
    }
    return `<div class="seg">${html}</div><div class="seg-d">${lab}</div>`;
  }
  const weekPlan = (st, mon) => { let p = 0; for (let i = 0; i < 7; i++) p += C.planHours(st, C.isoAdd(mon, i)); return p; };
  function weekCard(m) {
    const st = m.st, mon = C.monday(TODAY), wk = C.weekStats(st, TODAY, m.fc, TODAY), planAll = weekPlan(st, mon);
    const closed = planAll > 0 && wk.fact >= planAll;
    return `<button class="card tap" data-a="tab" data-tab="shifts" style="display:block;width:100%"><div class="wk-h"><div><div class="over">Эта неделя</div><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div></div>
      <div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      ${weekSegs(st, mon)}
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : `Закрой неделю: ещё <b>${C.num1(Math.max(0, planAll - wk.fact))} ч</b>`}</span>${planAll > 0 ? xpChip(G.XP.week, closed) : ''}</div></button>`;
  }
  function questsPreview(m) {
    const Q = G.quests(m.st, TODAY, m.fc).open.slice(0, 3);
    if (!Q.length) return '';
    return `<div class="sec-h"><div class="h3">Задания</div><button class="link" data-a="tab" data-tab="path">Все ${ic('right')}</button></div>
      <section class="card">${Q.map(q => questRow(q, true)).join('')}</section>`;
  }
  function badgesRow(pl) {
    const on = pl.badges.filter(b => b.on).sort((a, b) => a.on < b.on ? 1 : -1), off = pl.badges.filter(b => !b.on);
    const row = on.slice(0, 3).concat(off).slice(0, 4);
    return `<div class="sec-h"><div class="h3">Награды</div><button class="link" data-a="tab" data-tab="me">${on.length} из ${pl.badges.length} ${ic('right')}</button></div>
      <div class="bd-row">${row.map(badgeTile).join('')}</div>`;
  }
  const badgeTile = b => `<button class="bd${b.on ? '' : ' locked'}" data-a="badge" data-id="${b.id}">${D.medal(b.icon, b.color, !b.on)}<b>${esc(b.title)}</b><span>${b.on ? C.dateShort(b.on) : '+' + C.grp(b.xp) + ' XP'}</span></button>`;
  function notes(m) {
    const est = m.est;
    let out = '';
    if (est && est.missed) out += `<button class="card tap" data-a="tab" data-tab="shifts" style="display:block;width:100%"><div class="praise warn" style="margin:0"><div class="praise-i">${ic('cal')}</div><div class="praise-b"><div class="praise-t">Не внесены смены: ${days(est.missed)}</div><div class="praise-s">Внеси, чтобы прогноз и опыт были точными.</div></div></div></button>`;
    if (est && C.isoDiff(est.from, TODAY) > 14) out += `<button class="card tap" data-a="money-edit" style="display:block;width:100%"><div class="praise green" style="margin:0"><div class="praise-i">${ic('wallet')}</div><div class="praise-b"><div class="praise-t">Сверь деньги</div><div class="praise-s">Последний раз обновлял ${C.dateShort(est.from)}. Запиши, сколько сейчас.</div></div></div></button>`;
    return out;
  }

  // ---------------------------------------------------------------- смены
  function vShifts() {
    const st = S(), fc = C.forecast(st, TODAY), mon = C.isoAdd(C.monday(TODAY), UI.week * 7);
    const ds = Array.from({ length: 7 }, (_, i) => C.isoAdd(mon, i));
    if (!UI.sel || UI.sel < mon || UI.sel > ds[6]) { UI.sel = ds.indexOf(TODAY) >= 0 ? TODAY : ds[0]; UI.dh = null; }
    const wk = C.weekStats(st, mon, fc, TODAY), mk = C.mkOf(UI.week === 0 ? TODAY : mon), mo = C.monthStats(st, mk, fc, TODAY), planAll = weekPlan(st, mon);
    const mr = C.measuredR(st, TODAY, 120), sc = C.scenarioOf(mr.n >= 3 ? mr.R : null), scHint = sc ? SC_HINT[C.phaseOn(st.set, TODAY) === 'own' ? 'own' : 'rent'][sc.key] : '';
    const label = UI.week === 0 ? 'Эта неделя' : UI.week === -1 ? 'Прошлая неделя' : UI.week === 1 ? 'Следующая неделя' : 'Неделя';
    const closed = planAll > 0 && wk.fact >= planAll && ds[6] < TODAY;
    return `
    <header class="top"><div><div class="top-k">Смены</div><h1 class="top-t">${label}</h1></div><div class="top-r">${streakPill(st)}</div></header>
    <section class="card">
      <div class="between"><div class="over">${+mon.slice(8)}${mon.slice(5, 7) !== ds[6].slice(5, 7) ? ' ' + C.dateShort(mon).split(' ')[1] : ''}–${C.dateShort(ds[6])}</div>
        <div class="top-r"><button class="icon-btn" data-a="week" data-v="-1" aria-label="Неделя назад">${ic('left')}</button><button class="icon-btn" data-a="week" data-v="1" aria-label="Неделя вперёд">${ic('right')}</button></div></div>
      <div class="wk-h"><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div><div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      <div class="bars">${ds.map(d => barCol(st, d)).join('')}</div>
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : planAll > 0 ? `Неделя закрыта, если будет ${C.num1(planAll)} ч` : 'Неделя без плана'}</span>${planAll > 0 ? xpChip(G.XP.week, closed) : ''}</div>
    </section>
    ${dayPanel(st, UI.sel, fc)}
    <section class="card"><div class="over">${cap(C.MON[+mk.slice(5) - 1])}</div>${statsBlock(mo)}</section>
    ${mr.n >= 3 ? `<section class="card"><div class="over">Твоя выручка</div>
      <p class="lead">За 12 ч в приложении в среднем <b>${C.money(C.appPer12(st, TODAY, mr.R) || 0)}</b>.${sc ? ` Это <b>${sc.name}</b> сценарий: ${esc(scHint)}.` : ''}</p>
      <div class="sub">По ${mr.n} ${C.plural(mr.n, ['смене', 'сменам', 'сменам'])} за 4 месяца${st.set.rLog && mr.n >= 10 ? '. Прогноз уже считается по ним.' : '. С 10 смен прогноз начнёт считаться по ним.'}</div></section>` : ''}
    <section class="card"><div class="over">Обычная неделя</div>
      <div class="tpl">${C.DOW.map((n, i) => `<button class="tpl-d${st.set.tpl[i] ? '' : ' off'}" data-a="tpl" data-i="${i}"><span>${n}</span><b>${st.set.tpl[i] ? C.num1(st.set.tpl[i]) : ic('moon')}</b></button>`).join('')}</div>
      <div class="sub">Нажми на день, чтобы поменять часы. Разовый выходной или смену ставь на конкретный день выше.</div></section>`;
  }
  // что значит выручка: на аренде и на своей машине по-разному (план считается по надёжному сценарию)
  const SC_HINT = {
    rent: { bad: 'на аренде в минус, нужна своя машина, газ и 7/0', reliable: 'на аренде почти ничего не остаётся, своя машина как можно раньше', mid: 'на аренде уже можно понемногу копить', good: 'можно копить и на аренде' },
    own: { bad: 'ниже плана, догнать помогут газ и 7/0', reliable: 'как в плане', mid: 'лучше плана', good: 'намного лучше плана' },
  };
  function barCol(st, d) {
    const p = C.planHours(st, d), x = st.shifts[d], h = x ? +x.h : null, future = d > TODAY, k = 104 / 16;
    const cls = (d === TODAY ? ' today' : '') + (d === UI.sel && d !== TODAY ? ' sel' : '');
    const px = v => (Math.min(v, 16) * k).toFixed(0) + 'px';
    let col, val;
    if (h != null && h > 0) {
      const base = p > 0 ? Math.min(h, p) : h, extra = p > 0 ? Math.max(0, h - p) : 0, short = p > 0 && h < p;
      col = (p > 0 ? `<div class="bar-plan" style="height:${px(p)}"></div>` : '') +
        (extra > 0 ? `<div class="bar-extra" style="height:${(Math.min(extra, Math.max(1, 16 - base)) * k + 6).toFixed(0)}px"><span class="bar-tag">+${C.num1(extra)}</span></div>` : '') +
        `<div class="bar-fill${short ? ' short' : ''}" style="height:${px(base)}">${p === 0 ? `<span class="bar-tag">+${C.num1(h)}</span>` : ''}</div>`;
      val = `<span class="bar-v">${C.num1(h)}</span>`;
    } else if (p > 0) {
      col = d === TODAY && h == null ? `<div class="bar-q">${ic('plus')}</div>` : `<div class="bar-plan" style="height:${px(p)}"></div>`;
      val = h === 0 ? `<span class="bar-v miss">0</span>` : future || d === TODAY ? `<span class="bar-v dim">${C.num1(p)}</span>` : `<span class="bar-v miss">?</span>`;
    } else {
      col = `<div class="bar-off">${ic('moon')}</div>`;
      val = `<span class="bar-v dim">вых</span>`;
    }
    return `<button class="bar${cls}" data-a="day" data-d="${d}" aria-label="${C.DOWL[C.dow(d)]} ${C.dateShort(d)}"><span class="bar-d">${C.DOW[C.dow(d)]}</span><div class="bar-col">${col}</div>${val}</button>`;
  }
  // панель выбранного дня: прошлое и сегодня вносим, будущее планируем
  function dayPanel(st, d, fc) {
    const plan = C.planHours(st, d), x = st.shifts[d] || null, head = d === TODAY ? 'Сегодня, ' + C.DOWL[C.dow(d)] : cap(C.DOWL[C.dow(d)]) + ', ' + C.dateShort(d);
    if (d > TODAY) {
      return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('cal')}</div><div><div class="over">${esc(head)}</div><div class="today-t">План: ${plan > 0 ? C.num1(plan) + ' ч' : 'выходной'}</div></div></div>
        <div class="quick">${[0, 6, 8, 10, 12].map(h => `<button class="q${plan === h ? ' sel' : ''}${h ? '' : ' wide'}" data-a="set-plan" data-d="${d}" data-h="${h}">${h ? h + '<small>ч</small>' : 'вых'}</button>`).join('')}</div>
        ${st.over[d] != null ? `<div class="btns"><button class="btn ghost" data-a="clear-plan" data-d="${d}">Как обычно: ${st.set.tpl[C.dow(d)] ? C.num1(st.set.tpl[C.dow(d)]) + ' ч' : 'выходной'}</button></div>` : ''}</section>`;
    }
    if (!st.set.taxiFrom || d < st.set.taxiFrom) {
      return `<section class="card"><div class="over">${esc(head)}</div><p class="lead">${st.set.taxiFrom ? 'Смены начнутся ' + C.dateLong(st.set.taxiFrom) + '.' : 'Дата первой смены не задана.'} Её можно поменять в профиле, в настройках.</p></section>`;
    }
    if (UI.dh == null && x) { UI.dh = +x.h; UI.dapp = x.app ? C.grp(x.app) : ''; }
    const h = UI.dh, base = plan > 0 ? [0, 6, plan, plan === 15 ? 14 : 15] : [0, 6, 8, 12];
    const opts = base.filter((v, i) => base.indexOf(v) === i).sort((a, b) => a - b), own = h != null && opts.indexOf(h) < 0;
    return `<section class="card"><div class="today-top"><div class="ibox">${ic('wheel')}</div><div><div class="over">${esc(head)} · ${plan > 0 ? 'план ' + C.num1(plan) + ' ч' : 'выходной'}</div><div class="today-t">Сколько отработал?</div></div></div>
      <div class="quick">${opts.map(v => `<button class="q${v === plan && plan > 0 ? ' plan' : ''}${h === v ? ' sel' : ''}" data-a="dh" data-h="${v}">${v}<small>ч</small></button>`).join('')}
        <button class="q own${own ? ' sel' : ''}" data-a="dh-own">${own ? C.num1(h) + ' ч' : 'своё'}</button></div>
      <label class="fld" id="own-h" ${own ? '' : 'hidden'}><span>Часов</span><input inputmode="decimal" id="p-h" value="${h != null ? C.num1(h) : ''}" placeholder="например 13,5"></label>
      <label class="fld"><span>В приложении за день, ₸ <span class="dim">(+${G.XP.app} XP)</span></span><input inputmode="numeric" id="p-app" value="${esc(UI.dapp)}" placeholder="крупная цифра в Яндекс Про"></label>
      <div class="preview" id="pv">${previewHtml(st, d, fc)}</div>
      <div class="btns"><button class="btn" data-a="save-day" data-d="${d}" ${h == null ? 'disabled style="opacity:.5"' : ''}>${ic('check')}Сохранить смену</button></div>
      ${x ? `<button class="btn danger" data-a="del-log" data-d="${d}">${ic('trash')}Удалить запись</button>` : ''}</section>`;
  }
  const capWarn = h => h > G.XP.hourCap ? `<div class="sh-warn">После 12 ч за рулём риск аварии примерно вдвое выше. Опыт идёт за первые 12 ч, деньги за все.</div>` : '';
  function previewHtml(st, d, fc) {
    const h = UI.dh;
    if (h == null) return '';
    const app = parseNum(UI.dapp);
    return praiseBox(praiseOf(st, d, fc, { h, app }), G.shiftXp(st, d, h, app)) + capWarn(h);
  }
  function statsBlock(x) {
    const dd = Math.abs(x.days) >= 0.05 ? (x.days > 0 ? '+' : '−') + C.daysText(Math.abs(x.days)) : 'по плану';
    return `<div class="kv"><div><span>Часы</span><b>${C.num1(x.fact)} <small>из ${C.num1(x.plan)}</small></b></div>
      <div><span>В приложении</span><b>${C.money(x.app)}</b></div>
      <div><span>На руки за час</span><b>${x.perHour ? C.money(x.perHour) : '-'}</b></div>
      <div><span>${x.days < -0.05 ? 'Цель дальше' : 'Цель ближе'}</span><b class="${x.days > 0.05 ? 'up' : x.days < -0.05 ? 'down' : ''}">${dd}</b></div></div>`;
  }

  // ---------------------------------------------------------------- деньги
  function vMoney() {
    const m = model(), st = m.st, last = C.lastMoney(st, TODAY), est = m.est, now = nowParts(st, est);
    const parts = last ? [['Деньги', now.cash, 'var(--green)'], ['Отбасы', now.otb, 'var(--blue)'], ['Машина', now.car, 'var(--yellow)'], ['Кредит', -now.loan, 'var(--coral)']] : [];
    const tot = parts.reduce((s, p) => s + Math.abs(p[1]), 0);
    const loanFill = 'repeating-linear-gradient(135deg,rgba(255,120,103,.95) 0 3px,rgba(255,120,103,.35) 3px 7px)';
    return `
    <header class="top"><div><div class="top-k">Деньги</div><h1 class="top-t">Активы для цели</h1></div></header>
    <section class="card"><div class="over">Сейчас примерно</div><div class="money-top"><div class="num">${moneyHtml(m.na)}</div></div>
      ${tot > 0 ? `<div class="as-bar">${parts.filter(p => p[1] !== 0).map(p => `<i style="flex:${(Math.abs(p[1]) / tot).toFixed(4)};background:${p[1] < 0 ? loanFill : p[2]}"></i>`).join('')}</div>` : ''}
      <ul class="as-list">${parts.map(([n, v, c]) => `<li class="${v < 0 ? 'neg' : ''}"><span><i style="--c:${c}"></i>${n}</span><b>${C.money(v)}</b></li>`).join('')}</ul>
      ${est && (est.add || est.adds.cash || est.adds.otb) ? `<div class="as-note">По отметке на ${C.dateShort(est.from)}: ${C.money(C.naOf(last))}.${est.adds.cash + est.adds.otb ? ` Отложил после неё: ${C.money(est.adds.cash + est.adds.otb, true)}.` : ''}${est.add ? ` Смены минус жизнь: примерно ${C.money(est.add, true)}.` : ''}</div>` : ''}
      <div class="btns"><button class="btn" data-a="money-add">${ic('plus')}Отложил</button><button class="btn alt" data-a="money-edit">Обновить всё</button></div>
      <div class="as-note">Отложил 1 000 ₸: +1 XP. За каждые 10% цели +${G.XP.goalStep} XP.</div>
    </section>
    <section class="card"><div class="over">План и прогноз</div>${chart(m)}
      <div class="legend"><span><i style="background:#8A93B3"></i>план</span><span><i style="background:var(--green)"></i>прогноз</span><span><i style="background:#fff;width:8px;height:8px;border-radius:50%"></i>отметки</span><span><i style="background:var(--yellow)"></i>цель</span></div></section>
    <section class="card"><div class="over">История</div>${C.moneyLine(st).reverse().slice(0, 30).map((p, i, a) => {
      const x = p.x, prev = a[i + 1], ch = prev ? p.na - prev.na : null;
      const what = C.isAdd(x) ? 'отложил ' + C.money(+x.add) + (x.to === 'otb' ? ' в Отбасы' : '') : 'отметка';
      return `<div class="hist"><div>${C.dateShort(x.d)} ${x.d.slice(0, 4)}<small>${esc(x.note && !C.isAdd(x) ? x.note : what)}</small></div><div><b>${C.money(p.na)}</b>${ch != null ? `<em class="${ch >= 0 ? 'up' : 'down'}">${C.money(ch, true)}</em>` : ''}</div></div>`;
    }).join('')}</section>`;
  }
  // сколько сейчас по частям: отметка + пополнения после неё + оценка смен (в деньгах)
  function nowParts(st, est) {
    const l = C.lastMoney(st, TODAY) || {}, ad = est ? est.adds : { cash: 0, otb: 0 };
    return { cash: (l.cash || 0) + ad.cash + (est ? est.add : 0), otb: (l.otb || 0) + ad.otb, car: l.car || 0, loan: l.loan || 0 };
  }
  function chart(m) {
    const st = m.st, W = 340, H = 180, P = 10, top = 16;
    const dl = C.mkOf(st.set.deadline), fcRows = m.fc.rows.filter(r => r.mk <= dl), base = st.base ? st.base.rows.filter(r => r.mk <= dl) : [];
    const ml = C.moneyLine(st, TODAY);
    const pts = [...base.map(r => r.na), ...fcRows.map(r => r.na), ...ml.map(p => p.na), st.set.target, 0];
    const lo = Math.min(...pts), hi = Math.max(...pts);
    const from = st.base ? st.base.from : (st.money[0] || {}).d || TODAY;
    const t0 = C.isoDiff('2026-01-01', from), t1 = C.isoDiff('2026-01-01', st.set.deadline);
    const X = iso => P + (W - 2 * P) * (C.isoDiff('2026-01-01', iso) - t0) / Math.max(1, t1 - t0);
    const Y = v => H - P - (H - P - top) * (v - lo) / Math.max(1, hi - lo);
    const end = mk => mk + '-' + C.pad(C.dim(mk));
    const line = (rows, x0, v0) => [[x0, v0], ...rows.map(r => [end(r.mk), r.na])].map(([d, v], i) => (i ? 'L' : 'M') + X(d).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const b = st.base ? `<path class="c-plan" d="${line(base, st.base.from, st.base.na0)}"/>` : '';
    const fl = line(fcRows, TODAY, m.na), lastX = X(end(fcRows.length ? fcRows[fcRows.length - 1].mk : C.mkOf(TODAY))), y0 = Y(Math.max(lo, 0));
    const area = fl + ` L${lastX.toFixed(1)} ${y0.toFixed(1)} L${X(TODAY).toFixed(1)} ${y0.toFixed(1)}Z`;
    const dots = ml.map(p => `<circle class="c-fact" cx="${X(p.d).toFixed(1)}" cy="${Y(p.na).toFixed(1)}" r="4"/>`).join('');
    const ty = Y(st.set.target);
    const years = []; for (let y = +from.slice(0, 4) + 1; y <= +st.set.deadline.slice(0, 4); y++) years.push(y);
    const grid = years.map(y => { const x = X(y + '-01-01'); return x > P && x < W - P ? `<line class="c-grid" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${H - P}"/><text class="c-t" x="${(x + 3).toFixed(1)}" y="${H - P - 4}">${y}</text>` : ''; }).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="План и прогноз активов">
      <defs><linearGradient id="cArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DDC91" stop-opacity=".22"/><stop offset="1" stop-color="#3DDC91" stop-opacity="0"/></linearGradient></defs>
      ${grid}<line class="c-target" x1="${P}" x2="${W - P}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text class="c-ty" x="${P}" y="${(ty - 5).toFixed(1)}">цель ${mlnShort(st.set.target)}</text>
      <path class="c-area" d="${area}"/>${b}<path class="c-fc-glow" d="${fl}"/><path class="c-fc" d="${fl}"/>${dots}</svg>`;
  }

  // ---------------------------------------------------------------- путь
  function stationsOf(m) {
    const st = m.st, g = st.set, fc = m.fc, last = C.lastMoney(st, TODAY) || {}, L = [];
    const add = (key, title, date, icon, done) => { if (date) L.push({ key, title, date, icon, done: !!done }); };
    add('license', 'Права', g.license, 'wheel', st.done.license);
    if (g.carFrom) add('car', 'Машина', g.carFrom, 'car', st.done.car || (last.car || 0) > 0);
    if (g.carFrom && fc.closed) add('loan', 'Кредит', fc.closed + '-' + C.pad(C.dim(fc.closed)), 'key', (last.car || 0) > 0 && !(last.loan > 0) && st.money.some(x => x.loan > 0));
    add('goal', mlnShort(g.target), fc.goal ? fc.goal.iso : g.deadline, 'flag', m.na >= g.target);
    const otb3 = g.otbOpen ? C.addYears(g.otbOpen, 3) : '';
    add('otb', 'Отбасы', otb3, 'bank', otb3 && TODAY >= otb3);
    L.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    L.push({ key: 'flat', title: 'Квартира', date: L.reduce((x, s) => s.date > x ? s.date : x, TODAY), icon: 'house', done: false });
    let lastDone = -1;
    L.forEach((s, i) => { if (s.done) lastDone = i; });
    L.forEach((s, i) => { s.state = i <= lastDone ? 'done' : i === lastDone + 1 ? 'next' : 'todo'; });
    L.forEach(s => {
      const mo = C.MON[+s.date.slice(5, 7) - 1].slice(0, 3) + ' ' + s.date.slice(0, 4);
      s.sub = s.key === 'flat' ? 'по схеме 50/50' : s.state === 'next' ? C.untilText(TODAY, s.date) : s.state === 'todo' ? mo : '';
    });
    const nx = L[lastDone + 1], prevDate = lastDone >= 0 ? (L[lastDone].date < TODAY ? L[lastDone].date : TODAY) : (st.created || TODAY);
    let t = nx ? C.isoDiff(prevDate, TODAY) / Math.max(1, C.isoDiff(prevDate, nx.date)) : 1;
    t = Math.max(0.3, Math.min(0.72, t)); // машина между станциями, не поверх них
    return { L, car: { seg: lastDone + 1, t }, next: nx };
  }
  function vPath() {
    const m = model(), st = m.st, ph = C.phaseNow(st, TODAY, m.fc), R = stationsOf(m), s = status(m), ex = m.need.extra;
    const tag = s && s.short ? { text: s.short, tone: s.tone === 'coral' ? 'down' : 'up' } : null;
    const yrs = [0, 1, 2].map(i => +TODAY.slice(0, 4) + i).filter(y => y <= +st.set.deadline.slice(0, 4)).map(y => {
      const mk = y + '-12', fr = m.fc.rows.find(r => r.mk === mk), br = st.base && st.base.rows.find(r => r.mk === mk);
      return `<div class="yr"><span>Конец ${y}</span><b>${fr ? C.mln(fr.na) : '-'}</b><small>план ${br ? C.mln(br.na) : '-'}</small></div>`;
    }).join('');
    const Q = G.quests(st, TODAY, m.fc), nx = R.next;
    const nxt = nx ? (nx.key === 'loan' ? 'кредит закрыт' : nx.key === 'goal' ? C.money(st.set.target) + ' активов' : nx.key === 'otb' ? 'депозиту Отбасы 3 года' : nx.title.toLowerCase()) : '';
    return `
    <header class="top"><div><div class="top-k">Путь</div><h1 class="top-t">Этап ${ph.n} из ${ph.total}</h1></div></header>
    <section class="road-card"><div class="road-head"><div class="ibox violet">${ic('route')}</div><div><div class="road-k">Сейчас</div><div class="road-t">${esc(ph.title)}</div></div>
      ${tag ? `<span class="chip ${s.tone}" style="margin-left:auto">${ic(s.icon)}${esc(tag.text)}</span>` : ''}</div>
      ${D.road(R.L, R.car, m.pl.skin, null)}
      <div class="stages" style="margin:0 18px">${C.PHASES.map((_, i) => `<i class="${i + 1 < ph.n ? 'done' : i + 1 === ph.n ? 'now' : ''}"></i>`).join('')}</div>
      <div class="road-foot"><span>${nx ? `Дальше: <b>${esc(nxt)}</b>, ${C.dateLong(nx.date)}${nx.key === 'loan' || nx.key === 'goal' ? ' по прогнозу' : ''}` : 'Все вехи пройдены'}</span></div></section>
    <section class="card"><div class="over">Чтобы успеть к ${C.dateLong(st.set.deadline)}</div>
      <p class="lead">${m.na >= m.target ? 'Цель уже есть.' : ex === 0 ? `Успеваешь с запасом <b>${days(m.need.slackDays)}</b>.` : ex ? `Добавь <b>${C.num1(ex)} ч в неделю</b> к обычному графику.` : 'Одних часов мало: нужны газ, своя машина раньше или меньше расходов.'}</p>
      <div class="years">${yrs}</div></section>
    <div class="sec-h"><div class="h3">Задания</div><span class="link">${Q.open.length}</span></div>
    <section class="card">${Q.open.map(q => questRow(q, false)).join('') || '<p class="lead">Все задания сделаны.</p>'}
      <button class="add-q" data-a="quest-new">${ic('plus')}Своё задание</button></section>
    ${Q.done.length ? `<div class="sec-h"><div class="h3">Сделано</div><span class="link">${Q.done.length}</span></div>
      <section class="card">${Q.done.slice(0, UI.allDone ? 999 : 4).map(q => questRow(q, false)).join('')}
      ${Q.done.length > 4 && !UI.allDone ? `<button class="btn ghost" data-a="all-done">Показать все</button>` : ''}</section>` : ''}`;
  }
  function questRow(q, compact) {
    const d = q.date ? C.isoDiff(TODAY, q.date) : null;
    const when = q.done ? 'сделано ' + C.dateShort(q.doneOn) : q.date ? `<span class="${d < 0 ? 'late' : d <= 14 ? 'soon' : ''}">${C.untilText(TODAY, q.date)}</span> · ${C.dateLong(q.date)}` : 'без даты';
    return `<div class="quest${q.done ? ' done' : ''}">
      <button class="chk" data-a="${q.own ? 'own-done' : 'done'}" data-id="${esc(q.id)}" aria-pressed="${q.done}" aria-label="Отметить: ${esc(q.title)}">${ic('check')}</button>
      <div><div class="quest-t"><b>${esc(q.title)}</b>${xpChip(q.xp, q.done)}</div><div class="quest-w">${when}</div>
      ${!compact && q.hint && !q.done ? `<div class="quest-h">${esc(q.hint)}</div>` : ''}
      ${!compact && q.own ? `<button class="quest-x" data-a="quest-del" data-id="${esc(q.id)}">Удалить задание</button>` : ''}</div></div>`;
  }

  // ---------------------------------------------------------------- профиль
  function vMe() {
    if (UI.sub === 'settings') return vSettings();
    const st = S(), pl = G.player(st, TODAY, C.forecast(st, TODAY)), rk = pl.rank, c = Store.cloud, x = pl.stats;
    const on = pl.badges.filter(b => b.on).length;
    const cloudTxt = c.status === 'ok' ? `В облаке${c.user ? ': ' + esc(c.user.email || '') : ''}. Данные есть на всех устройствах.` : c.status === 'error' ? esc(c.error) : c.status === 'sync' || c.status === 'loading' ? 'Подключаюсь…' : 'Данные только на этом телефоне. Войди через Google, чтобы не потерять их и видеть на других устройствах.';
    return `
    <header class="top"><div><div class="top-k">Профиль</div><h1 class="top-t">Прокачка</h1></div><div class="top-r"><button class="icon-btn" data-a="sub" data-v="settings" aria-label="Настройки">${ic('gear')}</button></div></header>
    <section class="prof">${D.hex(pl.level, 92)}<div class="prof-rank">${esc(rk.title)}</div><div class="prof-lv">Уровень ${pl.level}</div>
      <div class="xpbar big"><i style="width:${(pl.pct * 100).toFixed(1)}%"></i></div>
      <div class="prof-xp"><span><b>${C.grp(pl.into)}</b> из ${C.grp(pl.need)} XP</span><span>до ${pl.level + 1} уровня</span></div>
      ${rk.next ? `<div class="prof-next">Следующее звание: <b>${esc(rk.next.title)}</b> с ${rk.next.level} уровня</div>` : '<div class="prof-next">Высшее звание</div>'}</section>
    <div class="stats">
      <div class="stat"><b>${C.grp(pl.xp)}</b><span>опыта всего</span></div>
      <div class="stat"><b>${C.grp(x.hours)}</b><span>часов на линии</span></div>
      <div class="stat"><b>${C.grp(x.shifts)}</b><span>${C.plural(x.shifts, ['смена', 'смены', 'смен'])}</span></div>
      <div class="stat"><b>${x.best}</b><span>лучшая серия</span></div>
      <div class="stat"><b>${x.saved >= 1e6 ? C.mln(x.saved) : C.grp(x.saved)}</b><span>отложено${x.saved >= 1e6 ? '' : ', ₸'}</span></div>
      <div class="stat"><b>${on} из ${pl.badges.length}</b><span>наград</span></div></div>
    <div class="sec-h"><div class="h3">Награды</div></div>
    <div class="bd-row">${pl.badges.map(badgeTile).join('')}</div>
    <div class="sec-h"><div class="h3">Гараж</div><span class="link">цвет машины на дороге</span></div>
    <div class="garage">${G.SKINS.map(s => `<button class="skin${s.id === pl.skin.id ? ' on' : ''}${s.level > pl.level ? ' locked' : ''}" data-a="skin" data-id="${s.id}">${D.carIcon(s.body, s.shade)}${esc(s.name)}<small>${s.level > pl.level ? 'с ' + s.level + ' уровня' : s.id === pl.skin.id ? 'выбрана' : 'открыта'}</small></button>`).join('')}</div>
    <div class="sec-h"><div class="h3">Опыт</div><span class="link">+${C.grp(pl.weekXp)} за неделю</span></div>
    <section class="card">${pl.ledger.slice().reverse().slice(0, 25).map(e => `<div class="xp-row"><div>${esc(e.text)}<small>${C.dateLong(e.d)}</small></div>${xpChip(e.xp)}</div>`).join('') || '<p class="lead" style="margin-top:0">Опыт появится после первой смены, отложенных денег или выполненного задания.</p>'}</section>
    <div class="sec-h"><div class="h3">Данные</div></div>
    <section class="card"><p class="lead" style="margin-top:0">${cloudTxt}</p>
      <div class="btns">${c.user ? `<button class="btn alt sm" data-a="signout">Выйти</button>` : `<button class="btn sm" data-a="signin">${ic('cloud')}Войти через Google</button>`}</div>
      <button class="row-btn" data-a="export">${ic('dl')}<span>Скачать копию</span></button>
      <label class="row-btn tap">${ic('ul')}<span>Загрузить копию</span><input type="file" accept="application/json,.json" data-a="import" hidden></label>
      <button class="row-btn" data-a="sub" data-v="settings">${ic('gear')}<span>Настройки и расчёт</span>${ic('right')}</button></section>
    <div class="sec-h"><div class="h3">Как растёт опыт</div></div>
    <section class="card"><p class="sub" style="margin-top:0">Час на линии +${G.XP.hour} XP, но не больше ${G.XP.hourCap} ч в день: дальше растёт риск аварии. Сумма из Яндекс Про +${G.XP.app}. Выход в выходной +${G.XP.dayOff}. Неделя без недобора +${G.XP.week}. Отложил 1 000 ₸: +1. Каждые 10% цели +${G.XP.goalStep}. Вехи пути от 200 до 1 000, свои задания +${G.XP.own}, награды от 100 до 5 000. Опыт считается из записей: поправил смену, опыт пересчитался.</p></section>`;
  }
  const FIELDS = [
    ['Цель', [['target', 'Сумма цели, ₸', 'money'], ['deadline', 'Срок', 'date']]],
    ['Жизнь и выручка', [['living', 'На жизнь в месяц, ₸', 'money'], ['R', 'Пассажиры платят за час на линии, ₸', 'money'], ['rLog', 'Считать по моим сменам (от 10 смен)', 'bool'], ['preSave', 'До такси откладываю в месяц, ₸', 'money']]],
    ['Даты', [['otbOpen', 'Депозит Отбасы открыт', 'date'], ['license', 'Права', 'date'], ['taxiFrom', 'Первая смена', 'date'], ['carFrom', 'Своя машина с (пусто: всё время аренда)', 'date']]],
    ['Машина', [['price', 'Цена машины, ₸', 'money'], ['down', 'Взнос, %', 'num'], ['v36', 'Цена продажи через 3 года, ₸', 'money'], ['l100', 'Расход, л на 100 км', 'num'], ['repair', 'Резерв на ремонт в месяц, ₸', 'money'], ['fuel', 'Топливо', 'fuel'], ['gasFrom', 'Газ с (пусто: сразу с покупки)', 'date']]],
    ['Аренда', [['rentDay', 'Аренда в сутки, ₸', 'money']]],
  ];
  function vSettings() {
    const g = S().set;
    const field = ([k, label, type]) => {
      const v = g[k];
      if (type === 'bool') return `<label class="fld sw"><span>${label}</span><input type="checkbox" data-f="${k}" ${v ? 'checked' : ''}></label>`;
      if (type === 'fuel') return `<div class="fld"><span>${label}</span><div class="segm">${[['petrol', 'бензин'], ['gas', 'газ']].map(([x, n]) => `<button data-a="fuel" data-v="${x}" aria-pressed="${v === x}">${n}</button>`).join('')}</div></div>`;
      if (type === 'date') return `<label class="fld"><span>${label}</span><input type="date" data-f="${k}" value="${esc(v || '')}"></label>`;
      return `<label class="fld"><span>${label}</span><input inputmode="decimal" data-f="${k}" data-t="${type}" value="${type === 'money' ? fmtIn(v) : esc(String(v).replace('.', ','))}"></label>`;
    };
    return `
    <header class="top"><div class="top-r"><button class="icon-btn" data-a="sub-back" aria-label="Назад">${ic('left')}</button><div><div class="top-k">Профиль</div><h1 class="top-t">Настройки</h1></div></div></header>
    ${FIELDS.map(([t, fs]) => `<section class="card"><div class="over">${t}</div>${fs.map(field).join('')}</section>`).join('')}
    <section class="card"><div class="over">План</div><p class="sub">С планом сравнивается, впереди ты или отстаёшь. Если поменял даты или машину, начни план заново от сегодня.</p>
      <div class="btns"><button class="btn alt sm" data-a="rebase">Пересчитать план от сегодня</button></div></section>
    <section class="card"><div class="over">Как считается</div><p class="sub">Помесячно: комиссия Яндекса 17%, парк 5,9% на аренде, соцплатежи самозанятого 4%, бензин 255 ₸, газ 112 ₸ за литр, рост цен 9% в год, выручки ${C.num1(g.gRev)}% в год, кредит около 2,5% в месяц с досрочкой, Отбасы 2% годовых и премия 20% до 200 МРП в год. Машина считается по цене продажи, кредит вычитается.</p></section>
    <section class="card"><button class="btn danger" data-a="reset">${ic('trash')}Стереть всё на этом телефоне</button></section>`;
  }

  // ---------------------------------------------------------------- первый запуск
  const OB = {};
  function vOnboard() {
    const g = S().set, st = UI.onb;
    const steps = [
      `<div class="ob-art">${D.hex(1, 84)}</div><h1 class="ob-t">Путь к квартире</h1>
       <p class="lead">Цель: ${C.money(g.target)} активов к ${C.dateLong(g.deadline)}. Машина тоже считается: её можно продать.</p>
       <p class="lead">За смены, отложенные деньги и пройденные вехи получаешь опыт, растёшь в уровнях и открываешь награды.</p>
       <label class="fld"><span>Цель, ₸</span><input inputmode="numeric" data-f="target" data-t="money" value="${fmtIn(g.target)}"></label>
       <label class="fld"><span>Срок</span><input type="date" data-f="deadline" value="${g.deadline}"></label>`,
      `<h1 class="ob-t">Сколько у тебя сейчас</h1><p class="lead">Можно примерно. Потом обновишь во вкладке Деньги.</p>
       ${[['cash', 'Деньги: карты, наличные, вклады'], ['otb', 'Отбасы'], ['car', 'Машина, цена продажи (если есть)'], ['loan', 'Кредит, остаток (если есть)']].map(([k, n]) => `<label class="fld"><span>${n}, ₸</span><input inputmode="numeric" data-ob="${k}" value="${fmtIn(OB[k])}"></label>`).join('')}`,
      `<h1 class="ob-t">Твой путь</h1><p class="lead">Даты из плана. Если что-то сдвинется, поменяешь в настройках.</p>
       <label class="fld"><span>Права</span><input type="date" data-f="license" value="${g.license}"></label>
       <label class="fld"><span>Первая смена</span><input type="date" data-f="taxiFrom" value="${g.taxiFrom}"></label>
       <label class="fld"><span>Своя машина с</span><input type="date" data-f="carFrom" value="${g.carFrom}"></label>
       <label class="fld"><span>Цена машины, ₸</span><input inputmode="numeric" data-f="price" data-t="money" value="${fmtIn(g.price)}"></label>`,
    ];
    return `<section class="onb"><div class="ob-dots">${steps.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div>${steps[st]}
      <div class="btns">${st > 0 ? '<button class="btn alt" data-a="ob-back">Назад</button>' : ''}<button class="btn" data-a="ob-next">${st < steps.length - 1 ? 'Дальше' : 'Поехали'}</button></div></section>`;
  }

  // ---------------------------------------------------------------- листы снизу (кнопка назад на Android закрывает лист)
  let sheetOpen = false, ignorePop = 0;
  function sheet(html) {
    const root = $('#sheet');
    root.innerHTML = `<div class="sh-bg" data-a="sheet-close"></div><div class="sh" role="dialog" aria-modal="true"><div class="sh-grip"></div>${html}</div>`;
    root.hidden = false; requestAnimationFrame(() => root.classList.add('open'));
    if (!sheetOpen) { try { history.pushState({ put: 'sheet' }, ''); } catch (e) { /* ок */ } }
    sheetOpen = true;
    const f = root.querySelector('input[autofocus]'); if (f) setTimeout(() => f.focus(), 260);
  }
  function closeSheet(fromPop) {
    if (!sheetOpen) return;
    sheetOpen = false;
    const root = $('#sheet'); root.classList.remove('open');
    setTimeout(() => { if (!sheetOpen) { root.hidden = true; root.innerHTML = ''; } }, 220);
    if (!fromPop && history.state && history.state.put === 'sheet') { ignorePop++; history.back(); }
  }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    if (sheetOpen) closeSheet(true);
    else if (UI.sub) { UI.sub = null; render(); }
  });
  function logSheet(d) {
    const st = S(), x = st.shifts[d] || {}, plan = C.planHours(st, d);
    sheet(`<div class="sh-t">${cap(C.DOWL[C.dow(d)])}, ${C.dateLong(d)}</div><div class="sh-s">По плану: ${plan > 0 ? 'смена ' + C.num1(plan) + ' ч' : 'выходной'}</div>
      <div class="quick">${[0, 4, 6, 8, 10, 12, 13, 14, 15, 16].map(h => `<button class="q${x.h != null && +x.h === h ? ' sel' : ''}${h === plan && plan > 0 ? ' plan' : ''}" data-a="pick-h" data-d="${d}" data-h="${h}">${h}<small>ч</small></button>`).join('')}</div>
      <label class="fld"><span>Часов</span><input inputmode="decimal" id="f-h" value="${x.h != null ? C.num1(x.h) : ''}" placeholder="${plan || 0}"></label>
      <label class="fld"><span>В приложении за день, ₸ <span class="dim">(+${G.XP.app} XP)</span></span><input inputmode="numeric" id="f-app" value="${fmtIn(x.app)}" placeholder="крупная цифра в Яндекс Про"></label>
      <div class="preview" id="f-pv"></div>
      <div class="btns"><button class="btn" data-a="save-log" data-d="${d}">${ic('check')}Сохранить</button></div>
      ${st.shifts[d] ? `<button class="btn danger" data-a="del-log" data-d="${d}">${ic('trash')}Удалить запись</button>` : ''}`);
    sheetPreview(d);
  }
  function sheetPreview(d) {
    const el = $('#f-pv'); if (!el) return;
    const raw = $('#f-h').value.trim(), st = S();
    if (raw === '') { el.innerHTML = ''; return; }
    const h = Math.max(0, Math.min(24, parseNum(raw))), app = parseNum($('#f-app').value);
    el.innerHTML = praiseBox(praiseOf(st, d, C.forecast(st, TODAY), { h, app }), G.shiftXp(st, d, h, app)) + capWarn(h);
  }
  function moneySheet(add) {
    const st = S(), np = nowParts(st, C.estimate(st, TODAY)), r1k = v => Math.round(v / 1000) * 1000;
    const last = { cash: r1k(np.cash), otb: np.otb, car: np.car, loan: np.loan };
    if (add) {
      sheet(`<div class="sh-t">Отложил</div><div class="sh-s">+1 XP за каждые 1 000 ₸</div><label class="fld"><span>Сколько, ₸</span><input inputmode="numeric" id="f-amt" autofocus></label>
        <div class="fld"><span>Куда</span><div class="segm" id="f-to"><button data-a="pick-to" data-v="cash" aria-pressed="true">Деньги</button><button data-a="pick-to" data-v="otb" aria-pressed="false">Отбасы</button></div></div>
        <label class="fld"><span>Заметка</span><input id="f-note" placeholder="необязательно"></label>
        <div class="btns"><button class="btn" data-a="save-add">${ic('check')}Сохранить</button></div>`);
      return;
    }
    sheet(`<div class="sh-t">Сколько сейчас</div><div class="sh-s">Активы = деньги + Отбасы + машина − кредит</div>
      ${[['cash', 'Деньги: карты, наличные, вклады'], ['otb', 'Отбасы'], ['car', 'Машина, цена продажи'], ['loan', 'Кредит, остаток']].map(([k, n]) => `<label class="fld"><span>${n}, ₸</span><input inputmode="numeric" id="f-${k}" value="${fmtIn(last[k])}"></label>`).join('')}
      <label class="fld"><span>Дата</span><input type="date" id="f-d" value="${TODAY}" max="${TODAY}"></label>
      <div class="btns"><button class="btn" data-a="save-money">${ic('check')}Сохранить</button></div>`);
  }
  function tplSheet(i) {
    const cur = +(S().set.tpl[i] || 0);
    sheet(`<div class="sh-t">Обычно в ${C.DOWL[i]}</div><div class="quick">${[0, 6, 8, 10, 12].map(h => `<button class="q${cur === h ? ' sel' : ''}${h ? '' : ' wide'}" data-a="set-tpl" data-i="${i}" data-h="${h}">${h ? h + '<small>ч</small>' : 'вых'}</button>`).join('')}</div>`);
  }
  function questSheet() {
    sheet(`<div class="sh-t">Своё задание</div><div class="sh-s">За выполненное +${G.XP.own} XP</div>
      <label class="fld"><span>Что сделать</span><input id="f-qt" maxlength="80" placeholder="например, узнать цены аренды в 3 парках" autofocus></label>
      <label class="fld"><span>До какого числа</span><input type="date" id="f-qd" value="${C.isoAdd(TODAY, 7)}"></label>
      <div class="btns"><button class="btn" data-a="quest-save">${ic('plus')}Добавить</button></div>`);
  }
  function badgeSheet(id) {
    const b = G.player(S(), TODAY, null).badges.find(x => x.id === id); if (!b) return;
    sheet(`<div style="display:flex;flex-direction:column;align-items:center;text-align:center">${D.medal(b.icon, b.color, !b.on, 92)}
      <div class="sh-t" style="margin-top:12px">${esc(b.title)}</div><div class="sh-s">${b.on ? 'Получено ' + C.dateLong(b.on) : esc(b.hint)}</div>
      <div style="margin-top:12px">${xpChip(b.xp, !!b.on)}</div></div>
      <div class="btns"><button class="btn alt" data-a="sheet-close">Понятно</button></div>`);
  }

  // ---------------------------------------------------------------- тосты, опыт, праздник
  let toastT = null;
  function toast(text, tone) {
    const t = $('#toast'); t.className = 'toast ' + (tone || ''); t.textContent = text; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('on'); setTimeout(() => { t.hidden = true; }, 260); }, 3600);
  }
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* нет вибро */ } };
  const xpNow = () => G.player(S(), TODAY, null).xp;
  function popXp(n) {
    if (!(n > 0)) return;
    const el = document.createElement('div'); el.className = 'xp-pop'; el.innerHTML = ic('star') + '+' + C.grp(n) + ' XP';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
  }
  // новый уровень и новые награды показываем по одному и один раз
  const fxQueue = [];
  function celebrate() {
    const st = S(); if (!st || !st.money.length) return;
    const pl = G.player(st, TODAY, null), got = pl.badges.filter(b => b.on).map(b => b.id);
    if (!st.seen || !Array.isArray(st.seen.badges)) { Store.update(s => { s.seen = { level: pl.level, badges: got }; }, 'seen'); return; }
    const newB = got.filter(id => st.seen.badges.indexOf(id) < 0);
    if (pl.level > st.seen.level) {
      const was = G.rankOf(st.seen.level).title, skin = G.SKINS.filter(s => s.level > st.seen.level && s.level <= pl.level).pop();
      fxQueue.push({ kind: 'level', level: pl.level, rank: pl.rank.title, newRank: was !== pl.rank.title, skin });
    }
    newB.forEach(id => fxQueue.push({ kind: 'badge', b: pl.badges.find(x => x.id === id) }));
    if (pl.level !== st.seen.level || got.length !== st.seen.badges.length || newB.length) Store.update(s => { s.seen = { level: pl.level, badges: got }; }, 'seen');
    if ($('#fx').hidden) nextFx();
  }
  function nextFx() {
    const root = $('#fx'), f = fxQueue.shift();
    if (!f) { root.innerHTML = ''; root.hidden = true; return; }
    let art, k, t, s;
    if (f.kind === 'level') {
      art = D.hex(f.level, 120); k = 'Новый уровень'; t = 'Уровень ' + f.level;
      s = (f.newRank ? 'Новое звание: <b>' + esc(f.rank) + '</b>.' : esc(f.rank) + '. Так держать.') + (f.skin ? ' В гараже открыта ' + esc(f.skin.name.toLowerCase()) + ' машина.' : '');
    } else if (f.kind === 'welcome') {
      art = D.hex(1, 120); k = 'Путь построен'; t = 'Уровень 1: Пешеход'; s = 'Впереди права, первая смена и своя машина. Каждая смена, каждые отложенные деньги и каждая веха дают опыт.';
    } else {
      art = D.medal(f.b.icon, f.b.color, false, 120); k = 'Новая награда'; t = esc(f.b.title); s = esc(f.b.hint) + '. +' + C.grp(f.b.xp) + ' XP.';
    }
    root.innerHTML = `<div class="fx-b" role="dialog" aria-modal="true"><div class="fx-art">${art}${D.sparks(18)}</div><div class="fx-k">${k}</div><div class="fx-t">${t}</div><div class="fx-s">${s}</div>
      <button class="btn" data-a="fx-next">${fxQueue.length ? 'Дальше' : 'Поехали'}</button></div>`;
    root.hidden = false; buzz([20, 60, 20, 60, 40]);
  }

  // ---------------------------------------------------------------- действия
  function logShift(d, h, app) {
    const before = xpNow();
    Store.update(s => { const x = s.shifts[d] || {}; x.h = h; if (app != null) x.app = app; s.shifts[d] = x; }, 'log');
    const st = S(), p = praiseOf(st, d, C.forecast(st, TODAY));
    if (p) toast(p.title + '. ' + p.text, p.tone === 'warn' ? 'warn' : 'good');
    popXp(xpNow() - before);
    buzz(p && p.tone === 'good' ? [12, 40, 12] : 10);
    celebrate();
  }
  function act(a, el) {
    const d = el.dataset.d;
    switch (a) {
      case 'tab': UI.tab = el.dataset.tab; UI.week = 0; UI.sel = null; UI.dh = null; UI.sub = null; try { sessionStorage.setItem('put.tab', UI.tab); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
      case 'week': UI.week += +el.dataset.v; UI.sel = null; UI.dh = null; render(); break;
      case 'day': if (UI.sel !== d) { UI.sel = d; UI.dh = null; UI.dapp = ''; render(); } break;
      case 'dh': UI.dh = +el.dataset.h; UI.dapp = ($('#p-app') || {}).value || UI.dapp; render(); break;
      case 'dh-own': UI.dapp = ($('#p-app') || {}).value || UI.dapp; $('#own-h').hidden = false; $('#p-h').focus(); break;
      case 'save-day': {
        if (UI.dh == null) break;
        const app = parseNum(($('#p-app') || {}).value || UI.dapp), h = UI.dh;
        UI.dh = null; UI.dapp = '';
        logShift(d, Math.max(0, Math.min(24, h)), app > 0 ? app : 0); break;
      }
      case 'quick': logShift(d, +el.dataset.h, null); break;
      case 'log': logSheet(d); break;
      case 'pick-h': $('#f-h').value = el.dataset.h; document.querySelectorAll('#sheet .q').forEach(b => b.classList.toggle('sel', b === el)); sheetPreview(d); break;
      case 'save-log': {
        const hRaw = $('#f-h').value.trim(), h = hRaw === '' ? C.planHours(S(), d) : parseNum(hRaw), app = parseNum($('#f-app').value);
        closeSheet(); UI.dh = null; logShift(d, Math.max(0, Math.min(24, h)), app > 0 ? app : 0); break;
      }
      case 'del-log': Store.update(s => { delete s.shifts[d]; }, 'log'); UI.dh = null; UI.dapp = ''; closeSheet(); toast('Запись удалена'); break;
      case 'set-plan': Store.update(s => { s.over[d] = +el.dataset.h; }, 'plan'); toast(+el.dataset.h ? `План на ${C.dateShort(d)}: ${el.dataset.h} ч` : `${C.dateShort(d)}: выходной`); break;
      case 'clear-plan': Store.update(s => { delete s.over[d]; }, 'plan'); break;
      case 'tpl': tplSheet(+el.dataset.i); break;
      case 'set-tpl': Store.update(s => { s.set.tpl[+el.dataset.i] = +el.dataset.h; }, 'tpl'); closeSheet(); break;
      case 'money-add': moneySheet(true); break;
      case 'money-edit': moneySheet(false); break;
      case 'pick-to': document.querySelectorAll('#f-to button').forEach(b => b.setAttribute('aria-pressed', String(b === el))); break;
      case 'save-add': {
        const amt = parseNum($('#f-amt').value); if (!(amt > 0)) { closeSheet(); break; }
        const to = (document.querySelector('#f-to [aria-pressed="true"]') || {}).dataset.v || 'cash', note = $('#f-note').value.trim(), before = xpNow();
        Store.update(s => {
          s.money.push({ d: TODAY, kind: 'add', add: amt, to, note, t: Date.now() }); s.money.sort(C.byDate);
          if (!s.base) s.base = C.makeBase(s, TODAY);
        }, 'money');
        closeSheet(); const dd = C.daysFor(C.forecast(S(), TODAY), amt);
        toast(`${C.money(amt, true)} в копилку.${dd && dd >= 0.05 ? ' Цель ближе на ' + C.daysText(dd) + '.' : ''}`, 'good');
        popXp(xpNow() - before); buzz([12, 40, 12]); celebrate(); break;
      }
      case 'save-money': {
        const v = k => parseNum($('#f-' + k).value), raw = $('#f-d').value || TODAY, day = raw > TODAY ? TODAY : raw, before = xpNow();
        Store.update(s => {
          const prev = s.money.find(x => x.d === day && !C.isAdd(x)), n = { d: day, cash: v('cash'), otb: v('otb'), car: v('car'), loan: v('loan'), t: Date.now() };
          if (prev && prev.note) n.note = prev.note;
          s.money = s.money.filter(x => x !== prev); s.money.push(n); s.money.sort(C.byDate);
          if (!s.base) s.base = C.makeBase(s, day);
        }, 'money');
        closeSheet(); toast('Сохранено. Активы: ' + C.money((C.estimate(S(), TODAY) || { na: 0 }).na)); popXp(xpNow() - before); celebrate(); break;
      }
      case 'done': {
        const id = el.dataset.id, before = xpNow();
        Store.update(s => { if (s.done[id]) delete s.done[id]; else s.done[id] = TODAY; }, 'done');
        if (S().done[id]) { toast('Веха пройдена. Дальше по пути.', 'good'); popXp(xpNow() - before); buzz([12, 40, 12]); celebrate(); }
        break;
      }
      case 'own-done': {
        const id = el.dataset.id, before = xpNow();
        Store.update(s => { const q = s.quests.find(x => x.id === id); if (q) q.done = q.done ? null : TODAY; }, 'done');
        const q = S().quests.find(x => x.id === id);
        if (q && q.done) { toast('Задание сделано.', 'good'); popXp(xpNow() - before); celebrate(); }
        break;
      }
      case 'quest-new': questSheet(); break;
      case 'quest-save': {
        const t = $('#f-qt').value.trim(), qd = $('#f-qd').value;
        if (!t) { $('#f-qt').focus(); break; }
        Store.update(s => { s.quests.push({ id: 'q' + Date.now().toString(36), title: t.slice(0, 80), date: qd || '' }); }, 'quest');
        closeSheet(); toast('Задание добавлено'); break;
      }
      case 'quest-del': if (confirm('Удалить задание?')) Store.update(s => { s.quests = s.quests.filter(x => x.id !== el.dataset.id); }, 'quest'); break;
      case 'all-done': UI.allDone = true; render(); break;
      case 'badge': badgeSheet(el.dataset.id); break;
      case 'skin': {
        const sk = G.SKINS.find(x => x.id === el.dataset.id), L = G.player(S(), TODAY, null).level;
        if (sk && sk.level <= L) Store.update(s => { s.set.skin = sk.id; }, 'set');
        else if (sk) toast(`${sk.name} машина откроется с ${sk.level} уровня`);
        break;
      }
      case 'fx-next': nextFx(); break;
      case 'sub': UI.sub = el.dataset.v; try { history.pushState({ put: 'sub' }, ''); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
      case 'sub-back': if (history.state && history.state.put === 'sub') history.back(); else { UI.sub = null; render(); } break;
      case 'fuel': Store.update(s => { s.set.fuel = el.dataset.v; }, 'set'); break;
      case 'rebase': Store.update(s => { s.base = C.makeBase(s, TODAY); }, 'rebase'); toast('План пересчитан от сегодня'); break;
      case 'signin': Store.signIn(); break;
      case 'signout': Store.signOut(); break;
      case 'export': Store.exportFile(); break;
      case 'reset': if (confirm('Стереть все данные на этом телефоне? Если входил через Google, копия в облаке останется: войдёшь снова, и всё вернётся.')) Store.wipe().then(() => location.reload()); break;
      case 'sheet-close': closeSheet(); break;
      case 'ob-back': readOb(); UI.onb = Math.max(0, UI.onb - 1); render(); break;
      case 'ob-next': {
        readFields(document); readOb();
        if (UI.onb < 2) { UI.onb++; render(); window.scrollTo(0, 0); break; }
        Store.update(s => { s.money = [{ d: TODAY, cash: OB.cash || 0, otb: OB.otb || 0, car: OB.car || 0, loan: OB.loan || 0, note: 'старт', t: Date.now() }]; s.base = C.makeBase(s, TODAY); s.created = TODAY; s.seen = { level: 1, badges: [] }; }, 'start');
        UI.tab = 'home'; render(); window.scrollTo(0, 0); fxQueue.push({ kind: 'welcome' }); celebrate(); break;
      }
      default: break;
    }
  }
  function readOb() { document.querySelectorAll('[data-ob]').forEach(i => { OB[i.dataset.ob] = parseNum(i.value); }); }
  // поля настроек сохраняются без перерисовки экрана, чтобы не сбивать ввод в соседнем поле
  function readFields(root) {
    const fs = root.querySelectorAll('[data-f]');
    if (!fs.length) return;
    Store.update(s => fs.forEach(i => {
      const k = i.dataset.f;
      if (i.type === 'checkbox') s.set[k] = i.checked;
      else if (i.type === 'date') s.set[k] = i.value || (k === 'carFrom' || k === 'gasFrom' ? '' : s.set[k]);
      else { const n = parseNum(i.value); if (n || n === 0) s.set[k] = n; }
    }), 'field');
  }
  // личная ссылка: #s=<base64url JSON> подставляет настройки и задания до первого запуска и стирается из адреса
  function applySetup() {
    const mm = /[#&]s=([\w-]+)/.exec(location.hash);
    if (!mm) return;
    try {
      const b = atob(mm[1].replace(/-/g, '+').replace(/_/g, '/'));
      const over = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
      if (!S().money.length) Store.update(s => {
        for (const [k, v] of Object.entries(over)) if (k in C.DEF && !Array.isArray(C.DEF[k]) && typeof v === typeof C.DEF[k]) s.set[k] = v;
        if (Array.isArray(over.quests) && !s.quests.length) s.quests = over.quests.slice(0, 20).filter(q => q && q.title).map((q, i) => ({ id: 'q0' + i, title: String(q.title).slice(0, 80), date: /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : '' }));
      }, 'setup');
    } catch (e) { /* битая ссылка: настройки как есть */ }
    const h = location.hash.replace(/[#&]s=[\w-]+/, '').replace(/^&/, '#');
    history.replaceState(null, '', location.pathname + location.search + h);
  }

  // ---------------------------------------------------------------- отрисовка
  function render() {
    const st = S(), onb = !st || !st.money.length;
    document.body.classList.toggle('onboarding', onb);
    $('#tabbar').innerHTML = onb ? '' : `<div class="tabs">${TABS.map(([k, n, i]) => `<button class="tb${UI.tab === k ? ' on' : ''}" data-a="tab" data-tab="${k}" aria-current="${UI.tab === k ? 'page' : 'false'}"><span class="ti">${ic(i)}</span>${n}</button>`).join('')}</div>`;
    const view = onb ? vOnboard : { home: vHome, shifts: vShifts, money: vMoney, path: vPath, me: vMe }[UI.tab] || vHome;
    $('#view').innerHTML = view();
    $('#view').className = onb ? '' : 'view';
  }

  document.body.insertAdjacentHTML('afterbegin', D.sprite());
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el || el.tagName === 'INPUT' || el.disabled) return;
    e.preventDefault();
    act(el.dataset.a, el);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.a === 'import' && el.files && el.files[0]) {
      el.files[0].text().then(t => { try { Store.importText(t); toast('Копия загружена', 'good'); } catch (err) { toast('Не получилось: ' + err.message, 'warn'); } });
      return;
    }
    if (el.dataset && el.dataset.f && !document.body.classList.contains('onboarding')) { readFields(el.closest('.fld') || el.parentElement); toast('Сохранено'); }
  });
  document.addEventListener('focusin', e => { const el = e.target; if (el.tagName === 'INPUT' && el.inputMode === 'numeric' && el.value) el.select(); });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.tagName === 'INPUT' && (el.inputMode === 'numeric' || el.dataset.t === 'money')) {
      const pos = el.value.length - el.selectionStart, raw = el.value.replace(/[^\d]/g, '');
      el.value = raw ? C.grp(+raw) : ''; const p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p);
    }
    if (el.id === 'f-h' || el.id === 'f-app') { const b = document.querySelector('#sheet [data-a="save-log"]'); if (b) sheetPreview(b.dataset.d); }
    if (el.id === 'p-h' || el.id === 'p-app') {
      if (el.id === 'p-h') { const v = el.value.trim(); UI.dh = v === '' ? null : Math.max(0, Math.min(24, parseNum(v))); } else UI.dapp = el.value;
      const pv = $('#pv'), st = S(); if (pv) pv.innerHTML = previewHtml(st, UI.sel, C.forecast(st, TODAY));
      const sb = document.querySelector('[data-a="save-day"]'); if (sb) { sb.disabled = UI.dh == null; sb.style.opacity = UI.dh == null ? '.5' : ''; }
    }
  });

  Store.onChange(why => {
    if (why === 'field' || why === 'seen') return;
    const a = document.activeElement;
    if (why === 'cloud' && a && a.tagName === 'INPUT') return; // не сбивать ввод из-за статуса облака
    render();
    if (why === 'cloud' || why === 'import') celebrate();
  });
  Store.boot();
  if (!Store.get()) Store.replace(C.newState(), 'new');
  applySetup();
  render();
  celebrate();
  // новый день: пересчитать, когда приложение снова открыли
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && C.today() !== TODAY) { UI.sel = null; UI.dh = null; render(); celebrate(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
