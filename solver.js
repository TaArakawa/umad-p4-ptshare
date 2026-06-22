import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'kfk_p4_state');

// サーバー全体の共通状態を保持するオブジェクト
let currentState = {};

// ボスの同期する状態 (Firebase管理)
let bossState = {
    gc1_truth: null,   // "true" / "false" / null
    gc2_truth: null,   // "true" / "false" / null
    fire_truth: null,  // "true" / "false" / null
    tsunami_truth: null, // "true" / "false" / null
    lineLightning_truth: null, // "true" / "false" / null
    iceFan_truth: null // "true" / "false" / null
};

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
    const saved = localStorage.getItem('kfk_solver_local_state');
    if (saved) {
        try {
            localState = JSON.parse(saved);
        } catch (e) {
            console.error("Local state parse error", e);
        }
    }
}

// 個人デバフ状態を保存
function saveLocalState() {
    localStorage.setItem('kfk_solver_local_state', JSON.stringify(localState));
}

// UIの描画とハイライトの更新
function renderUI() {
    // --- 1. デバフ行のアクティブ・非アクティブ（排他制御）の反映 ---
    
    // 水・雷の排他制御
    const row1Water = document.getElementById('row-1-water');
    const row1Lightning = document.getElementById('row-1-lightning');
    const row2Water = document.getElementById('row-2-water');
    const row2Lightning = document.getElementById('row-2-lightning');

    // 1回目：水 / 雷
    row1Water.classList.remove('active', 'inactive');
    row1Lightning.classList.remove('active', 'inactive');
    if (localState.gc1_water_lightning === 'water') {
        row1Water.classList.add('active');
        row1Lightning.classList.remove('active');
    } else if (localState.gc1_water_lightning === 'lightning') {
        row1Water.classList.remove('active');
        row1Lightning.classList.add('active');
    }

    // 2回目：水 / 雷
    row2Water.classList.remove('active', 'inactive');
    row2Lightning.classList.remove('active', 'inactive');
    if (localState.gc2_water_lightning === 'water') {
        row2Water.classList.add('active');
        row2Lightning.classList.remove('active');
    } else if (localState.gc2_water_lightning === 'lightning') {
        row2Water.classList.remove('active');
        row2Lightning.classList.add('active');
    }

    // 水・雷のクロス排他 (1回目で選択があれば2回目は押せない、逆も然り)
    if (localState.gc1_water_lightning) {
        row2Water.classList.add('inactive');
        row2Lightning.classList.add('inactive');
    } else if (localState.gc2_water_lightning) {
        row1Water.classList.add('inactive');
        row1Lightning.classList.add('inactive');
    }

    // 視線の排他制御
    const row1Sight = document.getElementById('row-1-sight');
    const row2Sight = document.getElementById('row-2-sight');
    row1Sight.classList.remove('active', 'inactive', 'sight-selected');
    row2Sight.classList.remove('active', 'inactive', 'sight-selected');
    if (localState.gc1_sight) {
        row1Sight.classList.add('active', 'sight-selected');
        row2Sight.classList.add('inactive');
    } else if (localState.gc2_sight) {
        row2Sight.classList.add('active', 'sight-selected');
        row1Sight.classList.add('inactive');
    }

    // 加速度の排他制御
    const row1Bomb = document.getElementById('row-1-bomb');
    const row2Bomb = document.getElementById('row-2-bomb');
    row1Bomb.classList.remove('active', 'inactive');
    row2Bomb.classList.remove('active', 'inactive');
    if (localState.gc1_bomb) {
        row1Bomb.classList.add('active');
        row2Bomb.classList.add('inactive');
    } else if (localState.gc2_bomb) {
        row2Bomb.classList.add('active');
        row1Bomb.classList.add('inactive');
    }

    // --- 2. ボス「真・偽」ボタンのアクティブ表示 & テーブルヘッダーハイライト ---
    const keys = ['gc1', 'gc2', 'fire', 'tsunami', 'lineLightning', 'iceFan'];
    keys.forEach(k => {
        const btnTrue = document.getElementById(`${k}-true`);
        const btnFalse = document.getElementById(`${k}-false`);
        btnTrue.classList.remove('active-true');
        btnFalse.classList.remove('active-false');

        // カラムヘッダー (GC1 & GC2 のみ)
        const hdrTrue = document.getElementById(`${k}-hdr-true`);
        const hdrFalse = document.getElementById(`${k}-hdr-false`);
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

    // --- 3. 解決策セルのハイライト計算とクラス適用 ---
    
    // 全てのエフェクトセルのハイライトを一括クリア
    document.querySelectorAll('.effect-cell, .resolver-box').forEach(el => {
        el.classList.remove('highlight-true', 'highlight-false');
    });

    // 1回目の解決策
    if (bossState.gc1_truth) {
        const isTrue = bossState.gc1_truth === 'true';
        // 水
        if (localState.gc1_water_lightning === 'water') {
            document.getElementById(isTrue ? '1-water-true' : '1-water-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 雷
        if (localState.gc1_water_lightning === 'lightning') {
            document.getElementById(isTrue ? '1-lightning-true' : '1-lightning-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 視線
        if (localState.gc1_sight) {
            document.getElementById(isTrue ? '1-sight-true' : '1-sight-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 加速度
        if (localState.gc1_bomb) {
            document.getElementById(isTrue ? '1-bomb-true' : '1-bomb-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
    }

    // 2回目の解決策
    if (bossState.gc2_truth) {
        const isTrue = bossState.gc2_truth === 'true';
        // 水
        if (localState.gc2_water_lightning === 'water') {
            document.getElementById(isTrue ? '2-water-true' : '2-water-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 雷
        if (localState.gc2_water_lightning === 'lightning') {
            document.getElementById(isTrue ? '2-lightning-true' : '2-lightning-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 視線
        if (localState.gc2_sight) {
            document.getElementById(isTrue ? '2-sight-true' : '2-sight-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
        // 加速度
        if (localState.gc2_bomb) {
            document.getElementById(isTrue ? '2-bomb-true' : '2-bomb-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
        }
    }

    // ほのお
    if (bossState.fire_truth) {
        const isTrue = bossState.fire_truth === 'true';
        document.getElementById(isTrue ? 'fire-resolver-true' : 'fire-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // つなみ
    if (bossState.tsunami_truth) {
        const isTrue = bossState.tsunami_truth === 'true';
        document.getElementById(isTrue ? 'tsunami-resolver-true' : 'tsunami-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 雷床
    if (bossState.lineLightning_truth) {
        const isTrue = bossState.lineLightning_truth === 'true';
        document.getElementById(isTrue ? 'lineLightning-resolver-true' : 'lineLightning-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 氷床
    if (bossState.iceFan_truth) {
        const isTrue = bossState.iceFan_truth === 'true';
        document.getElementById(isTrue ? 'iceFan-resolver-true' : 'iceFan-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }
}

// --- Firebase同期設定 ---
onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {};
    currentState = data;
    
    // メインの真偽状態と同期する
    bossState.gc1_truth = (data.earlyWater === 'true' || data.earlyWater === 'false') ? data.earlyWater : null;
    bossState.gc2_truth = (data.lateWater === 'true' || data.lateWater === 'false') ? data.lateWater : null;
    bossState.fire_truth = (data.fire === 'true' || data.fire === 'false') ? data.fire : null;
    bossState.tsunami_truth = (data.water === 'true' || data.water === 'false') ? data.water : null;
    bossState.lineLightning_truth = (data.lineLightning === 'true' || data.lineLightning === 'false') ? data.lineLightning : null;
    bossState.iceFan_truth = (data.iceFan === 'true' || data.iceFan === 'false') ? data.iceFan : null;
    
    renderUI();
});

// Firebaseのボスの真偽状態を更新する関数
function setBossTruth(key, value) {
    // 2回押しても解除されないよう、クリックされた値をそのままセットする
    const newVal = value;

    if (key === 'gc1') {
        currentState.earlyWater = newVal;
        currentState.earlyLightning = newVal;
        currentState.earlyEye = newVal;
    } else if (key === 'gc2') {
        currentState.lateWater = newVal;
        currentState.lateLightning = newVal;
        currentState.lateEye = newVal;
    } else if (key === 'fire') {
        currentState.fire = newVal;
    } else if (key === 'tsunami') {
        currentState.water = newVal;
    } else if (key === 'lineLightning') {
        currentState.lineLightning = newVal;
    } else if (key === 'iceFan') {
        currentState.iceFan = newVal;
    }

    set(dbRef, currentState);
}

// --- イベントリスナーの設定 ---

// 1. ボスの真偽トグルボタン
const truthBtnIds = [
    { id: 'gc1-true', key: 'gc1', val: 'true' },
    { id: 'gc1-false', key: 'gc1', val: 'false' },
    { id: 'gc2-true', key: 'gc2', val: 'true' },
    { id: 'gc2-false', key: 'gc2', val: 'false' },
    { id: 'fire-true', key: 'fire', val: 'true' },
    { id: 'fire-false', key: 'fire', val: 'false' },
    { id: 'tsunami-true', key: 'tsunami', val: 'true' },
    { id: 'tsunami-false', key: 'tsunami', val: 'false' },
    { id: 'lineLightning-true', key: 'lineLightning', val: 'true' },
    { id: 'lineLightning-false', key: 'lineLightning', val: 'false' },
    { id: 'iceFan-true', key: 'iceFan', val: 'true' },
    { id: 'iceFan-false', key: 'iceFan', val: 'false' }
];

truthBtnIds.forEach(item => {
    document.getElementById(item.id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth(item.key, item.val);
    });
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
    document.getElementById(item.id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth(item.key, item.val);
    });
});

// 3. 解決策セル（「真」カラム / 「偽」カラム）のクリックによる真偽設定
// 1回目：解決策セルクリック
document.querySelectorAll('#card-gc1 .true-effect').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth('gc1', 'true');
    });
});
document.querySelectorAll('#card-gc1 .false-effect').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth('gc1', 'false');
    });
});

// 2回目：解決策セルクリック
document.querySelectorAll('#card-gc2 .true-effect').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth('gc2', 'true');
    });
});
document.querySelectorAll('#card-gc2 .false-effect').forEach(el => {
    el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        setBossTruth('gc2', 'false');
    });
});

// ほのお ＆ つなみ の解決策（リゾルバーボックス）クリック
document.getElementById('fire-resolver-true').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('fire', 'true');
});
document.getElementById('fire-resolver-false').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('fire', 'false');
});
document.getElementById('tsunami-resolver-true').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('tsunami', 'true');
});
document.getElementById('tsunami-resolver-false').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('tsunami', 'false');
});

