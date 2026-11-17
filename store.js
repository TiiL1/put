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
    if (why !== 'seen') { state.updated = Date.now(); state.dev = device; }
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
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flush(); if (dirty()) pushNow(); } });

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
    replace(Object.assign(s, { updated: Date.now() }), 'import');
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
  // слияние, когда менялись и телефон, и облако: смены, сверки, вехи, задания и отметки объединяются, настройки берём новее
  function merge(a, b) {
    const newer = (a.updated || 0) >= (b.updated || 0) ? a : b, older = newer === a ? b : a;
    const out = JSON.parse(JSON.stringify(newer));
    for (const k of ['shifts', 'over', 'done', 'mood', 'months']) out[k] = Object.assign({}, older[k] || {}, newer[k] || {});
    const key = m => [m.d, m.t || 0, m.kind || 's', m.add || 0, m.cash || 0, m.otb || 0, m.car || 0, m.loan || 0].join('|'), seen = new Set();
    out.money = (newer.money || []).concat(older.money || []).filter(m => { const k = key(m); if (seen.has(k)) return false; seen.add(k); return true; }).sort(Core.byDate);
    const qs = {}; for (const q of (older.quests || []).concat(newer.quests || [])) qs[q.id] = q; out.quests = Object.values(qs);
    const sa = a.seen || {}, sb = b.seen || {};
    out.seen = { level: Math.max(sa.level || 1, sb.level || 1), badges: Array.from(new Set((sa.badges || []).concat(sb.badges || []))) };
    out.updated = Date.now(); out.dev = device;
    return out;
  }
  // первый снимок: чужое новое берём, своё новое отправляем, если менялись оба, сливаем. Дальше слушаем другие устройства
  function attach() {
    const { fs, ref } = cloud;
    if (cloud.unsub) cloud.unsub();
    cloud.unsub = fs.onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : null;
      const remote = d && d.json ? (() => { try { return JSON.parse(d.json); } catch (e) { return null; } })() : null;
      const ru = remote ? remote.updated || 0 : 0, mine = state && state.money && state.money.length;
      if (!remote) { if (mine) pushNow(); else setStatus('ok'); return; }
      if (snap.metadata.hasPendingWrites) return; // наша же запись ещё в пути
      if (remote.dev === device && state && ru === (state.updated || 0)) { setSynced(ru); setStatus('ok'); return; } // эхо нашей записи
      const remoteNew = ru > synced, localNew = dirty() && mine;
      // новый телефон уже заполнен, а в облаке свои данные: спросить, что взять
      if (remoteNew && localNew && !synced && remote.money && remote.money.length) {
        const n = Object.keys(remote.shifts || {}).length;
        if (confirm('В облаке уже есть данные: ' + n + ' ' + Core.plural(n, ['смена', 'смены', 'смен']) + ' и сверки денег. Взять их вместо того, что на этом телефоне? Нажми Отмена, чтобы объединить одно с другим.')) {
          replace(remote, 'cloud'); setSynced(state.updated || ru); setStatus('ok'); return;
        }
      }
      if (remoteNew && !localNew) { replace(remote, 'cloud'); setSynced(state.updated || ru); setStatus('ok'); return; }
      if (remoteNew && localNew) { replace(merge(state, remote), 'cloud'); pushNow(); return; }
      if (localNew) { pushNow(); return; }
      setStatus('ok');
    }, e => setStatus('error', 'Облако не отвечает. Данные сохраняются на телефоне.'));
  }
  function schedulePush() { if (!cloud.ref) return; clearTimeout(pushT); pushT = setTimeout(pushNow, 1500); }
  function pushNow() {
    clearTimeout(pushT);
    if (!cloud.ref || !state || !cloud.fs) return;
    const up = state.updated || Date.now();
    setStatus('sync');
    cloud.fs.setDoc(cloud.ref, { json: JSON.stringify(state), updated: up, dev: device })
      .then(() => { setSynced(Math.max(synced, up)); setStatus('ok'); }, () => setStatus('error', 'Не сохранилось в облако. На телефоне всё есть.'));
  }

  function boot() { load(); if (cloud.on) initCloud(false); return state; }
  return { boot, get, update, replace, onChange, exportFile, importText, signIn, signOut, wipe, merge, cloud, flush, device };
})();
