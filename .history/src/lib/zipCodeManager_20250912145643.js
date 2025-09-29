/**
 * Advanced Zip Code Management System
 * Handles automatic detection, validation, and persistence with Apple-inspired UX
 */

class ZipCodeManager {
  constructor(options = {}) {
    this.options = {
      defaultZip: '60612',
      storageKey: 'jenni_zip_preference',
      geolocationTimeout: 8000,
      ipFallbackUrl: 'https://ipapi.co/json/',
      onZipChange: null,
      debug: false,
      ...options
    };
    
    this.currentZip = null;
    this.detectionAttempted = false;
    this.isDetecting = false;
    
    this.init();
  }

  init() {
    // Try to load from localStorage first
    this.currentZip = this.getStoredZip();
    
    // Auto-detect if no stored zip
    if (!this.currentZip) {
      this.detectZipCode();
    }
  }

  /**
   * Get zip code from localStorage
   */
  getStoredZip() {
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (stored && this.isValidZip(stored)) {
        this.log('Loaded zip from localStorage:', stored);
        return stored;
      }
    } catch (e) {
      this.log('localStorage not available');
    }
    return null;
  }

  /**
   * Store zip code in localStorage
   */
  storeZip(zip) {
    try {
      localStorage.setItem(this.options.storageKey, zip);
      this.log('Stored zip in localStorage:', zip);
    } catch (e) {
      this.log('Failed to store zip in localStorage');
    }
  }

  /**
   * Main zip code detection method
   * Uses geolocation API with IP-based fallback
   */
  async detectZipCode() {
    if (this.isDetecting || this.detectionAttempted) {
      return this.currentZip;
    }

    this.isDetecting = true;
    this.detectionAttempted = true;

    try {
      // Try geolocation first
      const geoZip = await this.getZipFromGeolocation();
      if (geoZip) {
        this.setZip(geoZip, { source: 'geolocation' });
        return geoZip;
      }

      // Fallback to IP-based detection
      const ipZip = await this.getZipFromIP();
      if (ipZip) {
        this.setZip(ipZip, { source: 'ip' });
        return ipZip;
      }

      // Final fallback to default
      this.setZip(this.options.defaultZip, { source: 'default' });
      return this.options.defaultZip;

    } catch (error) {
      this.log('Detection failed, using default:', error);
      this.setZip(this.options.defaultZip, { source: 'default' });
      return this.options.defaultZip;
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * Get zip code using browser geolocation API
   */
  getZipFromGeolocation() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        this.log('Geolocation not supported');
        resolve(null);
        return;
      }

      const timeout = setTimeout(() => {
        this.log('Geolocation timeout');
        resolve(null);
      }, this.options.geolocationTimeout);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(timeout);
          try {
            const { latitude, longitude } = position.coords;
            this.log('Got coordinates:', { latitude, longitude });
            
            const zip = await this.reverseGeocode(latitude, longitude);
            resolve(zip);
          } catch (error) {
            this.log('Reverse geocoding failed:', error);
            resolve(null);
          }
        },
        (error) => {
          clearTimeout(timeout);
          this.log('Geolocation error:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: this.options.geolocationTimeout,
          maximumAge: 600000 // 10 minutes
        }
      );
    });
  }

  /**
   * Convert coordinates to zip code using reverse geocoding
   */
  async reverseGeocode(lat, lng) {
    try {
      // Try multiple geocoding services
      const services = [
        () => this.reverseGeocodeNominatim(lat, lng),
        () => this.reverseGeocodeOpenCage(lat, lng),
        () => this.reverseGeocodeMapBox(lat, lng)
      ];

      for (const service of services) {
        try {
          const zip = await service();
          if (zip) return zip;
        } catch (e) {
          this.log('Geocoding service failed:', e.message);
        }
      }

      return null;
    } catch (error) {
      this.log('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Reverse geocoding using Nominatim (OpenStreetMap)
   */
  async reverseGeocodeNominatim(lat, lng) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': 'JENNi-Widget/1.0' } }
    );
    
    if (!response.ok) throw new Error('Nominatim API failed');
    
    const data = await response.json();
    return data.address?.postcode?.replace(/\D/g, '').slice(0, 5) || null;
  }

  /**
   * Get zip code from IP address
   */
  async getZipFromIP() {
    try {
      const response = await fetch(this.options.ipFallbackUrl);
      if (!response.ok) throw new Error('IP API failed');
      
      const data = await response.json();
      const zip = data.postal?.replace(/\D/g, '').slice(0, 5);
      
      if (zip && this.isValidZip(zip)) {
        this.log('Got zip from IP:', zip);
        return zip;
      }
      
      return null;
    } catch (error) {
      this.log('IP-based detection failed:', error);
      return null;
    }
  }

  /**
   * Set the current zip code
   */
  setZip(zip, options = {}) {
    const cleanZip = this.cleanZip(zip);
    
    if (!this.isValidZip(cleanZip)) {
      throw new Error('Invalid zip code format');
    }

    const previousZip = this.currentZip;
    this.currentZip = cleanZip;
    
    // Store in localStorage
    this.storeZip(cleanZip);
    
    // Notify listeners
    if (this.options.onZipChange && cleanZip !== previousZip) {
      this.options.onZipChange(cleanZip, {
        previous: previousZip,
        source: options.source || 'manual',
        ...options
      });
    }

    this.log('Zip code set:', cleanZip, options);
    return cleanZip;
  }

  /**
   * Get the current zip code, detecting if necessary
   */
  async getZip() {
    if (this.currentZip) {
      return this.currentZip;
    }

    return await this.detectZipCode();
  }

  /**
   * Clean zip code input
   */
  cleanZip(zip) {
    return String(zip || '').replace(/\D/g, '').slice(0, 5);
  }

  /**
   * Validate zip code format (5-digit US)
   */
  isValidZip(zip) {
    return /^\d{5}$/.test(zip);
  }

  /**
   * Request permission for geolocation with user-friendly messaging
   */
  async requestLocationPermission() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      // Test if permission is already granted
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve(false);
          } else {
            // Other errors (timeout, unavailable) - we can try again
            resolve(true);
          }
        },
        { timeout: 1000 }
      );
    });
  }

  /**
   * Create a user-friendly permission request UI
   */
  createPermissionRequestUI() {
    const modal = document.createElement('div');
    modal.className = 'jenni-location-modal';
    modal.innerHTML = `
      <div class="jenni-location-backdrop">
        <div class="jenni-location-dialog">
          <div class="jenni-location-icon">📍</div>
          <h3>Enable Location for Faster Delivery</h3>
          <p>We'll use your location to show accurate delivery times and find nearby stores.</p>
          <div class="jenni-location-buttons">
            <button class="jenni-btn jenni-btn-secondary" data-action="deny">
              Enter ZIP Manually
            </button>
            <button class="jenni-btn jenni-btn-primary" data-action="allow">
              Allow Location
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.injectPermissionStyles();

    return new Promise((resolve) => {
      modal.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action) {
          modal.remove();
          if (action === 'allow') {
            this.detectZipCode().then(resolve);
          } else {
            resolve(null);
          }
        }
      });

      document.body.appendChild(modal);
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (document.body.contains(modal)) {
          modal.remove();
          resolve(null);
        }
      }, 10000);
    });
  }

  /**
   * Inject styles for permission modal
   */
  injectPermissionStyles() {
    if (document.getElementById('jenni-location-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'jenni-location-styles';
    styles.textContent = `
      .jenni-location-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .jenni-location-backdrop {
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
      }
      
      .jenni-location-dialog {
        background: white;
        border-radius: 16px;
        padding: 32px 24px 24px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        transform: scale(0.95);
        animation: jenni-modal-enter 0.2s ease-out forwards;
      }
      
      @keyframes jenni-modal-enter {
        to { transform: scale(1); }
      }
      
      .jenni-location-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      
      .jenni-location-dialog h3 {
        margin: 0 0 12px;
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
      }
      
      .jenni-location-dialog p {
        margin: 0 0 24px;
        color: #86868b;
        font-size: 16px;
        line-height: 1.4;
      }
      
      .jenni-location-buttons {
        display: flex;
        gap: 12px;
        flex-direction: column-reverse;
      }
      
      .jenni-btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        min-height: 44px;
      }
      
      .jenni-btn-primary {
        background: #007AFF;
        color: white;
      }
      
      .jenni-btn-primary:hover {
        background: #0056CC;
      }
      
      .jenni-btn-secondary {
        background: #F2F2F7;
        color: #007AFF;
      }
      
      .jenni-btn-secondary:hover {
        background: #E5E5EA;
      }
      
      @media (min-width: 480px) {
        .jenni-location-buttons {
          flex-direction: row;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  /**
   * Debug logging
   */
  log(...args) {
    if (this.options.debug) {
      console.log('[ZipCodeManager]', ...args);
    }
  }
}

// Export for both browser and Node.js
if (typeof window !== 'undefined') {
  window.ZipCodeManager = ZipCodeManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZipCodeManager;
}
