(function() {
let isOfflineMode = false;

// オーバーレイモード（overlay.js）がPiPウィンドウへこのv3 UI一式を実体移動して
// いる間は、この関数がその移動先document（PiPウィンドウ）を返す。通常時は
// overlay.js が window.__overlayActiveDoc を設定しないため、常にこのウィンドウ
// 自身の document を返し、既存の挙動は一切変わらない。
function getActiveDocument() {
    return window.__overlayActiveDoc || document;
}

// Firebase設定 (メインのapp.jsと同じ)
const firebaseConfig = {
    apiKey: "AIzaSyCFKYzhiYnxDwXYiICGmw5xHNKK087ukwU",
    authDomain: "umad-p4-ptshare.firebaseapp.com",
    databaseURL: "https://umad-p4-ptshare-default-rtdb.firebaseio.com",
    projectId: "umad-p4-ptshare",
    storageBucket: "umad-p4-ptshare.firebasestorage.app",
    messagingSenderId: "762185143937",
    appId: "1:762185143937:web:a55f50400de4d11ed89f80"
};

let app, db, dbRef;
if (typeof firebase !== 'undefined') {
    try {
        // [DEFAULT] アプリの二重初期化を防ぐため、既に初期化されているか確認
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }
        db = app.database();
        dbRef = db.ref('kfk_p4_state');
    } catch (e) {
        console.error("Firebase initialization failed, falling back to offline mode", e);
        isOfflineMode = true;
    }
} else {
    console.warn("Firebase SDK failed to load. Operating in offline/standalone mode.");
    isOfflineMode = true;
}

// 共有状態を保持するオブジェクト
let currentState = {};

// ボスの同期する状態 (Firebase管理)
let bossState = {
    gc1_truth: 'none',            // 'true' | 'false' | 'none'
    gc2_truth: 'none',            // 'true' | 'false' | 'none'
    gc1_water_timing: 'none',     // 'early' | 'late' | 'none'
    gc1_lightning_timing: 'none',  // 'early' | 'late' | 'none'
    gc2_water_timing: 'none',     // 'early' | 'late' | 'none'
    gc2_lightning_timing: 'none',  // 'early' | 'late' | 'none'
    fire_truth: 'none',           // 'true' | 'false' | 'none'
    tsunami_truth: 'none',        // 'true' | 'false' | 'none'
    lineLightning_truth: 'none',  // 'true' | 'false' | 'none'
    iceFan_truth: 'none'          // 'true' | 'false' | 'none'
};

// 最後に編集したGC (1 または 2、相互推論時の競合回避に使用)
let lastEditedGC = null;

// プレイヤー個人のデバフ選択状態 (ローカル管理)
let localState = {
    gc1_water_lightning: null, // "water" / "lightning" / null
    gc2_water_lightning: null, // "water" / "lightning" / null
    gc1_sight: false,
    gc2_sight: false,
    gc1_bomb: false,
    gc2_bomb: false
};

// ローカルストレージから個人デバフ状態を復元
function loadLocalState() {
    let saved = null;
    try {
        saved = localStorage.getItem('kfk_solver_local_state');
    } catch (e) {}
    if (saved) {
        try {
            localState = JSON.parse(saved);
        } catch (e) {
            console.error("Local state parse error", e);
        }
    }
    // 不変条件の正規化：視線がつくGCには必ず加速度もつく／視線・加速度はそれぞれ早遅どちらか一方。
    // （加速度だけがつくケースは許容する。）過去の不整合な保存状態もここで解消し、ソフトロックを防ぐ。
    if (localState.gc1_sight) { localState.gc1_bomb = true; localState.gc2_sight = false; localState.gc2_bomb = false; }
    else if (localState.gc2_sight) { localState.gc2_bomb = true; localState.gc1_sight = false; localState.gc1_bomb = false; }
    else if (localState.gc1_bomb && localState.gc2_bomb) { localState.gc2_bomb = false; }
}

// 個人デバフ状態を保存
function saveLocalState() {
    try {
        localStorage.setItem('kfk_solver_local_state', JSON.stringify(localState));
    } catch (e) {}
}

// UIの描画とハイライトの更新
function renderUI() {
    // オーバーレイモードでPiPウィンドウへ移動済みの場合は、その移動先document
    // から要素を取得する（詳細は getActiveDocument() のコメントを参照）。
    const activeDoc = getActiveDocument();

    // --- 1. デバフ行のアクティブ・非アクティブ（排他制御）の反映 ---

    // 水・雷の排他制御
    const row1Water = activeDoc.getElementById('row-1-water');
    const row1Lightning = activeDoc.getElementById('row-1-lightning');
    const row2Water = activeDoc.getElementById('row-2-water');
    const row2Lightning = activeDoc.getElementById('row-2-lightning');

    row1Water.classList.remove('active', 'inactive');
    row1Lightning.classList.remove('active', 'inactive');
    if (localState.gc1_water_lightning === 'water') {
        row1Water.classList.add('active');
    } else if (localState.gc1_water_lightning === 'lightning') {
        row1Lightning.classList.add('active');
    }

    row2Water.classList.remove('active', 'inactive');
    row2Lightning.classList.remove('active', 'inactive');
    if (localState.gc2_water_lightning === 'water') {
        row2Water.classList.add('active');
    } else if (localState.gc2_water_lightning === 'lightning') {
        row2Lightning.classList.add('active');
    }

    // クロス排他 (1回目で選択があれば2回目は押せない、逆も然り)
    if (localState.gc1_water_lightning) {
        row2Water.classList.add('inactive');
        row2Lightning.classList.add('inactive');
    } else if (localState.gc2_water_lightning) {
        row1Water.classList.add('inactive');
        row1Lightning.classList.add('inactive');
    }

    // 視線の排他制御
    const row1Sight = activeDoc.getElementById('row-1-sight');
    const row2Sight = activeDoc.getElementById('row-2-sight');
    row1Sight.classList.remove('active', 'inactive', 'sight-selected');
    row2Sight.classList.remove('active', 'inactive', 'sight-selected');
    if (localState.gc1_sight) {
        row1Sight.classList.add('active', 'sight-selected');
    } else if (localState.gc2_sight) {
        row2Sight.classList.add('active', 'sight-selected');
    }
    // 加速度がついた回が確定したら、反対側のGCに視線が来ることはないので
    // その回の視線は選べない（グレーアウト＝inactive）ようにする。
    // 例: 1回目に加速度を選んだら2回目の視線は選択不可。
    // （視線がつく回は必ず加速度も伴うため、視線選択時のクロス排他もこれで成立する）
    if (localState.gc1_bomb) {
        row2Sight.classList.add('inactive');
    } else if (localState.gc2_bomb) {
        row1Sight.classList.add('inactive');
    }

    // 加速度の排他制御
    const row1Bomb = activeDoc.getElementById('row-1-bomb');
    const row2Bomb = activeDoc.getElementById('row-2-bomb');
    row1Bomb.classList.remove('active', 'inactive');
    row2Bomb.classList.remove('active', 'inactive');
    if (localState.gc1_bomb) {
        row1Bomb.classList.add('active');
        row2Bomb.classList.add('inactive');
    } else if (localState.gc2_bomb) {
        row2Bomb.classList.add('active');
        row1Bomb.classList.add('inactive');
    }

    // --- 2. ボス「真・偽」トグルボタンのアクティブ表示 ---
    const keys = ['gc1', 'gc2', 'fire', 'tsunami', 'lineLightning', 'iceFan'];
    keys.forEach(k => {
        const btnTrue = activeDoc.getElementById(`${k}-true`);
        const btnFalse = activeDoc.getElementById(`${k}-false`);
        btnTrue.classList.remove('active-true');
        btnFalse.classList.remove('active-false');

        // カラムヘッダー (GC1 & GC2 のみ)
        const hdrTrue = activeDoc.getElementById(`${k}-hdr-true`);
        const hdrFalse = activeDoc.getElementById(`${k}-hdr-false`);
        if (hdrTrue && hdrFalse) {
            hdrTrue.classList.remove('active-true', 'inactive-header');
            hdrFalse.classList.remove('active-false', 'inactive-header');
        }

        const val = bossState[`${k}_truth`];
        if (val === 'true') {
            btnTrue.classList.add('active-true');
            if (hdrTrue && hdrFalse) {
                hdrTrue.classList.add('active-true');
                hdrFalse.classList.add('inactive-header');
            }
        } else if (val === 'false') {
            btnFalse.classList.add('active-false');
            if (hdrTrue && hdrFalse) {
                hdrFalse.classList.add('active-false');
                hdrTrue.classList.add('inactive-header');
            }
        }
    });

    // --- 3. タイミング（早・遅）ボタンのアクティブ表示 ---
    const timingKeys = [
        { key: 'gc1_water', id: 'gc1-water' },
        { key: 'gc1_lightning', id: 'gc1-lightning' },
        { key: 'gc2_water', id: 'gc2-water' },
        { key: 'gc2_lightning', id: 'gc2-lightning' }
    ];
    timingKeys.forEach(item => {
        const btnEarly = activeDoc.getElementById(`${item.id}-early`);
        const btnLate = activeDoc.getElementById(`${item.id}-late`);
        if (btnEarly && btnLate) {
            btnEarly.classList.remove('active-early');
            btnLate.classList.remove('active-late');

            const val = bossState[`${item.key}_timing`];
            if (val === 'early') {
                btnEarly.classList.add('active-early');
            } else if (val === 'late') {
                btnLate.classList.add('active-late');
            }
        }
    });

    // --- 4. 解決策セルのハイライト計算とクラス適用 ---
    
    // 全てのエフェクトセルのハイライトを一括クリア
    activeDoc.querySelectorAll('.effect-cell').forEach(el => {
        el.classList.remove('highlight-true', 'highlight-false');
    });

    // 1回目の解決策
    if (bossState.gc1_truth && bossState.gc1_truth !== 'none') {
        const isTrue = bossState.gc1_truth === 'true';
        // 水
        if (localState.gc1_water_lightning === 'water') {
            activeDoc.getElementById(isTrue ? '1-water-true' : '1-water-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 雷
        if (localState.gc1_water_lightning === 'lightning') {
            activeDoc.getElementById(isTrue ? '1-lightning-true' : '1-lightning-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 視線
        if (localState.gc1_sight) {
            activeDoc.getElementById(isTrue ? '1-sight-true' : '1-sight-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 加速度
        if (localState.gc1_bomb) {
            activeDoc.getElementById(isTrue ? '1-bomb-true' : '1-bomb-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
    }

    // 2回目の解決策
    if (bossState.gc2_truth && bossState.gc2_truth !== 'none') {
        const isTrue = bossState.gc2_truth === 'true';
        // 水
        if (localState.gc2_water_lightning === 'water') {
            activeDoc.getElementById(isTrue ? '2-water-true' : '2-water-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 雷
        if (localState.gc2_water_lightning === 'lightning') {
            activeDoc.getElementById(isTrue ? '2-lightning-true' : '2-lightning-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 視線
        if (localState.gc2_sight) {
            activeDoc.getElementById(isTrue ? '2-sight-true' : '2-sight-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 加速度
        if (localState.gc2_bomb) {
            activeDoc.getElementById(isTrue ? '2-bomb-true' : '2-bomb-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
    }

    // ほのお
    if (bossState.fire_truth && bossState.fire_truth !== 'none') {
        const isTrue = bossState.fire_truth === 'true';
        activeDoc.getElementById(isTrue ? 'fire-resolver-true' : 'fire-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // つなみ
    if (bossState.tsunami_truth && bossState.tsunami_truth !== 'none') {
        const isTrue = bossState.tsunami_truth === 'true';
        activeDoc.getElementById(isTrue ? 'tsunami-resolver-true' : 'tsunami-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 雷床
    if (bossState.lineLightning_truth && bossState.lineLightning_truth !== 'none') {
        const isTrue = bossState.lineLightning_truth === 'true';
        activeDoc.getElementById(isTrue ? 'lineLightning-resolver-true' : 'lineLightning-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 氷床
    if (bossState.iceFan_truth && bossState.iceFan_truth !== 'none') {
        const isTrue = bossState.iceFan_truth === 'true';
        activeDoc.getElementById(isTrue ? 'iceFan-resolver-true' : 'iceFan-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // ギミック欄の点灯（真偽が選択されたらギミックのセルをGCのように色付け：真=緑 / 偽=赤）
    [
        ['card-fire', bossState.fire_truth],
        ['card-tsunami', bossState.tsunami_truth],
        ['card-lineLightning', bossState.lineLightning_truth],
        ['card-iceFan', bossState.iceFan_truth]
    ].forEach(([cardId, truth]) => {
        const card = activeDoc.getElementById(cardId);
        if (!card) return;
        const cell = card.querySelector('.debuff-cell');
        if (!cell) return;
        cell.classList.remove('lit-true', 'lit-false');
        if (truth === 'true') cell.classList.add('lit-true');
        else if (truth === 'false') cell.classList.add('lit-false');
    });

    // タイムラインの更新
    updateTimeline();
}

// 時系列タイムラインの更新
function updateTimeline() {
    const activeDoc = getActiveDocument();

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
        const item = activeDoc.getElementById(stepId);
        if (item) {
            if (isReady) {
                item.classList.add('ready');
            } else {
                item.classList.remove('ready');
            }
        }
    };

    const iconWater = `<img src="img/water.jpg" class="gimmick-icon-mini">`;
    const iconLightning = `<img src="img/lightning.jpg" class="gimmick-icon-mini">`;
    const iconEye = `<img src="img/sight.jpg" class="gimmick-icon-mini">`;
    const iconFire = `<img src="img/fire.jpg" class="gimmick-icon-mini">`;
    const iconWave = `<img src="img/tsunami.jpg" class="gimmick-icon-mini">`;
    const iconLineLightning = `<span class="icon">⚡</span>`;
    const iconIceFan = `<span class="icon">❄️</span>`;

    // Step 1: 無の氾濫 (常に確定状態)
    setStepReady('v3-tl-step1', true);

    // Step 2: 早水 ＆ 早雷
    const t2 = activeDoc.getElementById('v3-tl-res-earlyWaterLightning');
    if (t2) {
        const ready = isValReady(currentState.earlyWater) && isValReady(currentState.earlyLightning);
        setStepReady('v3-tl-step2', ready);
        t2.innerHTML = 
            getRowHtml(iconWater, '早水', 'earlyWater', currentState.earlyWater, '頭割', '散開', 'blue', 'red') +
            getRowHtml(iconLightning, '早雷', 'earlyLightning', currentState.earlyLightning, '散開', '頭割', 'red', 'blue');
    }

    // Step 3: 早視線 ＆ 雷床記録
    const t3 = activeDoc.getElementById('v3-tl-res-earlyEyeLightningFloor');
    if (t3) {
        const ready = isValReady(currentState.earlyEye) && isValReady(currentState.lineLightning);
        setStepReady('v3-tl-step3', ready);
        t3.innerHTML = 
            getRowHtml(iconEye, '1回目視線', 'earlyEye', currentState.earlyEye, '早見ない', '早見る', 'purple', 'yellow') +
            getRowHtml(iconLineLightning, '雷床', 'lineLightning', currentState.lineLightning, '踏まない', '踏む', 'blue', 'yellow');
    }

    // Step 4: ほのお
    const t4 = activeDoc.getElementById('v3-tl-res-fire');
    if (t4) {
        const ready = isValReady(currentState.fire);
        setStepReady('v3-tl-step4', ready);
        t4.innerHTML = 
            getRowHtml(iconFire, 'ほのお', 'fire', currentState.fire, '離れる', 'そのまま', 'orange', 'blue');
    }

    // Step 5: 遅水 ＆ 遅雷 ＆ 氷床記録
    const t5 = activeDoc.getElementById('v3-tl-res-lateWaterLightningIceFloor');
    if (t5) {
        const ready = isValReady(currentState.lateWater) && isValReady(currentState.lateLightning) && isValReady(currentState.iceFan);
        setStepReady('v3-tl-step5', ready);
        t5.innerHTML = 
            getRowHtml(iconWater, '遅水', 'lateWater', currentState.lateWater, '頭割', '散開', 'blue', 'red') +
            getRowHtml(iconLightning, '遅雷', 'lateLightning', currentState.lateLightning, '散開', '頭割', 'red', 'blue') +
            getRowHtml(iconIceFan, '氷床', 'iceFan', currentState.iceFan, '踏まない', '踏む', 'blue', 'yellow');
    }

    // Step 6: 遅視線
    const t6 = activeDoc.getElementById('v3-tl-res-lateEye');
    if (t6) {
        const ready = isValReady(currentState.lateEye);
        setStepReady('v3-tl-step6', ready);
        t6.innerHTML = 
            getRowHtml(iconEye, '2回目視線', 'lateEye', currentState.lateEye, '遅見ない', '遅見る', 'purple', 'yellow');
    }

    // Step 7: つなみ ＆ 雷床 ＆ 氷床
    const t7 = activeDoc.getElementById('v3-tl-res-waterLightningIceFloor');
    if (t7) {
        const ready = isValReady(currentState.water) && isValReady(currentState.lineLightning) && isValReady(currentState.iceFan);
        setStepReady('v3-tl-step7', ready);
        t7.innerHTML = 
            getRowHtml(iconWave, 'つなみ', 'water', currentState.water, 'そのまま', '離れる', 'blue', 'orange') +
            getRowHtml(iconLineLightning, '雷床', 'lineLightning', currentState.lineLightning, '踏まない', '踏む', 'blue', 'yellow') +
            getRowHtml(iconIceFan, '氷床', 'iceFan', currentState.iceFan, '踏まない', '踏む', 'blue', 'yellow');
    }
}

let isInitialLoad = true;

function triggerPulse(element) {
    if (!element) return;
    element.classList.remove('pulse-update');
    void element.offsetWidth; // 強制再描画
    element.classList.add('pulse-update');
}

let lastResetTime = '0';
try {
    lastResetTime = localStorage.getItem('kfk_last_reset_time') || '0';
} catch (e) {}

// --- 状態受信後のUI反映処理の共通化 ---
function applyFirebaseData(data) {
    currentState = data;

    // Firebaseのリセット指示を検知してローカルデバフをリセット
    const firebaseResetTime = data.resetTime || 0;
    if (firebaseResetTime && String(firebaseResetTime) !== lastResetTime) {
        lastResetTime = String(firebaseResetTime);
        try {
            localStorage.setItem('kfk_last_reset_time', lastResetTime);
        } catch (e) {}

        // 個人デバフのローカル状態をリセット
        localState = {
            gc1_water_lightning: null,
            gc2_water_lightning: null,
            gc1_sight: false,
            gc2_sight: false,
            gc1_bomb: false,
            gc2_bomb: false
        };
        saveLocalState();
    }
    
    // 比較用に前回の状態を一時保存
    const prevTruths = {
        gc1: bossState.gc1_truth,
        gc2: bossState.gc2_truth,
        fire: bossState.fire_truth,
        tsunami: bossState.tsunami_truth,
        lineLightning: bossState.lineLightning_truth,
        iceFan: bossState.iceFan_truth
    };
    
    // Timingの復元
    bossState.gc1_water_timing = data.gc1WaterTiming || 'none';
    bossState.gc1_lightning_timing = data.gc1LightningTiming || 'none';
    bossState.gc2_water_timing = data.gc2WaterTiming || 'none';
    bossState.gc2_lightning_timing = data.gc2LightningTiming || 'none';
    
    // Truthの復元 (明示的なキーがあれば優先し、なければ後方互換で復元)
    bossState.gc1_truth = data.gc1Truth || 
                           ((data.earlyWater === 'true' || data.earlyWater === 'false') ? data.earlyWater : 
                            (data.earlyEye === 'true' || data.earlyEye === 'false') ? data.earlyEye : 'none');
                           
    bossState.gc2_truth = data.gc2Truth || 
                           ((data.lateWater === 'true' || data.lateWater === 'false') ? data.lateWater : 
                            (data.lateEye === 'true' || data.lateEye === 'false') ? data.lateEye : 'none');
    
    bossState.fire_truth = data.fire || 'none';
    bossState.tsunami_truth = data.water || 'none';
    bossState.lineLightning_truth = data.lineLightning || 'none';
    bossState.iceFan_truth = data.iceFan || 'none';
    lastEditedGC = data.lastEditedGC ? parseInt(data.lastEditedGC, 10) : null;
    
    deduceState();

    // 各カードの値に変更があったかチェックしてパルスを実行（初回読み込み時は除外）
    const currentTruths = {
        gc1: bossState.gc1_truth,
        gc2: bossState.gc2_truth,
        fire: bossState.fire_truth,
        tsunami: bossState.tsunami_truth,
        lineLightning: bossState.lineLightning_truth,
        iceFan: bossState.iceFan_truth
    };

    if (!isInitialLoad) {
        const activeDoc = getActiveDocument();
        Object.keys(currentTruths).forEach(key => {
            const oldValue = prevTruths[key];
            const newValue = currentTruths[key];
            if (oldValue !== newValue) {
                const card = activeDoc.getElementById(`card-${key}`);
                if (card) {
                    triggerPulse(card);
                }
            }
        });
    }
    
    isInitialLoad = false;
    renderUI();
}

// --- Firebase同期受信処理 ---
if (!isOfflineMode) {
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        applyFirebaseData(data);
    });
} else {
    // オフライン時はローカルストレージからデータをロード
    let saved = null;
    try {
        saved = localStorage.getItem('kfk_solver_offline_state');
    } catch (e) {}
    const data = saved ? JSON.parse(saved) : {};
    applyFirebaseData(data);
    
    // 他タブからの同期
    window.addEventListener('storage', (e) => {
        if (e.key === 'kfk_solver_offline_state') {
            const d = e.newValue ? JSON.parse(e.newValue) : {};
            applyFirebaseData(d);
        }
    });
}

// 自動推論ロジック (1回目と2回目で早の頭割り、遅の頭割り、早の散開、遅の散開が重複せず分配される特性を利用)
function deduceState() {
    // 1回目 (GC1) からの推論を実行可能か判定
    // GC1は水と雷の早遅が連動するため、真偽が未確定でも水・雷の早遅さえ分かれば
    // ロール(ES/LS/EP/LP)の組み合わせが一意に決まり、GC2側の早遅を推論できる。
    const canDeduceFromGC1 = bossState.gc1_water_timing !== 'none' &&
                             bossState.gc1_lightning_timing !== 'none';
                             
    // 2回目 (GC2) からの推論を実行可能か判定
    const canDeduceFromGC2 = bossState.gc2_truth !== 'none' && 
                             bossState.gc2_water_timing !== 'none' && 
                             bossState.gc2_lightning_timing !== 'none';

    // 優先順位の決定 (直近で編集された方の入力を優先ソースとし、競合状態を避けて相手側を上書き)
    // 編集中のGCが未完成の場合は他方からの上書きを防ぐため fallback を行わない
    let primaryGC = null;
    if (lastEditedGC === 1) {
        if (canDeduceFromGC1) primaryGC = 1;
    } else if (lastEditedGC === 2) {
        if (canDeduceFromGC2) primaryGC = 2;
    } else {
        if (canDeduceFromGC1) primaryGC = 1;
        else if (canDeduceFromGC2) primaryGC = 2;
    }

    if (primaryGC === 1) {
        // GC1 -> GC2
        const r1_water = bossState.gc1_truth === 'true' 
            ? (bossState.gc1_water_timing === 'early' ? 'ES' : 'LS')
            : (bossState.gc1_water_timing === 'early' ? 'EP' : 'LP');
            
        const r1_lightning = bossState.gc1_truth === 'true'
            ? (bossState.gc1_lightning_timing === 'early' ? 'EP' : 'LP')
            : (bossState.gc1_lightning_timing === 'early' ? 'ES' : 'LS');
            
        const roles1 = [r1_water, r1_lightning];
        const all = ['ES', 'LS', 'EP', 'LP'];
        const roles2 = all.filter(r => !roles1.includes(r));
        
        // GC1の水・雷が連動しているため、roles2(GC1が使わなかった残り2ロール)は
        // GC2の真偽に関わらず一意に決まる。真偽が未確定でもGC2の早遅を確定できる。
        if (bossState.gc2_truth === 'true') {
            bossState.gc2_water_timing = roles2.includes('ES') ? 'early' : 'late';
            bossState.gc2_lightning_timing = roles2.includes('EP') ? 'early' : 'late';
        } else {
            bossState.gc2_water_timing = roles2.includes('EP') ? 'early' : 'late';
            bossState.gc2_lightning_timing = roles2.includes('ES') ? 'early' : 'late';
        }
    }
    else if (primaryGC === 2) {
        // GC2 -> GC1
        const r2_water = bossState.gc2_truth === 'true' 
            ? (bossState.gc2_water_timing === 'early' ? 'ES' : 'LS')
            : (bossState.gc2_water_timing === 'early' ? 'EP' : 'LP');
            
        const r2_lightning = bossState.gc2_truth === 'true'
            ? (bossState.gc2_lightning_timing === 'early' ? 'EP' : 'LP')
            : (bossState.gc2_lightning_timing === 'early' ? 'ES' : 'LS');
            
        const roles2 = [r2_water, r2_lightning];
        const all = ['ES', 'LS', 'EP', 'LP'];
        const roles1 = all.filter(r => !roles2.includes(r));
        
        if (bossState.gc1_truth !== 'none') {
            if (bossState.gc1_truth === 'true') {
                bossState.gc1_water_timing = roles1.includes('ES') ? 'early' : 'late';
                bossState.gc1_lightning_timing = roles1.includes('EP') ? 'early' : 'late';
            } else {
                bossState.gc1_water_timing = roles1.includes('EP') ? 'early' : 'late';
                bossState.gc1_lightning_timing = roles1.includes('ES') ? 'early' : 'late';
            }
        }
    }

    // GC2の真偽が既知で、GC1の真偽がまだ未確定の場合のみ、ロールの整合性からGC1の真偽を逆算できる。
    // 逆方向（GC1からGC2の真偽を逆算）は行わない：GC2の早遅はGC1の早遅だけから自動的に
    // 埋まる派生値であり、GC2自身の真偽に関する独立した情報を持たないため、
    // それを使ってGC2の真偽を「逆算」すると常に同じ結果に確定してしまう
    // (GC1の真偽を入力した瞬間にGC2の真偽まで勝手に決まってしまうバグになる)。
    if (bossState.gc1_truth === 'none' && bossState.gc2_truth !== 'none' &&
        bossState.gc1_water_timing !== 'none' && bossState.gc1_lightning_timing !== 'none' &&
        bossState.gc2_water_timing !== 'none' && bossState.gc2_lightning_timing !== 'none') {
        const r2_water = bossState.gc2_truth === 'true'
            ? (bossState.gc2_water_timing === 'early' ? 'ES' : 'LS')
            : (bossState.gc2_water_timing === 'early' ? 'EP' : 'LP');
        const r2_lightning = bossState.gc2_truth === 'true'
            ? (bossState.gc2_lightning_timing === 'early' ? 'EP' : 'LP')
            : (bossState.gc2_lightning_timing === 'early' ? 'ES' : 'LS');
        const roles2 = [r2_water, r2_lightning];
        const all = ['ES', 'LS', 'EP', 'LP'];
        const roles1 = all.filter(r => !roles2.includes(r));

        const w_role_true = bossState.gc1_water_timing === 'early' ? 'ES' : 'LS';
        const l_role_true = bossState.gc1_lightning_timing === 'early' ? 'EP' : 'LP';
        if (roles1.includes(w_role_true) && roles1.includes(l_role_true)) {
            bossState.gc1_truth = 'true';
        } else {
            bossState.gc1_truth = 'false';
        }
    }
}

// Firebaseのボスの真偽・タイミング状態を計算して保存する関数
function updateFirebaseState(shouldResetTime = false) {
    deduceState();
    
    let earlyWater = 'none';
    let lateWater = 'none';
    let earlyLightning = 'none';
    let lateLightning = 'none';
    
    // Find early Share (ES)
    let es_gc = null;
    if (bossState.gc1_truth !== 'none') {
        if (bossState.gc1_truth === 'true' && bossState.gc1_water_timing === 'early') es_gc = 1;
        else if (bossState.gc1_truth === 'false' && bossState.gc1_lightning_timing === 'early') es_gc = 1;
    }
    if (bossState.gc2_truth !== 'none') {
        if (bossState.gc2_truth === 'true' && bossState.gc2_water_timing === 'early') es_gc = 2;
        else if (bossState.gc2_truth === 'false' && bossState.gc2_lightning_timing === 'early') es_gc = 2;
    }
    
    if (es_gc === 1) {
        earlyWater = bossState.gc1_truth;
        earlyLightning = bossState.gc1_truth;
    } else if (es_gc === 2) {
        earlyWater = bossState.gc2_truth;
        earlyLightning = bossState.gc2_truth;
    }
    
    // Find late Share (LS)
    let ls_gc = null;
    if (bossState.gc1_truth !== 'none') {
        if (bossState.gc1_truth === 'true' && bossState.gc1_water_timing === 'late') ls_gc = 1;
        else if (bossState.gc1_truth === 'false' && bossState.gc1_lightning_timing === 'late') ls_gc = 1;
    }
    if (bossState.gc2_truth !== 'none') {
        if (bossState.gc2_truth === 'true' && bossState.gc2_water_timing === 'late') ls_gc = 2;
        else if (bossState.gc2_truth === 'false' && bossState.gc2_lightning_timing === 'late') ls_gc = 2;
    }
    
    if (ls_gc === 1) {
        lateWater = bossState.gc1_truth;
        lateLightning = bossState.gc1_truth;
    } else if (ls_gc === 2) {
        lateWater = bossState.gc2_truth;
        lateLightning = bossState.gc2_truth;
    }
    
    // タイムライン互換のキーへ書き込み
    currentState.earlyWater = earlyWater;
    currentState.lateWater = lateWater;
    currentState.earlyLightning = earlyLightning;
    currentState.lateLightning = lateLightning;
    
    currentState.earlyEye = bossState.gc1_truth || 'none';
    currentState.lateEye = bossState.gc2_truth || 'none';

    // 安定した明示的な真偽値キーの保存
    currentState.gc1Truth = bossState.gc1_truth || 'none';
    currentState.gc2Truth = bossState.gc2_truth || 'none';
    
    // 加速度は gc1 / gc2 いずれかが真・偽になった場合に bomb にマッピング
    currentState.bomb = (bossState.gc1_truth === 'true' || bossState.gc1_truth === 'false') ? bossState.gc1_truth :
                        (bossState.gc2_truth === 'true' || bossState.gc2_truth === 'false') ? bossState.gc2_truth : 'none';
    
    currentState.fire = bossState.fire_truth || 'none';
    currentState.water = bossState.tsunami_truth || 'none';
    currentState.lineLightning = bossState.lineLightning_truth || 'none';
    currentState.iceFan = bossState.iceFan_truth || 'none';
    
    // Timing情報自体も共有するために保存
    currentState.gc1WaterTiming = bossState.gc1_water_timing || 'none';
    currentState.gc1LightningTiming = bossState.gc1_lightning_timing || 'none';
    currentState.gc2WaterTiming = bossState.gc2_water_timing || 'none';
    currentState.gc2LightningTiming = bossState.gc2_lightning_timing || 'none';
    
    currentState.lastEditedGC = lastEditedGC || null;
    
    if (shouldResetTime) {
        currentState.resetTime = Date.now();
    }
    
    if (!isOfflineMode && dbRef) {
        dbRef.set(currentState).catch(err => {
            console.warn("Firebase dbRef.set failed", err);
        });
    }
    // オフライン・オンライン問わず、ローカルでの動作とUIサクサク感を維持するために即座に保存・反映する
    try {
        localStorage.setItem('kfk_solver_offline_state', JSON.stringify(currentState));
    } catch (e) {}
    applyFirebaseData(currentState);
}

// ボスの真偽トグル更新関数（2回押しても解除されない）
function setBossTruth(key, value) {
    bossState[`${key}_truth`] = value;
    // 真偽値が変更された場合、そのGC自体のタイミングを再推論するため、他方のGCを優先編集ソースとする
    if (key === 'gc1') lastEditedGC = 2;
    if (key === 'gc2') lastEditedGC = 1;
    updateFirebaseState();
}

// Timingトグル更新関数（2回押すと none に戻す）
// 1回目グランドクロス(GC1)は水と雷の早遅が連動する（早水→早雷、遅水→遅雷）ため、
// どちらかを押すともう片方も同じ値に揃える。2回目(GC2)は水と雷を独立して設定可能。
function setBossTiming(key, value) {
    const currentVal = bossState[`${key}_timing`];
    // 既に選択済みの早/遅を再クリックしても選択解除はせず、そのまま維持する。
    if (currentVal === value) return;

    bossState[`${key}_timing`] = value;

    if (key === 'gc1_water') {
        bossState.gc1_lightning_timing = value;
    } else if (key === 'gc1_lightning') {
        bossState.gc1_water_timing = value;
    }

    if (key.startsWith('gc1')) lastEditedGC = 1;
    if (key.startsWith('gc2')) lastEditedGC = 2;

    updateFirebaseState();
}

// --- イベントリスナーの設定 ---

// 1. 各トグルボタンへのバインド
const buttons = [
    // GC1 真偽
    { id: 'gc1-true', action: () => setBossTruth('gc1', 'true') },
    { id: 'gc1-false', action: () => setBossTruth('gc1', 'false') },

    // GC2 真偽
    { id: 'gc2-true', action: () => setBossTruth('gc2', 'true') },
    { id: 'gc2-false', action: () => setBossTruth('gc2', 'false') },

    // GC1 水タイミング
    { id: 'gc1-water-early', action: () => setBossTiming('gc1_water', 'early') },
    { id: 'gc1-water-late', action: () => setBossTiming('gc1_water', 'late') },
    
    // GC1 雷タイミング
    { id: 'gc1-lightning-early', action: () => setBossTiming('gc1_lightning', 'early') },
    { id: 'gc1-lightning-late', action: () => setBossTiming('gc1_lightning', 'late') },

    // GC2 水タイミング
    { id: 'gc2-water-early', action: () => setBossTiming('gc2_water', 'early') },
    { id: 'gc2-water-late', action: () => setBossTiming('gc2_water', 'late') },
    
    // GC2 雷タイミング
    { id: 'gc2-lightning-early', action: () => setBossTiming('gc2_lightning', 'early') },
    { id: 'gc2-lightning-late', action: () => setBossTiming('gc2_lightning', 'late') },

    // ほのお
    { id: 'fire-true', action: () => setBossTruth('fire', 'true') },
    { id: 'fire-false', action: () => setBossTruth('fire', 'false') },

    // つなみ
    { id: 'tsunami-true', action: () => setBossTruth('tsunami', 'true') },
    { id: 'tsunami-false', action: () => setBossTruth('tsunami', 'false') },

    // 雷床
    { id: 'lineLightning-true', action: () => setBossTruth('lineLightning', 'true') },
    { id: 'lineLightning-false', action: () => setBossTruth('lineLightning', 'false') },

    // 氷床
    { id: 'iceFan-true', action: () => setBossTruth('iceFan', 'true') },
    { id: 'iceFan-false', action: () => setBossTruth('iceFan', 'false') }
];

buttons.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            item.action();
        });
    }
});

// 2. カラムヘッダー（「真」のとき / 「偽」のとき）のクリックによる真偽設定
const truthHdrIds = [
    { id: 'gc1-hdr-true', key: 'gc1', val: 'true' },
    { id: 'gc1-hdr-false', key: 'gc1', val: 'false' },
    { id: 'gc2-hdr-true', key: 'gc2', val: 'true' },
    { id: 'gc2-hdr-false', key: 'gc2', val: 'false' },
    { id: 'fire-hdr-true', key: 'fire', val: 'true' },
    { id: 'fire-hdr-false', key: 'fire', val: 'false' },
    { id: 'tsunami-hdr-true', key: 'tsunami', val: 'true' },
    { id: 'tsunami-hdr-false', key: 'tsunami', val: 'false' },
    { id: 'lineLightning-hdr-true', key: 'lineLightning', val: 'true' },
    { id: 'lineLightning-hdr-false', key: 'lineLightning', val: 'false' },
    { id: 'iceFan-hdr-true', key: 'iceFan', val: 'true' },
    { id: 'iceFan-hdr-false', key: 'iceFan', val: 'false' }
];

truthHdrIds.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            setBossTruth(item.key, item.val);
        });
    }
});

// 3. 解決策セルのクリック（直接クリックでの真偽設定）
const effectCells = [
    { id: '1-water-true', key: 'gc1', val: 'true' },
    { id: '1-water-false', key: 'gc1', val: 'false' },
    { id: '1-lightning-true', key: 'gc1', val: 'true' },
    { id: '1-lightning-false', key: 'gc1', val: 'false' },
    { id: '1-sight-true', key: 'gc1', val: 'true' },
    { id: '1-sight-false', key: 'gc1', val: 'false' },
    { id: '1-bomb-true', key: 'gc1', val: 'true' },
    { id: '1-bomb-false', key: 'gc1', val: 'false' },

    { id: '2-water-true', key: 'gc2', val: 'true' },
    { id: '2-water-false', key: 'gc2', val: 'false' },
    { id: '2-lightning-true', key: 'gc2', val: 'true' },
    { id: '2-lightning-false', key: 'gc2', val: 'false' },
    { id: '2-sight-true', key: 'gc2', val: 'true' },
    { id: '2-sight-false', key: 'gc2', val: 'false' },
    { id: '2-bomb-true', key: 'gc2', val: 'true' },
    { id: '2-bomb-false', key: 'gc2', val: 'false' },

    { id: 'fire-resolver-true', key: 'fire', val: 'true' },
    { id: 'fire-resolver-false', key: 'fire', val: 'false' },
    { id: 'tsunami-resolver-true', key: 'tsunami', val: 'true' },
    { id: 'tsunami-resolver-false', key: 'tsunami', val: 'false' },
    { id: 'lineLightning-resolver-true', key: 'lineLightning', val: 'true' },
    { id: 'lineLightning-resolver-false', key: 'lineLightning', val: 'false' },
    { id: 'iceFan-resolver-true', key: 'iceFan', val: 'true' },
    { id: 'iceFan-resolver-false', key: 'iceFan', val: 'false' }
];

effectCells.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
        el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            setBossTruth(item.key, item.val);
        });
    }
});

// 4. プレイヤーのデバフクリック選択 (1回目/2回目)
document.getElementById('row-1-water').addEventListener('pointerdown', (e) => {
    if (e.target.tagName.toLowerCase() === 'button') return;
    e.preventDefault();
    if (localState.gc2_water_lightning) return;
    localState.gc1_water_lightning = (localState.gc1_water_lightning === 'water') ? null : 'water';
    saveLocalState();
    renderUI();
});
document.getElementById('row-1-lightning').addEventListener('pointerdown', (e) => {
    if (e.target.tagName.toLowerCase() === 'button') return;
    e.preventDefault();
    if (localState.gc2_water_lightning) return;
    localState.gc1_water_lightning = (localState.gc1_water_lightning === 'lightning') ? null : 'lightning';
    saveLocalState();
    renderUI();
});

document.getElementById('row-2-water').addEventListener('pointerdown', (e) => {
    if (e.target.tagName.toLowerCase() === 'button') return;
    e.preventDefault();
    if (localState.gc1_water_lightning) return;
    localState.gc2_water_lightning = (localState.gc2_water_lightning === 'water') ? null : 'water';
    saveLocalState();
    renderUI();
});
document.getElementById('row-2-lightning').addEventListener('pointerdown', (e) => {
    if (e.target.tagName.toLowerCase() === 'button') return;
    e.preventDefault();
    if (localState.gc1_water_lightning) return;
    localState.gc2_water_lightning = (localState.gc2_water_lightning === 'lightning') ? null : 'lightning';
    saveLocalState();
    renderUI();
});

// 視線・加速度の行クリック
// 視線がつくと必ず同じGCに加速度もつく（が、加速度だけがつくケースもある）。
// ・視線を押す → 同じGCの視線＋加速度をオン（外すと加速度は単独で残る）
// ・加速度を押す → そのGCの加速度のみをトグル（外すと同じGCの視線も外れる）
// 視線・加速度はそれぞれ早(GC1)・遅(GC2)どちらか一方のクロス排他を維持する。
function clickSight(gc) {
    const other = gc === 1 ? 2 : 1;
    if (localState[`gc${other}_sight`]) return; // 視線は早・遅どちらか一方
    if (localState[`gc${gc}_sight`]) {
        localState[`gc${gc}_sight`] = false; // 視線だけ外す（加速度は単独で残す）
    } else {
        if (localState[`gc${other}_bomb`]) return; // 反対側に加速度がある間は視線をつけられない
        localState[`gc${gc}_sight`] = true;
        localState[`gc${gc}_bomb`] = true;  // 視線には必ず同じGCの加速度が伴う
    }
    saveLocalState();
    renderUI();
}
function clickBomb(gc) {
    const other = gc === 1 ? 2 : 1;
    if (localState[`gc${other}_bomb`]) return; // 加速度は早・遅どちらか一方
    if (localState[`gc${gc}_bomb`]) {
        localState[`gc${gc}_bomb`] = false;
        localState[`gc${gc}_sight`] = false; // 加速度なしに視線は成立しない
    } else {
        localState[`gc${gc}_bomb`] = true;   // 加速度のみ（視線は伴わない場合もある）
    }
    saveLocalState();
    renderUI();
}
document.getElementById('row-1-sight').addEventListener('pointerdown', (e) => { e.preventDefault(); clickSight(1); });
document.getElementById('row-2-sight').addEventListener('pointerdown', (e) => { e.preventDefault(); clickSight(2); });
document.getElementById('row-1-bomb').addEventListener('pointerdown', (e) => { e.preventDefault(); clickBomb(1); });
document.getElementById('row-2-bomb').addEventListener('pointerdown', (e) => { e.preventDefault(); clickBomb(2); });

// 5. リセットボタン
document.getElementById('localResetBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    
    // 個人デバフのローカル状態をリセット
    localState = {
        gc1_water_lightning: null,
        gc2_water_lightning: null,
        gc1_sight: false,
        gc2_sight: false,
        gc1_bomb: false,
        gc2_bomb: false
    };
    saveLocalState();
    
    // 共有の真偽・タイミング状態を一括リセット
    bossState = {
        gc1_truth: 'none',
        gc2_truth: 'none',
        gc1_water_timing: 'none',
        gc1_lightning_timing: 'none',
        gc2_water_timing: 'none',
        gc2_lightning_timing: 'none',
        fire_truth: 'none',
        tsunami_truth: 'none',
        lineLightning_truth: 'none',
        iceFan_truth: 'none'
    };
    lastEditedGC = null;
    updateFirebaseState(true);
});

// 初期化
loadLocalState();
renderUI();

// UIモード切り替え
window.setMode = function (mode) {
    // オーバーレイモードでPiPウィンドウへ移動済みの場合、スマホ/PCボタンや
    // body.pc-modeクラスもその移動先document（PiPウィンドウ自身のbody）に
    // 対して切り替える必要がある。
    const activeDoc = getActiveDocument();
    const btnMobile = activeDoc.getElementById('btn-mode-mobile');
    const btnPc = activeDoc.getElementById('btn-mode-pc');

    if (mode === 'pc' || mode === 'hud') {
        activeDoc.body.classList.add('pc-mode');
        if (btnMobile) btnMobile.classList.remove('active');
        if (btnPc) btnPc.classList.add('active');
        try {
            localStorage.setItem('kfk_shared_ui_mode', 'pc');
        } catch (e) {}
    } else {
        activeDoc.body.classList.remove('pc-mode');
        if (btnMobile) btnMobile.classList.add('active');
        if (btnPc) btnPc.classList.remove('active');
        try {
            localStorage.setItem('kfk_shared_ui_mode', 'mobile');
        } catch (e) {}
    }
};

let savedMode = 'mobile';
try {
    savedMode = localStorage.getItem('kfk_shared_ui_mode') || localStorage.getItem('kfk_solver_ui_mode') || 'mobile';
} catch (e) {}
window.setMode(savedMode);

window.addEventListener('storage', (e) => {
    if (e.key === 'kfk_shared_ui_mode') {
        window.setMode(e.newValue || 'mobile');
    }
});
})();
