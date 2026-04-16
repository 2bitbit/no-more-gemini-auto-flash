// ==UserScript==
// @name         No More Gemini Auto Flash
// @namespace    https://github.com/no-more-gemini-auto-flash
// @version      1.1.0
// @description  当 Gemini 自动切换到 Flash（快速）模型时，弹出醒目的红色警告框。后续：作者发现Thinking模式即使是解决简单问题也常常误导人，十分可恶，还是all in pro叭！
// @author       You
// @match        https://gemini.google.com/*
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log('[NMGAF] ====== No More Gemini Auto Flash v1.1.0 已启动 ======');

  const FLASH_KEYWORDS = ['快速', 'Fast', 'flash', 'Flash','Thinking','思考'];
  const ALERT_ID = 'nmgaf-flash-warning';
  const STYLE_ID = 'nmgaf-style';
  const CHECK_INTERVAL = 1000;
  let lastState = null;

  // ========== 工具函数：避免 innerHTML，全部使用 DOM API ==========

  function el(tag, styles, children) {
    const node = document.createElement(tag);
    if (styles) Object.assign(node.style, styles);
    if (children) {
      children.forEach(child => {
        if (typeof child === 'string') {
          node.appendChild(document.createTextNode(child));
        } else {
          node.appendChild(child);
        }
      });
    }
    return node;
  }

  // ========== 警告框 ==========

  function createWarningOverlay() {
    if (document.getElementById(ALERT_ID)) return;

    // 注入动画 keyframes
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = [
        '@keyframes nmgaf-pulse {',
        '  0%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(0,0,0,0.5); }',
        '  50% { transform: scale(1.03); box-shadow: 0 6px 24px rgba(255,0,0,0.6); }',
        '}'
      ].join('\n');
      if (document.head) document.head.appendChild(style);
    }

    // 警告图标
    const icon = el('div', {
      fontSize: '36px',
      marginBottom: '8px',
    }, ['\u26A0\uFE0F']); // ⚠️

    // 主标题
    const flashSpan = el('span', { textDecoration: 'underline' }, ['Flash 或 Thinking']);
    const title = el('div', {}, ['模型已切换为 ']);
    title.appendChild(flashSpan);

    // 副标题
    const subtitle = el('div', {
      fontSize: '13px',
      fontWeight: '400',
      marginTop: '8px',
      opacity: '0.85',
    }, ['请手动切回 Pro 模型，此警告将自动消失']);

    // 卡片容器
    const box = el('div', {
      pointerEvents: 'auto',
      background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
      color: '#fff',
      fontFamily: '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
      fontSize: '18px',
      fontWeight: '700',
      padding: '20px 32px',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
      textAlign: 'center',
      lineHeight: '1.5',
      maxWidth: '400px',
      animation: 'nmgaf-pulse 2s ease-in-out infinite',
    }, [icon, title, subtitle]);

    // 全屏遮罩
    const overlay = el('div', {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(50, 0, 0, 0.25)', // 半透明遮罩，移除 blur()
      pointerEvents: 'none',
      userSelect: 'none',
      transition: 'opacity 0.3s ease',
    }, [box]);
    overlay.id = ALERT_ID;

    if (document.body) document.body.appendChild(overlay);
    console.log('[NMGAF] 🔴 警告框已显示');
  }

  function removeWarningOverlay() {
    const existing = document.getElementById(ALERT_ID);
    if (existing) {
      existing.style.opacity = '0';
      setTimeout(() => existing.remove(), 300);
      console.log('[NMGAF] 🟢 警告框已移除');
    }
  }

  // ========== 检测逻辑 ==========

  function getModelLabel() {
    try {
      // 策略 A：data-test-id 精确定位
      const btn = document.querySelector('button[data-test-id="bard-mode-menu-button"]');
      if (btn) {
        const clone = btn.cloneNode(true);
        clone.querySelectorAll('mat-icon, .mat-icon').forEach(e => e.remove());
        const text = clone.textContent.trim();
        if (text) return { found: true, text, strategy: 'A' };
      }

      // 策略 B：class input-area-switch
      const btn2 = document.querySelector('button.input-area-switch');
      if (btn2) {
        const clone = btn2.cloneNode(true);
        clone.querySelectorAll('mat-icon, .mat-icon, .mat-mdc-button-persistent-ripple, .mat-focus-indicator, .mat-mdc-button-touch-target, .mat-ripple').forEach(e => e.remove());
        const text = clone.textContent.trim();
        if (text) return { found: true, text, strategy: 'B' };
      }

      // 策略 C：aria-label
      const btn3 = document.querySelector(
        'button[aria-label*="模式选择"], button[aria-label*="mode selector"], button[aria-label*="Mode"]'
      );
      if (btn3) {
        const clone = btn3.cloneNode(true);
        clone.querySelectorAll('mat-icon, .mat-icon').forEach(e => e.remove());
        const text = clone.textContent.trim();
        if (text) return { found: true, text, strategy: 'C' };
      }
    } catch (e) {
      console.error('[NMGAF] Error in getModelLabel:', e);
    }
    return { found: false, text: '', strategy: 'none' };
  }

  function isFlashModelActive() {
    const result = getModelLabel();
    const stateKey = result.found + '|' + result.text + '|' + result.strategy;
    if (stateKey !== lastState) {
      lastState = stateKey;
    }
    if (!result.found) return false;
    return FLASH_KEYWORDS.some(kw => result.text === kw);
  }

  // ========== 主循环 ==========

  function check() {
    if (isFlashModelActive()) {
      createWarningOverlay();
    } else {
      removeWarningOverlay();
    }
  }

  function init() {
    if (!document.body) {
      setTimeout(init, 500);
      return;
    }

    const observer = new MutationObserver(() => requestAnimationFrame(check));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    setInterval(check, CHECK_INTERVAL);
    setTimeout(check, 2000);
  }

  init();
})();
