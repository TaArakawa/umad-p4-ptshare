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

// 最後に編集したGC (1 または 2)
let lastEditedGC = null;

// 自動推論ロジック (solver-v2 と同一)
function deduceState() {
    const canDeduceFromGC1 = bossState.gc1_truth !== 'none' && 
                             bossState.gc1_water_timing !== 'none' && 
                             bossState.gc1_lightning_timing !== 'none';
                             
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

// Firebaseのボスの真偽・タイミング状態を計算して保存する関数 (solver-v2 と同一)
function updateFirebaseState() {
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
    
    set(dbRef, currentState);
}

let lastState = {};

function triggerPulse(element) {
    if (!element) return;
    element.classList.remove('pulse-update');
    void element.offsetWidth; // 強制再描画
    element.classList.add('pulse-update');
}

// サーバーデータのリアルタイム監視・同期
onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {};
    currentState = data;

    // GC1/GC2 状態の復元
    bossState.gc1_water_timing = data.gc1WaterTiming || 'none';
    bossState.gc1_lightning_timing = data.gc1LightningTiming || 'none';
    bossState.gc2_water_timing = data.gc2WaterTiming || 'none';
    bossState.gc2_lightning_timing = data.gc2LightningTiming || 'none';
    
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

    Object.keys(rules).forEach(key => {
        if (key === 'bomb') return; // 加速度爆弾は同期スキップ

        const value = currentState[key]; // 推論済みの currentState から値を反映
        const card = document.getElementById(`card-${key}`);
        const resText = document.getElementById(`res-${key}`);
        if (!card) return;

        // 値に変更があった場合にパルスを走らせる（初回読み込み時は除外）
        const oldValue = lastState[key];
        if (oldValue !== undefined && oldValue !== value) {
            triggerPulse(card);
        }

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

    // 次回比較用に保存
    lastState = { ...currentState };

    // タイムラインを更新
    updateTimeline();
});

// 共有ボタンが押されたときの処理 (Timelineの各入力からGC1/GC2状態へマッピング)
window.setDecision = function (key, status) {
    let keysToSet = [key];
    if (key === 'earlyWater' || key === 'earlyLightning') {
        keysToSet = ['earlyWater', 'earlyLightning'];
    } else if (key === 'lateWater' || key === 'lateLightning') {
        keysToSet = ['lateWater', 'lateLightning'];
    }

    let changed = false;
    keysToSet.forEach(k => {
        if (currentState[k] === status) return;
        changed = true;

        if (k === 'earlyEye') {
            bossState.gc1_truth = status;
            lastEditedGC = 2; // 真偽値の変更時は他方を優先編集ソースとして再推論
        } else if (k === 'lateEye') {
            bossState.gc2_truth = status;
            lastEditedGC = 1;
        } else if (k === 'fire') {
            bossState.fire_truth = status;
        } else if (k === 'water') {
            bossState.tsunami_truth = status;
        } else if (k === 'lineLightning') {
            bossState.lineLightning_truth = status;
        } else if (k === 'iceFan') {
            bossState.iceFan_truth = status;
        } else {
            const g1 = bossState.gc1_truth;
            const g2 = bossState.gc2_truth;
            if (g1 !== 'none' && g2 !== 'none') {
                if (k === 'earlyWater') {
                    if (g1 === status) { // GC1
                        if (g1 === 'true') bossState.gc1_water_timing = 'early';
                        else bossState.gc1_lightning_timing = 'early';
                        if (g2 === 'true') bossState.gc2_water_timing = 'late';
                        else bossState.gc2_lightning_timing = 'late';
                        lastEditedGC = 1;
                    } else { // GC2
                        if (g2 === 'true') bossState.gc2_water_timing = 'early';
                        else bossState.gc2_lightning_timing = 'early';
                        if (g1 === 'true') bossState.gc1_water_timing = 'late';
                        else bossState.gc1_lightning_timing = 'late';
                        lastEditedGC = 2;
                    }
                } else if (k === 'lateWater') {
                    if (g1 === status) { // GC1
                        if (g1 === 'true') bossState.gc1_water_timing = 'late';
                        else bossState.gc1_lightning_timing = 'late';
                        if (g2 === 'true') bossState.gc2_water_timing = 'early';
                        else bossState.gc2_lightning_timing = 'early';
                        lastEditedGC = 1;
                    } else { // GC2
                        if (g2 === 'true') bossState.gc2_water_timing = 'late';
                        else bossState.gc2_lightning_timing = 'late';
                        if (g1 === 'true') bossState.gc1_water_timing = 'early';
                        else bossState.gc1_lightning_timing = 'early';
                        lastEditedGC = 2;
                    }
                } else if (k === 'earlyLightning') {
                    if (g1 === status) { // GC1
                        if (g1 === 'true') bossState.gc1_lightning_timing = 'early';
                        else bossState.gc1_water_timing = 'early';
                        if (g2 === 'true') bossState.gc2_lightning_timing = 'late';
                        else bossState.gc2_water_timing = 'late';
                        lastEditedGC = 1;
                    } else { // GC2
                        if (g2 === 'true') bossState.gc2_lightning_timing = 'early';
                        else bossState.gc2_water_timing = 'early';
                        if (g1 === 'true') bossState.gc1_lightning_timing = 'late';
                        else bossState.gc1_water_timing = 'late';
                        lastEditedGC = 2;
                    }
                } else if (k === 'lateLightning') {
                    if (g1 === status) { // GC1
                        if (g1 === 'true') bossState.gc1_lightning_timing = 'late';
                        else bossState.gc1_water_timing = 'late';
                        if (g2 === 'true') bossState.gc2_lightning_timing = 'early';
                        else bossState.gc2_water_timing = 'early';
                        lastEditedGC = 1;
                    } else { // GC2
                        if (g2 === 'true') bossState.gc2_lightning_timing = 'late';
                        else bossState.gc2_water_timing = 'late';
                        if (g1 === 'true') bossState.gc1_lightning_timing = 'early';
                        else bossState.gc1_water_timing = 'early';
                        lastEditedGC = 2;
                    }
                }
            } else {
                // 真偽値がまだ揃っていない場合は、Timeline互換キーへ直接書き込んでサーバーに送信
                currentState[k] = status;
            }
        }
    });

    if (!changed) return;

    // 真偽値がまだ揃っていない状態での直接保存
    const g1 = bossState.gc1_truth;
    const g2 = bossState.gc2_truth;
    if (g1 === 'none' || g2 === 'none') {
        set(dbRef, currentState);
        return;
    }

    updateFirebaseState();
};

// 一括リセット処理
document.getElementById('resetBtn').addEventListener('click', () => {
    const resetData = {};
    Object.keys(rules).forEach(key => {
        if (key !== 'bomb') resetData[key] = "none";
    });
    
    // GC1/GC2 状態の明示的なリセット
    resetData.gc1Truth = "none";
    resetData.gc2Truth = "none";
    resetData.gc1WaterTiming = "none";
    resetData.gc1LightningTiming = "none";
    resetData.gc2WaterTiming = "none";
    resetData.gc2LightningTiming = "none";
    resetData.lastEditedGC = null;
    resetData.resetTime = Date.now();

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

    if (mode === 'hud' || mode === 'pc') {
        document.body.classList.add('hud-mode');
        btnMobile.classList.remove('active');
        btnHud.classList.add('active');
        localStorage.setItem('kfk_shared_ui_mode', 'pc');
    } else {
        document.body.classList.remove('hud-mode');
        btnMobile.classList.add('active');
        btnHud.classList.remove('active');
        localStorage.setItem('kfk_shared_ui_mode', 'mobile');
    }
};

// ページ読み込み時に保存されたモードを復元
const savedMode = localStorage.getItem('kfk_shared_ui_mode') || localStorage.getItem('kfk_ui_mode') || 'mobile';
setMode(savedMode);

// 別タブ間でのリアルタイム切り替え同期
window.addEventListener('storage', (e) => {
    if (e.key === 'kfk_shared_ui_mode') {
        setMode(e.newValue || 'mobile');
    }
});

// 初期表示用タイムライン描画
updateTimeline();
