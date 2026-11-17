/* Путь к квартире: хранение. Всё лежит на телефоне (localStorage) и работает без интернета.
   По желанию вход через Google: копия в Firestore (users/<uid>/put/state), видна на всех устройствах.
   Firebase грузится только после входа, поэтому приложение открывается сразу. */
const Store = (() => {
  'use strict';
  const KEY = 'put.state.v1', PREV = 'put.state.prev', CLOUD = 'put.cloud', DEV = 'put.device', SYNCED = 'put.synced';
  const CFG = window.PUT_FIREBASE || null;
  const SDK = n => `https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}.js`;
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* нет доступа */ } },
  };
  const device = ls.get(DEV) || (() => { const d = Math.random().toString(36).slice(2, 10); ls.set(DEV, d); return d; })();

  let state = null, listeners = [], saveT = null, pushT = null;
  // updated состояния, которое последний раз совпало с облаком на этом устройстве
  let synced = +(ls.get(SYNCED) || 0);
  const setSynced = v => { synced = v || 0; ls.set(SYNCED, String(synced)); };
  const dirty = () => !!state && (state.updated || 0) > synced;
  const cloud = { on: ls.get(CLOUD) === 'on', user: null, status: 'off', error: '', fs: null, ref: null, unsub: null };

  function load() {
    let s = null;
    try { s = JSON.parse(ls.get(KEY) || 'null'); } catch (e) { s = null; }
    state = s ? Core.migrate(s) : null;
    return state;
  }
  const get = () => state;
  const emit = why => listeners.forEach(f => { try { f(why); } catch (e) { console.error(e); } });
  const onChange = f => { listeners.push(f); };

  // изменить состояние: fn получает черновик; сохраняем на устройство сразу и в облако через пару секунд
  // why 'seen' (какие праздники уже показаны) не считается правкой: не делает устройство новее облака
  function update(fn, why) {
    if (!state) state = Core.newState();
    fn(state);
    // updated только растёт, даже если часы другого устройства, с которого взяли данные, спешат
    if (why !== 'seen') { state.updated = Math.max(Date.now(), (state.updated || 0) + 1); state.dev = device; }
    clearTimeout(saveT);
    saveT = setTimeout(() => ls.set(KEY, JSON.stringify(state)), 120);
    if (why !== 'seen') schedulePush();
    emit(why || 'edit');
  }
  function replace(next, why) {
    if (state) ls.set(PREV, JSON.stringify(state));
    state = Core.migrate(next);
    ls.set(KEY, JSON.stringify(state));
    emit(why || 'replace');
  }
  const flush = () => { clearTimeout(saveT); if (state) ls.set(KEY, JSON.stringify(state)); };
  // стереть данные на этом устройстве и выйти из облака (копия в облаке остаётся)
  async function wipe() {
    clearTimeout(saveT); clearTimeout(pushT);
    state = null; ls.del(KEY); ls.del(PREV); ls.del(CLOUD); setSynced(0); ls.del(SYNCED); cloud.on = false;
    if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
    cloud.ref = null;
    if (cloud.authMod && cloud.auth) { try { await cloud.authMod.signOut(cloud.auth); } catch (e) { /* уже вышли */ } }
    try { if (CFG && window.indexedDB) indexedDB.deleteDatabase('firestore/put/' + CFG.projectId + '/main'); } catch (e) { /* кэша нет */ }
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flush(); if (dirty() && cloud.ref) sync(); } });

  // ---------------------------------------------------------------- резервная копия файлом
  function exportFile() {
    flush();
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'put-k-kvartire-' + Core.today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importText(text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || !s.set) throw new Error('Это не файл приложения');
    replace(Object.assign(s, { updated: Math.max(Date.now(), ((state && state.updated) || 0) + 1), dev: device, seen: seenOf(state && state.seen, s.seen) }), 'import');
    schedulePush();
  }

  // ---------------------------------------------------------------- облако
  const setStatus = (status, error) => { cloud.status = status; cloud.error = error || ''; emit('cloud'); };
  async function initCloud(interactive) {
    if (cloud.fs) return;
    if (!CFG) { setStatus('error', 'Нет настроек облака.'); return; }
    // без интернета не грузим SDK: неудачная загрузка запомнилась бы до перезапуска
    if (navigator.onLine === false) { setStatus('error', 'Нет интернета. Данные сохраняются на телефоне, войдём, когда появится связь.'); waitOnline(interactive); return; }
    setStatus('loading');
    let appMod, authMod, fs;
    try { [appMod, authMod, fs] = await Promise.all([import(SDK('app')), import(SDK('auth')), import(SDK('firestore'))]); }
    catch (e) { setStatus('error', 'Нет связи с облаком. Данные сохраняются на телефоне.'); return; }
    const app = appMod.initializeApp(CFG, 'put');
    const auth = authMod.getAuth(app);
    let db;
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); } catch (e) { db = fs.getFirestore(app); }
    cloud.fs = fs; cloud.auth = auth; cloud.authMod = authMod; cloud.db = db;
    try { await authMod.getRedirectResult(auth); } catch (e) { /* вход через окно */ }
    authMod.onAuthStateChanged(auth, user => {
      cloud.user = user || null;
      if (!user) {
        if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
        cloud.ref = null;
        setStatus(cloud.on ? 'signedout' : 'off');
        if (interactive) { interactive = false; signIn(); }
        return;
      }
      cloud.on = true; ls.set(CLOUD, 'on');
      cloud.ref = fs.doc(db, `users/${user.uid}/put/state`);
      setStatus('sync');
      attach();
    });
  }
  let onlineWait = false;
  function waitOnline(interactive) {
    if (onlineWait) return;
    onlineWait = true;
    window.addEventListener('online', () => { onlineWait = false; if (cloud.on || interactive) initCloud(interactive); }, { once: true });
  }
  async function signIn() {
    if (!cloud.fs) { await initCloud(true); return; }
    const { authMod, auth } = cloud, provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await authMod.signInWithPopup(auth, provider); }
    catch (e) {
      const c = e && e.code;
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/cancelled-popup-request') {
        try { await authMod.signInWithRedirect(auth, provider); return; } catch (e2) { /* ниже */ }
      }
      setStatus('error', c === 'auth/popup-closed-by-user' ? 'Окно входа закрыто.' : c === 'auth/unauthorized-domain' ? 'Этот адрес не добавлен в Firebase.' : 'Не получилось войти.');
    }
  }
  async function signOut() {
    cloud.on = false; ls.del(CLOUD);
    if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
    cloud.ref = null; clearTimeout(pushT);
    if (cloud.authMod && cloud.auth) await cloud.authMod.signOut(cloud.auth);
    setStatus('off');
  }
  const parse = d => { if (!d || typeof d.json !== 'string') return null; try { const s = JSON.parse(d.json); return s && typeof s === 'object' && s.set ? s : null; } catch (e) { return null; } };
  const hasData = s => !!(s && s.money && s.money.length);
  const union = (a, b) => Array.from(new Set((a || []).concat(b || [])));
  // что уже праздновали, только растёт: уровень и награды, увиденные на одном устройстве, не празднуем снова на другом
  const seenOf = (a, b) => { a = a || {}; b = b || {}; return { level: Math.max(a.level || 1, b.level || 1), badges: union(a.badges, b.badges), recap: union(a.recap, b.recap).slice(-40) }; };
  const withSeen = next => Object.assign(next, { seen: seenOf(state && state.seen, next.seen) });
  // слияние, когда менялись и телефон, и облако: смены, сверки, вехи, задания и отметки объединяются, настройки берём новее.
  // Удалённое (del: путь -> когда удалили) не возвращается с другого устройства, если запись там не правили позже удаления
  function merge(a, b) {
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b, older = newer === a ? b : a;
    const out = JSON.parse(JSON.stringify(newer)), del = Object.assign({}, older.del);
    for (const [p, t] of Object.entries(newer.del || {})) del[p] = Math.max(del[p] || 0, +t || 0);
    // у смен, заданий и конвертов месяца есть своё время правки u (или создания t); у простых отметок судим по последней правке устройства
    const live = (p, x, s) => !del[p] || (x && typeof x === 'object' ? x.u || x.t || 0 : s.updated || 0) > del[p];
    for (const k of ['shifts', 'over', 'done', 'mood', 'months', 'bad', 'diary']) {
      out[k] = {};
      for (const s of [older, newer]) for (const [id, x] of Object.entries(s[k] || {})) if (live(k + '/' + id, x, s)) out[k][id] = x;
    }
    const seen = new Set();
    out.money = (newer.money || []).concat(older.money || []).filter(m => { const k = Core.moneyKey(m); if (seen.has(k) || del['money/' + k]) return false; seen.add(k); return true; }).sort(Core.byDate);
    const qs = {}; for (const s of [older, newer]) for (const q of s.quests || []) if (live('quests/' + q.id, q, s)) qs[q.id] = q;
    out.quests = Object.values(qs); out.del = del;
    // своя машина: берём ту, что правили позже; удалённая не возвращается
    const cars = [a.car, b.car].filter(c => c && c.on && (c.u || 0) > (del.car || 0)).sort((x, y) => (x.u || 0) - (y.u || 0));
    out.car = cars.length ? cars[cars.length - 1] : null;
    out.seen = seenOf(a.seen, b.seen);
    out.updated = Math.max(Date.now(), (a.updated || 0) + 1, (b.updated || 0) + 1); out.dev = device;
    return out;
  }
  // слушаем облако. Решаем только по ответу сервера: кэш на телефоне может быть старым
  const OFFLINE = 'Нет интернета. Данные сохраняются на телефоне, отправлю, когда появится связь.';
  function attach() {
    const { fs, ref } = cloud;
    if (cloud.unsub) cloud.unsub();
    cloud.unsub = fs.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
      if (snap.metadata.hasPendingWrites) return;
      if (snap.metadata.fromCache) { if (navigator.onLine === false) setStatus('error', OFFLINE); return; }
      const remote = snap.exists() ? parse(snap.data()) : null, ru = remote ? remote.updated || 0 : 0;
      // в облаке то же, что мы уже видели или сами записали
      if (remote ? ru === synced || (remote.dev === device && state && ru === state.updated) : !hasData(state)) {
        if (remote && ru !== synced) setSynced(ru);
        if (dirty() && hasData(state)) schedulePush(); else setStatus('ok');
        return;
      }
      sync();
    }, () => setStatus('error', 'Облако не отвечает. Данные сохраняются на телефоне.'));
  }
  function schedulePush() { if (!cloud.ref) return; clearTimeout(pushT); pushT = setTimeout(sync, 1500); }
  let busy = false, again = false, joinAs = '', onlineHook = false;
  // обмен с облаком одной транзакцией: читаем, что там сейчас, и записываем, только если ничего чужого не затрём
  async function sync() {
    clearTimeout(pushT);
    if (!cloud.ref || !cloud.fs || !state) return;
    if (busy) { again = true; return; }
    if (navigator.onLine === false) {
      setStatus('error', OFFLINE);
      if (!onlineHook) { onlineHook = true; window.addEventListener('online', () => { onlineHook = false; sync(); }, { once: true }); }
      return;
    }
    const { fs, ref, db } = cloud;
    busy = true; again = false; setStatus('sync');
    let r;
    try {
      r = await fs.runTransaction(db, async tx => {
        const snap = await tx.get(ref), remote = snap.exists() ? parse(snap.data()) : null;
        const ru = remote ? remote.updated || 0 : 0, u0 = state.updated || 0, mine = hasData(state);
        let out = state;
        if (!remote) { if (!mine) return { out, u0, wu: synced }; }
        else if (ru === synced || (remote.dev === device && ru === u0)) { if (!dirty() || !mine) return { out, u0, wu: ru }; }
        else if (!dirty() || !mine) return { out: remote, u0, wu: ru };
        else if (!synced && hasData(remote)) {
          // этот телефон впервые встречается с облаком, а там уже свои данные: спросить, что взять
          if (!joinAs) return { ask: remote };
          if (joinAs === 'take') return { out: remote, u0, wu: ru };
          // объединить: настройки и старт берём из облака, с телефона добавляем смены, сверки и отметки (пустую стартовую сверку не берём)
          out = merge(Object.assign({}, state, { updated: 0, money: state.money.filter(m => !(m.note === 'старт' && !m.cash && !m.otb && !m.car && !m.loan)) }), remote);
        } else out = merge(state, remote);
        tx.set(ref, { json: JSON.stringify(out), updated: out.updated || 0, dev: device });
        return { out, u0, wu: out.updated || 0 };
      });
    } catch (e) { busy = false; setStatus('error', 'Не сохранилось в облако. На телефоне всё есть.'); return; }
    busy = false;
    if (r.ask) {
      const n = Object.keys(r.ask.shifts || {}).length;
      joinAs = confirm('В облаке уже есть данные: ' + n + ' ' + Core.plural(n, ['смена', 'смены', 'смен']) + ' и сверки денег. Взять их вместо того, что на этом телефоне? Нажми Отмена, чтобы объединить одно с другим.') ? 'take' : 'join';
      sync(); return;
    }
    joinAs = '';
    // пока шёл обмен, на телефоне могли что-то поменять: не теряем и это
    if (r.out !== state) replace(withSeen(state.updated === r.u0 ? r.out : merge(state, r.out)), 'cloud');
    setSynced(r.wu);
    if (again || dirty()) schedulePush(); else setStatus('ok');
  }

  function boot() { load(); if (cloud.on) initCloud(false); return state; }
  return { boot, get, update, replace, onChange, exportFile, importText, signIn, signOut, wipe, merge, cloud, flush, device };
})();
