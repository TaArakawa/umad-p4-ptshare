/*
 * 背景色テーマ（dark/light）の共有スクリプト。
 * hub.html と各カンペアプリ（index.html=v1 / solver.html=v2 / solver-v2.html=v3）の
 * 全ページが読み込む。localStorage の 'kfk_theme' を唯一の真実として共有するため、
 * v1/v2/v3 を切り替えても（= iframe を読み直しても）選んだ色が維持される。
 *
 * light のとき body に 'theme-light' クラスを付与し、各CSSの body.theme-light で
 * CSS変数（--bg-color など）を上書きして白背景にする。
 */
(function () {
    const KEY = 'kfk_theme';

    const ss = {
        get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
    };

    function normalize(t) {
        return t === 'light' ? 'light' : 'dark';
    }

    let current = normalize(ss.get(KEY));

    function apply(theme) {
        const light = theme === 'light';
        if (document.body) {
            document.body.classList.toggle('theme-light', light);
        }
        document.documentElement.classList.toggle('theme-light', light);
        // ハブ上のトグルスイッチがあれば状態を同期する
        const toggle = document.getElementById('theme-toggle');
        if (toggle && toggle.checked !== light) {
            toggle.checked = light;
        }
    }

    window.getTheme = () => current;

    window.setTheme = (theme) => {
        current = normalize(theme);
        ss.set(KEY, current);
        apply(current);
    };

    function init() {
        apply(current);
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    // iframe（v1/v2）と親（hub）の間で確実に同期させるため localStorage をポーリング監視する。
    // 既存の kfk_shared_ui_mode と同じ手法。storage イベントだけでは取りこぼす環境があるため。
    setInterval(() => {
        const t = normalize(ss.get(KEY));
        if (t !== current) {
            current = t;
            apply(t);
        }
    }, 250);
})();