// 雷床 ＆ 氷床 の解決策クリック
document.getElementById('lineLightning-resolver-true').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('lineLightning', 'true');
});
document.getElementById('lineLightning-resolver-false').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('lineLightning', 'false');
});
document.getElementById('iceFan-resolver-true').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('iceFan', 'true');
});
document.getElementById('iceFan-resolver-false').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setBossTruth('iceFan', 'false');
});

// 4. プレイヤーのデバフクリック選択 (1回目/2回目)
// 水の行クリック
document.getElementById('row-1-water').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc2_water_lightning) return; // 2回目で選択済みの場合は不可
    localState.gc1_water_lightning = (localState.gc1_water_lightning === 'water') ? null : 'water';
    saveLocalState();
    renderUI();
});
document.getElementById('row-2-water').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc1_water_lightning) return; // 1回目で選択済みの場合は不可
    localState.gc2_water_lightning = (localState.gc2_water_lightning === 'water') ? null : 'water';
    saveLocalState();
    renderUI();
});

// 雷の行クリック
document.getElementById('row-1-lightning').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc2_water_lightning) return;
    localState.gc1_water_lightning = (localState.gc1_water_lightning === 'lightning') ? null : 'lightning';
    saveLocalState();
    renderUI();
});
document.getElementById('row-2-lightning').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc1_water_lightning) return;
    localState.gc2_water_lightning = (localState.gc2_water_lightning === 'lightning') ? null : 'lightning';
    saveLocalState();
    renderUI();
});

