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

onValue(navRef, (snap) => {
    const phase = (snap.val() && snap.val().phase) || 'P1';
    document.getElementById('view-p1').style.display = (phase === 'P1') ? '' : 'none';
    document.getElementById('view-p3').style.display = (phase === 'P3') ? '' : 'none';
    document.getElementById('view-p4').style.display = (phase === 'P4') ? '' : 'none';
    document.querySelectorAll('.phase-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.phase === phase));
});
