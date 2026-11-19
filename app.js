/* Путь к квартире: интерфейс. Главная, Смены, Деньги, Путь, Профиль. Без фреймворков. */
(() => {
  'use strict';
  const C = Core, G = Game, D = Draw, $ = s => document.querySelector(s), ic = D.ic;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const UI = { tab: 'home', week: 0, sel: null, dh: null, dapp: '', dord: '', sub: null, onb: 0, allDone: false };
  try { const t = sessionStorage.getItem('put.tab'); if (t) UI.tab = t; } catch (e) { /* нет доступа */ }
  const TABS = [['home', 'Главная', 'gauge'], ['shifts', 'Смены', 'cal'], ['money', 'Деньги', 'wallet'], ['path', 'Путь', 'route'], ['me', 'Профиль', 'user']];
  // число из поля: пусто = null (не путать с нулём), понимает минус, пробелы и запятую
  const parseNum = v => { const t = String(v == null ? '' : v).replace(/[\s  ₸]/g, '').replace('−', '-').replace(',', '.'); if (t === '' || t === '-') return null; const n = Number(t); return isFinite(n) ? n : null; };
  const num0 = v => parseNum(v) || 0;
  const fmtIn = n => n ? (n < 0 ? '−' : '') + C.grp(n) : '';
  const S = () => Store.get();
  const days = n => n + ' ' + C.plural(n, ['день', 'дня', 'дней']);
  const hrs = n => C.num1(n) + ' ' + (Number.isInteger(Math.round(n * 10) / 10) ? C.plural(n, ['час', 'часа', 'часов']) : 'часа');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // числа, единицы и диапазоны в тексте не рвутся на строки: 150 000 ₸, 12 ч, 07-10
  const nb = s => String(s).replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) (₸|%|ч(?![а-яё])|км|л(?![а-яё]))/g, '$1\u00a0$2').replace(/(\d)-(\d)/g, '$1\u2011$2');
  const moneyHtml = n => C.money(n).replace(/\s₸$/, '') + '<span class="cur"> ₸</span>';
  const mlnShort = n => (Math.round(n / 1e4) / 100).toString().replace('.', ',') + ' млн ₸';
  // до десятой: для прикидок, где сотые были бы ложной точностью
  const mln1 = n => (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' млн ₸';
  const xpChip = (x, done) => `<span class="xpc${done ? ' done' : ''}">${ic('star')}+${C.grp(x)} XP</span>`;
  const DOW_IN = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  // настоящая дата (не 2027-13-01) в разумных годах
  const validDate = v => { try { return typeof v === 'string' && ISO.test(v) && v >= '2000-01-01' && v <= '2100-12-31' && C.isoAdd(v, 0) === v; } catch (e) { return false; } };
  // даты, которые можно оставить пустыми
  const OPT_DATES = ['carFrom', 'gasFrom', 'preFrom', 'preOnceDate'];
  // опыт за действия с учётом навыков (для подписей)
  const XPN = () => G.xpOf(S(), TODAY);
  let TODAY = C.today();
  const refresh = () => { TODAY = C.today(); };
  // игрок считается из всех записей: один раз на версию данных и день (иначе каждое нажатие пересчитывает всё по 4 раза)
  let plMemo = null;
  const playerOf = (st, iso) => {
    const k = (st.updated || 0) + '|' + iso + '|' + st.money.length + '|' + Object.keys(st.shifts).length;
    if (plMemo && plMemo.st === st && plMemo.k === k) return plMemo.v;
    const v = G.player(st, iso, null); plMemo = { st, k, v }; return v;
  };

  // ---------------------------------------------------------------- общие расчёты экрана
  function model() {
    const st = S(); refresh();
    const est = C.estimate(st, TODAY), na = est ? est.na : 0;
    const need = C.needExtra(st, TODAY), fc = need.fc, vs = C.versusPlan(st, TODAY, na);
    const target = st.set.target > 0 ? st.set.target : 1, pct = Math.max(0, Math.min(1, na / target));
    const pl = playerOf(st, TODAY), rw = C.runway(st, fc, TODAY);
    return { st, est, na, fc, need, vs, target, pct, pl, rw, pre: !st.set.taxiFrom || TODAY < st.set.taxiFrom, left: Math.max(0, target - na), daysLeft: C.isoDiff(TODAY, st.set.deadline) };
  }
  // впереди или отстаёшь от плана: {tone, icon, text}
  function status(m) {
    const v = m.vs;
    if (!v) return null;
    if (!m.fc.goal && m.na < m.target) return { tone: 'coral', icon: 'down', text: 'План не доходит до цели' };
    if (v.days == null || Math.abs(v.days) >= 365) {
      if (Math.abs(v.diff) < 5000) return { tone: 'plain', icon: 'check', text: 'Идёшь по плану' };
      return v.diff > 0 ? { tone: 'green', icon: 'up', text: 'Впереди плана на ' + C.money(v.diff) } : { tone: 'coral', icon: 'down', text: 'Отстаёшь от плана на ' + C.money(-v.diff) };
    }
    if (Math.abs(v.days) < 1) return { tone: 'plain', icon: 'check', text: 'Идёшь точно по плану' };
    return v.days > 0 ? { tone: 'green', icon: 'up', text: 'Впереди плана на ' + days(v.days) } : { tone: 'coral', icon: 'down', text: 'Отстаёшь от плана на ' + days(-v.days) };
  }
  // отзыв о дне: {tone, icon, title, text}
  function praiseOf(st, d, fc, shift) {
    const tmp = shift ? Object.assign({}, st, { shifts: Object.assign({}, st.shifts, { [d]: shift }) }) : st;
    const s = C.shiftDay(tmp, d, fc);
    if (s.fact == null) return null;
    // лёгкий день (лёгкая неделя, короче после плохого сна): сверх плана считаем от обычного плана, переработку не хвалим
    const bp = Math.max(s.plan, G.basePlan(st, d)), soft = bp > s.plan, over = s.fact - bp;
    const dd = Math.abs(s.days) >= 0.05 ? C.daysText(Math.abs(s.days)) : null;
    if (s.plan > 0 && s.fact === 0) return { tone: 'warn', icon: 'moon', title: 'Пропуск смены', text: (dd ? 'Цель дальше на ' + dd + '.' : 'Отдых тоже часть пути.') + (playerOf(st, TODAY).chance ? ' Серию можно вернуть за 3 смены.' : '') };
    if (bp === 0 && s.fact > 0) return { tone: 'good', icon: 'bolt', title: 'Выходной в работу', text: C.money(s.money, true) + ' к цели' + (dd ? ', ближе на ' + dd : '') + '.' };
    if (s.fact === 0) return { tone: 'ok', icon: 'moon', title: 'Выходной', text: 'Отдых по плану.' };
    if (over > 0) return { tone: 'good', icon: 'bolt', title: s.fact > 12 ? 'Длинная смена' : 'Хорошая смена', text: '+' + C.num1(over) + ' ч сверх плана' + (dd && !soft ? ': цель ближе на ' + dd : '') + '.' + (s.fact > 12 ? ' Поспи подольше, энергия просела.' : '') };
    if (s.delta < 0) return { tone: 'warn', icon: 'clock', title: 'Меньше плана', text: C.num1(s.delta).replace('-', '−') + ' ч' + (dd ? ': цель дальше на ' + dd : '') + '.' };
    return { tone: 'ok', icon: 'check', title: 'Смена по плану', text: soft && s.fact > s.plan ? 'Обычный план закрыт, хотя день был лёгким. Береги силы.' : 'План дня закрыт.' };
  }
  // мало спал: только в такси и только меньше 6 часов, с одной кнопкой (риски по AAA Foundation, Tefft 2016)
  function tiredPlate(st, plan) {
    const sl = st.sleep && st.sleep[TODAY];
    if ((sl !== '<5' && sl !== '5-6') || C.phaseAt(st, TODAY) === 'pre' || st.shifts[TODAY]) return '';
    const cut = st.over && st.over[TODAY] != null && st.over[TODAY] < C.planHours(st, TODAY, true);
    return `<div class="tired">${ic('moon')}<div><b>Спал меньше ${sl === '<5' ? '5' : '6'} часов</b><span>Риск аварии примерно в ${sl === '<5' ? '4' : '2'} раза выше, чем после 7 часов сна.${cut ? ' План уже короче, береги себя.' : ''}</span>
      ${!cut && plan > 2 ? `<button class="btn alt sm" data-a="shorter">Сегодня на 2 ч короче</button>` : ''}
      <div class="tired-l">${sl === '<5' ? `<button class="link go" data-a="bad-day">Взять выходной</button>` : ''}<button class="link" data-a="inst" data-v="energy">Изменить сон</button></div></div></div>`;
  }
  // отдых между сменами по таймеру: предыдущий конец и это начало
  function restWindow(st, L) {
    let e = 0; for (const [d, x] of Object.entries(st.shifts)) if (d <= L.d && x && x.e && x.e < L.start && x.e > e) e = x.e;
    const min = e ? (L.start - e) / 60000 : null;
    return min != null && min < 11 * 60 ? `<div class="sub rest-w">Отдых между сменами ${hm(min)}: меньше 11 часов, сегодня береги силы.</div>` : '';
  }
  // маленький штамп смены: нажал, и открылся чек
  function stampMini(st, d) {
    const x = st.shifts[d], gr = x && x.h > 0 ? C.gradeOf(st, d, +x.h, +x.app || 0) : null;
    return gr ? `<span class="stamp-mini ${({ 'S+': 'gold', S: 'violet', A: 'green', B: 'blue', C: 'gray' })[gr.g]}">${gr.g}</span>` : '';
  }
  function praiseBox(p, xp, stamp) {
    if (!p) return '';
    const cls = p.tone === 'good' ? '' : p.tone === 'warn' ? ' warn' : ' green';
    return `<div class="praise${cls}"><div class="praise-i">${ic(p.icon)}</div><div class="praise-b"><div class="praise-t">${esc(p.title)}</div><div class="praise-s">${esc(p.text)}</div></div>${stamp || ''}${xp ? xpChip(xp) : ''}</div>`;
  }
  const dateHead = iso => cap(C.DOWL[C.dow(iso)]) + ', ' + C.dateShort(iso);
  function streakPill(pl) {
    const n = pl.streak, ch = pl.chance, st = S();
    if (!(n > 0) && !ch) return '';
    const lv = pl.combo >= 1.4 ? 3 : pl.combo >= 1.2 ? 2 : 1, rest = !st.shifts[TODAY] && (C.planHours(st, TODAY) === 0 || !!(st.bad && st.bad[TODAY]));
    return `<button class="streak fl${lv}${rest ? ' rest' : ''}${UI.crack ? ' crack' : ''}" data-a="tab" data-tab="me" aria-label="Смен подряд: ${n}${pl.freezes ? ', заморозки серии: ' + pl.freezes : ''}">
      <span class="fl">${ic('flame')}${lv === 3 && !rest ? '<i></i><i></i><i></i>' : ''}</span><b class="sn">${n}</b>${ch ? `<span class="was">${ch.L}</span>` : ''}${pl.freezes ? `<span class="frz">${ic('snow')}${pl.freezes}</span>` : ''}</button>`;
  }
  function playerStrip(pl, why) {
    return `<button class="player" data-a="tab" data-tab="me">${D.hex(pl.level, 40)}
      <div class="player-b"><div class="player-t"><b>${esc(pl.rank.title)}</b><span>${pl.todayXp ? '+' + C.grp(pl.todayXp) + ' XP сегодня' : 'уровень ' + pl.level}</span></div>
      <div class="xpbar"><i style="width:${(pl.pct * 100).toFixed(1)}%"></i></div>
      <div class="player-s">${C.grp(pl.into)} из ${C.grp(pl.need)} XP до ${pl.level + 1} уровня${pl.combo > 1.001 ? ` · комбо ×${C.num1(pl.combo)}` : ''}</div></div></button>
      ${why ? `<div class="why">${ic('heart')}<span>${esc(why)}</span></div>` : ''}`;
  }

  // ---------------------------------------------------------------- главная
  function vHome() {
    const m = model(), st = m.st, pl = m.pl, s = status(m);
    // первое открытие за день: анимация только на первой отрисовке, прибавка видна 6 секунд
    if (!UI.ign) { const ig = UI.ign = ignition(m.na); setTimeout(() => { ig.first = false; }, 60); setTimeout(() => { ig.delta = 0; }, 6000); }
    const working = st.set.preFrom && TODAY >= st.set.preFrom || !m.pre;
    const yest = C.isoAdd(TODAY, -1), yx = st.shifts[yest], yp = working && yx ? praiseOf(st, yest, m.fc) : null;
    return `
    <header class="top"><div><div class="top-k">${dateHead(TODAY)}</div><h1 class="top-t">Путь к квартире</h1></div><div class="top-r">${streakPill(pl)}</div></header>
    ${playerStrip(pl, pl.energy < 40 || m.pre ? st.set.why : '')}
    <section class="gauge-wrap${UI.ign && UI.ign.first ? ' ign' : ''}" aria-label="Активы ${C.money(m.na)} из ${C.money(m.target)}">
      <div class="gauge">${D.gauge(m.pct, m.target)}
        <div class="g-in"><div class="g-k">Активы</div><div class="g-v">${moneyHtml(m.na)}</div><div class="g-s">из ${C.money(m.target)}${m.daysLeft >= 0 ? ` · ${days(m.daysLeft)}` : ''}</div></div>
        <div class="g-pct g-left">${m.na >= m.target ? 'цель есть' : 'ещё ' + mlnShort(m.left)}</div></div>
      ${UI.ign && UI.ign.delta ? `<div class="g-delta">${ic('up')}${C.money(UI.ign.delta, true)} с прошлого раза</div>` : ''}
      ${s ? `<div class="status"><span class="chip ${s.tone}">${ic(s.icon)}${esc(s.text)}</span></div>` : ''}
      ${instruments(m, working)}
    </section>
    ${attention(m, working)}
    ${todayCard(m, working)}
    ${checkin(m, working)}
    ${recapCard(m)}
    ${yp && !st.shifts[TODAY] ? `<button class="card tap block" data-a="${yx.h > 0 ? 'receipt' : 'log'}" data-d="${yest}"><div class="between"><div class="over">Вчера, ${C.num1(yx.h)} ч</div>${stampMini(st, yest)}</div>${praiseBox(yp)}</button>` : ''}
    ${m.pre ? runwayCard(m) : ''}
    ${tilesCard(m)}
    ${forecastCard(m)}
    ${installCard(st)}
    ${questsPreview(m)}
    ${nearBadges(pl)}
    ${notes(m)}`;
  }
  // ---------------------------------------------------------------- итоги недели и месяца
  function periodStats(st, from, to) {
    let h = 0, sh = 0, app = 0, appH = 0, best = null;
    for (let d = from; d <= to; d = C.isoAdd(d, 1)) {
      const x = st.shifts[d]; if (!x || !(x.h > 0)) continue;
      h += +x.h; sh++;
      if (x.app > 0) { app += +x.app; appH += +x.h; if (!best || +x.app > best.app) best = { d, app: +x.app }; }
    }
    let plan = 0; for (let d = from; d <= to; d = C.isoAdd(d, 1)) plan += C.planHours(st, d);
    return { h, sh, app, perH: appH ? app / appH : null, best, plan };
  }
  // какие итоги показать: месяц в первые 3 дня следующего, неделя с воскресенья до вторника; закрытые не показываем
  function recapOf(st) {
    const seen = (st.seen && st.seen.recap) || [], dw = C.dow(TODAY), list = [];
    if (+TODAY.slice(8) <= 3) { const mk = C.mkAdd(C.mkOf(TODAY), -1); list.push({ key: 'm' + mk, kind: 'month', from: mk + '-01', to: mk + '-' + C.pad(C.dim(mk)), pFrom: C.mkAdd(mk, -1) + '-01', pTo: C.mkAdd(mk, -1) + '-' + C.pad(C.dim(C.mkAdd(mk, -1))) }); }
    if (dw === 6 || dw <= 1) { const mon = dw === 6 ? C.monday(TODAY) : C.isoAdd(C.monday(TODAY), -7); list.push({ key: 'w' + mon, kind: 'week', from: mon, to: C.isoAdd(mon, 6), pFrom: C.isoAdd(mon, -7), pTo: C.isoAdd(mon, -1) }); }
    for (const r of list) {
      if (seen.indexOf(r.key) >= 0) continue;
      const a = periodStats(st, r.from, r.to < TODAY ? r.to : TODAY); if (!a.sh) continue;
      return Object.assign(r, { a, b: periodStats(st, r.pFrom, r.pTo) });
    }
    return null;
  }
  // всё, что нужно и карточке, и картинке
  function recapData(m) {
    const st = m.st, r = recapOf(st); if (!r) return null;
    const end = r.to < TODAY ? r.to : TODAY, e0 = C.estimate(st, C.isoAdd(r.from, -1)), e1 = C.estimate(st, end);
    const na0 = e0 ? e0.na : null, na1 = e1 ? e1.na : m.na, pl = m.pl;
    const xp = pl.ledger.filter(e => e.d >= r.from && e.d <= end).reduce((x, e) => x + e.xp, 0);
    const badges = pl.badges.filter(b => b.on && b.on >= r.from && b.on <= end).map(b => b.title);
    const title = r.kind === 'month' ? 'Итоги месяца' : 'Итоги недели';
    const range = r.kind === 'month' ? cap(C.monthName(C.mkOf(r.from))) : `${+r.from.slice(8)}${r.from.slice(5, 7) !== r.to.slice(5, 7) ? ' ' + C.dateShort(r.from).split(' ')[1] : ''}-${C.dateShort(r.to)}`;
    // против себя в прошлом периоде: выручка за час и часы. Только если оба периода целиком одна работа (подработка или такси):
    // этапы идут по порядку, так что хватает первого дня прошлого периода и последнего дня этого
    const vs = [], kd = d => C.phaseAt(st, d) === 'pre' ? 'pre' : 'taxi', same = kd(r.pFrom) === kd(end);
    if (same && r.a.perH && r.b.perH) { const p = Math.round((r.a.perH / r.b.perH - 1) * 100); vs.push(p === 0 ? 'за час столько же' : `за час ${p > 0 ? '+' : '−'}${Math.abs(p)}%`); }
    if (same && r.b.sh) { const dh = Math.round(r.a.h - r.b.h); vs.push(dh === 0 ? 'часов столько же' : `часов ${dh > 0 ? '+' : '−'}${Math.abs(dh)}`); }
    return Object.assign(r, { na0, na1, delta: na0 != null ? na1 - na0 : null, xp, badges, title, range, vs, pct0: na0 != null ? Math.max(0, na0 / m.target) : null, pct1: Math.max(0, na1 / m.target), level: pl.level, rank: pl.rank.title });
  }
  function recapCard(m) {
    const R = recapData(m); if (!R) return '';
    const a = R.a, prevName = R.kind === 'month' ? 'прошлого месяца' : 'прошлой недели';
    return `<section class="card recap"><div class="between"><div><div class="over">${R.title}</div><div class="h3">${esc(R.range)}</div></div><button class="link" data-a="recap-share">${ic('share')}Поделиться</button></div>
      ${R.delta != null ? `<div class="recap-big"><b class="${R.delta >= 0 ? 'up' : 'down'}">${C.money(r1k(R.delta), true)}</b><span>к активам за ${R.kind === 'month' ? 'месяц' : 'неделю'}</span></div>
        <div class="pbar"><i style="width:${Math.max(0, Math.min(100, R.pct1 * 100)).toFixed(1)}%"></i></div><div class="sub">${Math.floor(R.pct1 * 100)}% пути${R.pct0 != null && Math.floor(R.pct0 * 100) !== Math.floor(R.pct1 * 100) ? `, было ${Math.floor(R.pct0 * 100)}%` : ''}</div>` : ''}
      <div class="kv"><div><span>Часов</span><b>${C.num1(a.h)}${a.plan > 0 ? `<small> из ${C.num1(a.plan)}</small>` : ''}</b></div><div><span>Смен</span><b>${a.sh}</b></div>
        <div><span>В приложении</span><b>${C.money(a.app)}</b></div><div><span>За час</span><b>${a.perH ? C.money(Math.round(a.perH)) : '-'}</b></div></div>
      <ul class="recap-list">
        ${a.best ? `<li>Лучший день: ${C.DOWL[C.dow(a.best.d)]}, ${C.money(a.best.app)}</li>` : ''}
        ${R.vs.length ? `<li>Против ${prevName}: ${R.vs.join(', ')}</li>` : ''}
        ${R.badges.length ? `<li>Новые награды: ${esc(R.badges.slice(0, 3).join(', '))}${R.badges.length > 3 ? ` и ещё ${R.badges.length - 3}` : ''}</li>` : ''}
        ${R.xp > 0 ? `<li>Опыт: +${C.grp(R.xp)} XP</li>` : ''}
      </ul>
      <div class="btns"><button class="btn alt" data-a="recap-ok" data-v="${R.key}">Понятно</button></div></section>`;
  }
  // картинка итогов, чтобы отправить близким
  function recapImage(R) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'), F = '-apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1A2140'); bg.addColorStop(1, '#090D18'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W - 120, 160, 10, W - 120, 160, 520); glow.addColorStop(0, 'rgba(142,125,255,.35)'); glow.addColorStop(1, 'rgba(142,125,255,0)'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
    // текст уменьшается, пока не влезет в ширину картинки
    const txt = (t, px, y, color, weight, size, align) => { let sz = size; do { x.font = `${weight || 700} ${sz}px ${F}`; sz -= 2; } while (sz > 24 && x.measureText(t).width > W - px - 60); x.fillStyle = color; x.textAlign = align || 'left'; x.fillText(t, px, y); };
    const rr = (px, py, w, h, r) => { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); };
    txt('ПУТЬ К КВАРТИРЕ', 90, 150, '#9AA3BD', 800, 34);
    txt(R.title, 90, 240, '#F3F5FB', 800, 76);
    txt(R.range, 90, 305, '#9AA3BD', 600, 44);
    if (R.delta != null) {
      txt(C.money(r1k(R.delta), true).replace(/\u00a0/g, ' '), 90, 470, R.delta >= 0 ? '#72EFB3' : '#FF7867', 800, 128);
      txt('к активам за ' + (R.kind === 'month' ? 'месяц' : 'неделю'), 90, 530, '#9AA3BD', 600, 40);
    }
    rr(90, 590, W - 180, 34, 17); x.fillStyle = '#0A0E25'; x.fill();
    const pw = Math.max(34, (W - 180) * Math.max(0, Math.min(1, R.pct1))); const pg = x.createLinearGradient(90, 0, 90 + pw, 0); pg.addColorStop(0, '#6E5DF2'); pg.addColorStop(1, '#A193FF');
    rr(90, 590, pw, 34, 17); x.fillStyle = pg; x.fill();
    txt(Math.floor(R.pct1 * 100) + '% пути к своей квартире', 90, 680, '#D9DDEA', 700, 40);
    const cells = [['Часов', C.num1(R.a.h)], ['Смен', String(R.a.sh)], ['В приложении', C.money(R.a.app)], ['За час', R.a.perH ? C.money(Math.round(R.a.perH)) : '-']];
    cells.forEach(([k, v], i) => {
      const cx = 90 + (i % 2) * 460, cy = 740 + Math.floor(i / 2) * 190;
      rr(cx, cy, 440, 165, 28); x.fillStyle = 'rgba(255,255,255,.05)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.09)'; x.lineWidth = 2; x.stroke();
      txt(k, cx + 34, cy + 58, '#9AA3BD', 600, 34); txt(v.replace(/\u00a0/g, ' '), cx + 34, cy + 128, '#F3F5FB', 800, 54);
    });
    const line = R.vs.length ? 'Против ' + (R.kind === 'month' ? 'прошлого месяца' : 'прошлой недели') + ': ' + R.vs.join(', ') : R.a.best ? 'Лучший день: ' + C.DOWL[C.dow(R.a.best.d)] + ', ' + C.money(R.a.best.app) : '';
    if (line) txt(line.replace(/\u00a0/g, ' '), 90, 1180, '#D9DDEA', 600, 38);
    txt(`Уровень ${R.level} · ${R.rank}${R.xp > 0 ? ' · +' + C.grp(R.xp).replace(/\u00a0/g, ' ') + ' XP' : ''}`, 90, 1265, '#B9AEFF', 700, 38);
    return cv;
  }
  async function shareRecap() {
    const R = recapData(model()); if (!R) return;
    const cv = recapImage(R), blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    if (!blob) return;
    const name = (R.kind === 'month' ? 'itogi-mesyaca-' : 'itogi-nedeli-') + R.from + '.png', file = new File([blob], name, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: R.title }); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Картинка сохранена в загрузки');
  }
  // ---------------------------------------------------------------- приборы под спидометром: энергия, месяц, босс, неделя
  function instruments(m, working) {
    const st = m.st, pl = m.pl, mk = C.mkOf(TODAY), mn = C.monthNeed(st, mk), mon = pl.month && pl.month.mk === mk ? pl.month : null, earned = mon ? mon.earned : 0;
    const e = Math.round(pl.energy), b = pl.boss, md = st.mood && st.mood[TODAY], items = [];
    items.push({ k: 'energy', label: 'Энергия', v: e / 100, color: e >= 60 ? '#3DDC91' : e >= 30 ? '#FFC83D' : '#FF7867', inner: e, sub: md ? 'из 100' : 'как ты?', dot: !md });
    const mp = mn.total > 0 ? Math.max(0, earned) / mn.total : 0;
    items.push({ k: 'month', label: cap(C.MON[+mk.slice(5) - 1]), v: mp, color: mon && mon.paidOn ? '#3DDC91' : '#5AA8FF', inner: Math.min(999, Math.round(mp * 100)) + '%', sub: mon && mon.paidOn ? 'оплачен' : C.money(r1k(Math.max(0, earned))) });
    if (working && b && b.hp > 0) { const left = Math.max(0, b.hp - b.dmg); items.push({ k: 'boss', label: 'Босс', v: left / b.hp, color: '#FF7867', inner: b.beaten ? '0' : Math.round(left), sub: b.beaten ? 'побеждён' : 'ч здоровья' }); }
    if (working && !m.pre) { const planAll = weekPlan(st, C.monday(TODAY)); if (planAll > 0) { const wk = C.weekStats(st, TODAY, m.fc, TODAY); items.push({ k: 'week', label: 'Неделя', v: wk.fact / planAll, color: '#8E7DFF', inner: C.num1(wk.fact), sub: 'из ' + C.num1(planAll) + ' ч' }); } }
    return `<div class="inst n${items.length}">${items.map(x => `<button class="inst-i" data-a="inst" data-v="${x.k}" aria-label="${x.label}">${D.ring(x.v, x.color, x.inner)}${x.dot ? '<i class="inst-dot"></i>' : ''}<b>${x.label}</b><span>${x.sub}</span></button>`).join('')}</div>`;
  }
  // подробная карточка прибора открывается листом
  function instSheet(k) {
    const m = model(), html = k === 'energy' ? energyCard(m) : k === 'month' ? monthCard(m) : k === 'boss' ? bossCard(m.pl) : k === 'week' ? weekCard(m, true) : '';
    if (html) { sheet(`<div class="in-sheet">${html}</div>`); UI.inst = k; }
  }
  // одна строка внимания под приборами: только самое важное, по приоритету
  function attention(m, working) {
    if (!working) return '';
    const st = m.st, pl = m.pl, o = pl.overload, e = Math.round(pl.energy), b = pl.boss, left = C.dim(C.mkOf(TODAY)) - +TODAY.slice(8);
    const line = (icon, text, a, v) => `<button class="attn" data-a="${a}"${v ? ` data-v="${v}"` : ''}>${ic(icon)}<span>${text}</span>${ic('right')}</button>`;
    if (o && o.offer) return line('battery', `Похоже на перегруз: ${esc(o.signals.slice(0, 2).map(x => x.t).join(', '))}. Посмотри лёгкую неделю`, 'reload');
    if (e < 20) return line('battery', esc(G.energyTip(e, pl.freezes, C.planHours(st, TODAY) === 0).text), 'inst', 'energy');
    // босс в конце месяца: только если его можно добить сменами по плану, больше плана не просим
    if (b && !b.beaten && b.hp > b.dmg && left < 5) {
      let need = b.hp - b.dmg, n = 0;
      for (let d = st.shifts[TODAY] ? C.isoAdd(TODAY, 1) : TODAY; need > 0 && d.slice(0, 7) === TODAY.slice(0, 7); d = C.isoAdd(d, 1)) { const p = C.planHours(st, d); if (p > 0) { need -= p; n++; } }
      if (need <= 0) return line('shield', `Ещё ${n} ${C.plural(n, ['смена', 'смены', 'смен'])} по плану, и босс побеждён`, 'inst', 'boss');
    }
    return '';
  }
  // как ты и сколько спал: по одному ряду, ряд пропадает после отметки (поменять можно в листе энергии)
  const MOODS = [[1, 'выжат'], [2, 'устал'], [3, 'норм'], [4, 'бодро'], [5, 'огонь']];
  const moodRow = md => `<div class="moods">${MOODS.map(([v, t]) => `<button class="mood${md === v ? ' on' : ''}" data-a="mood" data-v="${v}" aria-pressed="${md === v}"><b>${v}</b><span>${t}</span></button>`).join('')}</div>`;
  const sleepRow = sl => `<div class="moods sleep">${G.SLEEP.map(x => `<button class="mood${sl === x.id ? ' on' : ''}" data-a="sleep" data-v="${x.id}" aria-pressed="${sl === x.id}"><b>${x.label}</b></button>`).join('')}</div>`;
  function checkin(m, working) {
    const st = m.st, md = st.mood && st.mood[TODAY], sl = st.sleep && st.sleep[TODAY], askSleep = working && !sl;
    if (md && !askSleep) return '';
    // сначала сон (от него зависит совет на смену), потом настроение
    return `<section class="card ci">${askSleep ? `<div class="over">Сколько спал, ч</div>${sleepRow(null)}`
      : `<div class="between"><div class="over">Как ты сегодня?</div>${xpChip(XPN().mood)}</div>${moodRow(null)}`}</section>`;
  }
  // первое открытие за день: стрелки набирают значение, и видно, сколько прибавилось с прошлого раза
  function ignition(na) {
    let last = null;
    try { last = JSON.parse(localStorage.getItem('put.last') || 'null'); } catch (e) { last = null; }
    const first = !last || last.d !== TODAY, delta = first && last && na - last.na >= 1000 ? Math.round(na - last.na) : 0;
    try { localStorage.setItem('put.last', JSON.stringify({ d: TODAY, na: Math.round(na) })); } catch (e) { /* без памяти */ }
    return { first, delta };
  }
  function nextDaysText(st) {
    const t1 = C.isoAdd(TODAY, 1), p1 = C.planHours(st, t1);
    let off = null;
    for (let i = 1; i <= 6; i++) { const d = C.isoAdd(TODAY, i); if (C.planHours(st, d) === 0) { off = d; break; } }
    return `Завтра <b>${p1 > 0 ? C.num1(p1) + ' ч' : 'выходной'}</b>` + (off && off !== t1 ? `<br>${C.DOW[C.dow(off)]} <b>выходной</b>` : '');
  }
  const workName = (st, d) => st.set.taxiFrom && d >= st.set.taxiFrom ? 'Смена' : 'Доставка';
  function todayCard(m, working) {
    const st = m.st, g = st.set, plan = C.planHours(st, TODAY), x = st.shifts[TODAY], pl = m.pl;
    if (st.live) return liveCard(m); // смена с таймером идёт или ждёт, когда внесёшь сумму
    if (!working) {
      const Q = G.quests(st, TODAY, m.fc).open[0], ph = C.phaseNow(st, TODAY, m.fc);
      const dPre = g.preFrom && TODAY < g.preFrom ? C.isoDiff(TODAY, g.preFrom) : null, dTaxi = g.taxiFrom ? C.isoDiff(TODAY, g.taxiFrom) : null;
      return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('flag')}</div><div><div class="over">Сейчас главное</div><div class="today-t">${esc(ph.title)}</div></div>
        <div class="today-side">${dPre != null ? `подработка через<br><b>${days(dPre)}</b>` : dTaxi != null ? `до первой смены<br><b>${days(dTaxi)}</b>` : ''}</div></div>
        ${Q ? `<button class="quest-line" data-a="tab" data-tab="path"><span>Задание: <b>${esc(Q.title)}</b>${Q.date ? ', ' + C.untilText(TODAY, Q.date) : ''}</span>${xpChip(Q.xp)}</button>` : ''}</section>`;
    }
    const name = workName(st, TODAY);
    if (x) {
      const p = praiseOf(st, TODAY, m.fc), xp = pl.ledger.filter(e => e.d === TODAY && (e.kind === 'shift' || e.kind === 'day' || e.kind === 'chest')).reduce((s, e) => s + e.xp, 0);
      return `<section class="card"><div class="today-top"><div class="ibox green">${ic('check')}</div><div><div class="over">Сегодня внесено</div><div class="today-t">${+x.h > 0 ? name + ' ' + C.num1(x.h) + ' ч' : 'Не работал'}</div></div>
        <div class="today-side">${nextDaysText(st)}</div></div>
        ${+x.h > 0 ? `<button class="praise-tap" data-a="receipt" data-d="${TODAY}">${praiseBox(p, xp, stampMini(st, TODAY))}</button>` : praiseBox(p, xp)}
        ${dayQuests(pl.dq)}
        ${+x.h > 0 && !(x.app > 0) ? `<button class="quest-line" data-a="log" data-d="${TODAY}"><span>Внеси, сколько заработал за день</span>${xpChip(XPN().app)}</button>` : ''}
        <div class="btns"><button class="btn ghost" data-a="log" data-d="${TODAY}">${ic('edit')}Изменить</button></div></section>`;
    }
    if (plan > 0) {
      // мало спал: без зазывания на сундук и на +3 часа
      const tired = tiredPlate(st, plan);
      return `<section class="card"><div class="today-top"><div class="ibox">${ic('wheel')}</div><div><div class="over">Сегодня по плану</div><div class="today-t">${name} ${C.num1(plan)} ч</div></div>
        <div class="today-side">${nextDaysText(st)}</div></div>
        ${tired}
        ${dayQuests(pl.dq, null, !!tired)}
        ${quickHours(TODAY, plan, !!tired)}
        <div class="today-act"><button class="btn alt sm" data-a="live-start">${ic('play')}Начал смену</button><button class="link" data-a="bad-day">Не могу сегодня</button></div></section>`;
    }
    return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('moon')}</div><div><div class="over">Сегодня</div><div class="today-t">Выходной</div></div>
      <div class="today-side">${nextDaysText(st)}</div></div>
      <p class="lead">${st.bad && st.bad[TODAY] ? `Сегодня не работаешь: ${esc(st.bad[TODAY].toLowerCase())}. Отдыхай и приходи в себя, план и прогноз уже пересчитаны.` : `Сегодня отдых. ${pl.energy < 50 ? `Энергия ${Math.round(pl.energy)} из 100: отдых сейчас даст +${XPN().rest} XP за восстановление.` : `Если выйдешь, за смену в выходной +${XPN().dayOff} XP.`}`}</p>
      ${quickHours(TODAY, 0)}
      <div class="today-act"><button class="btn alt sm" data-a="live-start">${ic('play')}Начал смену</button></div></section>`;
  }
  // задания дня: план, заработок и заказы чуть выше твоего обычного, все три = сундук
  function dayQuests(q, d, calm) {
    if (!q) return '';
    const row = (done, text, xp) => `<div class="dq${done ? ' on' : ''}"><i>${ic('check')}</i><span>${text}</span>${xpChip(xp, done)}</div>`;
    let out = '';
    if (q.plan > 0) out += row(q.planDone, `План: ${C.num1(q.plan)} ч`, XPN().planDay);
    out += q.moneyT != null ? row(q.moneyDone, `Заработок от ${C.money(q.moneyT)}`, XPN().moneyDay) : '<div class="dq dim"><i></i><span>Цель по заработку появится после 3 смен с суммой</span></div>';
    if (q.ordersT != null) out += row(q.ordersDone, `Заказов от ${q.ordersT}`, XPN().ordersDay);
    const chest = calm && !q.chest ? '' : chestRow(S(), d || TODAY, q);
    const pl = playerOf(S(), TODAY), ch = pl.chance, late = new Date().getHours() >= 6, left = ch ? 3 - ch.k : 0;
    const chance = ch && (ch.from < C.isoAdd(TODAY, -1) || late) ? `<div class="dq chance"><i>${ic('flame')}</i><span>Вернуть серию ${ch.L}: ещё ${left} ${C.plural(left, ['смена', 'смены', 'смен'])} до ${C.dateShort(ch.until)}</span></div>` : '';
    return `<div class="dqs"><div class="over">Задания дня</div>${chance}${out}${chest}</div>`;
  }
  // ---------------------------------------------------------------- три замка Отбасы
  // отдельная карточка, не в карточке срока: цель про активы, а заём 50/50 ждёт ещё и три замка
  function locksCard(m) {
    const L = C.otbLocks(m.st, TODAY, m.fc); if (!L) return '';
    const open = L.locks.filter(x => x.ok).length, late = L.buy && L.buy > m.st.set.deadline;
    return `<section class="card"><div class="over">Квартира по Отбасы 50/50</div>
      <button class="lockline" data-a="locks">${ic(open === 3 ? 'unlock' : 'lock')}<span>${open === 3 ? 'Все три замка открыты: можно подавать на заём' : `${open} из 3 замков${L.buy ? `, покупать можно примерно ${inMonth(C.mkOf(L.buy))}` : ''}`}</span>${ic('right')}</button>
      ${late && open < 3 ? `<div class="sub">Это позже срока цели: банк ждёт, пока депозиту будет 3 года, на нём половина суммы и ОП от 16.</div>` : ''}</section>`;
  }
  function locksSheet() {
    const m = model(), L = C.otbLocks(m.st, TODAY, m.fc);
    if (!L) { sheet(`<div class="sh-t">Три замка Отбасы</div><div class="sh-s">Укажи в настройках, когда открыт депозит Отбасы, и я посчитаю, когда откроются замки.</div>`); return; }
    const [t, h, o] = L.locks, when = x => x.ok ? 'открыт' : x.date ? 'откроется ' + (x.k === 'time' ? C.dateLong(x.date) : 'примерно ' + inMonth(C.mkOf(x.date))) : 'за горизонтом прогноза';
    const row = (x, title, bar) => `<div class="lock${x.ok ? ' on' : ''}"><i>${ic(x.ok ? 'unlock' : 'lock')}</i><div><b>${title}</b><span>${when(x)}</span>${bar || ''}</div></div>`;
    const pb = f => `<div class="pbar"><i style="width:${(Math.max(0, Math.min(1, f)) * 100).toFixed(1)}%"></i></div>`;
    const tierRows = L.tiers.filter(x => [16, 20, 25, 29, 35, 48].indexOf(x[0]) >= 0);
    sheet(`<div class="sh-t">Три замка Отбасы</div><div class="sh-s">Заём 50/50 под 3,5-5% банк даёт, когда открыты все три. Банк смотрит только на депозит, не на машину и деньги на карте. Считаю примерно, банк точнее.</div>
      ${row(t, 'Депозиту 3 года')}
      ${row(h, `На депозите половина договорной суммы: ${C.money(L.half)}`, pb(h.now / L.half) + `<small>сейчас ${C.money(r1k(h.now))}</small>`)}
      ${row(o, 'Оценочный показатель от 16', pb(o.now / 16) + `<small>сейчас около ${C.num1(Math.round(o.now * 10) / 10)}${L.anchored ? ', по банку на ' + C.dateShort(L.anchored) : ''}</small>`)}
      <div class="lock-res">${L.locks.every(x => x.ok) ? 'Все три замка открыты: можно подавать на заём 50/50' : L.buy ? `Покупать по 50/50 можно примерно ${inMonth(C.mkOf(L.buy))}` : `За горизонтом прогноза: ${[!h.date && !h.ok ? 'половина суммы' : '', !o.date && !o.ok ? 'ОП от 16' : ''].filter(Boolean).join(' и ')}`}</div>
      ${L.interim && (!L.buy || L.interim < L.buy) && !L.locks.every(x => x.ok) ? (L.interim <= TODAY ? `<p class="sub">Промежуточный заём под 8,5% уже возможен: половина суммы есть, ОП от 5.</p>` : `<p class="sub">Раньше, примерно ${inMonth(C.mkOf(L.interim))}, возможен промежуточный заём под 8,5%: нужна половина суммы и ОП от 5.</p>`) : ''}
      <div class="ladder">${tierRows.map(x => `<div class="${L.tier && L.tier.op === x[0] ? 'on' : ''}"><b>ОП ${x[0]}</b><span>${C.num1(x[1])}%</span><span>до ${x[2]} лет</span></div>`).join('')}</div>
      <p class="sub">Чем дольше деньги лежат на депозите, тем выше ОП, а с ним ниже ставка и длиннее срок. Деньги, положенные в самом конце, ОП почти не поднимают.</p>
      ${L.emptyMonths >= 9 ? `<p class="sub warn-t">Депозит пустой уже ${L.emptyMonths} ${C.plural(L.emptyMonths, ['месяц', 'месяца', 'месяцев'])}: если на счёте нет денег больше года, банк вправе закрыть счёт.</p>` : ''}
      <p class="sub">Ещё банк проверит платёжеспособность. Договорная сумма ${C.money(L.ds)}, её можно поменять в настройках. ОП из приложения Отбасы впиши при сверке, и расчёт станет точнее.</p>`);
  }
  // ---------------------------------------------------------------- лёгкая неделя: два варианта на следующую неделю и их цена в днях
  function reloadSheet() {
    const m = model(), st = m.st, o = m.pl.overload, mon = C.isoAdd(C.monday(TODAY), 7), wk = [0, 1, 2, 3, 4, 5, 6].map(i => C.isoAdd(mon, i));
    const plan = wk.reduce((a, d) => a + C.planHours(st, d), 0), short = {}, mid = [2, 3, 1, 4].map(i => wk[i]).find(d => C.planHours(st, d) > 0);
    wk.forEach(d => { const p = C.planHours(st, d); if (p > 2) short[d] = p - 2; });
    const off = mid ? { [mid]: 0 } : null, g0 = m.fc.goal && m.fc.goal.iso;
    const cost = over => { const s2 = Object.assign({}, st, { over: Object.assign({}, st.over, over) }), f = C.forecast(s2, TODAY), g1 = f.goal && f.goal.iso; return g0 && g1 ? Math.max(0, C.isoDiff(g0, g1)) : null; };
    const hrsOf = over => wk.reduce((a, d) => a + (over[d] != null ? over[d] : C.planHours(st, d)), 0);
    const price = n => n == null ? '' : n === 0 ? ' · на цель почти не влияет' : ` · цель позже примерно на ${days(n)}`;
    UI.reloadOpts = { mon, short, off };
    sheet(`<div class="sh-t">Лёгкая неделя</div><div class="sh-s">Неделя с ${C.dateShort(mon)}. План и прогноз пересчитаются, серия не пострадает: выходные по плану её не рвут.</div>
      ${o && o.signals.length ? `<div class="sig">${o.signals.map(x => `<span class="chip violet">${esc(x.t)}</span>`).join('')}</div>` : ''}
      ${Object.keys(short).length ? `<button class="opt" data-a="reload-pick" data-v="short"><b>Смены на 2 часа короче</b><span>${C.num1(hrsOf(short))} ч вместо ${C.num1(plan)}${price(cost(short))}</span></button>` : ''}
      ${off ? `<button class="opt" data-a="reload-pick" data-v="off"><b>Ещё один выходной: ${C.DOWL[C.dow(mid)]}</b><span>${C.num1(hrsOf(off))} ч вместо ${C.num1(plan)}${price(cost(off))}</span></button>` : ''}
      <div class="sub">Если неделя пройдёт как задумал (в пределах 2 ч), +${G.XP.reload} XP.</div>
      <div class="btns"><button class="btn ghost" data-a="reload-pick" data-v="snooze">Не сейчас</button></div>`);
  }
  // ---------------------------------------------------------------- сундук: закрытый ждёт нажатия, открытый показывает редкость
  const RARE = { common: 'Сундук дня', rare: 'Редкий сундук', legend: 'Легендарный сундук' };
  const stickerName = id => ((G.STICKERS.find(x => x.id === id) || {}).name || '');
  // открывать нужно только сундуки сегодня и вчера: старые считаются открытыми
  const chestOpened = (st, d) => d < '2026-11-18' || d < C.isoAdd(TODAY, -1) || ((st.seen && st.seen.chests) || []).indexOf(d) >= 0;
  function chestRow(st, d, q) {
    if (!q || !q.chest) return q && q.avail >= 2 ? `<div class="chest">${ic('chest')}<span>Все задания дня открывают сундук: обычный, редкий или легендарный</span></div>` : '';
    if (!chestOpened(st, d)) return `<button class="chest ready" data-a="chest" data-d="${d}">${ic('chest')}<span>Сундук ждёт. Нажми, чтобы открыть</span></button>`;
    return `<div class="chest on ${q.rare || 'common'}">${ic('chest')}<span>${RARE[q.rare || 'common']}${q.sticker ? `: наклейка ${esc(stickerName(q.sticker))}` : ''}</span>${xpChip(q.chest)}</div>`;
  }
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  // число растёт до значения за ms миллисекунд
  function countUp(el, to, ms, fmt) {
    if (!el) return;
    if (reduced() || !(to > 0)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), step = t => { const k = Math.min(1, (t - t0) / ms), v = Math.round(to * (1 - Math.pow(1 - k, 3))); el.textContent = fmt(v); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function openChest(el, d) {
    const st = S(), q = playerOf(st, TODAY).dqs[d];
    if (!q || !q.chest || el.classList.contains('opening')) return;
    const rare = q.rare || 'common', vib = rare === 'legend' ? [40, 60, 40, 60, 120] : rare === 'rare' ? [30, 40, 30] : [20];
    el.classList.add('opening'); el.disabled = true;
    const show = () => {
      el.className = 'chest on open ' + rare;
      el.innerHTML = `${ic('chest')}<span>${RARE[rare]}${q.sticker ? `: наклейка ${esc(stickerName(q.sticker))}` : ''}</span><b class="cxp">+0 XP</b>`;
      countUp(el.querySelector('.cxp'), q.chest, 700, v => '+' + C.grp(v) + ' XP'); buzz(vib);
      // в чеке смены опыт сундука добавляется к итогу
      const tot = $('#rc-total'); if (tot) { const v0 = +tot.dataset.v || 0; tot.dataset.v = v0 + q.chest; countUp(tot, v0 + q.chest, 700, v => '+' + C.grp(v) + ' XP'); }
      if (q.sticker) toast(`Новая наклейка: ${stickerName(q.sticker)}. ${auto ? 'Она уже на крыше, поменять можно в гараже.' : 'Поставить её на крышу можно в гараже.'}`, 'good');
    };
    // первая наклейка сразу едет на крыше, следующие ждут в гараже
    const auto = q.sticker && !st.set.sticker;
    if (reduced()) show(); else setTimeout(show, 450);
    setTimeout(() => {
      Store.update(s => { s.seen = Object.assign({}, s.seen, { chests: ((s.seen && s.seen.chests) || []).concat([d]).slice(-60) }); }, 'seen');
      if (auto) Store.update(s => { s.set.sticker = q.sticker; }, 'set');
    }, 900);
  }
  // ---------------------------------------------------------------- смена с таймером и перерывы
  const BREAK_MIN = 120; // перерыв каждые 2 часа за рулём
  const hm = min => { const t = Math.max(0, Math.round(min)), h = Math.floor(t / 60), mm = t % 60; return h ? h + '\u00a0ч' + (mm ? ' ' + mm + '\u00a0мин' : '') : mm + '\u00a0мин'; };
  const clock = ms => { const d = new Date(ms); return C.pad(d.getHours()) + ':' + C.pad(d.getMinutes()); };
  // сколько минут за рулём без перерывов и сколько с последнего перерыва
  function liveTimes(L, now) {
    const end = L.end || now; let brk = 0, lastEnd = L.start;
    for (const [a, b] of L.brk || []) { brk += b - a; lastEnd = Math.max(lastEnd, b); }
    if (L.on) brk += end - L.on;
    return { drive: Math.max(0, (end - L.start - brk) / 60000), since: L.on ? 0 : Math.max(0, (end - lastEnd) / 60000), lastEnd };
  }
  const liveHours = L => Math.max(0.5, Math.round(liveTimes(L, Date.now()).drive / 30) / 2);
  function liveCard(m) {
    const st = m.st, L = st.live, t = liveTimes(L, Date.now()), plan = C.planHours(st, L.d), name = workName(st, L.d);
    if (L.end) {
      return `<section class="card live"><div class="today-top"><div class="ibox green">${ic('check')}</div><div><div class="over">Смена закончена${L.d !== TODAY ? ', ' + C.dateShort(L.d) : ''}</div><div class="today-t">${hm(t.drive)} за рулём</div></div></div>
        <p class="sub">Внеси сумму и заказы из Яндекс Про, часы уже подставлены.</p>
        <div class="btns"><button class="btn" data-a="live-log">${ic('check')}Внести смену</button></div>
        <div class="today-act"><span></span><button class="link" data-a="live-cancel">Сбросить таймер</button></div></section>`;
    }
    const due = !L.on && t.since >= BREAK_MIN;
    return `<section class="card live${due ? ' due' : ''}"><div class="today-top"><div class="ibox${L.on ? ' violet' : ''}">${ic(L.on ? 'pause' : 'wheel')}</div><div><div class="over">${L.on ? 'Перерыв' : name + ' идёт'}</div><div class="today-t" id="live-t">${hm(t.drive)}</div></div>
        <div class="today-side">с ${clock(L.start)}${plan > 0 ? `<br><b>план ${C.num1(plan)} ч</b>` : ''}</div></div>
      ${plan > 0 ? `<div class="pbar"><i id="live-bar" style="width:${Math.min(100, t.drive / (plan * 60) * 100).toFixed(1)}%"></i></div>` : ''}
      <div class="brk${due ? ' due' : ''}" id="live-brk">${ic('clock')}<span>${liveBrkText(L, t, plan)}</span></div>
      ${restWindow(st, L)}
      ${shadeAsk() ? `<div class="shade-q"><span>Показывать смену в шторке телефона? Перерыв и Закончил можно будет жать оттуда.</span><div><button class="btn sm" data-a="shade-yes">Да</button><button class="link" data-a="shade-no">Не надо</button></div></div>` : ''}
      <div class="btns"><button class="btn alt" data-a="live-pause">${L.on ? ic('play') + 'Продолжить' : ic('pause') + 'Перерыв'}</button><button class="btn" data-a="live-stop">${ic('check')}Закончил</button></div></section>`;
  }
  function liveBrkText(L, t, plan) {
    const left = plan > 0 ? plan * 60 - t.drive : 0, tail = plan > 0 ? (left > 0 ? ` До плана ${hm(left)}.` : ' План дня закрыт.') : '';
    if (L.on) return `Перерыв ${hm((Date.now() - L.on) / 60000)}. Пройдись, попей воды.` + tail;
    if (t.since >= BREAK_MIN) return `За рулём ${hm(t.since)} без перерыва. Выйди из машины на 10-15 минут: так безопаснее.` + tail;
    return `Перерыв через ${hm(BREAK_MIN - t.since)}.` + tail;
  }
  // раз в полминуты обновляем таймер и напоминаем про перерыв (пока приложение открыто)
  function liveTick() {
    const st = S(), L = st && st.live;
    if (!L || L.end) return;
    const t = liveTimes(L, Date.now()), plan = C.planHours(st, L.d), el = $('#live-t');
    const mt = $('#mini-t'); if (mt) mt.textContent = miniText(L, t);
    if (el) {
      el.textContent = hm(t.drive);
      const bar = $('#live-bar'); if (bar && plan > 0) bar.style.width = Math.min(100, t.drive / (plan * 60) * 100).toFixed(1) + '%';
      const b = $('#live-brk'); if (b) { b.lastElementChild.textContent = liveBrkText(L, t, plan); b.classList.toggle('due', !L.on && t.since >= BREAK_MIN); }
    }
    // напоминание: в 2 часа за рулём и потом каждые полчаса, пока не сделаешь перерыв
    if (!L.on && t.since >= BREAK_MIN) {
      const step = Math.floor((t.since - BREAK_MIN) / 30), key = t.lastEnd + ':' + step;
      if (UI.brkKey !== key) { UI.brkKey = key; buzz([200, 100, 200]); toast(`${hm(t.since)} за рулём без перерыва. Выйди из машины на 10-15 минут.`, 'warn'); }
    }
  }
  setInterval(liveTick, 30000);
  window.addEventListener('online', () => { if (KB.err === 'net') { KB.err = null; KB.errK = null; if (UI.sub === 'kb') render(); } });
  // вернулся в приложение: события из шторки, таймер и сама шторка (её могли смахнуть или телефон перезагрузился)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { inboxApply().then(shadeShow); liveTick(); } });
  // ---------------------------------------------------------------- смена в шторке телефона
  // Кнопки уведомления пишет service worker в ящик putinbox, страница применяет их к таймеру по времени
  const SHADE = 'put-shift';
  const shadeOn = () => { try { return 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('put.shade') !== 'off'; } catch (e) { return false; } };
  const shadeAsk = () => { try { return 'Notification' in window && Notification.permission === 'default' && !localStorage.getItem('put.shade') && !!navigator.serviceWorker; } catch (e) { return false; } };
  async function shadeShow() {
    const st = S(), L = st && st.live;
    if (!L) return shadeClose();
    if (!shadeOn() || !navigator.serviceWorker) return;
    try {
      const reg = await navigator.serviceWorker.ready, name = workName(st, L.d), plan = C.planHours(st, L.d), t = liveTimes(L, Date.now());
      const title = L.end ? 'Смена закончена' : L.on ? 'Перерыв' : name + ' идёт';
      const body = L.end ? 'Нажми, чтобы внести сумму из Яндекс Про' : L.on ? 'Перерыв с ' + clock(L.on)
        : `С ${clock(L.start)} · перерыв около ${clock(Date.now() + Math.max(0, BREAK_MIN - t.since) * 60000)}${plan > 0 ? ' · план ' + C.num1(plan) + ' ч' : ''}`;
      const actions = L.end ? [] : L.on ? [{ action: 'resume', title: 'Продолжить' }, { action: 'stop', title: 'Закончил' }] : [{ action: 'pause', title: 'Перерыв' }, { action: 'stop', title: 'Закончил' }];
      await reg.showNotification(title, { tag: SHADE, body, actions, silent: true, icon: 'icon-192.png', badge: 'badge-72.png', timestamp: L.start,
        data: { d: L.d, start: L.start, title: name + ' идёт', state: L.end ? 'stop' : L.on ? 'pause' : 'resume' } });
    } catch (e) { /* без уведомлений приложение работает как раньше */ }
  }
  async function shadeClose() { try { if (!navigator.serviceWorker) return; const reg = await navigator.serviceWorker.ready; (await reg.getNotifications({ tag: SHADE })).forEach(n => n.close()); } catch (e) { /* нечего закрывать */ } }
  // по одному разу за раз: два запуска подряд (сообщение от service worker и возврат в приложение) не применят события дважды
  let inboxQ = Promise.resolve();
  const inboxApply = () => (inboxQ = inboxQ.then(inboxOnce, inboxOnce));
  async function inboxOnce() {
    if (!('caches' in window)) return;
    try {
      const c = await caches.open('putinbox'), keys = await c.keys(); if (!keys.length) return;
      const ev = []; for (const k of keys) { const r = await c.match(k); if (r) ev.push(await r.json()); await c.delete(k); }
      const L0 = S() && S().live; if (!L0) return;
      ev.sort((a, b) => a.t - b.t);
      const mine = ev.filter(x => !x.start || x.start === L0.start); if (!mine.length) return;
      let stopped = false;
      Store.update(s => {
        const L = s.live; if (!L) return;
        for (const x of mine) {
          if (L.evT && x.t <= L.evT) continue; // это событие уже применено
          if (x.a === 'pause' && !L.on && !L.end) L.on = x.t;
          else if (x.a === 'resume' && L.on && x.t > L.on) { L.brk.push([L.on, x.t]); L.on = null; }
          else if (x.a === 'stop' && !L.end) { if (L.on) { L.brk.push([L.on, Math.max(L.on, x.t)]); L.on = null; } L.end = x.t; stopped = true; }
          L.evT = x.t;
        }
        L.u = Date.now();
      }, 'live');
      if (stopped && S().live) logSheet(S().live.d, liveHours(S().live));
    } catch (e) { /* ящик недоступен */ }
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.put === 'inbox') inboxApply().then(shadeShow);
    // нажали на уведомление «Смена закончена»: открыть лист смены с часами таймера
    if (e.data.put === 'log') inboxApply().then(() => { const L = S() && S().live; if (L && L.end && !sheetOpen) logSheet(L.d, liveHours(L)); });
  });
  // какой день вносить: ночью после смены это вчерашняя
  function dayToLog() {
    const st = S(), y = C.isoAdd(TODAY, -1);
    return new Date().getHours() < 5 && C.planHours(st, y) > 0 && !st.shifts[y] ? y : TODAY;
  }
  // быстрые кнопки с иконки приложения: ?do=start|stop|log|money
  // ?do= читаем и стираем из адреса сразу при загрузке: перезагрузка или шаг назад не повторят действие
  const DO = (() => { const mm = /[?&]do=(\w+)/.exec(location.search); if (mm) { try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (e) { /* ок */ } } return mm ? mm[1] : null; })();
  function runDo() {
    if (!DO) return;
    const st = S(); if (!st || !st.money.length) return;
    const a = DO, el = { dataset: {} }, L = st.live;
    if (a === 'start') {
      if (L && L.end) { goTab('home'); logSheet(L.d, liveHours(L)); toast('Сначала внеси прошлую смену'); }
      else if (L) { goTab('home'); toast('Смена уже идёт с ' + clock(L.start)); }
      else { goTab('home'); act('live-start', el); }
    }
    else if (a === 'stop') { if (L && !L.end) act('live-stop', el); else logSheet(L ? L.d : dayToLog(), L ? liveHours(L) : null); }
    // внести смену: закончившийся таймер важнее часов по плану
    else if (a === 'log') { if (L && L.end) logSheet(L.d, liveHours(L)); else logSheet(dayToLog()); }
    else if (a === 'money') { goTab('money'); moneySheet(); }
  }
  // поставить на экран телефона: карточка один раз, пока не установил
  let installEv = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; if (UI.tab === 'home' && !sheetOpen) render(); });
  window.addEventListener('appinstalled', () => { installEv = null; toast('Готово. Зажми иконку Путь: там быстрые кнопки.', 'good'); });
  function installCard(st) {
    let no = false; try { no = localStorage.getItem('put.noinstall') === '1' || matchMedia('(display-mode: standalone)').matches; } catch (e) { no = false; }
    if (no || !installEv || Object.keys(st.shifts).length < 3) return '';
    return `<section class="card"><div class="over">Поставь на экран телефона</div><p class="sub">Откроется как приложение, а по долгому нажатию на иконку быстрые кнопки: начал смену, закончил, внести, сверить.</p>
      <div class="btns"><button class="btn sm" data-a="install">Поставить</button><button class="btn ghost sm" data-a="noinstall">Не надо</button></div></section>`;
  }
  // мини-полоска смены над вкладками, когда ты не на Главной
  // в перерыве видно, сколько длится перерыв, а не время за рулём
  const miniText = (L, t) => L.on ? 'Перерыв ' + hm((Date.now() - L.on) / 60000) : 'Смена ' + hm(t.drive);
  function miniBar(st) {
    const L = st && st.live; if (!L || UI.tab === 'home' || L.end) return '';
    const t = liveTimes(L, Date.now());
    return `<div class="mini">${ic(L.on ? 'pause' : 'wheel')}<span id="mini-t">${miniText(L, t)}</span><button data-a="live-pause" aria-label="${L.on ? 'Продолжить' : 'Перерыв'}">${L.on ? ic('play') + 'Дальше' : 'Перерыв'}</button><button class="on" data-a="live-stop">Закончил</button></div>`;
  }
  // плохой день: выходной без чувства вины, план и прогноз пересчитываются, серию держит заморозка
  const BAD = ['Заболел', 'Машина сломалась', 'Нет сил', 'Дела'];
  const LAPSE = { freeze: 'Серию сохранит заморозка.', keep: 'Дни болезни подряд считаются одним срывом: серию ещё можно вернуть 3 сменами.', open: 'Серия уйдёт в ноль, но её можно вернуть: 3 смены за 7 дней.',
    close: 'Серия начнётся заново, это нормально: главное цель.', reset: 'Серия начнётся заново, это нормально: главное цель.', none: '' };
  function badSheet() {
    const pl = playerOf(S(), TODAY);
    sheet(`<div class="sh-t">Плохой день бывает</div><div class="sh-s">Отметь, что случилось. Сегодня станет выходным, план недели и прогноз пересчитаются. ${LAPSE[pl.lapse] || ''}</div>
      <div class="bad-list">${BAD.map(r => `<button class="bad-b" data-a="bad-save" data-v="${r}">${r}</button>`).join('')}</div>
      <div class="btns"><button class="btn ghost" data-a="sheet-close">Всё-таки поработаю</button></div>`);
  }
  function quickHours(iso, plan, calm) {
    const base = plan > 0 ? (calm ? [0, 6, plan] : [0, 6, plan, plan + 3]) : [4, 6, 8, 12];
    const opts = base.filter((h, i) => base.indexOf(h) === i).sort((a, b) => a - b);
    return `<div class="quick">${opts.map(h => `<button class="q${h === plan && plan > 0 ? ' plan' : ''}" data-a="quick" data-d="${iso}" data-h="${h}">${h}<small>ч</small></button>`).join('')}
      <button class="q own" data-a="log" data-d="${iso}">своё</button></div>`;
  }
  // лист энергии: батарейка, а под ней настроение и сон за сегодня, их можно поменять, если промахнулся
  function energyCard(m) {
    const st = m.st, pl = m.pl, md = st.mood && st.mood[TODAY], sl = st.sleep && st.sleep[TODAY], e = Math.round(pl.energy), started = (st.set.preFrom && TODAY >= st.set.preFrom) || (st.set.taxiFrom && TODAY >= st.set.taxiFrom), tip = G.energyTip(e, pl.freezes, started && C.planHours(st, TODAY) === 0);
    const tone = e >= 60 ? 'good' : e >= 30 ? 'mid' : 'low';
    return `<section class="card"><div class="between"><div class="over">Энергия</div>${pl.freezes ? `<span class="chip violet">${ic('snow')}${pl.freezes} ${C.plural(pl.freezes, ['заморозка', 'заморозки', 'заморозок'])} серии</span>` : ''}</div>
      <div class="batt ${tone}"><div class="batt-bar"><i style="width:${Math.max(4, e)}%"></i></div><b>${e}<small> из 100</small></b></div>
      <div class="sub">${esc(tip.text)}</div>
      <div class="between ci-o"><div class="over">Как ты сегодня?</div>${md ? '' : xpChip(XPN().mood)}</div>${moodRow(md)}
      ${started ? `<div class="over ci-o">Сколько спал, ч</div>${sleepRow(sl)}` : ''}</section>`;
  }
  // запас к первой смене такси: сколько будет на руках и сколько нужно, чтобы аренда до своей машины и её покупка в срок
  // не опустили деньги ниже запаса на старт (core.runway). «Хватает» только если и прогноз покупает машину в срок
  function runwayCard(m) {
    const rw = m.rw, g = m.st.set;
    if (!rw) return '';
    // со своей машиной деньги уходят в минус до срока: на старт хватает, но зелёным не красим
    const negO = negBy(m);
    // нехватка на экране с округлением вверх до тысячи: добавишь показанное, и хватит. Меньше тысячи это шум округления сверок
    const sh = rw.short >= 1000 ? Math.ceil(rw.short / 1000) * 1000 : 0;
    const startOk = sh <= 0 && !m.fc.warn, okB = startOk && !negO, tone = rw.neg ? 'coral' : okB ? 'green' : 'yellow';
    const inMon = mk => C.MON[+mk.slice(5) - 1].replace(/ь$/, 'е').replace(/й$/, 'е').replace(/т$/, 'те');
    const low = rw.neg ? `Деньги кончатся в ${inMon(rw.neg)}.` : rw.low < rw.at && rw.lowMk && r1k(rw.low) < r1k(rw.at) ? `Меньше всего денег до такси будет в ${inMon(rw.lowMk)}: около ${C.money(r1k(rw.low))}.` : '';
    const bufT = rw.buf > 0 ? ` и запас ${C.money(rw.buf)}` : '';
    const what = rw.carMk ? (rw.buf > 0 ? `аренда до своей машины, её покупка ${C.dateLong(g.carFrom)}${bufT}` : `аренда до своей машины и её покупка ${C.dateLong(g.carFrom)}`) : `первые 3 месяца такси${bufT}`;
    // часы доставки советуем, только если неделя подработки с ними не выше потолка часов
    const pre = g.preTpl || [], preDays = pre.filter(x => x > 0).length, capOk = rw.extraH > 0 && weekOf(pre) + Math.ceil(rw.extraH * 2) / 2 * preDays <= capOf(g);
    const fix = sh > 0 ? (capOk && rw.extraH <= 6 ? `Чтобы хватило, добавь <b>${C.num1(Math.ceil(rw.extraH * 2) / 2)} ч доставки в день</b> или урежь конверты месяца.` : 'Одной доставкой не закрыть: урежь жильё (хостел) или конверты месяца.')
      : m.fc.warn ? 'По прогнозу машина в срок не покупается: смотри Прогноз ниже.'
      : negO ? (rw.carMk ? `На старт и покупку хватает, но со своей машиной деньги уйдут в минус ${inMonth(negO)}: смотри Прогноз ниже.` : `На старт хватает, но на аренде деньги кончатся ${inMonth(negO)}: смотри Прогноз ниже.`)
      : rw.carMk ? 'Запаса хватает на старт такси и на свою машину.' : 'Запаса хватает на первые месяцы такси.';
    return `<section class="card"><div class="between"><div class="over">Запас на старт такси</div><span class="chip ${tone}">${okB ? ic('check') + 'хватает' : startOk ? ic('down') + 'на старт хватает' : ic('down') + 'не хватает'}</span></div>
      <div class="fc-date">${moneyHtml(r1k(rw.at))}</div>
      <div class="fc-sub">${nb(`будет на руках к ${C.dateLong(g.taxiFrom)}. Нужно около ${C.money(r1k(rw.need))}: ${what}.${sh > 0 ? ` Не хватает ${C.money(sh)}.` : ''} ${low}`)}</div>
      <p class="lead">${fix}</p></section>`;
  }
  // конверты месяца: заработок по очереди заполняет жильё, машину, еду, связь и хотелки; дальше всё в цель
  function monthCard(m) {
    const st = m.st, pl = m.pl, mk = C.mkOf(TODAY), mn = C.monthNeed(st, mk), earned = pl.month && pl.month.mk === mk ? pl.month.earned : 0;
    const paidOn = pl.month && pl.month.paidOn;
    let left = Math.max(0, earned);
    const segs = mn.env.map(x => { const f = x.v > 0 ? Math.min(1, left / x.v) : 1; left = Math.max(0, left - x.v); return Object.assign({}, x, { f }); });
    const extra = Math.max(0, earned - mn.total);
    // средний заработок смены (после бензина и аренды) за последние 10 смен
    const sh = Object.keys(st.shifts).filter(d => d <= TODAY && st.shifts[d].h > 0).sort().slice(-10);
    const avg = sh.length ? sh.reduce((s, d) => s + C.dayMoney(st, d, +st.shifts[d].h, +st.shifts[d].app || 0).net, 0) / sh.length : 0;
    const restShifts = avg > 0 ? Math.ceil(Math.max(0, mn.total - earned) / avg) : null;
    const mpl = C.monthPlan(st, mk, st.shifts[TODAY] ? C.isoAdd(TODAY, 1) : TODAY), leftSh = mpl.sh + mpl.preSh, gap = Math.max(0, mn.total - earned - leftSh * avg);
    const workingMonth = Object.keys(st.shifts).some(d => d.slice(0, 7) === mk) || C.monthPlan(st, mk).h + C.monthPlan(st, mk).preH > 0;
    const msg = paidOn ? `Жизнь на ${C.MON[+mk.slice(5) - 1]} оплачена ${C.dateShort(paidOn)}. Дальше всё на квартиру: уже <b class="up">${C.money(extra, true)}</b>.`
      : !workingMonth ? 'В этом месяце смен нет: жизнь идёт из накоплений.'
      : `На жизнь уже есть <b>${C.money(Math.max(0, earned))}</b> из ${C.money(mn.total)}.` + (restShifts ? (restShifts <= leftSh ? ` Ещё примерно ${restShifts} ${C.plural(restShifts, ['смена', 'смены', 'смен'])} по твоему среднему, потом всё на квартиру.` : ` По плану до конца месяца ${leftSh} ${C.plural(leftSh, ['смена', 'смены', 'смен'])}: из накоплений уйдёт около ${C.money(Math.round(gap / 1000) * 1000)}.`) : '');
    return `<section class="card"><div class="between"><div class="over">Конверты: ${C.MON[+mk.slice(5) - 1]}</div><button class="link" data-a="month" data-v="${mk}">${ic('edit')}изменить</button></div>
      <div class="env">${segs.map(x => `<div class="env-s${x.f >= 1 ? ' full' : ''}" style="flex:${Math.max(1, x.v)}"><i style="width:${(x.f * 100).toFixed(1)}%"></i></div>`).join('')}${paidOn ? '<div class="env-s goal" style="flex:' + Math.max(1, Math.round(mn.total / 6)) + '"><i style="width:100%"></i></div>' : ''}</div>
      <div class="env-l">${segs.map(x => `<span class="${x.f >= 1 ? 'on' : ''}">${x.f >= 1 ? ic('check') : ''}${esc(x.title)} <b>${C.money(x.v)}</b></span>`).join('')}</div>
      <p class="lead">${msg}</p></section>`;
  }
  function bossCard(pl) {
    const b = pl.boss;
    if (!b || !(b.hp > 0)) return '';
    const left = Math.max(0, b.hp - b.dmg), f = Math.max(0, Math.min(1, left / b.hp));
    return `<section class="card boss${b.beaten ? ' beaten' : ''}"><div class="boss-h">${D.medal(b.beaten ? 'trophy' : 'shield', b.beaten ? 'gold' : 'orange', false, 46)}
      <div><div class="over">Босс месяца</div><div class="h3">${esc(b.name)}</div></div>${xpChip(XPN().boss, !!b.beaten)}</div>
      <div class="hp"><i style="width:${(f * 100).toFixed(1)}%"></i></div>
      <div class="sub">${b.beaten ? `Побеждён ${C.dateShort(b.beaten)}. Следующий босс с 1 числа.` : `Здоровье ${hrs(left)} из ${C.num1(b.hp)}. Каждый час работы бьёт по нему.`}</div></section>`;
  }
  function tilesCard(m) {
    const t = m.pl.tiles;
    if (!(t.value > 0)) return '';
    const next = t.n < t.total ? (t.n + 1) * t.value : null;
    return `<section class="card"><div class="between"><div class="over">Квартира по плиткам</div><span class="chip yellow">${t.n} из ${t.total}</span></div>
      <div class="tiles-wrap">${D.tiles(t.n, t.total, t.start)}</div>
      <div class="sub">Плитка = ${C.money(t.value)} активов, каждая новая +${XPN().tile} XP. Загорается при сверке денег${next ? `, следующая от ${C.money(next)}` : ''}.</div></section>`;
  }
  // сколько будет к сроку при выручке как в плохом и хорошем месяце исследования 18.11 (2 500 и 3 400 при вероятных 2 900): вилка в тенге
  const R_LO = 2500 / 2900, R_HI = 3400 / 2900;
  function rangeLine(m) {
    const st = m.st, mk = C.mkOf(st.set.deadline), R0 = m.fc.R, at = f => { const r = f.rows.find(x => x.mk === mk); return r ? r.na : null; };
    // пояснение к минусу по прогнозу плохого месяца: купит ли он машину, решает его собственный warn, а не основного прогноза
    const flo = C.forecast(st, TODAY, { R: R0 * R_LO }), lo = at(flo), mid = at(m.fc), hi = at(C.forecast(st, TODAY, { R: R0 * R_HI }));
    if (lo == null || hi == null) return '';
    const f = v => (v < 0 ? '−' : '') + mlnShort(Math.abs(v));
    return `<div class="range"><div class="over">К ${C.dateLong(st.set.deadline)} будет</div><div class="range-v"><span>от</span><b class="${lo < 0 ? 'down' : ''}">${f(lo)}</b><span>до</span><b class="up">${f(hi)}</b></div>
      <div class="sub">По прогнозу ${f(mid)}. Вилка: пассажиры платят от ${C.money(Math.round(R0 * R_LO / 50) * 50)} до ${C.money(Math.round(R0 * R_HI / 50) * 50)} в час, как в плохой и хороший месяц.${lo < 0 ? (C.phaseAt(st, TODAY) === 'own' ? ' Минус значит, что в плохие месяцы машина, Kaspi и жизнь съедают накопления.' : (flo.warn && !flo.bought) || !st.set.carFrom ? ' Минус значит, что без своей машины аренда съедает накопления.' : ' Минус значит, что аренда съедает накопления: переходи на свою машину раньше.') : ''}</div></div>`;
  }
  // ---------------------------------------------------------------- что если: как решения двигают цель
  // каждый вариант считается отдельно от текущего плана; включённые вместе дают общую строку внизу.
  // Рычаги из исследования 18.11: своя машина раньше (напрямую с Яндексом), 12 ч на линии с 07 до 21 с перерывом днём (около +5% к оплате
  // в час, данных мало), жильё дешевле (хостел или подселение). Часы меняют неделю плана: новый день платит аренду, бензин и мойку,
  // часы сверх 12 в смене идут по 0,95
  const capOf = g => g.maxWeek > 0 ? g.maxWeek : 72;
  const weekOf = tpl => (tpl || []).reduce((a, b) => a + (+b || 0), 0);
  // неделя такси по плану и сколько часов ещё помещается под потолок; capped: прибавка часов не влезает под потолок
  function wifRoom(st) {
    const g = st.set, taxi = C.phaseAt(st, TODAY) !== 'pre' || !!(g.taxiFrom && g.taxiFrom > TODAY);
    const wk = [0, 1, 2, 3, 4, 5, 6].map(i => +((g.tpl || [])[i] || 0)), sh = wk.filter(h => h > 0), avg = sh.length ? sh.reduce((a, b) => a + b, 0) / sh.length : 12;
    const room = capOf(g) - weekOf(wk), day = sh.length < 7 && avg <= room, hour = sh.length > 0 && sh.length <= room;
    return { taxi, sh, avg, room, day, hour, capped: taxi && sh.length < 7 && !day && !hour };
  }
  // жильё дешевле хостела не бывает: 30 000 в месяц в ценах ноября 2026 (хостел 25-33 тыс., CLAUDE.md)
  const HOSTEL = 30000;
  // short: как вариант звучит в строке «Помогут ...»; unsure: данных мало, эффект пишем как «около»
  function wifOpts(st) {
    const g = st.set, W = wifRoom(st), { taxi, sh, avg } = W, out = [];
    // часы сверх потолка недели не предлагаем: он для того и стоит.
    // Без выходного у Первого не берут: для 7/0 проверенное предложение QAZ_park 11 300 в день + 5% (Яндекс Гараж, 18.11.2026), и аренда, и процент
    if (taxi && W.day) out.push({ id: 'shift', title: sh.length === 6 ? `Без выходного, +${C.num1(avg)} ч в неделю` : `+1 смена в неделю, ${C.num1(avg)} ч`, short: sh.length === 6 ? 'смены без выходного' : '+1 смена в неделю',
      set: gg => { const i = gg.tpl.findIndex(x => !(x > 0)); if (i >= 0) gg.tpl[i] = avg; if (gg.tpl.every(x => x > 0)) { gg.rentDay = 11300; gg.park = 5; } } });
    if (taxi && W.hour) out.push({ id: 'hour', title: '+1 час к каждой смене', short: '+1 час к смене', set: gg => { gg.tpl = gg.tpl.map(x => x > 0 ? x + 1 : 0); } });
    // хостел или подселение вместо съёмного жилья: до 60 000 в месяц (жизнь 180 000 вместо 240 000 в исследовании), но не дешевле хостела,
    // и только если выходит от 10 000
    const home = +(g.env && g.env.home) || 0, cut = Math.min(60000, Math.round((home - HOSTEL) / 1000) * 1000);
    if (cut >= 10000) out.push({ id: 'life', title: `Жильё на ${C.money(cut)} дешевле: хостел или подселение`, short: 'жильё дешевле (хостел или подселение)', set: gg => {
      for (const k of ['env', 'envPre']) if (gg[k]) { const h = +gg[k].home || 0; if (h > HOSTEL) gg[k].home = Math.max(HOSTEL, h - cut); }
      gg.living = C.envSum(gg.env); gg.preLiving = C.envSum(gg.envPre); } });
    // 12 ч на линии с 07 до 21 с перерывом днём: около +5% к оплате в час, но это две смены одного водителя и байга (данных мало)
    if (taxi) out.push({ id: 'peaks', title: '12 ч на линии с 07 до 21, перерыв днём', short: '12 ч на линии с 07 до 21 с перерывом днём', rk: 1.05, unsure: true });
    if (!st.car && g.carFrom && C.addMonths(g.carFrom, -2) > (g.taxiFrom || TODAY) && C.addMonths(g.carFrom, -2) > TODAY) out.push({ id: 'car', title: 'Своя машина на 2 месяца раньше', short: 'своя машина на 2 месяца раньше', set: gg => { gg.carFrom = C.addMonths(gg.carFrom, -2); } });
    return out;
  }
  function wifRun(st, R, list) {
    const s2 = Object.assign({}, st, { set: Object.assign({}, st.set, { tpl: (st.set.tpl || []).slice(), env: Object.assign({}, st.set.env), envPre: Object.assign({}, st.set.envPre) }) });
    let rk = 1;
    for (const o of list) { if (o.set) o.set(s2.set); rk *= o.rk || 1; }
    // вместе часов больше потолка недели: такой план не считаю
    const week = weekOf(s2.set.tpl), cap = capOf(st.set);
    if (week > Math.max(cap, weekOf(st.set.tpl))) return { over: week, cap };
    const f = C.forecast(s2, TODAY, { R: R * rk }), mk = C.mkOf(st.set.deadline), r = f.rows.find(x => x.mk === mk);
    return { goal: f.goal ? f.goal.iso : null, na: r ? r.na : null, se: f.seOver };
  }
  // как вариант меняет цель: дни раньше или позже, а если цели нет, то деньги к сроку. Вариант, где данных мало, пишем как «около»
  function wifEffect(base, x, o) {
    const u = !!(o && o.unsure), dl = S().set.deadline;
    let e = { t: '', up: null };
    if (base.goal && x.goal) { const d = C.isoDiff(x.goal, base.goal); e = d > 0 ? { t: (u ? 'примерно ' : '') + 'на ' + days(d) + ' раньше', up: true } : d < 0 ? { t: (u ? 'примерно ' : '') + 'на ' + days(-d) + ' позже', up: false } : { t: 'без разницы', up: null }; }
    else if (!base.goal && x.goal) {
      const late = dl ? C.isoDiff(dl, x.goal) : 0, when = C.dateShort(x.goal) + ' ' + x.goal.slice(0, 4);
      e = { t: (u ? 'может быть, ' : '') + (late > 0 ? 'цель ' + when + ', позже срока на ' + days(late) : 'успеешь к ' + when), up: true };
    }
    else if (base.na != null && x.na != null) { const d = x.na - base.na; e = Math.abs(d) < 5000 ? { t: 'без разницы', up: null } : { t: (u ? 'около ' : '') + (d >= 0 ? '+' : '−') + (u ? mln1(Math.abs(d)) : mlnShort(Math.abs(d))) + ' к сроку', up: d > 0 }; }
    if (u && e.up !== null && !(o && o.noTag)) e.t += ' · данных мало';
    return e;
  }
  // доход месяца выше лимита самозанятого: одна короткая строка (с июля 2027 ...)
  const seLine = mk => nb(`С ${C.dateLong(mk + '-01').replace(/^1 /, '')} доход самозанятого больше ${C.money(C.seLimit(mk))} в месяц, это выше лимита: нужно ИП.`);
  // все варианты считаются один раз на версию данных, день и выручку: их же берут строки «Помогут ...» на Главной и в Пути
  let wifMemo = null;
  function wifCalc(m) {
    const st = m.st, R = m.fc.R, key = st.updated + '|' + TODAY + '|' + R;
    if (!wifMemo || wifMemo.key !== key) {
      const opts = wifOpts(st), base = wifRun(st, R, []);
      wifMemo = { key, opts, base, runs: opts.map(o => wifRun(st, R, [o])) };
      wifMemo.eff = wifMemo.runs.map((x, i) => wifEffect(base, x, opts[i]));
    }
    return wifMemo;
  }
  // после срока сравнивать варианты не с чем (деньги к сроку уже не посчитать): Что если и строку Помогут не показываем
  const pastDl = st => !!st.set.deadline && TODAY > st.set.deadline;
  function wifBlock(m) {
    if (pastDl(m.st)) return '';
    if (!UI.wif) return `<button class="wif-open" data-a="wif">${ic('sliders')}<span>Что если</span>${ic('down')}</button>`;
    const st = m.st, W = wifCalc(m), on = UI.wifOn || (UI.wifOn = new Set());
    // 7/0 и 6/1 по 14 ч выше потолка: в списке их нет, одна строка и ссылка на риски в заметке исследования
    const capNote = wifRoom(st).capped ? `<p class="sub wif-cap">${nb(`7/0 и 6/1 по 14 ч выше твоего потолка ${capOf(st.set)} ч в неделю.`)} <a class="in-ln" data-a="kb-open" data-id="econ" data-v="Графики" role="button" tabindex="0">Риски в заметке Доход в Экономе</a>.</p>` : '';
    return `<div class="wif"><button class="wif-open on" data-a="wif">${ic('sliders')}<span>Что если</span>${ic('up')}</button>
      ${W.opts.map((o, i) => `<label class="wif-row"><span><b>${esc(nb(o.title))}</b><small class="${W.eff[i].up === true ? 'up' : W.eff[i].up === false ? 'dn' : ''}">${W.eff[i].t}${W.runs[i].se && !W.base.se ? ' · нужно ИП' : ''}</small></span><input type="checkbox" data-wif="${o.id}"${on.has(o.id) ? ' checked' : ''}></label>`).join('')}
      <div class="wif-sum" id="wif-sum">${wifSum(m)}</div>${capNote}</div>`;
  }
  function wifSum(m) {
    const W = wifCalc(m), on = UI.wifOn;
    if (!on || !on.size) return 'Отметь варианты, и здесь будет, что выйдет вместе.' + (W.base.se ? ' ' + seLine(W.base.se) : '');
    const list = W.opts.filter(o => on.has(o.id)), x = wifRun(m.st, m.fc.R, list);
    if (x.over) return `Вместе выходит ${C.num1(x.over)} ч в неделю, это выше твоего потолка ${x.cap} ч. Такой план не считаю.`;
    const unsure = list.some(o => o.unsure), e = wifEffect(W.base, x, { unsure, noTag: true }), dl = m.st.set.deadline, late = x.goal && dl ? C.isoDiff(dl, x.goal) : 0;
    // цель появилась только вместе: дата одна, без «успеешь к» с той же датой
    return (x.goal ? `Вместе: цель <b>${C.dateLong(x.goal)}</b>${W.base.goal ? ', ' + e.t : late > 0 ? ', позже срока на ' + days(late) : ''}.` : e.t ? `Вместе: до цели пока не доходит, ${e.t}.` : 'Вместе: до цели пока не доходит.')
      + (unsure ? ' Это прикидка: про 12 ч с 07 до 21 данных мало.' : '') + (x.se ? ' ' + seLine(x.se) : '');
  }
  // что двигает цель кроме часов: одна строка для Главной и Пути из тех вариантов Что если, что правда приближают цель
  // или прибавляют денег к сроку, от самого сильного. Газ не рычаг: Яндекс Про в Астане проверяет машину без ГБО
  function levers(m) {
    if (pastDl(m.st)) return '';
    const W = wifCalc(m), and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a[0] || '';
    const list = W.opts.map((o, i) => ({ o, x: W.runs[i], e: W.eff[i] })).filter(v => v.e.up === true).sort((a, b) => (b.x.na || 0) - (a.x.na || 0));
    return list.length ? nb('Помогут ' + and(list.map(v => v.o.short + (v.o.unsure ? ' (данных мало)' : ''))) + '.') : '';
  }
  // когда по прогнозу кончатся деньги: первый месяц с минусом на руках (или уже сейчас)
  const runOut = fc => fc.s0.cash < 0 ? C.mkOf(fc.s0.iso) : (fc.rows.find(r => r.cash < 0) || {}).mk || null;
  // когда до срока деньги уходят в минус после старта: со своей машиной (negOwn) или на аренде без машины в плане
  const negBy = m => { const g = m.st.set, n = m.fc.negOwn || (!g.carFrom ? runOut(m.fc) : null); return n && (!g.deadline || n <= C.mkOf(g.deadline)) ? n : null; };
  // со своей машиной прогноз держит запас startBuf, но если до срока деньги всё равно уходят в минус, говорим когда
  const negOwnT = m => {
    const n = m.fc.negOwn, dl = m.st.set.deadline, buf = m.st.set.startBuf || 0;
    if (C.phaseAt(m.st, TODAY) === 'own' && m.fc.s0.cash < 0) return ' ' + nb(buf > 0 ? `Деньги уже в минусе: запаса ${C.money(buf)} не хватило.` : 'Деньги уже в минусе.');
    return n && (!dl || n <= C.mkOf(dl)) ? ' ' + nb(`Деньги уйдут в минус ${inMonth(n)}` + (buf > 0 ? `: запаса ${C.money(buf)} не хватит.` : '.')) : '';
  };
  // план ломается: цели нет, прогноз так и не купил машину по плану, и деньги уходят в минус. Месяц, когда кончаются деньги
  const brokenAt = m => !m.fc.goal && m.fc.warn && m.st.set.carFrom && !m.fc.bought ? runOut(m.fc) : null;
  // своя машина по плану: сколько нужно на покупку (взнос и оформление в ценах месяца покупки). Дата прошла: месяц, когда прогноз
  // её не купил, или сегодня
  function carNeed(m) {
    const g = m.st.set, w = m.fc.warn, past = g.carFrom < TODAY, mk = past ? (w ? w.mk : C.mkOf(TODAY)) : C.mkOf(g.carFrom);
    return { date: past ? null : g.carFrom, need: C.startCost(g, mk) };
  }
  function forecastCard(m) {
    const st = m.st, dl = st.set.deadline;
    if (m.na >= m.target) return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Цель есть</div><div class="fc-sub">${C.money(m.na)} активов. Дальше Отбасы и квартира.</div></section>`;
    if (!m.fc.goal) {
      // нехватку на машину не зовём взносом: отдельно, когда кончатся деньги и сколько нужно на покупку. Если прогноз так и не купил
      // машину, план ломается: годы растущего минуса не показываем
      const w = m.fc.warn, ex = m.need.extra, out = runOut(m.fc), lv = levers(m);
      let why = `При таком плане до ${C.money(m.target)} не дойти.`, broken = false;
      // без машины в плане деньги на аренде кончаются до срока: называем месяц
      if (!st.set.carFrom && out && (!dl || out <= C.mkOf(dl))) why += ` Деньги кончатся ${inMonth(out)}.`;
      if (w && st.set.carFrom) {
        const c = carNeed(m), carT = `На машину${c.date ? ' ' + C.dateLong(c.date) : ''} нужно около ${C.money(r1k(c.need))}: взнос, страховки, регистрация и первое ТО.`;
        if (!m.fc.bought) {
          // копит ли аренда: в среднем по месяцам аренды в прогнозе после жизни в плюсе или нет
          broken = true;
          const rr = m.fc.rows.filter(r => r.ph === 'rent'), saves = rr.length > 0 && rr.reduce((a, r) => a + r.free, 0) / rr.length > 0;
          const tail = saves ? ', а на аренде копится слишком медленно' : ', а на аренде они не копятся';
          why = (m.fc.s0.cash < 0 ? `Деньги уже в минусе${tail}.`
            : out && (!dl || out <= C.mkOf(dl)) ? `План ломается ${inMonth(out)}: деньги кончаются${st.set.taxiFrom && out < C.mkOf(st.set.taxiFrom) ? ' ещё до такси' : ''}${tail}.`
            : saves ? 'На аренде копится слишком медленно: к сроку на машину не хватает.' : 'На аренде деньги почти не копятся, и на машину не накопить.') + ' ' + carT;
        }
        else why = `Своя машина выйдет только ${inMonth(m.fc.bought)}. ` + carT + (out ? ` Деньги кончатся ${inMonth(out)}.` : '');
      }
      const how = ex ? ` С +${C.num1(ex)} ч в неделю машина будет, и к сроку успеваешь.` : lv ? ' ' + lv : '';
      return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Пока не доходит</div><div class="fc-sub">${nb(why)}${negOwnT(m)}${how}</div>${broken ? '' : rangeLine(m)}${wifBlock(m)}</section>`;
    }
    const g = m.fc.goal.iso, diff = C.isoDiff(g, dl), late = diff < 0, span = Math.max(C.isoDiff(TODAY, dl), C.isoDiff(TODAY, g), 1);
    const pf = Math.max(0, Math.min(100, C.isoDiff(TODAY, g) / span * 100)), pd = Math.max(0, Math.min(100, C.isoDiff(TODAY, dl) / span * 100));
    const ex = m.need.extra, lv = late && ex === null ? levers(m) : '';
    const sub = late ? `Позже срока на <b class="down">${days(-diff)}</b>.` + (ex ? ` Чтобы успеть, добавь <b class="down">${C.num1(ex)} ч в неделю</b>.` : ex === null ? (m.need.capped ? '' : ' Одних часов мало.') + (lv ? ' ' + lv : '') : '')
      : diff === 0 ? 'Ровно в срок.' : `На <b>${days(diff)}</b> раньше срока.`;
    return `<section class="card"><div class="over">Прогноз цели</div>
      <div class="fc-date">${C.dateLong(g)}</div><div class="fc-sub">${sub}${negOwnT(m)}</div>${rangeLine(m)}
      <div class="tl"><div class="tl-track"></div><div class="tl-done" style="width:${pf.toFixed(1)}%"></div>
        <div class="tl-fl${late ? ' late' : ''}" style="left:${Math.max(8, Math.min(92, pf)).toFixed(1)}%">прогноз</div><div class="tl-dot" style="left:0"></div>
        <div class="tl-end" style="left:${pd.toFixed(1)}%"></div><div class="tl-dot ${late ? 'late' : 'fc'}" style="left:${pf.toFixed(1)}%"></div></div>
      <div class="tl-lab"><span>Сегодня</span><span>Срок ${C.dateLong(dl)}</span></div>${wifBlock(m)}</section>`;
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
  // в листе прибора карточка не ссылка на Смены: лист закрывает экран, переход за ним не виден
  function weekCard(m, inSheet) {
    const st = m.st, mon = C.monday(TODAY), wk = C.weekStats(st, TODAY, m.fc, TODAY), planAll = weekPlan(st, mon), closed = planAll > 0 && wk.fact >= planAll;
    const body = `<div class="wk-h"><div><div class="over">Эта неделя</div><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div></div>
      <div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      ${weekSegs(st, mon)}
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : `До закрытия недели ещё <b>${C.num1(Math.max(0, planAll - wk.fact))} ч</b>`}</span>${st.reload && st.reload[mon] && st.reload[mon].kind !== 'snooze' ? `<span class="chip green">${ic('battery')}лёгкая неделя</span>` : planAll > 0 ? xpChip(XPN().week, closed) : ''}</div>`;
    return inSheet ? `<section class="card">${body}</section>` : `<button class="card tap block" data-a="tab" data-tab="shifts">${body}</button>`;
  }
  function questsPreview(m) {
    const Q = G.quests(m.st, TODAY, m.fc).open.slice(0, 3);
    if (!Q.length) return '';
    return `<div class="sec-h"><div class="h3">Задания</div><button class="link" data-a="tab" data-tab="path">Все ${ic('right')}</button></div>
      <section class="card">${Q.map(q => questRow(q, true)).join('')}</section>`;
  }
  // ближе всего к получению: награды с наибольшим прогрессом
  function nearBadges(pl) {
    const got = pl.badges.filter(b => b.on).length;
    // длинные смены (13 и 15 ч) не подталкиваем: к 12-му часу риск происшествий выше. Получить их можно, но сюда они не попадают
    const push = b => !b.on && b.id !== 'long-13' && b.id !== 'long-15';
    const near = pl.badges.filter(b => push(b) && b.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
    const list = near.length ? near : pl.badges.filter(push).slice(0, 3);
    return `<div class="sec-h"><div class="h3">Ближе всего</div><button class="link" data-a="tab" data-tab="me">${got} из ${pl.badges.length} наград ${ic('right')}</button></div>
      <section class="card">${list.map(b => `<button class="nb" data-a="badge" data-id="${b.id}">${D.medal(b.icon, b.color || 'violet', true, 38)}<div><div class="nb-t"><b>${esc(b.title)}</b>${xpChip(b.xp)}</div>
        <div class="pbar"><i style="width:${(b.pct * 100).toFixed(1)}%"></i></div><div class="nb-s">${esc(b.hint.split('. ')[0])}: ${progText(b)}</div></div></button>`).join('')}</section>`;
  }
  const progText = b => b.need >= 1e6 ? C.num1(Math.floor(b.cur / 1e4) / 100) + ' из ' + C.num1(b.need / 1e6) + ' млн ₸' : b.need >= 1e4 ? Math.round(b.cur / 1000) + ' из ' + Math.round(b.need / 1000) + ' тыс. ₸' : C.grp(Math.round(b.cur)) + ' из ' + C.grp(b.need);
  function notes(m) {
    const est = m.est;
    let out = '';
    if (est && est.missed) out += `<button class="card tap block" data-a="tab" data-tab="shifts"><div class="praise warn" style="margin:0"><div class="praise-i">${ic('cal')}</div><div class="praise-b"><div class="praise-t">Не внесены смены за ${days(est.missed)}</div><div class="praise-s">Внеси, чтобы прогноз и опыт были точными.</div></div></div></button>`;
    if (est && C.isoDiff(est.from, TODAY) > 14) out += `<button class="card tap block" data-a="money-edit"><div class="praise green" style="margin:0"><div class="praise-i">${ic('wallet')}</div><div class="praise-b"><div class="praise-t">Сверь деньги</div><div class="praise-s">Последняя сверка ${C.dateShort(est.from)}. Запиши, сколько сейчас: загорятся плитки и прогноз станет точнее.</div></div></div></button>`;
    return out;
  }

  // ---------------------------------------------------------------- смены
  function vShifts() {
    refresh();
    const st = S(), fc = C.forecast(st, TODAY), mon = C.isoAdd(C.monday(TODAY), UI.week * 7), pl = playerOf(st, TODAY);
    const ds = Array.from({ length: 7 }, (_, i) => C.isoAdd(mon, i));
    if (!UI.sel || UI.sel < mon || UI.sel > ds[6]) { UI.sel = ds.indexOf(TODAY) >= 0 ? TODAY : ds[0]; UI.dh = null; UI.dapp = ''; UI.dord = ''; }
    const wk = C.weekStats(st, mon, fc, TODAY), mk = C.mkOf(UI.week === 0 ? TODAY : mon), mo = C.monthStats(st, mk, fc, TODAY), planAll = weekPlan(st, mon);
    // своя выручка за 30 дней на той машине, что сейчас (как на Цифрах): цифра за 12 ч против порогов месяца по модели,
    // уровень без сезона, разгона новичка и роста против вероятных 2 900, а сама оплата пассажиров как есть.
    // mrF: все смены такси за 120 дней, по ним считает прогноз
    const phT = C.phaseAt(st, TODAY), taxiNow = phT !== 'pre', mrF = taxiNow ? C.measuredR(st, TODAY, 120) : null, mr = taxiNow ? C.measuredR(st, TODAY, 29, phT) : null;
    // цифра за 12 ч та же, что на Цифрах: смены этой машины за 30 дней в ценах этого месяца, средняя по часам (shiftStats)
    const zs = mr && mr.n >= 3 ? C.shiftStats(st, TODAY).zones : null, a12 = zs && zs.avg != null ? zs.avg : null, Z = a12 ? zs.Z : null, sc = a12 ? C.scenarioOf(mr.R) : null;
    // сразу после покупки на своей смен ещё нет: только прикидка по прошлым сменам в этом месяце, без вывода по зонам
    const proj = !a12 && phT === 'own' && mrF && mrF.n >= 3 ? C.appPer12(st, TODAY, mrF.R * C.growth(st.set, C.mkOf(TODAY))[1] * C.seasonOf(st.set, C.mkOf(TODAY)), 'own') : null;
    const label = UI.week === 0 ? 'Эта неделя' : UI.week === -1 ? 'Прошлая неделя' : UI.week === 1 ? 'Следующая неделя' : 'Неделя';
    const closed = planAll > 0 && wk.fact >= planAll && ds[6] < TODAY;
    const preNow = !st.set.taxiFrom || TODAY < st.set.taxiFrom, tplKey = preNow ? 'preTpl' : 'tpl', tpl = st.set[tplKey] || [];
    return `
    <header class="top"><div><div class="top-k">Смены</div><h1 class="top-t top-fit">${label}</h1></div><div class="top-r">${streakPill(pl)}</div></header>
    <section class="card">
      <div class="between"><div class="over">${+mon.slice(8)}${mon.slice(5, 7) !== ds[6].slice(5, 7) ? ' ' + C.dateShort(mon).split(' ')[1] : ''}-${C.dateShort(ds[6])}</div>
        <div class="top-r"><button class="icon-btn" data-a="week" data-v="-1" aria-label="Неделя назад">${ic('left')}</button><button class="icon-btn" data-a="week" data-v="1" aria-label="Неделя вперёд">${ic('right')}</button></div></div>
      <div class="wk-h"><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div><div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      <div class="bars">${ds.map(d => barCol(st, d)).join('')}</div>
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : planAll > 0 ? `До закрытия недели ещё ${C.num1(Math.max(0, planAll - wk.fact))} ч` : 'Неделя без плана'}</span>${planAll > 0 ? xpChip(XPN().week, closed) : ''}</div>
    </section>
    ${dayPanel(st, UI.sel, fc)}
    ${UI.week === 0 ? bossCard(pl) : ''}
    <section class="card"><div class="over">${cap(C.MON[+mk.slice(5) - 1])}</div>${statsBlock(mo)}${seNote(st, mk)}
      <button class="row-btn st-more" data-a="stats">${ic('chart')}<span>Все цифры</span>${ic('right')}</button></section>
    ${a12 ? revCard(st, mr, mrF, a12, Z, sc) : proj ? `<section class="card"><div class="over">Твоя выручка в такси</div>
      <p class="lead">${mr && mr.n > 0 ? `На своей машине пока ${mr.n} ${C.plural(mr.n, ['смена', 'смены', 'смен'])}.` : 'На своей машине смен пока нет.'} По прошлым сменам на ней было бы около <b>${C.money(Math.round(proj / 100) * 100)}</b> за 12 ч.</p></section>` : ''}
    <section class="card"><div class="over">${preNow ? 'Обычная неделя подработки' : 'Обычная неделя такси'}</div>
      <div class="tpl">${C.DOW.map((n, i) => `<button class="tpl-d${tpl[i] ? '' : ' off'}" data-a="tpl" data-i="${i}" data-k="${tplKey}"><span>${n}</span><b>${tpl[i] ? C.num1(tpl[i]) : ic('moon')}</b></button>`).join('')}</div>
      <div class="sub">Нажми на день, чтобы поменять часы. Разовый выходной или смену ставь на конкретный день выше.</div></section>`;
  }
  // что значит цифра за 12 ч по порогам месяца: на аренде, на своей с Kaspi и после кредита.
  // Совет про свою машину только после 4 недель смен: раньше твой уровень ещё не виден (исследование 18.11)
  const ZONE_SAY = {
    rent: { g: 'можно класть 150 000 в месяц в Отбасы даже на аренде', y: 'после жизни в плюсе, но на 150 000 в Отбасы не хватает', r: 'после жизни минус, про машину решишь после 4 недель смен', r4: 'после жизни минус, своя машина нужна как можно раньше' },
    loan: { g: 'хватает на Kaspi и 150 000 в месяц в Отбасы', y: 'после жизни и Kaspi плюс, но 150 000 в Отбасы пока не выходит', r: 'после жизни и Kaspi минус' },
    free: { g: 'можно класть 150 000 в месяц в Отбасы', y: 'после жизни плюс, но 150 000 в Отбасы пока не выходит', r: 'после жизни минус' },
  };
  const zoneSay = (st, kind, z) => kind === 'rent' && z === 'r' && weeks4(st) ? ZONE_SAY.rent.r4 : ZONE_SAY[kind][z];
  // 4 недели смен такси: с первой записанной смены прошло 4 недели и смен не меньше 10
  function weeks4(st) {
    let first = null, n = 0;
    for (const [d, x] of Object.entries(st.shifts)) if (d <= TODAY && x && x.h > 0 && C.phaseAt(st, d) !== 'pre') { n++; if (!first || d < first) first = d; }
    return !!first && n >= 10 && C.isoDiff(first, TODAY) >= 27;
  }
  const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a[0] || '';
  // чем смены за окно отличаются от летнего месяца опытного водителя: сезон, первые недели такси, рост выручки после июля 2027
  function adjWhy(st, days, car) {
    const g = st.set, from = C.isoAdd(TODAY, -days), ds = Object.keys(st.shifts).filter(d => d <= TODAY && d > from && st.shifts[d] && st.shifts[d].h > 0 && st.shifts[d].app > 0 && C.phaseAt(st, d) !== 'pre' && (!car || C.phaseAt(st, d) === car));
    const why = [ds.some(d => Math.abs(C.seasonOf(g, C.mkOf(d)) - 1) > 0.01) ? 'сезон' : '', ds.some(d => C.rampOf(g, d) < 1) ? 'первые недели' : '', ds.some(d => C.growth(g, C.mkOf(d))[1] > 1.015) ? 'рост цен' : ''].filter(Boolean);
    return andList(why.length ? why : ['сезон']);
  }
  // выручка в такси на Сменах: цифра за 12 ч и вывод по зоне месяца, оплата пассажиров в час как есть, а против вероятных 2 900
  // сравниваем уровень без сезона, разгона новичка и роста цен (как прогноз). Первые 2 месяца у новичка ниже, это нормально
  function revCard(st, mr, mrF, a12, Z, sc) {
    const g = st.set, newbie = g.ramp !== false && !!g.taxiFrom && C.isoDiff(g.taxiFrom, TODAY) < 60;
    const lvl = Math.abs(mr.R / mr.raw - 1) >= 0.03 ? `, с поправкой на ${adjWhy(st, 30, C.phaseAt(st, TODAY))} это ${sc.name}` : `: ${sc.name}`;
    const own = C.phaseAt(st, TODAY) === 'own' && mrF.n > mr.n;
    return `<section class="card"><div class="over">Твоя выручка в такси</div>
      <p class="lead">За 12 ч в приложении в среднем <b>${C.money(Math.round(a12 / 100) * 100)}</b>${Z && mr.n >= 10 ? ': ' + nb(zoneSay(st, Z.kind, C.zoneOf(Z, a12))) + '.' : '. Вывод будет с 10 смен.'}</p>
      <div class="sub">${nb(`Пассажиры платят ${C.money(Math.round(mr.raw / 10) * 10)} в час${lvl}.`)}${newbie ? ' Первые два месяца у новичка обычно ниже.' : ''} По ${mr.n} ${C.plural(mr.n, ['смене', 'сменам', 'сменам'])}${own ? ' на своей машине' : ''} за 30 дней.${g.rLog && mrF.n >= 10 ? ' Прогноз уже считается по твоим сменам с поправкой на сезон.' : ' С 10 смен прогноз начнёт считаться по ним.'}</div></section>`;
  }
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
      val = h === 0 ? '<span class="bar-v miss">0</span>' : future || d === TODAY ? `<span class="bar-v dim">${C.num1(p)}</span>` : '<span class="bar-v miss">?</span>';
    } else {
      const working = (st.set.preFrom && d >= st.set.preFrom) || (st.set.taxiFrom && d >= st.set.taxiFrom);
      col = working ? `<div class="bar-off">${ic('moon')}</div>` : '';
      val = `<span class="bar-v dim">${working ? 'вых' : '-'}</span>`;
    }
    return `<button class="bar${cls}" data-a="day" data-d="${d}" aria-label="${C.DOWL[C.dow(d)]} ${C.dateShort(d)}"><span class="bar-d">${C.DOW[C.dow(d)]}</span><div class="bar-col">${col}</div>${val}</button>`;
  }
  // панель выбранного дня: прошлое и сегодня вносим, будущее планируем
  const noteField = (st, d) => d > TODAY ? '' : `<label class="fld note-fld"><span>${ic('book')}Строчка в дневник</span><input id="p-note" data-day="${d}" maxlength="120" value="${esc(((st.diary || {})[d] || {}).text || '')}" placeholder="как прошёл день, одной фразой"></label>`;
  function dayPanel(st, d, fc) {
    const plan = C.planHours(st, d), x = st.shifts[d] || null, head = d === TODAY ? 'Сегодня, ' + C.DOWL[C.dow(d)] : cap(C.DOWL[C.dow(d)]) + ', ' + C.dateShort(d);
    const started = (st.set.preFrom && d >= st.set.preFrom) || (st.set.taxiFrom && d >= st.set.taxiFrom);
    if (d > TODAY) {
      if (!started) return `<section class="card"><div class="over">${esc(head)}</div><p class="lead">Работа начнётся ${st.set.preFrom ? C.dateLong(st.set.preFrom) + ' (подработка)' : C.dateLong(st.set.taxiFrom)}. Даты можно поменять в Профиле, в настройках.</p></section>`;
      return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('cal')}</div><div><div class="over">${esc(head)}</div><div class="today-t">План: ${plan > 0 ? C.num1(plan) + ' ч' : 'выходной'}</div></div></div>
        <div class="quick">${[0, 6, 8, 10, 11, 12, 13, 14, 15, 16].map(h => `<button class="q${plan === h ? ' sel' : ''}${h ? '' : ' wide'}" data-a="set-plan" data-d="${d}" data-h="${h}">${h ? h + '<small>ч</small>' : 'вых'}</button>`).join('')}</div>
        ${st.over[d] != null ? `<div class="btns"><button class="btn ghost" data-a="clear-plan" data-d="${d}">Как обычно</button></div>` : ''}</section>`;
    }
    if (!started) return `<section class="card"><div class="over">${esc(head)}</div><p class="lead">${st.set.preFrom ? 'Подработка начнётся ' + C.dateLong(st.set.preFrom) : st.set.taxiFrom ? 'Первая смена ' + C.dateLong(st.set.taxiFrom) : 'Дата начала работы не задана'}. Даты можно поменять в Профиле, в настройках.</p></section>`;
    if (UI.dh == null && x) { UI.dh = +x.h; UI.dapp = x.app ? C.grp(x.app) : ''; UI.dord = x.orders ? String(x.orders) : ''; }
    const h = UI.dh, base = plan > 0 ? [0, 6, plan, plan + 3] : [0, 6, 8, 12];
    const opts = base.filter((v, i) => base.indexOf(v) === i).sort((a, b) => a - b), own = h != null && opts.indexOf(h) < 0;
    const name = workName(st, d) === 'Смена' ? 'в такси' : 'на доставке';
    return `<section class="card"><div class="today-top"><div class="ibox">${ic('wheel')}</div><div><div class="over">${esc(head)} · ${plan > 0 ? 'план ' + C.num1(plan) + ' ч' : 'выходной'}</div><div class="today-t">Сколько отработал?</div></div></div>
      <div class="quick">${opts.map(v => `<button class="q${v === plan && plan > 0 ? ' plan' : ''}${h === v ? ' sel' : ''}" data-a="dh" data-h="${v}">${v}<small>ч</small></button>`).join('')}
        <button class="q own${own ? ' sel' : ''}" data-a="dh-own">${own ? C.num1(h) + ' ч' : 'своё'}</button></div>
      <label class="fld" id="own-h" ${own ? '' : 'hidden'}><span>Часов</span><input inputmode="decimal" id="p-h" value="${h != null ? C.num1(h) : ''}" placeholder="например 13,5"></label>
      <div class="fld2"><label class="fld"><span>Заработал ${name}, ₸</span><input inputmode="numeric" id="p-app" value="${esc(UI.dapp)}" placeholder="сумма за день"></label>
        <label class="fld"><span>Заказов</span><input inputmode="numeric" id="p-ord" value="${esc(UI.dord)}" placeholder="0"></label></div>
      <div class="preview" id="pv">${previewHtml(st, d, fc)}</div>
      <div class="btns"><button class="btn" data-a="save-day" data-d="${d}" ${h == null ? 'disabled' : ''}>${ic('check')}Сохранить смену</button></div>
      ${x ? `<button class="btn danger" data-a="del-log" data-d="${d}">${ic('trash')}Удалить запись</button>` : ''}
      ${noteField(st, d)}</section>`;
  }
  function previewHtml(st, d, fc) {
    const h = UI.dh;
    if (h == null) return '';
    const app = num0(UI.dapp), ord = num0(UI.dord), pv = G.preview(st, d, h, app, ord);
    return praiseBox(praiseOf(st, d, fc, { h, app }), pv.xp) + (pv.parts.length > 1 ? `<div class="xp-parts">${pv.parts.map(([t, v]) => `<span>${t}${v ? ' +' + C.grp(Math.round(v)) : ''}</span>`).join('')}</div>` : '');
  }
  function statsBlock(x) {
    const dd = Math.abs(x.days) >= 0.05 ? (x.days > 0 ? '+' : '−') + C.daysText(Math.abs(x.days)) : 'по плану';
    return `<div class="kv"><div><span>Часы</span><b>${C.num1(x.fact)} <small>из ${C.num1(x.plan)}</small></b></div>
      <div><span>В приложении</span><b>${C.money(x.app)}</b></div>
      <div><span>За час в приложении</span><b>${x.perHour ? C.money(x.perHour) : '-'}</b></div>
      <div><span>${x.days < -0.05 ? 'Цель дальше' : 'Цель ближе'}</span><b class="${x.days > 0.05 ? 'up' : x.days < -0.05 ? 'down' : ''}">${dd}</b></div></div>`;
  }

  // ---------------------------------------------------------------- деньги
  // сколько сейчас по частям: отметка + переводы после неё + оценка смен (в деньгах)
  // из чего сейчас активы: так же, как старт прогноза (кредит по графику, машина с износом)
  function nowParts(st) {
    const s0 = C.startState(st, TODAY);
    return { cash: s0.cash, otb: s0.otb, car: s0.car, loan: s0.loan };
  }
  // «в марте 2029»
  const inMonth = mk => 'в ' + C.MON[+mk.slice(5) - 1].replace(/ь$/, 'е').replace(/й$/, 'е').replace(/т$/, 'те') + ' ' + mk.slice(0, 4);
  const r1k = v => Math.round(v / 1000) * 1000;
  // ---------------------------------------------------------------- своя машина
  function carMoneyCard(m) {
    const st = m.st, g = st.set, c = st.car;
    if (!c) {
      // до покупки: напоминание записать машину, когда она близко
      const near = C.phaseAt(st, TODAY) === 'rent' || (g.carFrom && C.isoDiff(TODAY, g.carFrom) <= 45);
      if (!near) return '';
      return `<section class="card"><div class="between"><div><div class="over">Своя машина</div><div class="h3">${g.carFrom ? 'По плану с ' + C.dateLong(g.carFrom) : 'Пока аренда'}</div></div>${xpChip(G.QUEST_XP.car, !!st.done.car)}</div>
        <p class="sub">Купил? Запиши модель, цену и кредит. Прогноз пойдёт по твоему платежу, а здесь будет видно, как гасишь кредит.</p>
        <div class="btns"><button class="btn" data-a="car-buy">${ic('car')}Купил машину</button></div></section>`;
    }
    const lp = C.loanPlan(st, TODAY), now = nowParts(st), mk = TODAY.slice(0, 7);
    const fuel = g.fuel === 'gas' && (!g.gasFrom || g.gasFrom <= TODAY) ? 'gas' : 'petrol', F = C.growth(g, mk)[0];
    const fm = C.fuelMonth(g, mk)[fuel];
    let loan = '';
    if (lp) {
      const pct = Math.max(0, Math.min(100, Math.round((lp.sum - lp.bal) / lp.sum * 100)));
      const saved = Math.max(0, lp.int0 - lp.intPaid - lp.intLeft), early = lp.end && lp.end0 ? C.mkDiff(C.mkOf(lp.end), C.mkOf(lp.end0)) : 0;
      loan = `<div class="loan"><div class="between"><span class="over">Кредит</span>${lp.bal > 0 ? `<span class="chip yellow">осталось ${C.money(Math.round(lp.bal))}</span>` : `<span class="chip green">${ic('check')}закрыт</span>`}</div>
        <div class="pbar loan-bar"><i style="width:${pct}%"></i></div>
        <div class="sub">Погашено ${C.money(Math.round(lp.sum - lp.bal))} из ${C.money(lp.sum)}, это ${pct}%.</div>
        ${lp.bal > 0 ? `<div class="kv"><div><span>Платёж в месяц</span><b>${C.money(Math.round(lp.pay))}</b></div><div><span>Следующий</span><b>${C.dateShort(lp.next)}</b></div></div>
          <div class="sub">Закроешь ${inMonth(C.mkOf(lp.end))}, ещё ${lp.left} ${C.plural(lp.left, ['платёж', 'платежа', 'платежей'])}. Проценты впереди около ${C.money(r1k(lp.intLeft))}.</div>`
        : `<p class="lead">Кредит закрыт ${C.dateLong(lp.closed)}. Машина полностью твоя.</p>`}
        ${early > 0 || saved >= 1000 ? `<div class="good-note">${ic('bolt')}<span>По договору закрыл бы ${inMonth(C.mkOf(lp.end0))}.${early > 0 ? ` Сейчас на ${early} ${C.plural(early, ['месяц', 'месяца', 'месяцев'])} раньше, процентов` : ' Процентов'} меньше примерно на ${C.money(r1k(saved))}.${lp.extra > 0 ? ` Досрочно записано ${C.money(lp.extra)}.` : ''}</span></div>` : ''}
        ${lp.bal > 0 ? `<div class="btns"><button class="btn" data-a="payoff">${ic('bolt')}Погасить досрочно</button></div>` : ''}</div>`;
    }
    return `<section class="card"><div class="between"><div><div class="over">Моя машина</div><div class="h3">${esc(c.name)}</div></div><button class="link" data-a="car-edit">${ic('gear')}Изменить</button></div>
      <div class="sub">Куплена ${C.dateLong(c.on)}, ${c.loan ? 'в кредит' : 'за наличные'}. Стоит сейчас около ${C.money(r1k(now.car))}.</div>
      ${loan}
      <div class="sub">Расход в среднем ${C.num1(g.l100)} л на 100 км, зимой больше, ${fuel === 'gas' ? 'газ' : 'бензин'} ${C.money(Math.round((fuel === 'gas' ? g.gas : g.petrol) * F))} за литр. Топливо по плану месяца около ${C.money(r1k(fm))}.</div></section>`;
  }
  // аренда или своя: по твоим сменам за 30 дней, только пока ездишь на аренде
  function rentOwnCard(m) {
    const st = m.st, g = st.set; if (st.car || C.phaseAt(st, TODAY) !== 'rent') return '';
    const r = C.rentVsOwn(st, TODAY); if (!r) return '';
    const preset = C.CARS.find(c => c.price === g.price && c.down === g.down), name = preset ? 'своей машине (' + preset.name + ')' : 'своей машине по плану', d = r1k(r.own) - r1k(r.rent); // разница из тех же округлённых сумм, что на экране
    return `<section class="card"><div class="between"><div class="over">Аренда или своя</div><span class="link">по ${r.n} ${C.plural(r.n, ['смене', 'сменам', 'сменам'])} за 30 дней</span></div>
      <div class="kv"><div><span>На аренде осталось</span><b class="${r.rent < 0 ? 'down' : ''}">${C.money(r1k(r.rent))}</b></div><div><span>На своей было бы</span><b class="${d > 0 ? 'up' : ''}">${C.money(r1k(r.own))}</b></div></div>
      <p class="sub">${d > 0 ? `На ${esc(name)} за те же смены оставалось бы на <b class="up">${C.money(r1k(d))}</b> больше${r.pay > 0 ? `, уже после платежа по кредиту` : ''}. И машина остаётся твоей.${weeks4(st) ? '' : ' Но решай после 4 недель смен.'}` : `Пока аренда не хуже своей машины${r.pay > 0 ? ` с платежом ${C.money(r1k(r.pay))} в месяц` : ''}: можно не спешить.`} ${nb(`На машину нужно около ${C.money(r1k(r.start))}: взнос, страховки, регистрация и первое ТО.`)}</p></section>`;
  }
  // покупка или правка своей машины
  function carSheet() {
    const st = S(), g = st.set, c = st.car, L = c && c.loan, F = C.growth(g, TODAY.slice(0, 7))[0];
    UI.carHow = c ? (L ? 'loan' : 'cash') : 'loan'; UI.carFuel = g.fuel === 'gas' ? 'gas' : 'petrol'; UI.ccTouched = false;
    const fp = k => Math.round(g[k] * F);
    sheet(`<div class="sh-t">${c ? 'Моя машина' : 'Купил машину'}</div><div class="sh-s">${c ? 'Поправь, если что-то не так: прогноз пересчитается.' : 'Прогноз пойдёт по твоей машине и твоему платежу.'}</div>
      <label class="fld"><span>Модель</span><input id="f-cn" maxlength="40" value="${esc(c ? c.name : '')}" placeholder="например, ВАЗ 2110"></label>
      <div class="fld2"><label class="fld"><span>Цена покупки, ₸</span><input inputmode="numeric" id="f-cp" value="${fmtIn(c ? c.price : 0)}"></label>
        <label class="fld"><span>Дата покупки</span><input type="date" id="f-con" value="${c ? c.on : TODAY}" max="${TODAY}"></label></div>
      <div class="fld"><span>Как купил</span><div class="segm">${[['cash', 'за наличные'], ['loan', 'в кредит']].map(([x, n]) => `<button data-a="car-how" data-v="${x}" aria-pressed="${UI.carHow === x}">${n}</button>`).join('')}</div></div>
      <div id="car-loan"${UI.carHow === 'loan' ? '' : ' hidden'}>
        <div class="fld2"><label class="fld"><span>Сумма кредита, ₸</span><input inputmode="numeric" id="f-cls" value="${fmtIn(L ? L.sum : 0)}" placeholder="из договора"></label>
          <label class="fld"><span>Срок, месяцев</span><input inputmode="numeric" id="f-clm" value="${L ? L.months : ''}" placeholder="36"></label></div>
        <div class="fld2"><label class="fld"><span>Платёж в месяц, ₸</span><input inputmode="numeric" id="f-clp" value="${fmtIn(L ? L.pay : 0)}" placeholder="из графика"></label>
          <label class="fld"><span>Первый платёж</span><input type="date" id="f-clf" value="${L && L.first ? L.first : C.addMonths(c ? c.on : TODAY, 1)}"></label></div>
        <div class="sub" id="car-calc"></div></div>
      <div class="fld"><span>Топливо</span><div class="segm">${[['petrol', 'бензин'], ['gas', 'газ']].map(([x, n]) => `<button data-a="car-fuel" data-v="${x}" aria-pressed="${UI.carFuel === x}">${n}</button>`).join('')}</div><p class="sub" id="f-gas-n"${UI.carFuel === 'gas' ? '' : ' hidden'}>${GAS_NOTE}</p></div>
      <div class="fld2"><label class="fld"><span>Расход в среднем за год, л на 100 км</span><input inputmode="decimal" id="f-cl" value="${C.num1(g.l100)}"></label>
        <label class="fld"><span id="f-cf-l">Литр ${UI.carFuel === 'gas' ? 'газа' : 'бензина'}, ₸</span><input inputmode="numeric" id="f-cf" data-petrol="${fp('petrol')}" data-gas="${fp('gas')}" value="${fmtIn(fp(UI.carFuel))}"></label></div>
      <label class="fld"><span>Примерная цена продажи через 3 года, ₸</span><input inputmode="numeric" id="f-cv" value="${fmtIn(c ? c.v36 : 0)}"></label>
      ${c ? '' : `<label class="fld"><span>Денег осталось после покупки, ₸</span><input inputmode="numeric" data-neg="1" id="f-cc"></label><div class="sub" id="f-cc-n"></div>`}
      <div class="btns"><button class="btn" data-a="save-car">${ic('check')}Сохранить</button></div>
      ${c ? `<button class="btn ghost" data-a="car-del">${ic('trash')}Удалить запись о машине</button>` : ''}`);
    carCalc();
  }
  const cv = id => num0(($('#' + id) || {}).value);
  // живые подсказки в листе машины: ставка по платежу, деньги после покупки, цена через 3 года
  function carCalc() {
    const st = S(), g = st.set, price = cv('f-cp'), sum = cv('f-cls'), pay = cv('f-clp'), n = Math.round(cv('f-clm')), loan = UI.carHow === 'loan';
    const box = $('#car-calc');
    if (box) box.textContent = !(sum > 0 && pay > 0 && n > 0) ? 'Впиши сумму, срок и платёж из договора: ставку посчитаю сам.'
      : pay * n < sum ? 'Платёж за весь срок меньше суммы кредита: проверь цифры.'
      : `Ставка выходит около ${C.num1(Math.round(C.loanRate(sum, pay, n) * 12000) / 10)}% годовых, переплата за весь срок около ${C.money(r1k(pay * n - sum))}.${price > sum ? ` Взнос ${C.money(price - sum)}.` : ''}`;
    const v = $('#f-cv'); if (v) v.placeholder = price > 0 ? 'около ' + C.grp(Math.round(price * 0.75 / 10000) * 10000) : 'три четверти цены';
    const cc = $('#f-cc'), note = $('#f-cc-n');
    if (cc) {
      const on = ($('#f-con') || {}).value || TODAY, last = C.lastMoney(st, TODAY), F = C.growth(g, TODAY.slice(0, 7))[0];
      const costs = (g.ogpo + g.osgop + g.regFee + g.diag + (g.buyOther || 0)) * F, cash = nowParts(st).cash, paid = loan ? Math.max(0, price - sum) : price;
      const counted = last && last.d >= on; // сверка после покупки уже знает про трату
      if (!UI.ccTouched) cc.value = fmtIn(r1k(cash - (counted ? 0 : paid + costs)));
      if (note) note.textContent = counted ? `Подставил деньги по последней сверке: около ${C.money(r1k(cash))}. Поправь, сколько на самом деле.`
        : `Подставил: сейчас около ${C.money(r1k(cash))}, минус ${loan ? 'взнос' : 'цена'} и оформление (страховки, регистрация, диагностика, первое ТО) около ${C.money(r1k(costs))}. Поправь, сколько на самом деле.`;
    }
  }
  // досрочное гашение
  function payoffSheet() {
    const lp = C.loanPlan(S(), TODAY); if (!lp || !(lp.bal > 0)) return;
    UI.payMode = UI.payMode || 'term';
    sheet(`<div class="sh-t">Погасить досрочно</div><div class="sh-s">Остаток ${C.money(Math.round(lp.bal))}. Деньги уходят с карты в кредит: активы те же, а процентов дальше меньше.</div>
      <label class="fld"><span>Сколько, ₸</span><input inputmode="numeric" id="f-pa" autofocus></label>
      <div class="fld"><span>Что уменьшить</span><div class="segm">${[['term', 'срок'], ['pay', 'платёж']].map(([x, n]) => `<button data-a="pay-mode" data-v="${x}" aria-pressed="${UI.payMode === x}">${n}</button>`).join('')}</div></div>
      <div class="preview" id="f-ppv"></div>
      <div class="sub">Сама досрочка делается в приложении банка, там же выбираешь срок или платёж. Меньше срок экономит больше процентов, меньше платёж даёт запас на слабые месяцы.</div>
      <div class="btns"><button class="btn" data-a="save-payoff">${ic('check')}Записать</button></div>`);
    payoffCalc();
  }
  function payoffCalc() {
    const el = $('#f-ppv'); if (!el) return;
    const st = S(), now = C.loanPlan(st, TODAY); if (!now) return;
    const amt = Math.min(cv('f-pa'), Math.round(now.bal)), cash = nowParts(st).cash;
    if (!(amt > 0)) { el.innerHTML = `<div class="sub">Сейчас платёж ${C.money(Math.round(now.pay))}, закроешь ${inMonth(C.mkOf(now.end))}.</div>`; return; }
    const b = C.payoffPreview(st, TODAY, amt, UI.payMode).next, saved = r1k(Math.max(0, now.intLeft - b.intLeft)), early = C.mkDiff(C.mkOf(b.end), C.mkOf(now.end));
    el.innerHTML = `<div class="pv-b">${b.bal <= 0 ? `Кредит закроется полностью. Процентов не будет примерно на ${C.money(saved)}.`
      : UI.payMode === 'term' ? `Закроешь ${inMonth(C.mkOf(b.end))}${early > 0 ? `, на ${early} ${C.plural(early, ['месяц', 'месяца', 'месяцев'])} раньше` : ''}. Процентов меньше примерно на ${C.money(saved)}.`
      : `Платёж станет ${C.money(Math.round(b.pay))} вместо ${C.money(Math.round(now.pay))}. Процентов меньше примерно на ${C.money(saved)}.`}</div>
      ${amt > cash ? `<div class="sub warn-t">По оценке на карте сейчас около ${C.money(r1k(cash))}. Если денег меньше, сначала сверь.</div>` : ''}`;
  }
  function vMoney() {
    const m = model(), st = m.st, last = C.lastMoney(st, TODAY), est = m.est, now = nowParts(st);
    const parts = last ? [['Деньги', now.cash, 'var(--green)'], ['Отбасы', now.otb, 'var(--blue)'], ['Машина', now.car, 'var(--yellow)'], ['Кредит', -now.loan, 'var(--coral)']] : [];
    const tot = parts.reduce((s, p) => s + Math.abs(p[1]), 0);
    const loanFill = 'repeating-linear-gradient(135deg,rgba(255,120,103,.95) 0 3px,rgba(255,120,103,.35) 3px 7px)';
    const ad = est ? est.adds.cash + est.adds.otb - (est.adds.loan || 0) : 0; // переводы в Отбасы и в кредит активы не меняют
    return `
    <header class="top"><div><div class="top-k">Деньги</div><h1 class="top-t">Активы для цели</h1></div></header>
    <section class="card"><div class="over">Сейчас примерно</div><div class="money-top"><div class="num">${moneyHtml(m.na)}</div></div>
      ${tot > 0 ? `<div class="as-bar">${parts.filter(p => p[1] !== 0).map(p => `<i style="flex:${(Math.abs(p[1]) / tot).toFixed(4)};background:${p[1] < 0 && p[0] === 'Кредит' ? loanFill : p[2]}"></i>`).join('')}</div>` : ''}
      <ul class="as-list">${parts.map(([n, v, c]) => `<li class="${v < 0 ? 'neg' : ''}${n === 'Отбасы' ? ' tap' : ''}"${n === 'Отбасы' ? ' data-a="locks" role="button" tabindex="0"' : ''}><span><i style="--c:${c}"></i>${n}${n === 'Отбасы' ? ic('lock') : ''}</span><b>${C.money(v)}</b></li>`).join('')}</ul>
      ${est && (est.add || ad) ? `<div class="as-note">По сверке ${C.dateShort(est.from)}: ${C.money(C.naOf(last))}.${ad ? ` Запланированные траты и переводы после неё: ${C.money(ad, true)}.` : ''}${est.add ? ` Смены за вычетом расходов на жизнь: примерно ${C.money(est.add, true)}.` : ''}</div>` : ''}
      <div class="btns"><button class="btn" data-a="otb-add">${ic('bank')}В Отбасы</button><button class="btn alt" data-a="money-edit">Сверить</button></div>
      <div class="as-note">Записывать каждую трату не надо: жизнь задаётся конвертами месяца. Раз в неделю или месяц нажми Сверить и впиши, сколько есть. Перевод в Отбасы: +${1 + G.rk(st, 'piggy')} XP за каждые 1 000 ₸.</div>
    </section>
    ${carMoneyCard(m)}
    ${rentOwnCard(m)}
    ${monthCard(m)}
    ${m.pre ? runwayCard(m) : ''}
    <section class="card"><div class="over">План и прогноз</div>${chart(m)}
      <div class="legend"><span><i style="background:#8A93B3"></i>план</span><span><i style="background:var(--green)"></i>прогноз</span><span><i style="background:#fff;width:8px;height:8px;border-radius:50%"></i>сверки</span><span><i style="background:var(--yellow)"></i>цель</span></div></section>
    <section class="card"><div class="over">История</div>${C.moneyLine(st).reverse().slice(0, 30).map((p, i, a) => {
      const x = p.x, prev = a[i + 1], ch = prev ? p.na - prev.na : null, future = x.d > TODAY;
      const what = x.plan ? (future ? 'план: ' : '') + 'разовые траты до такси ' + C.money(-x.add) : C.isAdd(x) ? (x.move ? (x.to === 'loan' ? 'досрочно по кредиту ' : 'в Отбасы ') + C.money(+x.add) : x.add < 0 ? 'трата ' + C.money(-x.add) : 'пополнение ' + C.money(+x.add)) : 'сверка';
      return `<div class="hist${future ? ' fut' : ''}"><div>${C.dateShort(x.d)} ${x.d.slice(0, 4)}<small>${esc(x.note && !x.plan ? what + ': ' + x.note : what)}</small></div><div><b>${C.money(p.na)}</b>${ch != null && Math.abs(ch) >= 1 ? `<em class="${ch >= 0 ? 'up' : 'down'}">${C.money(ch, true)}</em>` : ''}</div></div>`;
    }).join('')}</section>`;
  }
  function chart(m) {
    const st = m.st, W = 340, H = 180, P = 10, top = 16;
    // план ломается: прогноз рисуем до месяца, когда кончаются деньги, а план, который до срока так и остаётся в минусе, до первого
    // месяца этого минуса. Годы растущего долга не рисуем, как и в плитках Пути
    const dl = C.mkOf(st.set.deadline), brk = brokenAt(m), fcRows = m.fc.rows.filter(r => r.mk <= dl && (!brk || r.mk <= brk));
    const bAll = st.base ? st.base.rows.filter(r => r.mk <= dl) : [], bLast = bAll.map(r => r.na >= 0).lastIndexOf(true), base = bAll.slice(0, bLast + 2);
    const ml = C.moneyLine(st, TODAY);
    const pts = [...base.map(r => r.na), ...fcRows.map(r => r.na), ...ml.map(p => p.na), m.target, 0];
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
    const ty = Y(m.target);
    const years = []; for (let y = +from.slice(0, 4) + 1; y <= +st.set.deadline.slice(0, 4); y++) years.push(y);
    const grid = years.map(y => { const x = X(y + '-01-01'); return x > P && x < W - P ? `<line class="c-grid" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${H - P}"/><text class="c-t" x="${(x + 3).toFixed(1)}" y="${H - P - 4}">${y}</text>` : ''; }).join('');
    const zero = lo < 0 ? `<line class="c-grid" x1="${P}" x2="${W - P}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}"/>` : '';
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="План и прогноз активов">
      <defs><linearGradient id="cArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DDC91" stop-opacity=".22"/><stop offset="1" stop-color="#3DDC91" stop-opacity="0"/></linearGradient></defs>
      ${grid}${zero}<line class="c-target" x1="${P}" x2="${W - P}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/><text class="c-ty" x="${P}" y="${(ty - 5).toFixed(1)}">цель ${mlnShort(m.target)}</text>
      <path class="c-area" d="${area}"/>${b}<path class="c-fc-glow" d="${fl}"/><path class="c-fc" d="${fl}"/>${dots}</svg>`;
  }

  // ---------------------------------------------------------------- путь
  function stationsOf(m) {
    const st = m.st, g = st.set, fc = m.fc, last = C.lastMoney(st, TODAY) || {}, L = [];
    const add = (key, title, date, icon, done) => { if (date) L.push({ key, title, date, icon, done: !!done }); };
    add('license', 'Права', g.license, 'wheel', st.done.license);
    if (g.carFrom) add('car', 'Машина', g.carFrom, 'car', st.done.car || (last.car || 0) > 0);
    if (g.carFrom && fc.closed) add('loan', 'Кредит', fc.closed + '-' + C.pad(C.dim(fc.closed)), 'key', (last.car || 0) > 0 && !(last.loan > 0) && st.money.some(x => x.loan > 0));
    add('goal', mlnShort(m.target), fc.goal ? fc.goal.iso : g.deadline, 'flag', m.na >= m.target);
    const otb3 = g.otbOpen ? C.addYears(g.otbOpen, 3) : '';
    add('otb', 'Отбасы', otb3, 'bank', otb3 && TODAY >= otb3);
    L.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    const lk = C.otbLocks(st, TODAY, fc), latest = L.reduce((x, s) => s.date > x ? s.date : x, TODAY);
    L.push({ key: 'flat', title: 'Квартира', date: lk && lk.buy && lk.buy > latest ? lk.buy : latest, icon: 'house', done: false });
    let lastDone = -1;
    L.forEach((s, i) => { if (s.done) lastDone = i; });
    L.forEach((s, i) => { s.state = i <= lastDone ? 'done' : i === lastDone + 1 ? 'next' : 'todo'; });
    L.forEach(s => {
      const mo = C.MON[+s.date.slice(5, 7) - 1].slice(0, 3) + ' ' + s.date.slice(0, 4);
      s.sub = s.key === 'flat' ? '50/50' : s.state === 'next' ? C.untilText(TODAY, s.date) : s.state === 'todo' ? mo : '';
    });
    const nx = L[lastDone + 1], prevDate = lastDone >= 0 ? (L[lastDone].date < TODAY ? L[lastDone].date : TODAY) : (st.created || TODAY);
    let t = nx ? C.isoDiff(prevDate, TODAY) / Math.max(1, C.isoDiff(prevDate, nx.date)) : 1;
    t = Math.max(0.3, Math.min(0.72, t)); // машина между станциями, не поверх них
    return { L, car: { seg: lastDone + 1, t }, next: nx };
  }
  function vPath() {
    const m = model(), st = m.st, ph = C.phaseNow(st, TODAY, m.fc), R = stationsOf(m), ex = m.need.extra, lv = m.na < m.target && ex == null ? levers(m) : '';
    // в плитке без ₸: «−1,17 млн» помещается в 360 px
    // план ломается (прогноз так и не купил машину, деньги кончились): с этого месяца годы растущего минуса не показываем, как на Главной
    const brk = brokenAt(m);
    const yrs = [0, 1, 2].map(i => +TODAY.slice(0, 4) + i).filter(y => y <= +st.set.deadline.slice(0, 4)).map(y => {
      const mk = y + '-12', fr = m.fc.rows.find(r => r.mk === mk), br = st.base && st.base.rows.find(r => r.mk === mk), gone = brk && mk >= brk;
      return `<div class="yr"><span>Конец ${y}</span><b${gone ? ' class="down"' : ''}>${gone ? 'минус' : fr ? C.mln(fr.na).replace(/\s₸$/, '') : '-'}</b><small>план ${br ? (br.na < 0 ? 'минус' : C.mln(br.na).replace(/\s₸$/, '')) : '-'}</small></div>`;
    }).join('');
    const Q = G.quests(st, TODAY, m.fc), nx = R.next;
    const nxt = nx ? (nx.key === 'loan' ? 'кредит закрыт' : nx.key === 'goal' ? C.money(m.target) + ' активов' : nx.key === 'otb' ? 'депозиту Отбасы 3 года' : nx.title.toLowerCase()) : '';
    return `
    <header class="top"><div><div class="top-k">Путь</div><h1 class="top-t">Этап ${ph.n} из ${ph.total}</h1></div><div class="top-r"><button class="icon-btn" data-a="kb" aria-label="Заметки">${ic('book')}</button></div></header>
    <section class="road-card"><div class="road-head"><div class="ibox violet">${ic('route')}</div><div><div class="road-k">Сейчас</div><div class="road-t">${esc(ph.title)}</div></div></div>
      ${D.road(R.L, R.car, m.pl.skin, null)}
      <div class="stages" style="margin:10px 18px 0">${C.PHASES.map((_, i) => `<i class="${i + 1 < ph.n ? 'done' : i + 1 === ph.n ? 'now' : ''}"></i>`).join('')}</div>
      <div class="road-foot"><span>${nx ? `Дальше: <b>${esc(nxt)}</b>, ${nx.key === 'goal' && !m.fc.goal ? `срок ${C.dateLong(nx.date)}, по прогнозу пока не доходит` : C.dateLong(nx.date) + (nx.key === 'loan' || nx.key === 'goal' ? ' по прогнозу' : '')}` : 'Все вехи пройдены'}</span></div></section>
    <section class="card"><div class="over">${pastDl(st) && m.na < m.target ? 'Срок был ' : 'Чтобы успеть к '}${C.dateLong(st.set.deadline)}</div>
      <p class="lead">${m.na >= m.target ? 'Цель уже есть.' : pastDl(st) ? 'Срок прошёл, а цели пока нет. Новый срок ставится в Настройках.' : ex === 0 ? `Успеваешь с запасом <b>${days(m.need.slackDays)}</b>.` : ex ? `Добавь <b>${C.num1(ex)} ч в неделю</b> к обычному графику.` : (m.need.capped ? `Больше ${m.need.cap} ч в неделю не советую, это потолок из настроек.` : 'Одних часов мало.') + (lv ? ` ${lv} Что они дают, видно в Что если на Главной.` : '')}</p>
      <div class="years">${yrs}</div></section>
    ${locksCard(m)}
    <button class="card tap block kb-entry" data-a="kb"><span class="kb-ic">${ic('book')}</span><span><b>Заметки</b><small>Доход в Экономе, итоги, сроки и исследования</small></span>${ic('right')}</button>
    <div class="sec-h"><div class="h3">Задания</div><span class="link">${Q.open.length}</span></div>
    <section class="card">${Q.open.map(q => questRow(q, false)).join('') || '<p class="lead">Все задания сделаны.</p>'}
      <button class="add-q" data-a="quest-new">${ic('plus')}Своё задание</button></section>
    ${Q.done.length ? `<div class="sec-h"><div class="h3">Сделано</div><span class="link">${Q.done.length}</span></div>
      <section class="card">${Q.done.slice(0, UI.allDone ? 999 : 4).map(q => questRow(q, false)).join('')}
      ${Q.done.length > 4 && !UI.allDone ? '<button class="btn ghost" data-a="all-done">Показать все</button>' : ''}</section>` : ''}
    <button class="card tap block cal-btn" data-a="cal">${ic('cal')}<span><b>Даты в календарь телефона</b><small>Платежи, страховка, Отбасы и вехи: телефон сам напомнит</small></span>${ic('right')}</button>
    ${diaryCard(st)}`;
  }
  // ---------------------------------------------------------------- дневник пути: одна строчка к дню
  function diaryCard(st) {
    const list = Object.entries(st.diary || {}).filter(([d, x]) => x && x.text && d <= TODAY).sort((a, b) => a[0] < b[0] ? 1 : -1);
    const head = `<div class="sec-h"><div class="h3">Дневник</div><span class="link">${list.length || ''}</span></div>`;
    if (!list.length) return head + `<section class="card"><p class="sub" style="margin-top:0">Строчку к дню можно написать во вкладке Смены, под сменой. Через год приятно перечитать, как шёл.</p></section>`;
    return head + `<section class="card diary">${list.slice(0, UI.diaryAll ? 999 : 5).map(([d, x]) => `<button class="di" data-a="day-open" data-d="${d}"><span>${C.dateShort(d)}${d.slice(0, 4) !== TODAY.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}</span><b>${esc(x.text)}</b></button>`).join('')}
      ${list.length > 5 && !UI.diaryAll ? '<button class="btn ghost" data-a="diary-all">Показать все</button>' : ''}</section>`;
  }
  // ---------------------------------------------------------------- даты в календарь
  function calEvents(st, fc) {
    const ev = [], lp = C.loanPlan(st, TODAY), money = v => C.money(Math.round(v)).replace(/\u00a0/g, ' ');
    for (const s of C.milestones(st, TODAY, fc)) if (s.kind === 'task' && !s.done && s.date && s.date >= TODAY && !/^otb-y/.test(s.id)) ev.push({ id: 'm-' + s.id, d: s.date, t: s.title, x: s.hint || '' });
    for (const q of st.quests || []) if (!q.done && q.date && q.date >= TODAY) ev.push({ id: 'q-' + q.id, d: q.date, t: q.title, x: 'Своё задание' });
    if (lp && lp.bal > 0 && lp.next) ev.push({ id: 'loan', d: lp.next, t: 'Платёж по кредиту за машину, ' + money(lp.pay), x: 'Ещё ' + lp.left + ' платежей по графику.', rr: 'FREQ=MONTHLY;COUNT=' + lp.left });
    if (st.car) { let y = C.addYears(st.car.on, 1); while (y < TODAY) y = C.addYears(y, 1); ev.push({ id: 'ins', d: C.isoAdd(y, -7), t: 'Продлить страховку ОГПО на машину', x: 'Срок страховки ' + C.dateLong(y) + '.', rr: 'FREQ=YEARLY' }); }
    if (st.set.otbOpen) { const y = +TODAY.slice(0, 4), d = (TODAY > y + '-12-15' ? y + 1 : y) + '-12-15'; if (d <= st.set.deadline) ev.push({ id: 'otb', d, t: 'Положить в Отбасы до конца года', x: 'Премия 20% начисляется за взносы календарного года.', rr: 'FREQ=YEARLY;UNTIL=' + st.set.deadline.replace(/-/g, '') }); }
    return ev.sort((a, b) => a.d < b.d ? -1 : 1);
  }
  const ymd = iso => iso.replace(/-/g, '');
  function gcalLink(e) {
    const q = 'action=TEMPLATE&text=' + encodeURIComponent(e.t) + '&dates=' + ymd(e.d) + '/' + ymd(C.isoAdd(e.d, 1)) + '&details=' + encodeURIComponent(e.x || '') + (e.rr ? '&recur=' + encodeURIComponent('RRULE:' + e.rr) : '');
    return 'https://calendar.google.com/calendar/render?' + q;
  }
  function icsText(ev) {
    const esc2 = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const fold = l => { const out = []; let cur = ''; for (const ch of l) { if (cur.length >= 60) { out.push(cur); cur = ' '; } cur += ch; } out.push(cur); return out.join('\r\n'); };
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//put//ru', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Путь к квартире'];
    for (const e of ev) lines.push('BEGIN:VEVENT', 'UID:put-' + e.id + '-' + ymd(e.d) + '@tiil1.github.io', 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + ymd(e.d), 'DTEND;VALUE=DATE:' + ymd(C.isoAdd(e.d, 1)),
      'SUMMARY:' + esc2(e.t), 'DESCRIPTION:' + esc2(e.x || ''), ...(e.rr ? ['RRULE:' + e.rr] : []), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc2(e.t), 'TRIGGER:-PT14H', 'END:VALARM', 'END:VEVENT');
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }
  function calSheet() {
    const m = model(), ev = calEvents(m.st, m.fc);
    sheet(`<div class="sh-t">Даты в календарь</div><div class="sh-s">Напоминание придёт накануне в 10:00. Нажми Добавить у нужных дат или скачай все сразу файлом.</div>
      ${ev.length ? ev.map(e => `<div class="cal-row"><span><b>${esc(e.t)}</b><small>${C.dateLong(e.d)}${e.rr ? (/MONTHLY/.test(e.rr) ? ', каждый месяц' : ', каждый год') : ''}</small></span><a class="cal-add" href="${gcalLink(e)}" target="_blank" rel="noopener">Добавить</a></div>`).join('')
        : '<p class="lead">Ближайших дат пока нет.</p>'}
      ${ev.length ? `<div class="btns"><button class="btn alt" data-a="cal-ics">${ic('dl')}Скачать все файлом</button></div><div class="sub">Файл открывается календарём на iPhone и Samsung. В Google Календаре на Android удобнее кнопки Добавить.</div>` : ''}`);
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

  // ---------------------------------------------------------------- заметки из Ноушена
  // На сайте они лежат зашифрованными (kb.bin). Ключ хранится в состоянии владельца и уходит в его облако,
  // поэтому заметки открываются там, где он вошёл через Google. Код нужен один раз, на любом из его устройств
  const KB = { data: null, err: null, errK: null, busy: false, q: '', open: {}, shown: {}, dbq: {}, det: new Set() };
  const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  // код: русские буквы, похожие на латинские, считаем латинскими (набрал на русской раскладке, и всё равно подойдёт)
  const LAT = { 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'У': 'Y', 'З': '3' };
  const kbCode = s => String(s || '').toUpperCase().replace(/[А-ЯЁ]/g, c => LAT[c] || c).replace(/[^A-Z0-9]/g, '').slice(0, 16);
  // код в ключ: те же соль и число проходов, что в kb_build.py
  async function kbKeyOf(code) {
    const enc = new TextEncoder(), norm = kbCode(code);
    const base = await crypto.subtle.importKey('raw', enc.encode(norm), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('put-kb-v1'), iterations: 200000 }, base, 256));
  }
  async function kbDecrypt(raw) {
    if (typeof DecompressionStream === 'undefined') throw new Error('old');
    let r, buf;
    try { r = await fetch('kb.bin'); } catch (e) { throw new Error('net'); }
    if (r.status === 404) throw new Error('none');
    try { if (!r.ok) throw 0; buf = new Uint8Array(await r.arrayBuffer()); } catch (e) { throw new Error('net'); }
    if (buf.length < 40 || String.fromCharCode.apply(null, buf.subarray(0, 6)) !== 'PUTKB1') throw new Error('net'); // без сети вместо файла приходит страница
    let plain;
    try { const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(6, 18) }, key, buf.subarray(18)); } catch (e) { throw new Error('key'); }
    const txt = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return kbIndex(JSON.parse(txt));
  }
  const kbPlain = s => String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/`/g, '');
  const kbLow = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\u00a0/g, ' ').replace(/\u2011/g, '-');
  // запрос «72900» ищет и «72 900»: суммы в заметках записаны с пробелами
  const kbQs = q => { const g = q.replace(/\d{4,}/g, d => d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')); return g !== q ? [q, g] : [q]; };
  const kbFind = (low, qs, from) => { let at = -1, len = 0; for (const x of qs) { const i = low.indexOf(x, from); if (i >= 0 && (at < 0 || i < at)) { at = i; len = x.length; } } return [at, len]; };
  const kbHas = (low, qs) => qs.some(x => low.indexOf(x) >= 0);
  function kbWalk(bs, f) {
    for (const b of bs || []) {
      f(b);
      if (b.t === 'cols') b.c.forEach(col => kbWalk(col, f)); else if (Array.isArray(b.c)) kbWalk(b.c, f);
      for (const it of b.items || []) { f({ t: 'li', x: it.x }); kbWalk(it.c, f); }
    }
  }
  // для поиска: текст каждой заметки и каждой строки таблиц
  function kbIndex(d) {
    for (const n of d.notes) {
      const parts = []; let h = 0;
      n.dbs = [];
      kbWalk(n.blocks, b => {
        if (b.t === 'h') b.id = 'kh' + n.id + (h++);
        if (b.t === 'db') n.dbs.push(b.db);
        if (b.x) parts.push(kbPlain(b.x));
        if (b.rows) for (const r of b.rows) parts.push(r.map(kbPlain).join(' · '));
      });
      n.txt = parts.join('\n'); n.low = kbLow(n.txt); n.heads = h;
    }
    for (const db of Object.values(d.dbs)) db.low = db.rows.map(r => kbLow(r.join(' · ')));
    d.byId = {}; for (const n of d.notes) d.byId[n.id] = n;
    return d;
  }
  // открыть заметку поверх списка (Назад вернёт к списку) и прокрутить к разделу, если он задан
  function kbOpenNote(id, sec) {
    UI.kbNote = id; UI.kbStack = [null]; UI.subDepth = 2; UI.kbScroll = 0; UI.kbSec = sec || '';
    try { history.pushState({ put: 'kbnote' }, ''); } catch (e) { /* ок */ }
    render(); kbSecGo();
  }
  // раздел по началу заголовка; пока заметки расшифровываются, ждём (kbEnsure прокрутит после)
  function kbSecGo() {
    const n = UI.kbSec && KB.data && KB.data.byId[UI.kbNote];
    let hid = null;
    if (n) kbWalk(n.blocks, b => { if (!hid && b.t === 'h' && kbPlain(b.x).indexOf(UI.kbSec) === 0) hid = b.id; });
    const h = hid && document.getElementById(hid);
    if (h) { UI.kbSec = ''; h.scrollIntoView({ block: 'start' }); } else { if (KB.data) UI.kbSec = ''; window.scrollTo(0, 0); }
  }
  function kbEnsure() {
    const st = S(), k = st.kb && st.kb.k;
    if (KB.data || KB.busy || !k || (KB.err && KB.errK === k)) return;
    KB.busy = true;
    kbDecrypt(unb64u(k)).then(d => { KB.data = d; KB.err = null; }).catch(e => { KB.err = ['key', 'none', 'old'].indexOf(e.message) >= 0 ? e.message : 'net'; KB.errK = k; })
      .finally(() => {
        KB.busy = false; if (UI.sub !== 'kb') return;
        // ключ пришёл из облака после входа: заметка, на которую вела ссылка, открывается сразу
        if (KB.data && UI.kbPend) { const p = UI.kbPend; UI.kbPend = null; kbOpenNote(p.id, p.sec); } else { render(); if (UI.kbSec) kbSecGo(); }
      });
  }
  async function kbUnlock() {
    const inp = $('#kb-code'), code = inp ? inp.value : '', btn = document.querySelector('[data-a="kb-unlock"]');
    if (kbCode(code).length < 16) { toast('Впиши код целиком: 16 букв и цифр', 'warn'); return; }
    if (btn) btn.disabled = true;
    try {
      const raw = await kbKeyOf(code), d = await kbDecrypt(raw);
      KB.data = d; KB.err = null; KB.errK = null;
      const uid = Store.cloud && Store.cloud.user ? Store.cloud.user.uid || null : null;
      Store.update(s => { s.kb = { k: b64u(raw), u: Math.max(Date.now(), ((s.kb && s.kb.u) || 0) + 1), uid }; }, 'kb');
      toast('Заметки открыты. Код сохранён в твоём аккаунте: на других устройствах они откроются сами.', 'good'); buzz([12, 40, 12]);
      if (UI.kbPend) { const p = UI.kbPend; UI.kbPend = null; kbOpenNote(p.id, p.sec); }
    } catch (e) { toast(KB_ERR[e.message] || KB_ERR.net, 'warn'); }
    finally { if (btn) btn.disabled = false; }
  }
  const KB_ERR = { key: 'Код не подошёл. Проверь буквы и цифры.', none: 'Заметок пока нет на сайте.', old: 'Браузер устарел: обнови его, и заметки откроются.', net: 'Нет связи. Попробуй, когда появится интернет.' };
  // числа и единицы не рвутся на строки: 3 000 ₸, 12 ч, 9,6-12 млн. Ссылки не трогаем
  const kbNb = h => h.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) (₸|%|млн|тыс|км|мес|ч(?![а-яё])|л(?![а-яё]))/g, '$1\u00a0$2').replace(/(млн|тыс\.?) ₸/g, '$1\u00a0₸').replace(/(\d)-(\d)/g, '$1\u2011$2');
  // #n:id на заметку, #n:id/Раздел сразу на её раздел (по началу заголовка), #d:id на таблицу
  const kbLink = (t, u) => u.slice(0, 3) === '#n:' ? `<a class="kb-ln" data-a="kb-note" data-id="${u.slice(3).split('/')[0]}"${u.indexOf('/') > 0 ? ` data-v="${u.slice(u.indexOf('/') + 1)}"` : ''}>${t}</a>` : u.slice(0, 3) === '#d:' ? `<a class="kb-ln" data-a="kb-dbgo" data-id="${u.slice(3)}">${t}</a>`
    : /^https?:\/\//.test(u) ? `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>` : t;
  // текст из Ноушена: жирный, код, ссылки (свои страницы и таблицы открываются внутри приложения)
  const kbMd = s => {
    const e = esc(s), re = /\[([^\]]*)\]\(([^)\s]+)\)/g; let out = '', pos = 0, m;
    while ((m = re.exec(e))) { out += kbNb(e.slice(pos, m.index)) + kbLink(kbNb(m[1]), m[2]); pos = re.lastIndex; }
    return (out + kbNb(e.slice(pos))).replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  };
  const kbCut = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:]+$/, '') + '…' : s;
  // совпадения поиска подсвечены
  function kbMark(text, qs) {
    if (!qs || !qs[0]) return esc(text);
    const low = kbLow(text); let out = '', pos = 0, [at, len] = kbFind(low, qs, 0);
    while (at >= 0) { out += esc(text.slice(pos, at)) + '<mark>' + esc(text.slice(at, at + len)) + '</mark>'; pos = at + len; [at, len] = kbFind(low, qs, pos); }
    return out + esc(text.slice(pos));
  }
  const kbMeta = n => [n.heads ? n.heads + ' ' + C.plural(n.heads, ['раздел', 'раздела', 'разделов']) : '', n.dbs.length ? n.dbs.length + ' ' + C.plural(n.dbs.length, ['таблица', 'таблицы', 'таблиц']) : ''].filter(Boolean).join(' · ');
  // таблица в тексте: столбец с числами выровнен вправо; в ячейке с переносом первая строка главная, остальные мельче (подпись)
  const KB_NUM = /^[−+\-~≈]?\d[\d\s,.\-…−+]*( ?(₸|%|млн|тыс\.?|ч|мес\.?|км|л))?( ₸)?( (в час|в день|в месяц|за смену))?$/;
  const kbIsNum = c => KB_NUM.test(kbPlain(c).split('\n')[0].replace(/\u00a0/g, ' ').trim());
  // жирная сумма со знаком (итог строки) зелёная или красная, как суммы в остальном приложении
  const kbCellMd = c => {
    const [a, ...rest] = String(c).split('\n'), sign = /^\*\*[−+]\d/.test(a) ? (a.charAt(2) === '+' ? 'up' : 'down') : '';
    return (sign ? kbMd(a).replace('<b>', `<b class="${sign}">`) : kbMd(a)) + (rest.length ? `<small class="kb-sub">${kbMd(rest.join('\n'))}</small>` : '');
  };
  function kbTable(rows) {
    const body = rows.slice(1);
    const num = rows[0].map((_, j) => { const cs = body.map(r => r[j] || '').filter(c => c.trim()); return j > 0 && cs.length > 0 && cs.filter(kbIsNum).length >= cs.length * 0.6; });
    const tag = (t, j, c, row) => `<${t}${row ? ' scope="row"' : ''}${num[j] ? ' class="n"' : ''}>${kbCellMd(c)}</${t}>`;
    return `<div class="kb-tw"><table class="kb-t${rows[0].length > 2 ? ' wide' : ''}">${rows.map((r, i) => `<tr>${r.map((c, j) => i === 0 ? tag('th', j, c) : j === 0 ? tag('th', 0, c, true) : tag('td', j, c)).join('')}</tr>`).join('')}</table></div>`;
  }
  // значок выноски: имя значка приложения (wallet, bolt) или эмодзи из Ноушена
  const kbCallIc = i => !i ? '' : `<span class="kb-call-i">${/^[a-z]+$/.test(i) ? ic(i) : esc(i)}</span>`;
  function kbBlocks(bs) {
    return (bs || []).map(b => {
      if (b.t === 'h') return b.l === 3 ? `<h4 id="${b.id}">${kbMd(b.x)}</h4>` : `<h3 id="${b.id}">${kbMd(b.x)}</h3>`;
      if (b.t === 'p') return `<p>${kbMd(b.x)}</p>`;
      if (b.t === 'ul' || b.t === 'ol') return `<${b.t}>${b.items.map(it => `<li>${kbMd(it.x)}${it.c ? kbBlocks(it.c) : ''}</li>`).join('')}</${b.t}>`;
      if (b.t === 'todo') return `<ul class="kb-todo">${b.items.map(it => `<li class="${it.done ? 'on' : ''}"><i>${it.done ? ic('check') : ''}</i><span>${kbMd(it.x)}</span></li>`).join('')}</ul>`;
      if (b.t === 'call') return `<div class="kb-call${b.i ? ' has-i' : ''}">${kbCallIc(b.i)}<div>${kbBlocks(b.c)}</div></div>`;
      if (b.t === 'quote') return `<blockquote>${kbMd(b.x)}</blockquote>`;
      if (b.t === 'table') return kbTable(b.rows);
      if (b.t === 'cols') return `<div class="kb-cols">${b.c.map(col => `<div>${kbBlocks(col)}</div>`).join('')}</div>`;
      if (b.t === 'hr') return '<hr>';
      if (b.t === 'db') return kbDb(b.db);
      if (b.t === 'link') return `<button class="kb-pl" data-a="kb-note" data-id="${b.n}">${ic('book')}<span>${esc(b.x)}</span>${ic('right')}</button>`;
      if (b.t === 'tog') return `<details class="kb-tog"><summary><span>${kbMd(b.x)}</span><i class="kb-chev">${ic('right')}</i></summary><div class="kb-tog-b">${kbBlocks(b.c)}</div></details>`;
      return '';
    }).join('');
  }
  // таблица из Ноушена: закрыта, пока не нажал; строки карточками, поиск внутри, подробности по нажатию
  function kbDb(id) {
    const db = KB.data.dbs[id]; if (!db) return '';
    const open = !!KB.open[id], n = db.rows.length;
    return `<div class="kb-db${open ? ' open' : ''}" id="db-${id}"><button class="kb-db-h" data-a="kb-dbt" data-id="${id}" aria-expanded="${open}">${ic('grid')}<span><b>${esc(db.title)}</b><small>${C.grp(n)} ${C.plural(n, ['строка', 'строки', 'строк'])}</small></span><i class="kb-chev">${ic('right')}</i></button>
      ${open ? `<div class="kb-db-b">${n > 8 || KB.dbq[id] ? `<label class="kb-search sm">${ic('search')}<input type="search" data-dbq="${id}" placeholder="Поиск в таблице" value="${esc(KB.dbq[id] || '')}" autocomplete="off"></label>` : ''}<div class="kb-rows" id="rows-${id}">${kbRows(id)}</div></div>` : ''}</div>`;
  }
  const kbDbQs = id => { const q = kbLow((KB.dbq[id] || '').trim()); return q ? kbQs(q) : null; };
  const kbRowsOf = id => { const db = KB.data.dbs[id], qs = kbDbQs(id), out = []; for (let i = 0; i < db.rows.length; i++) if (!qs || kbHas(db.low[i], qs)) out.push(i); return out; };
  function kbRows(id) {
    const list = kbRowsOf(id), n = KB.shown[id] || 20, qs = kbDbQs(id);
    return (list.length ? list.slice(0, n).map(i => kbRowCard(id, i, qs)).join('') : '<p class="sub kb-hint">Ничего не нашлось</p>')
      + (list.length > n ? `<button class="btn ghost sm" data-a="kb-more" data-id="${id}">Показать ещё ${Math.min(20, list.length - n)} из ${list.length - n}</button>` : '');
  }
  // карточка строки: заголовок целиком (в закрытой три строки), плашки с подписью; то, что уже в заголовке, не повторяем
  function kbRowCard(id, i, qs) {
    const db = KB.data.dbs[id], r = db.rows[i], tc = db.tc.length ? db.tc : [0], open = KB.det.has(id + ':' + i);
    const title = tc.map(k => r[k]).filter(Boolean).join(' · ') || r.find(Boolean) || '';
    const chips = db.cc.filter(([k]) => r[k] && tc.indexOf(k) < 0 && title.indexOf(r[k]) < 0).map(([k, pre, suf, u]) => `<span>${kbNb(esc(kbCut(pre + r[k] + suf + (u >= 0 && r[u] ? ' ' + r[u] : ''), 34)))}</span>`).join('');
    return `<button class="kb-row" data-a="kb-row" data-db="${id}" data-i="${i}" aria-expanded="${open}"><b>${kbMark(title, qs)}</b>${chips ? `<span class="kb-chips">${chips}</span>` : ''}</button>${open ? kbRowDet(id, i) : ''}`;
  }
  // ссылки в ячейках: без хвостовых скобок и запятых; обрезанные (с …) не ссылки
  const kbCell = v => {
    if (/^https?:\/\/\S+$/.test(v) && v.indexOf('…') < 0) return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(kbCut(v.replace(/^https?:\/\/(www\.)?/, ''), 48))}</a>`;
    const re = /https?:\/\/[^\s<>"]*[^\s<>"),.;:\]…]/g; let out = '', pos = 0, m;
    while ((m = re.exec(v))) { const u = m[0], cut = v.charAt(re.lastIndex) === '…'; out += kbNb(esc(v.slice(pos, m.index))) + (cut ? esc(u) : `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a>`); pos = re.lastIndex; }
    return (out + kbNb(esc(v.slice(pos)))).replace(/\n/g, '<br>');
  };
  // подробности строки: все поля, кроме тех, что уже в заголовке карточки
  const kbRowDet = (id, i) => { const db = KB.data.dbs[id], r = db.rows[i], tc = db.tc.length ? db.tc : [0]; return `<div class="kb-det">${db.head.map((h, k) => r[k] && tc.indexOf(k) < 0 ? `<div><span>${esc(h)}</span><p>${kbCell(r[k])}</p></div>` : '').join('')}</div>`; };
  // поиск по всем заметкам и таблицам
  function kbSnip(n, at, len, qs) {
    const a = Math.max(0, at - 50), b = Math.min(n.txt.length, at + len + 80), seg = n.txt.slice(a, b).replace(/\s+/g, ' ');
    return (a > 0 ? '…' : '') + kbMark(seg, qs) + (b < n.txt.length ? '…' : '');
  }
  function kbResults(q0) {
    const q = kbLow(q0.trim()); if (q.length < 2) return '<p class="sub kb-hint">Напиши хотя бы две буквы</p>';
    const d = KB.data, out = [], qs = kbQs(q);
    for (const n of d.notes) {
      let k = 0, [at, len] = kbFind(n.low, qs, 0); const snips = [];
      while (at >= 0) { if (!snips.length || (snips.length < 2 && at - snips[0].at > 160)) snips.push({ at, len, k }); k++; [at, len] = kbFind(n.low, qs, at + len); }
      const dbHits = n.dbs.map(id => ({ id, k: d.dbs[id].low.filter(x => kbHas(x, qs)).length })).filter(x => x.k);
      if (k || dbHits.length) out.push({ n, k, snips, dbHits, w: k + dbHits.reduce((s, x) => s + x.k, 0) / 10 });
    }
    if (!out.length) return `<p class="sub kb-hint">Ничего не нашлось</p>`;
    return out.sort((a, b) => b.w - a.w).map(({ n, k, snips, dbHits }) => `<section class="card kb-hit">
      <button class="kb-hit-h" data-a="kb-note" data-id="${n.id}" data-hl="1"><b>${esc(n.short)}</b><small>${k ? k + ' ' + C.plural(k, ['совпадение', 'совпадения', 'совпадений']) : 'в таблицах'}</small></button>
      ${snips.map(x => `<button class="kb-snip" data-a="kb-note" data-id="${n.id}" data-hl="1" data-k="${x.k}">${kbSnip(n, x.at, x.len, qs)}</button>`).join('')}
      ${dbHits.map(x => `<button class="kb-hit-db" data-a="kb-dbgo" data-id="${x.id}" data-q="1">${ic('grid')}<span>${esc(d.dbs[x.id].title)}</span><em>${x.k} ${C.plural(x.k, ['строка', 'строки', 'строк'])}</em></button>`).join('')}</section>`).join('');
  }
  const kbItem = n => `<button class="kb-item" data-a="kb-note" data-id="${n.id}"><span class="kb-ic">${ic(n.icon)}</span><span class="kb-it"><b>${esc(n.short)}</b><small>${esc(n.lead)}</small><em>${kbMeta(n)}</em></span>${ic('right')}</button>`;
  function kbList() {
    // наверху свежее исследование 18.11 (доход в Экономе), без него сводная страница Ноушена
    const d = KB.data, hero = d.byId.econ || d.byId.main, rows = Object.values(d.dbs).reduce((s, x) => s + x.rows.length, 0), q = KB.q.trim();
    return `<label class="kb-search">${ic('search')}<input id="kb-q" type="search" placeholder="Поиск по заметкам и таблицам" value="${esc(KB.q)}" autocomplete="off"></label>
      <div id="kb-res">${q ? kbResults(q) : ''}</div>
      <div id="kb-home"${q ? ' hidden' : ''}>
        ${hero ? `<button class="kb-hero" data-a="kb-note" data-id="${hero.id}"><div class="over">Главное</div><b>${esc(hero.short)}</b><p>${esc(hero.lead)}</p><span class="kb-go">Читать ${ic('right')}</span></button>` : ''}
        ${['Итоги', 'Планы и сроки', 'Исследования'].map(g => { const list = d.notes.filter(n => n.group === g && n !== hero); return list.length ? `<div class="sec-h"><div class="h3">${g}</div></div><section class="card kb-list">${list.map(kbItem).join('')}</section>` : ''; }).join('')}
        <p class="sub kb-foot">Страницы Ноушена и исследование 18.11: ${d.notes.length} ${C.plural(d.notes.length, ['страница', 'страницы', 'страниц'])} и ${Object.keys(d.dbs).length} ${C.plural(Object.keys(d.dbs).length, ['таблица', 'таблицы', 'таблиц'])}, ${C.grp(rows)} ${C.plural(rows, ['строка', 'строки', 'строк'])}.</p>
      </div>`;
  }
  function kbNoteView(n) {
    const hs = []; kbWalk(n.blocks, b => { if (b.t === 'h' && b.l === 2) hs.push(b); });
    const i = KB.data.notes.indexOf(n), next = KB.data.notes[(i + 1) % KB.data.notes.length];
    return `<article class="kb-note"><h1 class="kb-title">${esc(n.title)}</h1>${kbMeta(n) ? `<div class="kb-meta">${kbMeta(n)}</div>` : ''}
      ${hs.length >= 4 ? `<div class="kb-toc">${hs.map(h => `<button data-a="kb-to" data-v="${h.id}">${esc(kbCut(kbPlain(h.x), 40))}</button>`).join('')}</div>` : ''}
      <div class="kb-body">${kbBlocks(n.blocks)}</div>
      ${next && next !== n ? `<button class="kb-next" data-a="kb-note" data-id="${next.id}"><span><small>Дальше</small><b>${esc(next.short)}</b></span>${ic('right')}</button>` : ''}</article>`;
  }
  function kbLock(signed, waiting, bad, other) {
    const mail = Store.cloud && Store.cloud.user && Store.cloud.user.email;
    return `<section class="card kb-lock"><div class="kb-lock-i">${ic('lock')}</div>
      <div class="h3">${bad ? 'Заметки обновились' : other ? 'Заметки привязаны к другому аккаунту' : 'Заметки привязаны к твоему Google\u2011аккаунту'}</div>
      ${waiting ? '<p class="sub">Подключаюсь к аккаунту…</p>' : signed ? `<p class="sub">${bad ? 'Старый код к ним не подходит. Введи новый один раз.' : other ? 'Код от заметок сохранён в другом аккаунте. Введи его здесь, если это твой.' : 'Введи код один раз на любом устройстве, где ты вошёл. Он сохранится в твоём аккаунте, и на остальных заметки откроются сами.'}</p>
        ${mail ? `<p class="sub kb-mail">${ic('cloud')}<span>${esc(mail)}</span></p>` : ''}
        <label class="fld"><span>Код заметок</span><input id="kb-code" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX"></label>
        <div class="btns"><button class="btn" data-a="kb-unlock">${ic('unlock')}Открыть заметки</button></div>`
      : `<p class="sub">Войди через Google тем же аккаунтом, что и обычно. Если код уже вводил, заметки откроются сами.</p><div class="btns"><button class="btn" data-a="signin">${ic('cloud')}Войти через Google</button></div>`}</section>`;
  }
  function vKb() {
    const st = S(), cl = Store.cloud || {}, key = st.kb && st.kb.k, n = KB.data && UI.kbNote ? KB.data.byId[UI.kbNote] : null;
    // без интернета SDK входа не грузится, но телефон всё ещё вошёл (cl.on): заметки открываются по сохранённому коду
    const offline = !cl.user && cl.on && (navigator.onLine === false || cl.status === 'error'), signed = !!cl.user || offline;
    const other = !!(cl.user && st.kb && st.kb.uid && cl.user.uid && st.kb.uid !== cl.user.uid);
    if (cl.user && cl.user.uid && st.kb && key && !st.kb.uid && !other) Store.update(s => { if (s.kb) s.kb.uid = cl.user.uid; }, 'seen');
    const head = n ? `<header class="top kb-top"><div class="top-r"><button class="icon-btn" data-a="kb-back" aria-label="Назад">${ic('left')}</button><button class="top-k kb-tt" data-a="kb-top">${esc(n.short)}</button></div></header>`
      : `<header class="top"><div class="top-r"><button class="icon-btn" data-a="kb-back" aria-label="Назад">${ic('left')}</button><div><div class="top-k">Ноушен и исследования</div><h1 class="top-t">Заметки</h1></div></div></header>`;
    if (!signed) return head + kbLock(false, cl.on && (cl.status === 'loading' || cl.status === 'sync'));
    const bad = KB.err === 'key' && KB.errK === key;
    if (!key || bad || other) return head + kbLock(true, false, bad, other);
    kbEnsure();
    const errText = { none: ['Заметок пока нет', 'На сайте ещё нет файла с заметками.'], old: ['Браузер устарел', 'Обнови браузер на телефоне, и заметки откроются.'], net: ['Нет связи', 'Заметки ещё не скачаны на этот телефон. Откроются, когда появится интернет.'] }[KB.err] || [];
    if (!KB.data) return head + (KB.err ? `<section class="card kb-lock"><div class="kb-lock-i">${ic('cloud')}</div><div class="h3">${errText[0]}</div><p class="sub">${errText[1]}</p><div class="btns"><button class="btn alt" data-a="kb-retry">Попробовать снова</button></div></section>`
      : `<section class="card kb-lock"><div class="kb-lock-i spin">${ic('book')}</div><p class="sub">Открываю заметки…</p></section>`);
    return head + (n ? kbNoteView(n) : kbList());
  }
  // переходы внутри заметок: каждый шаг в истории, кнопка назад возвращает на шаг
  function kbGo(id, hl, k, sec) {
    if (!KB.data || !KB.data.byId[id]) return;
    if (!UI.kbNote) UI.kbScroll = window.scrollY;
    (UI.kbStack = UI.kbStack || []).push(UI.kbNote || null);
    UI.kbNote = id; UI.kbHl = hl || ''; UI.subDepth = (UI.subDepth || 1) + 1;
    try { history.pushState({ put: 'kbnote' }, ''); } catch (e) { /* ок */ }
    render(); UI.kbSec = sec || ''; kbSecGo(); // render уже подсветил совпадения; без раздела наверх
    if (UI.kbHl) requestAnimationFrame(() => { const ms = document.querySelectorAll('.kb-body mark'), m = ms[Math.min(ms.length - 1, k || 0)]; if (m) m.scrollIntoView({ block: 'center' }); });
  }
  function kbHighlight(scroll) {
    const q = kbLow((UI.kbHl || '').trim()), body = $('.kb-body'); if (q.length < 2 || !body) return;
    const qs = kbQs(q), walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT), nodes = []; while (walker.nextNode()) if (!walker.currentNode.parentNode.closest('mark')) nodes.push(walker.currentNode);
    let first = null;
    for (const t of nodes) {
      const low = kbLow(t.nodeValue); let [at, len] = kbFind(low, qs, 0); if (at < 0) continue;
      const frag = document.createDocumentFragment(); let pos = 0;
      while (at >= 0) { frag.appendChild(document.createTextNode(t.nodeValue.slice(pos, at))); const m = document.createElement('mark'); m.textContent = t.nodeValue.slice(at, at + len); frag.appendChild(m); if (!first) first = m; pos = at + len; [at, len] = kbFind(low, qs, pos); }
      frag.appendChild(document.createTextNode(t.nodeValue.slice(pos))); t.parentNode.replaceChild(frag, t);
    }
    if (scroll && first) first.scrollIntoView({ block: 'center' });
  }

  // ---------------------------------------------------------------- цифры: статистика смен и студия 50/50
  // Один экран с двумя вкладками: графики не мешают калькулятору. На графиках выделен один столбец, остальные приглушены,
  // значение выбранного видно в строке над графиком (нажми на столбец)
  const MON1 = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];
  // деньги в час без округления до сотни, как в карточке месяца на Сменах; «в час» не отрывается от числа
  const perHText = v => C.money(Math.round(v)) + ' в час';
  const barPath = (x, y, w, base) => { const h = base - y, r = Math.min(4, h, w / 2); return h <= 0 ? '' : `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`; };
  function stBars(items, sel, act, labels) {
    const W = 320, base = 108, top = 12, band = W / items.length, bw = Math.min(22, band - 8), max = Math.max(...items.map(x => x.v || 0)) || 1;
    let bg = '', bars = '', lab = '';
    // зима мягкой полосой за столбцами
    items.forEach((x, i) => { if (x.winter && !(items[i - 1] && items[i - 1].winter)) { let j = i; while (items[j + 1] && items[j + 1].winter) j++; bg += `<rect class="st-winter" x="${i * band + 1}" y="2" width="${(j - i + 1) * band - 2}" height="${base - 2}" rx="8"/><text class="st-wt" x="${(i + (j - i + 1) / 2) * band}" y="13" text-anchor="middle">зима</text>`; } });
    items.forEach((x, i) => {
      const cx = i * band + band / 2, on = i === sel;
      if (x.v) bars += `<path class="st-bar${on ? ' on' : ''}" d="${barPath(cx - bw / 2, base - (base - top - 6) * x.v / max, bw, base)}"/>`;
      bars += `<rect class="st-hit" x="${i * band}" y="0" width="${band}" height="${base + 18}" data-a="${act}" data-v="${x.key}"/>`;
      lab += `<text class="st-lab${on ? ' on' : ''}" x="${cx}" y="${base + 14}" text-anchor="middle">${labels[i]}</text>`;
    });
    return `<svg class="st-svg" viewBox="0 0 ${W} ${base + 18}" role="img">${bg}<line class="st-base" x1="0" x2="${W}" y1="${base + 0.5}" y2="${base + 0.5}"/>${bars}${lab}</svg>`;
  }
  // зоны цифры приложения за 12 ч по порогам месяца из модели (core.zonesAt): аренда, своя с Kaspi, своя после кредита
  const ZONE_ROW = {
    rent: { g: '150 000 в Отбасы', y: 'после жизни плюс', r: 'после жизни минус' },
    loan: { g: 'Kaspi и 150 000 в Отбасы', y: 'после жизни и Kaspi плюс', r: 'после жизни и Kaspi минус' },
    free: { g: '150 000 в Отбасы', y: 'после жизни плюс', r: 'после жизни минус' },
  };
  const ZONE_HEAD = { rent: 'На аренде', loan: 'На своей машине, пока платишь Kaspi', free: 'На своей машине без кредита' };
  function stZones(S) {
    const z = S.zones, n = z.n, Z = z.Z, mine = z.own && z.other > 0, kind = z.kind || 'rent';
    // первые дни после покупки машины: в окне только аренда, а считаем свою машину, поэтому говорим это прямо
    if (!n || !Z) return mine && Z ? `<section class="card st-c"><div class="over">Цифра за 12 ч, 30 дней</div><p class="sub">На своей машине смен пока нет: зоны появятся с первой сменой.</p></section>` : '';
    const [hi, lo] = Z.at, R = Z.R;
    const seg = (k, c) => z[k] ? `<i class="${c}" style="flex:${z[k]}"></i>` : '';
    // вывод по средней, и только с 10 смен: по одной-двум сменам решать про машину рано
    const row = (c, icon, t, k) => `<div class="st-zr"><i class="${c}">${ic(icon)}</i><span>${t}<small>${nb(ZONE_ROW[kind][k])}</small></span><b>${z[k]}</b></div>`;
    const perH = v => C.grp(Math.round(v / 10) * 10), mon = C.MON[+Z.mk.slice(5) - 1];
    return `<section class="card st-c"><div class="between"><div class="over">Цифра за 12 ч, 30 дней</div><span class="st-cap">${n} ${C.plural(n, ['смена', 'смены', 'смен'])}</span></div>
      <div class="st-stack">${seg('g', 'g')}${seg('y', 'y')}${seg('r', 'r')}</div>
      <div class="st-zl">${row('g', 'check', 'от ' + C.money(hi), 'g')}${row('y', 'clock', C.grp(lo) + '-' + C.money(hi), 'y')}${row('r', 'down', 'меньше ' + C.money(lo), 'r')}</div>
      <p class="sub">${n < 10 ? `Вывод будет, когда ${mine ? 'на своей машине' : 'за 30 дней'} наберётся 10 смен.` : `В среднем ${C.money(Math.round(z.avg / 100) * 100)} за 12 ч${mine ? ' на своей машине' : ''}: ${nb(zoneSay(S2st(), kind, z.top))}.`}</p>
      <p class="sub st-src">${nb(`${ZONE_HEAD[kind]}. Пороги посчитаны по твоему плану на ${mon} (${Z.sh} ${C.plural(Z.sh, ['смена', 'смены', 'смен'])} по ${C.num1(Math.round(Z.h * 10) / 10)} ч), жизни ${C.money(r1k(Z.life))} и сезону ${monthOf(mon)}. В оплате пассажиров это от ${perH(R[0])} и от ${perH(R[1])} ₸ в час.`)}</p></section>`;
  }
  // «ноября», «мая»: родительный падеж месяца
  const monthOf = mon => C.MONG[C.MON.indexOf(mon)] || mon;
  const S2st = () => S();
  function stMonths(S) {
    // с первого месяца, где есть смены, но не меньше 6 столбцов: пустой год слева ни к чему
    const ms = S.months, first = ms.findIndex(x => x.n), list = first < 0 ? [] : ms.slice(Math.min(first, 6));
    if (!list.length) return '';
    const withData = list.map((x, i) => x.n ? i : -1).filter(i => i >= 0);
    const si = UI.stM && list.some(x => x.mk === UI.stM && x.n) ? list.findIndex(x => x.mk === UI.stM) : withData[withData.length - 1], sm = list[si];
    // полоса зимы только там, где уже были смены: над пустыми месяцами слева она ничего не значит
    const f0 = list.findIndex(x => x.n), items = list.map((x, i) => ({ key: x.mk, v: x.perH, winter: x.winter && i >= f0 }));
    // сезон только в процентах: он в ценах ноября 2026 и без разницы аренды и своей машины, а столбцы как в Яндекс Про
    const ss = S.season, pct = ss ? Math.round(Math.abs(ss.diff) * 100) : 0;
    const ssn = !ss ? 'Сравню зиму и лето, когда будет хотя бы по 3 смены в каждом сезоне.' : pct < 1 ? 'Зимой выручка за час почти такая же, как летом.'
      : `Зимой выручка за час на ${pct}% ${ss.diff < 0 ? 'меньше' : 'больше'}, чем летом.`;
    return `<section class="card st-c"><div class="over">За час в приложении, ${S.kind === 'taxi' ? 'такси' : 'доставка'}</div><div class="st-cap st-cap2">${cap(C.MON[+sm.mk.slice(5) - 1])} ${sm.mk.slice(0, 4)}: <b>${perHText(sm.perH)}</b>${sm.n ? ` · ${sm.n} ${C.plural(sm.n, ['смена', 'смены', 'смен'])}` : ''}</div>
      ${stBars(items, si, 'st-m', list.map(x => MON1[+x.mk.slice(5) - 1]))}
      <p class="sub">${ssn}</p></section>`;
  }
  function stDays(S) {
    const ds = S.days; if (!ds.some(x => x.n)) return '';
    const best = ds.reduce((b, x) => x.n >= 2 && (!b || x.perH > b.perH) ? x : b, null), si = UI.stD != null && ds[UI.stD].n ? UI.stD : best ? best.i : ds.findIndex(x => x.n), sd = ds[si];
    const capT = UI.stD != null && ds[UI.stD].n ? `${cap(C.DOWL[si])}: <b>${perHText(sd.perH)}</b>` : best ? `Лучше всего платит ${C.DOWL[best.i]}: <b>${perHText(best.perH)}</b>` : `${cap(C.DOWL[si])}: <b>${perHText(sd.perH)}</b>`;
    return `<section class="card st-c"><div class="over">По дням недели, 90 дней</div><div class="st-cap st-cap2">${capT}</div>
      ${stBars(ds.map(x => ({ key: x.i, v: x.n ? x.perH : null })), si, 'st-d', C.DOW)}</section>`;
  }
  function stDrivers(S) {
    if (S.kind !== 'taxi') return '';
    const W = 320, x0 = 14, x1 = 306, lo = 1500, hi = 6000, X = v => x0 + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (x1 - x0), base = 58;
    const placed = [];
    let dots = '';
    for (const v of S.drivers.slice().sort((a, b) => a - b)) { const x = X(v); let lv = 0; while (placed.some(p => p.lv === lv && Math.abs(p.x - x) < 9.5)) lv++; placed.push({ x, lv }); dots += `<circle class="st-dot" cx="${x.toFixed(1)}" cy="${base - lv * 10}" r="4"/>`; }
    const me = S.me, mx = me ? X(me.rev) : 0;
    const meMark = me ? `<line class="st-me-l" x1="${mx}" x2="${mx}" y1="14" y2="${base + 6}"/><circle class="st-me" cx="${mx}" cy="${base}" r="6"/><text class="st-me-t" x="${Math.max(16, Math.min(W - 16, mx))}" y="10" text-anchor="middle">ты</text>` : '';
    const ticks = [2000, 3000, 4000, 5000].map(v => `<text class="st-lab" x="${X(v)}" y="${base + 24}" text-anchor="middle">${C.grp(v)}</text>`).join('');
    // вероятная оплата по исследованию 18.11: 2 900 опытного летом с ростом выручки, с сезоном и первыми неделями тех же дней
    // (core.shiftStats), чтобы водитель ровно на уровне исследования стоял на пунктире. Подпись с той стороны, где нет твоей линии
    const px = X(S.likely), side = me && mx <= px + 1 ? 1 : -1, r10 = v => C.grp(Math.round(v / 10) * 10);
    const likT = S.likely && Math.abs(S.likely / S.likelyBase - 1) >= 0.02 ? `Пунктир: вероятно в эти дни ${r10(S.likely)}, с поправкой на ${adjWhy(S2st(), 30)} (летом у опытного ${r10(S.likelyBase)}).` : `Пунктир: вероятно ${r10(S.likelyBase)}.`;
    const likely = S.likely ? `<line class="st-p50" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="16" y2="${base + 6}"/><text class="st-p50-t" x="${(px + side * 5).toFixed(1)}" y="25" text-anchor="${side > 0 ? 'start' : 'end'}">вероятно</text>` : '';
    return `<section class="card st-c"><div class="over">Ты среди водителей</div>
      <div class="st-cap st-cap2">${me ? `Ты: <b>${C.money(Math.round(me.rev))} оплаты пассажиров в час</b>, ${!me.above ? `ниже всех ${me.total} отчётов` : me.above === me.total ? `выше всех ${me.total} отчётов` : `выше, чем в ${me.above} из ${me.total} отчётов`}` :'Покажу твоё место, когда за 30 дней будет 3 смены такси с суммой.'}</div>
      <svg class="st-svg" viewBox="0 0 ${W} ${base + 30}" role="img"><line class="st-base" x1="${x0}" x2="${x1}" y1="${base + 8.5}" y2="${base + 8.5}"/>${likely}${dots}${meMark}${ticks}</svg>
      <p class="sub">${nb(`Оплата пассажиров в час: твоя за 30 дней и ${S.drivers.length} ${C.plural(S.drivers.length, ['отчёт', 'отчёта', 'отчётов'])} водителей Астаны из исследования 18.11. ${likT} Обычные дни 2 600-3 300, соревнования и удачные дни выше.`)}</p></section>`;
  }
  function stTiles(S) {
    const t = S.tiles, mon = C.MON[+TODAY.slice(5, 7) - 1], tile = (k, v, s) => `<div class="st-t"><span>${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    return `<section class="card st-c st-grid">${tile('Смен в ' + monthIn(mon), t.shifts, '')}${tile('Часов в ' + monthIn(mon), C.num1(Math.round(t.hours * 10) / 10), '')}
      ${tile('Средняя смена', t.avgLen ? C.num1(Math.round(t.avgLen * 10) / 10) + ' ч' : '-', 'за 30 дней')}${tile('Лучшая смена', t.best ? C.money(Math.round(t.best.perH)) : '-', t.best ? 'в час, ' + (t.best.d.slice(0, 4) !== TODAY.slice(0, 4) ? t.best.d.split('-').reverse().join('.') : C.dateShort(t.best.d)) : '')}</section>`;
  }
  // «в ноябре», «в мае»: как inMonth, но без года
  const monthIn = mon => ({ 'май': 'мае', 'март': 'марте', 'август': 'августе' })[mon] || mon.replace(/ь$/, 'е').replace(/й$/, 'е');
  function statsView() {
    const S = C.shiftStats(S2st(), TODAY), any = Object.keys(S2st().shifts).some(d => d <= TODAY && S2st().shifts[d].h > 0);
    const empty = `<section class="card st-empty"><div class="kb-lock-i">${ic('chart')}</div><div class="h3">${any ? 'Нужны суммы смен' : 'Пока пусто'}</div><p class="sub">Внеси смены с суммой из Яндекс Про, и здесь появятся графики.</p></section>`;
    if (!any) return empty;
    return (S.kind ? stZones(S) + stMonths(S) + stDays(S) + stDrivers(S) : empty) + stTiles(S);
  }
  // студия: когда можно купить по прогнозу, своя часть (весь депозит), заём, платёж и переплата; счёт в core.studio.
  // Цена на ползунке сегодняшняя, к покупке она дорожает: это одна короткая строка под плитками
  function studioOut(r) {
    const tile = (k, v, s) => `<div class="st-t"><span>${k}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a[0] || '';
    const L = r.loan > 0, half = r.rough || r.beyond, yrs = y => y + '\u00a0' + C.plural(y, ['год', 'года', 'лет']);
    const tiles = tile(half ? 'Своя половина' : 'Своя часть', mlnShort(r.own), half ? '' : L ? 'весь депозит Отбасы' : 'депозита хватает')
      + tile('Заём', L ? mlnShort(r.loan) : 'не нужен', L ? `под ${C.num1(r.tier.rate)}% на ${yrs(r.tier.years)}` : '')
      + tile('Платёж в месяц', L ? C.money(Math.round(r.pay / 100) * 100) : '-', '') + tile('Переплата', L ? mlnShort(r.over) : '-', L ? 'за весь срок' : '');
    const when = t => `<div class="st-when">${ic('cal')}<span>${t}</span></div>`, note = t => t ? `<p class="sub st-note">${t}</p>` : '';
    if (r.rough) return tiles + note('Пока считаю пополам и по ОП 16. Укажи в настройках, когда открыт депозит Отбасы, и посчитаю точнее.');
    if (r.beyond) { const miss = and([r.needTime ? 'трёх лет у депозита' : '', r.needHalf ? 'половины цены на депозите' : '', r.needOp ? 'ОП от 16' : ''].filter(Boolean));
      return when('Покупка за горизонтом прогноза') + tiles + note(`${miss ? `К концу прогноза ещё не будет ${miss}. ` : ''}Пока считаю пополам и по ОП 16.`); }
    const up = r.at - r.price >= 50000, ds = L && Math.abs(r.ds - r.at) >= 50000, atT = mlnShort(Math.round(r.at / 1e5) * 1e5);
    const txt = (up ? `К покупке она подорожает примерно до ${atT} (жильё дорожает около 10% в год).` : '')
      + (ds ? (up ? ` На столько же нужна договорная сумма, сейчас она ${mlnShort(r.ds)}.` : `Договорная сумма нужна ${atT}, сейчас она ${mlnShort(r.ds)}.`) : '');
    return when(r.now ? 'Купить можно уже сейчас' : r.from ? 'Купить можно с ' + C.dateLong(r.from) : 'Купить можно ' + inMonth(r.buy)) + tiles + note(txt);
  }
  function studioView(m) {
    const st = m.st, ds = st.set.ds > 0 ? st.set.ds : 2 * st.set.target, price = UI.studio || Math.min(16000000, Math.max(6000000, Math.round(ds / 100000) * 100000));
    UI.stFc = m.fc;
    return `<section class="card st-studio"><div class="over">Цена студии сейчас</div><div class="st-price" id="st-p">${mlnShort(price)}</div>
      <input type="range" class="st-range" id="st-range" min="6000000" max="16000000" step="100000" value="${price}" aria-label="Цена студии сейчас">
      <div class="st-scale"><span>6 млн</span><span>16 млн</span></div>
      <div class="st-grid" id="st-out">${studioOut(C.studio(st, TODAY, m.fc, price))}</div></section>`;
  }
  function vStats() {
    const m = model(), tab = UI.statsTab || 'stats';
    return `<header class="top"><div class="top-r"><button class="icon-btn" data-a="sub-back" aria-label="Назад">${ic('left')}</button><div><div class="top-k">Смены и студия</div><h1 class="top-t">Цифры</h1></div></div></header>
      <div class="segm st-seg">${[['stats', 'Смены'], ['studio', 'Студия 50/50']].map(([k, n]) => `<button data-a="st-tab" data-v="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>
      ${tab === 'studio' ? studioView(m) : statsView()}`;
  }

  // ---------------------------------------------------------------- профиль
  const CATS = ['Смены', 'Часы', 'Серия', 'Недели', 'Месяц', 'Сверх плана', 'Учёт', 'Деньги', 'Машина', 'Рекорды', 'Боссы', 'Задания', 'Особые', 'Голова'];
  // наклейки из легендарных сундуков: одна на крыше, нажал ещё раз, и снял
  function stickersRow(pl) {
    const got = pl.stickers || [], all = G.STICKERS;
    return `<div class="sec-h"><div class="h3">Наклейки</div><span class="link">${got.length} из ${all.length}</span></div>
      <section class="card">${got.length ? `<div class="stk-row">${got.map(x => `<button class="stk${pl.skin.sticker === x.id ? ' on' : ''}" data-a="sticker" data-id="${x.id}" aria-pressed="${pl.skin.sticker === x.id}">${D.stickerIcon(x.id)}<small>${esc(x.name)}</small></button>`).join('')}</div>
        <div class="sub">${pl.skin.sticker ? 'Нажми на выбранную, чтобы снять её с крыши.' : 'Нажми, и наклейка поедет на крыше.'}</div>`
        : '<p class="sub" style="margin-top:0">Наклейки дают легендарные сундуки, по одной за раз. Их 12, последняя 4M.</p>'}</section>`;
  }
  function vMe() {
    if (UI.sub === 'settings') return vSettings();
    refresh();
    const st = S(), pl = playerOf(st, TODAY), rk = pl.rank, c = Store.cloud, x = pl.stats;
    const on = pl.badges.filter(b => b.on).length;
    const cloudTxt = c.status === 'ok' ? `В облаке${c.user ? ': ' + esc(c.user.email || '') : ''}. Данные есть на всех устройствах.` : c.status === 'error' ? esc(c.error) : c.status === 'sync' || c.status === 'loading' ? 'Подключаюсь…' : 'Данные только на этом телефоне. Войди через Google, чтобы не потерять их и видеть на других устройствах.';
    const recs = pl.recs.slice().reverse().slice(0, 5);
    return `
    <header class="top"><div><div class="top-k">Профиль</div><h1 class="top-t">Прокачка</h1></div><div class="top-r"><button class="icon-btn" data-a="sub" data-v="settings" aria-label="Настройки">${ic('gear')}</button></div></header>
    <section class="prof">${D.hex(pl.level, 92)}<div class="prof-rank">${esc(rk.title)}</div><div class="prof-lv">Уровень ${pl.level}</div>
      <div class="xpbar big"><i style="width:${(pl.pct * 100).toFixed(1)}%"></i></div>
      <div class="prof-xp"><span><b>${C.grp(pl.into)}</b> из ${C.grp(pl.need)} XP</span><span>до ${pl.level + 1} уровня</span></div>
      ${rk.next ? `<div class="prof-next">Следующее звание: <b>${esc(rk.next.title)}</b> с ${rk.next.level} уровня</div>` : '<div class="prof-next">Высшее звание</div>'}</section>
    <div class="stats">
      <div class="stat"><b>${C.grp(pl.xp)}</b><span>опыта всего</span></div>
      <div class="stat"><b>${C.grp(Math.round(x.hours))}</b><span>${C.plural(Math.round(x.hours), ['час', 'часа', 'часов'])} работы</span></div>
      <div class="stat"><b>${C.grp(x.shifts)}</b><span>${C.plural(x.shifts, ['смена', 'смены', 'смен'])}</span></div>
      <div class="stat"><b>${x.best}</b><span>${C.plural(x.best, ['смена подряд', 'смены подряд', 'смен подряд'])}, рекорд</span></div>
      <div class="stat"><b>${x.bosses}</b><span>${C.plural(x.bosses, ['босс побеждён', 'босса побеждено', 'боссов побеждено'])}</span></div>
      <div class="stat"><b>${on} из ${pl.badges.length}</b><span>наград</span></div></div>
    ${pl.freezes || pl.streak ? `<section class="card"><div class="between"><div><div class="over">Серия</div><div class="h3">${pl.streak} ${C.plural(pl.streak, ['смена', 'смены', 'смен'])} подряд · комбо ×${C.num1(pl.combo)}</div></div><span class="chip violet">${ic('snow')}${pl.freezes} из 2</span></div>
      <div class="sub">Каждые ${14 - 2 * G.rk(st, 'ice')} смен подряд дают заморозку: один пропуск не сбросит серию. Выходные по плану серию не рвут. Комбо добавляет ${5 + G.rk(st, 'combo')}% опыта за каждую смену серии, до ×1,5.</div></section>` : ''}
    ${attrsCard(pl)}
    ${skillsCard(pl)}
    ${recs.length ? `<div class="sec-h"><div class="h3">Рекорды</div></div><section class="card">${recs.map(r => `<div class="xp-row"><div>${r.kind === 'day' ? 'Заработок за день' : r.kind === 'week' ? 'Часов за неделю' : 'Заработок за месяц'}<small>${C.dateLong(r.d)}</small></div><b>${r.kind === 'week' ? C.num1(r.v) + ' ч' : C.money(r.v)}</b></div>`).join('')}</section>` : ''}
    <div class="sec-h"><div class="h3">Награды</div><span class="link">${on} из ${pl.badges.length}</span></div>
    ${CATS.map(cat => { const bs = pl.badges.filter(b => b.cat === cat); return bs.length ? `<div class="cat-h">${cat}</div><div class="bd-row">${bs.map(badgeTile).join('')}</div>` : ''; }).join('')}
    ${carCard(st)}
    <div class="sec-h"><div class="h3">Гараж</div><span class="link">цвет машины на дороге</span></div>
    <div class="garage">${G.SKINS.map(s => `<button class="skin${s.id === pl.skin.id ? ' on' : ''}${s.level > pl.level ? ' locked' : ''}" data-a="skin" data-id="${s.id}">${D.carIcon(s.body, s.shade, s.level <= pl.level ? pl.skin.sticker : null)}${esc(s.name)}<small>${s.level > pl.level ? 'с ' + s.level + ' уровня' : s.id === pl.skin.id ? 'выбрана' : 'открыта'}</small></button>`).join('')}</div>
    ${stickersRow(pl)}
    <div class="sec-h"><div class="h3">Опыт</div><span class="link">+${C.grp(pl.weekXp)} XP за неделю</span></div>
    <section class="card">${pl.ledger.slice().reverse().slice(0, 30).map(e => `<div class="xp-row"><div>${esc(e.text)}<small>${C.dateLong(e.d)}</small></div>${xpChip(e.xp)}</div>`).join('') || '<p class="lead" style="margin-top:0">Опыт дают смены, задания дня, переводы в Отбасы и вехи пути.</p>'}</section>
    <div class="sec-h"><div class="h3">Данные</div></div>
    <section class="card"><p class="lead" style="margin-top:0">${cloudTxt}</p>
      <div class="btns">${c.user ? '<button class="btn alt sm" data-a="signout">Выйти</button>' : `<button class="btn sm" data-a="signin">${ic('cloud')}Войти через Google</button>`}</div>
      <button class="row-btn" data-a="export">${ic('dl')}<span>Скачать копию</span></button>
      <label class="row-btn tap">${ic('ul')}<span>Восстановить из файла</span><input type="file" accept="application/json,.json" data-a="import" hidden></label>
      <button class="row-btn" data-a="stats">${ic('chart')}<span>Цифры: смены и студия</span>${ic('right')}</button>
      <button class="row-btn" data-a="kb">${ic('book')}<span>Заметки</span>${ic('right')}</button>
      <button class="row-btn" data-a="sub" data-v="settings">${ic('gear')}<span>Настройки и расчёт</span>${ic('right')}</button></section>
    <div class="sec-h"><div class="h3">Как растёт опыт</div></div>
    <section class="card"><p class="sub" style="margin-top:0">Час работы +${XPN().hour} XP, с комбо серии (+${Math.round(XPN().comboStep * 100)}% за каждую смену подряд) до ×1,5. Сумма за день +${XPN().app}. Задания дня: план +${XPN().planDay}, заработок +${XPN().moneyDay}, заказы +${XPN().ordersDay}, все сразу открывают сундук: обычный 50-120, редкий 150-200, легендарный 300 и наклейка на машину. Неделя без недобора +${XPN().week}, босс месяца +${XPN().boss}, жизнь на месяц оплачена +${XPN().paid}, рекорд +${XPN().record}. Отдых при низкой энергии +${XPN().rest}, отметка настроения +${XPN().mood}. Перевод в Отбасы +${XPN().per1000} за 1 000 ₸, плитка квартиры +${XPN().tile}. Вехи от 150 до 1 000, свои задания +${XPN().own}, награды от 50 до 5 000. Всё считается из записей: поправил смену, опыт пересчитался.</p></section>`;
  }
  // характеристики: уровень 1-10 из реальных записей и слабое место
  function attrsCard(pl) {
    const a = pl.attrs;
    return `<div class="sec-h"><div class="h3">Характеристики</div></div><section class="card">
      ${a.list.map(x => `<div class="attr"><div class="attr-i">${ic(x.icon)}</div><div class="attr-b"><div class="attr-t"><b>${esc(x.title)}</b><span>${x.lvl} из 10</span></div>
        <div class="attr-bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < x.lvl ? 'on' : ''}"></i>`).join('')}</div><div class="attr-s">${esc(x.val)}</div></div></div>`).join('')}
      ${a.weak ? `<div class="praise green" style="margin-top:12px"><div class="praise-i">${ic('target')}</div><div class="praise-b"><div class="praise-t">Качай: ${esc(a.weak.title)}</div><div class="praise-s">${esc(a.weak.tip)}</div></div></div>` : ''}</section>`;
  }
  // навыки: очко за каждые 2 уровня, у навыка 3 ступени, ступень открывается с уровня
  function skillsCard(pl) {
    const sk = pl.skills, br = ['Работа', 'Деньги', 'Голова'];
    return `<div class="sec-h"><div class="h3">Навыки</div><span class="chip ${sk.free > 0 ? 'yellow' : 'plain'}">${ic('star')}очков: ${sk.free}</span></div>
      <section class="card"><div class="sub" style="margin-top:0">Очко навыка даётся за каждые 2 уровня. Ступень действует со дня, когда ты её изучил.</div>
      ${br.map(b => `<div class="cat-h">${b}</div>${sk.list.filter(x => x.br === b).map(x => `<div class="perk${x.r ? ' on' : ''}"><div class="perk-i">${ic(x.icon)}</div>
        <div class="perk-b"><div class="perk-t"><b>${esc(x.title)}</b><span class="dots">${[0, 1, 2].map(i => `<i class="${i < x.r ? 'on' : ''}"></i>`).join('')}</span></div>
        <div class="perk-s">${x.r ? esc(x.now) : 'Пока не изучен'}${x.r < 3 ? `<br><span class="dim">Дальше: ${esc(x.next)}</span>` : ''}</div></div>
        ${x.r < 3 ? (x.can && sk.free > 0 ? `<button class="btn sm perk-btn" data-a="perk" data-id="${x.id}">${ic('plus')}</button>` : `<span class="perk-lock">${ic('lock')}${x.nextLvl} ур.</span>`) : `<span class="perk-lock done">${ic('check')}</span>`}</div>`).join('')}`).join('')}
      ${sk.spent ? '<button class="btn ghost" data-a="perk-reset">Сбросить навыки и вернуть очки</button>' : ''}</section>`;
  }
  // машина для такси: выбор пересчитывает прогноз. Газ не улучшение: Яндекс Про в Астане проверяет машину без ГБО (он только в настройках)
  function carCard(st) {
    const g = st.set, cur = C.CARS.find(c => c.price === g.price && c.down === g.down);
    const mine = st.car, lp = mine ? C.loanPlan(st, TODAY) : null;
    return `<div class="sec-h"><div class="h3">Машина для такси</div><span class="link">меняет прогноз</span></div>
      ${mine ? `<section class="card"><button class="car-row on" data-a="car-edit"><span><b>${esc(mine.name)}</b><small>своя с ${C.dateShort(mine.on)} ${mine.on.slice(0, 4)} · ${C.money(mine.price)} · ${lp ? (lp.bal > 0 ? 'кредит ' + C.money(Math.round(lp.pay)) + ' в месяц' : 'кредит закрыт') : 'без кредита'}</small></span>${ic('gear')}</button>
        <div class="sub">Платёж, досрочку и остаток кредита видно в Деньгах, в карточке Моя машина.</div></section>`
      : `<section class="card">${C.CARS.map(c => `<button class="car-row${cur && cur.id === c.id ? ' on' : ''}" data-a="car-preset" data-id="${c.id}">
        <span><b>${esc(c.name)}</b><small>${esc(c.how)} · ${C.money(c.price)} · простой ${C.num1(c.lost)} смены в месяц</small></span>${cur && cur.id === c.id ? ic('check') : ''}</button>`).join('')}
      <div class="sub">Это примеры для прогноза, все напрямую с Яндексом, без парка. Права на автомате дают ездить и на механике, дешёвые машины почти все на механике. Цены: медианы объявлений на 17.11.2026.</div>
      <div class="btns"><button class="btn alt" data-a="car-buy">${ic('car')}Купил машину: записать свою</button></div></section>`}`;
  }
  const badgeTile = b => `<button class="bd${b.on ? '' : ' locked'}" data-a="badge" data-id="${b.id}">${D.medal(b.icon, b.color || 'violet', !b.on)}<b>${esc(b.title)}</b><span>${b.on ? C.dateShort(b.on) : progText(b)}</span>${b.on ? '' : `<div class="pbar sm"><i style="width:${(b.pct * 100).toFixed(1)}%"></i></div>`}</button>`;
  const FIELDS = [
    ['Цель', [['target', 'Сумма цели, ₸', 'money'], ['deadline', 'Срок', 'date'], ['why', 'Зачем тебе квартира (увидишь, когда тяжело)', 'text'], ['ds', 'Договорная сумма Отбасы, ₸', 'money', g => C.grp(2 * g.target) + ', вдвое больше цели'], ['maxWeek', 'Потолок часов в неделю', 'num']]],
    ['До такси: подработка', [['preFrom', 'Подработка с (пусто: без неё)', 'date'], ['preRate', 'Чистыми в час, ₸', 'money'], ['preOnce', 'Разовые траты до такси: автошкола, справки, залоги, ₸', 'money'], ['preOnceDate', 'Когда платишь', 'date'], ['startBuf', 'Запас на старт такси: залог, первые дни, ₸', 'money']]],
    ['Конверты до такси, в месяц', C.ENV.map(k => ['envPre.' + k, C.ENV_TITLE[k] + ', ₸', 'money'])],
    ['Конверты на такси, в месяц', C.ENV.map(k => ['env.' + k, C.ENV_TITLE[k] + ', ₸', 'money'])],
    // R: летний месяц опытного водителя в ценах rBase. Если вписать цифру зимы или первых недель, прогноз ещё раз снимет с неё сезон и разгон
    ['Такси', [['R', 'Пассажиры платят за час на линии летом, ₸', 'money'], ['rLog', 'Считать по моим сменам (от 10 смен)', 'bool']],
      g => `Картой + Наличными у опытного водителя летом, после первых двух месяцев, в ценах ${C.MONG[+(g.rBase || g.start).slice(5) - 1]} ${(g.rBase || g.start).slice(0, 4)}. Зиму, первые недели и рост цен прогноз добавит сам. По исследованию 18.11 вероятно 2 900 ₸, плохой месяц 2 500, хороший 3 400.`],
    ['Даты', [['otbOpen', 'Депозит Отбасы открыт', 'date'], ['license', 'Права', 'date'], ['taxiFrom', 'Первая смена в такси', 'date'], ['carFrom', 'Своя машина с (пусто: всё время аренда)', 'date']]],
    ['Машина', [['price', 'Цена машины, ₸', 'money'], ['down', 'Взнос, %', 'num'], ['v36', 'Цена продажи через 3 года, ₸', 'money'], ['l100', 'Расход в среднем за год, л на 100 км', 'num'], ['repairKm', 'Ремонт старой машины сейчас, ₸ на 1 км', 'price1'], ['repair', 'Свой резерв на ремонт в месяц, ₸', 'price'], ['fuel', 'Топливо', 'fuel'], ['gasFrom', 'Газ с (пусто: сразу с покупки)', 'date']]],
    ['Топливо', [['petrol', 'Бензин сейчас, ₸ за литр', 'price'], ['gas', 'Газ сейчас, ₸ за литр', 'price']]],
    ['Аренда', [['rentDay', 'Аренда в сутки сейчас, ₸', 'rprice'], ['rentL100', 'Расход арендной машины в среднем за год, л на 100 км', 'num']],
      () => 'Первый в Яндекс Гараже на 18.11.2026: 10 000 в день и 5,9% парку, выходной не платишь. Летом расход меньше, зимой больше.'],
  ];
  // газ остаётся настройкой, но не советом (исследование 18.11, база знаний Яндекс Про standards-check/skk)
  const GAS_NOTE = nb('Яндекс Про в Астане на очной проверке требует машину без ГБО, а на машину в залоге Kaspi доп. оборудование ставят только с согласия банка.');
  const getF = (g, k) => k.indexOf('.') > 0 ? (g[k.split('.')[0]] || {})[k.split('.')[1]] : g[k];
  function vSettings() {
    const g = S().set, FN = C.growth(g, TODAY.slice(0, 7))[0];
    // конверты хранятся в ценах начала пути, а месяц показывает их с ростом цен
    const priceNote = key => `<p class="sub">Суммы в ценах ${C.dateLong(g.start + '-01').replace(/^\d+\s/, '')}. Каждый месяц они растут вместе с ценами, на ${C.num1(g.gCost)}% в год: сейчас выходит ${C.money(Math.round(C.envSum(g[key]) * C.growth(g, TODAY.slice(0, 7))[0] / 1000) * 1000)} в месяц.</p>`;
    const field = ([k, label, type, ph]) => {
      const v = getF(g, k);
      if (type === 'bool') return `<label class="fld sw"><span>${label}</span><input type="checkbox" data-f="${k}" ${v ? 'checked' : ''}></label>`;
      if (type === 'fuel') return `<div class="fld"><span>${label}</span><div class="segm">${[['petrol', 'бензин'], ['gas', 'газ']].map(([x, n]) => `<button data-a="fuel" data-v="${x}" aria-pressed="${v === x}">${n}</button>`).join('')}</div><p class="sub">${GAS_NOTE}</p></div>`;
      // сумма с копейками в сегодняшних ценах (ремонт на км)
      if (type === 'price1') return `<label class="fld"><span>${label}</span><input inputmode="decimal" data-f="${k}" data-t="price1" value="${C.num1((+v || 0) * FN)}"></label>`;
      if (type === 'date') return `<label class="fld"><span>${label}</span><input type="date" data-f="${k}" value="${esc(v || '')}"></label>`;
      if (type === 'text') return `<label class="fld"><span>${label}</span><input data-f="${k}" data-t="text" maxlength="120" value="${esc(v || '')}" placeholder="например: своя квартира в 23"></label>`;
      // rprice: аренда, она растёт с ценами только после rBase (C.rentF)
      if (type === 'price' || type === 'rprice') return `<label class="fld"><span>${label}</span><input inputmode="numeric" data-f="${k}" data-t="${type}" value="${fmtIn(Math.round(v * (type === 'rprice' ? C.rentF(g, TODAY.slice(0, 7)) : FN)))}"></label>`;
      return `<label class="fld"><span>${label}</span><input inputmode="decimal" data-f="${k}" data-t="${type}" value="${type === 'money' ? fmtIn(v) : esc(String(v == null ? '' : v).replace('.', ','))}"${ph ? ` placeholder="${esc(ph(g))}"` : ''}></label>`;
    };
    // своя машина записана: её цена и кредит меняются в карточке Моя машина. Свой резерв на ремонт в месяц виден, только если он задан
    const carOwn = ['price', 'down', 'v36'], hide = f => (S().car && carOwn.indexOf(f[0]) >= 0) || (f[0] === 'repair' && !(g.repair > 0));
    const p = v => C.money(Math.round(v * FN)), rb = C.MONG[+(g.rBase || g.start).slice(5) - 1] + ' ' + (g.rBase || g.start).slice(0, 4);
    return `
    <header class="top"><div class="top-r"><button class="icon-btn" data-a="sub-back" aria-label="Назад">${ic('left')}</button><div><div class="top-k">Профиль</div><h1 class="top-t">Настройки</h1></div></div></header>
    ${FIELDS.map(([t, fs, note]) => `<section class="card"><div class="over">${t}</div>${t === 'Машина' && S().car ? `<p class="sub">Своя машина записана: ${esc(S().car.name)}. Цена и кредит меняются в Деньгах, в карточке Моя машина.</p>` : ''}${fs.filter(f => !hide(f)).map(field).join('')}${t.indexOf('Конверты') === 0 ? priceNote(t.indexOf('до такси') > 0 ? 'envPre' : 'env') : ''}${note ? `<p class="sub">${nb(note(g))}</p>` : ''}</section>`).join('')}
    <section class="card"><div class="over">План</div><p class="sub">С планом сравнивается, впереди ты или отстаёшь. Если поменял цель, даты или машину, пересчитай план от сегодня.</p>
      <div class="btns"><button class="btn alt sm" data-a="rebase">Пересчитать план от сегодня</button></div></section>
    <section class="card"><div class="over">Как считается</div><p class="sub">${nb(`Помесячно, по исследованию 18.11. Пассажиры платят ${C.money(g.R)} в час на линии летом у опытного водителя, в ценах ${rb}: до ${rb} тариф ровный, дальше растёт на ${C.num1(g.gRev)}% в год. Январь и февраль на 12% слабее, март на 5%, с сентября по декабрь на 5% сильнее. Первые 30 дней такси 87%, следующие 30 дней 97%. Часы сверх 12 в смене дают 95%.`)}</p>
      <p class="sub">${nb(`Комиссия Яндекса ${C.num1(g.yandex)}%, соцплатежи ${C.num1(g.tax)}%, чаевые +${C.num1(g.tips)}%. Парк ${C.num1(g.park)}% только на аренде, своя машина напрямую с Яндексом. Свои пропуски ${C.num1(g.lostMe)} смены в месяц, на аренде за них ${g.rentLostPay}% аренды, своя ещё ${C.num1(g.lost)} дня в ремонте. Бензин ${p(g.petrol)} за литр, ${C.num1(g.kmH)} км за час на линии, ремонт своей ${C.num1(g.repairKm * FN)} ₸ на км.`)}</p>
      <p class="sub">${nb(`Рост цен ${C.num1(g.gCost)}% в год, кредит около 2,5% в месяц с досрочкой, Отбасы 2% годовых и премия 20% до 200 МРП в год. Жизнь вычитается по конвертам, машина считается по цене продажи, кредит вычитается. При покупке машины кроме взноса сразу уходят страховки, регистрация, диагностика и первое ТО: сейчас около ${C.money(r1k((g.ogpo + g.osgop + g.regFee + g.diag + (g.buyOther || 0)) * FN))}.`)}</p>
      <p class="sub">${nb(`Лимит самозанятого считается по всему доходу за месяц, такси и доставка вместе: 1 297 500 ₸ в 2026 году и 1 407 900 в 2027, если подпишут бюджет с МРП 4 693. Выше нужно ИП.`)}</p></section>
    ${'Notification' in window ? `<section class="card"><div class="over">Телефон</div><label class="fld sw"><span>Показывать смену с таймером в шторке</span><input type="checkbox" data-shade="1"${shadeOn() ? ' checked' : ''}></label></section>` : ''}
    <section class="card"><button class="btn danger" data-a="reset">${ic('trash')}Стереть всё на этом телефоне</button></section>`;
  }

  // ---------------------------------------------------------------- первый запуск
  const OB = {};
  function vOnboard() {
    const g = S().set, st = UI.onb, c = Store.cloud;
    const steps = [
      `<div class="ob-art">${D.hex(1, 84)}</div><h1 class="ob-t">Путь к квартире</h1>
       <p class="lead">Цель: ${C.money(g.target)} активов к ${C.dateLong(g.deadline)}. Машина тоже считается: её можно продать.</p>
       <p class="lead">За смены, задания дня и пройденные вехи получаешь опыт, растёшь в уровнях и открываешь награды.</p>
       <label class="fld"><span>Цель, ₸</span><input inputmode="numeric" data-f="target" data-t="money" value="${fmtIn(g.target)}"></label>
       <label class="fld"><span>Срок</span><input type="date" data-f="deadline" value="${esc(g.deadline)}"></label>
       <button class="btn ghost" data-a="signin">${ic('cloud')}${c.status === 'sync' || c.status === 'loading' ? 'Подключаюсь…' : 'Уже пользовался? Войти через Google'}</button>`,
      `<h1 class="ob-t">Сколько у тебя сейчас</h1><p class="lead">Можно примерно. Потом сверишь во вкладке Деньги.</p>
       ${[['cash', 'Деньги: карты, наличные, вклады'], ['otb', 'Отбасы'], ['car', 'Машина, цена продажи (если есть)'], ['loan', 'Кредит, остаток (если есть)']].map(([k, n]) => `<label class="fld"><span>${n}, ₸</span><input inputmode="numeric" data-ob="${k}" value="${fmtIn(OB[k])}"></label>`).join('')}`,
      `<h1 class="ob-t">Твой путь</h1><p class="lead">Даты из плана. Если что-то сдвинется, поменяешь в настройках.</p>
       <label class="fld"><span>Подработка с (доставка до такси)</span><input type="date" data-f="preFrom" value="${esc(g.preFrom)}"></label>
       <label class="fld"><span>Права</span><input type="date" data-f="license" value="${esc(g.license)}"></label>
       <label class="fld"><span>Первая смена в такси</span><input type="date" data-f="taxiFrom" value="${esc(g.taxiFrom)}"></label>
       <label class="fld"><span>Своя машина с</span><input type="date" data-f="carFrom" value="${esc(g.carFrom)}"></label>
       <label class="fld"><span>Разовые траты до такси (автошкола, справки, залоги), ₸</span><input inputmode="numeric" data-f="preOnce" data-t="money" value="${fmtIn(g.preOnce)}"></label>`,
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
    sheetOpen = false; UI.inst = null;
    if (UI.receipt) { UI.receipt = false; setTimeout(() => { render(); celebrate(); }, 240); }
    const root = $('#sheet'); root.classList.remove('open');
    setTimeout(() => { if (!sheetOpen) { root.hidden = true; root.innerHTML = ''; } }, 220);
    if (!fromPop && history.state && history.state.put === 'sheet') { ignorePop++; history.back(); }
  }
  // вкладки: с Главной уходим шагом в истории, назад с любой вкладки ведёт на Главную.
  // Шаги настроек и вкладки снимаем одним прыжком: два back() подряд браузер выполняет позже и путает
  function goTab(to) {
    let back = 0;
    if (UI.sub && history.state && (history.state.put === 'sub' || history.state.put === 'kbnote')) back += UI.subDepth || 1;
    UI.sub = null; UI.kbNote = null; UI.kbStack = []; UI.subDepth = 0;
    try {
      if (to !== 'home' && UI.tab === 'home' && !UI.tabEntry) { history.pushState({ put: 'tab' }, ''); UI.tabEntry = true; }
      else if (to === 'home' && UI.tabEntry) { back++; UI.tabEntry = false; }
      if (back) { ignorePop++; history.go(-back); }
    } catch (e) { /* ок */ }
    UI.tab = to; UI.week = 0; UI.sel = null; clearDraft();
    try { sessionStorage.setItem('put.tab', to); } catch (e) { /* ок */ }
    render();
  }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    if (sheetOpen) closeSheet(true);
    else if (UI.sub === 'kb' && UI.kbNote) { UI.kbNote = (UI.kbStack || []).pop() || null; UI.kbHl = ''; UI.subDepth = Math.max(1, (UI.subDepth || 2) - 1); render(); window.scrollTo(0, UI.kbNote ? 0 : UI.kbScroll || 0); }
    else if (UI.sub) { UI.sub = null; UI.subDepth = 0; render(); }
    else if (UI.tab !== 'home') { UI.tab = 'home'; UI.sel = null; UI.tabEntry = false; try { sessionStorage.setItem('put.tab', 'home'); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); }
    // старый шаг истории, которому уже нечего закрыть (после перезагрузки): проходим его, чтобы назад не нажимался вхолостую
    else if (history.state && history.state.put) { try { history.back(); } catch (e) { /* ок */ } }
  });
  function logSheet(d, preH) {
    const st = S(), x = Object.assign({}, st.shifts[d] || {}, preH != null ? { h: preH } : {}), plan = C.planHours(st, d);
    sheet(`<div class="sh-t">${cap(C.DOWL[C.dow(d)])}, ${C.dateLong(d)}</div><div class="sh-s">По плану: ${plan > 0 ? workName(st, d).toLowerCase() + ' ' + C.num1(plan) + ' ч' : 'выходной'}</div>
      <div class="quick">${[0, 4, 6, 8, 10, 12, 13, 14, 15, 16].map(h => `<button class="q${x.h != null && +x.h === h ? ' sel' : ''}${h === plan && plan > 0 ? ' plan' : ''}" data-a="pick-h" data-d="${d}" data-h="${h}">${h}<small>ч</small></button>`).join('')}</div>
      <label class="fld"><span>Часов</span><input inputmode="decimal" id="f-h" value="${x.h != null ? C.num1(+x.h || 0) : ''}" placeholder="${plan || 0}"></label>
      <div class="fld2"><label class="fld"><span>Заработал за день, ₸</span><input inputmode="numeric" id="f-app" value="${fmtIn(+x.app || 0)}" placeholder="сумма"></label>
        <label class="fld"><span>Заказов</span><input inputmode="numeric" id="f-ord" value="${+x.orders || ''}" placeholder="0"></label></div>
      <div class="preview" id="f-pv"></div>
      <div class="btns"><button class="btn" data-a="save-log" data-d="${d}">${ic('check')}Сохранить</button></div>
      ${st.shifts[d] ? `<button class="btn danger" data-a="del-log" data-d="${d}">${ic('trash')}Удалить запись</button>` : ''}`);
    sheetPreview(d);
  }
  function sheetPreview(d) {
    const el = $('#f-pv'); if (!el) return;
    const h = parseNum($('#f-h').value), st = S();
    if (h == null) { el.innerHTML = ''; return; }
    const hh = Math.max(0, Math.min(24, h)), app = num0($('#f-app').value), ord = num0($('#f-ord').value), pv = G.preview(st, d, hh, app, ord);
    el.innerHTML = praiseBox(praiseOf(st, d, C.forecast(st, TODAY), { h: hh, app }), pv.xp);
  }
  function moneySheet() {
    // ОП, уже вписанный сегодня, остаётся в поле: пересохранение сверки его не теряет
    const st = S(), np = nowParts(st), opToday = (st.money.find(x => x.d === TODAY && !C.isAdd(x) && x.op > 0) || {}).op;
    const last = { cash: r1k(np.cash), otb: Math.round(np.otb), car: r1k(np.car), loan: Math.round(np.loan) };
    sheet(`<div class="sh-t">Сверить: сколько сейчас</div><div class="sh-s">Активы = деньги + Отбасы + машина − кредит. Подставлено, сколько примерно должно быть.</div>
      ${[['cash', 'Деньги: карты, наличные (минус, если долг)'], ['otb', 'Отбасы'], ['car', 'Машина, цена продажи'], ['loan', 'Кредит, остаток']].map(([k, n]) => `<label class="fld"><span>${n}, ₸</span><input inputmode="numeric" id="f-${k}" ${k === 'cash' ? 'data-neg="1"' : ''} value="${fmtIn(last[k])}"></label>`).join('')}
      <label class="fld"><span>Оценочный показатель из приложения Отбасы (если знаешь)</span><input inputmode="decimal" id="f-op" value="${opToday ? esc(String(opToday).replace('.', ',')) : ''}" placeholder="например, 3,4"></label>
      <label class="fld"><span>Дата</span><input type="date" id="f-d" value="${TODAY}" max="${TODAY}"></label>
      <div class="btns"><button class="btn" data-a="save-money">${ic('check')}Сохранить</button></div>`);
  }
  function otbSheet() {
    sheet(`<div class="sh-t">В Отбасы</div><div class="sh-s">Перевод с карты на депозит: активы не меняются, деньги уже работают на премию. +${1 + G.rk(S(), 'piggy')} XP за каждые 1 000 ₸.</div>
      <label class="fld"><span>Сколько, ₸</span><input inputmode="numeric" id="f-amt" autofocus></label>
      <label class="fld"><span>Заметка</span><input id="f-note" maxlength="80" placeholder="необязательно"></label>
      <div class="btns"><button class="btn" data-a="save-otb">${ic('check')}Сохранить</button></div>`);
  }
  function monthSheet(mk) {
    const st = S(), mn = C.monthNeed(st, mk), ov = st.months && st.months[mk];
    sheet(`<div class="sh-t">Конверты: ${C.MON[+mk.slice(5) - 1]} ${mk.slice(0, 4)}</div><div class="sh-s">Сколько готов выделить в этом месяце. Заработок смен заполняет их по очереди, остальное идёт на квартиру. Записывать траты не надо.</div>
      ${C.ENV.map(k => { const e = mn.env.find(x => x.key === k); return `<label class="fld"><span>${C.ENV_TITLE[k]}, ₸</span><input inputmode="numeric" id="f-env-${k}" value="${fmtIn(e ? e.v : 0)}"></label>`; }).join('')}
      ${mn.env.some(x => x.key === 'car') ? `<div class="sub">Ещё ${C.money(mn.env.find(x => x.key === 'car').v)} на машину и кредит: их считает расчёт.</div>` : ''}
      ${mn.mixed ? '<div class="sub">В этом месяце начинается такси: дни до первой смены по конвертам до такси, после по конвертам такси. Обычные суммы меняются в настройках.</div>' : '<label class="fld sw"><span>Сделать обычными для всех месяцев</span><input type="checkbox" id="f-env-all"></label>'}
      <div class="btns"><button class="btn" data-a="save-month" data-v="${mk}">${ic('check')}Сохранить</button></div>
      ${ov ? `<button class="btn ghost" data-a="clear-month" data-v="${mk}">Как обычно</button>` : ''}`);
  }
  function tplSheet(i, key) {
    const cur = +((S().set[key] || [])[i] || 0);
    sheet(`<div class="sh-t">Обычно ${DOW_IN[i]}</div><div class="sh-s">${key === 'preTpl' ? 'Подработка до такси' : 'Такси'}</div><div class="quick">${(key === 'preTpl' ? [0, 3, 4, 5, 6, 7, 8, 9, 10, 12] : [0, 6, 8, 9, 10, 11, 12, 13, 14, 15]).map(h => `<button class="q${cur === h ? ' sel' : ''}${h ? '' : ' wide'}" data-a="set-tpl" data-i="${i}" data-k="${key}" data-h="${h}">${h ? h + '<small>ч</small>' : 'вых'}</button>`).join('')}</div>`);
  }
  function questSheet() {
    sheet(`<div class="sh-t">Своё задание</div><div class="sh-s">За выполненное +${XPN().own} XP</div>
      <label class="fld"><span>Что сделать</span><input id="f-qt" maxlength="80" placeholder="например, узнать цены аренды в 3 парках" autofocus></label>
      <label class="fld"><span>До какого числа</span><input type="date" id="f-qd" value="${C.isoAdd(TODAY, 7)}"></label>
      <div class="btns"><button class="btn" data-a="quest-save">${ic('plus')}Добавить</button></div>`);
  }
  function badgeSheet(id) {
    const b = playerOf(S(), TODAY).badges.find(x => x.id === id); if (!b) return;
    sheet(`<div class="bsh">${D.medal(b.icon, b.color || 'violet', !b.on, 92)}
      <div class="sh-t" style="margin-top:12px">${esc(b.title)}</div><div class="sh-s">${b.on ? 'Получена ' + C.dateLong(b.on) : esc(b.hint)}</div>
      ${b.on ? '' : `<div class="pbar" style="width:100%;margin-top:14px"><i style="width:${(b.pct * 100).toFixed(1)}%"></i></div><div class="sh-s">${progText(b)}</div>`}
      <div style="margin-top:12px">${xpChip(b.xp, !!b.on)}</div></div>
      <div class="btns"><button class="btn alt" data-a="sheet-close">Понятно</button></div>`);
  }

  // ---------------------------------------------------------------- тосты, опыт, праздник
  // одно действие может дать несколько сообщений (похвала, сундук, рекорд): показываем их по очереди
  let toastT = null, toastL = [];
  const toast = (text, tone) => toasts([[text, tone]]);
  function toasts(list) { toastL = list.filter(x => x && x[0]); clearTimeout(toastT); nextToast(); }
  // добавить в очередь, не сбивая то, что уже показывается
  function toastsMore(list) { const on = $('#toast').classList.contains('on'); toastL = toastL.concat(list.filter(x => x && x[0])); if (!on) { clearTimeout(toastT); nextToast(); } }
  function nextToast() {
    const t = $('#toast'), x = toastL.shift();
    if (!x) { t.classList.remove('on'); toastT = setTimeout(() => { t.hidden = true; }, 260); return; }
    t.className = 'toast ' + (x[1] || ''); t.textContent = x[0]; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('on'));
    toastT = setTimeout(nextToast, toastL.length ? 2600 : 3600);
  }
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* нет вибро */ } };
  // снимок опыта до действия: после него видно, что нового (сундук, босс, рекорд, месяц оплачен)
  // месяц оплачен и босс празднуются раз в месяц, даже если правка смены сдвинула день
  const evKey = e => e.kind === 'paid' || e.kind === 'boss' ? e.kind + '|' + e.d.slice(0, 7) : e.kind + '|' + e.d + '|' + e.text;
  function snap() {
    const pl = playerOf(S(), C.today());
    return { xp: pl.xp, keys: new Set(pl.ledger.map(evKey)), level: pl.level, pct: pl.pct, boss: pl.boss ? Object.assign({}, pl.boss) : null, month: pl.month ? Object.assign({}, pl.month) : null };
  }
  // msgs: сообщения самого действия, к ним добавятся сундук, рекорд и плитка
  function after(before, msgs) {
    const pl = playerOf(S(), C.today()), fresh = pl.ledger.filter(e => !before.keys.has(evKey(e)));
    msgs = (msgs || []).slice();
    // закрытый сундук не показываем в прибавке: его опыт виден, когда откроешь
    let shut = 0;
    for (const e of fresh) {
      if (e.kind === 'boss') fxQueue.push({ kind: 'event', art: D.medal('trophy', 'gold', false, 120), k: 'Босс побеждён', t: esc(e.text.replace('Босс побеждён: ', '')), s: 'План месяца по часам закрыт. +' + C.grp(e.xp) + ' XP.' });
      if (e.kind === 'paid') fxQueue.push({ kind: 'event', art: D.medal('wallet', 'green', false, 120), k: 'Месяц оплачен', t: esc(e.text), s: 'Жильё, еда и всё остальное покрыты заработком. Дальше каждая смена на квартиру.' });
      if (e.kind === 'chest') { if (chestOpened(S(), e.d)) msgs.push(['Сундук дня открыт: +' + C.grp(e.xp) + ' XP', 'good']); else { shut += e.xp; msgs.push(['Все задания дня сделаны: сундук ждёт, открой его', 'good']); } }
      if (e.kind === 'record') msgs.push([e.text.replace(/^Рекорд/, 'Новый рекорд'), 'good']);
      if (e.kind === 'tile') msgs.push(['Новая плитка квартиры: ' + e.text.replace('Плитка квартиры ', '') + ' собрано', 'good']);
    }
    popXp(pl.xp - before.xp - shut);
    if (msgs.length) toasts(msgs);
    celebrate();
  }
  function popXp(n) {
    if (!(n > 0)) return;
    const el = document.createElement('div'); el.className = 'xp-pop'; el.innerHTML = ic('star') + '+' + C.grp(n) + ' XP';
    document.body.appendChild(el); setTimeout(() => el.remove(), 2000);
  }
  // новый уровень и новые награды показываем по одному и один раз (уровень только растёт, награды копятся)
  const fxQueue = [];
  function streakNews(st, pl) {
    const seen = (st.seen && st.seen.recap) || [], yest = C.isoAdd(TODAY, -1), week = C.isoAdd(TODAY, -7), keys = [], msgs = [];
    for (const d of pl.froze || []) if (d < yest && d >= week && seen.indexOf('z' + d) < 0) {
      keys.push('z' + d);
      // если после этого серия всё же прервалась, честно так и пишем
      const broke = (pl.resets || []).some(r => r > d), ch = pl.chance, left = ch ? 3 - ch.k : 0;
      if (broke) msgs.push([`${cap(C.DOWL[C.dow(d)])}: заморозка закрыла пропуск, но потом серия прервалась.${ch ? ` Вернуть её можно: ещё ${left} ${C.plural(left, ['смена', 'смены', 'смен'])} до ${C.dateShort(ch.until)}.` : ''}`, 'warn']);
      else { msgs.push([`${cap(C.DOWL[C.dow(d)])}: смены не было, серию спасла заморозка. Серия ${pl.streak}, заморозок ${pl.freezes}.`, 'good']); UI.crack = true; }
    }
    for (const d of pl.frzGot || []) if (d >= week && seen.indexOf('g' + d) < 0) { keys.push('g' + d); msgs.push([pl.freezes > 0 ? `Новая заморозка серии: теперь ${pl.freezes}. Она спасёт серию в пропущенный день.` : 'Новая заморозка серии сразу спасла серию в пропущенный день.', 'good']); }
    for (const r of pl.restores || []) if (r.d >= week && seen.indexOf('r' + r.d) < 0) { keys.push('r' + r.d); msgs.push([`Серия вернулась: ${r.L} + 3 = ${r.n}. Комбо снова растёт.`, 'good']); }
    if (!keys.length) return;
    Store.update(s => { s.seen = Object.assign({}, s.seen, { recap: ((s.seen && s.seen.recap) || []).concat(keys).slice(-40) }); }, 'seen');
    toastsMore(msgs.slice(0, 3)); render(); setTimeout(() => { UI.crack = false; }, 1500);
  }
  function celebrate() {
    const st = S(); if (!st || !st.money.length || UI.receipt) return;
    const pl = playerOf(st, C.today()), got = pl.badges.filter(b => b.on).map(b => b.id);
    streakNews(st, pl);
    if (!st.seen || !Array.isArray(st.seen.badges)) { Store.update(s => { s.seen = { level: pl.level, badges: got }; }, 'seen'); return; }
    const seenB = new Set(st.seen.badges), newB = got.filter(id => !seenB.has(id));
    if (pl.level > st.seen.level) {
      const was = G.rankOf(st.seen.level).title, skin = G.SKINS.filter(s => s.level > st.seen.level && s.level <= pl.level).pop();
      fxQueue.push({ kind: 'level', level: pl.level, rank: pl.rank.title, newRank: was !== pl.rank.title, skin });
    }
    newB.forEach(id => fxQueue.push({ kind: 'badge', b: pl.badges.find(x => x.id === id) }));
    if (pl.level > st.seen.level || newB.length) Store.update(s => { s.seen = Object.assign({}, s.seen, { level: Math.max(pl.level, s.seen.level), badges: Array.from(new Set(s.seen.badges.concat(got))) }); }, 'seen');
    if ($('#fx').hidden) nextFx();
  }
  function nextFx() {
    const root = $('#fx'), f = fxQueue.shift();
    if (!f) { root.innerHTML = ''; root.hidden = true; return; }
    let art, k, t, s;
    if (f.kind === 'level') {
      art = D.hex(f.level, 120); k = 'Новый уровень'; t = 'Уровень ' + f.level;
      s = (f.newRank ? 'Новое звание: <b>' + esc(f.rank) + '</b>.' : esc(f.rank) + '.') + (f.skin ? ' В гараже открыта ' + esc(f.skin.name.toLowerCase()) + ' машина.' : '');
    } else if (f.kind === 'welcome') {
      art = D.hex(f.level || 1, 120); k = 'Путь построен'; t = 'Уровень ' + (f.level || 1) + ': ' + esc(f.rank || 'Пешеход'); s = 'Впереди права, первая смена и своя машина. Каждая смена, задание дня и веха дают опыт.';
    } else if (f.kind === 'event') {
      art = f.art; k = f.k; t = f.t; s = f.s;
    } else {
      art = D.medal(f.b.icon, f.b.color || 'violet', false, 120); k = 'Новая награда'; t = esc(f.b.title); s = 'Получена ' + (f.b.on === C.today() ? 'сегодня' : C.dateShort(f.b.on)) + '. +' + C.grp(f.b.xp) + ' XP.';
    }
    root.innerHTML = `<div class="fx-b" role="dialog" aria-modal="true"><div class="fx-art">${art}${D.sparks(18)}</div><div class="fx-k">${k}</div><div class="fx-t">${t}</div><div class="fx-s">${s}</div>
      <button class="btn" data-a="fx-next">${fxQueue.length ? 'Дальше' : 'Поехали'}</button></div>`;
    root.hidden = false; buzz([20, 60, 20, 60, 40]);
  }

  // ---------------------------------------------------------------- действия
  function logShift(d, h, app, orders) {
    const before = snap();
    // t: когда смену записали впервые (сверка в тот же день раньше неё её не включает), u: когда правили последний раз
    const first = !(S().shifts[d] && S().shifts[d].h > 0);
    Store.update(s => {
      const x = s.shifts[d] || {}, now = Date.now(); x.h = h; if (app != null) x.app = app; if (orders != null) x.orders = orders; x.t = x.t || now; x.u = now; s.shifts[d] = x;
      // смена с таймером: начало и конец остаются, по ним виден отдых между сменами
      if (s.live && s.live.d === d) { x.s = s.live.start; x.e = s.live.end || now; s.live = null; C.forget(s, 'live'); }
      // всё-таки вышел в плохой день: день снова обычный, а не выходной в работу
      if (h > 0 && s.bad && s.bad[d]) { delete s.bad[d]; C.forget(s, 'bad/' + d); if (s.over[d] === 0) { delete s.over[d]; C.forget(s, 'over/' + d); } }
    }, 'log');
    if (!S().live) shadeClose();
    const st = S(), p = praiseOf(st, d, C.forecast(st, TODAY));
    buzz(p && p.tone === 'good' ? [12, 40, 12] : 10);
    // первая запись за сегодня или вчера: один чек вместо череды сообщений
    if (first && h > 0 && d >= C.isoAdd(TODAY, -1)) { receiptSheet(d, before); return; }
    const dx = playerOf(st, TODAY).xp - before.xp;
    after(before, p ? [[p.title + '. ' + p.text + (dx ? ` ${dx > 0 ? '+' : '−'}${C.grp(Math.abs(dx))} XP.` : ''), p.tone === 'warn' ? 'warn' : 'good']] : []);
  }
  // лимит самозанятого 300 МРП за месяц (1 297 500 в 2026, 1 407 900 в 2027): строка с 70% лимита, выше нужно ИП
  function seNote(st, mk) {
    const se = C.seMonth(st, mk);
    if (!(se.share >= 0.7)) return '';
    // в лимит идёт весь доход самозанятого за месяц: в такси оплата пассажиров, до такси заработок на доставке
    const what = se.pre > 0 && se.taxi > 0 ? 'Доход самозанятого (такси и доставка)' : se.pre > 0 ? 'Доход самозанятого' : 'Оплата пассажиров';
    return `<div class="rc-lim${se.share >= 1 ? ' hot' : ''}">${ic('receipt')}<span>${se.share >= 1 ? `${what} за месяц больше лимита самозанятого (${C.money(se.lim)}): за 5 рабочих дней нужно уведомление об ИП.`
      : `Лимит самозанятого за месяц: ${Math.round(se.share * 100)}%, примерно ${C.money(r1k(se.gross))} из ${C.money(se.lim)}. Выше нужно ИП.`}</span></div>`;
  }
  // ---------------------------------------------------------------- чек смены
  const STAMP = { 'S+': 'gold', S: 'violet', A: 'green', B: 'blue', C: 'gray' };
  const SHIFT_CATS = ['Смены', 'Часы', 'Серия', 'Недели', 'Месяц', 'Сверх плана', 'Учёт', 'Рекорды', 'Боссы', 'Задания', 'Особые'];
  function receiptSheet(d, before) {
    const st = S(), x = st.shifts[d]; if (!x || !(x.h > 0)) return;
    const m = model(), pl = m.pl, h = +x.h, app = +x.app || 0, ord = +x.orders || 0, gr = C.gradeOf(st, d, h, app), live = !!before && !reduced();
    // строки чека: всё, что дала смена в этот день. При первом и повторном открытии одни и те же (в первый раз плюс новое за другие дни)
    const ofShift = e => e.d === d && (['shift', 'day', 'record', 'week', 'boss', 'paid'].indexOf(e.kind) >= 0 || (e.kind === 'badge' && SHIFT_CATS.indexOf((G.BADGES.find(b => b.id === e.id) || {}).cat) >= 0));
    const extra = before ? pl.ledger.filter(e => !before.keys.has(evKey(e)) && !ofShift(e) && e.kind !== 'chest') : [];
    const q = pl.dqs[d], chestShut = q && q.chest && !chestOpened(st, d);
    const lines = pl.ledger.filter(ofShift).concat(extra).map(e => [e.text.replace(/^Задание дня: /, 'Задание: '), e.xp, e.kind === 'badge' ? pl.badges.find(b => b.id === e.id) : null]);
    const chestXp = q && q.chest && !chestShut ? q.chest : 0, total = lines.reduce((s2, x) => s2 + x[1], 0) + chestXp;
    const restore = (pl.restores || []).find(r => r.d === d);
    // чек и есть праздник: награды и возврат серии в нём, после закрытия покажем только новый уровень
    if (before) Store.update(s => { const sn = s.seen || {}; s.seen = Object.assign({}, sn, { badges: Array.from(new Set((sn.badges || []).concat(pl.badges.filter(b => b.on).map(b => b.id)))), recap: restore ? (sn.recap || []).concat(['r' + d]).slice(-40) : sn.recap || [] }); }, 'seen');
    // штамп и что он значит: в ценах дня смены, как в Яндекс Про
    const ph = C.phaseAt(st, d), perH = app > 0 ? app / h : 0, r50 = v => C.money(Math.round(v / 50) * 50);
    const why = gr ? (gr.ph === 'pre' ? `${C.money(Math.round(perH))} в час на руки.` : `${C.money(Math.round(perH))} в час в приложении, это примерно ${r50(gr.vN)} оплаты пассажиров в час.`) + (gr.next ? ` До ${gr.next.g} нужно от ${r50(gr.next.vN)}${gr.ph === 'pre' ? ' в час на руки' : ' оплаты пассажиров в час'}.` : ' Лучше не бывает.')
      : 'Внеси сумму из Яндекс Про, и смена получит штамп за заработок в час.';
    // смысл: сколько это для цели (маленькие суммы точнее, до сотни)
    const sm = C.shiftMoney(st, d, h, app), dd = C.daysFor(m.fc, sm.goal), rr = v => Math.abs(v) < 10000 ? Math.round(v / 100) * 100 : r1k(v);
    const mean = ph === 'pre' ? `${C.money(rr(sm.net), true)} к месяцу` : sm.goal >= 0 ? (m.na < m.target && dd != null && dd >= 0.05 ? `Цель ближе на ${C.daysText(dd)}` : `${C.money(rr(sm.goal), true)} в квартиру`) : `Смена покрыла жизнь на ${C.daysText(Math.max(0, sm.net) / Math.max(1, sm.day))}`;
    // полоски: было и стало
    const b0 = before && before.boss, b1 = pl.boss, mo0 = before && before.month, mo1 = pl.month, mn = C.monthNeed(st, C.mkOf(TODAY)).total;
    const bar = (label, from, to, color, right) => `<div class="rc-bar"><div class="rc-bl"><span>${label}</span><b>${right}</b></div><div class="pbar"><i style="width:${(Math.max(0, Math.min(1, live ? from : to)) * 100).toFixed(1)}%;background:${color}" data-to="${(Math.max(0, Math.min(1, to)) * 100).toFixed(1)}"></i></div></div>`;
    const bars = [];
    if (b1 && b1.hp > 0) bars.push(bar('Босс: ' + esc(b1.name), b0 ? Math.max(0, b0.hp - b0.dmg) / b0.hp : (b1.hp - b1.dmg) / b1.hp, Math.max(0, b1.hp - b1.dmg) / b1.hp, '#FF7867', b1.beaten ? 'побеждён' : hrs(Math.max(0, b1.hp - b1.dmg))));
    if (mo1 && mn > 0) bars.push(bar('Жизнь на ' + C.MON[+mo1.mk.slice(5) - 1], mo0 ? mo0.earned / mn : mo1.earned / mn, mo1.earned / mn, '#5AA8FF', mo1.paidOn ? 'оплачена' : Math.min(100, Math.round(mo1.earned / mn * 100)) + '%'));
    bars.push(bar('Уровень ' + pl.level, before && before.level === pl.level ? before.pct : 0, pl.pct, 'linear-gradient(90deg,#6E5DF2,#A193FF)', Math.round(pl.pct * 100) + '%'));
    // куда ушли деньги пассажиров
    const r1 = v => C.money(Math.round(v / 100) * 100), row = (k, v, cls) => `<li class="${cls || ''}"><span>${k}</span><b>${v}</b></li>`;
    let money = '';
    if (app > 0 && ph !== 'pre') {
      const g = st.set;
      money = `<details class="rc-money"><summary>Куда ушли деньги пассажиров</summary><ul>
        ${row('Пассажиры заплатили примерно', r1(sm.gross))}${row('Яндекс ' + C.num1(g.yandex) + '%', '−' + r1(sm.yandex))}${sm.park ? row('Парк ' + C.num1(g.park) + '%', '−' + r1(sm.park)) : ''}${row('Соцплатежи ' + C.num1(g.tax) + '%', '−' + r1(sm.tax))}${sm.tips ? row('Чаевые ' + C.num1(g.tips) + '%', '+' + r1(sm.tips)) : ''}
        ${row('В Яндекс Про', C.money(app), 'sum')}${sm.rent ? row('Аренда', '−' + r1(sm.rent)) : ''}${row('Бензин', '−' + r1(sm.fuel))}${row('Мойка', '−' + r1(sm.wash))}${sm.wear ? row('Масло, шины и ремонт', '−' + r1(sm.wear)) : ''}
        ${row('Осталось со смены', r1(sm.net), 'sum')}${row(ph === 'own' ? 'Жизнь и машина на эту смену' : 'Доля жизни на эту смену', '−' + r1(sm.fixed))}${row(sm.goal >= 0 ? 'В квартиру' : 'Не хватило на жизнь', r1(Math.abs(sm.goal)), 'sum ' + (sm.goal >= 0 ? 'up' : 'down'))}
      </ul><p class="sub">Это расчёт по модели, а не чеки: примерно.</p></details>`;
    }
    // лимит самозанятого: оплата пассажиров за месяц, с 70%
    const limit = ph !== 'pre' ? seNote(st, C.mkOf(d)) : '';
    UI.receipt = true;
    sheet(`<div class="rc${live ? ' live' : ''}">
      <div class="rc-h"><div><div class="over">Чек смены</div><div class="h3">${cap(C.DOWL[C.dow(d)])}, ${C.dateShort(d)}</div>
        <div class="rc-s">${C.num1(h)} ч${app ? ' · ' + C.money(app) : ''}${ord ? ' · ' + ord + ' ' + C.plural(ord, ['заказ', 'заказа', 'заказов']) : ''}</div>
        <p class="rc-why">${why}</p></div>
        ${gr ? `<div class="stamp ${STAMP[gr.g]}"><b>${gr.g}</b><span>темп</span></div>` : `<button class="stamp none" data-a="log" data-d="${d}"><b>?</b><span>сумма</span></button>`}</div>
      <ul class="rc-xp">${lines.map(([t, v, b], i) => `<li style="--i:${i}"${b ? ' class="rc-badge"' : ''}>${b ? D.medal(b.icon, b.color || 'violet', false, 24) : ''}<span>${esc(t)}</span><b>+${C.grp(v)}</b></li>`).join('')}
        ${q && q.chest ? `<li style="--i:${lines.length}" class="rc-chest">${chestShut ? `<button class="chest ready" data-a="chest" data-d="${d}">${ic('chest')}<span>Сундук ждёт. Нажми, чтобы открыть</span></button>` : chestRow(st, d, q)}</li>` : ''}
        ${restore ? `<li style="--i:${lines.length + 1}" class="rc-rest">${ic('flame')}<span>Серия вернулась: ${restore.L} + 3 = ${restore.n}</span></li>` : ''}</ul>
      <div class="rc-tot"><span>Всего за смену</span><b id="rc-total" data-v="${total}">+${C.grp(total)} XP</b></div>
      <div class="rc-bars">${bars.join('')}</div>
      <div class="rc-mean">${ic('house')}<span>${mean}</span></div>
      ${money}${limit}
      <div class="btns"><button class="btn" data-a="sheet-close">Готово</button></div>
      <button class="link rc-fix" data-a="log" data-d="${d}">${ic('edit')}Исправить смену</button></div>`);
    if (live) {
      countUp($('#rc-total'), total, 900, v => '+' + C.grp(v) + ' XP');
      setTimeout(() => document.querySelectorAll('.rc-bar i[data-to]').forEach(i => { i.style.width = i.dataset.to + '%'; }), 500);
      const gold = gr && (gr.g === 'S' || gr.g === 'S+');
      buzz(gold ? [15, 30, 60] : 12);
    }
  }
  const clearDraft = () => { UI.dh = null; UI.dapp = ''; UI.dord = ''; };
  function act(a, el) {
    refresh();
    const d = el.dataset.d;
    switch (a) {
      case 'tab': goTab(el.dataset.tab); window.scrollTo(0, 0); break;
      case 'week': UI.week += +el.dataset.v; UI.sel = null; clearDraft(); render(); break;
      case 'day': if (UI.sel !== d) { UI.sel = d; clearDraft(); render(); } break;
      case 'dh': UI.dh = +el.dataset.h; UI.dapp = ($('#p-app') || {}).value || UI.dapp; UI.dord = ($('#p-ord') || {}).value || UI.dord; render(); break;
      case 'dh-own': UI.dapp = ($('#p-app') || {}).value || UI.dapp; $('#own-h').hidden = false; $('#p-h').focus(); break;
      case 'save-day': {
        if (UI.dh == null) break;
        const app = num0(($('#p-app') || {}).value || UI.dapp), ord = num0(($('#p-ord') || {}).value || UI.dord), h = UI.dh;
        clearDraft();
        logShift(d, Math.max(0, Math.min(24, h)), app > 0 ? app : 0, ord > 0 ? Math.round(ord) : 0); break;
      }
      case 'quick': logShift(d, +el.dataset.h, null, null); break;
      case 'log': logSheet(d); break;
      case 'pick-h': $('#f-h').value = el.dataset.h; document.querySelectorAll('#sheet .q').forEach(b => b.classList.toggle('sel', b === el)); sheetPreview(d); break;
      case 'save-log': {
        const hv = parseNum($('#f-h').value), h = hv == null ? C.planHours(S(), d) : hv, app = num0($('#f-app').value), ord = num0($('#f-ord').value);
        // чек открывается в этом же листе (его шаг в истории остаётся для кнопки назад), иначе лист закрываем
        clearDraft(); logShift(d, Math.max(0, Math.min(24, h)), app > 0 ? app : 0, ord > 0 ? Math.round(ord) : 0); if (!UI.receipt) closeSheet(); break;
      }
      case 'del-log': Store.update(s => { delete s.shifts[d]; C.forget(s, 'shifts/' + d); }, 'log'); clearDraft(); closeSheet(); toast('Запись удалена'); break;
      case 'set-plan': Store.update(s => { s.over[d] = +el.dataset.h; }, 'plan'); toast(+el.dataset.h ? `План на ${C.dateShort(d)}: ${el.dataset.h} ч` : `${C.dateShort(d)}: выходной`); break;
      case 'clear-plan': Store.update(s => { delete s.over[d]; C.forget(s, 'over/' + d); if (s.bad && s.bad[d]) { delete s.bad[d]; C.forget(s, 'bad/' + d); } }, 'plan'); break;
      case 'tpl': tplSheet(+el.dataset.i, el.dataset.k || 'tpl'); break;
      case 'set-tpl': Store.update(s => { const k = el.dataset.k === 'preTpl' ? 'preTpl' : 'tpl'; s.set[k] = (s.set[k] || [0, 0, 0, 0, 0, 0, 0]).slice(); s.set[k][+el.dataset.i] = +el.dataset.h; }, 'tpl'); closeSheet(); break;
      case 'mood': { const before = snap(); Store.update(s => { s.mood = s.mood || {}; s.mood[TODAY] = +el.dataset.v; }, 'mood'); after(before, [[+el.dataset.v <= 2 ? 'Записал. Береги себя: сон и еда сейчас важнее лишнего часа.' : C.planHours(S(), TODAY) > 0 ? 'Записал. Хорошей смены.' : 'Записал. Хорошего дня.']]); if (sheetOpen && UI.inst === 'energy') instSheet('energy'); break; }
      case 'month': monthSheet(el.dataset.v); break;
      case 'save-month': {
        const mk = el.dataset.v, e = {}; C.ENV.forEach(k => { e[k] = Math.max(0, num0($('#f-env-' + k).value)); });
        const all = !!($('#f-env-all') || {}).checked, before = snap();
        Store.update(s => {
          s.months = s.months || {};
          // обычные конверты хранятся в ценах начала пути: делим на рост цен до этого месяца без округления, чтобы месяц показал ровно введённое
          // переписываем только то, что поменял (или всё, если месяц был со своими суммами)
          if (all) { const mn0 = C.monthNeed(s, mk), key = mn0.pre ? 'envPre' : 'env', f = C.growth(s.set, mk)[0]; s.set[key] = Object.assign({}, s.set[key]); C.ENV.forEach(k => { const was = mn0.env.find(x => x.key === k); if (mn0.own || !was || was.v !== e[k]) s.set[key][k] = Math.round(e[k] / f); }); s.set.living = C.envSum(s.set.env); s.set.preLiving = C.envSum(s.set.envPre); if (s.months[mk]) { delete s.months[mk]; C.forget(s, 'months/' + mk); } }
          else s.months[mk] = Object.assign({}, e, { u: Date.now() });
        }, 'month');
        closeSheet(); after(before, [['Конверты сохранены: ' + C.money(C.envSum(e)) + ' в месяц']]); break;
      }
      case 'clear-month': Store.update(s => { if (s.months && s.months[el.dataset.v]) { delete s.months[el.dataset.v]; C.forget(s, 'months/' + el.dataset.v); } }, 'month'); closeSheet(); break;
      case 'otb-add': otbSheet(); break;
      case 'money-edit': moneySheet(); break;
      case 'save-otb': {
        const amt = num0($('#f-amt').value); if (!(amt > 0)) { closeSheet(); break; }
        const note = $('#f-note').value.trim(), before = snap();
        Store.update(s => { s.money.push({ d: TODAY, kind: 'add', move: true, add: amt, to: 'otb', note, t: Date.now() }); s.money.sort(C.byDate); if (!s.base) s.base = C.makeBase(s, TODAY); }, 'money');
        closeSheet(); buzz([12, 40, 12]); after(before, [[`${C.money(amt)} в Отбасы. Премия 20% за ${TODAY.slice(0, 4)} год придёт в марте ${+TODAY.slice(0, 4) + 1}.`, 'good']]); break;
      }
      case 'save-money': {
        const v = k => num0($('#f-' + k).value), raw = $('#f-d').value || TODAY, day = ISO.test(raw) && raw <= TODAY ? raw : TODAY, before = snap();
        Store.update(s => {
          const prev = s.money.find(x => x.d === day && !C.isAdd(x)), n = { d: day, cash: v('cash'), otb: v('otb'), car: v('car'), loan: v('loan'), t: Date.now() };
          const opIn = ($('#f-op') || {}).value, op = parseNum(opIn); if (op > 0 && op < 200) n.op = op; else if (!String(opIn || '').trim() && prev && prev.op > 0 && day !== TODAY) n.op = prev.op; // за сегодня поле подставлено: пустое значит стёр
          if (prev && prev.note) n.note = prev.note;
          if (prev) C.forget(s, 'money/' + C.moneyKey(prev));
          s.money = s.money.filter(x => x !== prev); s.money.push(n); s.money.sort(C.byDate);
          if (!s.base) s.base = C.makeBase(s, day);
        }, 'money');
        closeSheet(); after(before, [['Сверено. Активы: ' + C.money((C.estimate(S(), TODAY) || { na: 0 }).na)]]); break;
      }
      case 'done': {
        const id = el.dataset.id, before = snap();
        if (id === 'car' && !S().car && !S().done.car) { carSheet(); break; }
        // депозит открыт сегодня: 3 года и ОП считаются от настоящей даты, а не от плановой
        const otbMoved = id === 'otb-open' && !S().done[id] && S().set.otbOpen !== TODAY;
        Store.update(s => { if (s.done[id]) { delete s.done[id]; C.forget(s, 'done/' + id); } else { s.done[id] = TODAY; if (otbMoved) s.set.otbOpen = TODAY; } }, 'done');
        if (S().done[id]) { buzz([12, 40, 12]); after(before, [['Веха пройдена.' + (otbMoved ? ' Депозит открыт сегодня: от этой даты считаю 3 года. Если открыл в другой день, поправь в настройках.' : ''), 'good']]); }
        break;
      }
      case 'own-done': {
        const id = el.dataset.id, before = snap();
        Store.update(s => { const q = s.quests.find(x => x.id === id); if (q) { q.done = q.done ? null : TODAY; q.u = Date.now(); } }, 'done');
        const q = S().quests.find(x => x.id === id);
        if (q && q.done) after(before, [['Задание сделано.', 'good']]);
        break;
      }
      case 'quest-new': questSheet(); break;
      case 'quest-save': {
        const t = $('#f-qt').value.trim(), qd = $('#f-qd').value;
        if (!t) { $('#f-qt').focus(); break; }
        Store.update(s => { s.quests.push({ id: 'q' + Date.now().toString(36), title: t.slice(0, 80), date: validDate(qd) ? qd : '', u: Date.now() }); }, 'quest');
        closeSheet(); toast('Задание добавлено'); break;
      }
      case 'quest-del': if (confirm('Удалить задание?')) Store.update(s => { s.quests = s.quests.filter(x => x.id !== el.dataset.id); C.forget(s, 'quests/' + el.dataset.id); }, 'quest'); break;
      case 'all-done': UI.allDone = true; render(); break;
      case 'badge': badgeSheet(el.dataset.id); break;
      case 'skin': {
        const sk = G.SKINS.find(x => x.id === el.dataset.id), L = playerOf(S(), TODAY).level;
        if (sk && sk.level <= L) Store.update(s => { s.set.skin = sk.id; }, 'set');
        else if (sk) toast(`${sk.name} машина откроется с ${sk.level} уровня`);
        break;
      }
      case 'sticker': {
        const id = el.dataset.id, pl = playerOf(S(), TODAY); if (!(pl.stickers || []).some(x => x.id === id)) break;
        Store.update(s => { s.set.sticker = pl.skin.sticker === id ? '' : id; }, 'set'); break;
      }
      case 'perk': {
        const id = el.dataset.id, pl = playerOf(S(), TODAY), x = pl.skills.list.find(p => p.id === id);
        if (!x || !x.can || pl.skills.free <= 0) break;
        Store.update(s => { s.perks = s.perks || {}; s.perks[id] = (s.perks[id] || []).concat([TODAY]).slice(0, 3); }, 'perk');
        toast(`Навык изучен: ${x.title}, ступень ${x.r + 1}. ${x.next}.`, 'good'); buzz([12, 40, 12]); break;
      }
      case 'perk-reset': if (confirm('Сбросить все навыки? Очки вернутся, изучишь заново.')) { Store.update(s => { s.perks = {}; }, 'perk'); toast('Навыки сброшены, очки вернулись'); } break;
      case 'car-preset': {
        const c = C.CARS.find(x => x.id === el.dataset.id); if (!c) break;
        Store.update(s => { Object.assign(s.set, { price: c.price, down: c.down, v36: c.v36, l100: c.l100, repairKm: c.repairKm, repair: 0, lost: c.lost }); }, 'set');
        toast(`Машина: ${c.name}, ${c.how}. Прогноз пересчитан.`, 'good'); break;
      }
      case 'wif': UI.wif = !UI.wif; render(); break;
      case 'chest': openChest(el, el.dataset.d); break;
      case 'shorter': { const p = C.planHours(S(), TODAY); Store.update(s => { s.over[TODAY] = Math.max(0, p - 2); }, 'plan'); toast(`План на сегодня ${C.num1(Math.max(0, p - 2))} ч. Береги себя.`, 'good'); break; }
      case 'reload': reloadSheet(); break;
      case 'reload-pick': {
        const o = UI.reloadOpts, v = el.dataset.v; if (!o) { closeSheet(); break; }
        Store.update(s => {
          s.reload = s.reload || {};
          if (v === 'snooze') s.reload[TODAY] = { kind: 'snooze', at: TODAY, u: Date.now() };
          else { Object.assign(s.over, v === 'short' ? o.short : o.off); s.reload[o.mon] = { kind: v, at: TODAY, u: Date.now() }; }
        }, 'plan');
        closeSheet();
        toast(v === 'snooze' ? 'Хорошо, спрошу через 2 недели.' : `Лёгкая неделя с ${C.dateShort(o.mon)}. Если пройдёт как задумал, +${G.XP.reload} XP.`, 'good'); break;
      }
      case 'locks': locksSheet(); break;
      case 'receipt': receiptSheet(el.dataset.d, null); break;
      case 'inst': instSheet(el.dataset.v); break;
      case 'sleep': {
        const before = snap();
        Store.update(s => { s.sleep = s.sleep || {}; s.sleep[TODAY] = el.dataset.v; }, 'mood');
        after(before, [[el.dataset.v === '<5' || el.dataset.v === '5-6' ? 'Записал. Мало сна: сегодня береги силы.' : 'Записал. Батарейка теперь считает по твоему сну.']]); if (sheetOpen && UI.inst === 'energy') instSheet('energy'); break;
      }
      case 'cal': calSheet(); break;
      case 'cal-ics': {
        const m = model(), blob = new Blob([icsText(calEvents(m.st, m.fc))], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'put-k-kvartire.ics'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Файл календаря скачан. Открой его, чтобы добавить даты.'); break;
      }
      case 'diary-all': UI.diaryAll = true; render(); break;
      case 'day-open': UI.tab = 'shifts'; UI.sel = d; UI.week = Math.round(C.isoDiff(C.monday(TODAY), C.monday(d)) / 7); clearDraft(); render(); window.scrollTo(0, 0); break;
      case 'recap-share': shareRecap(); break;
      case 'recap-ok': Store.update(s => { s.seen = Object.assign({}, s.seen, { recap: ((s.seen && s.seen.recap) || []).concat([el.dataset.v]).slice(-40) }); }, 'seen'); render(); break;
      case 'live-start': {
        Store.update(s => { const now = Date.now(); s.live = { d: TODAY, start: now, brk: [], u: now }; }, 'live');
        shadeShow(); buzz(20); toast(`Смена пошла. Напомню про перерыв через ${hm(BREAK_MIN)}, если приложение будет открыто.`, 'good'); break;
      }
      case 'live-pause': Store.update(s => { const L = s.live; if (!L) return; const now = Date.now(); if (L.on) { L.brk.push([L.on, now]); L.on = null; } else L.on = now; L.u = now; }, 'live'); shadeShow(); break;
      case 'live-stop': {
        Store.update(s => { const L = s.live; if (!L) return; const now = Date.now(); if (L.on) { L.brk.push([L.on, now]); L.on = null; } L.end = now; L.u = now; }, 'live');
        shadeShow(); const L = S().live; if (L) logSheet(L.d, liveHours(L)); break;
      }
      case 'live-log': { const L = S().live; if (L) logSheet(L.d, liveHours(L)); break; }
      case 'live-cancel': if (confirm('Сбросить таймер смены? Внесённое не пропадёт.')) { Store.update(s => { s.live = null; C.forget(s, 'live'); }, 'live'); shadeClose(); } break;
      case 'shade-yes': {
        if (!('Notification' in window)) break;
        Notification.requestPermission().then(p => {
          try { localStorage.setItem('put.shade', p === 'granted' ? 'on' : 'off'); } catch (e) { /* ок */ }
          if (p === 'granted') { shadeShow(); toast('Смена теперь в шторке телефона.', 'good'); } else toast('Без разрешения на уведомления шторка не работает. Его можно дать в настройках телефона.');
          render();
        }); break;
      }
      case 'shade-no': try { localStorage.setItem('put.shade', 'off'); } catch (e) { /* ок */ } render(); break;
      case 'install': if (installEv) { installEv.prompt(); installEv.userChoice.finally(() => { installEv = null; render(); }); } break;
      case 'noinstall': try { localStorage.setItem('put.noinstall', '1'); } catch (e) { /* ок */ } render(); break;
      case 'bad-day': badSheet(); break;
      case 'bad-save': {
        const reason = el.dataset.v, st0 = S(), g0 = (C.forecast(st0, TODAY).goal || {}).iso, frz = playerOf(st0, TODAY).freezes;
        Store.update(s => {
          s.over[TODAY] = 0; s.bad = s.bad || {}; s.bad[TODAY] = reason;
          s.diary = s.diary || {}; if (!s.diary[TODAY]) s.diary[TODAY] = { text: 'Плохой день: ' + reason.toLowerCase(), u: Date.now() };
        }, 'plan');
        closeSheet();
        const g1 = (C.forecast(S(), TODAY).goal || {}).iso, shift = g0 && g1 ? C.isoDiff(g0, g1) : 0;
        toast(`Отдыхай. ${shift > 0 ? `Цель сдвинулась всего на ${C.daysText(shift)}.` : 'На цель почти не влияет.'}${frz > 0 ? ' Серию держит заморозка.' : ''}`, 'good'); break;
      }
      case 'car-buy': case 'car-edit': carSheet(); break;
      case 'car-how': case 'car-fuel': {
        const k = a === 'car-how' ? 'carHow' : 'carFuel', v = el.dataset.v, was = UI[k];
        UI[k] = v; el.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === el)));
        if (a === 'car-how') $('#car-loan').hidden = v !== 'loan';
        else { const f = $('#f-cf'), gn = $('#f-gas-n'); if (f && num0(f.value) === +f.dataset[was]) f.value = fmtIn(+f.dataset[v]); $('#f-cf-l').textContent = 'Литр ' + (v === 'gas' ? 'газа' : 'бензина') + ', ₸'; if (gn) gn.hidden = v !== 'gas'; }
        carCalc(); break;
      }
      case 'save-car': {
        const st = S(), g = st.set, c0 = st.car, F = C.growth(g, TODAY.slice(0, 7))[0], loan = UI.carHow === 'loan';
        const name = ($('#f-cn').value || '').trim().slice(0, 40) || 'Машина', price = cv('f-cp'), on = $('#f-con').value;
        const sum = cv('f-cls'), pay = cv('f-clp'), n = Math.round(cv('f-clm')), first = $('#f-clf').value, l100 = parseNum($('#f-cl').value), fp = cv('f-cf');
        const bad = !(price > 0) ? 'Впиши цену машины' : !validDate(on) || on > TODAY ? 'Дата покупки не позже сегодня'
          : loan && !(sum > 0 && pay > 0 && n > 0) ? 'Для кредита нужны сумма, срок и платёж' : loan && (n > 120 || sum > price * 1.5) ? 'Проверь срок и сумму кредита'
          : loan && pay * n < sum ? 'Платёж за весь срок меньше суммы кредита' : loan && !(validDate(first) && first > on) ? 'Первый платёж позже даты покупки'
          : !(l100 >= 3 && l100 <= 30) ? 'Расход от 3 до 30 л на 100 км' : !(fp > 0) ? 'Впиши цену литра' : '';
        if (bad) { toast(bad, 'warn'); break; }
        const v36 = cv('f-cv') > 0 ? Math.min(cv('f-cv'), price) : Math.round(price * 0.75 / 10000) * 10000, now = Date.now(), before = snap();
        const cash = c0 ? null : parseNum($('#f-cc').value), np = nowParts(st);
        Store.update(s => {
          const c = s.car || { mt: now };
          Object.assign(c, { name, on, price, v36, loan: loan ? { sum, pay, months: n, first } : null, u: now });
          s.car = c; s.set.l100 = l100; s.set.fuel = UI.carFuel;
          if (UI.carFuel === 'gas') { s.set.gas = fp / F; if (!s.set.gasFrom || s.set.gasFrom > on) s.set.gasFrom = on; s.done.gas = s.done.gas || on; } else s.set.petrol = fp / F;
          C.applyCar(s);
          s.done.car = s.done.car || on; if (loan) s.done.kaspi = s.done.kaspi || on;
          const lp = C.loanPlan(s, TODAY), i = c.mt != null ? s.money.findIndex(x => !C.isAdd(x) && x.t === c.mt) : -1;
          if (i >= 0) {
            // сверка при покупке: машина и кредит по новым цифрам (старый вариант не вернётся с другого телефона)
            const m = s.money[i], lpm = C.loanPlan(s, m.d); C.forget(s, 'money/' + C.moneyKey(m));
            s.money[i] = Object.assign({}, m, { car: C.carNow(s, m.d), loan: lpm ? Math.round(lpm.bal) : 0 });
          } else if (!c0) {
            s.money.push({ d: TODAY, cash: cash == null ? r1k(np.cash) : cash, otb: Math.round(np.otb), car: C.carNow(s, TODAY), loan: lp ? Math.round(lp.bal) : 0, note: 'купил машину', t: now });
            s.money.sort(C.byDate); if (!s.base) s.base = C.makeBase(s, TODAY);
          }
        }, 'car');
        closeSheet(); buzz([12, 40, 12]);
        after(before, [[c0 ? 'Машина обновлена, прогноз пересчитан.' : `${name} записана. Теперь прогноз идёт по твоей машине${loan ? ' и платежу ' + C.money(pay) : ''}.`, 'good']]); break;
      }
      case 'car-del': {
        if (!confirm('Удалить запись о машине? Сверка при покупке тоже удалится, деньги посчитаются по прошлой сверке.')) break;
        Store.update(s => {
          const c = s.car; if (!c) return;
          const i = c.mt != null ? s.money.findIndex(x => !C.isAdd(x) && x.t === c.mt) : -1;
          if (i >= 0) { C.forget(s, 'money/' + C.moneyKey(s.money[i])); s.money.splice(i, 1); }
          if (s.done.car === c.on) { delete s.done.car; C.forget(s, 'done/car'); }
          s.car = null; C.forget(s, 'car');
        }, 'car');
        closeSheet(); toast('Запись о машине удалена'); break;
      }
      case 'payoff': payoffSheet(); break;
      case 'pay-mode': UI.payMode = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === el))); payoffCalc(); break;
      case 'save-payoff': {
        const st = S(), lp = C.loanPlan(st, TODAY); if (!lp) { closeSheet(); break; }
        const amt = Math.min(cv('f-pa'), Math.round(lp.bal));
        if (!(amt > 0)) { $('#f-pa').focus(); break; }
        const b = C.payoffPreview(st, TODAY, amt, UI.payMode).next, saved = r1k(Math.max(0, lp.intLeft - b.intLeft)), before = snap();
        Store.update(s => { s.money.push({ d: TODAY, kind: 'add', move: true, to: 'loan', add: amt, mode: UI.payMode, t: Date.now() }); s.money.sort(C.byDate); }, 'money');
        closeSheet(); buzz([12, 40, 12]);
        after(before, [[b.bal <= 0 ? `Кредит закрыт! Машина полностью твоя.` : `Досрочно ${C.money(amt)}. Процентов меньше примерно на ${C.money(saved)}.`, 'good']]); break;
      }
      case 'fx-next': nextFx(); break;
      case 'sub': UI.sub = el.dataset.v; UI.subDepth = 1; try { history.pushState({ put: 'sub' }, ''); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
      case 'kb': if (KB.err === 'net') { KB.err = null; KB.errK = null; } UI.kbPend = null; UI.sub = 'kb'; UI.kbNote = null; UI.kbStack = []; UI.kbHl = ''; UI.subDepth = 1; try { history.pushState({ put: 'sub' }, ''); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
      // сразу нужная заметка (ссылка с другого экрана): назад ведёт в список заметок, ещё раз назад туда, откуда пришёл.
      // Пока заметки грузятся или закрыты кодом, экран показывает это, а заметка откроется, когда они откроются
      case 'kb-open': {
        // ссылка на заметку и раздел (data-v: начало заголовка). Без ключа: экран Заметки с замком одной записью в истории,
        // заметка откроется после кода
        const id = el.dataset.id, sec = el.dataset.v || '', k = S().kb && S().kb.k;
        act('kb', el);
        if (!KB.data) UI.kbPend = { id, sec }; else kbOpenNote(id, sec);
        break;
      }
      case 'kb-back': if (history.state && (history.state.put === 'sub' || history.state.put === 'kbnote')) history.back(); else { UI.sub = null; UI.kbNote = null; UI.subDepth = 0; render(); } break;
      case 'kb-note': kbGo(el.dataset.id, el.dataset.hl ? KB.q : '', +el.dataset.k || 0, el.dataset.v || ''); break;
      case 'kb-top': window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); break;
      case 'kb-to': { const h = document.getElementById(el.dataset.v); if (h) h.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); break; }
      case 'kb-dbt': { const id = el.dataset.id; KB.open[id] = !KB.open[id]; if (!KB.open[id]) { delete KB.dbq[id]; delete KB.shown[id]; } render(); break; }
      case 'kb-dbgo': {
        const id = el.dataset.id, db = KB.data && KB.data.dbs[id]; if (!db) break;
        KB.open[id] = true; KB.shown[id] = 20; if (el.dataset.q) KB.dbq[id] = KB.q.trim();
        if (UI.kbNote !== db.note) kbGo(db.note, ''); else render();
        requestAnimationFrame(() => { const x = document.getElementById('db-' + id); if (x) x.scrollIntoView({ block: 'start' }); });
        break;
      }
      case 'kb-row': {
        const nx = el.nextElementSibling;
        const key = el.dataset.db + ':' + el.dataset.i; // раскрытые строки помнятся: перерисовка их не закрывает
        if (nx && nx.classList.contains('kb-det')) { nx.remove(); el.setAttribute('aria-expanded', 'false'); KB.det.delete(key); }
        else { el.insertAdjacentHTML('afterend', kbRowDet(el.dataset.db, +el.dataset.i)); el.setAttribute('aria-expanded', 'true'); KB.det.add(key); }
        break;
      }
      case 'kb-more': { const id = el.dataset.id; KB.shown[id] = (KB.shown[id] || 20) + 20; const box = $('#rows-' + id); if (box) box.innerHTML = kbRows(id); break; }
      case 'kb-unlock': kbUnlock(); break;
      case 'stats': UI.sub = 'stats'; UI.subDepth = 1; UI.stM = null; UI.stD = null; UI.statsTab = 'stats'; try { history.pushState({ put: 'sub' }, ''); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
      case 'st-tab': UI.statsTab = el.dataset.v; render(); break;
      case 'st-m': UI.stM = el.dataset.v; render(); break;
      case 'st-d': UI.stD = +el.dataset.v; render(); break;
      case 'kb-retry': KB.err = null; KB.errK = null; render(); break;
      case 'sub-back': if (history.state && history.state.put === 'sub') history.back(); else { UI.sub = null; render(); } break;
      case 'fuel': Store.update(s => { s.set.fuel = el.dataset.v; }, 'set'); break;
      case 'rebase': Store.update(s => { s.base = C.makeBase(s, TODAY); }, 'rebase'); toast('План пересчитан от сегодня'); break;
      case 'signin': Store.signIn(); break;
      case 'signout': Store.signOut(); break;
      case 'export': Store.exportFile(); break;
      case 'reset': if (confirm('Стереть все данные на этом телефоне? Если входил через Google, копия в облаке останется: войдёшь снова, и всё вернётся.')) shadeClose().then(() => Store.wipe()).then(() => location.reload()); break;
      case 'sheet-close': closeSheet(); break;
      case 'ob-back': readFields(document); readOb(); UI.onb = Math.max(0, UI.onb - 1); render(); break;
      case 'ob-next': {
        const rf = readFields(document); readOb();
        if (rf.why) { rf.bad.forEach(showField); toast(rf.why, 'warn'); break; }
        if (UI.onb < 2) { UI.onb++; render(); window.scrollTo(0, 0); break; }
        Store.update(s => { s.money = [{ d: TODAY, cash: OB.cash || 0, otb: OB.otb || 0, car: OB.car || 0, loan: OB.loan || 0, note: 'старт', t: Date.now() }]; s.base = C.makeBase(s, TODAY); s.created = TODAY; }, 'start');
        // награды и уровень на старте не празднуем: они уже есть
        const pl = playerOf(S(), TODAY);
        Store.update(s => { s.seen = { level: pl.level, badges: pl.badges.filter(b => b.on).map(b => b.id) }; }, 'seen');
        UI.tab = 'home'; render(); window.scrollTo(0, 0); fxQueue.push({ kind: 'welcome', level: pl.level, rank: pl.rank.title }); nextFx(); break;
      }
      default: break;
    }
  }
  function readOb() { document.querySelectorAll('[data-ob]').forEach(i => { OB[i.dataset.ob] = num0(i.value); }); }
  // поля настроек сохраняются без перерисовки экрана, чтобы не сбивать ввод в соседнем поле.
  // Возвращает, сколько полей записано, и почему не записаны остальные (bad: эти поля)
  function readFields(root) {
    const res = { n: 0, why: '', bad: [], fix: [] }, put = [];
    root.querySelectorAll('[data-f]').forEach(i => {
      const k = i.dataset.f, no = why => { res.why = res.why || why; res.bad.push(i); };
      let v;
      if (i.type === 'checkbox') v = i.checked;
      else if (i.type === 'date') {
        if (i.value && !validDate(i.value)) return no('Такой даты нет');
        v = i.value || (OPT_DATES.indexOf(k) >= 0 ? '' : null);
        if (v === null) return no('Эту дату нельзя оставить пустой');
      } else if (i.dataset.t === 'text') v = i.value.trim().slice(0, 120);
      else {
        v = parseNum(i.value);
        if (v == null) return no('Пустое поле не сохраняю: впиши 0');
        if (k === 'target' && v < 100000) return no('Цель от 100 000 ₸');
        if (i.dataset.t === 'money' && k !== 'target') v = Math.max(0, v);
        if (k === 'down') v = Math.min(100, Math.max(0, v));
        if (k === 'l100' || k === 'rentL100') v = Math.max(0, v);
        if (i.dataset.t === 'price' || i.dataset.t === 'rprice') { if (!(v > 0)) return no('Впиши сумму больше нуля'); v = v / (i.dataset.t === 'rprice' ? C.rentF(S().set, TODAY.slice(0, 7)) : C.growth(S().set, TODAY.slice(0, 7))[0]); }
        if (i.dataset.t === 'price1') v = Math.max(0, v) / C.growth(S().set, TODAY.slice(0, 7))[0];
        if (v !== parseNum(i.value)) res.fix.push(i); // поправили до допустимого: покажем, что сохранено
      }
      put.push([k, v]);
    });
    if (!put.length) return res;
    Store.update(s => {
      for (const [k, v] of put) {
        const path = k.split('.');
        if (k === 'why' && v && !s.set.why) s.set.whyOn = TODAY;
        if (path.length === 2) { s.set[path[0]] = Object.assign({}, s.set[path[0]] || {}); s.set[path[0]][path[1]] = v; } else s.set[k] = v;
      }
      s.set.living = C.envSum(s.set.env); s.set.preLiving = C.envSum(s.set.envPre);
    }, 'field');
    res.n = put.length;
    return res;
  }
  // вернуть в поле то, что сохранено
  function showField(i) {
    const v = getF(S().set, i.dataset.f);
    const FN = C.growth(S().set, TODAY.slice(0, 7))[0], FR = C.rentF(S().set, TODAY.slice(0, 7));
    i.value = i.type === 'date' ? v || '' : i.dataset.t === 'money' ? fmtIn(v) : i.dataset.t === 'price' ? fmtIn(Math.round(v * FN)) : i.dataset.t === 'rprice' ? fmtIn(Math.round(v * FR)) : i.dataset.t === 'price1' ? C.num1((+v || 0) * FN) : String(v == null ? '' : v).replace('.', ',');
  }
  // личная ссылка: #s=<base64url JSON> подставляет настройки и задания до первого запуска и стирается из адреса
  function applySetup() {
    const mm = /[#&]s=([\w-]+)/.exec(location.hash);
    if (!mm) return;
    try {
      const b = atob(mm[1].replace(/-/g, '+').replace(/_/g, '/'));
      const over = JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))));
      const dates = ['deadline', 'otbOpen', 'license', 'taxiFrom', 'carFrom', 'preFrom', 'preOnceDate', 'gasFrom', 'whyOn'];
      // те же проверки, что в настройках: битое значение пропускаем, остаётся обычное
      const ok = (k, v) => {
        if (dates.indexOf(k) >= 0) return validDate(v) || (v === '' && (OPT_DATES.indexOf(k) >= 0 || k === 'whyOn'));
        if (k === 'start') return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
        if (k === 'fuel') return v === 'petrol' || v === 'gas';
        if (k === 'skin') return G.SKINS.some(x => x.id === v);
        if (typeof v === 'number') return isFinite(v) && v >= 0 && (k !== 'target' || v >= 100000) && (k !== 'down' || v <= 100);
        if (typeof v === 'object') return !!v && C.ENV.every(x => typeof v[x] === 'number' && isFinite(v[x]) && v[x] >= 0);
        return true;
      };
      if (!S().money.length) Store.update(s => {
        for (const [k, v] of Object.entries(over)) {
          if (!(k in C.DEF) || Array.isArray(C.DEF[k]) || typeof v !== typeof C.DEF[k] || !ok(k, v)) continue;
          if (typeof v === 'object') { s.set[k] = C.ENV.reduce((o, x) => (o[x] = v[x], o), {}); continue; }
          s.set[k] = typeof v === 'string' ? v.slice(0, 120) : v;
        }
        s.set.living = C.envSum(s.set.env); s.set.preLiving = C.envSum(s.set.envPre);
        if (Array.isArray(over.quests) && !s.quests.length) s.quests = over.quests.slice(0, 20).filter(q => q && typeof q.title === 'string' && q.title.trim()).map((q, i) => ({ id: 'q0' + i, title: q.title.trim().slice(0, 80), date: validDate(q.date) ? q.date : '' }));
      }, 'setup');
    } catch (e) { /* битая ссылка: настройки как есть */ }
    const h = location.hash.replace(/[#&]s=[\w-]+/, '').replace(/^&/, '#');
    history.replaceState(null, '', location.pathname + location.search + h);
  }

  // ---------------------------------------------------------------- отрисовка
  function render() {
    refresh();
    const st = S(), onb = !st || !st.money.length;
    document.body.classList.toggle('onboarding', onb);
    const mini = onb ? '' : miniBar(st);
    document.body.classList.toggle('has-mini', !!mini); // тосты и низ экрана поднимаются над мини-полоской
    $('#tabbar').innerHTML = onb ? '' : mini + `<div class="tabs">${TABS.map(([k, n, i]) => `<button class="tb${UI.tab === k ? ' on' : ''}" data-a="tab" data-tab="${k}" aria-current="${UI.tab === k ? 'page' : 'false'}"><span class="ti">${ic(i)}</span>${n}</button>`).join('')}</div>`;
    const view = onb ? vOnboard : UI.sub === 'kb' ? vKb : UI.sub === 'stats' ? vStats : { home: vHome, shifts: vShifts, money: vMoney, path: vPath, me: vMe }[UI.tab] || vHome;
    $('#view').innerHTML = view();
    $('#view').className = onb ? '' : 'view';
    if (UI.sub === 'kb' && UI.kbNote && UI.kbHl) kbHighlight(false);
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
    if (el.dataset && el.dataset.shade) {
      if (el.checked && Notification.permission !== 'granted') { act('shade-yes', el); return; }
      try { localStorage.setItem('put.shade', el.checked ? 'on' : 'off'); } catch (e2) { /* ок */ }
      if (el.checked) shadeShow(); else shadeClose(); return;
    }
    if (el.id === 'p-note' && el.dataset.day) {
      const d = el.dataset.day, text = el.value.trim().slice(0, 120);
      Store.update(s => { s.diary = s.diary || {}; if (text) s.diary[d] = { text, u: Date.now() }; else if (s.diary[d]) { delete s.diary[d]; C.forget(s, 'diary/' + d); } }, 'field');
      toast(text ? 'Записал в дневник' : 'Строчка удалена'); return;
    }
    if (el.dataset && el.dataset.wif) {
      const on = UI.wifOn || (UI.wifOn = new Set()); if (el.checked) on.add(el.dataset.wif); else on.delete(el.dataset.wif);
      const box = $('#wif-sum'); if (box) box.innerHTML = wifSum(model()); return;
    }
    if (el.dataset && el.dataset.a === 'import' && el.files && el.files[0]) {
      const f = el.files[0]; el.value = ''; // тот же файл можно выбрать снова
      if (!confirm('Заменить все данные на этом телефоне' + (Store.cloud.user ? ' и в облаке' : '') + ' копией из файла? Сейчас на телефоне смен: ' + Object.keys(S().shifts).length + '.')) return;
      f.text().then(t => { try { Store.importText(t); toast('Копия загружена', 'good'); } catch (err) { toast('Не получилось: это не файл копии', 'warn'); } });
      return;
    }
    if (el.dataset && el.dataset.f && !document.body.classList.contains('onboarding')) {
      const r = readFields(el.closest('.fld') || el.parentElement);
      r.fix.forEach(showField);
      if (r.why) { r.bad.forEach(showField); toast(r.why, 'warn'); } else if (r.n) toast('Сохранено');
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'kb-code') { e.preventDefault(); kbUnlock(); } else if (e.key === 'Enter' && e.target && (e.target.id === 'kb-q' || e.target.dataset.dbq)) e.target.blur(); });
  document.addEventListener('focusin', e => { const el = e.target; if (el.tagName === 'INPUT' && el.inputMode === 'numeric' && el.value) el.select(); });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'f-cc') UI.ccTouched = true;
    if (el.tagName === 'INPUT' && (el.inputMode === 'numeric' || el.dataset.t === 'money') && el.id !== 'p-ord' && el.id !== 'f-ord') {
      const neg = el.dataset.neg && /^\s*[-−]/.test(el.value), pos = el.value.length - el.selectionStart, raw = el.value.replace(/[^\d]/g, '');
      el.value = raw ? (neg ? '−' : '') + C.grp(+raw) : (neg ? '−' : ''); const p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p);
    }
    if (el.id === 'f-h' || el.id === 'f-app' || el.id === 'f-ord') { const b = document.querySelector('#sheet [data-a="save-log"]'); if (b) sheetPreview(b.dataset.d); }
    if (el.id === 'p-h' || el.id === 'p-app' || el.id === 'p-ord') {
      if (el.id === 'p-h') { const v = parseNum(el.value); UI.dh = v == null ? null : Math.max(0, Math.min(24, v)); } else if (el.id === 'p-app') UI.dapp = el.value; else UI.dord = el.value;
      const pv = $('#pv'), st = S(); if (pv) pv.innerHTML = previewHtml(st, UI.sel, C.forecast(st, TODAY));
      const sb = document.querySelector('[data-a="save-day"]'); if (sb) sb.disabled = UI.dh == null;
    }
    if (/^f-c[a-z]+$/.test(el.id || '') && el.id !== 'f-cc') carCalc();
    // заметки: поиск обновляет только список, поле не теряет фокус
    if (el.id === 'kb-q') { KB.q = el.value; const res = $('#kb-res'), home = $('#kb-home'); if (res) res.innerHTML = KB.q.trim() ? kbResults(KB.q) : ''; if (home) home.hidden = !!KB.q.trim(); }
    if (el.dataset && el.dataset.dbq) { const id = el.dataset.dbq; KB.dbq[id] = el.value; KB.shown[id] = 20; const box = $('#rows-' + id); if (box) box.innerHTML = kbRows(id); }
    if (el.id === 'st-range') { UI.studio = +el.value; const p = $('#st-p'), out = $('#st-out'); if (p) p.textContent = mlnShort(UI.studio); if (out) out.innerHTML = studioOut(C.studio(S(), TODAY, UI.stFc, UI.studio)); }
    if (el.id === 'kb-code') { el.value = kbCode(el.value).replace(/(.{4})(?=.)/g, '$1-'); }
    if (el.id === 'f-pa') payoffCalc();
  });

  Store.onChange(why => {
    if (why === 'field' || why === 'seen') return;
    // открытая заметка не перерисовывается от статуса облака, только если поменялись вход или код
    if (why === 'cloud' && UI.sub === 'kb' && KB.data) { const st0 = S(), sig = !!(Store.cloud && Store.cloud.user) + '|' + (st0 && st0.kb ? st0.kb.k : ''); if (sig === UI.kbSig) return; UI.kbSig = sig; }
    const a = document.activeElement;
    // ключ заметок пришёл из облака, пока фокус в поле кода: перерисовать, иначе замок так и висит
    const kbKey = why === 'cloud' && UI.sub === 'kb' && !KB.data && S().kb && S().kb.k;
    if (why === 'cloud' && a && a.tagName === 'INPUT' && !kbKey) return; // не сбивать ввод из-за статуса облака
    render();
    if (why === 'cloud' || why === 'import') { celebrate(); shadeShow(); }
  });
  Store.boot();
  if (!Store.get()) Store.replace(C.newState(), 'new');
  applySetup();
  // открыли сразу на вкладке (после перезагрузки): шаг в истории, чтобы назад вёл на Главную
  try { if (history.state && history.state.put === 'tab') UI.tabEntry = UI.tab !== 'home'; else if (UI.tab !== 'home') { history.pushState({ put: 'tab' }, ''); UI.tabEntry = true; } } catch (e) { /* ок */ }
  render();
  celebrate();
  // сначала события из шторки, потом быстрая кнопка с иконки: она видит таймер таким, какой он есть
  inboxApply().then(() => { runDo(); shadeShow(); });
  // новый день: пересчитать, когда приложение снова открыли
  let shownDay = TODAY;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && C.today() !== shownDay) { shownDay = C.today(); UI.sel = null; UI.ign = null; clearDraft(); render(); celebrate(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
