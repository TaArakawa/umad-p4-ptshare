import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
// ここでは名前付きアプリとして初期化し二重初期化エラーを避ける。
const navApp = initializeApp(firebaseConfig, "nav");
const navDb = getDatabase(navApp);
const navRef = ref(navDb, 'kfk_nav');

window.setPhase = (phase) => update(navRef, { phase });

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
    document.querySelectorAll('.fit-area').forEach(applyFit);
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

// フェーズ切り替え（P1/P3/P4タブ）はPC版のみ。
// スマホ版は画面を広く使うため常にP4のみを表示し、タブは出さない。
let lastPhase = 'P1';

function applyPhaseDisplay() {
    const isPc = document.body.classList.contains('pc-mode');
    const phase = isPc ? lastPhase : 'P4';
    document.getElementById('view-p1').style.display = (phase === 'P1') ? '' : 'none';
    document.getElementById('view-p3').style.display = (phase === 'P3') ? '' : 'none';
    document.getElementById('view-p4').style.display = (phase === 'P4') ? '' : 'none';
    document.querySelectorAll('.phase-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.phase === phase));
}

onValue(navRef, (snap) => {
    lastPhase = (snap.val() && snap.val().phase) || 'P1';
    applyPhaseDisplay();
    scheduleFit();
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
scheduleFit();
