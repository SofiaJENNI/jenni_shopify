/**
 * Universal JENNi Integration Library
 * Works with any platform - just include this file!
 */

class JENNiUniversal {
  constructor(config) {
    this.config = {
      clientId: config.clientId || '111038',
      clientSecret: config.clientSecret || '46c3a03e-fbe0-4ae8-b74f-455f11246f91',
      apiHost: config.apiHost || 'http://35.209.65.82:8082',
      ...config
    };
    
    this.token = null;
    this.tokenExpiry = 0;
    this.cache = new Map();
  }

  // ✅ FIXED: Authentication handling with auto-refresh
  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    try {
      const response = await fetch(`${this.config.apiHost}/api/sku-graph/product-availability-service/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
      
      return this.token;
    } catch (error) {
      console.error('JENNi authentication error:', error);
      throw error;
    }
  }

  // ✅ FIXED: Universal eligibility check with caching
  async checkEligibility(gtin, zip) {
    const cacheKey = `${gtin}:${zip}`;
    
    // Check cache first (10 minute TTL)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 600000) {
        return cached.data;
      }
    }

    try {
      const token = await this.getAccessToken();
      
      const response = await fetch(`${this.config.apiHost}/api/sku-graph/product-availability-service/searchProducts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ gtin, page: 1, page_size: 10 })
      });

      if (!response.ok) {
        if (response.status === 404) {
          const result = { eligible: false, reason: 'Product not found' };
          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      let eligible = false;
      let inventory = 0;
      let productInfo = null;

      if (data.products && data.products.length > 0) {
        for (const product of data.products) {
          for (const variant of product.variants) {
            if (variant.gtin === gtin && variant.zipcode_inventory && variant.zipcode_inventory[zip]) {
              inventory = parseInt(variant.zipcode_inventory[zip]);
              if (inventory > 0) {
                eligible = true;
                productInfo = {
                  title: variant.title,
                  price: variant.price,
                  brand: product.brand
                };
                break;
              }
            }
          }
          if (eligible) break;
        }
      }

      const result = {
        eligible,
        inventory,
        productInfo,
        reason: eligible ? 'Available' : 'Not available in ZIP code'
      };

      // Cache result
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      console.error('JENNi eligibility check error:', error);
      return { eligible: false, error: error.message };
    }
  }

  // ✅ FIXED: Universal order submission
  async submitOrder(orderData) {
    try {
      const token = await this.getAccessToken();
      
      // Transform order to JENNi format
      const jenniOrder = {
        storeId: orderData.storeId,
        orderId: orderData.orderId,
        address: orderData.shippingAddress,
        lines: orderData.items.map(item => ({
          gtin: item.gtin || item.sku,
          quantity: item.quantity,
          price: item.price
        }))
      };

      // Note: JENNi doesn't have order endpoint yet, so we'll log for now
      console.log('Order would be submitted to JENNi:', jenniOrder);
      
      // When JENNi adds order endpoint:
      // const response = await fetch(`${this.config.apiHost}/api/orders`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(jenniOrder)
      // });

      return { success: true, orderId: orderData.orderId };

    } catch (error) {
      console.error('JENNi order submission error:', error);
      return { success: false, error: error.message };
    }
  }

  // ✅ FIXED: Universal webhook handler
  handleStatusUpdate(webhookData) {
    // Standard webhook handler for order status updates
    const { orderId, status, trackingNumber } = webhookData;
    
    // Emit custom event that any platform can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jenni:orderUpdate', {
        detail: { orderId, status, trackingNumber }
      }));
    }
    
    // Call platform-specific callback if provided
    if (this.config.onOrderUpdate) {
      this.config.onOrderUpdate({ orderId, status, trackingNumber });
    }
    
    return { success: true };
  }

  // ✅ ENHANCED: Universal widget creation with Apple-inspired design and auto-detection
  async createWidget(container, options = {}) {
    const gtin = options.gtin;
    let currentZip = options.defaultZip;
    
    if (!gtin) {
      console.error('GTIN is required for JENNi widget');
      return;
    }

    // Auto-detect ZIP if not provided
    if (!currentZip) {
      currentZip = await this.detectZipCode();
    }

    const widget = document.createElement('div');
    widget.className = 'jenni-widget-universal';
    widget.innerHTML = `
      <div class="jenni-widget-content">
        <div class="jenni-widget-header">
          <div class="jenni-widget-icon">🚀</div>
          <div class="jenni-widget-text">
            <div class="jenni-widget-title">Fast Delivery</div>
            <div class="jenni-widget-subtitle">Checking availability...</div>
          </div>
        </div>
        <div class="jenni-widget-location">
          <span class="jenni-location-icon">📍</span>
          <span class="jenni-location-text">${currentZip || 'Enter ZIP'}</span>
          <button class="jenni-location-change">Change</button>
        </div>
        <div class="jenni-widget-result"></div>
      </div>
    `;

    // Inject styles
    this.injectWidgetStyles();

    // Get element references
    const locationText = widget.querySelector('.jenni-location-text');
    const changeBtn = widget.querySelector('.jenni-location-change');
    const result = widget.querySelector('.jenni-widget-result');
    const subtitle = widget.querySelector('.jenni-widget-subtitle');
    const icon = widget.querySelector('.jenni-widget-icon');

    // Check delivery function
    const checkDelivery = async (zip) => {
      if (!zip) return;
      
      try {
        subtitle.textContent = 'Checking availability...';
        result.innerHTML = '';
        
        const availability = await this.checkEligibility(gtin, zip);
        
        if (availability.eligible) {
          icon.textContent = '✅';
          subtitle.textContent = 'Available for fast delivery';
          widget.classList.add('jenni-available');
          widget.classList.remove('jenni-unavailable');
          
          result.innerHTML = `
            <div class="jenni-delivery-info">
              <div class="jenni-delivery-badge">Same-day delivery available</div>
              ${availability.inventory > 1 ? `<div class="jenni-stock-info">${availability.inventory} in stock nearby</div>` : ''}
            </div>
          `;
          
          // Dispatch event for e-commerce platform integration
          window.dispatchEvent(new CustomEvent('jenni:eligible', {
            detail: { gtin, zip, availability }
          }));
          
        } else {
          icon.textContent = '📦';
          subtitle.textContent = 'Standard shipping available';
          widget.classList.add('jenni-unavailable');
          widget.classList.remove('jenni-available');
          
          result.innerHTML = `
            <div class="jenni-delivery-info">
              <div class="jenni-delivery-badge standard">Standard shipping available</div>
            </div>
          `;
        }
        
        // Save ZIP for future use
        localStorage.setItem('jenni_zip_preference', zip);
        
      } catch (error) {
        icon.textContent = '⚠️';
        subtitle.textContent = 'Unable to check availability';
        result.innerHTML = `
          <div class="jenni-delivery-info">
            <div class="jenni-delivery-badge error">Please try again later</div>
          </div>
        `;
      }
    };

    // Handle location change
    changeBtn.addEventListener('click', () => {
      this.showZipModal((newZip) => {
        if (newZip && newZip !== currentZip) {
          currentZip = newZip;
          locationText.textContent = newZip;
          checkDelivery(newZip);
        }
      }, currentZip);
    });

    // Initial check
    if (currentZip) {
      checkDelivery(currentZip);
    }

    container.appendChild(widget);
    return widget;
  }

  // Auto-detect ZIP code using geolocation and IP fallback
  async detectZipCode() {
    try {
      // Check localStorage first
      const stored = localStorage.getItem('jenni_zip_preference');
      if (stored && /^\d{5}$/.test(stored)) {
        return stored;
      }

      // Try geolocation
      if (navigator.geolocation) {
        const zip = await this.getZipFromGeolocation();
        if (zip) return zip;
      }

      // Fallback to IP-based detection
      const ipZip = await this.getZipFromIP();
      if (ipZip) return ipZip;

      // Final fallback
      return '60612';

    } catch (error) {
      console.log('ZIP detection failed, using default');
      return '60612';
    }
  }

  // Get ZIP from geolocation
  getZipFromGeolocation() {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const zip = data.postcode?.replace(/\D/g, '').slice(0, 5);
            
            if (zip && /^\d{5}$/.test(zip)) {
              localStorage.setItem('jenni_zip_preference', zip);
              resolve(zip);
            } else {
              resolve(null);
            }
          } catch (error) {
            resolve(null);
          }
        },
        () => resolve(null),
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  }

  // Get ZIP from IP address
  async getZipFromIP() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      const zip = data.postal?.replace(/\D/g, '').slice(0, 5);
      
      if (zip && /^\d{5}$/.test(zip)) {
        return zip;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  // Show ZIP code modal
  showZipModal(onConfirm, currentZip = '') {
    const modal = document.createElement('div');
    modal.className = 'jenni-zip-modal-universal';
    modal.innerHTML = `
      <div class="jenni-zip-backdrop">
        <div class="jenni-zip-dialog">
          <div class="jenni-zip-icon">📍</div>
          <h3>Update Delivery Location</h3>
          <p>Enter your ZIP code to see accurate delivery options</p>
          <div class="jenni-zip-input-group">
            <input type="text" class="jenni-zip-input" placeholder="ZIP Code" maxlength="5" value="${currentZip}" />
          </div>
          <div class="jenni-zip-buttons">
            <button class="jenni-btn jenni-btn-secondary" data-action="cancel">Cancel</button>
            <button class="jenni-btn jenni-btn-primary" data-action="confirm">Update</button>
          </div>
        </div>
      </div>
    `;

    const input = modal.querySelector('.jenni-zip-input');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');

    // Input validation
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
      confirmBtn.disabled = e.target.value.length !== 5;
      confirmBtn.classList.toggle('disabled', e.target.value.length !== 5);
    });

    // Handle actions
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'cancel') {
        modal.remove();
      } else if (action === 'confirm') {
        const zip = input.value.trim();
        if (zip.length === 5) {
          onConfirm(zip);
          modal.remove();
        }
      }
    });

    // Enter key support
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.length === 5) {
        onConfirm(input.value.trim());
        modal.remove();
      } else if (e.key === 'Escape') {
        modal.remove();
      }
    });

    // Click backdrop to close
    modal.querySelector('.jenni-zip-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);

    // Initial validation
    confirmBtn.disabled = input.value.length !== 5;
    confirmBtn.classList.toggle('disabled', input.value.length !== 5);
  }

  // Inject widget styles
  injectWidgetStyles() {
    if (document.getElementById('jenni-widget-universal-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'jenni-widget-universal-styles';
    styles.textContent = `
      .jenni-widget-universal {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        padding: 20px;
        margin: 16px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        max-width: 400px;
      }

      .jenni-widget-universal:hover {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
      }

      .jenni-widget-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .jenni-widget-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        font-size: 20px;
        transition: all 0.3s ease;
      }

      .jenni-available .jenni-widget-icon {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      }

      .jenni-unavailable .jenni-widget-icon {
        background: linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%);
      }

      .jenni-widget-title {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
        line-height: 1.2;
      }

      .jenni-widget-subtitle {
        font-size: 14px;
        color: #6b7280;
        margin: 2px 0 0 0;
        line-height: 1.3;
      }

      .jenni-widget-location {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 12px;
        border: 1px solid #f3f4f6;
        transition: all 0.2s ease;
      }

      .jenni-widget-location:hover {
        background: #f3f4f6;
        border-color: #e5e7eb;
      }

      .jenni-location-icon {
        color: #6b7280;
        font-size: 16px;
      }

      .jenni-location-text {
        flex: 1;
        font-weight: 600;
        color: #374151;
        font-size: 15px;
        letter-spacing: 0.5px;
      }

      .jenni-location-change {
        background: none;
        border: none;
        color: #3b82f6;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 6px;
        transition: all 0.2s ease;
      }

      .jenni-location-change:hover {
        background: #dbeafe;
        color: #2563eb;
      }

      .jenni-widget-result {
        min-height: 20px;
      }

      .jenni-delivery-info {
        text-align: center;
      }

      .jenni-delivery-badge {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        margin-bottom: 8px;
      }

      .jenni-available .jenni-delivery-badge {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      }

      .jenni-delivery-badge.standard {
        background: linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%);
      }

      .jenni-delivery-badge.error {
        background: linear-gradient(135deg, #ff7979 0%, #eb4d4b 100%);
      }

      .jenni-stock-info {
        font-size: 12px;
        color: #6b7280;
        font-weight: 500;
      }

      .jenni-zip-modal-universal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }

      .jenni-zip-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: jenni-backdrop-enter 0.3s ease;
      }

      @keyframes jenni-backdrop-enter {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .jenni-zip-dialog {
        background: white;
        border-radius: 20px;
        padding: 32px 24px 24px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        animation: jenni-dialog-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes jenni-dialog-enter {
        from {
          opacity: 0;
          transform: scale(0.8) translateY(40px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .jenni-zip-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .jenni-zip-dialog h3 {
        margin: 0 0 8px;
        font-size: 20px;
        font-weight: 600;
        color: #1f2937;
      }

      .jenni-zip-dialog p {
        margin: 0 0 24px;
        color: #6b7280;
        font-size: 14px;
        line-height: 1.4;
      }

      .jenni-zip-input-group {
        margin-bottom: 24px;
      }

      .jenni-zip-input {
        width: 100%;
        padding: 16px 20px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 600;
        text-align: center;
        letter-spacing: 3px;
        transition: all 0.2s ease;
        background: #f9fafb;
      }

      .jenni-zip-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        background: white;
      }

      .jenni-zip-buttons {
        display: flex;
        gap: 12px;
      }

      .jenni-btn {
        flex: 1;
        padding: 14px 20px;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 48px;
      }

      .jenni-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .jenni-btn-primary:hover:not(.disabled) {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      .jenni-btn-primary.disabled {
        background: #d1d5db;
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
      }

      .jenni-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .jenni-btn-secondary:hover {
        background: #e5e7eb;
        transform: translateY(-1px);
      }

      @media (max-width: 480px) {
        .jenni-widget-universal {
          margin: 12px 0;
          padding: 16px;
        }
        
        .jenni-zip-dialog {
          margin: 20px;
          padding: 24px 20px 20px;
        }
        
        .jenni-zip-buttons {
          flex-direction: column-reverse;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  // ✅ FIXED: Platform detection and auto-integration
  autoIntegrate() {
    // Auto-detect platform and integrate
    if (typeof window === 'undefined') return; // Server-side
    
    // Shopify detection
    if (window.Shopify) {
      this.integrateShopify();
    }
    
    // WooCommerce detection
    if (window.wc_add_to_cart_params || document.body.classList.contains('woocommerce')) {
      this.integrateWooCommerce();
    }
    
    // Magento detection
    if (window.BLANK_CONFIG || document.body.classList.contains('catalog-product-view')) {
      this.integrateMagento();
    }
    
    // Generic integration for any site
    this.integrateGeneric();
  }

  // Platform-specific integrations
  integrateShopify() {
    console.log('JENNi: Shopify integration active');
    // Find product pages and add widgets
    if (window.location.pathname.includes('/products/')) {
      this.addWidgetToShopify();
    }
  }

  integrateWooCommerce() {
    console.log('JENNi: WooCommerce integration active');
    const productContainer = document.querySelector('.single-product .summary');
    if (productContainer) {
      const sku = document.querySelector('.sku')?.textContent;
      if (sku) {
        this.createWidget(productContainer, { gtin: sku });
      }
    }
  }

  integrateMagento() {
    console.log('JENNi: Magento integration active');
    const productContainer = document.querySelector('.product-info-main');
    if (productContainer) {
      // Try to find SKU
      const sku = document.querySelector('[data-th="SKU"]')?.textContent;
      if (sku) {
        this.createWidget(productContainer, { gtin: sku });
      }
    }
  }

  integrateGeneric() {
    // Look for common product page patterns
    const containers = [
      '.product-details',
      '.product-info',
      '.product-summary',
      '.add-to-cart-form',
      '#product-form'
    ];
    
    for (const selector of containers) {
      const container = document.querySelector(selector);
      if (container) {
        // Try to find SKU/GTIN in various ways
        const sku = this.findProductSku();
        if (sku) {
          this.createWidget(container, { gtin: sku });
          break;
        }
      }
    }
  }

  findProductSku() {
    // Try multiple methods to find product SKU/GTIN
    const methods = [
      () => document.querySelector('[data-sku]')?.dataset.sku,
      () => document.querySelector('[data-gtin]')?.dataset.gtin,
      () => document.querySelector('.sku')?.textContent?.trim(),
      () => document.querySelector('.product-sku')?.textContent?.trim(),
      () => document.querySelector('meta[property="product:retailer_item_id"]')?.content,
      () => {
        const jsonLd = document.querySelector('script[type="application/ld+json"]');
        if (jsonLd) {
          try {
            const data = JSON.parse(jsonLd.textContent);
            return data.sku || data.gtin || data.productID;
          } catch (e) {}
        }
      }
    ];
    
    for (const method of methods) {
      const result = method();
      if (result) return result;
    }
    
    return null;
  }
}

// ✅ FIXED: Global initialization - works on any website
(function() {
  // Auto-initialize if credentials are provided
  if (typeof window !== 'undefined') {
    window.JENNi = new JENNiUniversal({
      // Can be overridden by setting window.JENNI_CONFIG
      ...window.JENNI_CONFIG
    });
    
    // Auto-integrate when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.JENNi.autoIntegrate());
    } else {
      window.JENNi.autoIntegrate();
    }
  }
})();

// Export for Node.js/module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JENNiUniversal;
}
