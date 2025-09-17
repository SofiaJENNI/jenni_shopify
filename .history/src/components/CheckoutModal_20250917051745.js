/**
 * JENNi Checkout Modal Component
 * Handles the complete checkout flow with form validation and order confirmation
 */

class CheckoutModal {
  constructor(options = {}) {
    this.options = {
      selectedStore: null,
      userZip: '',
      onOrderComplete: null,
      onClose: null,
      ...options
    };

    this.modal = null;
    this.validators = new FormValidators();
    this.addressGenerator = new AddressGenerator();
  }

  /**
   * Open the checkout modal
   */
  open() {
    if (!this.options.selectedStore) {
      alert('Please select a store first');
      return;
    }

    this.createModal();
    this.attachEventHandlers();
    document.body.appendChild(this.modal);
  }

  /**
   * Close the checkout modal
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  /**
   * Create the modal DOM structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'jenni-checkout-modal';

    const userAddress = this.addressGenerator.generateUserAddress();
    const store = this.options.selectedStore;
    const itemPrice = this.generateItemPrice();
    const deliveryFee = 4.99;
    const total = itemPrice + deliveryFee;

    this.modal.innerHTML = `
      <div class="jenni-checkout-content">
        <div class="jenni-checkout-header">
          <div class="jenni-checkout-title">Complete Your Order</div>
          <button class="jenni-checkout-close">✕</button>
        </div>

        <div class="jenni-checkout-body">
          <div class="jenni-checkout-layout">
            <!-- Left Column: Product Info & Pricing -->
            <div class="jenni-left-column">
              <!-- Product Information -->
              <div class="jenni-product-info">
                <div class="jenni-product-image">
                  <div class="jenni-product-placeholder">📦</div>
                </div>
                <div class="jenni-product-details">
                  <div class="jenni-product-name">${this.getProductName()}</div>
                  <div class="jenni-product-brand">${this.getBrandName()}</div>
                  <div class="jenni-store-info">
                    <span class="jenni-store-name">📍 ${store.name}</span>
                    <span class="jenni-delivery-time">~${Math.round(store.etaMinutes)} min delivery</span>
                  </div>
                </div>
              </div>

              <!-- Pricing Breakdown -->
              <div class="jenni-pricing-card">
                <div class="jenni-pricing-title">Order Summary</div>
                <div class="jenni-price-row">
                  <span>Item price:</span>
                  <span>$${itemPrice.toFixed(2)}</span>
                </div>
                <div class="jenni-price-row">
                  <span>Delivery fee:</span>
                  <span>$${deliveryFee.toFixed(2)}</span>
                </div>
                <div class="jenni-price-row jenni-total-row">
                  <span>Total:</span>
                  <span>$${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Right Column: Form Fields -->
            <div class="jenni-right-column">
              <!-- Customer Information -->
              <div class="jenni-checkout-section jenni-compact-section">
                <div class="jenni-checkout-section-title">Customer Information</div>
                <div class="jenni-form-row">
                  <div class="jenni-form-group">
                    <label class="jenni-form-label">Name</label>
                    <input type="text" class="jenni-form-input jenni-compact-input" name="name" value="Sophie Smith" required>
                  </div>
                  <div class="jenni-form-group">
                    <label class="jenni-form-label">Email</label>
                    <input type="email" class="jenni-form-input jenni-compact-input" name="email" value="sophie@smith.co" required>
                    <div class="jenni-form-error" style="display: none;"></div>
                  </div>
                </div>
              </div>

              <!-- Delivery Address -->
              <div class="jenni-checkout-section jenni-compact-section">
                <div class="jenni-checkout-section-title">Delivery Address</div>
                <div class="jenni-form-group">
                  <label class="jenni-form-label">Street Address</label>
                  <input type="text" class="jenni-form-input jenni-compact-input" name="address" value="${userAddress}" required>
                </div>
                <div class="jenni-form-row">
                  <div class="jenni-form-group" style="flex: 2;">
                    <label class="jenni-form-label">City</label>
                    <input type="text" class="jenni-form-input jenni-compact-input" name="city" value="Chicago" required>
                  </div>
                  <div class="jenni-form-group" style="flex: 1;">
                    <label class="jenni-form-label">State</label>
                    <input type="text" class="jenni-form-input jenni-compact-input" name="state" value="IL" required>
                  </div>
                  <div class="jenni-form-group" style="flex: 1;">
                    <label class="jenni-form-label">ZIP</label>
                    <input type="text" class="jenni-form-input jenni-compact-input" name="zip" value="${this.options.userZip}" required>
                  </div>
                </div>
              </div>

              <!-- Payment Method -->
              <div class="jenni-checkout-section jenni-compact-section">
                <div class="jenni-checkout-section-title">Payment Method</div>
                <div class="jenni-payment-options">
                  <div class="jenni-payment-option selected" data-payment="amex">
                    <div class="jenni-payment-radio">
                      <div class="jenni-radio-dot"></div>
                    </div>
                    <div class="jenni-payment-card-info">
                      <div class="jenni-amex-logo">AMEX</div>
                      <div class="jenni-payment-details">
                        <div class="jenni-payment-type">American Express</div>
                        <div class="jenni-payment-number">•••• •••• •••• 1234</div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="jenni-payment-option" data-payment="paypal">
                    <div class="jenni-payment-radio">
                      <div class="jenni-radio-dot"></div>
                    </div>
                    <div class="jenni-payment-card-info">
                      <div class="jenni-paypal-logo">PayPal</div>
                      <div class="jenni-payment-details">
                        <div class="jenni-payment-type">PayPal Account</div>
                        <div class="jenni-payment-number">sophie@smith.co</div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="jenni-payment-option" data-payment="card">
                    <div class="jenni-payment-radio">
                      <div class="jenni-radio-dot"></div>
                    </div>
                    <div class="jenni-payment-card-info">
                      <div class="jenni-card-logos">
                        <div class="jenni-visa-logo">VISA</div>
                        <div class="jenni-mc-logo">MC</div>
                      </div>
                      <div class="jenni-payment-details">
                        <div class="jenni-payment-type">Credit Card</div>
                        <div class="jenni-payment-number">Add new card</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="jenni-checkout-footer">
          <button class="jenni-checkout-submit">Complete Order • $${total.toFixed(2)}</button>
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers to modal elements
   */
  attachEventHandlers() {
    const closeBtn = this.modal.querySelector('.jenni-checkout-close');
    const submitBtn = this.modal.querySelector('.jenni-checkout-submit');
    const emailInput = this.modal.querySelector('input[name="email"]');

    // Close handlers
    closeBtn.addEventListener('click', () => this.close());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Email validation
    emailInput.addEventListener('blur', () => {
      this.validators.validateEmail(emailInput);
    });

    // Payment method selection
    const paymentOptions = this.modal.querySelectorAll('.jenni-payment-option');
    paymentOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.selectPaymentMethod(option);
      });
    });

    // Form submission
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitOrder();
    });
  }

  /**
   * Handle payment method selection
   */
  selectPaymentMethod(selectedOption) {
    // Remove selection from all options
    this.modal.querySelectorAll('.jenni-payment-option').forEach(option => {
      option.classList.remove('selected');
    });
    
    // Select the clicked option
    selectedOption.classList.add('selected');
    
    const paymentType = selectedOption.dataset.payment;
    if (this.options.debug) {
      console.log('[CheckoutModal] Payment method selected:', paymentType);
    }
  }

  /**
   * Generate mock item price
   */
  generateItemPrice() {
    // Generate a realistic price between $15-$150
    const prices = [19.99, 24.99, 29.99, 39.99, 49.99, 59.99, 79.99, 89.99, 99.99, 129.99];
    return prices[Math.floor(Math.random() * prices.length)];
  }

  /**
   * Get product name from PDP or generate mock data
   */
  getProductName() {
    // Try to get from page context first
    if (this.options.productContext?.title) {
      return this.options.productContext.title;
    }

    // Try to extract from page
    const productTitle = this.extractProductFromPage();
    if (productTitle) {
      return productTitle;
    }

    // Fallback to mock data
    const products = [
      'Premium Wireless Headphones',
      'Smart Fitness Tracker',
      'Bluetooth Speaker Pro',
      'Wireless Phone Charger',
      'Premium Coffee Mug',
      'Organic Cotton T-Shirt',
      'Stainless Steel Water Bottle',
      'Portable Phone Stand'
    ];
    return products[Math.floor(Math.random() * products.length)];
  }

  /**
   * Get brand name from PDP or generate mock data
   */
  getBrandName() {
    // Try to get from page context first
    if (this.options.productContext?.brand) {
      return this.options.productContext.brand;
    }

    // Try to extract from page
    const brand = this.extractBrandFromPage();
    if (brand) {
      return brand;
    }

    // Fallback to mock data
    const brands = [
      'TechPro',
      'LifeStyle',
      'EcoFriendly',
      'SmartHome',
      'ActiveLife',
      'ModernDesign',
      'QualityFirst',
      'InnovateTech'
    ];
    return brands[Math.floor(Math.random() * brands.length)];
  }

  /**
   * Extract product information from the current page
   */
  extractProductFromPage() {
    // Try common product title selectors
    const titleSelectors = [
      'h1[data-testid="product-title"]',
      '.product-title',
      '.product-name',
      'h1.product-title',
      'h1[itemprop="name"]',
      '.pdp-product-name',
      '.product-detail-title',
      'h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Try meta tags
    const metaTitle = document.querySelector('meta[property="og:title"]');
    if (metaTitle && metaTitle.content) {
      return metaTitle.content;
    }

    return null;
  }

  /**
   * Extract brand information from the current page
   */
  extractBrandFromPage() {
    // Try common brand selectors
    const brandSelectors = [
      '[data-testid="product-brand"]',
      '.product-brand',
      '.brand-name',
      '[itemprop="brand"]',
      '.pdp-brand',
      '.product-brand-name'
    ];

    for (const selector of brandSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Try to extract from title or URL
    const title = document.title.toLowerCase();
    const url = window.location.hostname;
    
    // Common brand patterns in URLs
    if (url.includes('nike')) return 'Nike';
    if (url.includes('adidas')) return 'Adidas';
    if (url.includes('apple')) return 'Apple';
    if (url.includes('samsung')) return 'Samsung';
    if (url.includes('sony')) return 'Sony';

    return null;
  }

  /**
   * Validate and submit the order
   */
  submitOrder() {
    if (!this.validators.validateForm(this.modal)) {
      return;
    }

    const submitBtn = this.modal.querySelector('.jenni-checkout-submit');
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;

    // Simulate order processing
    setTimeout(() => {
      this.showOrderConfirmation();
    }, 2000);
  }

  /**
   * Show order confirmation with tracking steps
   */
  showOrderConfirmation() {
    const orderId = `JN${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const eta = new Date(Date.now() + this.options.selectedStore.etaMinutes * 60000);
    const etaTime = eta.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const store = this.options.selectedStore;

    const content = this.modal.querySelector('.jenni-checkout-content');
    content.innerHTML = `
      <div class="jenni-success-modal">
        <div class="jenni-success-icon">✓</div>
        <div class="jenni-success-title">Order Confirmed!</div>
        <div class="jenni-success-message">
          Your order #${orderId} has been placed and will arrive by ${etaTime}
        </div>

        <div class="jenni-tracking-steps">
          <div class="jenni-tracking-step">
            <div class="jenni-step-indicator completed">✓</div>
            <div class="jenni-step-text">
              <div class="jenni-step-title">Order Confirmed</div>
              <div class="jenni-step-time">Just now</div>
            </div>
          </div>
          <div class="jenni-tracking-step">
            <div class="jenni-step-indicator active">2</div>
            <div class="jenni-step-text">
              <div class="jenni-step-title">Preparing at ${store.name}</div>
              <div class="jenni-step-time">5-10 minutes</div>
            </div>
          </div>
          <div class="jenni-tracking-step">
            <div class="jenni-step-indicator pending">3</div>
            <div class="jenni-step-text">
              <div class="jenni-step-title">Out for Delivery</div>
              <div class="jenni-step-time">${Math.round(store.etaMinutes * 0.7)} minutes</div>
            </div>
          </div>
          <div class="jenni-tracking-step">
            <div class="jenni-step-indicator pending">4</div>
            <div class="jenni-step-text">
              <div class="jenni-step-title">Delivered</div>
              <div class="jenni-step-time">by ${etaTime}</div>
            </div>
          </div>
        </div>

        <button class="jenni-checkout-submit" onclick="this.closest('.jenni-checkout-modal').remove()">
          Done
        </button>
      </div>
    `;

    if (this.options.onOrderComplete) {
      this.options.onOrderComplete({
        orderId,
        store,
        estimatedDelivery: eta
      });
    }
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.CheckoutModal = CheckoutModal;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckoutModal;
}
