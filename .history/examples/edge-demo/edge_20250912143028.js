(() => {
  const JenniEdge = {
    config: { apiBase: '', tenant: 'demo', zip: '', selector: 'body', autoRefresh: true, autoOpenPanel: true, debug: true, forceMock: false, position: 'bottom-right', offsetX: 16, offsetY: 20, keepOpenOnRefresh: true, requestTimeoutMs: 10000, mockData: { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 } },
  state: { data: null, nodes: [], panelOpen: false, panelEl: null, openedOnce: false, lastHref: '', lastSig: '', refreshTimer: null, inFlightAbort: null, inFlightTimer: null, sigDebounceTimer: null, pollTimer: null },

    init(opts = {}) {
      this.config = { ...this.config, ...opts };
      this.injectStyles();
      this.installWatchers();
      this.run();
      return this;
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
        if (this.config.debug) { try { console.log('[JenniEdge] resolve result', data); } catch {} }
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
  .jenni-edge-pill{position:fixed;right:16px;bottom:20px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;background:linear-gradient(135deg,#16a34a,#10b981);color:#fff;box-shadow:0 10px 30px rgba(16,185,129,.35);cursor:pointer;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;pointer-events:auto !important;-webkit-user-select:none;user-select:none;outline:none;touch-action:manipulation;isolation:isolate}
        .jenni-edge-pill.neg{background:linear-gradient(135deg,#6b7280,#4b5563);box-shadow:0 10px 30px rgba(75,85,99,.35)}
        .jenni-edge-pill.pick{background:linear-gradient(135deg,#2563eb,#3b82f6);box-shadow:0 10px 30px rgba(59,130,246,.35)}
        .jenni-edge-ic{display:inline-flex;width:18px;height:18px}
        .jenni-edge-pill .txt{font-size:14px;font-weight:600;letter-spacing:.2px}
        .jenni-edge-pill .sub{font-size:12px;opacity:.9}
        .jenni-edge-panel{position:fixed;right:16px;bottom:72px;width:360px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.22);overflow:auto;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border:1px solid #eef2f7}
        .jenni-edge-hd{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;border-bottom:1px solid #f1f5f9}
        .jenni-edge-title{font-weight:700;color:#0f172a}
        .jenni-edge-eta{margin-left:auto;font-size:12px;color:#64748b}
        .jenni-edge-body{padding:12px;max-height:48vh;overflow:auto}
        .jenni-edge-node{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;border:1px solid #eef2f7;margin-bottom:8px}
        .jenni-edge-node .name{font-weight:600;color:#111827}
        .jenni-edge-node .meta{font-size:12px;color:#64748b}
        .jenni-edge-cta{display:block;width:calc(100% - 24px);margin:8px 12px 12px;background:#111827;color:#fff;border:none;border-radius:10px;padding:10px 12px;font-size:14px;cursor:pointer}
        .jenni-edge-foot{padding:0 12px 12px;font-size:11px;color:#64748b}
        .jenni-edge-close{margin-left:auto;background:transparent;border:none;color:#64748b;cursor:pointer}
        .jenni-edge-formula{margin:6px 0 10px;font-size:12px;color:#64748b}
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
      const ctaText = cta === 'arrives_today' ? 'Deliver with JENNi' : (cta === 'pickup_today' ? 'Pick up today' : 'See delivery options');
      panel.innerHTML = `
        <div class="jenni-edge-hd">
          <div class="jenni-edge-title">${panelTitle}</div>
          <div class="jenni-edge-eta">${this.etaText(data)}</div>
          <button class="jenni-edge-close" aria-label="Close">✕</button>
        </div>
        <div class="jenni-edge-body">
        <div class="jenni-edge-node loading">Finding nearby stores…</div>
        </div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <input aria-label="ZIP code" class="zip-input" placeholder="ZIP" value="${this.config.zip}" style="flex:0 0 90px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px"/>
            <button class="zip-apply" style="padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer">Update</button>
          </div>
          <div class="jenni-edge-formula"></div>


        <button class="jenni-edge-cta">${ctaText}</button>
        <div class="jenni-edge-foot">ZIP ${this.config.zip}</div>
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
      
      // Fingerprint toggle functionality
      const fingerprintToggle = panel.querySelector('.fingerprint-toggle');
      const fingerprintEl = panel.querySelector('.jenni-edge-fingerprint');
      let fingerprintVisible = false;
      
      fingerprintToggle.onclick = () => {
        fingerprintVisible = !fingerprintVisible;
        fingerprintEl.style.display = fingerprintVisible ? 'block' : 'none';
        fingerprintToggle.textContent = fingerprintVisible ? '🔍✓' : '🔍';
        
        if (fingerprintVisible) {
          this.renderFingerprint(fingerprintEl);
        }
      };
      
  document.body.appendChild(panel);
  this.state.panelEl = panel;
      // Populate formula and nodes: prefer nodes from resolve payload, else fetch
      try {
        let nodes = Array.isArray((this.state.data||{}).nodes) ? (this.state.data||{}).nodes : null;
        if (!nodes || !nodes.length) {
          nodes = await this.fetchNodes();
        }
        this.state.nodes = nodes || [];
        // Update formula using current ProfitGuard economics
        try {
          const pgNow = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
          const formulaEl = panel.querySelector('.jenni-edge-formula');
          if (formulaEl && pgNow) {
            const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
            formulaEl.textContent = `PDP $${r(pgNow.price)} → Buy $${r(pgNow.buy_cost||pgNow.landed_cost)} + Courier $${r(pgNow.courier_est)} + Fee $${r(pgNow.fee)} = Profit $${r(pgNow.margin)}`;
          }
        } catch {}
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
      const fp = this.fingerprint();
      const q = encodeURIComponent((fp.styleCode || fp.sku || fp.title || 'sneakers').toString());
      const brand = encodeURIComponent((fp.brand || '').toString());
      const sc = encodeURIComponent((fp.styleCode || '').toString());
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
        const pass = n.pgPass ? '<span style="margin-left:6px;font-size:11px;color:#155e75;background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:2px 6px">Pass</span>' : '<span style="margin-left:6px;font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 6px">Hold</span>';
        const linkHref = (n.productUrl && /^https?:/i.test(n.productUrl))
          ? n.productUrl
          : ((n.website && /^https?:/i.test(n.website)) ? n.website : `https://www.google.com/search?q=${encodeURIComponent(n.name+' '+(this.state.data?.product?.styleCode||'product'))}`);
        const nameHtml = `<a href="${linkHref}" target="_blank" rel="noopener" style="color:#0f766e;text-decoration:none">${n.name}</a>`;
        row.innerHTML = `
          <div class="name">${nameHtml}${pass}</div>
          <div class="meta">${Math.round(n.distanceMiles)} mi • ~${Math.round(n.etaMinutes)}m</div>
          <div class="meta">Profit $${Math.round(n.margin||0)}</div>
        `;
        container.appendChild(row);
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
        
        // Update fingerprint if visible
        const fingerprintEl = panel.querySelector('.jenni-edge-fingerprint');
        if (fingerprintEl && fingerprintEl.style.display !== 'none') {
          this.renderFingerprint(fingerprintEl);
        }
      } catch {}
    },

    renderFingerprint(container) {
      if (!container) return;
      
      const fp = this.fingerprint();
      const quality = this.calculateFingerprintQuality(fp);
      const qualityBreakdown = fp._qualityBreakdown || {};
      
      // Quality indicator with validation status
      const qualityColor = quality >= 0.8 ? '#16a34a' : (quality >= 0.5 ? '#ca8a04' : '#dc2626');
      const qualityText = quality >= 0.8 ? 'Excellent' : (quality >= 0.5 ? 'Good' : 'Poor');
      const validationColor = qualityBreakdown.validation?.dataQuality === 'excellent' ? '#10b981' : 
                             qualityBreakdown.validation?.dataQuality === 'good' ? '#f59e0b' : '#ef4444';
      
      const formatValue = (val, label, confidence = null) => {
        if (!val) return `<span style="color:#9ca3af">${label}: None</span>`;
        const truncated = String(val).length > 30 ? String(val).substring(0, 30) + '...' : val;
        const confidenceIcon = confidence === 'high' ? '🟢' : confidence === 'medium' ? '🟡' : confidence === 'low' ? '🔴' : '';
        return `<span style="color:#374151">${label}: <strong>${truncated}</strong> ${confidenceIcon}</span>`;
      };
      
      const formatPrice = (price) => {
        if (!price) return '<span style="color:#9ca3af">Price: None</span>';
        
        if (typeof price === 'object' && price.current) {
          const currencySymbol = price.currency === 'EUR' ? '€' : price.currency === 'GBP' ? '£' : '$';
          let priceText = `${currencySymbol}${price.current.toFixed(2)}`;
          
          if (price.isOnSale && price.original) {
            priceText += ` <span style="text-decoration:line-through;color:#9ca3af">${currencySymbol}${price.original.toFixed(2)}</span>`;
          }
          
          if (price.priceRange) {
            priceText += ` (Range: ${currencySymbol}${price.priceRange.min}-${price.priceRange.max})`;
          }
          
          const confidenceIcon = price.confidence >= 0.8 ? '🟢' : price.confidence >= 0.6 ? '🟡' : '🔴';
          return `<span style="color:#374151">Price: <strong>${priceText}</strong> ${confidenceIcon}</span>`;
        } else if (typeof price === 'number') {
          return `<span style="color:#374151">Price: <strong>$${price.toFixed(2)}</strong> 🟡</span>`;
        }
        
        return '<span style="color:#9ca3af">Price: Invalid</span>';
      };
      
      const formatClothingAttributes = (variant) => {
        if (!variant) return '<span style="color:#9ca3af">Attributes: None</span>';
        
        const attributes = [];
        
        if (variant.size) {
          const size = variant.size;
          const sizeText = typeof size === 'object' ? 
            `${size.value} (${size.type})` : size;
          const confidenceIcon = (size.confidence >= 0.8) ? '🟢' : (size.confidence >= 0.6) ? '🟡' : '🔴';
          attributes.push(`Size: ${sizeText} ${confidenceIcon}`);
        }
        
        if (variant.color) {
          const color = variant.color;
          const colorText = typeof color === 'object' ? 
            `${color.name}${color.hex ? ` (${color.hex})` : ''}` : color;
          const confidenceIcon = (color.confidence >= 0.8) ? '🟢' : (color.confidence >= 0.6) ? '🟡' : '🔴';
          attributes.push(`Color: ${colorText} ${confidenceIcon}`);
        }
        
        if (variant.material) {
          attributes.push(`Material: ${variant.material} 🟡`);
        }
        
        if (variant.fit) {
          attributes.push(`Fit: ${variant.fit} 🟡`);
        }
        
        if (variant.style) {
          attributes.push(`Style: ${variant.style} 🟡`);
        }
        
        return attributes.length > 0 ? 
          `<div style="color:#374151;margin:2px 0"><strong>Attributes:</strong><br>${attributes.map(attr => `• ${attr}`).join('<br>')}</div>` :
          '<span style="color:#9ca3af">Attributes: None</span>';
      };
      
      const formatWarnings = (warnings) => {
        if (!warnings || warnings.length === 0) return '';
        
        return `<div style="margin-top:6px;padding:6px;background:#fef3c7;border-radius:4px;border-left:3px solid #f59e0b">
          <div style="font-size:10px;font-weight:600;color:#92400e;margin-bottom:2px">⚠️ Warnings:</div>
          ${warnings.map(w => `<div style="font-size:9px;color:#92400e">• ${w}</div>`).join('')}
        </div>`;
      };
      
      const formatValidationIssues = (validation) => {
        if (!validation || validation.issues.length === 0) return '';
        
        return `<div style="margin-top:4px;padding:4px;background:#fef2f2;border-radius:4px;border-left:3px solid #ef4444">
          <div style="font-size:10px;font-weight:600;color:#dc2626;margin-bottom:2px">🔍 Validation Issues:</div>
          ${validation.issues.map(issue => `<div style="font-size:9px;color:#dc2626">• ${issue}</div>`).join('')}
        </div>`;
      };
      
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-weight:600;font-size:12px">Fingerprint Quality</div>
          <div style="background:${qualityColor};color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${Math.round(quality * 100)}%</div>
          <div style="font-size:11px;color:#6b7280">${qualityText}</div>
          <div style="background:${validationColor};color:white;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:600">${qualityBreakdown.validation?.dataQuality || 'N/A'}</div>
        </div>
        
        <div style="display:grid;gap:3px;font-size:11px;line-height:1.3">
          ${formatValue(fp.gtin, 'GTIN', qualityBreakdown.identifiers?.gtin?.confidence)}
          ${formatValue(fp.sku, 'SKU', qualityBreakdown.identifiers?.sku?.confidence)}
          ${formatValue(fp.styleCode, 'Style', qualityBreakdown.identifiers?.styleCode?.confidence)}
          ${formatValue(fp.brand, 'Brand', qualityBreakdown.identifiers?.brand?.confidence)}
          ${formatPrice(fp.price)}
          ${formatClothingAttributes(fp.variant)}
        </div>
        
        ${formatWarnings(qualityBreakdown.warnings)}
        ${formatValidationIssues(qualityBreakdown.validation)}
        
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280">
          Updated: ${new Date(fp.timestamp).toLocaleTimeString()}
          ${fp.variant ? ` • Attributes: ${Object.keys(fp.variant).length}` : ''}
        </div>
        
        ${this.config.debug ? `<details style="margin-top:6px;font-size:10px">
          <summary style="cursor:pointer;color:#6b7280">Debug Info</summary>
          <pre style="margin:4px 0;padding:4px;background:#f3f4f6;border-radius:4px;overflow:auto;max-height:150px;font-size:9px">${JSON.stringify(fp, null, 2)}</pre>
        </details>` : ''}
      `;
    },

    setZip(newZip, opts={}) {
      const z = (newZip||'').replace(/[^0-9]/g,'').slice(0,10);
      if (!z) return;
      if (z === this.config.zip && !opts.force) return;
      this.config.zip = z;
      if (this.config.debug) { try { console.log('[JenniEdge] ZIP updated ->', z); } catch {} }
      if (this.state.panelOpen && this.state.panelEl) {
        const input = this.state.panelEl.querySelector('.zip-input');
        if (input) input.value = z;
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = '<div class="jenni-edge-node loading">Refreshing for ZIP '+z+'…</div>';
      }
      this.run();
    }
  };

  window.JenniEdge = JenniEdge;
})();
