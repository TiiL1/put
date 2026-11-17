/* Путь к квартире: хранение. Всё лежит на телефоне (localStorage) и работает без интернета.
   По желанию вход через Google: копия в Firestore (users/<uid>/put/state), видна на всех устройствах.
   Firebase грузится только после входа, поэтому приложение открывается сразу. */
const Store = (() => {
  'use strict';
  const KEY = 'put.state.v1', PREV = 'put.state.prev', CLOUD = 'put.cloud', DEV = 'put.device';
  const CFG = window.PUT_FIREBASE || null;
  const SDK = n => `https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}.js`;
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) { /* нет доступа */ } },
  };
  const device = ls.get(DEV) || (() => { const d = Math.random().toString(36).slice(2, 10); ls.set(DEV, d); return d; })();

  let state = null, listeners = [], saveT = null, pushT = null;
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
  function update(fn, why) {
    if (!state) state = Core.newState();
    fn(state);
    state.updated = Date.now();
    state.dev = device;
    clearTimeout(saveT);
    saveT = setTimeout(() => ls.set(KEY, JSON.stringify(state)), 120);
    schedulePush();
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
    state = null; ls.del(KEY); ls.del(CLOUD); cloud.on = false;
    if (cloud.unsub) { cloud.unsub(); cloud.unsub = null; }
    cloud.ref = null;
    if (cloud.authMod && cloud.auth) { try { await cloud.authMod.signOut(cloud.auth); } catch (e) { /* уже вышли */ } }
  }
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flush(); pushNow(); } });

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
  // первый снимок: что новее, то и берём; дальше слушаем изменения с других устройств
  function attach() {
    const { fs, ref } = cloud;
    if (cloud.unsub) cloud.unsub();
    let first = true;
    cloud.unsub = fs.onSnapshot(ref, snap => {
      const d = snap.exists() ? snap.data() : null;
      const remote = d && d.json ? (() => { try { return JSON.parse(d.json); } catch (e) { return null; } })() : null;
      const lu = state ? state.updated || 0 : 0, ru = remote ? remote.updated || 0 : 0;
      if (first) {
        first = false;
        if (remote && (ru > lu || !state)) replace(remote, 'cloud');
        else if (state) pushNow();
        setStatus('ok');
        return;
      }
      if (remote && ru > lu && remote.dev !== device) replace(remote, 'cloud');
      if (!snap.metadata.hasPendingWrites) setStatus('ok');
    }, e => setStatus('error', 'Облако не отвечает. Данные сохраняются на телефоне.'));
  }
  function schedulePush() { if (!cloud.ref) return; clearTimeout(pushT); pushT = setTimeout(pushNow, 1500); }
  function pushNow() {
    clearTimeout(pushT);
    if (!cloud.ref || !state || !cloud.fs) return;
    setStatus('sync');
    cloud.fs.setDoc(cloud.ref, { json: JSON.stringify(state), updated: state.updated || Date.now(), dev: device })
      .then(() => setStatus('ok'), () => setStatus('error', 'Не сохранилось в облако. На телефоне всё есть.'));
  }

  function boot() { load(); if (cloud.on) initCloud(false); return state; }
  return { boot, get, update, replace, onChange, exportFile, importText, signIn, signOut, wipe, cloud, flush, device };
})();
