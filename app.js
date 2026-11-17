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
  const moneyHtml = n => C.money(n).replace(/\s₸$/, '') + '<span class="cur"> ₸</span>';
  const mlnShort = n => (Math.round(n / 1e4) / 100).toString().replace('.', ',') + ' млн ₸';
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
    const dd = Math.abs(s.days) >= 0.05 ? C.daysText(Math.abs(s.days)) : null;
    if (s.plan > 0 && s.fact === 0) return { tone: 'warn', icon: 'moon', title: 'Пропуск смены', text: (dd ? 'Цель дальше на ' + dd + '. ' : '') + 'Можно добрать на неделе.' };
    if (s.plan === 0 && s.fact > 0) return { tone: 'good', icon: 'bolt', title: 'Выходной в работу', text: C.money(s.money, true) + ' к цели' + (dd ? ', ближе на ' + dd : '') + '.' };
    if (s.plan === 0) return { tone: 'ok', icon: 'moon', title: 'Выходной', text: 'Отдых по плану.' };
    if (s.delta > 0) return { tone: 'good', icon: 'bolt', title: s.fact > 12 ? 'Длинная смена' : 'Хорошая смена', text: '+' + C.num1(s.delta) + ' ч сверх плана' + (dd ? ': цель ближе на ' + dd : '') + '.' + (s.fact > 12 ? ' Поспи подольше, энергия просела.' : '') };
    if (s.delta < 0) return { tone: 'warn', icon: 'clock', title: 'Меньше плана', text: C.num1(s.delta).replace('-', '−') + ' ч' + (dd ? ': цель дальше на ' + dd : '') + '. Можно добрать на неделе.' };
    return { tone: 'ok', icon: 'check', title: 'Смена по плану', text: 'План дня закрыт.' };
  }
  function praiseBox(p, xp) {
    if (!p) return '';
    const cls = p.tone === 'good' ? '' : p.tone === 'warn' ? ' warn' : ' green';
    return `<div class="praise${cls}"><div class="praise-i">${ic(p.icon)}</div><div class="praise-b"><div class="praise-t">${esc(p.title)}</div><div class="praise-s">${esc(p.text)}</div></div>${xp ? xpChip(xp) : ''}</div>`;
  }
  const dateHead = iso => cap(C.DOWL[C.dow(iso)]) + ', ' + C.dateShort(iso);
  function streakPill(pl) {
    const n = pl.streak;
    if (!(n > 0)) return '';
    return `<button class="streak" data-a="tab" data-tab="me" aria-label="Смен подряд: ${n}${pl.freezes ? ', заморозки серии: ' + pl.freezes : ''}">${ic('flame')}${n}${pl.freezes ? `<span class="frz">${ic('snow')}${pl.freezes}</span>` : ''}</button>`;
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
    const working = st.set.preFrom && TODAY >= st.set.preFrom || !m.pre;
    const yest = C.isoAdd(TODAY, -1), yx = st.shifts[yest], yp = working && yx ? praiseOf(st, yest, m.fc) : null;
    return `
    <header class="top"><div><div class="top-k">${dateHead(TODAY)}</div><h1 class="top-t">Путь к квартире</h1></div><div class="top-r">${streakPill(pl)}</div></header>
    ${playerStrip(pl, pl.energy < 40 || m.pre ? st.set.why : '')}
    <section class="gauge-wrap" aria-label="Активы ${C.money(m.na)} из ${C.money(m.target)}">
      <div class="gauge">${D.gauge(m.pct, m.target)}
        <div class="g-in"><div class="g-k">Активы</div><div class="g-v">${moneyHtml(m.na)}</div><div class="g-s">из ${C.money(m.target)}</div></div>
        <div class="g-pct g-left">${m.na >= m.target ? 'цель есть' : 'ещё ' + mlnShort(m.left)}</div></div>
      ${s ? `<div class="status"><span class="chip ${s.tone}">${ic(s.icon)}${esc(s.text)}</span></div>` : ''}
    </section>
    <div class="tiles2"><div class="tile"><div class="over">За ${C.MON[+TODAY.slice(5, 7) - 1]} со смен</div><b class="${pl.month && pl.month.earned > 0 ? 'up' : ''}">${pl.month && pl.month.earned ? moneyHtml(Math.round(pl.month.earned)) : '0<span class="cur">\u00A0₸</span>'}</b><span>${C.phaseAt(st, TODAY) === 'pre' ? 'на руки с доставки' : C.phaseAt(st, TODAY) === 'rent' ? 'после бензина и аренды' : 'после бензина и мойки'}</span></div>
      <div class="tile"><div class="over">До срока</div>${m.daysLeft >= 0 ? `<b>${m.daysLeft}<small> ${C.plural(m.daysLeft, ['день', 'дня', 'дней'])}</small></b>` : '<b class="down">прошёл</b>'}<span>${C.dateLong(st.set.deadline)}</span></div></div>
    ${todayCard(m, working)}
    ${recapCard(m)}
    ${yp && !st.shifts[TODAY] ? `<button class="card tap block" data-a="log" data-d="${yest}"><div class="over">Вчера, ${C.num1(yx.h)} ч</div>${praiseBox(yp)}</button>` : ''}
    ${energyCard(m)}
    ${m.pre ? runwayCard(m) : ''}
    ${monthCard(m)}
    ${working ? bossCard(pl) : ''}
    ${tilesCard(m)}
    ${forecastCard(m)}
    ${working && !m.pre ? weekCard(m) : ''}
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
    const range = r.kind === 'month' ? cap(C.monthName(C.mkOf(r.from))) : `${+r.from.slice(8)}${r.from.slice(5, 7) !== r.to.slice(5, 7) ? ' ' + C.dateShort(r.from).split(' ')[1] : ''}–${C.dateShort(r.to)}`;
    // против себя в прошлом периоде: выручка за час и часы
    const vs = [];
    if (r.a.perH && r.b.perH) { const p = Math.round((r.a.perH / r.b.perH - 1) * 100); vs.push(p === 0 ? 'за час столько же' : `за час ${p > 0 ? '+' : '−'}${Math.abs(p)}%`); }
    if (r.b.sh) { const dh = Math.round(r.a.h - r.b.h); vs.push(dh === 0 ? 'часов столько же' : `часов ${dh > 0 ? '+' : '−'}${Math.abs(dh)}`); }
    return Object.assign(r, { na0, na1, delta: na0 != null ? na1 - na0 : null, xp, badges, title, range, vs, pct0: na0 != null ? na0 / m.target : null, pct1: na1 / m.target, level: pl.level, rank: pl.rank.title });
  }
  function recapCard(m) {
    const R = recapData(m); if (!R) return '';
    const a = R.a, prevName = R.kind === 'month' ? 'прошлого месяца' : 'прошлой недели';
    return `<section class="card recap"><div class="between"><div><div class="over">${R.title}</div><div class="h3">${esc(R.range)}</div></div><button class="link" data-a="recap-share">${ic('share')}Поделиться</button></div>
      ${R.delta != null ? `<div class="recap-big"><b class="${R.delta >= 0 ? 'up' : 'down'}">${C.money(r1k(R.delta), true)}</b><span>к активам за ${R.kind === 'month' ? 'месяц' : 'неделю'}</span></div>
        <div class="pbar"><i style="width:${Math.max(0, Math.min(100, R.pct1 * 100)).toFixed(1)}%"></i></div><div class="sub">${Math.floor(R.pct1 * 100)}% пути${R.pct0 != null && Math.floor(R.pct0 * 100) !== Math.floor(R.pct1 * 100) ? `, было ${Math.floor(R.pct0 * 100)}%` : ''}</div>` : ''}
      <div class="kv"><div><span>Часов</span><b>${C.num1(a.h)}${a.plan > 0 ? `<small> из ${C.num1(a.plan)}</small>` : ''}</b></div><div><span>Смен</span><b>${a.sh}</b></div>
        <div><span>В приложении</span><b>${C.money(a.app)}</b></div><div><span>За час</span><b>${a.perH ? C.money(Math.round(a.perH)) : '–'}</b></div></div>
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
    const cells = [['Часов', C.num1(R.a.h)], ['Смен', String(R.a.sh)], ['В приложении', C.money(R.a.app)], ['За час', R.a.perH ? C.money(Math.round(R.a.perH)) : '–']];
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
        ${praiseBox(p, xp)}
        ${dayQuests(pl.dq)}
        ${+x.h > 0 && !(x.app > 0) ? `<button class="quest-line" data-a="log" data-d="${TODAY}"><span>Внеси, сколько заработал за день</span>${xpChip(XPN().app)}</button>` : ''}
        <div class="btns"><button class="btn ghost" data-a="log" data-d="${TODAY}">${ic('edit')}Изменить</button></div></section>`;
    }
    if (plan > 0) {
      return `<section class="card"><div class="today-top"><div class="ibox">${ic('wheel')}</div><div><div class="over">Сегодня по плану</div><div class="today-t">${name} ${C.num1(plan)} ч</div></div>
        <div class="today-side">${nextDaysText(st)}</div></div>
        ${dayQuests(pl.dq)}
        ${quickHours(TODAY, plan)}
        <div class="today-act"><button class="btn alt sm" data-a="live-start">${ic('play')}Начал смену</button><button class="link" data-a="bad-day">Не могу сегодня</button></div></section>`;
    }
    return `<section class="card"><div class="today-top"><div class="ibox violet">${ic('moon')}</div><div><div class="over">Сегодня</div><div class="today-t">Выходной</div></div>
      <div class="today-side">${nextDaysText(st)}</div></div>
      <p class="lead">${st.bad && st.bad[TODAY] ? `Сегодня не работаешь: ${esc(st.bad[TODAY].toLowerCase())}. Отдыхай и приходи в себя, план и прогноз уже пересчитаны.` : `Сегодня отдых. ${pl.energy < 50 ? `Энергия ${Math.round(pl.energy)} из 100: отдых сейчас даст +${XPN().rest} XP за восстановление.` : `Если выйдешь, за смену в выходной +${XPN().dayOff} XP.`}`}</p>
      ${quickHours(TODAY, 0)}
      <div class="today-act"><button class="btn alt sm" data-a="live-start">${ic('play')}Начал смену</button></div></section>`;
  }
  // задания дня: план, заработок и заказы чуть выше твоего обычного, все три = сундук
  function dayQuests(q) {
    if (!q) return '';
    const row = (done, text, xp) => `<div class="dq${done ? ' on' : ''}"><i>${ic('check')}</i><span>${text}</span>${xpChip(xp, done)}</div>`;
    let out = '';
    if (q.plan > 0) out += row(q.planDone, `План: ${C.num1(q.plan)} ч`, XPN().planDay);
    out += q.moneyT != null ? row(q.moneyDone, `Заработок от ${C.money(q.moneyT)}`, XPN().moneyDay) : '<div class="dq dim"><i></i><span>Цель по заработку появится после 3 смен с суммой</span></div>';
    if (q.ordersT != null) out += row(q.ordersDone, `Заказов от ${q.ordersT}`, XPN().ordersDay);
    const chest = q.chest ? `<div class="chest on">${ic('chest')}<span>Сундук открыт</span>${xpChip(q.chest)}</div>` : q.avail >= 2 ? `<div class="chest">${ic('chest')}<span>Выполни все задания: сундук 50‑150 XP</span></div>` : '';
    return `<div class="dqs"><div class="over">Задания дня</div>${out}${chest}</div>`;
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') liveTick(); });
  // плохой день: выходной без чувства вины, план и прогноз пересчитываются, серию держит заморозка
  const BAD = ['Заболел', 'Машина сломалась', 'Нет сил', 'Дела'];
  function badSheet() {
    const pl = playerOf(S(), TODAY);
    sheet(`<div class="sh-t">Плохой день бывает</div><div class="sh-s">Отметь, что случилось. Сегодня станет выходным, план недели и прогноз пересчитаются. ${pl.freezes > 0 ? 'Серию сохранит заморозка.' : 'Серия начнётся заново, это нормально: главное цель.'}</div>
      <div class="bad-list">${BAD.map(r => `<button class="bad-b" data-a="bad-save" data-v="${r}">${r}</button>`).join('')}</div>
      <div class="btns"><button class="btn ghost" data-a="sheet-close">Всё-таки поработаю</button></div>`);
  }
  function quickHours(iso, plan) {
    const base = plan > 0 ? [0, 6, plan, plan + 3] : [4, 6, 8, 12];
    const opts = base.filter((h, i) => base.indexOf(h) === i).sort((a, b) => a - b);
    return `<div class="quick">${opts.map(h => `<button class="q${h === plan && plan > 0 ? ' plan' : ''}" data-a="quick" data-d="${iso}" data-h="${h}">${h}<small>ч</small></button>`).join('')}
      <button class="q own" data-a="log" data-d="${iso}">своё</button></div>`;
  }
  function energyCard(m) {
    const st = m.st, pl = m.pl, md = st.mood && st.mood[TODAY], e = Math.round(pl.energy), started = (st.set.preFrom && TODAY >= st.set.preFrom) || (st.set.taxiFrom && TODAY >= st.set.taxiFrom), tip = G.energyTip(e, pl.freezes, started && C.planHours(st, TODAY) === 0);
    const tone = e >= 60 ? 'good' : e >= 30 ? 'mid' : 'low';
    const moods = [[1, 'выжат'], [2, 'устал'], [3, 'норм'], [4, 'бодро'], [5, 'огонь']];
    return `<section class="card"><div class="between"><div class="over">${md ? 'Энергия' : 'Как ты сегодня?'}</div>${pl.freezes ? `<span class="chip violet">${ic('snow')}${pl.freezes} ${C.plural(pl.freezes, ['заморозка', 'заморозки', 'заморозок'])} серии</span>` : ''}</div>
      ${md ? '' : `<div class="moods">${moods.map(([v, t]) => `<button class="mood" data-a="mood" data-v="${v}"><b>${v}</b><span>${t}</span></button>`).join('')}</div>`}
      <div class="batt ${tone}"><div class="batt-bar"><i style="width:${Math.max(4, e)}%"></i></div><b>${e}<small> из 100</small></b></div>
      <div class="sub">${esc(tip.text)}${md ? '' : ` Отметка +${XPN().mood} XP.`}</div></section>`;
  }
  function runwayCard(m) {
    const rw = m.rw, g = m.st.set;
    if (!rw) return '';
    const okB = rw.at >= rw.need, tone = rw.neg ? 'coral' : okB ? 'green' : 'yellow';
    const inMon = mk => C.MON[+mk.slice(5) - 1].replace(/ь$/, 'е').replace(/й$/, 'е').replace(/т$/, 'те');
    const low = rw.neg ? `Деньги кончатся в ${inMon(rw.neg)}.` : rw.low < rw.need && rw.lowMk && Math.round(rw.low / 1000) < Math.round(rw.at / 1000) ? `Меньше всего денег будет в ${inMon(rw.lowMk)}: около ${C.money(Math.round(rw.low / 1000) * 1000)}.` : '';
    const fix = rw.short > 0 ? (rw.extraH > 0 && rw.extraH <= 6 ? `Чтобы хватило, добавь <b>${C.num1(Math.ceil(rw.extraH * 2) / 2)} ч доставки в день</b> или урежь конверты месяца.` : 'Одной доставкой не закрыть: урежь жильё (хостел) или конверты месяца.') : 'Запаса хватает на старт такси.';
    return `<section class="card"><div class="between"><div class="over">Запас на старт такси</div><span class="chip ${tone}">${okB ? ic('check') + 'хватает' : ic('down') + 'не хватает'}</span></div>
      <div class="fc-date">${moneyHtml(Math.round(rw.at / 1000) * 1000)}</div>
      <div class="fc-sub">будет на руках к ${C.dateLong(g.taxiFrom)}. Нужно на старт около ${C.money(rw.need)}${rw.short > 0 ? `, не хватает ${C.money(Math.round(rw.short / 1000) * 1000)}` : ''}. ${low}</div>
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
  // сколько будет к сроку при выручке чуть хуже и чуть лучше: вилка в тенге
  function rangeLine(m) {
    const st = m.st, mk = C.mkOf(st.set.deadline), R0 = m.fc.R, at = f => { const r = f.rows.find(x => x.mk === mk); return r ? r.na : null; };
    const lo = at(C.forecast(st, TODAY, { R: R0 * 0.88 })), mid = at(m.fc), hi = at(C.forecast(st, TODAY, { R: R0 * 1.15 }));
    if (lo == null || hi == null) return '';
    const f = v => (v < 0 ? '−' : '') + mlnShort(Math.abs(v));
    return `<div class="range"><div class="over">К ${C.dateLong(st.set.deadline)} будет</div><div class="range-v"><span>от</span><b class="${lo < 0 ? 'down' : ''}">${f(lo)}</b><span>до</span><b class="up">${f(hi)}</b></div>
      <div class="sub">По прогнозу ${f(mid)}. Вилка: выручка от ${C.money(Math.round(R0 * 0.88 / 50) * 50)} до ${C.money(Math.round(R0 * 1.15 / 50) * 50)} в час до вычетов.${lo < 0 ? (m.fc.warn ? ' Минус значит, что без своей машины аренда съедает накопления.' : ' Минус значит, что аренда съедает накопления: переходи на свою машину раньше.') : ''}</div></div>`;
  }
  // ---------------------------------------------------------------- что если: как решения двигают цель
  // каждый вариант считается отдельно от текущего плана; включённые вместе дают общую строку внизу
  function wifOpts(st) {
    const g = st.set, taxi = C.phaseAt(st, TODAY) !== 'pre' || (g.taxiFrom && g.taxiFrom > TODAY);
    const wk = [0, 1, 2, 3, 4, 5, 6].map(i => +((g.tpl || [])[i] || 0)), sh = wk.filter(h => h > 0), avg = sh.length ? sh.reduce((a, b) => a + b, 0) / sh.length : 12;
    const scale = (e, k) => { const o = {}; C.ENV.forEach(x => { o[x] = Math.max(0, (+e[x] || 0) * k); }); return o; };
    const life = (gg, cut) => { for (const key of ['env', 'envPre']) { const sum = C.envSum(gg[key]); if (sum > cut) gg[key] = scale(gg[key], (sum - cut) / sum); } gg.living = C.envSum(gg.env); gg.preLiving = C.envSum(gg.envPre); };
    const out = [];
    if (taxi && sh.length < 7) out.push({ id: 'shift', title: sh.length === 6 ? `Без выходного, +${C.num1(avg)} ч в неделю` : `+1 смена в неделю, ${C.num1(avg)} ч`, extra: avg });
    if (taxi && sh.length) out.push({ id: 'hour', title: '+1 час к каждой смене', extra: sh.length });
    out.push({ id: 'life', title: 'Жить на 20 000 ₸ в месяц дешевле', set: gg => life(gg, 20000) });
    if (taxi) out.push({ id: 'rev', title: 'Выручка в час на 10% выше', rk: 1.1 });
    if (!st.car && g.carFrom && C.addMonths(g.carFrom, -2) > (g.taxiFrom || TODAY) && C.addMonths(g.carFrom, -2) > TODAY) out.push({ id: 'car', title: 'Своя машина на 2 месяца раньше', set: gg => { gg.carFrom = C.addMonths(gg.carFrom, -2); } });
    if (g.fuel !== 'gas' && (st.car || g.carFrom)) out.push({ id: 'gas', title: `Поставить газ, ${C.money(g.gasCost)}`, set: gg => { gg.fuel = 'gas'; gg.gasFrom = st.car ? C.isoAdd(TODAY, 1) : ''; } });
    return out;
  }
  function wifRun(st, R, list) {
    const s2 = Object.assign({}, st, { set: Object.assign({}, st.set, { env: Object.assign({}, st.set.env), envPre: Object.assign({}, st.set.envPre) }) });
    let extra = 0, rk = 1;
    for (const o of list) { if (o.set) o.set(s2.set); extra += o.extra || 0; rk *= o.rk || 1; }
    const f = C.forecast(s2, TODAY, { R: R * rk, extraWeek: extra }), mk = C.mkOf(st.set.deadline), r = f.rows.find(x => x.mk === mk);
    return { goal: f.goal ? f.goal.iso : null, na: r ? r.na : null };
  }
  // как вариант меняет цель: дни раньше или позже, а если цели нет, то деньги к сроку
  function wifEffect(base, x) {
    if (base.goal && x.goal) { const d = C.isoDiff(x.goal, base.goal); return d > 0 ? { t: 'на ' + days(d) + ' раньше', up: true } : d < 0 ? { t: 'на ' + days(-d) + ' позже', up: false } : { t: 'без разницы', up: null }; }
    if (!base.goal && x.goal) return { t: 'успеешь к ' + C.dateShort(x.goal) + ' ' + x.goal.slice(0, 4), up: true };
    if (base.na != null && x.na != null) { const d = x.na - base.na; return { t: (d >= 0 ? '+' : '−') + mlnShort(Math.abs(d)) + ' к сроку', up: d > 0 }; }
    return { t: '', up: null };
  }
  let wifMemo = null;
  function wifBlock(m) {
    if (!UI.wif) return `<button class="wif-open" data-a="wif">${ic('sliders')}<span>Что если: как решения двигают цель</span>${ic('down')}</button>`;
    const st = m.st, R = m.fc.R, key = st.updated + '|' + TODAY + '|' + R;
    if (!wifMemo || wifMemo.key !== key) {
      const opts = wifOpts(st), base = wifRun(st, R, []);
      wifMemo = { key, opts, base, eff: opts.map(o => wifEffect(base, wifRun(st, R, [o]))) };
    }
    const W = wifMemo, on = UI.wifOn || (UI.wifOn = new Set());
    return `<div class="wif"><button class="wif-open on" data-a="wif">${ic('sliders')}<span>Что если</span>${ic('up')}</button>
      ${W.opts.map((o, i) => `<label class="wif-row"><span><b>${esc(o.title)}</b><small class="${W.eff[i].up === true ? 'up' : W.eff[i].up === false ? 'dn' : ''}">${W.eff[i].t}</small></span><input type="checkbox" data-wif="${o.id}"${on.has(o.id) ? ' checked' : ''}></label>`).join('')}
      <div class="wif-sum" id="wif-sum">${wifSum(m)}</div></div>`;
  }
  function wifSum(m) {
    const W = wifMemo, on = UI.wifOn; if (!W || !on || !on.size) return 'Отметь варианты, и здесь будет, что выйдет вместе.';
    const list = W.opts.filter(o => on.has(o.id)), x = wifRun(m.st, m.fc.R, list), e = wifEffect(W.base, x);
    return x.goal ? `Вместе: цель <b>${C.dateLong(x.goal)}</b>, ${e.t}.` : `Вместе: до цели пока не доходит, ${e.t}.`;
  }
  function forecastCard(m) {
    const st = m.st, dl = st.set.deadline;
    if (m.na >= m.target) return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Цель есть</div><div class="fc-sub">${C.money(m.na)} активов. Дальше Отбасы и квартира.</div></section>`;
    if (!m.fc.goal) {
      const w = m.fc.warn, ex = m.need.extra;
      const why = w && st.set.carFrom ? `К ${C.dateLong(st.set.carFrom)} не хватит около ${C.money(Math.round(w.short / 1000) * 1000)} на взнос за свою машину, а на аренде до цели не дойти.` : `При таком плане до ${C.money(m.target)} не дойти.`;
      const how = ex ? ` С +${C.num1(ex)} ч в неделю машина будет, и к сроку успеваешь.` : ' Помогут меньше трат на жизнь (конверты), машина дешевле или 7 смен в неделю.';
      return `<section class="card"><div class="over">Прогноз</div><div class="fc-date">Пока не доходит</div><div class="fc-sub">${why}${how}</div>${rangeLine(m)}${wifBlock(m)}</section>`;
    }
    const g = m.fc.goal.iso, diff = C.isoDiff(g, dl), late = diff < 0, span = Math.max(C.isoDiff(TODAY, dl), C.isoDiff(TODAY, g), 1);
    const pf = Math.max(0, Math.min(100, C.isoDiff(TODAY, g) / span * 100)), pd = Math.max(0, Math.min(100, C.isoDiff(TODAY, dl) / span * 100));
    const ex = m.need.extra;
    const sub = late ? `Позже срока на <b class="down">${days(-diff)}</b>.` + (ex ? ` Чтобы успеть, добавь <b class="down">${C.num1(ex)} ч в неделю</b>.` : ex === null ? ' Одних часов мало. Помогут газ, своя машина раньше или меньше расходов.' : '')
      : diff === 0 ? 'Ровно в срок' : `На <b>${days(diff)}</b> раньше срока`;
    return `<section class="card"><div class="over">Прогноз цели</div>
      <div class="fc-date">${C.dateLong(g)}</div><div class="fc-sub">${sub}</div>${rangeLine(m)}
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
  function weekCard(m) {
    const st = m.st, mon = C.monday(TODAY), wk = C.weekStats(st, TODAY, m.fc, TODAY), planAll = weekPlan(st, mon), closed = planAll > 0 && wk.fact >= planAll;
    return `<button class="card tap block" data-a="tab" data-tab="shifts"><div class="wk-h"><div><div class="over">Эта неделя</div><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div></div>
      <div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      ${weekSegs(st, mon)}
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : `До закрытия недели ещё <b>${C.num1(Math.max(0, planAll - wk.fact))} ч</b>`}</span>${planAll > 0 ? xpChip(XPN().week, closed) : ''}</div></button>`;
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
    const near = pl.badges.filter(b => !b.on && b.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
    const list = near.length ? near : pl.badges.filter(b => !b.on).slice(0, 3);
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
    const mr = C.measuredR(st, TODAY, 120), sc = C.scenarioOf(mr.n >= 3 ? mr.R : null), scHint = sc ? SC_HINT[C.phaseOn(st.set, TODAY) === 'own' ? 'own' : 'rent'][sc.key] : '';
    const label = UI.week === 0 ? 'Эта неделя' : UI.week === -1 ? 'Прошлая неделя' : UI.week === 1 ? 'Следующая неделя' : 'Неделя';
    const closed = planAll > 0 && wk.fact >= planAll && ds[6] < TODAY;
    const preNow = !st.set.taxiFrom || TODAY < st.set.taxiFrom, tplKey = preNow ? 'preTpl' : 'tpl', tpl = st.set[tplKey] || [];
    return `
    <header class="top"><div><div class="top-k">Смены</div><h1 class="top-t">${label}</h1></div><div class="top-r">${streakPill(pl)}</div></header>
    <section class="card">
      <div class="between"><div class="over">${+mon.slice(8)}${mon.slice(5, 7) !== ds[6].slice(5, 7) ? ' ' + C.dateShort(mon).split(' ')[1] : ''}–${C.dateShort(ds[6])}</div>
        <div class="top-r"><button class="icon-btn" data-a="week" data-v="-1" aria-label="Неделя назад">${ic('left')}</button><button class="icon-btn" data-a="week" data-v="1" aria-label="Неделя вперёд">${ic('right')}</button></div></div>
      <div class="wk-h"><div class="wk-t">${C.num1(wk.fact)} <span>из ${C.num1(planAll)} ч</span></div><div class="wk-m">${wk.app ? `<b>${C.money(wk.app)}</b><span>в приложении</span>` : ''}</div></div>
      <div class="bars">${ds.map(d => barCol(st, d)).join('')}</div>
      <div class="wk-foot"><span>${closed ? 'Неделя закрыта' : planAll > 0 ? `До закрытия недели ещё ${C.num1(Math.max(0, planAll - wk.fact))} ч` : 'Неделя без плана'}</span>${planAll > 0 ? xpChip(XPN().week, closed) : ''}</div>
    </section>
    ${dayPanel(st, UI.sel, fc)}
    ${UI.week === 0 ? bossCard(pl) : ''}
    <section class="card"><div class="over">${cap(C.MON[+mk.slice(5) - 1])}</div>${statsBlock(mo)}</section>
    ${mr.n >= 3 ? `<section class="card"><div class="over">Твоя выручка в такси</div>
      <p class="lead">За 12 ч в приложении в среднем <b>${C.money(C.appPer12(st, TODAY, mr.R) || 0)}</b>.${sc ? ` Это ${esc(scHint)}.` : ''}</p>
      <div class="sub">По последним ${mr.n} ${C.plural(mr.n, ['смене', 'сменам', 'сменам'])}${st.set.rLog && mr.n >= 10 ? '. Прогноз уже считается по ним.' : '. С 10 смен прогноз начнёт считаться по ним.'}</div></section>` : ''}
    <section class="card"><div class="over">${preNow ? 'Обычная неделя подработки' : 'Обычная неделя такси'}</div>
      <div class="tpl">${C.DOW.map((n, i) => `<button class="tpl-d${tpl[i] ? '' : ' off'}" data-a="tpl" data-i="${i}" data-k="${tplKey}"><span>${n}</span><b>${tpl[i] ? C.num1(tpl[i]) : ic('moon')}</b></button>`).join('')}</div>
      <div class="sub">Нажми на день, чтобы поменять часы. Разовый выходной или смену ставь на конкретный день выше.</div></section>`;
  }
  // что значит выручка: на аренде и на своей машине по-разному (план считается по надёжному сценарию)
  const SC_HINT = {
    rent: { bad: 'ниже плана: на аренде в минус, нужна своя машина, газ и 7/0', reliable: 'как в плане: на аренде почти ничего не остаётся, своя машина как можно раньше', mid: 'лучше плана: на аренде уже можно понемногу копить', good: 'намного лучше плана: можно копить и на аренде' },
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
      val = h === 0 ? '<span class="bar-v miss">0</span>' : future || d === TODAY ? `<span class="bar-v dim">${C.num1(p)}</span>` : '<span class="bar-v miss">?</span>';
    } else {
      const working = (st.set.preFrom && d >= st.set.preFrom) || (st.set.taxiFrom && d >= st.set.taxiFrom);
      col = working ? `<div class="bar-off">${ic('moon')}</div>` : '';
      val = `<span class="bar-v dim">${working ? 'вых' : '–'}</span>`;
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
    return praiseBox(praiseOf(st, d, fc, { h, app }), pv.xp) + (pv.parts.length > 1 ? `<div class="xp-parts">${pv.parts.map(([t, v]) => `<span>${t} +${C.grp(Math.round(v))}</span>`).join('')}</div>` : '');
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
      <div class="sub">Расход ${C.num1(g.l100)} л на 100 км, ${fuel === 'gas' ? 'газ' : 'бензин'} ${C.money(Math.round((fuel === 'gas' ? g.gas : g.petrol) * F))} за литр. Топливо по плану месяца около ${C.money(r1k(fm))}.</div></section>`;
  }
  // аренда или своя: по твоим сменам за 30 дней, только пока ездишь на аренде
  function rentOwnCard(m) {
    const st = m.st, g = st.set; if (st.car || C.phaseAt(st, TODAY) !== 'rent') return '';
    const r = C.rentVsOwn(st, TODAY); if (!r) return '';
    const preset = C.CARS.find(c => c.price === g.price && c.down === g.down), name = preset ? 'своей машине (' + preset.name + ')' : 'своей машине по плану', d = r.own - r.rent;
    return `<section class="card"><div class="between"><div class="over">Аренда или своя</div><span class="link">по ${r.n} ${C.plural(r.n, ['смене', 'сменам', 'сменам'])} за 30 дней</span></div>
      <div class="kv"><div><span>На аренде осталось</span><b class="${r.rent < 0 ? 'down' : ''}">${C.money(r1k(r.rent))}</b></div><div><span>На своей было бы</span><b class="${d > 0 ? 'up' : ''}">${C.money(r1k(r.own))}</b></div></div>
      <p class="sub">${d > 0 ? `На ${esc(name)} за те же смены оставалось бы на <b class="up">${C.money(r1k(d))}</b> в месяц больше${r.pay > 0 ? `, уже после платежа по кредиту ${C.money(r1k(r.pay))}` : ''}. И машина остаётся твоей.` : `Пока аренда не хуже своей машины${r.pay > 0 ? ` с платежом ${C.money(r1k(r.pay))}` : ''}: можно не спешить.`} На взнос и оформление нужно около ${C.money(r1k(r.start))}.</p></section>`;
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
      <div class="fld"><span>Топливо</span><div class="segm">${[['petrol', 'бензин'], ['gas', 'газ']].map(([x, n]) => `<button data-a="car-fuel" data-v="${x}" aria-pressed="${UI.carFuel === x}">${n}</button>`).join('')}</div></div>
      <div class="fld2"><label class="fld"><span>Расход, л на 100 км</span><input inputmode="decimal" id="f-cl" value="${C.num1(g.l100)}"></label>
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
      const costs = (g.ogpo + g.osgop + g.regFee + g.diag) * F, cash = nowParts(st).cash, paid = loan ? Math.max(0, price - sum) : price;
      const counted = last && last.d >= on; // сверка после покупки уже знает про трату
      if (!UI.ccTouched) cc.value = fmtIn(r1k(cash - (counted ? 0 : paid + costs)));
      if (note) note.textContent = counted ? `Подставил деньги по последней сверке: около ${C.money(r1k(cash))}. Поправь, сколько на самом деле.`
        : `Подставил: сейчас около ${C.money(r1k(cash))}, минус ${loan ? 'взнос' : 'цена'} и оформление (страховки, регистрация, диагностика) около ${C.money(r1k(costs))}. Поправь, сколько на самом деле.`;
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
      <ul class="as-list">${parts.map(([n, v, c]) => `<li class="${v < 0 ? 'neg' : ''}"><span><i style="--c:${c}"></i>${n}</span><b>${C.money(v)}</b></li>`).join('')}</ul>
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
    const dl = C.mkOf(st.set.deadline), fcRows = m.fc.rows.filter(r => r.mk <= dl), base = st.base ? st.base.rows.filter(r => r.mk <= dl) : [];
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
    L.push({ key: 'flat', title: 'Квартира', date: L.reduce((x, s) => s.date > x ? s.date : x, TODAY), icon: 'house', done: false });
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
    const m = model(), st = m.st, ph = C.phaseNow(st, TODAY, m.fc), R = stationsOf(m), ex = m.need.extra;
    const yrs = [0, 1, 2].map(i => +TODAY.slice(0, 4) + i).filter(y => y <= +st.set.deadline.slice(0, 4)).map(y => {
      const mk = y + '-12', fr = m.fc.rows.find(r => r.mk === mk), br = st.base && st.base.rows.find(r => r.mk === mk);
      return `<div class="yr"><span>Конец ${y}</span><b>${fr ? C.mln(fr.na) : '-'}</b><small>план ${br ? C.mln(br.na).replace(/\s₸$/, '') : '-'}</small></div>`;
    }).join('');
    const Q = G.quests(st, TODAY, m.fc), nx = R.next;
    const nxt = nx ? (nx.key === 'loan' ? 'кредит закрыт' : nx.key === 'goal' ? C.money(m.target) + ' активов' : nx.key === 'otb' ? 'депозиту Отбасы 3 года' : nx.title.toLowerCase()) : '';
    return `
    <header class="top"><div><div class="top-k">Путь</div><h1 class="top-t">Этап ${ph.n} из ${ph.total}</h1></div></header>
    <section class="road-card"><div class="road-head"><div class="ibox violet">${ic('route')}</div><div><div class="road-k">Сейчас</div><div class="road-t">${esc(ph.title)}</div></div></div>
      ${D.road(R.L, R.car, m.pl.skin, null)}
      <div class="stages" style="margin:10px 18px 0">${C.PHASES.map((_, i) => `<i class="${i + 1 < ph.n ? 'done' : i + 1 === ph.n ? 'now' : ''}"></i>`).join('')}</div>
      <div class="road-foot"><span>${nx ? `Дальше: <b>${esc(nxt)}</b>, ${C.dateLong(nx.date)}${nx.key === 'loan' || nx.key === 'goal' ? ' по прогнозу' : ''}` : 'Все вехи пройдены'}</span></div></section>
    <section class="card"><div class="over">Чтобы успеть к ${C.dateLong(st.set.deadline)}</div>
      <p class="lead">${m.na >= m.target ? 'Цель уже есть.' : ex === 0 ? `Успеваешь с запасом <b>${days(m.need.slackDays)}</b>.` : ex ? `Добавь <b>${C.num1(ex)} ч в неделю</b> к обычному графику.` : 'Одних часов мало. Помогут газ, своя машина раньше или меньше расходов.'}</p>
      <div class="years">${yrs}</div></section>
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

  // ---------------------------------------------------------------- профиль
  const CATS = ['Смены', 'Часы', 'Серия', 'Недели', 'Месяц', 'Сверх плана', 'Учёт', 'Деньги', 'Машина', 'Рекорды', 'Боссы', 'Задания', 'Особые', 'Голова'];
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
    <div class="garage">${G.SKINS.map(s => `<button class="skin${s.id === pl.skin.id ? ' on' : ''}${s.level > pl.level ? ' locked' : ''}" data-a="skin" data-id="${s.id}">${D.carIcon(s.body, s.shade)}${esc(s.name)}<small>${s.level > pl.level ? 'с ' + s.level + ' уровня' : s.id === pl.skin.id ? 'выбрана' : 'открыта'}</small></button>`).join('')}</div>
    <div class="sec-h"><div class="h3">Опыт</div><span class="link">+${C.grp(pl.weekXp)} XP за неделю</span></div>
    <section class="card">${pl.ledger.slice().reverse().slice(0, 30).map(e => `<div class="xp-row"><div>${esc(e.text)}<small>${C.dateLong(e.d)}</small></div>${xpChip(e.xp)}</div>`).join('') || '<p class="lead" style="margin-top:0">Опыт дают смены, задания дня, переводы в Отбасы и вехи пути.</p>'}</section>
    <div class="sec-h"><div class="h3">Данные</div></div>
    <section class="card"><p class="lead" style="margin-top:0">${cloudTxt}</p>
      <div class="btns">${c.user ? '<button class="btn alt sm" data-a="signout">Выйти</button>' : `<button class="btn sm" data-a="signin">${ic('cloud')}Войти через Google</button>`}</div>
      <button class="row-btn" data-a="export">${ic('dl')}<span>Скачать копию</span></button>
      <label class="row-btn tap">${ic('ul')}<span>Восстановить из файла</span><input type="file" accept="application/json,.json" data-a="import" hidden></label>
      <button class="row-btn" data-a="sub" data-v="settings">${ic('gear')}<span>Настройки и расчёт</span>${ic('right')}</button></section>
    <div class="sec-h"><div class="h3">Как растёт опыт</div></div>
    <section class="card"><p class="sub" style="margin-top:0">Час работы +${XPN().hour} XP, с комбо серии (+${Math.round(XPN().comboStep * 100)}% за каждую смену подряд) до ×1,5. Сумма за день +${XPN().app}. Задания дня: план +${XPN().planDay}, заработок +${XPN().moneyDay}, заказы +${XPN().ordersDay}, все сразу открывают сундук на 50‑150. Неделя без недобора +${XPN().week}, босс месяца +${XPN().boss}, жизнь на месяц оплачена +${XPN().paid}, рекорд +${XPN().record}. Отдых при низкой энергии +${XPN().rest}, отметка настроения +${XPN().mood}. Перевод в Отбасы +${XPN().per1000} за 1 000 ₸, плитка квартиры +${XPN().tile}. Вехи от 150 до 1 000, свои задания +${XPN().own}, награды от 50 до 5 000. Всё считается из записей: поправил смену, опыт пересчитался.</p></section>`;
  }
  // характеристики: уровень 1-10 из реальных записей и слабое место
  function attrsCard(pl) {
    const a = pl.attrs;
    return `<div class="sec-h"><div class="h3">Характеристики</div></div><section class="card">
      ${a.list.map(x => `<div class="attr"><div class="attr-i">${ic(x.icon)}</div><div class="attr-b"><div class="attr-t"><b>${esc(x.title)}</b><span>${x.lvl} из 10</span></div>
        <div class="attr-bar">${Array.from({ length: 10 }, (_, i) => `<i class="${i < x.lvl ? 'on' : ''}"></i>`).join('')}</div><div class="attr-s">${esc(x.val)}</div></div></div>`).join('')}
      <div class="praise green" style="margin-top:12px"><div class="praise-i">${ic('target')}</div><div class="praise-b"><div class="praise-t">Качай: ${esc(a.weak.title)}</div><div class="praise-s">${esc(a.weak.tip)}</div></div></div></section>`;
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
  // машина для такси: выбор пересчитывает прогноз; газ как улучшение с окупаемостью
  function carCard(st) {
    const g = st.set, cur = C.CARS.find(c => c.price === g.price && c.down === g.down);
    const fm = C.fuelMonth(g, C.mkOf(TODAY)), save = Math.round((fm.petrol - fm.gas) / 1000) * 1000, pay = save > 0 ? Math.ceil(g.gasCost / save) : null;
    const own = C.phaseOn(g, TODAY) === 'own';
    const mine = st.car, lp = mine ? C.loanPlan(st, TODAY) : null;
    return `<div class="sec-h"><div class="h3">Машина для такси</div><span class="link">меняет прогноз</span></div>
      ${mine ? `<section class="card"><button class="car-row on" data-a="car-edit"><span><b>${esc(mine.name)}</b><small>своя с ${C.dateShort(mine.on)} ${mine.on.slice(0, 4)} · ${C.money(mine.price)} · ${lp ? (lp.bal > 0 ? 'кредит ' + C.money(Math.round(lp.pay)) + ' в месяц' : 'кредит закрыт') : 'без кредита'}</small></span>${ic('gear')}</button>
        <div class="sub">Платёж, досрочку и остаток кредита видно в Деньгах, в карточке Моя машина.</div></section>`
      : `<section class="card">${C.CARS.map(c => `<button class="car-row${cur && cur.id === c.id ? ' on' : ''}" data-a="car-preset" data-id="${c.id}">
        <span><b>${esc(c.name)}</b><small>${esc(c.how)} · ${C.money(c.price)} · простой ${C.num1(c.lost)} смены в месяц</small></span>${cur && cur.id === c.id ? ic('check') : ''}</button>`).join('')}
      <div class="sub">Это примеры для прогноза. Права на автомате дают ездить и на механике, дешёвые машины почти все на механике. Цены: медианы объявлений на 17.11.2026.</div>
      <div class="btns"><button class="btn alt" data-a="car-buy">${ic('car')}Купил машину: записать свою</button></div></section>`}
      <section class="card"><div class="between"><div><div class="over">Улучшение</div><div class="h3">Газ (ГБО)</div></div>${g.fuel === 'gas' ? `<span class="chip green">${ic('check')}стоит</span>` : xpChip(G.QUEST_XP.gas)}</div>
        <p class="lead">${C.money(g.gasCost)} один раз. Экономия на топливе около <b class="up">${C.money(save)}</b> в месяц${pay ? `, окупится за ${pay} ${C.plural(pay, ['месяц', 'месяца', 'месяцев'])}` : ''}.</p>
        ${g.fuel === 'gas' ? '' : own ? `<div class="btns"><button class="btn sm" data-a="gas-on">${ic('bolt')}Поставил газ</button></div>` : '<div class="sub">Откроется, когда будет своя машина.</div>'}</section>`;
  }
  const badgeTile = b => `<button class="bd${b.on ? '' : ' locked'}" data-a="badge" data-id="${b.id}">${D.medal(b.icon, b.color || 'violet', !b.on)}<b>${esc(b.title)}</b><span>${b.on ? C.dateShort(b.on) : progText(b)}</span>${b.on ? '' : `<div class="pbar sm"><i style="width:${(b.pct * 100).toFixed(1)}%"></i></div>`}</button>`;
  const FIELDS = [
    ['Цель', [['target', 'Сумма цели, ₸', 'money'], ['deadline', 'Срок', 'date'], ['why', 'Зачем тебе квартира (увидишь, когда тяжело)', 'text']]],
    ['До такси: подработка', [['preFrom', 'Подработка с (пусто: без неё)', 'date'], ['preRate', 'Чистыми в час, ₸', 'money'], ['preOnce', 'Разовые траты до такси: автошкола, справки, залоги, ₸', 'money'], ['preOnceDate', 'Когда платишь', 'date'], ['startBuf', 'Нужно на старт такси: залог, первые дни, ₸', 'money']]],
    ['Конверты до такси, в месяц', C.ENV.map(k => ['envPre.' + k, C.ENV_TITLE[k] + ', ₸', 'money'])],
    ['Конверты на такси, в месяц', C.ENV.map(k => ['env.' + k, C.ENV_TITLE[k] + ', ₸', 'money'])],
    ['Такси', [['R', 'Пассажиры платят за час на линии, ₸', 'money'], ['rLog', 'Считать по моим сменам (от 10 смен)', 'bool']]],
    ['Даты', [['otbOpen', 'Депозит Отбасы открыт', 'date'], ['license', 'Права', 'date'], ['taxiFrom', 'Первая смена в такси', 'date'], ['carFrom', 'Своя машина с (пусто: всё время аренда)', 'date']]],
    ['Машина', [['price', 'Цена машины, ₸', 'money'], ['down', 'Взнос, %', 'num'], ['v36', 'Цена продажи через 3 года, ₸', 'money'], ['l100', 'Расход, л на 100 км', 'num'], ['repair', 'Резерв на ремонт в месяц, ₸', 'price'], ['fuel', 'Топливо', 'fuel'], ['gasFrom', 'Газ с (пусто: сразу с покупки)', 'date']]],
    ['Топливо', [['petrol', 'Бензин сейчас, ₸ за литр', 'price'], ['gas', 'Газ сейчас, ₸ за литр', 'price']]],
    ['Аренда', [['rentDay', 'Аренда в сутки сейчас, ₸', 'price'], ['rentL100', 'Расход арендной машины, л на 100 км', 'num']]],
  ];
  const getF = (g, k) => k.indexOf('.') > 0 ? (g[k.split('.')[0]] || {})[k.split('.')[1]] : g[k];
  function vSettings() {
    const g = S().set, FN = C.growth(g, TODAY.slice(0, 7))[0];
    // конверты хранятся в ценах начала пути, а месяц показывает их с ростом цен
    const priceNote = key => `<p class="sub">Суммы в ценах ${C.dateLong(g.start + '-01').replace(/^\d+\s/, '')}. Каждый месяц они растут вместе с ценами, на ${C.num1(g.gCost)}% в год: сейчас выходит ${C.money(Math.round(C.envSum(g[key]) * C.growth(g, TODAY.slice(0, 7))[0] / 1000) * 1000)} в месяц.</p>`;
    const field = ([k, label, type]) => {
      const v = getF(g, k);
      if (type === 'bool') return `<label class="fld sw"><span>${label}</span><input type="checkbox" data-f="${k}" ${v ? 'checked' : ''}></label>`;
      if (type === 'fuel') return `<div class="fld"><span>${label}</span><div class="segm">${[['petrol', 'бензин'], ['gas', 'газ']].map(([x, n]) => `<button data-a="fuel" data-v="${x}" aria-pressed="${v === x}">${n}</button>`).join('')}</div></div>`;
      if (type === 'date') return `<label class="fld"><span>${label}</span><input type="date" data-f="${k}" value="${esc(v || '')}"></label>`;
      if (type === 'text') return `<label class="fld"><span>${label}</span><input data-f="${k}" data-t="text" maxlength="120" value="${esc(v || '')}" placeholder="например: своя квартира в 23"></label>`;
      if (type === 'price') return `<label class="fld"><span>${label}</span><input inputmode="numeric" data-f="${k}" data-t="price" value="${fmtIn(Math.round(v * FN))}"></label>`;
      return `<label class="fld"><span>${label}</span><input inputmode="decimal" data-f="${k}" data-t="${type}" value="${type === 'money' ? fmtIn(v) : esc(String(v == null ? '' : v).replace('.', ','))}"></label>`;
    };
    // своя машина записана: её цена и кредит меняются в карточке Моя машина
    const carOwn = ['price', 'down', 'v36'], hide = f => S().car && carOwn.indexOf(f[0]) >= 0;
    return `
    <header class="top"><div class="top-r"><button class="icon-btn" data-a="sub-back" aria-label="Назад">${ic('left')}</button><div><div class="top-k">Профиль</div><h1 class="top-t">Настройки</h1></div></div></header>
    ${FIELDS.map(([t, fs]) => `<section class="card"><div class="over">${t}</div>${t === 'Машина' && S().car ? `<p class="sub">Своя машина записана: ${esc(S().car.name)}. Цена и кредит меняются в Деньгах, в карточке Моя машина.</p>` : ''}${fs.filter(f => !hide(f)).map(field).join('')}${t.indexOf('Конверты') === 0 ? priceNote(t.indexOf('до такси') > 0 ? 'envPre' : 'env') : ''}</section>`).join('')}
    <section class="card"><div class="over">План</div><p class="sub">С планом сравнивается, впереди ты или отстаёшь. Если поменял цель, даты или машину, пересчитай план от сегодня.</p>
      <div class="btns"><button class="btn alt sm" data-a="rebase">Пересчитать план от сегодня</button></div></section>
    <section class="card"><div class="over">Как считается</div><p class="sub">Помесячно: комиссия Яндекса 17%, парк 5,9% на аренде, соцплатежи самозанятого 4%, бензин 255 ₸, газ 112 ₸ за литр, рост цен 9% в год, выручки ${C.num1(g.gRev)}% в год, кредит около 2,5% в месяц с досрочкой, Отбасы 2% годовых и премия 20% до 200 МРП в год. Жизнь вычитается по конвертам, машина считается по цене продажи, кредит вычитается.</p></section>
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
    sheetOpen = false;
    const root = $('#sheet'); root.classList.remove('open');
    setTimeout(() => { if (!sheetOpen) { root.hidden = true; root.innerHTML = ''; } }, 220);
    if (!fromPop && history.state && history.state.put === 'sheet') { ignorePop++; history.back(); }
  }
  // уйти из настроек не кнопкой назад: убрать их шаг из истории
  function leaveSub() { if (UI.sub && history.state && history.state.put === 'sub') { ignorePop++; history.back(); } UI.sub = null; }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop--; return; }
    if (sheetOpen) closeSheet(true);
    else if (UI.sub) { UI.sub = null; render(); }
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
    const st = S(), np = nowParts(st);
    const last = { cash: r1k(np.cash), otb: Math.round(np.otb), car: r1k(np.car), loan: Math.round(np.loan) };
    sheet(`<div class="sh-t">Сверить: сколько сейчас</div><div class="sh-s">Активы = деньги + Отбасы + машина − кредит. Подставлено, сколько примерно должно быть.</div>
      ${[['cash', 'Деньги: карты, наличные (минус, если долг)'], ['otb', 'Отбасы'], ['car', 'Машина, цена продажи'], ['loan', 'Кредит, остаток']].map(([k, n]) => `<label class="fld"><span>${n}, ₸</span><input inputmode="numeric" id="f-${k}" ${k === 'cash' ? 'data-neg="1"' : ''} value="${fmtIn(last[k])}"></label>`).join('')}
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
  function snap() { const pl = playerOf(S(), C.today()); return { xp: pl.xp, keys: new Set(pl.ledger.map(evKey)) }; }
  // msgs: сообщения самого действия, к ним добавятся сундук, рекорд и плитка
  function after(before, msgs) {
    const pl = playerOf(S(), C.today()), fresh = pl.ledger.filter(e => !before.keys.has(evKey(e)));
    msgs = (msgs || []).slice();
    popXp(pl.xp - before.xp);
    for (const e of fresh) {
      if (e.kind === 'boss') fxQueue.push({ kind: 'event', art: D.medal('trophy', 'gold', false, 120), k: 'Босс побеждён', t: esc(e.text.replace('Босс побеждён: ', '')), s: 'План месяца по часам закрыт. +' + C.grp(e.xp) + ' XP.' });
      if (e.kind === 'paid') fxQueue.push({ kind: 'event', art: D.medal('wallet', 'green', false, 120), k: 'Месяц оплачен', t: esc(e.text), s: 'Жильё, еда и всё остальное покрыты заработком. Дальше каждая смена на квартиру.' });
      if (e.kind === 'chest') msgs.push(['Сундук дня открыт: +' + C.grp(e.xp) + ' XP', 'good']);
      if (e.kind === 'record') msgs.push([e.text.replace(/^Рекорд/, 'Новый рекорд'), 'good']);
      if (e.kind === 'tile') msgs.push(['Новая плитка квартиры: ' + e.text.replace('Плитка квартиры ', '') + ' собрано', 'good']);
    }
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
  function celebrate() {
    const st = S(); if (!st || !st.money.length) return;
    const pl = playerOf(st, C.today()), got = pl.badges.filter(b => b.on).map(b => b.id);
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
    Store.update(s => {
      const x = s.shifts[d] || {}, now = Date.now(); x.h = h; if (app != null) x.app = app; if (orders != null) x.orders = orders; x.t = x.t || now; x.u = now; s.shifts[d] = x;
      if (s.live && s.live.d === d) s.live = null;
      if (h > 0 && s.bad && s.bad[d]) { delete s.bad[d]; C.forget(s, 'bad/' + d); }
    }, 'log');
    const st = S(), p = praiseOf(st, d, C.forecast(st, TODAY));
    buzz(p && p.tone === 'good' ? [12, 40, 12] : 10);
    after(before, p ? [[p.title + '. ' + p.text, p.tone === 'warn' ? 'warn' : 'good']] : []);
  }
  const clearDraft = () => { UI.dh = null; UI.dapp = ''; UI.dord = ''; };
  function act(a, el) {
    refresh();
    const d = el.dataset.d;
    switch (a) {
      case 'tab': leaveSub(); UI.tab = el.dataset.tab; UI.week = 0; UI.sel = null; clearDraft(); try { sessionStorage.setItem('put.tab', UI.tab); } catch (e) { /* ок */ } render(); window.scrollTo(0, 0); break;
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
        closeSheet(); clearDraft(); logShift(d, Math.max(0, Math.min(24, h)), app > 0 ? app : 0, ord > 0 ? Math.round(ord) : 0); break;
      }
      case 'del-log': Store.update(s => { delete s.shifts[d]; C.forget(s, 'shifts/' + d); }, 'log'); clearDraft(); closeSheet(); toast('Запись удалена'); break;
      case 'set-plan': Store.update(s => { s.over[d] = +el.dataset.h; }, 'plan'); toast(+el.dataset.h ? `План на ${C.dateShort(d)}: ${el.dataset.h} ч` : `${C.dateShort(d)}: выходной`); break;
      case 'clear-plan': Store.update(s => { delete s.over[d]; C.forget(s, 'over/' + d); if (s.bad && s.bad[d]) { delete s.bad[d]; C.forget(s, 'bad/' + d); } }, 'plan'); break;
      case 'tpl': tplSheet(+el.dataset.i, el.dataset.k || 'tpl'); break;
      case 'set-tpl': Store.update(s => { const k = el.dataset.k === 'preTpl' ? 'preTpl' : 'tpl'; s.set[k] = (s.set[k] || [0, 0, 0, 0, 0, 0, 0]).slice(); s.set[k][+el.dataset.i] = +el.dataset.h; }, 'tpl'); closeSheet(); break;
      case 'mood': { const before = snap(); Store.update(s => { s.mood = s.mood || {}; s.mood[TODAY] = +el.dataset.v; }, 'mood'); after(before, [[+el.dataset.v <= 2 ? 'Записал. Береги себя: сон и еда сейчас важнее лишнего часа.' : C.planHours(S(), TODAY) > 0 ? 'Записал. Хорошей смены.' : 'Записал. Хорошего дня.']]); break; }
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
        Store.update(s => { if (s.done[id]) { delete s.done[id]; C.forget(s, 'done/' + id); } else s.done[id] = TODAY; }, 'done');
        if (S().done[id]) { buzz([12, 40, 12]); after(before, [['Веха пройдена.', 'good']]); }
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
      case 'perk': {
        const id = el.dataset.id, pl = playerOf(S(), TODAY), x = pl.skills.list.find(p => p.id === id);
        if (!x || !x.can || pl.skills.free <= 0) break;
        Store.update(s => { s.perks = s.perks || {}; s.perks[id] = (s.perks[id] || []).concat([TODAY]).slice(0, 3); }, 'perk');
        toast(`Навык изучен: ${x.title}, ступень ${x.r + 1}. ${x.next}.`, 'good'); buzz([12, 40, 12]); break;
      }
      case 'perk-reset': if (confirm('Сбросить все навыки? Очки вернутся, изучишь заново.')) { Store.update(s => { s.perks = {}; }, 'perk'); toast('Навыки сброшены, очки вернулись'); } break;
      case 'car-preset': {
        const c = C.CARS.find(x => x.id === el.dataset.id); if (!c) break;
        Store.update(s => { Object.assign(s.set, { price: c.price, down: c.down, v36: c.v36, l100: c.l100, repair: c.repair, lost: c.lost }); }, 'set');
        toast(`Машина: ${c.name}, ${c.how}. Прогноз пересчитан.`, 'good'); break;
      }
      case 'wif': UI.wif = !UI.wif; render(); break;
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
        Store.update(s => { s.live = { d: TODAY, start: Date.now(), brk: [] }; }, 'live');
        buzz(20); toast(`Смена пошла. Напомню про перерыв через ${hm(BREAK_MIN)}, если приложение будет открыто.`, 'good'); break;
      }
      case 'live-pause': Store.update(s => { const L = s.live; if (!L) return; const now = Date.now(); if (L.on) { L.brk.push([L.on, now]); L.on = null; } else L.on = now; }, 'live'); break;
      case 'live-stop': {
        Store.update(s => { const L = s.live; if (!L) return; const now = Date.now(); if (L.on) { L.brk.push([L.on, now]); L.on = null; } L.end = now; }, 'live');
        const L = S().live; if (L) logSheet(L.d, liveHours(L)); break;
      }
      case 'live-log': { const L = S().live; if (L) logSheet(L.d, liveHours(L)); break; }
      case 'live-cancel': if (confirm('Сбросить таймер смены? Внесённое не пропадёт.')) Store.update(s => { s.live = null; }, 'live'); break;
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
        else { const f = $('#f-cf'); if (f && num0(f.value) === +f.dataset[was]) f.value = fmtIn(+f.dataset[v]); $('#f-cf-l').textContent = 'Литр ' + (v === 'gas' ? 'газа' : 'бензина') + ', ₸'; }
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
      case 'gas-on': {
        const g = S().set;
        if (!confirm(`Записать установку газа за ${C.money(g.gasCost)}? С сегодняшнего дня расчёт считает топливо по газу.`)) break;
        const before = snap();
        Store.update(s => { s.set.fuel = 'gas'; s.set.gasFrom = TODAY; s.done.gas = TODAY; s.money.push({ d: TODAY, kind: 'add', add: -s.set.gasCost, to: 'cash', note: 'газ (ГБО)', t: Date.now() }); s.money.sort(C.byDate); }, 'set');
        after(before, [['Газ стоит. Топливо дешевле, прогноз пересчитан.', 'good']]); break;
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
        if (i.dataset.t === 'price') { if (!(v > 0)) return no('Впиши сумму больше нуля'); v = v / C.growth(S().set, TODAY.slice(0, 7))[0]; }
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
    i.value = i.type === 'date' ? v || '' : i.dataset.t === 'money' ? fmtIn(v) : i.dataset.t === 'price' ? fmtIn(Math.round(v * C.growth(S().set, TODAY.slice(0, 7))[0])) : String(v == null ? '' : v).replace('.', ',');
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
    if (el.id === 'f-pa') payoffCalc();
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
  let shownDay = TODAY;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && C.today() !== shownDay) { shownDay = C.today(); UI.sel = null; clearDraft(); render(); celebrate(); } });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
