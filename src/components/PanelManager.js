/**
 * Panel Management Component
 * Handles the main JENNi panel display, positioning, and interactions
 */
class PanelManager {
  constructor(config = {}) {
    this.config = {
      position: 'bottom-right',
      offsetX: 16,
      offsetY: 20,
      showRetailerLinks: true,
      ...config
    };
    
    this.state = {
      panelOpen: false,
      panelEl: null,
      openedOnce: false
    };

    // Initialize retailer navigation if available
    this.retailerNavigation = null;
    if (typeof RetailerNavigation !== 'undefined') {
      this.retailerNavigation = new RetailerNavigation({
        trackClicks: this.config.debug,
        onRetailerClick: this.config.onRetailerClick
      });
    }
  }

  /**
   * Create and display the main pill/button
   */
  createPill(data) {
    const ok = !!data?.eligible;
    const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');
    const preview = !!this.config.forceMock || !!data?.preview;
    const pill = document.createElement('div');
    
    pill.className = 'jenni-edge-pill';
    pill.style.cssText = this.getPillPositionStyles();

    const pg = data?.profitGuard || null;
    const titleTxt = cta === 'arrives_today' ? 'Arrives Today' : (cta === 'pickup_today' ? 'Pickup Today' : 'Fast shipping available');
    const subParts = [];
    const eta = this.etaText(data);
    
    if (eta) subParts.push(eta);
    if (preview) subParts.push('(Preview)');
    if (this.config.debug && pg) {
      subParts.push(`$${Math.round(pg.margin||0)} margin`);
    }
    
    const subTxt = subParts.join(' • ');
    
    pill.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:16px;">🚚</div>
        <div>
          <div style="font-weight:600;font-size:13px;line-height:1.2;">${titleTxt}</div>
          ${subTxt ? `<div style="font-size:11px;color:#6b7280;line-height:1.2;">${subTxt}</div>` : ''}
        </div>
      </div>
    `;

    const open = (e) => { 
      try { 
        e.preventDefault(); 
        e.stopPropagation(); 
      } catch(_){} 
      this.openPanel(); 
    };
    
    pill.addEventListener('click', open);
    pill.addEventListener('touchstart', open, { passive: false });

    return pill;
  }

  /**
   * Get CSS styles for pill positioning
   */
  getPillPositionStyles() {
    const pos = String(this.config.position || 'bottom-right');
    const x = (this.config.offsetX ?? 16) + 'px';
    const y = (this.config.offsetY ?? 20) + 'px';
    
    const baseStyles = 'position:fixed;z-index:2147483647;cursor:pointer;';
    
    if (pos.includes('bottom')) return baseStyles + `bottom:${y};` + (pos.includes('right') ? `right:${x};` : `left:${x};`);
    return baseStyles + `top:${y};` + (pos.includes('right') ? `right:${x};` : `left:${x};`);
  }

  /**
   * Format ETA text consistently
   */
  etaText(data) {
    if (!data?.etaMinutes) return null;
    return this.formatDeliveryTime(data.etaMinutes);
  }

  /**
   * Helper function to format delivery time consistently
   */
  formatDeliveryTime(etaMinutes) {
    if (!etaMinutes) return '';
    
    const mins = Math.round(etaMinutes);
    const now = new Date();
    const eta = new Date(now.getTime() + mins * 60000);
    const sameDay = now.toDateString() === eta.toDateString();
    const opts = { hour: 'numeric', minute: '2-digit' };
    const when = eta.toLocaleTimeString([], opts);
    
    return sameDay ? `by ${when}` : `by ${when} tomorrow`;
  }

  /**
   * Open the main panel
   */
  async openPanel() {
    if (this.state.panelOpen) return;
    
    this.state.panelOpen = true;
    this.state.openedOnce = true;

    const data = this.state.data || {};
    const ok = !!data.eligible;
    const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');

    // Remove existing panel
    const existing = document.querySelector('.jenni-edge-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'jenni-edge-panel';
    panel.style.cssText = this.getPanelPositionStyles();

    const pg = data && data.profitGuard ? data.profitGuard : null;
    const profitTitle = pg ? `Margin $${Math.round(pg.margin||0)} vs target $${Math.round(pg.floor||0)}` : '';
    const panelTitle = cta === 'arrives_today' ? 'Local delivery' : (cta === 'pickup_today' ? 'Pickup options' : 'Fast delivery options');
    const ctaText = cta === 'arrives_today' ? 'Deliver with JENNi' : (cta === 'pickup_today' ? 'Pick up today' : 'Deliver with JENNi');

    panel.innerHTML = this.getPanelHTML(panelTitle, ctaText, profitTitle);
    document.body.appendChild(panel);
    this.state.panelEl = panel;

    // Setup panel interactions
    this.setupPanelInteractions(panel);

    // Inject retailer navigation styles if available
    if (this.retailerNavigation) {
      this._injectRetailerStyles();
    }

    // Load and render stores
    await this.renderStores(panel);
  }

  /**
   * Get CSS styles for panel positioning
   */
  getPanelPositionStyles() {
    const pos = String(this.config.position || 'bottom-right');
    const x = (this.config.offsetX ?? 16) + 'px';
    const y = (this.config.offsetY ?? 20) + 'px';
    
    const baseStyles = 'position:fixed;z-index:2147483646;';
    
    if (pos.includes('bottom')) return baseStyles + `bottom:${y};` + (pos.includes('right') ? `right:${x};` : `left:${x};`);
    return baseStyles + `top:${y};` + (pos.includes('right') ? `right:${x};` : `left:${x};`);
  }

  /**
   * Get panel HTML structure
   */
  getPanelHTML(panelTitle, ctaText, profitTitle) {
    // Generate retailer links if enabled and available
    let retailerLinksHTML = '';
    if (this.config.showRetailerLinks && this.retailerNavigation && this.state.productData) {
      retailerLinksHTML = this.retailerNavigation.renderRetailerLinks(this.state.productData);
    }

    return `
      <div class="jenni-edge-head">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="font-size:16px;">🚚</div>
            <div>
              <div style="font-weight:600;font-size:14px;">${panelTitle}</div>
              ${this.config.debug && profitTitle ? `<div style="font-size:10px;color:#6b7280;" title="${profitTitle}">Economics: ${profitTitle}</div>` : ''}
            </div>
          </div>
          <button class="jenni-edge-close" style="background:none;border:none;font-size:16px;cursor:pointer;color:#6b7280;">✕</button>
        </div>
        <div style="margin-top:8px;">
          <input type="text" class="zip-input" placeholder="Enter ZIP code" 
                 style="width:80px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;font-size:12px;" 
                 value="${this.config.zip || ''}" maxlength="10">
          <button class="apply-zip" style="margin-left:6px;padding:4px 8px;background:#0f766e;color:white;border:none;border-radius:4px;font-size:11px;cursor:pointer;">Apply</button>
        </div>
      </div>
      ${retailerLinksHTML}
      <div class="jenni-edge-body">Loading nearby stores...</div>
      <div class="jenni-edge-foot">
        <button class="jenni-edge-cta" style="width:100%;padding:8px;background:#0f766e;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;">${ctaText}</button>
        <div class="jenni-edge-eta" style="font-size:11px;color:#6b7280;text-align:center;margin-top:4px;"></div>
        ${this.config.debug ? '<div class="jenni-edge-formula" style="font-size:10px;color:#6b7280;margin-top:4px;"></div>' : ''}
      </div>
    `;
  }

  /**
   * Setup panel interaction handlers
   */
  setupPanelInteractions(panel) {
    // Close button
    const closeBtn = panel.querySelector('.jenni-edge-close');
    closeBtn?.addEventListener('click', () => this.closePanel());

    // ZIP code handling
    const zipInput = panel.querySelector('.zip-input');
    const applyZip = () => {
      const z = zipInput.value.replace(/[^0-9]/g,'').slice(0,10);
      if (z.length >= 3) {
        this.config.zip = z;
        localStorage.setItem('jenni_zip_preference', z);
        this.refreshData();
      }
    };

    panel.querySelector('.apply-zip')?.addEventListener('click', applyZip);
    zipInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') applyZip();
    });

    // CTA button
    const ctaBtn = panel.querySelector('.jenni-edge-cta');
    ctaBtn?.addEventListener('click', () => {
      if (this.config.onCheckout) {
        this.config.onCheckout(this.state.selectedStore);
      }
    });

    // Update debug info if available
    if (this.config.debug) {
      const pgNow = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
      const formulaEl = panel.querySelector('.jenni-edge-formula');
      if (formulaEl && pgNow) {
        const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
        formulaEl.innerHTML = `PDP $${r(pgNow.price)} → Buy $${r(pgNow.landed_cost)} + Courier $${r(pgNow.courier_est)} + Fee $${r(pgNow.fee)} = $${r(pgNow.margin)} margin (need $${r(pgNow.floor)})`;
      }
    }
  }

  /**
   * Close panel
   */
  closePanel() {
    this.state.panelOpen = false;
    if (this.state.panelEl) {
      this.state.panelEl.remove();
      this.state.panelEl = null;
    }
  }

  /**
   * Update ZIP code
   */
  updateZip(newZip) {
    const z = (newZip||'').replace(/[^0-9]/g,'').slice(0,5); // Limit to 5 digits for US ZIP
    if (z.length >= 3) {
      this.config.zip = z;
      localStorage.setItem('jenni_zip_preference', z);
      
      if (this.config.debug) {
        console.log('[PanelManager] ZIP updated to:', z);
      }
      
      // Update UI
      if (this.state.panelEl) {
        const input = this.state.panelEl.querySelector('.zip-input');
        if (input) input.value = z;
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = 'Loading nearby stores...';
        const foot = this.state.panelEl.querySelector('.jenni-edge-foot');
        if (foot) foot.style.display = 'none';
      }
      
      // Trigger refresh
      if (this.config.onZipChange) {
        this.config.onZipChange(z);
      }
    }
  }

  /**
   * Render stores in panel (placeholder - to be implemented by caller)
   */
  async renderStores(panel) {
    // This method should be overridden or extended by the main application
    const body = panel.querySelector('.jenni-edge-body');
    if (body) {
      body.innerHTML = '<div style="padding:12px;text-align:center;color:#6b7280;">No stores available</div>';
    }
  }

  /**
   * Update panel with new data
   */
  updatePanel(data) {
    this.state.data = data;
    
    if (!this.state.panelEl) return;
    
    const body = this.state.panelEl.querySelector('.jenni-edge-body');
    const etaEl = this.state.panelEl.querySelector('.jenni-edge-eta');
    const foot = this.state.panelEl.querySelector('.jenni-edge-foot');
    
    if (etaEl && data?.etaMinutes) {
      etaEl.textContent = this.formatDeliveryTime(data.etaMinutes);
    }
    
    if (foot) foot.style.display = 'block';
    
    // Update debug formula if available
    if (this.config.debug) {
      const formulaEl = this.state.panelEl.querySelector('.jenni-edge-formula');
      if (formulaEl && data?.profitGuard) {
        const pg = data.profitGuard;
        const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
        formulaEl.innerHTML = `PDP $${r(pg.price)} → Buy $${r(pg.landed_cost)} + Courier $${r(pg.courier_est)} + Fee $${r(pg.fee)} = $${r(pg.margin)} margin (need $${r(pg.floor)})`;
      }
    }
  }

  /**
   * Set product data for retailer links
   */
  setProductData(productData) {
    this.state.productData = productData;
  }

  /**
   * Inject retailer navigation styles
   */
  _injectRetailerStyles() {
    if (document.querySelector('#jenni-retailer-styles')) return;

    const style = document.createElement('style');
    style.id = 'jenni-retailer-styles';
    style.textContent = this.retailerNavigation.getStyles();
    document.head.appendChild(style);
  }

  /**
   * Expose retailer click tracking globally
   */
  exposeRetailerTracking() {
    if (this.retailerNavigation && typeof window !== 'undefined') {
      if (!window.JenniEdge) window.JenniEdge = {};
      window.JenniEdge.trackRetailerClick = (retailerName, productTitle) => {
        this.retailerNavigation.trackRetailerClick(retailerName, productTitle);
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PanelManager;
}
