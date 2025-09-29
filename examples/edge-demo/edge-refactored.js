(() => {
  const JenniEdge = {
    // Configuration
    config: { 
      apiBase: '', 
      tenant: 'demo', 
      zip: '', 
      selector: 'body', 
      autoRefresh: true, 
      autoOpenPanel: true, 
      debug: false, 
      forceMock: false, 
      position: 'bottom-right', 
      offsetX: 16, 
      offsetY: 20, 
      keepOpenOnRefresh: true, 
      requestTimeoutMs: 10000, 
      mockData: { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 } 
    },

    // State
    state: { 
      data: null, 
      nodes: [], 
      selectedStore: null,
      pillEl: null
    },

    // Component instances
    components: {
      storeSelector: null,
      checkoutModal: null,
      addressGenerator: null,
      formValidators: null,
      productFingerprinting: null,
      panelManager: null,
      apiClient: null,
      pageWatcher: null
    },

    /**
     * Initialize JENNi Edge
     */
    async init(opts = {}) {
      this.config = { ...this.config, ...opts };

      // Auto-detect ZIP code if not provided
      if (!this.config.zip) {
        this.config.zip = await this._detectZip();
      }

      // Initialize components
      await this._initializeComponents();
      
      this._injectStyles();
      this._startWatching();
      await this.run();
      
      return this;
    },

    /**
     * Initialize all components
     */
    async _initializeComponents() {
      try {
        // Core components
        this.components.productFingerprinting = new (window.ProductFingerprinting || class { fingerprint() { return {}; } })();
        this.components.apiClient = new (window.APIClient || class { async resolve() { return this.config.mockData; } })(this.config);
        this.components.pageWatcher = new (window.PageWatcher || class { startWatching() {} })(this.config);
        
        // Panel manager with callbacks
        this.components.panelManager = new (window.PanelManager || class { createPill() { return document.createElement('div'); } })({
          ...this.config,
          onCheckout: (store) => this._openCheckout(store),
          onZipChange: (zip) => this._handleZipChange(zip),
          onRetailerClick: (retailerName, productTitle) => this._trackRetailerClick(retailerName, productTitle)
        });

        // Expose retailer tracking globally
        if (this.components.panelManager.exposeRetailerTracking) {
          this.components.panelManager.exposeRetailerTracking();
        }

        // UI components (with fallbacks)
        if (typeof AddressGenerator !== 'undefined') {
          this.components.addressGenerator = new AddressGenerator();
        }

        if (typeof FormValidators !== 'undefined') {
          this.components.formValidators = new FormValidators();
        }

        if (typeof StoreSelector !== 'undefined') {
          this.components.storeSelector = new StoreSelector({
            showDebugInfo: this.config.debug,
            userZip: this.config.zip,
            onStoreSelect: (store) => this._handleStoreSelect(store),
            // Pass product data for link generation
            productTitle: '',
            brand: '',
            styleCode: ''
          });
        }

        if (typeof CheckoutModal !== 'undefined') {
          this.components.checkoutModal = new CheckoutModal({
            userZip: this.config.zip,
            addressGenerator: this.components.addressGenerator,
            formValidators: this.components.formValidators
          });
        }

        console.debug('[JenniEdge] Components initialized');
      } catch (error) {
        console.error('[JenniEdge] Component initialization failed:', error);
      }
    },

    /**
     * Start page watching
     */
    _startWatching() {
      this.components.pageWatcher.startWatching({
        onSignatureChange: () => this._handlePageChange(),
        onNavigation: () => this._handleNavigation()
      });
    },

    /**
     * Handle page changes
     */
    _handlePageChange() {
      if (this.config.autoRefresh) {
        this.run();
      }
    },

    /**
     * Handle navigation
     */
    _handleNavigation() {
      this._removePill();
      if (this.config.autoRefresh) {
        setTimeout(() => this.run(), 100);
      }
    },

    /**
     * Handle ZIP code changes
     */
    _handleZipChange(zip) {
      this.config.zip = zip;
      this.run();
    },

    /**
     * Handle store selection
     */
    _handleStoreSelect(store) {
      this.state.selectedStore = store;
      console.debug('[JenniEdge] Store selected:', store);
    },

    /**
     * Main execution - check eligibility and show UI
     */
    async run() {
      try {
        this._removePill();

        // Get product fingerprint
        const fingerprint = this.components.productFingerprinting.fingerprint();
        
        if (!fingerprint.gtin && !fingerprint.sku && !fingerprint.title) {
          console.debug('[JenniEdge] No product detected');
          return;
        }

        console.debug('[JenniEdge] Product fingerprint:', fingerprint);

        // Get eligibility data
        const data = await this.components.apiClient.resolve(fingerprint, this.config.zip);
        this.state.data = data;

        console.debug('[JenniEdge] Resolve response:', data);

        // Create and show pill
        this._showPill(data);

        // Auto-open panel if configured
        if (this.config.autoOpenPanel && data?.eligible) {
          setTimeout(() => this.components.panelManager.openPanel(), 500);
        }

      } catch (error) {
        console.error('[JenniEdge] Run error:', error);
        
        // Show error state if in debug mode
        if (this.config.debug) {
          this._showPill({ eligible: false, error: error.message });
        }
      }
    },

    /**
     * Show the main pill UI
     */
    _showPill(data) {
      this._removePill();
      
      const pill = this.components.panelManager.createPill(data);
      pill.addEventListener('click', () => this._openPanel(data));
      
      document.body.appendChild(pill);
      this.state.pillEl = pill;
    },

    /**
     * Open the main panel
     */
    async _openPanel(data) {
      // Set up panel manager with store rendering
      this.components.panelManager.renderStores = async (panel) => {
        await this._renderStores(panel);
      };
      
      // Set product data for retailer links
      const fingerprint = this.components.productFingerprinting.fingerprint();
      if (this.components.panelManager.setProductData) {
        this.components.panelManager.setProductData({
          title: fingerprint.title,
          brand: fingerprint.brand,
          category: this._getProductCategory(fingerprint)
        });
      }
      
      this.components.panelManager.state.data = data;
      await this.components.panelManager.openPanel();
    },

    /**
     * Render stores in panel
     */
    async _renderStores(panel) {
      const body = panel.querySelector('.jenni-edge-body');
      if (!body) return;

      try {
        // Fetch stores
        const nodes = await this._fetchStores();
        this.state.nodes = nodes;

        if (!nodes || nodes.length === 0) {
          body.innerHTML = '<div style="padding:12px;text-align:center;color:#6b7280;">No nearby stores found</div>';
          return;
        }

        // Use StoreSelector component if available
        if (this.components.storeSelector) {
          // Update StoreSelector with current product data
          const fingerprint = this.components.productFingerprinting.fingerprint();
          this.components.storeSelector.updateProductData({
            title: fingerprint.title || '',
            brand: fingerprint.brand || '',
            styleCode: fingerprint.styleCode || ''
          });
          
          this.components.storeSelector.renderStores(body, nodes);
        } else {
          // Fallback rendering
          body.innerHTML = nodes.map(store => `
            <div class="jenni-edge-node" style="padding:8px;border-bottom:1px solid #eee;cursor:pointer;">
              <div style="font-weight:600;">${store.name}</div>
              <div style="font-size:12px;color:#6b7280;">${store.address || ''}</div>
              <div style="font-size:11px;color:#6b7280;">
                ${store.distanceMiles ? Math.round(store.distanceMiles * 10) / 10 + ' mi away' : ''} • 
                ${store.etaMinutes ? '~' + Math.round(store.etaMinutes) + ' min delivery' : ''}
              </div>
            </div>
          `).join('');
        }

        // Update panel
        this.components.panelManager.updatePanel(this.state.data);

      } catch (error) {
        console.error('[JenniEdge] Store rendering error:', error);
        body.innerHTML = '<div style="padding:12px;text-align:center;color:#ef4444;">Failed to load stores</div>';
      }
    },

    /**
     * Fetch stores from API
     */
    async _fetchStores() {
      if (!this.config.apiBase || this.config.forceMock) {
        // Mock data
        return [
          { id: 'demo_1', name: 'Downtown Electronics', address: '123 Main St, Downtown', etaMinutes: 90, distanceMiles: 3.2, stock: 7 },
          { id: 'demo_2', name: 'Uptown Best Buy', address: '456 Oak Ave, Uptown', etaMinutes: 120, distanceMiles: 5.1, stock: 4 },
        ];
      }

      const fingerprint = this.state.data?.fingerprint || {};
      return this.components.apiClient.getPlaces(
        this.config.zip,
        fingerprint.title || 'electronics',
        fingerprint.brand || '',
        fingerprint.styleCode || '',
        this.config.accuracyProbe
      );
    },

    /**
     * Open checkout modal
     */
    _openCheckout(store) {
      if (this.components.checkoutModal && store) {
        this.components.checkoutModal.open({
          selectedStore: store,
          productData: this.state.data?.fingerprint || {},
          deliveryData: this.state.data || {}
        });
      }
    },

    /**
     * Remove pill from DOM
     */
    _removePill() {
      if (this.state.pillEl) {
        this.state.pillEl.remove();
        this.state.pillEl = null;
      }
    },

    /**
     * Get product category for retailer prioritization
     */
    _getProductCategory(fingerprint) {
      const { title = '', brand = '' } = fingerprint;
      const titleLower = title.toLowerCase();
      const brandLower = brand.toLowerCase();

      if (brandLower.includes('apple') || titleLower.includes('iphone') || titleLower.includes('ipad') || titleLower.includes('macbook')) {
        return 'apple';
      }
      if (titleLower.includes('phone') || titleLower.includes('laptop') || titleLower.includes('tablet') || titleLower.includes('computer')) {
        return 'electronics';
      }
      if (titleLower.includes('clothing') || titleLower.includes('shirt') || titleLower.includes('pants') || titleLower.includes('dress')) {
        return 'clothing';
      }
      
      return 'general';
    },

    /**
     * Track retailer click for analytics
     */
    _trackRetailerClick(retailerName, productTitle) {
      if (this.config.debug) {
        console.log(`[JenniEdge] Retailer clicked: ${retailerName} for product: ${productTitle}`);
      }

      // Send to analytics if available
      try {
        if (typeof gtag !== 'undefined') {
          gtag('event', 'retailer_navigation', {
            retailer_name: retailerName,
            product_title: productTitle,
            event_category: 'jenni_edge'
          });
        }
      } catch (error) {
        console.debug('[JenniEdge] Analytics error:', error);
      }
    },

    /**
     * Detect ZIP code
     */
    async _detectZip() {
      if (this.components.apiClient) {
        return this.components.apiClient.detectZipByIP();
      }
      
      // Fallback
      const stored = localStorage.getItem('jenni_zip_preference');
      return stored || '10001';
    },

    /**
     * Inject CSS styles
     */
    _injectStyles() {
      if (document.querySelector('#jenni-edge-styles')) return;

      const css = `
        .jenni-edge-pill {
          background: linear-gradient(135deg, #0f766e 0%, #059669 100%);
          color: white;
          padding: 10px 14px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.3);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          max-width: 200px;
          transition: all 0.2s ease;
        }
        .jenni-edge-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 118, 110, 0.4);
        }
        .jenni-edge-panel {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          width: 320px;
          max-height: 400px;
          overflow: hidden;
        }
        .jenni-edge-head {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
          background: #fafafa;
        }
        .jenni-edge-body {
          max-height: 200px;
          overflow-y: auto;
        }
        .jenni-edge-foot {
          padding: 12px;
          border-top: 1px solid #f3f4f6;
          background: #fafafa;
        }
        .jenni-edge-node {
          padding: 10px 12px;
          border-bottom: 1px solid #f3f4f6;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .jenni-edge-node:hover {
          background: #f9fafb;
        }
        .jenni-edge-node .name {
          font-weight: 600;
          margin-bottom: 4px;
        }
        .jenni-edge-node .meta {
          font-size: 11px;
          color: #6b7280;
        }
      `;

      const style = document.createElement('style');
      style.id = 'jenni-edge-styles';
      style.textContent = css;
      document.head.appendChild(style);
    }
  };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => JenniEdge.init());
  } else {
    JenniEdge.init();
  }

  // Expose globally
  window.JenniEdge = JenniEdge;
})();
