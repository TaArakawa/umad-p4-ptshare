(function() {
let isOfflineMode = false;

const safeStorage = {
    getItem: (key) => {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem: (key, val) => {
        try { localStorage.setItem(key, val); } catch (e) {}
    }
};

// オーバーレイモード（overlay.js）がPiPウィンドウへフェーズ表示要素一式を
// 実体移動している間は、この関数がその移動先document（PiPウィンドウ）を返す。
// 通常時は overlay.js が window.__overlayActiveDoc を設定しないため、
// 常にこのウィンドウ自身の document を返し、既存の挙動は一切変わらない。
function getActiveDocument() {
    return window.__overlayActiveDoc || document;
}

const firebaseConfig = {
  apiKey: "AIzaSyCFKYzhiYnxDwXYiICGmw5xHNKK087ukwU",
  authDomain: "umad-p4-ptshare.firebaseapp.com",
  databaseURL: "https://umad-p4-ptshare-default-rtdb.firebaseio.com",
  projectId: "umad-p4-ptshare",
  storageBucket: "umad-p4-ptshare.firebasestorage.app",
  messagingSenderId: "762185143937",
  appId: "1:762185143937:web:a55f50400de4d11ed89f80"
};

// 既存の solver-v2.js が無名（[DEFAULT]）で initializeApp するため、
// 二重初期化エラーを避けるよう名前付きアプリとして初期化する。
let navDb, navRef;
if (typeof firebase !== 'undefined') {
    try {
        let navApp;
        if (firebase.apps.some(app => app.name === 'nav')) {
            navApp = firebase.app('nav');
        } else {
            navApp = firebase.initializeApp(firebaseConfig, "nav");
        }
        navDb = navApp.database();
        navRef = navDb.ref('kfk_nav');
    } catch (e) {
        console.error("Firebase initialization failed, falling back to offline mode", e);
        isOfflineMode = true;
    }
} else {
    console.warn("Firebase SDK failed to load. Operating in offline/standalone mode.");
    isOfflineMode = true;
}

window.setPhase = (phase) => {
    // 常にローカルストレージに保存し、ローカルでの同期イベントを発火
    try {
        safeStorage.setItem('kfk_nav_local_phase', phase);
    } catch (e) {}
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'kfk_nav_local_phase',
        newValue: phase
    }));



    // 即座にローカル表示に反映
    lastPhase = phase;
    applyPhaseDisplay();
    scheduleFit();
};

// P4の実装切り替え（v1/v2/v3）。
// v1/v2 はID構成が異なる別実装で、v3 (solver-v2.js) と同一ドキュメントに
// 直接埋め込むとID重複で互いの動作が壊れるため、iframeで別ドキュメントとして分離する。
// hub.html自体は移動しないので、フェーズタブ（P1/P3/P4）は維持される。
const P4_IMPL_KEY = 'kfk_p4_impl';

window.setP4Impl = (impl) => {
    if (!['v1', 'v2', 'v3'].includes(impl)) impl = 'v3';

    getActiveDocument().querySelectorAll('.p4-impl-pane').forEach(pane => {
        const active = pane.dataset.impl === impl;
        pane.style.display = active ? '' : 'none';
        if (active) {
            // 表示するたびに iframe を最新コード＋最新Firebase状態で読み直す。
            // 毎回キャッシュ回避クエリ(_t)を付けて読み込むことで、
            // ブラウザが古い index.html / solver.html（=古い同期コードや古い表示状態）を
            // キャッシュから返してしまい v3 の入力が反映されない、という不具合を防ぐ。
            const iframe = pane.querySelector('iframe.p4-iframe');
            if (iframe) {
                const base = iframe.dataset.src || iframe.getAttribute('data-base-src');
                if (base) {
                    iframe.setAttribute('data-base-src', base);
                    iframe.removeAttribute('data-src');
                    const sep = base.indexOf('?') >= 0 ? '&' : '?';
                    iframe.src = base + sep + '_t=' + Date.now();
                }
            }
        }
    });

    const select = getActiveDocument().getElementById('p4-impl-select');
    if (select) select.value = impl;

    try {
        safeStorage.setItem(P4_IMPL_KEY, impl);
    } catch (e) {}
    scheduleFit();
};

