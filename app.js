import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFKYzhiYnxDwXYiICGmw5xHNKK087ukwU",
    authDomain: "umad-p4-ptshare.firebaseapp.com",
    databaseURL: "https://umad-p4-ptshare-default-rtdb.firebaseio.com",
    projectId: "umad-p4-ptshare",
    storageBucket: "umad-p4-ptshare.firebasestorage.app",
    messagingSenderId: "762185143937",
    appId: "1:762185143937:web:a55f50400de4d11ed89f80"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'kfk_p4_state');

// ギミック判定テキストの定義（ご指定の呼び替えルール）
const rules = {
    earlyWater: { true: "頭割り", false: "ひとり受け" },
    earlyLightning: { true: "ひとり受け", false: "頭割り" },
    earlyEye: { true: "見ない", false: "見る" },
    fire: { true: "タケノコ（離れる）", false: "ドーナツ（近づく）" },
    lateWater: { true: "頭割り", false: "ひとり受け" },
    lateLightning: { true: "ひとり受け", false: "頭割り" },
    lateEye: { true: "見ない", false: "見る" },
    water: { true: "ドーナツ（近づく）", false: "タケノコ（離れる）" },
    lineLightning: { true: "踏まない", false: "踏む" },
    iceFan: { true: "踏まない", false: "踏む" },
    bomb: { true: "停止（動かない）", false: "行動（動く）" }
};

// 時系列タイムラインの更新
function updateTimeline() {
    const getPill = (text, type) => {
        return `<span class="badge-pill pill-${type}">${text}</span>`;
    };

    const getPillForKey = (key, val, trueText, falseText, trueType, falseType) => {
        if (val === 'true') {
            return getPill(trueText, trueType);
        } else if (val === 'false') {
            return getPill(falseText, falseType);
        } else {
            return getPill('未入力', 'gray');
        }
    };

    const getRowHtml = (iconHtml, label, key, val, trueText, falseText, trueType, falseType) => {
        const pill = getPillForKey(key, val, trueText, falseText, trueType, falseType);
        return `
            <div class="tl-row">
                <span class="tl-label">${iconHtml}${label}</span>
                ${pill}
            </div>
        `;
    };

    const isValReady = (val) => {
        return val === 'true' || val === 'false';
    };

    const setStepReady = (stepId, isReady) => {
        const item = document.getElementById(stepId);
        if (item) {
            if (isReady) {
                item.classList.add('ready');
            } else {
                item.classList.remove('ready');
            }
        }
    };

    const iconWater = `<img src="https://yan-flash.com/api/uploads/1781173625101-e820e8d8.webp" class="gimmick-icon-mini">`;
    const iconLightning = `<img src="https://yan-flash.com/api/uploads/1781173604458-cd2d39e5.webp" class="gimmick-icon-mini">`;
    const iconEye = `<img src="https://yan-flash.com/api/uploads/1781173577888-f3f065c8.webp" class="gimmick-icon-mini">`;
    const iconFire = `<img src="https://yan-flash.com/api/uploads/1781173720029-86a7ea3d.webp" class="gimmick-icon-mini">`;
    const iconWave = `<img src="https://yan-flash.com/api/uploads/1781173691316-247cfd5e.webp" class="gimmick-icon-mini">`;
    const iconLineLightning = `<span class="icon">⚡</span>`;
    const iconIceFan = `<span class="icon">❄️</span>`;

    // Step 1: 無の氾濫 (常に確定状態)
    setStepReady('tl-step1', true);

    // Step 2: 早水 ＆ 早雷
    const t2 = document.getElementById('tl-res-earlyWaterLightning');
    if (t2) {
        const ready = isValReady(currentState.earlyWater) && isValReady(currentState.earlyLightning);
        setStepReady('tl-step2', ready);
        t2.innerHTML = 
            getRowHtml(iconWater, '早水', 'earlyWater', currentState.earlyWater, '頭割り', 'ひとり受け', 'green', 'red') +
            getRowHtml(iconLightning, '早雷', 'earlyLightning', currentState.earlyLightning, 'ひとり受け', '頭割り', 'red', 'green');
    }

    // Step 3: 早視線 ＆ 雷床記録
    const t3 = document.getElementById('tl-res-earlyEyeLightningFloor');
    if (t3) {
        const ready = isValReady(currentState.earlyEye) && isValReady(currentState.lineLightning);
        setStepReady('tl-step3', ready);
        t3.innerHTML = 
            getRowHtml(iconEye, '早視線', 'earlyEye', currentState.earlyEye, '見ない', '見る', 'purple', 'yellow') +
            getRowHtml(iconLineLightning, '雷床', 'lineLightning', currentState.lineLightning, '踏まない', '踏む', 'green', 'yellow');
    }

    // Step 4: ほのお
    const t4 = document.getElementById('tl-res-fire');
    if (t4) {
        const ready = isValReady(currentState.fire);
        setStepReady('tl-step4', ready);
        t4.innerHTML = 
            getRowHtml(iconFire, 'ほのお', 'fire', currentState.fire, '離れる', '近づく', 'orange', 'blue');
    }

    // Step 5: 遅水 ＆ 遅雷 ＆ 氷床記録
    const t5 = document.getElementById('tl-res-lateWaterLightningIceFloor');
    if (t5) {
        const ready = isValReady(currentState.lateWater) && isValReady(currentState.lateLightning) && isValReady(currentState.iceFan);
        setStepReady('tl-step5', ready);
        t5.innerHTML = 
            getRowHtml(iconWater, '遅水', 'lateWater', currentState.lateWater, '頭割り', 'ひとり受け', 'green', 'red') +
            getRowHtml(iconLightning, '遅雷', 'lateLightning', currentState.lateLightning, 'ひとり受け', '頭割り', 'red', 'green') +
            getRowHtml(iconIceFan, '氷床', 'iceFan', currentState.iceFan, '踏まない', '踏む', 'green', 'yellow');
    }

    // Step 6: 遅視線
    const t6 = document.getElementById('tl-res-lateEye');
    if (t6) {
        const ready = isValReady(currentState.lateEye);
        setStepReady('tl-step6', ready);
        t6.innerHTML = 
            getRowHtml(iconEye, '遅視線', 'lateEye', currentState.lateEye, '見ない', '見る', 'purple', 'yellow');
    }

    // Step 7: つなみ ＆ 雷床 ＆ 氷床
    const t7 = document.getElementById('tl-res-waterLightningIceFloor');
    if (t7) {
        const ready = isValReady(currentState.water) && isValReady(currentState.lineLightning) && isValReady(currentState.iceFan);
        setStepReady('tl-step7', ready);
        t7.innerHTML = 
            getRowHtml(iconWave, 'つなみ', 'water', currentState.water, '近づく', '離れる', 'blue', 'orange') +
            getRowHtml(iconLineLightning, '雷床', 'lineLightning', currentState.lineLightning, '踏まない', '踏む', 'green', 'yellow') +
            getRowHtml(iconIceFan, '氷床', 'iceFan', currentState.iceFan, '踏まない', '踏む', 'green', 'yellow');
    }
}

