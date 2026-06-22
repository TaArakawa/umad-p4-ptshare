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

    // --- 2. ボス「真・偽」トグルボタンのアクティブ表示 ---
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

    // --- 3. タイミング（早・遅）ボタンのアクティブ表示 ---
    const timingKeys = [
        { key: 'gc1_water', id: 'gc1-water' },
        { key: 'gc1_lightning', id: 'gc1-lightning' },
        { key: 'gc2_water', id: 'gc2-water' },
        { key: 'gc2_lightning', id: 'gc2-lightning' }
    ];
    timingKeys.forEach(item => {
        const btnEarly = document.getElementById(`${item.id}-early`);
        const btnLate = document.getElementById(`${item.id}-late`);
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
    document.querySelectorAll('.effect-cell').forEach(el => {
        el.classList.remove('highlight-true', 'highlight-false');
    });

    // 1回目の解決策
    if (bossState.gc1_truth && bossState.gc1_truth !== 'none') {
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
    if (bossState.gc2_truth && bossState.gc2_truth !== 'none') {
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
    if (bossState.fire_truth && bossState.fire_truth !== 'none') {
        const isTrue = bossState.fire_truth === 'true';
        document.getElementById(isTrue ? 'fire-resolver-true' : 'fire-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // つなみ
    if (bossState.tsunami_truth && bossState.tsunami_truth !== 'none') {
        const isTrue = bossState.tsunami_truth === 'true';
        document.getElementById(isTrue ? 'tsunami-resolver-true' : 'tsunami-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 雷床
    if (bossState.lineLightning_truth && bossState.lineLightning_truth !== 'none') {
        const isTrue = bossState.lineLightning_truth === 'true';
        document.getElementById(isTrue ? 'lineLightning-resolver-true' : 'lineLightning-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }

    // 氷床
    if (bossState.iceFan_truth && bossState.iceFan_truth !== 'none') {
        const isTrue = bossState.iceFan_truth === 'true';
        document.getElementById(isTrue ? 'iceFan-resolver-true' : 'iceFan-resolver-false').classList.add(isTrue ? 'highlight-true' : 'highlight-false');
    }
}

// --- Firebase同期受信処理 ---
onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {};
    currentState = data;
    
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
    renderUI();
});

// 自動推論ロジック (1回目と2回目で早の頭割り、遅の頭割り、早の散開、遅の散開が重複せず分配される特性を利用)
function deduceState() {
    // 1回目 (GC1) からの推論を実行可能か判定
    const canDeduceFromGC1 = bossState.gc1_truth !== 'none' && 
                             bossState.gc1_water_timing !== 'none' && 
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
        
        if (bossState.gc2_truth !== 'none') {
            if (bossState.gc2_truth === 'true') {
                bossState.gc2_water_timing = roles2.includes('ES') ? 'early' : 'late';
                bossState.gc2_lightning_timing = roles2.includes('EP') ? 'early' : 'late';
            } else {
                bossState.gc2_water_timing = roles2.includes('EP') ? 'early' : 'late';
                bossState.gc2_lightning_timing = roles2.includes('ES') ? 'early' : 'late';
            }
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

    // どちらのGCも2つ確定していないが、4つのタイミングすべてが入力済みのときの真偽値推論
    if (bossState.gc1_water_timing !== 'none' && bossState.gc1_lightning_timing !== 'none' &&
        bossState.gc2_water_timing !== 'none' && bossState.gc2_lightning_timing !== 'none') {
        
        if (bossState.gc1_truth === 'none' && bossState.gc2_truth !== 'none') {
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
        else if (bossState.gc2_truth === 'none' && bossState.gc1_truth !== 'none') {
            const r1_water = bossState.gc1_truth === 'true' 
                ? (bossState.gc1_water_timing === 'early' ? 'ES' : 'LS')
                : (bossState.gc1_water_timing === 'early' ? 'EP' : 'LP');
            const r1_lightning = bossState.gc1_truth === 'true'
                ? (bossState.gc1_lightning_timing === 'early' ? 'EP' : 'LP')
                : (bossState.gc1_lightning_timing === 'early' ? 'ES' : 'LS');
            const roles1 = [r1_water, r1_lightning];
            const all = ['ES', 'LS', 'EP', 'LP'];
            const roles2 = all.filter(r => !roles1.includes(r));
            
            const w_role_true = bossState.gc2_water_timing === 'early' ? 'ES' : 'LS';
            const l_role_true = bossState.gc2_lightning_timing === 'early' ? 'EP' : 'LP';
            if (roles2.includes(w_role_true) && roles2.includes(l_role_true)) {
                bossState.gc2_truth = 'true';
            } else {
                bossState.gc2_truth = 'false';
            }
        }
    }
}

// Firebaseのボスの真偽・タイミング状態を計算して保存する関数
function updateFirebaseState() {
    deduceState();
    
    let earlyWater = 'none';
    let lateWater = 'none';
    let earlyLightning = 'none';
    let lateLightning = 'none';
    
    // GC1 mapping
    if (bossState.gc1_truth !== 'none') {
        const isTrue = bossState.gc1_truth === 'true';
        
        // Water
        if (bossState.gc1_water_timing === 'early') {
            if (isTrue) earlyWater = 'true';
            else earlyLightning = 'false';
        } else if (bossState.gc1_water_timing === 'late') {
            if (isTrue) lateWater = 'true';
            else lateLightning = 'false';
        }
        
        // Lightning
        if (bossState.gc1_lightning_timing === 'early') {
            if (isTrue) earlyLightning = 'true';
            else earlyWater = 'false';
        } else if (bossState.gc1_lightning_timing === 'late') {
            if (isTrue) lateLightning = 'true';
            else lateWater = 'false';
        }
    }
    
    // GC2 mapping
    if (bossState.gc2_truth !== 'none') {
        const isTrue = bossState.gc2_truth === 'true';
        
        // Water
        if (bossState.gc2_water_timing === 'early') {
            if (isTrue) earlyWater = 'true';
            else earlyLightning = 'false';
        } else if (bossState.gc2_water_timing === 'late') {
            if (isTrue) lateWater = 'true';
            else lateLightning = 'false';
        }
        
        // Lightning
        if (bossState.gc2_lightning_timing === 'early') {
            if (isTrue) earlyLightning = 'true';
            else earlyWater = 'false';
        } else if (bossState.gc2_lightning_timing === 'late') {
            if (isTrue) lateLightning = 'true';
            else lateWater = 'false';
        }
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
    
    set(dbRef, currentState);
}

// ボスの真偽トグル更新関数（2回押しても解除されない）
function setBossTruth(key, value) {
    bossState[`${key}_truth`] = value;
    // 真偽値が変更された場合、そのGC自体のタイミングを再推論するため、他方のGCを優先編集ソースとする
    if (key === 'gc1') lastEditedGC = 2;
    if (key === 'gc2') lastEditedGC = 1;
    updateFirebaseState();
}

// Timingトグル更新関数（2回押すと none に戻す。水と雷は独立して設定可能）
function setBossTiming(key, value) {
    const currentVal = bossState[`${key}_timing`];
    const newVal = (currentVal === value) ? 'none' : value;
    
    bossState[`${key}_timing`] = newVal;
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
    updateFirebaseState();
});

// 初期化
loadLocalState();
renderUI();

// UIモード切り替え
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

const savedMode = localStorage.getItem('kfk_solver_ui_mode') || 'mobile';
setMode(savedMode);
