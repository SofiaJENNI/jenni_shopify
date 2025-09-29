(() => {
  const JenniEdge = {
    config: { apiBase: '', tenant: 'demo', zip: '', selector: 'body', autoRefresh: true, autoOpenPanel: true, debug: false, forceMock: false, position: 'bottom-right', offsetX: 16, offsetY: 20, keepOpenOnRefresh: true, requestTimeoutMs: 10000, mockData: { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 } },
  state: { data: null, nodes: [], panelOpen: false, panelEl: null, openedOnce: false, lastHref: '', lastSig: '', refreshTimer: null, inFlightAbort: null, inFlightTimer: null, sigDebounceTimer: null, pollTimer: null },

    async init(opts = {}) {
      this.config = { ...this.config, ...opts };
      
      // Auto-detect ZIP code if not provided
      if (!this.config.zip) {
        this.config.zip = await this.detectZipByIP();
      }
      
      this.injectStyles();
      this.installWatchers();
      this.run();
      return this;
    },

    // Auto-detect ZIP code using IP-based detection only
    async detectZipByIP() {
      try {
        if (this.config.debug) { try { console.log('[JenniEdge] Starting IP-based ZIP detection'); } catch {} }
        
        // Check localStorage first
        const stored = localStorage.getItem('jenni_zip_preference');
        if (stored && /^\d{5}$/.test(stored)) {
          if (this.config.debug) { try { console.log('[JenniEdge] Using stored ZIP:', stored); } catch {} }
          return stored;
        }

        // Try IP-based detection
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) throw new Error('IP API failed');
        
        const data = await response.json();
        const zip = data.postal?.replace(/\D/g, '').slice(0, 5);
        
        if (zip && /^\d{5}$/.test(zip)) {
          localStorage.setItem('jenni_zip_preference', zip);
          if (this.config.debug) { try { console.log('[JenniEdge] Detected ZIP from IP:', zip); } catch {} }
          return zip;
        }
        
        throw new Error('Invalid ZIP from IP data');
        
      } catch (error) {
        if (this.config.debug) { try { console.log('[JenniEdge] ZIP detection failed, using default 60612:', error.message); } catch {} }
        return '60612'; // Default ZIP code
      }
    },

    // Removed client-side fingerprinting - now handled server-side only
    fingerprint() {
      return { 
        url: location.href, 
        timestamp: Date.now(),
        userAgent: navigator.userAgent.split(' ')[0]
      };
    },

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    // Removed - fingerprinting now handled server-side

    async run() {
      try {
        if (this.config.forceMock) {
          this.render(this.config.mockData || { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 });
          return;
        }
        // Abort any in-flight request
        if (this.state.inFlightAbort) {
          try { this.state.inFlightAbort.abort(); } catch {}
          this.state.inFlightAbort = null;
        }
        const ac = new AbortController();
        this.state.inFlightAbort = ac;
        if (this.state.inFlightTimer) clearTimeout(this.state.inFlightTimer);
        this.state.inFlightTimer = setTimeout(() => { try { ac.abort(); } catch {} }, this.config.requestTimeoutMs || 6000);
        const payload = { tenant: this.config.tenant, zip: this.config.zip, url: location.href };
        if (this.config.debug) { try { console.log('[JenniEdge] resolve payload', payload); } catch {} }
        const base = this.config.apiBase || '';
        const res = await fetch(`${base}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal });
        const data = await res.json();
        if (this.config.debug) { 
          try { 
            console.log('[JenniEdge] Full resolve result:', data);
            
            // Log fingerprint details
            if (data.product) {
              console.log('🔍 [JenniEdge] Product Fingerprint:', {
                title: data.product.title,
                brand: data.product.brand,
                sku: data.product.sku,
                gtin: data.product.gtin,
                styleCode: data.product.styleCode,
                quality: data.product.fingerprintQuality,
                matchConfidence: data.product.matchConfidence,
                matchType: data.product.matchType
              });
            }
            
            // Log nearby stores details
            if (data.nodes && data.nodes.length > 0) {
              console.log('🏪 [JenniEdge] Nearby Stores Found:', data.nodes.length);
              data.nodes.forEach((store, index) => {
                console.log(`   ${index + 1}. ${store.name}:`, {
                  distance: `${store.distanceMiles?.toFixed(1)} miles`,
                  eta: `${store.etaMinutes} minutes`,
                  profit: `$${store.margin?.toFixed(2)}`,
                  profitGuardPass: store.pgPass ? '✅ Pass' : '❌ Hold',
                  website: store.website,
                  productUrl: store.productUrl,
                  productMatch: store.productMatch ? '✅ Product Found' : '❌ No Product Match'
                });
              });
          } else {
              console.log('🏪 [JenniEdge] No nearby stores found');
            }
            
            // Log decision summary
            console.log('⚖️ [JenniEdge] Decision Summary:', {
              eligible: data.eligible,
              cta: data.decision?.cta,
              reason: data.decision?.reason,
              profitCheck: data.decision?.checks?.profit,
              trustCheck: data.decision?.checks?.trust,
              distanceCheck: data.decision?.checks?.distance
            });
          } catch {} 
        }
        this.render(data);
      } catch (e) {
        const aborted = (e && (e.name === 'AbortError' || /abort/i.test(e.message||'')));
        if (aborted) {
          this.render({ eligible: false, loading: true, message: 'Still checking nearby availability…' });
          return;
        }
        if (this.config.forceMock) {
          this.render(this.config.mockData || { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 });
          return;
        }
        this.render({ eligible: false, error: e?.message || 'Resolve failed' });
      } finally {
        this.state.inFlightAbort = null;
        if (this.state.inFlightTimer) { clearTimeout(this.state.inFlightTimer); this.state.inFlightTimer = null; }
      }
    },

  installWatchers() {
      if (!this.config.autoRefresh) return;
    // Navigation changes (SPA & history)
      this.state.lastHref = location.href;
      const onNav = () => {
        if (location.href !== this.state.lastHref) {
          this.state.lastHref = location.href;
      if (this.config.debug) { try { console.log('[JenniEdge] nav detected -> refresh'); } catch {} }
      this.scheduleRefresh(true);
      // Force signature reset so next mutation/poll triggers
      this.state.lastSig = '';
        }
      };
      const wrap = (fn) => function() { const r = fn.apply(this, arguments); try { window.dispatchEvent(new Event('jenni:nav')); } catch {} return r; };
      try {
        history.pushState = wrap(history.pushState);
        history.replaceState = wrap(history.replaceState);
        } catch {}
      window.addEventListener('popstate', onNav);
      window.addEventListener('hashchange', onNav);
      window.addEventListener('jenni:nav', onNav);

      // Helper to compute stable product signature
      const computeSig = () => {
        const fp = this.fingerprint();
        return [fp.productId, fp.gtin, fp.sku, fp.styleCode, fp.title, fp.brand].filter(Boolean).join('|');
      };

      const debouncedCheck = (reason='mutation') => {
        if (this.state.sigDebounceTimer) clearTimeout(this.state.sigDebounceTimer);
        this.state.sigDebounceTimer = setTimeout(() => {
          const sig = computeSig();
          if (sig && sig !== this.state.lastSig) {
            if (this.config.debug) { try { console.log('[JenniEdge] product change via', reason, '->', sig); } catch {} }
            this.state.lastSig = sig;
            this.scheduleRefresh();
          }
        }, 350); // allow DOM to settle
      };

      // DOM mutation observer to catch variant changes / PDP swaps
      const mo = new MutationObserver((mutations) => {
        // Ignore pure attribute changes on non-product nodes by limiting frequency
        debouncedCheck('mutation');
      });
      try {
        mo.observe(document.documentElement || document.body, { subtree: true, childList: true, characterData: false, attributes: false });
        } catch {}
      this.state.mo = mo;

      // Periodic polling as fallback (covers frameworks that batch DOM replacement silently)
      const startPolling = () => {
        if (this.state.pollTimer) clearInterval(this.state.pollTimer);
        this.state.pollTimer = setInterval(() => {
          const sig = computeSig();
          if (sig && sig !== this.state.lastSig) {
            if (this.config.debug) { try { console.log('[JenniEdge] product change via poll ->', sig); } catch {} }
            this.state.lastSig = sig;
            this.scheduleRefresh();
          }
        }, 1500);
      };
      startPolling();

      // Initialize first signature
      try { this.state.lastSig = computeSig(); } catch {}
    },

    scheduleRefresh(isNav=false) {
      if (!this.config.autoRefresh) return;
      if (this.state.refreshTimer) clearTimeout(this.state.refreshTimer);
      if (this.state.panelOpen && this.state.panelEl) {
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = '<div class="jenni-edge-node loading">Updating availability…</div>';
      }
      this.state.refreshTimer = setTimeout(() => { this.run(); }, isNav ? 200 : 500);
    },

    injectStyles() {
      const css = `
        /* Apple-inspired JENNi Edge Styles */
        .jenni-edge-pill {
          position: fixed;
          right: 16px;
          bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 24px;
          background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
          color: #ffffff;
          box-shadow: 0 8px 32px rgba(0, 122, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
          pointer-events: auto !important;
          -webkit-user-select: none;
          user-select: none;
          outline: none;
          touch-action: manipulation;
          isolation: isolate;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          transform: translateY(0);
        }
        
        .jenni-edge-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 122, 255, 0.5), 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .jenni-edge-pill:active {
          transform: translateY(-1px);
          transition: all 0.1s ease;
        }
        
        .jenni-edge-pill.neg {
          background: linear-gradient(135deg, #8E8E93 0%, #636366 100%);
          box-shadow: 0 8px 32px rgba(142, 142, 147, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .jenni-edge-pill.neg:hover {
          box-shadow: 0 12px 40px rgba(142, 142, 147, 0.5), 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .jenni-edge-pill.pick {
          background: linear-gradient(135deg, #FF9500 0%, #FF6B35 100%);
          box-shadow: 0 8px 32px rgba(255, 149, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .jenni-edge-pill.pick:hover {
          box-shadow: 0 12px 40px rgba(255, 149, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        
        .jenni-edge-ic {
          display: inline-flex;
          width: 20px;
          height: 20px;
          opacity: 0.9;
        }
        
        .jenni-edge-pill .txt {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
        
        .jenni-edge-pill .sub {
          font-size: 13px;
          opacity: 0.8;
          font-weight: 500;
          line-height: 1.1;
        }
        
        .jenni-edge-panel {
          position: fixed;
          right: 16px;
          bottom: 72px;
          width: 380px;
          max-height: 75vh;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(40px) saturate(1.8);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25), 0 8px 32px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
          border: 1px solid rgba(255, 255, 255, 0.3);
          animation: jenni-panel-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes jenni-panel-enter {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        .jenni-edge-hd {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.1);
        }
        
        .jenni-edge-title {
          font-weight: 700;
          font-size: 18px;
          color: #1D1D1F;
          letter-spacing: -0.02em;
          flex: 1;
        }
        
        .jenni-edge-eta {
          font-size: 13px;
          color: #86868B;
          font-weight: 500;
        }
        
        .jenni-edge-close {
          background: rgba(142, 142, 147, 0.12);
          border: none;
          color: #86868B;
          cursor: pointer;
          width: 28px;
          height: 28px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        
        .jenni-edge-close:hover {
          background: rgba(142, 142, 147, 0.2);
          color: #48484A;
        }
        
        .jenni-edge-body {
          padding: 16px 20px;
          max-height: 50vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        .jenni-edge-body::-webkit-scrollbar {
          width: 4px;
        }
        
        .jenni-edge-body::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .jenni-edge-body::-webkit-scrollbar-thumb {
          background: rgba(142, 142, 147, 0.3);
          border-radius: 2px;
        }
        
        .jenni-edge-node {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(0, 0, 0, 0.06);
          margin-bottom: 8px;
          transition: all 0.2s ease;
        }
        
        .jenni-edge-node:hover {
          background: rgba(255, 255, 255, 0.8);
          border-color: rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        .jenni-edge-node.loading {
          background: rgba(0, 122, 255, 0.08);
          border-color: rgba(0, 122, 255, 0.2);
          animation: jenni-loading-pulse 2s ease-in-out infinite;
        }
        
        @keyframes jenni-loading-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .jenni-edge-node .name {
          font-weight: 600;
          font-size: 15px;
          color: #1D1D1F;
          flex: 1;
        }
        
        .jenni-edge-node .meta {
          font-size: 13px;
          color: #86868B;
          font-weight: 500;
          text-align: right;
        }
        
        .jenni-edge-cta {
          display: block;
          width: calc(100% - 40px);
          margin: 16px 20px 20px;
          background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 14px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: -0.01em;
        }
        
        .jenni-edge-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 122, 255, 0.4);
        }
        
        .jenni-edge-cta:active {
          transform: translateY(0);
          transition: all 0.1s ease;
        }
        
        .jenni-edge-foot {
          padding: 0 20px 20px;
          font-size: 12px;
          color: #86868B;
          text-align: center;
          font-weight: 500;
        }
        
        .jenni-edge-formula {
          margin: 12px 20px;
          font-size: 12px;
          color: #86868B;
          padding: 8px 12px;
          background: rgba(142, 142, 147, 0.08);
          border-radius: 8px;
          font-family: ui-monospace, "SF Mono", Consolas, monospace;
          line-height: 1.4;
        }
        
        /* ZIP input styling */
        .zip-input {
          background: rgba(255, 255, 255, 0.8) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #1D1D1F !important;
          transition: all 0.2s ease !important;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif !important;
        }
        
        .zip-input:focus {
          outline: none !important;
          border-color: #007AFF !important;
          background: rgba(255, 255, 255, 0.95) !important;
          box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1) !important;
        }
        
        .zip-apply {
          background: rgba(0, 122, 255, 0.1) !important;
          border: 1px solid rgba(0, 122, 255, 0.2) !important;
          color: #007AFF !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        
        .zip-apply:hover {
          background: rgba(0, 122, 255, 0.15) !important;
          border-color: rgba(0, 122, 255, 0.3) !important;
        }
        
        /* Responsive design */
        @media (max-width: 480px) {
          .jenni-edge-panel {
            right: 12px;
            left: 12px;
            width: auto;
            bottom: 68px;
          }
          
          .jenni-edge-pill {
            right: 12px;
            bottom: 16px;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .jenni-edge-panel {
            background: rgba(28, 28, 30, 0.95);
            border-color: rgba(255, 255, 255, 0.1);
          }
          
          .jenni-edge-title {
            color: #F2F2F7;
          }
          
          .jenni-edge-eta {
            color: #AEAEB2;
          }
          
          .jenni-edge-node {
            background: rgba(58, 58, 60, 0.6);
            border-color: rgba(255, 255, 255, 0.06);
          }
          
          .jenni-edge-node:hover {
            background: rgba(58, 58, 60, 0.8);
            border-color: rgba(255, 255, 255, 0.1);
          }
          
          .jenni-edge-node .name {
            color: #F2F2F7;
          }
          
          .jenni-edge-node .meta {
            color: #AEAEB2;
          }
          
          .jenni-edge-foot {
            color: #AEAEB2;
          }
          
          .jenni-edge-formula {
            background: rgba(255, 255, 255, 0.05);
            color: #AEAEB2;
          }
          
          .zip-input {
            background: rgba(58, 58, 60, 0.8) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
            color: #F2F2F7 !important;
          }
          
          .zip-input:focus {
            background: rgba(58, 58, 60, 0.95) !important;
          }
        }
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    },

    render(data) {
      this.state.data = data;
      // Remove existing pill(s) but keep panel if configured
      document.querySelectorAll('.jenni-edge-pill').forEach(n=>n.remove());
      if (!(this.config.keepOpenOnRefresh && this.state.panelOpen && this.state.panelEl && document.body.contains(this.state.panelEl))) {
        // Remove orphaned panels only if not maintaining
        document.querySelectorAll('.jenni-edge-panel').forEach(n=>{ if (n !== this.state.panelEl) n.remove(); });
        if (!this.config.keepOpenOnRefresh) {
          document.querySelectorAll('.jenni-edge-panel').forEach(n=>n.remove());
          this.state.panelOpen = false; this.state.panelEl = null;
        }
      }
      const ok = !!data?.eligible;
      const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');
      const preview = !!this.config.forceMock || !!data?.preview;
      const pill = document.createElement('div');
      pill.className = 'jenni-edge-pill' + (cta === 'fallback' ? ' neg' : (cta === 'pickup_today' ? ' pick' : ''));
      pill.setAttribute('role','button');
      pill.setAttribute('tabindex','0');
      // Apply configured position
      this.applyPillPosition(pill);
      const pg = data?.profitGuard || null;
      const titleTxt = cta === 'arrives_today' ? 'Arrives Today' : (cta === 'pickup_today' ? 'Pickup Today' : 'Fast shipping available');
      const subParts = [];
      const eta = this.etaText(data);
      if (eta) subParts.push(eta);
      pill.innerHTML = `
        <span class="jenni-edge-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 13h13l3 5H6l-3-5Z"/><path d="M16 13V7H3v6"/></svg>
        </span>
        <div>
          <div class="txt">${titleTxt}</div>
          <div class="sub">${subParts.join(' • ')}</div>
        </div>
      `;
      // Robust event handlers to beat site interceptors
  const open = (e) => { try { e.preventDefault(); e.stopPropagation(); } catch(_){} this.openPanel(); };
      pill.addEventListener('click', open, true);        // capture phase
  pill.addEventListener('mousedown', open, true);
      pill.addEventListener('pointerdown', open, true);
      pill.addEventListener('touchstart', open, { capture: true, passive: false });
      pill.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openPanel(); }};
      document.body.appendChild(pill);

      // Auto-open support OR maintain open panel content
      if (this.state.panelOpen && this.config.keepOpenOnRefresh && this.state.panelEl) {
        try { this.updatePanelContent(this.state.panelEl, data); } catch {}
      } else if (this.config.autoOpenPanel && !this.state.openedOnce) {
        this.state.openedOnce = true;
        setTimeout(()=>this.openPanel(), 10);
      }

      // Click the pill to open the detail panel

    },

    applyPillPosition(el){
      const pos = String(this.config.position || 'bottom-right');
      const x = (this.config.offsetX ?? 16) + 'px';
      const y = (this.config.offsetY ?? 20) + 'px';
      el.style.position = 'fixed';
      el.style.left = 'auto'; el.style.right = 'auto'; el.style.top = 'auto'; el.style.bottom = 'auto';
      if (pos === 'bottom-left') { el.style.left = x; el.style.bottom = y; }
      else if (pos === 'top-right') { el.style.right = x; el.style.top = y; }
      else if (pos === 'top-left') { el.style.left = x; el.style.top = y; }
      else { el.style.right = x; el.style.bottom = y; } // bottom-right default
    },

    etaText(data){
      if (!data?.etaMinutes || !Number.isFinite(data.etaMinutes)) return '';
      const mins = Math.round(data.etaMinutes);
      const now = new Date();
      const eta = new Date(now.getTime() + mins*60000);
      const sameDay = now.toDateString() === eta.toDateString();
      const opts = { hour: 'numeric', minute: '2-digit' };
      const when = eta.toLocaleTimeString([], opts);
      return sameDay ? `by ${when}` : `by ${when} tomorrow`;
    },

  async openPanel(){
      if (this.state.panelOpen) return;
      // Guard against site errors: reset flag on failure
      this.state.panelOpen = true;
      const data = this.state.data || {};
      const ok = !!data.eligible;
      const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');
      let panel;
      try {
        panel = document.createElement('div');
        panel.className = 'jenni-edge-panel';
        panel.setAttribute('role','dialog');
      // Position panel near the pill based on config
      const pos = String(this.config.position || 'bottom-right');
      const x = (this.config.offsetX ?? 16) + 'px';
      const y = (this.config.offsetY ?? 20) + 'px';
      panel.style.position = 'fixed';
      panel.style.left = 'auto'; panel.style.right = 'auto'; panel.style.top = 'auto'; panel.style.bottom = 'auto';
      if (pos === 'bottom-left') { panel.style.left = x; panel.style.bottom = (parseInt(y)+52)+'px'; }
      else if (pos === 'top-right') { panel.style.right = x; panel.style.top = (parseInt(y)+52)+'px'; }
      else if (pos === 'top-left') { panel.style.left = x; panel.style.top = (parseInt(y)+52)+'px'; }
      else { panel.style.right = x; panel.style.bottom = (parseInt(y)+52)+'px'; }
      const pg = data && data.profitGuard ? data.profitGuard : null;
      const profitTitle = pg ? `Margin $${Math.round(pg.margin||0)} vs target $${Math.round(pg.floor||0)}` : '';
      const panelTitle = cta === 'arrives_today' ? 'Local delivery' : (cta === 'pickup_today' ? 'Pickup options' : 'Fast delivery options');
      const ctaText = cta === 'arrives_today' ? 'Deliver with JENNi' : (cta === 'pickup_today' ? 'Pick up today' : 'Deliver today with JENNi');
      panel.innerHTML = `
        <div class="jenni-edge-hd">
          <div class="jenni-edge-title">${panelTitle}</div>
          <div class="jenni-edge-eta">${this.etaText(data)}</div>
          <button class="jenni-edge-close" aria-label="Close">✕</button>
        </div>
        <div style="padding: 16px 20px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.06);">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
            <input aria-label="ZIP code" class="zip-input" placeholder="ZIP" value="${this.config.zip}" style="flex:0 0 90px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px"/>
            <button class="zip-apply" style="padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer">Update</button>
          </div>
        </div>
        <div class="jenni-edge-body" style="max-height: 40vh; overflow-y: auto;">
          <div class="jenni-edge-node loading">Finding nearby stores…</div>
        </div>
        ${this.config.debug ? '<div class="jenni-edge-formula"></div>' : ''}
        <div style="padding: 0 20px; position: sticky; bottom: 0; background: inherit; border-top: 1px solid rgba(0, 0, 0, 0.06);">
          <button class="jenni-edge-cta">${ctaText}</button>
          <div class="jenni-edge-foot">ZIP ${this.config.zip}</div>
        </div>
      `;
  panel.querySelector('.jenni-edge-close').onclick = () => { panel.remove(); this.state.panelOpen = false; this.state.panelEl = null; };
      panel.querySelector('.jenni-edge-cta').onclick = () => {
        const base = (this.config.apiBase || '');
        fetch(`${base}/test-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: location.href, zip: this.config.zip, tenant: this.config.tenant }) })
          .then(r=>r.json()).then(j=>alert(`Test order created: ${j.orderId || 'OK'}`)).catch(()=>alert('Test order simulated.'));
      };
      const zipInput = panel.querySelector('.zip-input');
      const applyZip = () => {
        const z = zipInput.value.replace(/[^0-9]/g,'').slice(0,10);
        if (z && z !== this.config.zip) { this.setZip(z, { reopen: true }); }
      };
      panel.querySelector('.zip-apply').onclick = applyZip;
      zipInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); applyZip(); }});
      
      // Removed fingerprint functionality
      
  document.body.appendChild(panel);
  this.state.panelEl = panel;
      // Populate formula and nodes: prefer nodes from resolve payload, else fetch
      try {
        let nodes = Array.isArray((this.state.data||{}).nodes) ? (this.state.data||{}).nodes : null;
        if (!nodes || !nodes.length) {
          nodes = await this.fetchNodes();
        }
        this.state.nodes = nodes || [];
        // Update formula using current ProfitGuard economics (debug mode only)
        if (this.config.debug) {
          try {
            const pgNow = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
            const formulaEl = panel.querySelector('.jenni-edge-formula');
            if (formulaEl && pgNow) {
              const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
              formulaEl.textContent = `PDP $${r(pgNow.price)} → Buy $${r(pgNow.buy_cost||pgNow.landed_cost)} + Courier $${r(pgNow.courier_est)} + Fee $${r(pgNow.fee)} = Profit $${r(pgNow.margin)}`;
            }
          } catch {}
        }
        this.renderNodes(panel.querySelector('.jenni-edge-body'), this.state.nodes);
      } catch {
        this.renderNodes(panel.querySelector('.jenni-edge-body'), []);
      }
      } catch(err){
        try { console.error('[JenniEdge] openPanel failed', err); } catch {}
        this.state.panelOpen = false; this.state.panelEl = null;
        try { alert('Jenni panel failed to open on this site. Try the preview overlay.'); } catch {}
        return;
      }
    },

    async fetchNodes(){
      // If no API base or forceMock, synthesize nodes
      if (!this.config.apiBase || this.config.forceMock){
        const base = [
          { id: 'demo_1', name: 'Downtown', etaMinutes: 90, distanceMiles: 3.2, stock: 7 },
          { id: 'demo_2', name: 'Uptown', etaMinutes: 120, distanceMiles: 5.1, stock: 4 },
        ];
        return base;
      }
      const q = encodeURIComponent('sneakers');
      const brand = encodeURIComponent('');
      const sc = encodeURIComponent('');
      const probe = this.config.accuracyProbe ? '&probe=1' : '';
      const r = await fetch(`${this.config.apiBase}/places?zip=${encodeURIComponent(this.config.zip)}&q=${q}&brand=${brand}&sc=${sc}${probe}`);
      const j = await r.json();
      return j?.nodes || [];
    },

  renderNodes(container, nodes){
      container.innerHTML = '';
      if (!nodes || !nodes.length){
        const empty = document.createElement('div');
        empty.className = 'jenni-edge-node';
    const reason = (this.state.data && (this.state.data.availability?.reason || this.state.data.decision?.reason)) || 'not_available';
    empty.textContent = reason === 'no_nearby_stores' ? 'No nearby stores found.' : 'No local availability — showing fastest shipping.';
        container.appendChild(empty);
        return;
      }
      const pg = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
      nodes.slice(0,3).forEach(n => {
        const row = document.createElement('div');
        row.className = 'jenni-edge-node';
        
        // Customer-friendly badges (only show in debug mode)
        const debugBadges = this.config.debug ? (() => {
          const pass = n.pgPass ? 
            '<span style="margin-left:6px;font-size:11px;color:#155e75;background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:2px 6px">✅ Pass</span>' : 
            '<span style="margin-left:6px;font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 6px">⏸️ Hold</span>';
          
          const productMatch = n.productMatch ? 
            '<span style="margin-left:4px;font-size:10px;color:#059669;background:#d1fae5;border:1px solid #a7f3d0;border-radius:4px;padding:1px 4px">🎯 Product</span>' : '';
          
          return pass + productMatch;
        })() : '';
        
        // Create smart link for available stores
        let linkHref = '';
        let linkTitle = '';
        let storeName = n.name;
        
        // Get product info for search
        const productTitle = this.state.data?.product?.title || '';
        const styleCode = this.state.data?.product?.styleCode || '';
        const brand = this.state.data?.product?.brand || '';
        
        if (n.productUrl && /^https?:/i.test(n.productUrl)) {
          // Direct product URL is best
          linkHref = n.productUrl;
          linkTitle = 'View product at store';
        } else if (n.website && /^https?:/i.test(n.website)) {
          // Create search URL on store website
          const searchTerm = [brand, productTitle, styleCode].filter(Boolean).join(' ').trim();
          if (searchTerm) {
            // Try to create a search URL for common store patterns
            const baseUrl = n.website.replace(/\/$/, '');
            if (baseUrl.includes('target.com')) {
              linkHref = `${baseUrl}/s?searchTerm=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('walmart.com')) {
              linkHref = `${baseUrl}/search?q=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('bestbuy.com')) {
              linkHref = `${baseUrl}/site/searchpage.jsp?st=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('homedepot.com')) {
              linkHref = `${baseUrl}/s/${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('lowes.com')) {
              linkHref = `${baseUrl}/search?searchTerm=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('amazon.com')) {
              linkHref = `${baseUrl}/s?k=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('costco.com')) {
              linkHref = `${baseUrl}/s?dept=All&keyword=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('macys.com')) {
              linkHref = `${baseUrl}/shop/search?keyword=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('nordstrom.com')) {
              linkHref = `${baseUrl}/sr?origin=keywordsearch&keyword=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('kohls.com')) {
              linkHref = `${baseUrl}/catalog.jsp?search=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('cvs.com')) {
              linkHref = `${baseUrl}/shop/search?searchTerm=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('walgreens.com')) {
              linkHref = `${baseUrl}/search/results.jsp?Ntt=${encodeURIComponent(searchTerm)}`;
            } else if (baseUrl.includes('riteaid.com')) {
              linkHref = `${baseUrl}/shop/search?searchTerm=${encodeURIComponent(searchTerm)}`;
            } else {
              // Generic search - try common patterns
              linkHref = `${baseUrl}/search?q=${encodeURIComponent(searchTerm)}`;
            }
            linkTitle = `Search for "${searchTerm}" at ${storeName}`;
          } else {
            // No product info, just link to store
            linkHref = n.website;
            linkTitle = `Visit ${storeName} website`;
          }
        } else {
          // No website, create Google search as fallback
          const searchTerm = [storeName, brand, productTitle, styleCode].filter(Boolean).join(' ').trim();
          if (searchTerm) {
            linkHref = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
            linkTitle = `Search for product at ${storeName}`;
          }
        }
        
        const nameHtml = linkHref ? 
          `<a href="${linkHref}" target="_blank" rel="noopener" style="color:#0f766e;text-decoration:none;font-weight:600" title="${linkTitle}">${storeName}</a>` :
          `<span style="color:#1D1D1F;font-weight:600">${storeName}</span>`;
        
        // Customer-friendly store info
        const storeInfo = [];
        if (n.distanceMiles) storeInfo.push(`${Math.round(n.distanceMiles * 10) / 10} mi away`);
        if (n.etaMinutes) storeInfo.push(`~${Math.round(n.etaMinutes)} min delivery`);
        
        // Debug info (only show in debug mode)
        const debugInfo = this.config.debug ? [
          `Profit: $${Math.round(n.margin||0)} | Floor: $${Math.round(n.floor||0)}`,
          n.score ? `Score: ${(n.score * 100).toFixed(0)}%` : ''
        ].filter(Boolean) : [];
        
        row.innerHTML = `
          <div style="flex: 1;">
            <div class="name">${nameHtml}${debugBadges}</div>
            <div class="meta">${storeInfo.join(' • ')}</div>
            ${debugInfo.map(info => `<div class="meta" style="font-size:11px;color:#6b7280;">${info}</div>`).join('')}
          </div>
          <div style="flex-shrink: 0;">
            <div style="font-size:13px;font-weight:600;color:#059669;text-align:right;">Available</div>
            ${n.stock ? `<div style="font-size:11px;color:#6b7280;text-align:right;">${n.stock} in stock</div>` : ''}
          </div>
        `;
        container.appendChild(row);
        
        if (this.config.debug) {
          console.log(`[JenniEdge] Rendered store: ${n.name}`, {
            productUrl: n.productUrl,
            website: n.website,
            finalLink: linkHref,
            linkTitle: linkTitle,
            productInfo: { productTitle, styleCode, brand }
          });
        }
      });

      // Omit accuracy boost in simplified demo UI
    },

    updatePanelContent(panel, data){
      if (!panel) return;
      try {
        const body = panel.querySelector('.jenni-edge-body');
        if (body) {
          // Re-render nodes if we have them
          if (Array.isArray(data?.nodes)) {
            this.renderNodes(body, data.nodes);
          }
        }
        const etaEl = panel.querySelector('.jenni-edge-eta');
        if (etaEl) etaEl.textContent = this.etaText(data);
        const foot = panel.querySelector('.jenni-edge-foot');
        if (foot) foot.textContent = `ZIP ${this.config.zip}`;
        const formulaEl = panel.querySelector('.jenni-edge-formula');
        if (formulaEl && data?.profitGuard) {
          const pg = data.profitGuard;
          const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
          formulaEl.textContent = `PDP $${r(pg.price)} → Buy $${r(pg.buy_cost||pg.landed_cost)} + Courier $${r(pg.courier_est)} + Fee $${r(pg.fee)} = Profit $${r(pg.margin)}`;
        }
        
        // Removed fingerprint functionality
      } catch {}
    },

    // Removed - fingerprinting now handled server-side

    setZip(newZip, opts={}) {
      const z = (newZip||'').replace(/[^0-9]/g,'').slice(0,5); // Limit to 5 digits for US ZIP
      if (!z) return;
      if (z === this.config.zip && !opts.force) return;
      
      this.config.zip = z;
      
      // Store in localStorage for future visits
      try {
        localStorage.setItem('jenni_zip_preference', z);
      } catch (e) {
        if (this.config.debug) { try { console.log('[JenniEdge] Failed to store ZIP in localStorage'); } catch {} }
      }
      
      if (this.config.debug) { try { console.log('[JenniEdge] ZIP updated ->', z); } catch {} }
      
      if (this.state.panelOpen && this.state.panelEl) {
        const input = this.state.panelEl.querySelector('.zip-input');
        if (input) input.value = z;
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = '<div class="jenni-edge-node loading">Refreshing for ZIP '+z+'…</div>';
        const foot = this.state.panelEl.querySelector('.jenni-edge-foot');
        if (foot) foot.textContent = `ZIP ${z}`;
      }
      
      this.run();
    }
  };

  window.JenniEdge = JenniEdge;
})();
