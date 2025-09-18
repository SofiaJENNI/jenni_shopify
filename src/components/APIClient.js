/**
 * API Client Component
 * Handles all API communications with JENNi backend services
 */
class APIClient {
  constructor(config = {}) {
    this.config = {
      apiBase: '',
      tenant: 'demo',
      requestTimeoutMs: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      ...config
    };
    
    this.cache = new Map();
    this.inFlightRequests = new Map();
  }

  /**
   * Main resolve endpoint - get eligibility and store data
   */
  async resolve(fingerprint, zip) {
    const payload = { 
      fingerprint, 
      zip, 
      tenant: this.config.tenant,
      timestamp: Date.now()
    };

    const cacheKey = `resolve:${zip}:${JSON.stringify(fingerprint)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.data;
      }
    }

    // Check for in-flight request
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const requestPromise = this._makeRequest('/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    this.inFlightRequests.set(cacheKey, requestPromise);

    try {
      const data = await requestPromise;
      
      // Cache successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Get nearby places/stores
   */
  async getPlaces(zip, query = '', brand = '', styleCode = '', probe = false) {
    const params = new URLSearchParams({
      zip,
      q: query,
      brand,
      sc: styleCode,
      ...(probe && { probe: '1' })
    });

    const cacheKey = `places:${params.toString()}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 600000) { // 10 minute cache
        return cached.data;
      }
    }

    try {
      const data = await this._makeRequest(`/places?${params}`);
      
      // Cache response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.warn('[APIClient] Places request failed:', error);
      return [];
    }
  }

  /**
   * Submit test order
   */
  async submitOrder(orderData) {
    return this._makeRequest('/test-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderData,
        tenant: this.config.tenant,
        timestamp: Date.now()
      })
    });
  }

  /**
   * Get inventory data
   */
  async getInventory(gtin, zip) {
    const params = new URLSearchParams({ gtin, zip });
    const cacheKey = `inventory:${params.toString()}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return cached.data;
      }
    }

    try {
      const data = await this._makeRequest(`/inventory?${params}`);
      
      // Cache response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.warn('[APIClient] Inventory request failed:', error);
      return null;
    }
  }

  /**
   * Detect ZIP code by IP
   */
  async detectZipByIP() {
    try {
      // First check localStorage
      const stored = localStorage.getItem('jenni_zip_preference');
      if (stored && /^\d{5}$/.test(stored)) {
        return stored;
      }

      // Fallback to IP-based detection
      const response = await fetch('https://ipapi.co/json/', {
        timeout: 5000
      });
      
      if (!response.ok) throw new Error('IP detection failed');
      
      const data = await response.json();
      const zip = data.postal?.replace(/\D/g, '').slice(0, 5);
      
      if (zip && zip.length === 5) {
        localStorage.setItem('jenni_zip_preference', zip);
        return zip;
      }
      
      throw new Error('Invalid ZIP from IP');
    } catch (error) {
      console.warn('[APIClient] ZIP detection failed:', error);
      return '10001'; // Default fallback
    }
  }

  /**
   * Make HTTP request with retry logic and timeout
   */
  async _makeRequest(endpoint, options = {}) {
    const url = `${this.config.apiBase}${endpoint}`;
    const controller = new AbortController();
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.requestTimeoutMs);

    const requestOptions = {
      ...options,
      signal: controller.signal
    };

    let lastError = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }

      } catch (error) {
        lastError = error;
        
        // Don't retry on abort or certain errors
        if (error.name === 'AbortError' || 
            (error.message && error.message.includes('404'))) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.config.retryAttempts) {
          await this._delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Utility: delay execution
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache entries
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      inFlight: this.inFlightRequests.size
    };
  }

  /**
   * Abort all in-flight requests
   */
  abortAllRequests() {
    // Note: AbortController instances are handled per request
    // This method clears the tracking map
    this.inFlightRequests.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
}
