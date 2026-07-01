(function () {
    // PiPウィンドウの初期サイズ。後で調整しやすいよう定数化しておく。
    const OVERLAY_WIDTH = 400;
    const OVERLAY_HEIGHT = 300;

    const btn = document.getElementById('overlay-mode-btn');
    if (!btn) return;

    if (!('documentPictureInPicture' in window)) {
        btn.disabled = true;
        btn.title = 'このブラウザはオーバーレイモードに対応していません（Chrome/Edge推奨）';
        return;
    }

    let pipWindow = null;
    let movedRoot = null;
    let originalParent = null;
    let originalNextSibling = null;

    // 既存の<link rel="stylesheet">・<style>をPiPウィンドウ側にも複製する。
    // クロスオリジンのlinkはそのままcloneして読み込ませるだけでよい（cssRulesの
    // 読み取りは行わないため、クロスオリジンでもエラーにならない）。
    function copyStylesInto(targetDoc) {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            targetDoc.head.appendChild(link.cloneNode(true));
        });
        document.querySelectorAll('style').forEach(style => {
            targetDoc.head.appendChild(style.cloneNode(true));
        });
    }

    async function enterOverlay() {
        movedRoot = document.querySelector('.hub-root');
        if (!movedRoot) return;

        originalParent = movedRoot.parentNode;
        originalNextSibling = movedRoot.nextSibling;

        try {
            pipWindow = await documentPictureInPicture.requestWindow({
                width: OVERLAY_WIDTH,
                height: OVERLAY_HEIGHT
            });
        } catch (e) {
            console.error('オーバーレイウィンドウの表示に失敗しました', e);
            originalParent = null;
            originalNextSibling = null;
            movedRoot = null;
            return;
        }

        pipWindow.document.title = document.title;
        copyStylesInto(pipWindow.document);
        pipWindow.document.body.style.margin = '0';

        // スマホ/PC表示モード（body.pc-modeクラス）は<body>自体には付いておらず
        // 移動されないため、移動時点の状態をPiPウィンドウ自身のbodyへ引き継ぐ。
        // 以後の切り替えは window.setMode 側で getActiveDocument().body を
        // 使うようにしてあるので、ここでは初期状態の同期のみでよい。
        if (document.body.classList.contains('pc-mode')) {
            pipWindow.document.body.classList.add('pc-mode');
        }

        // nav.js内のDOM参照先を、以後PiPウィンドウのdocumentへ切り替える。
        window.__overlayActiveDoc = pipWindow.document;

        // 移動後のDOM内（例: onclick="window.setPhase(...)"）から呼ばれても
        // 正しく動くよう、メインウィンドウと同じ関数オブジェクトをPiP側の
        // window にも公開しておく（関数内部のクロージャはメインウィンドウの
        // ものなので、Firebase同期処理自体はメインウィンドウのコンテキストで
        // 動き続ける）。
        pipWindow.setPhase = window.setPhase;
        pipWindow.setP4Impl = window.setP4Impl;
        pipWindow.setP2View = window.setP2View;
        pipWindow.setP5Gimmick = window.setP5Gimmick;
        pipWindow.setMode = window.setMode;
        pipWindow.setTheme = window.setTheme;
        pipWindow.getTheme = window.getTheme;

        // 実体移動（コピーではない）。
        pipWindow.document.body.appendChild(movedRoot);

        // 背景テーマ（黒/白）はPiPウィンドウ自身のdocumentにも独立して
        // 適用する必要があるため、theme.js自体をPiPウィンドウ側でも
        // 読み込む。Firebaseを使わない軽量スクリプトなので二重実行しても
        // 副作用はない。
        const themeScript = pipWindow.document.createElement('script');
        themeScript.src = 'theme.js';
        pipWindow.document.body.appendChild(themeScript);

        pipWindow.addEventListener('pagehide', exitOverlay);

        btn.textContent = 'オーバーレイ解除';
    }

    function exitOverlay() {
        if (!movedRoot) return;

        if (originalNextSibling) {
            originalParent.insertBefore(movedRoot, originalNextSibling);
        } else {
            originalParent.appendChild(movedRoot);
        }

        window.__overlayActiveDoc = null;

        movedRoot = null;
        originalParent = null;
        originalNextSibling = null;
        pipWindow = null;

        // nav.js側の表示をメインウィンドウのdocumentに合わせて再描画させる。
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'kfk_nav_local_phase',
            newValue: localStorage.getItem('kfk_nav_local_phase') || 'P1'
        }));

        btn.textContent = 'オーバーレイモード';
    }

    btn.addEventListener('click', () => {
        if (pipWindow) {
            pipWindow.close();
        } else {
            enterOverlay();
        }
    });
})();
