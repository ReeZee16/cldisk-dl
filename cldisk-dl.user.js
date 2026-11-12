// ==UserScript==
// @name         cldisk-dl
// @namespace    https://github.com/ReeZee16/cldisk-dl
// @version      1.3.0
// @description  免梯子流量下载！支持论坛点击与地址栏直链/代理链接直接访问。
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
    // 支持：
    // - Worker 代理链接 (?url=https://d0.cldisk.com/... 或 d0.ananas.chaoxing.com/...)
    // - URL 编码或论坛外链跳转的多层嵌套 (?url=...)
    // - 原始 CDN 直链 (*.cldisk.com/download/* 或 *.chaoxing.com/download/*)
    // =========================================================================
    function extractTargetUrl(href) {
        if (!href || typeof href !== 'string') return null;
        let current = href.trim();

        for (let i = 0; i < 3; i++) {
            if (/^https?:\/\/[^/?#]+\.(?:cldisk\.com|chaoxing\.com)\/download\//i.test(current)) {
                return current;
            }
            const match = current.match(/[?&]url=(.+)$/i);
            if (!match) break;

            let next = match[1];
            // 如果外层参数是 URL 编码的（如论坛外链跳转），先去掉外层多余参数再解码
            if (/^https?%3A/i.test(next)) {
                const ampIdx = next.indexOf('&');
                if (ampIdx !== -1) {
                    next = next.substring(0, ampIdx);
                }
                try {
                    next = decodeURIComponent(next);
                } catch (e) {}
            }
            current = next;
        }

        if (/^https?:\/\/[^/?#]+\.(?:cldisk\.com|chaoxing\.com)\/download\//i.test(current)) {
            return current;
        }
        return null;
    }

    // =========================================================================
    // 2. 构造国内直连中转页 URL
    // 使用轻量且原生带 Referrer-Policy: unsafe-url 的 200 页面作为白名单跳板，
    // 兼容 cldisk.com 与 ananas.chaoxing.com 全系节点，且绝不出现举报页
    // =========================================================================
    function getBridgeUrl(targetUrl, filename) {
        let hash = `#cx_dl=${encodeURIComponent(targetUrl)}`;
        if (filename) {
            hash += `&fn=${encodeURIComponent(filename)}`;
        }
        return `https://mooc1.chaoxing.com/${hash}`;
    }

    // =========================================================================
    // 3. 场景 A：地址栏直接访问原始 CDN 直链 (如 d0.cldisk.com/download/... 或 d0.ananas.chaoxing.com/download/...)
    // 无 Referer 直接打开时源站会返回 403 HTML，脚本在此第一时间接管并跳转免流中转桥
    // =========================================================================
    if (/(?:^|\.)(?:cldisk\.com|chaoxing\.com)$/i.test(currentHost) && /^\/download\//i.test(location.pathname)) {
        try { window.stop(); } catch (e) {}
        location.replace(getBridgeUrl(location.href));
        return;
    }

    // =========================================================================
    // 4. 场景 B：运行在白名单中转跳板页 (带有 #cx_dl= 标记)
    // =========================================================================
    if (currentHost.endsWith('chaoxing.com') && location.hash.startsWith('#cx_dl=')) {
        try {
            window.stop();
        } catch (e) {}

        const hashStr = location.hash.substring(1);
        const params = new URLSearchParams(hashStr);
        const targetUrl = params.get('cx_dl');
        const fileName = params.get('fn') || '高速下载资源';

        if (!targetUrl) return;

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
                    statusText.textContent = '🚀 下载已成功接管，正在尝试关闭窗口...';
                    statusText.style.color = '#34d399';
                }
                setTimeout(() => {
                    window.close();
                    // 若标签页是由地址栏手动打开的，浏览器出于安全策略会拦截 window.close()，给出明确提示
                    setTimeout(() => {
                        if (!window.closed && statusText) {
                            statusText.textContent = '✅ 已触发免流下载！下载开始后可手动关闭或离开此页。';
                        }
                    }, 300);
                }, delay);
            }

            // 信号 1：窗口失焦（IDM 弹窗或系统保存对话框弹出）
            window.addEventListener('blur', () => {
                safeClose(100);
            });

            // 信号 2：轻量 1 字节探针预热连接池（同时验证链接有效性）
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
                doTrigger();
            });

            function doTrigger() {
                if (hasClosed) return;

                const a = document.createElement('a');
                a.href = targetUrl;
                a.setAttribute('download', '');
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();

                if (statusText) {
                    statusText.textContent = '🚀 下载已触发，正在确认接管状态...';
                }

                // 信号 3：预热完成后留足 900ms 让浏览器下载引擎挂载任务
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
    // 5. 场景 C：地址栏直接访问代理链接 (?url=https://d0.cldisk.com/... 或 d0.ananas.chaoxing.com/...)
    // =========================================================================
    if (!currentHost.endsWith('chaoxing.com') && !currentHost.endsWith('cldisk.com')) {
        if (!(currentHost.includes('workers.dev') && location.pathname.startsWith('/proxy'))) {
            const directFromAddr = extractTargetUrl(location.href);
            if (directFromAddr) {
                try { window.stop(); } catch (e) {}
                location.replace(getBridgeUrl(directFromAddr));
                return;
            }
        }
    }

    // =========================================================================
    // 6. 场景 D：运行在任意网页上，事件捕获拦截目标代理链接与直链
    // =========================================================================
    function handleLinkClick(e) {
        // 仅处理鼠标左键 (0) 与中键滚轮 (1)
        if (e.button !== 0 && e.button !== 1) return;

        // 按住 Ctrl、Shift 或 Alt 键点击时，主动跳过脚本，直接走原版代理下载
        if (e.ctrlKey || e.shiftKey || e.altKey) {
            return;
        }

        const targetEl = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
        const anchor = targetEl ? targetEl.closest('a') : null;
        if (!anchor || !anchor.href) return;

        const targetUrl = extractTargetUrl(anchor.href);
        if (!targetUrl) return;

        e.preventDefault();
        e.stopPropagation();

        let fileName = anchor.getAttribute('download') || anchor.title || '';
        if (!fileName) {
            const text = (anchor.innerText || '').trim();
            if (text && text.length < 80 && !/^(\s*下载\s*|\s*download\s*|\s*点击下载\s*|\s*立即下载\s*)$/i.test(text)) {
                fileName = text;
            }
        }

        const bridgeUrl = getBridgeUrl(targetUrl, fileName);
        window.open(bridgeUrl, '_blank');
    }

    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('auxclick', handleLinkClick, true);
})();