// P2のサブビュー表示切り替え（奇数回 / 偶数回）
const P2_VIEW_KEY = 'kfk_p2_view';

window.setP2View = (view) => {
    if (!['odd', 'even'].includes(view)) view = 'odd';

    getActiveDocument().querySelectorAll('.p2-view-pane').forEach(pane => {
        pane.style.display = pane.dataset.view === view ? '' : 'none';
    });

    getActiveDocument().querySelectorAll('.p2-gimmick-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });

    try {
        safeStorage.setItem(P2_VIEW_KEY, view);
    } catch (e) {}
    scheduleFit();
};

// P5のギミック表示切り替え（全体像/AA, フラッド, オーケストラ, スリースターズ, エクサフレア, ミッシング）。
const P5_GIMMICK_KEY = 'kfk_p5_gimmick';

window.setP5Gimmick = (gimmick) => {
    if (!['timeline', 'aa', 'flood', 'orch', 'stars', 'exa', 'missing'].includes(gimmick)) gimmick = 'timeline';

    getActiveDocument().querySelectorAll('.p5-gimmick-panel').forEach(panel => {
        panel.style.display = panel.dataset.gimmick === gimmick ? '' : 'none';
    });

    getActiveDocument().querySelectorAll('.p5-gimmick-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.gimmick === gimmick);
    });

    try {
        safeStorage.setItem(P5_GIMMICK_KEY, gimmick);
    } catch (e) {}
    scheduleFit();
};

// ---- スクロールなしで各フェーズ画面を画面内に収める ----
// .fit-area (高さ = タブ分を除いた残り全高) の中の .fit-inner を
// 自然サイズで測ってから scale() で縮小する。
// transform は要素自身の offsetWidth/offsetHeight に影響しないため、
// 再計算のたびに一旦 scale(1) に戻さず安全に測り直せる。
function applyFit(areaEl) {
    if (!areaEl || areaEl.offsetParent === null) return; // 非表示中は測れないのでスキップ
    const inner = areaEl.querySelector('.fit-inner');
    if (!inner) return;

    const availW = areaEl.clientWidth;
    const availH = areaEl.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    // scrollWidth/Height は CSS transform の影響を受けず、かつ
    // overflow:visible で外にあふれている内容（P4のグリッドが
    // 横に収まらない場合など）も含めた「本当のサイズ」を返すため、
    // offsetWidth/Height より正確に測れる。
    const naturalW = inner.scrollWidth;
    const naturalH = inner.scrollHeight;
    if (naturalW <= 0 || naturalH <= 0) return;

    let scale = 1;
    if (areaEl.dataset.fit === 'both') {
        // P1の図・P3の表は余白を持て余さないよう、画面に収まる範囲で拡大もする。
        scale = Math.min(availW / naturalW, availH / naturalH);
    } else {
        // P4ソルバーは元のレスポンシブデザインの見た目を保つため拡大はしないが、
        // 横にあふれる場合（スクロール前提だったPCレイアウト）も縮小して収める。
        scale = Math.min(1, availW / naturalW, availH / naturalH);
    }
    inner.style.transform = `scale(${scale})`;
}

function fitAll() {
    getActiveDocument().querySelectorAll('.fit-area').forEach(applyFit);
}

let fitScheduled = false;
function scheduleFit() {
    if (fitScheduled) return;
    fitScheduled = true;
    requestAnimationFrame(() => {
        fitScheduled = false;
        fitAll();
    });
}

// フェーズ切り替え（P1/P2/P3/P4/P5タブ）はPC版のみ。
// スマホ版は画面を広く使うため常にP4のみを表示し、タブは出さない。
let lastPhase = 'P1';