// 共有データの状態をローカルに保持するオブジェクト
let currentState = {};

// サーバーデータのリアルタイム監視・同期
onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {};
    currentState = data;

    Object.keys(rules).forEach(key => {
        if (key === 'bomb') return; // 加速度爆弾は同期スキップ

        const value = data[key];
        const card = document.getElementById(`card-${key}`);
        const resText = document.getElementById(`res-${key}`);
        if (!card) return;
        const btnTrue = card.querySelector('.btn-true');
        const btnFalse = card.querySelector('.btn-false');

        // ボタンとテキストの初期化
        btnTrue.classList.remove('active-true');
        btnFalse.classList.remove('active-false');
        resText.classList.remove('active-true', 'active-false');

        if (value === 'true') {
            btnTrue.classList.add('active-true');
            resText.classList.add('active-true');
            resText.innerText = rules[key].true;
        } else if (value === 'false') {
            btnFalse.classList.add('active-false');
            resText.classList.add('active-false');
            resText.innerText = rules[key].false;
        } else {
            resText.innerText = "---";
        }
    });

    // タイムラインを更新
    updateTimeline();
});

// 共有ボタンが押されたときの処理
window.setDecision = function (key, status) {
    // すでに同じ状態なら何もしない（誤連打キープ）
    if (currentState[key] === status) return;

    currentState[key] = status;
    set(dbRef, currentState);
};

// 一括リセット処理
document.getElementById('resetBtn').addEventListener('click', () => {
    const resetData = {};
    Object.keys(rules).forEach(key => {
        if (key !== 'bomb') resetData[key] = "none";
    });
    set(dbRef, resetData);

    // 個人用の加速度爆弾も同時にリセット
    setLocalBomb('none');
});

// 【個人用】加速度爆弾の処理（Firebaseに送らずローカルストレージで管理）
window.setLocalBomb = function (status) {
    const btnTrue = document.getElementById('local-bomb-true');
    const btnFalse = document.getElementById('local-bomb-false');
    const resText = document.getElementById('res-bomb');

    btnTrue.classList.remove('active-true');
    btnFalse.classList.remove('active-false');
    resText.classList.remove('active-true', 'active-false');

    if (status === 'true') {
        btnTrue.classList.add('active-true');
        resText.classList.add('active-true');
        resText.innerText = rules.bomb.true;
        localStorage.setItem('kfk_local_bomb', 'true');
    } else if (status === 'false') {
        btnFalse.classList.add('active-false');
        resText.classList.add('active-false');
        resText.innerText = rules.bomb.false;
        localStorage.setItem('kfk_local_bomb', 'false');
    } else {
        resText.innerText = "---";
        localStorage.removeItem('kfk_local_bomb');
    }
};

// ページ読み込み時に前回の個人用加速度爆弾の状態を復元
const savedBomb = localStorage.getItem('kfk_local_bomb');
if (savedBomb) {
    setLocalBomb(savedBomb);
}

// HUDモード切り替えの処理
window.setMode = function (mode) {
    const btnMobile = document.getElementById('btn-mode-mobile');
    const btnHud = document.getElementById('btn-mode-hud');

    if (mode === 'hud') {
        document.body.classList.add('hud-mode');
        btnMobile.classList.remove('active');
        btnHud.classList.add('active');
        localStorage.setItem('kfk_ui_mode', 'hud');
    } else {
        document.body.classList.remove('hud-mode');
        btnMobile.classList.add('active');
        btnHud.classList.remove('active');
        localStorage.setItem('kfk_ui_mode', 'mobile');
    }
};

// ページ読み込み時に保存されたモードを復元
const savedMode = localStorage.getItem('kfk_ui_mode') || 'mobile';
setMode(savedMode);

// 初期表示用タイムライン描画
updateTimeline();
