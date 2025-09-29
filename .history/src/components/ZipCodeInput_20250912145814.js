/**
 * Apple-inspired Zip Code Input Component
 * Features: Auto-detection, validation, smooth animations, clean design
 */

class ZipCodeInput {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: 'ZIP Code',
      showLabel: true,
      autoDetect: true,
      showLocationIcon: true,
      showEditIcon: true,
      onZipChange: null,
      onValidationError: null,
      theme: 'light', // light | dark
      size: 'medium', // small | medium | large
      ...options
    };

    this.zipManager = null;
    this.currentZip = null;
    this.isEditing = false;
    this.isDetecting = false;
    this.validationTimer = null;

    this.init();
  }

  init() {
    this.injectStyles();
    this.createElements();
    this.setupZipManager();
    this.bindEvents();
    
    if (this.options.autoDetect) {
      this.startAutoDetection();
    }
  }

  /**
   * Create the input component structure
   */
  createElements() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = `jenni-zip-input jenni-zip-${this.options.size} jenni-zip-${this.options.theme}`;
    
    this.wrapper.innerHTML = `
      ${this.options.showLabel ? '<label class="jenni-zip-label">Delivery Location</label>' : ''}
      
      <div class="jenni-zip-field-wrapper">
        <div class="jenni-zip-display" role="button" tabindex="0" aria-label="Edit ZIP code">
          <div class="jenni-zip-content">
            <div class="jenni-zip-icon-wrapper">
              ${this.options.showLocationIcon ? this.getLocationIcon() : ''}
            </div>
            <div class="jenni-zip-text-wrapper">
              <span class="jenni-zip-value">Detecting location...</span>
              <span class="jenni-zip-status">Please wait</span>
            </div>
          </div>
          ${this.options.showEditIcon ? `
            <div class="jenni-zip-edit-icon">
              ${this.getEditIcon()}
            </div>
          ` : ''}
        </div>
        
        <div class="jenni-zip-input-wrapper" style="display: none;">
          <input 
            type="text" 
            class="jenni-zip-input-field"
            placeholder="${this.options.placeholder}"
            maxlength="5"
            inputmode="numeric"
            autocomplete="postal-code"
            aria-label="ZIP code"
          />
          <div class="jenni-zip-actions">
            <button type="button" class="jenni-zip-btn jenni-zip-btn-cancel" aria-label="Cancel">
              ${this.getCancelIcon()}
            </button>
            <button type="button" class="jenni-zip-btn jenni-zip-btn-confirm" aria-label="Confirm">
              ${this.getCheckIcon()}
            </button>
          </div>
        </div>
        
        <div class="jenni-zip-validation-message"></div>
      </div>
    `;

    this.container.appendChild(this.wrapper);
    
    // Get element references
    this.displayWrapper = this.wrapper.querySelector('.jenni-zip-display');
    this.inputWrapper = this.wrapper.querySelector('.jenni-zip-input-wrapper');
    this.inputField = this.wrapper.querySelector('.jenni-zip-input-field');
    this.valueSpan = this.wrapper.querySelector('.jenni-zip-value');
    this.statusSpan = this.wrapper.querySelector('.jenni-zip-status');
    this.validationMessage = this.wrapper.querySelector('.jenni-zip-validation-message');
    this.cancelBtn = this.wrapper.querySelector('.jenni-zip-btn-cancel');
    this.confirmBtn = this.wrapper.querySelector('.jenni-zip-btn-confirm');
  }

  /**
   * Setup zip code manager
   */
  setupZipManager() {
    if (typeof ZipCodeManager === 'undefined') {
      console.error('ZipCodeManager not found. Please include zipCodeManager.js first.');
      return;
    }

    this.zipManager = new ZipCodeManager({
      onZipChange: (zip, details) => {
        this.setZip(zip, details);
        if (this.options.onZipChange) {
          this.options.onZipChange(zip, details);
        }
      },
      debug: this.options.debug
    });
  }

  /**
   * Start automatic zip detection
   */
  async startAutoDetection() {
    if (!this.zipManager) return;

    this.setDetectingState(true);
    
    try {
      const zip = await this.zipManager.getZip();
      if (zip) {
        this.setZip(zip, { source: 'auto' });
      }
    } catch (error) {
      this.showValidationError('Unable to detect location');
    } finally {
      this.setDetectingState(false);
    }
  }

  /**
   * Set the current ZIP code
   */
  setZip(zip, details = {}) {
    this.currentZip = zip;
    
    if (zip) {
      this.valueSpan.textContent = zip;
      this.statusSpan.textContent = this.getStatusText(details.source);
      this.wrapper.classList.add('jenni-zip-has-value');
      this.wrapper.classList.remove('jenni-zip-error');
    } else {
      this.valueSpan.textContent = 'Enter ZIP code';
      this.statusSpan.textContent = 'Required for delivery estimates';
      this.wrapper.classList.remove('jenni-zip-has-value');
    }
  }

  /**
   * Get status text based on source
   */
  getStatusText(source) {
    switch (source) {
      case 'geolocation': return 'Detected from your location';
      case 'ip': return 'Detected from your area';
      case 'manual': return 'Manually entered';
      case 'stored': return 'Saved preference';
      case 'auto': return 'Auto-detected';
      default: return 'Tap to change';
    }
  }

  /**
   * Set detecting state
   */
  setDetectingState(detecting) {
    this.isDetecting = detecting;
    this.wrapper.classList.toggle('jenni-zip-detecting', detecting);
    
    if (detecting) {
      this.valueSpan.textContent = 'Detecting location...';
      this.statusSpan.textContent = 'Please wait';
    }
  }

  /**
   * Enter edit mode
   */
  enterEditMode() {
    if (this.isEditing) return;
    
    this.isEditing = true;
    this.wrapper.classList.add('jenni-zip-editing');
    
    // Animate transition
    this.displayWrapper.style.display = 'none';
    this.inputWrapper.style.display = 'flex';
    
    // Set input value and focus
    this.inputField.value = this.currentZip || '';
    setTimeout(() => {
      this.inputField.focus();
      this.inputField.select();
    }, 100);
  }

  /**
   * Exit edit mode
   */
  exitEditMode(save = false) {
    if (!this.isEditing) return;
    
    if (save) {
      const zip = this.inputField.value.trim();
      if (this.validateZip(zip)) {
        if (this.zipManager) {
          this.zipManager.setZip(zip, { source: 'manual' });
        } else {
          this.setZip(zip, { source: 'manual' });
        }
      } else {
        this.showValidationError('Please enter a valid 5-digit ZIP code');
        return;
      }
    }
    
    this.isEditing = false;
    this.wrapper.classList.remove('jenni-zip-editing');
    this.clearValidationError();
    
    // Animate transition
    this.inputWrapper.style.display = 'none';
    this.displayWrapper.style.display = 'flex';
  }

  /**
   * Validate ZIP code format
   */
  validateZip(zip) {
    return /^\d{5}$/.test(zip);
  }

  /**
   * Show validation error
   */
  showValidationError(message) {
    this.wrapper.classList.add('jenni-zip-error');
    this.validationMessage.textContent = message;
    this.validationMessage.style.display = 'block';
    
    if (this.options.onValidationError) {
      this.options.onValidationError(message);
    }
    
    // Auto-clear after 3 seconds
    clearTimeout(this.validationTimer);
    this.validationTimer = setTimeout(() => {
      this.clearValidationError();
    }, 3000);
  }

  /**
   * Clear validation error
   */
  clearValidationError() {
    this.wrapper.classList.remove('jenni-zip-error');
    this.validationMessage.style.display = 'none';
    clearTimeout(this.validationTimer);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Display click to edit
    this.displayWrapper.addEventListener('click', () => {
      if (!this.isDetecting) {
        this.enterEditMode();
      }
    });

    // Keyboard support for display
    this.displayWrapper.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !this.isDetecting) {
        e.preventDefault();
        this.enterEditMode();
      }
    });

    // Input field events
    this.inputField.addEventListener('input', (e) => {
      // Only allow digits
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
      this.clearValidationError();
    });

    this.inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.exitEditMode(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.exitEditMode(false);
      }
    });

    // Action buttons
    this.confirmBtn.addEventListener('click', () => {
      this.exitEditMode(true);
    });

    this.cancelBtn.addEventListener('click', () => {
      this.exitEditMode(false);
    });

    // Click outside to save
    document.addEventListener('click', (e) => {
      if (this.isEditing && !this.wrapper.contains(e.target)) {
        this.exitEditMode(true);
      }
    });
  }

  /**
   * Get current ZIP code
   */
  getZip() {
    return this.currentZip;
  }

  /**
   * Programmatically set ZIP code
   */
  updateZip(zip) {
    if (this.zipManager) {
      this.zipManager.setZip(zip, { source: 'programmatic' });
    } else {
      this.setZip(zip, { source: 'programmatic' });
    }
  }

  /**
   * SVG Icons
   */
  getLocationIcon() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;
  }

  getEditIcon() {
    return `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    `;
  }

  getCheckIcon() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"/>
      </svg>
    `;
  }

  getCancelIcon() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
  }

  /**
   * Inject component styles
   */
  injectStyles() {
    if (document.getElementById('jenni-zip-input-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'jenni-zip-input-styles';
    styles.textContent = `
      .jenni-zip-input {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        --jenni-primary: #007AFF;
        --jenni-primary-hover: #0056CC;
        --jenni-success: #34C759;
        --jenni-error: #FF3B30;
        --jenni-gray-1: #F2F2F7;
        --jenni-gray-2: #E5E5EA;
        --jenni-gray-3: #C7C7CC;
        --jenni-gray-4: #8E8E93;
        --jenni-gray-5: #636366;
        --jenni-gray-6: #48484A;
        --jenni-text: #1D1D1F;
        --jenni-text-secondary: #86868B;
        --jenni-background: #FFFFFF;
        --jenni-radius: 8px;
        --jenni-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .jenni-zip-dark {
        --jenni-gray-1: #1C1C1E;
        --jenni-gray-2: #2C2C2E;
        --jenni-gray-3: #3A3A3C;
        --jenni-gray-4: #8E8E93;
        --jenni-gray-5: #AEAEB2;
        --jenni-gray-6: #C7C7CC;
        --jenni-text: #FFFFFF;
        --jenni-text-secondary: #AEAEB2;
        --jenni-background: #000000;
      }

      .jenni-zip-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--jenni-text);
        margin-bottom: 8px;
      }

      .jenni-zip-field-wrapper {
        position: relative;
      }

      .jenni-zip-display {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--jenni-background);
        border: 1px solid var(--jenni-gray-2);
        border-radius: var(--jenni-radius);
        cursor: pointer;
        transition: all 0.2s ease;
        min-height: 48px;
      }

      .jenni-zip-display:hover {
        border-color: var(--jenni-gray-3);
        box-shadow: var(--jenni-shadow);
      }

      .jenni-zip-display:focus {
        outline: none;
        border-color: var(--jenni-primary);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }

      .jenni-zip-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }

      .jenni-zip-icon-wrapper {
        color: var(--jenni-gray-4);
        display: flex;
        align-items: center;
      }

      .jenni-zip-detecting .jenni-zip-icon-wrapper svg {
        animation: jenni-pulse 2s ease-in-out infinite;
      }

      @keyframes jenni-pulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
      }

      .jenni-zip-text-wrapper {
        flex: 1;
      }

      .jenni-zip-value {
        display: block;
        font-size: 16px;
        font-weight: 500;
        color: var(--jenni-text);
        line-height: 1.2;
      }

      .jenni-zip-status {
        display: block;
        font-size: 13px;
        color: var(--jenni-text-secondary);
        line-height: 1.2;
        margin-top: 2px;
      }

      .jenni-zip-edit-icon {
        color: var(--jenni-gray-4);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .jenni-zip-display:hover .jenni-zip-edit-icon,
      .jenni-zip-display:focus .jenni-zip-edit-icon {
        opacity: 1;
      }

      .jenni-zip-input-wrapper {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 4px;
        background: var(--jenni-background);
        border: 2px solid var(--jenni-primary);
        border-radius: var(--jenni-radius);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }

      .jenni-zip-input-field {
        flex: 1;
        border: none;
        background: none;
        padding: 12px;
        font-size: 16px;
        font-weight: 500;
        color: var(--jenni-text);
        outline: none;
      }

      .jenni-zip-input-field::placeholder {
        color: var(--jenni-gray-4);
      }

      .jenni-zip-actions {
        display: flex;
        gap: 4px;
      }

      .jenni-zip-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--jenni-text-secondary);
      }

      .jenni-zip-btn:hover {
        background: var(--jenni-gray-1);
        color: var(--jenni-text);
      }

      .jenni-zip-btn-confirm {
        color: var(--jenni-success);
      }

      .jenni-zip-btn-confirm:hover {
        background: rgba(52, 199, 89, 0.1);
        color: var(--jenni-success);
      }

      .jenni-zip-validation-message {
        display: none;
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(255, 59, 48, 0.1);
        border: 1px solid rgba(255, 59, 48, 0.2);
        border-radius: 6px;
        color: var(--jenni-error);
        font-size: 13px;
        animation: jenni-error-enter 0.2s ease-out;
      }

      @keyframes jenni-error-enter {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .jenni-zip-error .jenni-zip-display,
      .jenni-zip-error .jenni-zip-input-wrapper {
        border-color: var(--jenni-error);
      }

      .jenni-zip-error .jenni-zip-input-wrapper {
        box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.1);
      }

      /* Size variants */
      .jenni-zip-small {
        font-size: 14px;
      }

      .jenni-zip-small .jenni-zip-display {
        padding: 8px 12px;
        min-height: 36px;
      }

      .jenni-zip-small .jenni-zip-value {
        font-size: 14px;
      }

      .jenni-zip-small .jenni-zip-status {
        font-size: 12px;
      }

      .jenni-zip-large {
        font-size: 18px;
      }

      .jenni-zip-large .jenni-zip-display {
        padding: 16px 20px;
        min-height: 56px;
      }

      .jenni-zip-large .jenni-zip-value {
        font-size: 18px;
      }

      .jenni-zip-large .jenni-zip-status {
        font-size: 14px;
      }

      /* Responsive design */
      @media (max-width: 480px) {
        .jenni-zip-display {
          padding: 12px;
        }
        
        .jenni-zip-content {
          gap: 8px;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
}

// Export for both browser and Node.js
if (typeof window !== 'undefined') {
  window.ZipCodeInput = ZipCodeInput;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZipCodeInput;
}
