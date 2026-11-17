/* Путь к квартире: рисунки. Иконки, шестигранник уровня, медали, спидометр активов, дорога с вехами, машинка. */
const Draw = (() => {
  'use strict';
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  const fx2 = n => n.toFixed(2);

  // ---------------------------------------------------------------- иконки (24×24, линией; flame, bolt, star залиты)
  const ICONS = {
    gauge: '<path d="M3.5 16a8.5 8.5 0 1 1 17 0"/><path d="M12 16l4.5-5"/><circle cx="12" cy="16" r="1.4"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 14.5l2 2 4-4"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M16 13.5h2"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
    user: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="10.2" r="2.6"/><path d="M7.8 16.4c1-1.8 2.5-2.7 4.2-2.7s3.2.9 4.2 2.7"/>',
    flame: '<path fill="currentColor" stroke="none" d="M12 21.5c3.6 0 6-2.4 6-5.6 0-2.8-1.6-4.7-3-6.2-.4 1.7-1.5 2.9-2.8 3.4.5-3.2-.6-6-2.8-8.3-.4 2.7-1.9 4.5-3.3 6C4.9 12.4 4 13.8 4 16c0 3.3 3.3 5.5 8 5.5z"/>',
    bolt: '<path fill="currentColor" stroke="none" d="M13.2 2 4.8 13.6h6.1L10 22l8.4-11.7h-6.1z"/>',
    star: '<path fill="currentColor" stroke="none" d="M12 2.8l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2L3 9.4l6.2-.9z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    cash: '<rect x="3" y="7" width="18" height="11" rx="2.5"/><circle cx="12" cy="12.5" r="2.5"/><path d="M7 4.5h10"/>',
    coins: '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M10 15.4c.6 1.2 2.6 2.1 5 2.1 2.8 0 5-1.1 5-2.5v-4c0-1.4-2.2-2.5-5-2.5-.3 0-.7 0-1 .1"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
    bank: '<path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 19.5h17"/>',
    house: '<path d="M4 11L12 4.5 20 11"/><path d="M6 9.5V19.5h12V9.5"/><path d="M10 19.5v-5h4v5"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.5c2.6-.9 5.3-1.3 8.2-1.3s5.6.4 8.2 1.3M10.4 13.6L7 19.6M13.6 13.6l3.4 6"/>',
    car: '<path d="M4.5 16.5V13l2-5h11l2 5v3.5z"/><path d="M4.5 13h15"/><circle cx="8" cy="16.5" r="1.8"/><circle cx="16" cy="16.5" r="1.8"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    up: '<path d="M3.5 16.5l5.5-5.5 3.5 3.5 8-8"/><path d="M15 6.5h5.5V12"/>',
    down: '<path d="M3.5 7.5l5.5 5.5 3.5-3.5 8 8"/><path d="M15 17.5h5.5V12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.2A3.5 3.5 0 0 0 7 18.5z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5"/>',
    dl: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    ul: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
    piggy: '<path d="M4 12.5c0-3.6 3.4-6 7.5-6 2.7 0 4.9 1 6.2 2.6l2.3-.6-.5 2.6c.5.8.8 1.6.8 2.6 0 1.5-.7 2.8-1.8 3.8V20h-3v-1.6c-1.2.3-2.6.4-4 .3V20h-3v-2.2C5.4 16.8 4 14.8 4 12.5z"/><path d="M10 6.6V5.4h3v1.2"/>',
  };
  const sprite = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  const ic = (name, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // ---------------------------------------------------------------- шестигранник уровня
  let uid = 0;
  function hex(level, w) {
    const id = 'hx' + (++uid), h = w * 50 / 44, fs = String(level).length > 2 ? 14 : 18;
    return `<svg class="hex" width="${w}" height="${f1(h)}" viewBox="0 0 44 50" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ABA0FF"/><stop offset="1" stop-color="#6E5DF2"/></linearGradient></defs>
      <path d="M22 8 38 17v17L22 43 6 34V17z" fill="#4636B8" stroke="#4636B8" stroke-width="5" stroke-linejoin="round"/>
      <path d="M22 4 38 13v17L22 39 6 30V13z" fill="url(#${id})" stroke="url(#${id})" stroke-width="5" stroke-linejoin="round"/>
      <path d="M22 4 38 13" stroke="rgba(255,255,255,.35)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <text x="22" y="${fs === 18 ? 28.5 : 27}" text-anchor="middle" font-size="${fs}">${level}</text></svg>`;
  }

  // ---------------------------------------------------------------- медаль достижения
  const MEDAL = {
    yellow: ['#FFC83D', '#B88308', '#4A3400'], orange: ['#FF9B3F', '#B85A12', '#FFF1DE'], green: ['#3DDC91', '#1C9A61', '#063A21'],
    violet: ['#8E7DFF', '#5243CF', '#FFFFFF'], blue: ['#5AA8FF', '#2F6FC2', '#062242'], gold: ['#FFD86B', '#C98A12', '#3A2600'], locked: ['#262E4A', '#151B30', '#6F789A'],
  };
  function medal(icon, color, locked, w) {
    const [face, lip, ink] = MEDAL[locked ? 'locked' : color] || MEDAL.violet;
    w = w || 46;
    return `<svg class="medal" width="${w}" height="${f1(w * 50 / 46)}" viewBox="0 0 46 50" aria-hidden="true">
      <path d="M23 7 40 16.5v18L23 44 6 34.5v-18z" fill="${lip}" stroke="${lip}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M23 3 40 12.5v18L23 40 6 30.5v-18z" fill="${face}" stroke="${face}" stroke-width="5" stroke-linejoin="round"/>
      <svg x="12" y="10" width="22" height="22" viewBox="0 0 24 24" class="ic-in" style="color:${ink}"><use href="#i-${locked ? 'lock' : icon}"/></svg></svg>`;
  }

  // ---------------------------------------------------------------- спидометр активов: дуга 270°, шкала 0..цель
  function gauge(pct, target) {
    const cx = 160, cy = 168, R = 118, p = Math.max(0, Math.min(1, pct || 0));
    const pt = (th, r) => { const a = (135 + th) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const arc = (t1, r) => { const [x0, y0] = pt(0, r), [x1, y1] = pt(t1, r); return `M${fx2(x0)} ${fx2(y0)}A${r} ${r} 0 ${t1 > 180 ? 1 : 0} 1 ${fx2(x1)} ${fx2(y1)}`; };
    let ticks = '';
    for (let i = 0; i <= 40; i++) {
      const th = 270 * i / 40, major = i % 10 === 0, mid = i % 5 === 0, on = i / 40 <= p + 1e-9;
      const [x0, y0] = pt(th, 134), [x1, y1] = pt(th, major ? 146 : mid ? 140 : 137.5);
      ticks += `<path d="M${f1(x0)} ${f1(y0)}L${f1(x1)} ${f1(y1)}" stroke="${on ? '#3DDC91' : '#FFFFFF'}" stroke-opacity="${on ? (major ? 1 : .6) : (major ? .34 : .13)}" stroke-width="${major ? 2.4 : mid ? 2 : 1.5}"/>`;
    }
    const m = target / 1e6, lab = q => { const v = m * q / 4; return (Math.round(v * 100) / 100).toString().replace('.', ','); };
    const labs = [0, 1, 2, 3, 4].map(q => { const [x, y] = pt(67.5 * q, 157); return `<text class="g-lab${q / 4 <= p + 1e-9 ? ' on' : ''}" x="${f1(x)}" y="${f1(y)}" text-anchor="middle" dominant-baseline="central">${lab(q)}${q === 4 ? ' млн' : ''}</text>`; }).join('');
    const [ex, ey] = pt(270 * p, R), [sx, sy] = pt(0, R);
    const val = p > 0.004 ? `<path d="${arc(270 * p, R)}" fill="none" stroke="#5FE59A" stroke-opacity=".55" stroke-width="18" stroke-linecap="round" filter="url(#gGlow)"/>
      <path d="${arc(270 * p, R)}" fill="none" stroke="url(#gArc)" stroke-width="16" stroke-linecap="round"/>` : '';
    return `<svg viewBox="0 0 320 296" aria-hidden="true">
      <defs><linearGradient id="gArc" gradientUnits="userSpaceOnUse" x1="${f1(sx)}" y1="${f1(sy)}" x2="${f1(ex)}" y2="${f1(ey)}"><stop offset="0" stop-color="#1FAE6E"/><stop offset="1" stop-color="#A4F5BF"/></linearGradient>
        <radialGradient id="gFace" cx="50%" cy="42%" r="58%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".055"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
        <filter id="gGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter></defs>
      <circle cx="${cx}" cy="${cy}" r="102" fill="url(#gFace)"/>
      <g fill="none" stroke-linecap="round">${ticks}</g>
      <path d="${arc(270, R)}" fill="none" stroke="rgba(255,255,255,.075)" stroke-width="16" stroke-linecap="round"/>
      ${val}
      <circle cx="${f1(ex)}" cy="${f1(ey)}" r="12" fill="#3DDC91" fill-opacity=".22"/><circle cx="${f1(ex)}" cy="${f1(ey)}" r="5" fill="#EFFFF5"/>
      ${labs}</svg>`;
  }

  // ---------------------------------------------------------------- машинка (вид сверху, нос вправо)
  function carShape(body, shade) {
    return `<rect x="-15" y="-8.5" width="30" height="17" rx="6" fill="${body}"/>
      <rect x="-15" y="2.5" width="30" height="6" rx="3" fill="${shade}" opacity=".55"/>
      <rect x="2.6" y="-6.6" width="7.4" height="13.2" rx="2.6" fill="#232A45"/>
      <rect x="-11.6" y="-6" width="5" height="12" rx="2.2" fill="#232A45"/>
      <rect x="-4.6" y="-3.3" width="5.6" height="6.6" rx="1.5" fill="#FFF6D6" stroke="${shade}" stroke-width=".8"/>
      <circle cx="14.3" cy="-5.6" r="1.6" fill="#FFFCEB"/><circle cx="14.3" cy="5.6" r="1.6" fill="#FFFCEB"/>`;
  }
  const carIcon = (body, shade) => `<svg viewBox="-26 -15 52 30" aria-hidden="true"><ellipse rx="18" ry="10" cy="3" fill="#000" opacity=".35"/>${carShape(body, shade)}</svg>`;

  // ---------------------------------------------------------------- дорога: станции по порядку, машина между пройденной и следующей
  // stations: [{title, sub, icon, state: 'done'|'next'|'todo', goal}], car: {seg, t}, tag: {text, tone} | null
  function road(stations, car, skin, tag) {
    const N = stations.length, P = [[-36, 182]];
    for (let k = 0; k < N; k++) {
      const f = N === 1 ? 1 : k / (N - 1), wig = k === N - 1 ? 0 : (k % 2 ? -16 : 14);
      P.push([30 + f * 292, 156 - f * 100 + wig]);
    }
    // сплайн Катмулла-Рома через точки → кубические Безье
    const segs = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      segs.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
    }
    const bez = (s, t) => { const u = 1 - t; return [0, 1].map(j => u * u * u * s[0][j] + 3 * u * u * t * s[1][j] + 3 * u * t * t * s[2][j] + t * t * t * s[3][j]); };
    const tan = (s, t) => { const u = 1 - t; const d = [0, 1].map(j => 3 * u * u * (s[1][j] - s[0][j]) + 6 * u * t * (s[2][j] - s[1][j]) + 3 * t * t * (s[3][j] - s[2][j])); return Math.atan2(d[1], d[0]) * 180 / Math.PI; };
    const path = (to) => 'M' + P[0].map(f1).join(' ') + segs.slice(0, to).map(s => `C${f1(s[1][0])} ${f1(s[1][1])},${f1(s[2][0])} ${f1(s[2][1])},${f1(s[3][0])} ${f1(s[3][1])}`).join('');
    const all = path(segs.length);
    // след: до машины
    const cs = segs[Math.min(car.seg, segs.length - 1)], ct = Math.max(0, Math.min(1, car.t));
    const [carX, carY] = bez(cs, ct), ang = tan(cs, ct);
    const half = (s, t) => { // первая часть сегмента до t (де Кастельжо)
      const l = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const a = l(s[0], s[1]), b = l(s[1], s[2]), c = l(s[2], s[3]), d = l(a, b), e = l(b, c), g = l(d, e);
      return `C${f1(a[0])} ${f1(a[1])},${f1(d[0])} ${f1(d[1])},${f1(g[0])} ${f1(g[1])}`;
    };
    const trail = path(Math.min(car.seg, segs.length)) + (car.seg < segs.length ? half(cs, ct) : '');
    const st = stations.map((s, k) => {
      const [x, y] = P[k + 1], below = k % 2 === 0, last = k === N - 1;
      const ty = below ? 30 : -18, anchor = last ? 'end' : 'middle', tx = last ? -26 : 0;
      const lbl = last ? `<text class="lb lb-goal" x="${tx}" y="-22" text-anchor="end">${s.title}</text><text class="lb-sub" x="${tx}" y="-8" text-anchor="end">${s.sub || ''}</text>`
        : `<text class="lb ${s.state === 'done' ? 'lb-done' : s.state === 'next' ? 'lb-next' : ''}" x="${tx}" y="${ty}" text-anchor="${anchor}">${s.title}</text>` +
          (s.sub ? `<text class="lb-sub" x="${tx}" y="${below ? ty + 14 : ty - 13}" text-anchor="${anchor}">${s.state === 'next' ? `<tspan class="lb-y">${s.sub}</tspan>` : s.sub}</text>` : '');
      let dot;
      if (last) dot = `<circle r="46" fill="url(#rGoal)"/><circle r="19" cy="4" fill="#B5770A"/><circle r="19" fill="url(#rGold)"/><circle r="18.5" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/><svg x="-10.5" y="-11.5" width="21" height="21" viewBox="0 0 24 24" class="ic-in" style="color:#3A2600"><use href="#i-${s.icon}"/></svg>`;
      else if (s.state === 'done') dot = `<circle r="12" cy="3" fill="#1C9A61"/><circle r="12" fill="#3DDC91"/><svg x="-7" y="-7" width="14" height="14" viewBox="0 0 24 24" class="ic-in" style="color:#05301A;stroke-width:3"><use href="#i-check"/></svg>`;
      else if (s.state === 'next') dot = `<circle r="21" fill="none" stroke="#FFC83D" stroke-opacity=".28" stroke-width="1.5"/><circle r="13" cy="3" fill="#0A0E24"/><circle r="13" fill="#1B2148" stroke="#FFC83D" stroke-width="2.5"/><svg x="-8" y="-8" width="16" height="16" viewBox="0 0 24 24" class="ic-in" style="color:#FFC83D"><use href="#i-${s.icon}"/></svg>`;
      else dot = `<circle r="12" cy="3" fill="#0A0E24"/><circle r="12" fill="#252D58" stroke="rgba(255,255,255,.24)" stroke-width="1.5"/><svg x="-7.5" y="-7.5" width="15" height="15" viewBox="0 0 24 24" class="ic-in" style="color:#B3BBDD"><use href="#i-${s.icon}"/></svg>`;
      return `<g transform="translate(${f1(x)} ${f1(y)})">${dot}${lbl}</g>`;
    }).join('');
    const tg = tag ? (() => {
      const w = Math.max(56, tag.text.length * 6.6 + 30), fill = tag.tone === 'down' ? '#FF7867' : '#3DDC91', ink = tag.tone === 'down' ? '#3A0D06' : '#062E1B';
      return `<g transform="translate(${f1(carX)} ${f1(carY)})"><rect x="${f1(-w / 2)}" y="-46" width="${f1(w)}" height="22" rx="11" fill="${fill}"/><path d="M-5 -24.5 0 -19 5 -24.5z" fill="${fill}"/>
        <svg x="${f1(-w / 2 + 7)}" y="-42" width="14" height="14" viewBox="0 0 24 24" class="ic-in" style="color:${ink}"><use href="#i-${tag.tone === 'down' ? 'down' : 'up'}"/></svg>
        <text class="tag" x="${f1(-w / 2 + 25)}" y="-31" fill="${ink}">${tag.text}</text></g>`;
    })() : '';
    return `<svg class="road" viewBox="0 0 358 200" role="img" aria-label="${stations.map(s => s.title + (s.state === 'done' ? ' пройдено' : '')).join(', ')}">
      <defs>
        <linearGradient id="rTrail" x1="0" x2="1"><stop offset="0" stop-color="#3DDC91" stop-opacity="0"/><stop offset=".3" stop-color="#3DDC91"/><stop offset="1" stop-color="#9DF0B5"/></linearGradient>
        <radialGradient id="rGoal"><stop offset="0" stop-color="#FFC83D" stop-opacity=".5"/><stop offset="1" stop-color="#FFC83D" stop-opacity="0"/></radialGradient>
        <linearGradient id="rBeam" x1="0" x2="1"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".45"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></linearGradient>
        <linearGradient id="rGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE38F"/><stop offset="1" stop-color="#FFB21F"/></linearGradient>
        <filter id="rBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
        <linearGradient id="rHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <path d="M0 172 C 70 146, 130 166, 200 154 S 320 128, 358 136 V200 H0 Z" fill="url(#rHill)"/>
      <path d="M0 190 C 90 174, 170 194, 250 182 S 330 172, 358 176 V200 H0 Z" fill="url(#rHill)"/>
      <g fill="#131840"><rect x="298" y="30" width="10" height="34" rx="1.5"/><rect x="310" y="18" width="11" height="46" rx="1.5"/><rect x="323" y="26" width="9" height="38" rx="1.5"/><rect x="346" y="24" width="11" height="40" rx="1.5"/></g>
      <g stroke="#7F89D6" stroke-linecap="round" fill="none" opacity=".75"><path d="M339 62V17" stroke-width="2.4"/><path d="M339 19c-3.6-1.6-5.4-5-5-9.2M339 19c3.6-1.6 5.4-5 5-9.2M339 19V8" stroke-width="1.6"/><path d="M335 62l4-7 4 7" stroke-width="1.6"/></g>
      <circle cx="339" cy="6.6" r="7.5" fill="#FFC83D" opacity=".22"/><circle cx="339" cy="6.6" r="4.4" fill="#FFD36B"/>
      <g fill="#FFD36B" opacity=".55"><rect x="301" y="36" width="2" height="2"/><rect x="304" y="44" width="2" height="2"/><rect x="313" y="24" width="2" height="2"/><rect x="317" y="34" width="2" height="2"/><rect x="326" y="32" width="2" height="2"/><rect x="349" y="30" width="2" height="2"/><rect x="353" y="40" width="2" height="2"/></g>
      <path d="${all}" fill="none" stroke="#0A0E24" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${all}" fill="none" stroke="#39416E" stroke-width="25" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${all}" fill="none" stroke="#2A3159" stroke-width="21" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${all}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="2" stroke-dasharray="7 9"/>
      <path d="${trail}" fill="none" stroke="#3DDC91" stroke-width="8" stroke-linecap="round" opacity=".35" filter="url(#rBlur)"/>
      <path d="${trail}" fill="none" stroke="url(#rTrail)" stroke-width="3.5" stroke-linecap="round"/>
      ${st}
      <g transform="translate(${f1(carX)} ${f1(carY)}) rotate(${f1(ang)})">
        <path d="M14 -5 L48 -17 Q55 0 48 17 L14 5 Z" fill="url(#rBeam)"/>
        <ellipse rx="19" ry="12" cy="2" fill="#000" opacity=".5" filter="url(#rBlur)"/>${carShape(skin.body, skin.shade)}</g>
      ${tg}</svg>`;
  }

  // ---------------------------------------------------------------- искры для праздника
  function sparks(n) {
    const colors = ['#FFC83D', '#8E7DFF', '#3DDC91', '#FF9B3F', '#5AA8FF'];
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * .4, d = 90 + Math.random() * 90;
      out += `<i class="spark" style="background:${colors[i % colors.length]};--dx:${f1(Math.cos(a) * d)}px;--dy:${f1(Math.sin(a) * d)}px;left:50%;top:50%;animation-delay:${f1(Math.random() * .25)}s"></i>`;
    }
    return out;
  }

  return { sprite, ic, hex, medal, gauge, road, carIcon, sparks };
})();
