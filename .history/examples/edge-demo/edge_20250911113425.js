(() => {
  const JenniEdge = {
    config: { apiBase: '', tenant: 'demo', zip: '', selector: 'body', autoRefresh: true, autoOpenPanel: false, debug: false, forceMock: false, position: 'bottom-right', offsetX: 16, offsetY: 20, keepOpenOnRefresh: true, requestTimeoutMs: 10000, mockData: { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 } },
  state: { data: null, nodes: [], panelOpen: false, panelEl: null, openedOnce: false, lastHref: '', lastSig: '', refreshTimer: null, inFlightAbort: null, inFlightTimer: null, sigDebounceTimer: null, pollTimer: null },

    init(opts = {}) {
      this.config = { ...this.config, ...opts };
      this.injectStyles();
      this.installWatchers();
      this.run();
      return this;
    },

    fingerprint() {
      // Enhanced selector helper with priority and validation
      const bySelectors = (selectors, validator = null) => {
        for (const s of selectors) {
          try {
            const el = document.querySelector(s);
            if (!el) continue;
            
            let value = el.getAttribute('content') || el.getAttribute('value') || 
                       el.textContent || el.innerText || null;
            
            if (value) {
              value = value.trim();
              if (validator ? validator(value) : value) return value;
            }
          } catch {}
        }
        return null;
      };

      // GTIN/UPC/EAN validators
      const isValidGtin = (v) => /^[0-9]{8,14}$/.test(v) && v.length >= 8;
      const isValidSku = (v) => v && v.length >= 2 && v.length <= 100;

      // Enhanced GTIN extraction (UPC, EAN, GTIN variants)
      const gtin = bySelectors([
        // Schema.org microdata
        '[itemprop="gtin13"]', '[itemprop="gtin12"]', '[itemprop="gtin14"]', '[itemprop="gtin8"]', '[itemprop="gtin"]',
        // Common data attributes
        '[data-gtin]', '[data-gtin13]', '[data-gtin12]', '[data-upc]', '[data-ean]', '[data-barcode]',
        // Form inputs
        '[name="gtin"]', '[name="upc"]', '[name="ean"]', '[name="barcode"]',
        // Meta tags
        'meta[name="product:upc"]', 'meta[property="product:upc"]',
        'meta[name="product:ean"]', 'meta[property="product:ean"]',
        // Shopify specific
        '[data-product-barcode]', '.product-barcode',
        // WooCommerce
        '.woocommerce-product-barcode', '[data-sku-barcode]',
        // Generic class patterns
        '.barcode', '.upc', '.ean', '.gtin'
      ], isValidGtin);

      // Enhanced SKU extraction
      const sku = bySelectors([
        // Schema.org
        '[itemprop="sku"]', '[itemprop="model"]', '[itemprop="mpn"]',
        // Data attributes (prioritized)
        '[data-sku]', '[data-product-sku]', '[data-variant-sku]', '[data-model]', '[data-mpn]',
        // Selected variant (common pattern)
        'select[name="id"] option:checked', 'input[name="id"]:checked',
        '.variant-sku.selected', '.selected-variant [data-sku]',
        // Form inputs
        '[name="sku"]', '[name="model"]', '[name="mpn"]', '[name="product_id"]',
        // Meta tags
        'meta[name="product:sku"]', 'meta[property="product:sku"]',
        'meta[name="product:model"]', 'meta[property="product:model"]',
        // Platform specific
        '[data-shopify-sku]', '[data-wc-sku]', '[data-magento-sku]',
        // Class patterns
        '.product-sku', '.sku', '.model-number', '.part-number'
      ], isValidSku);

      // Enhanced title extraction
      const title = bySelectors([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]', 
        'meta[name="title"]',
        'h1.product-title', 'h1.product-name', 'h1[itemprop="name"]',
        '.product-title h1', '.product-name h1',
        'h1'
      ]) || document.title;

      // Enhanced brand extraction
      let brand = bySelectors([
        // Schema.org
        '[itemprop="brand"]', 
        // Meta tags
        'meta[property="product:brand"]', 'meta[name="product:brand"]',
        'meta[property="og:brand"]', 'meta[name="brand"]',
        // Data attributes
        '[data-brand]', '[data-product-brand]', '[data-manufacturer]',
        // Form inputs
        '[name="brand"]', '[name="manufacturer"]',
        // Class patterns
        '.product-brand', '.brand-name', '.manufacturer',
        '.product-details .brand', '.product-info .brand'
      ]);

      // Product ID extraction
      const productId = bySelectors([
        '[data-product-id]', '[data-productid]', '[data-id]',
        'meta[name="product:id"]', 'meta[property="product:id"]',
        '[name="product_id"]', '[name="id"]',
        '.product-id', '#product-id'
      ]);

      // Enhanced JSON-LD parsing with better error handling and nesting support
      const ld = { gtin13: null, gtin12: null, gtin: null, sku: null, brand: null, name: null, offers: null, mpn: null };
      try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const sc of scripts) {
          try {
            const jsonText = sc.textContent || sc.innerHTML || '';
            if (!jsonText.trim()) continue;
            
            let json = JSON.parse(jsonText);
            const arr = Array.isArray(json) ? json : [json];
            
            for (const node of arr) {
              this.extractFromJsonLdNode(node, ld);
            }
          } catch (e) {
            if (this.config.debug) console.log('[JenniEdge] JSON-LD parse error:', e);
          }
        }
      } catch {}

      // Priority resolution with validation
      const strongGtin = ld.gtin13 || ld.gtin12 || ld.gtin || gtin || null;
      const strongSku = ld.sku || ld.mpn || sku || null;
      const strongTitle = ld.name || title || null;
      brand = ld.brand || brand || this.extractBrandFromTitle(strongTitle) || null;

      // Enhanced style code extraction (URL + content)
      let styleCode = this.extractStyleCode();
      
      // Price extraction from current page state
      const price = this.extractCurrentPrice();

      // Variant detection
      const variant = this.detectSelectedVariant();

      return { 
        url: location.href, 
        title: strongTitle, 
        brand, 
        sku: strongSku, 
        gtin: strongGtin, 
        styleCode, 
        productId, 
        price,
        variant,
        ld,
        timestamp: Date.now(),
        userAgent: navigator.userAgent.split(' ')[0] // First part for debugging
      };
    },

    // Helper: Extract from JSON-LD node recursively
    extractFromJsonLdNode(node, ld) {
      if (!node || typeof node !== 'object') return;
      
      const type = (node['@type'] || node.type || '').toString().toLowerCase();
      
      if (type.includes('product') || type.includes('offer')) {
        // Basic properties
        ld.name = ld.name || node.name || null;
        ld.sku = ld.sku || node.sku || null;
        ld.mpn = ld.mpn || node.mpn || null;
        
        // GTIN variants
        ld.gtin13 = ld.gtin13 || node.gtin13 || null;
        ld.gtin12 = ld.gtin12 || node.gtin12 || null;  
        ld.gtin = ld.gtin || node.gtin || node.gtin14 || node.gtin8 || null;
        
        // Brand handling (string or object)
        if (node.brand && !ld.brand) {
          if (typeof node.brand === 'string') {
            ld.brand = node.brand;
          } else if (node.brand.name) {
            ld.brand = node.brand.name;
          } else if (node.brand['@type'] && node.brand['@type'].includes('Brand')) {
            ld.brand = node.brand.name || node.brand.alternateName || null;
          }
        }
        
        // Offers handling
        if (node.offers && !ld.offers) {
          ld.offers = node.offers;
        }
      }
      
      // Recursive search in nested objects/arrays
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('@')) continue; // Skip JSON-LD metadata
        
        if (Array.isArray(value)) {
          value.forEach(item => this.extractFromJsonLdNode(item, ld));
        } else if (typeof value === 'object' && value !== null) {
          this.extractFromJsonLdNode(value, ld);
        }
      }
    },

    // Helper: Extract brand from title using common patterns
    extractBrandFromTitle(title) {
      if (!title) return null;
      
      // Common brand patterns in titles
      const brandPatterns = [
        /^([A-Z][a-zA-Z]+)\s+/,  // "Nike Air Max"
        /\b(Nike|Adidas|Puma|Jordan|Converse|Vans|New Balance|ASICS|Under Armour|Reebok)\b/i,
        /\b([A-Z]{2,})\s+[A-Z0-9-]+/,  // "NIKE ABC-123"
      ];
      
      for (const pattern of brandPatterns) {
        const match = title.match(pattern);
        if (match) return match[1];
      }
      
      return null;
    },

    // Helper: Enhanced style code extraction
    extractStyleCode() {
      // URL-based extraction (improved patterns)
      const urlPatterns = [
        /\/([A-Z0-9]{2,}-[A-Z0-9]{2,})/i,          // /ABC-123
        /\/([A-Z]{2,}[0-9]{3,})/i,                  // /ABC123
        /product[\/\-]([A-Z0-9]{4,}-[0-9]{3,})/i,  // product/ABC-123
        /-([A-Z0-9]{4,}-[0-9]{3,})/i,              // something-ABC-123
      ];
      
      for (const pattern of urlPatterns) {
        const match = location.pathname.match(pattern) || location.href.match(pattern);
        if (match) return match[1];
      }
      
      // Content-based extraction
      const contentPatterns = [
        '.style-code', '.product-code', '.model-code',
        '[data-style]', '[data-style-code]',
        '.product-details:contains("Style")',
      ];
      
      for (const selector of contentPatterns) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent || el.getAttribute('data-style') || '';
            const match = text.match(/([A-Z0-9]{4,}-[0-9]{3,})/i);
            if (match) return match[1];
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Extract current price from page
    extractCurrentPrice() {
      const priceSelectors = [
        '.price.current', '.current-price', '.sale-price', '.price-now',
        '[data-price]', '[data-current-price]',
        '.price:not(.original):not(.was)', 
        'meta[property="product:price:amount"]',
        '[itemprop="price"]', '[itemprop="lowPrice"]',
        '.product-price .price', '.price-current'
      ];
      
      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let priceText = el.getAttribute('content') || 
                         el.getAttribute('data-price') || 
                         el.textContent || '';
          
          // Extract numeric price
          const match = priceText.match(/[\d,]+\.?\d*/);
          if (match) {
            const price = parseFloat(match[0].replace(/,/g, ''));
            if (price > 0) return price;
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Detect selected variant
    detectSelectedVariant() {
      const variantInfo = {};
      
      // Size detection
      const sizeSelectors = [
        'select[name*="size"] option:checked',
        'input[name*="size"]:checked', 
        '.size-option.selected',
        '[data-size].selected'
      ];
      
      for (const selector of sizeSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            variantInfo.size = el.value || el.textContent || el.getAttribute('data-size');
            break;
          }
        } catch {}
      }
      
      // Color detection  
      const colorSelectors = [
        'select[name*="color"] option:checked',
        'input[name*="color"]:checked',
        '.color-option.selected',
        '[data-color].selected'
      ];
      
      for (const selector of colorSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            variantInfo.color = el.value || el.textContent || el.getAttribute('data-color');
            break;
          }
        } catch {}
      }
      
      return Object.keys(variantInfo).length > 0 ? variantInfo : null;
    },

    // Helper: Calculate fingerprint quality score
    calculateFingerprintQuality(fp) {
      if (!fp) return 0;
      let score = 0;
      if (fp.gtin) score += 0.5;
      if (fp.sku) score += 0.2;
      if (fp.styleCode) score += 0.15;
      if (fp.brand) score += 0.1;
      if (fp.title) score += 0.05;
      if (fp.price) score += 0.05;
      if (fp.variant) score += 0.05;
      return Math.min(1, score);
    },

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
        const payload = { tenant: this.config.tenant, zip: this.config.zip, url: location.href, fingerprint: this.fingerprint() };
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
        .jenni-edge-panel{position:fixed;right:16px;bottom:72px;width:360px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.22);overflow:hidden;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border:1px solid #eef2f7}
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
        setTimeout(()=>this.openPanel(), 50);
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
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <input aria-label="ZIP code" class="zip-input" placeholder="ZIP" value="${this.config.zip}" style="flex:0 0 90px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px"/>
            <button class="zip-apply" style="padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer">Update</button>
            <button class="fingerprint-toggle" style="padding:4px 8px;border-radius:6px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer;font-size:11px;margin-left:auto">🔍</button>
          </div>
          <div class="jenni-edge-fingerprint" style="display:none;margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb"></div>
          <div class="jenni-edge-formula"></div>
          <div class="jenni-edge-node loading">Finding nearby stores…</div>
        </div>
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
      } catch {}
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
