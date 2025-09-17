/**
 * Store Selection Component
 * Handles store selection UI and state management
 */

class StoreSelector {
  constructor(options = {}) {
    this.options = {
      container: null,
      stores: [],
      selectedStore: null,
      onStoreSelect: null,
      onStoreDeselect: null,
      showDebugInfo: false,
      maxStores: 3,
      ...options
    };
    
    this.selectedStore = this.options.selectedStore;
    this.addressGenerator = new AddressGenerator();
  }

  /**
   * Render stores in the provided container
   * @param {HTMLElement} container - Container element
   * @param {Array} stores - Array of store objects
   */
  render(container, stores = []) {
    if (!container) {
      console.error('StoreSelector: No container provided');
      return;
    }

    this.container = container;
    this.stores = stores.slice(0, this.options.maxStores);
    
    container.innerHTML = '';

    if (!this.stores || !this.stores.length) {
      this.renderEmptyState(container);
      return;
    }

    this.stores.forEach(store => {
      const storeElement = this.createStoreElement(store);
      container.appendChild(storeElement);
    });
  }

  /**
   * Create a store selection element
   * @private
   */
  createStoreElement(store) {
    const row = document.createElement('div');
    row.className = 'jenni-edge-node';
    row.dataset.storeId = store.id || `store_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add click handler for store selection
    row.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectStore(store, row);
    });

    // Generate smart links and store info
    const storeInfo = this.generateStoreInfo(store);
    const debugBadges = this.generateDebugBadges(store);
    const debugInfo = this.generateDebugInfo(store);

    row.innerHTML = `
      <div style="flex: 1;">
        <div class="name">${storeInfo.nameHtml}${debugBadges}</div>
        <div class="meta">${storeInfo.metaInfo.join(' • ')}</div>
        ${debugInfo.map(info => `<div class="meta" style="font-size:11px;color:#6b7280;">${info}</div>`).join('')}
      </div>
      <div style="flex-shrink: 0;">
        <div style="font-size:13px;font-weight:600;color:#059669;text-align:right;">Available</div>
        ${store.stock ? `<div style="font-size:11px;color:#6b7280;text-align:right;">${store.stock} in stock</div>` : ''}
      </div>
      <div class="selection-indicator">✓</div>
    `;

    return row;
  }

  /**
   * Generate store information for display
   * @private
   */
  generateStoreInfo(store) {
    const storeName = store.name;
    const linkInfo = this.generateStoreLink(store);
    
    const nameHtml = linkInfo.href ? 
      `<a href="${linkInfo.href}" target="_blank" rel="noopener" style="color:#0f766e;text-decoration:none;font-weight:600" title="${linkInfo.title}">${storeName}</a>` :
      `<span style="color:#1D1D1F;font-weight:600">${storeName}</span>`;

    const metaInfo = [];
    if (store.distanceMiles) metaInfo.push(`${Math.round(store.distanceMiles * 10) / 10} mi away`);
    if (store.etaMinutes) metaInfo.push(`~${Math.round(store.etaMinutes)} min delivery`);

    return { nameHtml, metaInfo };
  }

  /**
   * Generate smart link for store
   * @private
   */
  generateStoreLink(store) {
    let linkHref = '';
    let linkTitle = '';
    const storeName = store.name;
    
    // Get product info for search (would come from parent context)
    const productTitle = this.options.productTitle || '';
    const styleCode = this.options.styleCode || '';
    const brand = this.options.brand || '';
    
    if (store.productUrl && /^https?:/i.test(store.productUrl)) {
      linkHref = store.productUrl;
      linkTitle = 'View product at store';
    } else if (store.website && /^https?:/i.test(store.website)) {
      const searchTerm = [brand, productTitle, styleCode].filter(Boolean).join(' ').trim();
      if (searchTerm) {
        linkHref = this.createSearchUrl(store.website, searchTerm);
        linkTitle = `Search for "${searchTerm}" at ${storeName}`;
      } else {
        linkHref = store.website;
        linkTitle = `Visit ${storeName} website`;
      }
    } else {
      const searchTerm = [storeName, brand, productTitle, styleCode].filter(Boolean).join(' ').trim();
      if (searchTerm) {
        linkHref = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
        linkTitle = `Search for product at ${storeName}`;
      }
    }
    
    return { href: linkHref, title: linkTitle };
  }

  /**
   * Create search URL for different store websites
   * @private
   */
  createSearchUrl(website, searchTerm) {
    const baseUrl = website.replace(/\/$/, '');
    const encodedTerm = encodeURIComponent(searchTerm);
    
    if (baseUrl.includes('target.com')) {
      return `${baseUrl}/s?searchTerm=${encodedTerm}`;
    } else if (baseUrl.includes('walmart.com')) {
      return `${baseUrl}/search?q=${encodedTerm}`;
    } else if (baseUrl.includes('bestbuy.com')) {
      return `${baseUrl}/site/searchpage.jsp?st=${encodedTerm}`;
    } else if (baseUrl.includes('homedepot.com')) {
      return `${baseUrl}/s/${encodedTerm}`;
    } else if (baseUrl.includes('lowes.com')) {
      return `${baseUrl}/search?searchTerm=${encodedTerm}`;
    } else if (baseUrl.includes('amazon.com')) {
      return `${baseUrl}/s?k=${encodedTerm}`;
    } else if (baseUrl.includes('costco.com')) {
      return `${baseUrl}/s?dept=All&keyword=${encodedTerm}`;
    } else if (baseUrl.includes('macys.com')) {
      return `${baseUrl}/shop/search?keyword=${encodedTerm}`;
    } else if (baseUrl.includes('nordstrom.com')) {
      return `${baseUrl}/sr?origin=keywordsearch&keyword=${encodedTerm}`;
    } else if (baseUrl.includes('kohls.com')) {
      return `${baseUrl}/catalog.jsp?search=${encodedTerm}`;
    } else if (baseUrl.includes('cvs.com')) {
      return `${baseUrl}/shop/search?searchTerm=${encodedTerm}`;
    } else if (baseUrl.includes('walgreens.com')) {
      return `${baseUrl}/search/results.jsp?Ntt=${encodedTerm}`;
    } else if (baseUrl.includes('riteaid.com')) {
      return `${baseUrl}/shop/search?searchTerm=${encodedTerm}`;
    } else {
      return `${baseUrl}/search?q=${encodedTerm}`;
    }
  }

  /**
   * Generate debug badges for store (only in debug mode)
   * @private
   */
  generateDebugBadges(store) {
    if (!this.options.showDebugInfo) return '';
    
    const pass = store.pgPass ? 
      '<span style="margin-left:6px;font-size:11px;color:#155e75;background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:2px 6px">✅ Pass</span>' : 
      '<span style="margin-left:6px;font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 6px">⏸️ Hold</span>';
    
    const productMatch = store.productMatch ? 
      '<span style="margin-left:4px;font-size:10px;color:#059669;background:#d1fae5;border:1px solid #a7f3d0;border-radius:4px;padding:1px 4px">🎯 Product</span>' : '';
    
    return pass + productMatch;
  }

  /**
   * Generate debug information for store
   * @private
   */
  generateDebugInfo(store) {
    if (!this.options.showDebugInfo) return [];
    
    return [
      `Profit: $${Math.round(store.margin || 0)} | Floor: $${Math.round(store.floor || 0)}`,
      store.score ? `Score: ${(store.score * 100).toFixed(0)}%` : ''
    ].filter(Boolean);
  }

  /**
   * Render empty state when no stores available
   * @private
   */
  renderEmptyState(container) {
    const empty = document.createElement('div');
    empty.className = 'jenni-edge-node';
    empty.textContent = 'No nearby stores found.';
    container.appendChild(empty);
  }

  /**
   * Select a store
   * @param {Object} store - Store object
   * @param {HTMLElement} element - DOM element for the store
   */
  selectStore(store, element) {
    // Remove selection from other stores
    if (this.container) {
      this.container.querySelectorAll('.jenni-edge-node').forEach(node => {
        node.classList.remove('selected');
      });
    }
    
    // Select this store
    element.classList.add('selected');
    
    const previousStore = this.selectedStore;
    this.selectedStore = {
      id: store.id || `store_${Math.random().toString(36).substr(2, 9)}`,
      name: store.name,
      address: this.addressGenerator.generateStoreAddress(store, this.options.userZip),
      etaMinutes: store.etaMinutes,
      distanceMiles: store.distanceMiles,
      website: store.website,
      productUrl: store.productUrl,
      margin: store.margin,
      stock: store.stock
    };
    
    // Trigger callbacks
    if (this.options.onStoreSelect) {
      this.options.onStoreSelect(this.selectedStore, previousStore);
    }
    
    if (previousStore && this.options.onStoreDeselect) {
      this.options.onStoreDeselect(previousStore);
    }
  }

  /**
   * Get currently selected store
   * @returns {Object|null} - Selected store object or null
   */
  getSelectedStore() {
    return this.selectedStore;
  }

  /**
   * Clear store selection
   */
  clearSelection() {
    if (this.container) {
      this.container.querySelectorAll('.jenni-edge-node').forEach(node => {
        node.classList.remove('selected');
      });
    }
    
    const previousStore = this.selectedStore;
    this.selectedStore = null;
    
    if (previousStore && this.options.onStoreDeselect) {
      this.options.onStoreDeselect(previousStore);
    }
  }

  /**
   * Update store list
   * @param {Array} stores - New array of stores
   */
  updateStores(stores) {
    this.stores = stores;
    if (this.container) {
      this.render(this.container, stores);
    }
  }

  /**
   * Set product context for better store links
   * @param {Object} product - Product information
   */
  setProductContext(product) {
    this.options.productTitle = product.title;
    this.options.styleCode = product.styleCode;
    this.options.brand = product.brand;
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.StoreSelector = StoreSelector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoreSelector;
}