function applyPhaseDisplay() {
    const activeDoc = getActiveDocument();
    const isPc = activeDoc.body.classList.contains('pc-mode') || document.body.classList.contains('pc-mode');
    const phase = isPc ? lastPhase : 'P4';
    activeDoc.getElementById('view-p1').style.display = (phase === 'P1') ? '' : 'none';
    activeDoc.getElementById('view-p2').style.display = (phase === 'P2') ? '' : 'none';
    activeDoc.getElementById('view-p3').style.display = (phase === 'P3') ? '' : 'none';
    activeDoc.getElementById('view-p4').style.display = (phase === 'P4') ? '' : 'none';
    activeDoc.getElementById('view-p5').style.display = (phase === 'P5') ? '' : 'none';
    activeDoc.querySelectorAll('.phase-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.phase === phase));
}

// フェーズの管理はローカルストレージおよびストレージイベントで同期 (Firebaseは介さない)
const updateLocalPhase = () => {
    lastPhase = safeStorage.getItem('kfk_nav_local_phase') || 'P1';
    applyPhaseDisplay();
    scheduleFit();
};
updateLocalPhase();
window.addEventListener('storage', (e) => {
    if (e.key === 'kfk_nav_local_phase') {
        updateLocalPhase();
    }
});

window.addEventListener('resize', scheduleFit);
window.addEventListener('orientationchange', scheduleFit);
window.addEventListener('load', scheduleFit);

// P4内の真偽トグル操作やPC/スマホモード切替（body.pc-modeクラス変更）で
// 表示すべきフェーズ・サイズが変わるたびに再計算する。
new MutationObserver(() => {
    applyPhaseDisplay();
    scheduleFit();
}).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
});

applyPhaseDisplay();
let initialP4Impl = 'v3';
let initialP5Gimmick = 'aa';
let initialP2View = 'odd';
try {
    initialP4Impl = safeStorage.getItem(P4_IMPL_KEY) || 'v3';
    initialP5Gimmick = safeStorage.getItem(P5_GIMMICK_KEY) || 'aa';
    initialP2View = safeStorage.getItem(P2_VIEW_KEY) || 'odd';
} catch (e) {}
window.setP4Impl(initialP4Impl);
window.setP5Gimmick(initialP5Gimmick);
window.setP2View(initialP2View);
scheduleFit();

// iframe内の「スマホ/PC」モード切替を親ウィンドウに確実に同期させるための localStorage ポーリング監視
(function() {
    let lastMode = null;
    try {
        lastMode = safeStorage.getItem('kfk_shared_ui_mode') || 'mobile';
    } catch (e) {}
    
    setInterval(() => {
        try {
            const currentMode = safeStorage.getItem('kfk_shared_ui_mode') || 'mobile';
            if (currentMode !== lastMode) {
                lastMode = currentMode;
                if (typeof window.setMode === 'function') {
                    window.setMode(currentMode);
                }
            }
        } catch (e) {}
    }, 250); // 250msごとにチェックして高速同期
})();

// バージョン表示：GitHub上の version.json と最新コミット日時を取得してバッジを表示する。
(function() {
    const badge = document.getElementById('version-badge');
    if (!badge) return;

    const REPO = 'TaArakawa/umad-p4-ptshare';

    // raw.githubusercontent.com から version.json を直接取得
    const versionPromise = fetch(`https://raw.githubusercontent.com/${REPO}/main/version.json`)
        .then(res => res.ok ? res.json() : Promise.reject(res.status))
        .then(data => data.version || '1.1.0');

    const headPromise = fetch(`https://api.github.com/repos/${REPO}/commits/main`)
        .then(res => res.ok ? res.json() : Promise.reject(res.status));

    Promise.all([versionPromise, headPromise])
        .then(([verStr, data]) => {
            badge.href = `https://github.com/${REPO}/commit/${data.sha}`;
            const message = (data.commit && data.commit.message) || '';
            const dateStr = (data.commit && data.commit.committer && data.commit.committer.date) || '';
            const date = dateStr ? new Date(dateStr) : null;
            const dateLabel = date
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                : '不明';
            badge.textContent = `v${verStr} (最終更新日時: ${dateLabel})`;
            badge.title = message.split('\n')[0];
        })
        .catch(() => {
            // HTMLに直書きされたフォールバック表示(最新の更新日時)をそのまま残し、
            // ホバー時のツールチップでのみエラーを通知する
            badge.title = '最新バージョン情報の取得に失敗しました（キャッシュを表示中）';
        });
})();
})();
