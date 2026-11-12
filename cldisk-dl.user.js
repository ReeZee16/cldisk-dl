// ==UserScript==
// @name         cldisk-dl
// @namespace    https://github.com/ReeZee16/cldisk-dl
// @version      1.4.0
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

    // =========================================================================
    // 3. 场景 A：地址栏直接访问原始 CDN 直链 (如 d0.cldisk.com/download/... 或 d0.ananas.chaoxing.com/download/...)
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
        }
        .btn-retry:hover {
            background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
            transform: translateY(-1px);
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
        <h2 id="cx-title">免流直连通道检测中</h2>
        
        <div class="file-info">
            <div class="file-name" id="cx-fname"></div>
            <div id="cx-node-info" style="font-size: 12px; color: #64748b;">目标源：国内高速 CDN 直连节点</div>
        </div>

        <div class="features">
            <div class="feature-item"><span class="ok">✔</span> 0 海外 VPN / 代理流量消耗（境内直连满速）</div>
            <div class="feature-item"><span class="ok">✔</span> 已自动注入官方节点授权认证（防 403 拦截）</div>
            <div class="feature-item"><span class="ok">✔</span> 支持浏览器原生下载与 IDM 32 线程加速</div>
        </div>

        <a id="cx-manual-btn" class="btn-retry" href="#">若未开始下载，点此手动下载</a>
        <a id="cx-fallback-btn" class="btn-fallback" href="#">直连失败？点此改用原版代理节点下载</a>
        <div class="status-hint" id="cx-status-text">⚡ 正在检测并预热国内高速 CDN 节点...</div>
    </div>
</body>
</html>
`;

        async function probeSimpleGet(url) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            try {
                // 不添加 Range 等自定义请求头，避免触发 d0.cldisk.com 的 OPTIONS 预检 403
                const resp = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });
                const ok = resp.ok;
                const status = resp.status;
                // 收到响应头后立刻中止请求，避免探测阶段拉取大文件正文
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

            if (manualBtn) manualBtn.href = rawTargetUrl;
            if (fallbackBtn && origUrl) {
                fallbackBtn.href = origUrl + (origUrl.includes('#') ? '' : '#cx_bypass=1');
            }

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
                    setTimeout(() => {
                        if (!window.closed && statusText) {
                            statusText.textContent = '✅ 已触发免流下载！下载开始后可手动关闭或离开此页。';
                        }
                    }, 300);
                }, delay);
            }

            // 构造候选 CDN 节点列表：
            // 部分旧时间戳链接在国内 ananas 节点会被火山 CDN 报 403 too old time，
            // 自动切换至同源的 d0.cldisk.com（网宿国内节点）即可满速直连放行！
            const candidates = [rawTargetUrl];
            try {
                const parsed = new URL(rawTargetUrl);
                if (/ananas\.chaoxing\.com$/i.test(parsed.hostname)) {
                    const swapped = new URL(rawTargetUrl);
                    swapped.hostname = 'd0.cldisk.com';
                    // 对于 ananas 节点，优先保留原节点在第一位还是 cldisk 在第二位均可在毫秒级探测切换
                    candidates.push(swapped.toString());
                } else if (!/^d0\.cldisk\.com$/i.test(parsed.hostname)) {
                    const swapped = new URL(rawTargetUrl);
                    swapped.hostname = 'd0.cldisk.com';
                    candidates.push(swapped.toString());
                }
            } catch (e) {}

            let activeUrl = null;
            let lastStatus = 0;

            for (let i = 0; i < candidates.length; i++) {
                const candidate = candidates[i];
                if (i > 0 && statusText) {
                    statusText.textContent = '🔄 主节点返回 403，正在自动切换国内备用 CDN 节点...';
                }
                const res = await probeSimpleGet(candidate);
                lastStatus = res.status;
                if (res.ok) {
                    activeUrl = candidate;
                    break;
                }
            }

            if (!activeUrl) {
                // 所有国内直连候选均返回 403/失败时，绝不执行 a.click() 跳转至 403 页面，彻底避免死循环
                if (titleEl) {
                    titleEl.textContent = '国内直连节点受限';
                    titleEl.style.color = '#fbbf24';
                }
                if (statusText) {
                    statusText.textContent = `⚠️ 直连探测返回 HTTP ${lastStatus || '网络异常'}，已阻断跳转以防 403 循环。请尝试点击下方代理下载按钮。`;
                    statusText.style.color = '#fbbf24';
                }
                if (fallbackBtn && origUrl) {
                    fallbackBtn.style.display = 'inline-block';
                }
                return;
            }

            // 更新最终确认可用的国内直连地址
            if (manualBtn) manualBtn.href = activeUrl;
            try {
                const activeHost = new URL(activeUrl).hostname;
                if (nodeInfoEl) nodeInfoEl.textContent = `目标源：${activeHost}（国内高速 CDN 已校验放行）`;
            } catch (e) {}
            if (titleEl) titleEl.textContent = '免流直连下载已触发';
            if (statusText) statusText.textContent = '🟢 CDN 握手成功，正在确认接管状态...';

            // 监听窗口失焦（IDM 弹窗或系统保存对话框弹出）
            window.addEventListener('blur', () => {
                safeClose(100);
            });

            // 唤起浏览器原生或 IDM 下载
            const a = document.createElement('a');
            a.href = activeUrl;
            a.setAttribute('download', '');
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                safeClose(200);
            }, 900);
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
    // 注：仅当代理站点返回 HTML 网页时可被油猴捕获；若代理直接下发二进制附件则由浏览器直接接管下载
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

        // 若链接自带跳过标记（例如降级按钮），放行
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
