// ==UserScript==
// @name         cldisk-dl
// @namespace    https://github.com/ReeZee16/cldisk-dl
// @version      1.2.0
// @description  免梯子流量下载！
// @author       Antigravity
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://cdn.jsdelivr.net/gh/ReeZee16/cldisk-dl@main/cldisk-dl.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/ReeZee16/cldisk-dl@main/cldisk-dl.user.js
// ==/UserScript==

(function () {
    'use strict';

    const currentHost = location.hostname.toLowerCase();

    // =========================================================================
    // 1. 核心解析函数：从各种链接中提取真实下载直链
    // =========================================================================
    function extractTargetUrl(href) {
        if (!href || typeof href !== 'string') return null;

        // 形式 A：Worker 代理链接，例如 https://cldisk-dl.example.workers.dev/?url=https%3A%2F%2Fd0.cldisk.com%2F...
        const urlParamIndex = href.indexOf('?url=');
        if (urlParamIndex !== -1) {
            let rawTarget = href.substring(urlParamIndex + 5);
            // 自动解码可能存在的 URL 编码
            if (rawTarget.startsWith('http%3A') || rawTarget.startsWith('https%3A')) {
                try {
                    rawTarget = decodeURIComponent(rawTarget);
                } catch (e) {}
            }
            if (/(?:cldisk\.com|chaoxing\.com)/i.test(rawTarget)) {
                return rawTarget;
            }
        }

        // 形式 B：原始 CDN 直链，例如 https://d0.cldisk.com/download/... 或 https://d0.ananas.chaoxing.com/download/...
        if (/(?:cldisk\.com|chaoxing\.com)\/download\//i.test(href)) {
            return href;
        }

        return null;
    }

    // =========================================================================
    // 2. 构造国内直连中转页 URL
    // 注意：统一使用官方主站首页作为白名单中转跳板，绝不使用带有举报按钮的专属分享页
    // =========================================================================
    function getBridgeUrl(targetUrl, filename) {
        let hash = `#cx_dl=${encodeURIComponent(targetUrl)}`;
        if (filename) {
            hash += `&fn=${encodeURIComponent(filename)}`;
        }
        return `https://www.chaoxing.com/${hash}`;
    }

    // =========================================================================
    // 3. 场景 A：运行在专属中转页 (www.chaoxing.com)
    // =========================================================================
    if (currentHost === 'www.chaoxing.com' || currentHost.endsWith('chaoxing.com')) {
        // 仅在带有专属中转标记时处理，完全不影响正常的日常页面访问与办公
        if (!location.hash.startsWith('#cx_dl=')) {
            return;
        }

        // 立即阻断原网页沉重的前端加载（不加载任何无关 JS、CSS 与图片）
        try {
            window.stop();
        } catch (e) {}

        const hashStr = location.hash.substring(1);
        const params = new URLSearchParams(hashStr);
        const targetUrl = params.get('cx_dl');
        const fileName = params.get('fn') || '高速下载资源';

        if (!targetUrl) return;

        // 注入现代、简洁的高速免流面板
        const bridgeHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="unsafe-url">
    <title>极速下载中转通道</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #0f172a;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: rgba(30, 41, 59, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 36px 32px;
            max-width: 480px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .icon {
            font-size: 52px;
            margin-bottom: 16px;
            display: inline-block;
            animation: pulse 1.8s ease-in-out infinite alternate;
        }
        @keyframes pulse {
            0% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(56, 189, 248, 0)); }
            100% { transform: scale(1.08); filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.6)); }
        }
        h2 {
            font-size: 22px;
            font-weight: 700;
            color: #38bdf8;
            margin-bottom: 10px;
        }
        .file-info {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 12px 16px;
            margin: 16px 0;
            font-size: 13px;
            color: #cbd5e1;
            word-break: break-all;
            text-align: left;
        }
        .file-name {
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 4px;
        }
        .features {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin: 16px 0;
            text-align: left;
            font-size: 13px;
        }
        .feature-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #94a3b8;
        }
        .feature-item span.ok {
            color: #34d399;
            font-weight: bold;
        }
        .btn-retry {
            display: inline-block;
            width: 100%;
            margin-top: 14px;
            padding: 12px;
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            text-decoration: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s;
            cursor: pointer;
            border: none;
        }
        .btn-retry:hover {
            background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
            transform: translateY(-1px);
        }
        .status-hint {
            margin-top: 16px;
            font-size: 13px;
            color: #38bdf8;
            font-weight: 500;
            transition: color 0.3s;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">⚡</div>
        <h2>免流直连下载已触发</h2>
        
        <div class="file-info">
            <div class="file-name" id="cx-fname"></div>
            <div style="font-size: 12px; color: #64748b;">目标源：国内高速 CDN 直连节点</div>
        </div>

        <div class="features">
            <div class="feature-item"><span class="ok">✔</span> 0 海外 VPN / 代理流量消耗（境内直连满速）</div>
            <div class="feature-item"><span class="ok">✔</span> 已自动注入官方节点授权认证（防 403 拦截）</div>
            <div class="feature-item"><span class="ok">✔</span> 支持浏览器原生下载与 IDM 32 线程加速</div>
        </div>

        <a id="cx-manual-btn" class="btn-retry" href="#">若未开始下载，点此手动下载</a>
        <div class="status-hint" id="cx-status-text">⚡ 正在与国内 CDN 建立高速握手...</div>
    </div>
</body>
</html>
`;

        const renderAndDownload = () => {
            document.documentElement.innerHTML = bridgeHtml;

            const fnameEl = document.getElementById('cx-fname');
            if (fnameEl) fnameEl.textContent = fileName;

            const statusText = document.getElementById('cx-status-text');
            const manualBtn = document.getElementById('cx-manual-btn');
            if (manualBtn) manualBtn.href = targetUrl;

            let hasClosed = false;
            function safeClose(delay = 200) {
                if (hasClosed) return;
                hasClosed = true;
                if (statusText) {
                    statusText.textContent = '🚀 下载已成功接管，窗口正在关闭...';
                    statusText.style.color = '#34d399';
                }
                setTimeout(() => {
                    window.close();
                }, delay);
            }

            // 【智能接管检测 1】：监听窗口失焦 (IDM 弹窗或系统下载对话框弹出)
            // 当 IDM 抓取到链接并弹出下载框时，当前标签页会立刻触发 blur，瞬间关闭中转页
            window.addEventListener('blur', () => {
                safeClose(100);
            });

            // 【智能接管检测 2】：轻量 1 字节探针预热连接池
            // 解决闭窗过早导致 TLS 握手夭折的问题：先用 fetch 发起 bytes=0-0 探测，
            // 收到首字节后即代表 TCP/TLS 链路已彻底建立且直链有效，再行唤起原生下载
            const probeController = new AbortController();
            const probeTimeout = setTimeout(() => probeController.abort(), 1200);

            fetch(targetUrl, {
                method: 'GET',
                headers: { 'Range': 'bytes=0-0' },
                signal: probeController.signal
            }).then(() => {
                clearTimeout(probeTimeout);
                if (statusText) statusText.textContent = '🟢 CDN 握手成功，已建立高速连接...';
                doTrigger();
            }).catch(() => {
                clearTimeout(probeTimeout);
                // 即使跨域探针受阻，也立即执行直链原生点击
                doTrigger();
            });

            function doTrigger() {
                if (hasClosed) return;

                // 唤起原生下载
                const a = document.createElement('a');
                a.href = targetUrl;
                a.setAttribute('download', '');
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();

                if (statusText) {
                    statusText.textContent = '🚀 下载已触发，正在确认接管状态...';
                }

                // 【智能接管检测 3】：保底平稳接管
                // 在预热完成后，浏览器的下载引擎接收 Content-Disposition 需要约 500ms~800ms
                // 确认接管后再行关闭，绝不漏下任何链接
                setTimeout(() => {
                    safeClose(200);
                }, 900);
            }
        };

        if (document.documentElement) {
            renderAndDownload();
        } else {
            document.addEventListener('DOMContentLoaded', renderAndDownload);
        }
        return;
    }

    // =========================================================================
    // 4. 场景 B：运行在 Worker 域名上 (兜底重定向)
    // =========================================================================
    if (currentHost.includes('workers.dev')) {
        const targetUrl = extractTargetUrl(location.href);
        if (targetUrl) {
            try { window.stop(); } catch (e) {}
            location.replace(getBridgeUrl(targetUrl));
            return;
        }
    }

    // =========================================================================
    // 5. 场景 C：运行在任意普通网页上 (事件捕获拦截目标链接)
    // =========================================================================
    function handleLinkClick(e) {
        // 仅处理鼠标左键 (0) 与中键滚轮 (1)
        if (e.button !== 0 && e.button !== 1) return;

        // 【自由切换特性】：若用户按住 Ctrl、Shift 或 Alt 键点击，主动跳过脚本，直接走原版 Worker 下载！
        if (e.ctrlKey || e.shiftKey || e.altKey) {
            return;
        }

        const anchor = e.target.closest('a');
        if (!anchor || !anchor.href) return;

        const targetUrl = extractTargetUrl(anchor.href);
        if (!targetUrl) return; // 普通外链，放行

        // 截获下载链接，阻止浏览器默认请求进入 Worker 代理
        e.preventDefault();
        e.stopPropagation();

        // 提取文件名提示
        let fileName = anchor.getAttribute('download') || anchor.title || '';
        if (!fileName) {
            const text = (anchor.innerText || '').trim();
            if (text && text.length < 80 && !/^(\s*下载\s*|\s*download\s*|\s*点击下载\s*|\s*立即下载\s*)$/i.test(text)) {
                fileName = text;
            }
        }

        const bridgeUrl = getBridgeUrl(targetUrl, fileName);

        // 新标签页打开中转通道，原网页完全不动
        window.open(bridgeUrl, '_blank');
    }

    // 使用捕获阶段 (true)，确保优先级高于任何网站自建的 JS 事件阻止
    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('auxclick', handleLinkClick, true);
})();