// 視線の行クリック
document.getElementById('row-1-sight').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc2_sight) return;
    localState.gc1_sight = !localState.gc1_sight;
    saveLocalState();
    renderUI();
});
document.getElementById('row-2-sight').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc1_sight) return;
    localState.gc2_sight = !localState.gc2_sight;
    saveLocalState();
    renderUI();
});

// 加速度の行クリック
document.getElementById('row-1-bomb').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc2_bomb) return;
    localState.gc1_bomb = !localState.gc1_bomb;
    saveLocalState();
    renderUI();
});
document.getElementById('row-2-bomb').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (localState.gc1_bomb) return;
    localState.gc2_bomb = !localState.gc2_bomb;
    saveLocalState();
    renderUI();
});

// 5. ローカルリセットボタン
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
    
    // 共有の真偽状態も一括リセット
    currentState.earlyWater = 'none';
    currentState.earlyLightning = 'none';
    currentState.earlyEye = 'none';
    currentState.lateWater = 'none';
    currentState.lateLightning = 'none';
    currentState.lateEye = 'none';
    currentState.fire = 'none';
    currentState.water = 'none';
    currentState.lineLightning = 'none';
    currentState.iceFan = 'none';
    
    set(dbRef, currentState);
    renderUI();
});

// 読み込み初期化
loadLocalState();
renderUI();

// UIモード切り替え処理
window.setMode = function (mode) {
    const btnMobile = document.getElementById('btn-mode-mobile');
    const btnPc = document.getElementById('btn-mode-pc');

    if (mode === 'pc') {
        document.body.classList.add('pc-mode');
        btnMobile.classList.remove('active');
        btnPc.classList.add('active');
        localStorage.setItem('kfk_solver_ui_mode', 'pc');
    } else {
        document.body.classList.remove('pc-mode');
        btnMobile.classList.add('active');
        btnPc.classList.remove('active');
        localStorage.setItem('kfk_solver_ui_mode', 'mobile');
    }
};

// ページ読み込み時に保存されたモードを復元
const savedMode = localStorage.getItem('kfk_solver_ui_mode') || 'mobile';
setMode(savedMode);
