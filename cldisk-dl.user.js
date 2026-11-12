// ==UserScript==
// @name         cldisk-dl
// @namespace    https://github.com/ReeZee16/cldisk-dl
// @version      1.4.3
// @description  免梯子流量下载！支持论坛点击与地址栏直链直接访问，自动容灾切换国内高速节点。
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
        let current = href.trim();

        for (let i = 0; i < 3; i++) {
            if (/^https?:\/\/[^/?#]+\.(?:cldisk\.com|chaoxing\.com)\/download\//i.test(current)) {
                return current;
            }
            const match = current.match(/[?&]url=(.+)$/i);
            if (!match) break;

            let next = match[1];
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
    // 使用轻量且原生带 Referrer-Policy: unsafe-url 的 200 页面作为白名单跳板
    // =========================================================================
    function getBridgeUrl(targetUrl, filename, origUrl) {
        let hash = `#cx_dl=${encodeURIComponent(targetUrl)}`;
        if (filename) {
            hash += `&fn=${encodeURIComponent(filename)}`;
        }
        if (origUrl && origUrl !== targetUrl) {
            hash += `&orig=${encodeURIComponent(origUrl)}`;
        }
        return `https://mooc1.chaoxing.com/${hash}`;
    }

    // Worker 方案 A 作为脚本直连失败或浏览器未能启动下载时的手动兜底。
    // 对完整目标地址编码，确保 at_/ak_/ad_ 等 & 参数原样到达 Worker 并由其解码。
    function getWorkerUrl(targetUrl) {
        return `https://cldisk-dl.ttjfb.workers.dev/?url=${encodeURIComponent(targetUrl)}`;
    }

    // =========================================================================
    // 3. 场景 A：地址栏直接访问原始 CDN 直链
    // 加设 sessionStorage 防循环锁，彻底杜绝 403 反复横跳
    // =========================================================================
    if (/(?:^|\.)(?:cldisk\.com|chaoxing\.com)$/i.test(currentHost) && /^\/download\//i.test(location.pathname)) {
        const loopKey = 'cx_bridge_tried_' + location.pathname;
        const lastTried = Number(sessionStorage.getItem(loopKey) || 0);
        if (Date.now() - lastTried < 15000) {
            return;
        }
        sessionStorage.setItem(loopKey, String(Date.now()));
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
        const rawTargetUrl = params.get('cx_dl');
        const fileName = params.get('fn') || '高速下载资源';
        const origUrl = params.get('orig') || '';

        if (!rawTargetUrl) return;

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
            margin-top: 12px;
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
            font: inherit;
        }
        .btn-retry:hover {
            background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
            transform: translateY(-1px);
        }
        .btn-retry:disabled {
            opacity: 0.55;
            cursor: wait;
            transform: none;
        }
        .btn-fallback {
            display: none;
            width: 100%;
            margin-top: 10px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.08);
            color: #e2e8f0;
            text-decoration: none;
            border-radius: 10px;
            font-size: 13px;
            border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .btn-fallback:hover {
            background: rgba(255, 255, 255, 0.14);
        }
        .status-hint {
            margin-top: 16px;
            font-size: 13px;
            color: #38bdf8;
            font-weight: 500;
            transition: color 0.3s;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">⚡</div>
        <h2 id="cx-title">免流直连下载准备中</h2>
        
        <div class="file-info">
            <div class="file-name" id="cx-fname"></div>
            <div id="cx-node-info" style="font-size: 12px; color: #64748b;">目标源：国内高速 CDN 直连节点</div>
        </div>

        <div class="features">
            <div class="feature-item"><span class="ok">✔</span> 0 海外 VPN / 代理流量消耗（境内直连满速）</div>
            <div class="feature-item"><span class="ok">✔</span> 直连未能启动时可使用代理流量重试</div>
            <div class="feature-item"><span class="ok">✔</span> 支持浏览器原生下载与 IDM 32 线程加速</div>
        </div>

        <button id="cx-manual-btn" class="btn-retry" type="button" disabled>重试免流</button>
        <a id="cx-fallback-btn" class="btn-fallback" href="#" target="_blank" rel="noopener">用代理流量重试（会消耗代理流量）</a>
        <div class="status-hint" id="cx-status-text">⚡ 正在检查免代理直连节点...</div>
    </div>
</body>
</html>
`;

        async function probeSimpleGet(url) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            try {
                const resp = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });
                const ok = resp.ok;
                const status = resp.status;
                controller.abort();
                clearTimeout(timeoutId);
                return { ok, status };
            } catch (e) {
                clearTimeout(timeoutId);
                return { ok: false, status: 0 };
            }
        }

        const renderAndDownload = async () => {
            document.documentElement.innerHTML = bridgeHtml;

            const fnameEl = document.getElementById('cx-fname');
            if (fnameEl) fnameEl.textContent = fileName;

            const titleEl = document.getElementById('cx-title');
            const nodeInfoEl = document.getElementById('cx-node-info');
            const statusText = document.getElementById('cx-status-text');
            const manualBtn = document.getElementById('cx-manual-btn');
            const fallbackBtn = document.getElementById('cx-fallback-btn');

            if (fallbackBtn) {
                fallbackBtn.href = getWorkerUrl(rawTargetUrl);
                fallbackBtn.style.display = 'inline-block';
            }

            let hasClosed = false;
            let downloadTriggered = false;
            let downloadHandoffDetected = false;
            let closeTimer = null;
            let closeAt = 0;

            function safeClose(delay = 200) {
                if (hasClosed) return;
                hasClosed = true;
                if (closeTimer) clearTimeout(closeTimer);
                setTimeout(() => window.close(), delay);
            }

            function scheduleClose(delay) {
                if (hasClosed) return;
                closeAt = Date.now() + delay;
                if (closeTimer) clearTimeout(closeTimer);
                closeTimer = setTimeout(() => safeClose(0), delay);
            }

            function startWorkerFallback(message) {
                if (titleEl) titleEl.textContent = '正在使用代理流量重试';
                if (statusText) statusText.textContent = message || '正在自动使用代理流量重试下载。';
                location.assign(getWorkerUrl(rawTargetUrl));
                // 留出时间让用户看到自动切换提示；Worker 返回附件时页面本身通常不会导航离开。
                setTimeout(() => safeClose(0), 3000);
            }

            function detectDownloadHandoff() {
                if (!downloadTriggered || hasClosed || downloadHandoffDetected) return;
                downloadHandoffDetected = true;
                if (titleEl) titleEl.textContent = '下载器已接管';
                if (statusText) statusText.textContent = '检测到窗口焦点切换，下载应该已经开始，正在关闭此页面。';
                safeClose(200);
            }

            // IDM 等外部下载器接管时，浏览器通常会让页面失焦；下载触发前不监听，避免探测阶段误判。
            window.addEventListener('blur', detectDownloadHandoff);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') detectDownloadHandoff();
            });

            // 构造候选节点列表
            const candidates = [rawTargetUrl];
            try {
                const parsed = new URL(rawTargetUrl);
                if (!/^d0\.cldisk\.com$/i.test(parsed.hostname)) {
                    const swapped = new URL(rawTargetUrl);
                    swapped.hostname = 'd0.cldisk.com';
                    candidates.push(swapped.toString());
                }
            } catch (e) {}

            let activeUrl = null;
            let lastStatus = 0;
            let hadNetworkAbort = false;
            let lastTriedUrl = rawTargetUrl;

            for (let i = 0; i < candidates.length; i++) {
                if (hasClosed) {
                    safeClose(350);
                    return;
                }
                const candidate = candidates[i];
                lastTriedUrl = candidate;
                const res = await probeSimpleGet(candidate);
                if (hasClosed) {
                    safeClose(350);
                    return;
                }

                lastStatus = res.status;
                if (res.ok) {
                    activeUrl = candidate;
                    break;
                }
                if (res.status === 0) {
                    hadNetworkAbort = true;
                }
            }

            // 若探测被中断 (status: 0)，可能是网络限制或下载扩展拦截，短暂等待后继续尝试直连。
            if (!activeUrl && hadNetworkAbort) {
                if (statusText) statusText.textContent = '⚡ 探测请求未返回，正在继续尝试直连...';
                await new Promise((r) => setTimeout(r, 450));
                if (hasClosed) {
                    safeClose(350);
                    return;
                }
            }

            // 仅当最后一个节点未返回明确的 4xx/5xx HTTP 错误时，才用优选节点触发一次原生下载
            if (!activeUrl && lastStatus < 400) {
                activeUrl = lastTriedUrl;
            }

            if (!activeUrl) {
                // 仅在所有国内节点均明确返回 HTTP 403/404 时才提示改用代理，绝不触发 403 死循环
                if (titleEl) {
                    titleEl.textContent = '免流直连节点不可用';
                    titleEl.style.color = '#fbbf24';
                }
                if (statusText) {
                    statusText.textContent = `直连节点返回 HTTP ${lastStatus}，可以点击下方按钮使用代理流量重试。`;
                    statusText.style.color = '#cbd5e1';
                }
                startWorkerFallback('直连节点不可用，正在自动使用代理流量重试下载。');
                return;
            }

            // 更新确认可用的直连地址并触发下载
            try {
                const activeHost = new URL(activeUrl).hostname;
                if (nodeInfoEl) nodeInfoEl.textContent = `目标源：${activeHost}（国内高速 CDN 已就绪）`;
            } catch (e) {}
            if (titleEl) {
                titleEl.textContent = '下载已开始';
                titleEl.style.color = '#38bdf8';
            }
            if (statusText) {
                statusText.textContent = '🟢 正在启动免流下载...';
                statusText.style.color = '#38bdf8';
            }

            function triggerDirectDownload() {
                const directLink = document.createElement('a');
                directLink.href = activeUrl;
                directLink.setAttribute('download', '');
                directLink.style.display = 'none';
                document.body.appendChild(directLink);
                downloadTriggered = true;
                directLink.click();
            }

            if (manualBtn) {
                manualBtn.disabled = false;
                manualBtn.addEventListener('click', () => {
                    if (manualBtn.disabled || hasClosed) return;
                    manualBtn.disabled = true;
                    try {
                        triggerDirectDownload();
                        if (titleEl) titleEl.textContent = '已重新开始免流下载';
                        if (statusText) statusText.textContent = '已重新发起免流下载；如未开始，可使用代理流量重试。';
                    } catch (e) {
                        if (statusText) statusText.textContent = '免流重试未能启动；请使用代理流量重试。';
                    }
                    closeAt += 2000;
                    scheduleClose(Math.max(0, closeAt - Date.now()));
                    setTimeout(() => {
                        if (!hasClosed) manualBtn.disabled = false;
                    }, 1250);
                });
            }

            if (fallbackBtn) {
                fallbackBtn.addEventListener('click', () => {
                    if (titleEl) titleEl.textContent = '正在使用代理流量重试';
                    if (statusText) statusText.textContent = '已打开代理流量下载；正在关闭此页面。';
                    setTimeout(() => safeClose(0), 200);
                });
            }

            try {
                triggerDirectDownload();
            } catch (e) {
                if (titleEl) titleEl.textContent = '浏览器未能启动直连下载';
                startWorkerFallback('浏览器未能启动免代理下载，正在使用代理流量重试。');
                return;
            }

            // IDM 接管信号可随时关闭页面；没有信号时，1 秒后提示重试，并在 3 秒时自动关闭。
            scheduleClose(3000);
            setTimeout(() => {
                if (hasClosed || downloadHandoffDetected) return;
                if (titleEl) titleEl.textContent = '请确认下载是否已开始';
                if (statusText) statusText.textContent = '下载应该已经开始。请检查 IDM 或浏览器；需要重试时可选“重试免流”或“用代理流量重试”。';
            }, 1000);
        };

        if (document.documentElement) {
            renderAndDownload();
        } else {
            document.addEventListener('DOMContentLoaded', renderAndDownload);
        }
        return;
    }

    // =========================================================================
    // 5. 场景 C：地址栏直接访问代理链接 (?url=...)
    // =========================================================================
    if (!currentHost.endsWith('chaoxing.com') && !currentHost.endsWith('cldisk.com')) {
        const bypass = location.hash.includes('cx_bypass=1') || location.pathname.startsWith('/proxy');
        if (!bypass) {
            const directFromAddr = extractTargetUrl(location.href);
            if (directFromAddr) {
                try { window.stop(); } catch (e) {}
                location.replace(getBridgeUrl(directFromAddr, '', location.href));
                return;
            }
        }
    }

    // =========================================================================
    // 6. 场景 D：运行在任意网页上，事件捕获拦截目标代理链接与直链
    // =========================================================================
    function handleLinkClick(e) {
        if (e.button !== 0 && e.button !== 1) return;

        // 按住 Ctrl、Shift 或 Alt 键点击时，主动跳过脚本，直接走原版代理下载
        if (e.ctrlKey || e.shiftKey || e.altKey) {
            return;
        }

        const targetEl = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
        const anchor = targetEl ? targetEl.closest('a') : null;
        if (!anchor || !anchor.href) return;

        if (anchor.href.includes('#cx_bypass=1')) return;

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

        const bridgeUrl = getBridgeUrl(targetUrl, fileName, anchor.href);
        window.open(bridgeUrl, '_blank');
    }

    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('auxclick', handleLinkClick, true);
})();
