/**
 * Page Watcher Component
 * Monitors page changes, navigation, and DOM mutations to trigger updates
 */
class PageWatcher {
  constructor(config = {}) {
    this.config = {
      debounceMs: 500,
      pollIntervalMs: 2000,
      autoRefresh: true,
      ...config
    };
    
    this.state = {
      lastHref: '',
      lastSig: '',
      isWatching: false,
      timers: {
        debounce: null,
        poll: null
      }
    };

    this.observers = {
      mutation: null
    };

    this.callbacks = {
      onChange: null,
      onNavigation: null,
      onSignatureChange: null
    };
  }

  /**
   * Start watching for page changes
   */
  startWatching(callbacks = {}) {
    if (this.state.isWatching) {
      this.stopWatching();
    }

    this.callbacks = { ...this.callbacks, ...callbacks };
    this.state.isWatching = true;
    this.state.lastHref = window.location.href;

    this._installNavigationWatchers();
    this._installMutationObserver();
    
    if (this.config.autoRefresh) {
      this._startPolling();
    }

    console.debug('[PageWatcher] Started watching');
  }

  /**
   * Stop all watchers
   */
  stopWatching() {
    if (!this.state.isWatching) return;

    this.state.isWatching = false;

    // Clear timers
    Object.values(this.state.timers).forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    this.state.timers = { debounce: null, poll: null };

    // Disconnect observers
    if (this.observers.mutation) {
      this.observers.mutation.disconnect();
      this.observers.mutation = null;
    }

    console.debug('[PageWatcher] Stopped watching');
  }

  /**
   * Install navigation event watchers
   */
  _installNavigationWatchers() {
    const onNav = () => {
      const newHref = window.location.href;
      if (newHref !== this.state.lastHref) {
        this.state.lastHref = newHref;
        this._triggerCallback('onNavigation', { 
          from: this.state.lastHref, 
          to: newHref,
          reason: 'navigation'
        });
      }
    };

    // Listen for navigation events
    window.addEventListener('jenni:nav', onNav);
    window.addEventListener('popstate', onNav);
    window.addEventListener('pushstate', onNav);
    window.addEventListener('replacestate', onNav);

    // Wrap history methods to catch programmatic navigation
    const wrap = (fn) => function() { 
      const r = fn.apply(this, arguments); 
      try { 
        window.dispatchEvent(new Event('jenni:nav')); 
      } catch {} 
      return r; 
    };

    if (window.history.pushState) {
      window.history.pushState = wrap(window.history.pushState);
    }
    if (window.history.replaceState) {
      window.history.replaceState = wrap(window.history.replaceState);
    }
  }

  /**
   * Install DOM mutation observer
   */
  _installMutationObserver() {
    const debouncedCheck = (reason = 'mutation') => {
      if (this.state.timers.debounce) {
        clearTimeout(this.state.timers.debounce);
      }
      
      this.state.timers.debounce = setTimeout(() => {
        const sig = this._computeSignature();
        if (sig !== this.state.lastSig) {
          this.state.lastSig = sig;
          this._triggerCallback('onSignatureChange', { 
            signature: sig, 
            reason 
          });
        }
      }, this.config.debounceMs);
    };

    this.observers.mutation = new MutationObserver((mutations) => {
      // Check if mutations are relevant (avoid infinite loops)
      const relevantMutation = mutations.some(m => 
        !m.target.closest?.('.jenni-edge-pill, .jenni-edge-panel') &&
        (m.type === 'childList' || 
         (m.type === 'attributes' && ['class', 'data-selected', 'selected'].includes(m.attributeName)))
      );
      
      if (relevantMutation) {
        debouncedCheck('mutation');
      }
    });

    this.observers.mutation.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-selected', 'selected', 'checked']
    });
  }

  /**
   * Start polling for changes
   */
  _startPolling() {
    if (this.state.timers.poll) {
      clearInterval(this.state.timers.poll);
    }

    this.state.timers.poll = setInterval(() => {
      const sig = this._computeSignature();
      if (sig !== this.state.lastSig) {
        this.state.lastSig = sig;
        this._triggerCallback('onSignatureChange', { 
          signature: sig, 
          reason: 'poll' 
        });
      }
    }, this.config.pollIntervalMs);
  }

  /**
   * Compute page signature for change detection
   */
  _computeSignature() {
    try {
      // Create signature from key page elements
      const elements = [
        document.title,
        window.location.href,
        document.querySelector('h1')?.textContent?.trim()?.slice(0, 50) || '',
        document.querySelector('.product-title, .product-name')?.textContent?.trim()?.slice(0, 50) || '',
        document.querySelector('[data-selected], .selected, :checked')?.textContent?.trim()?.slice(0, 20) || '',
        document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.slice(0, 50) || ''
      ];

      return elements.join('|');
    } catch (error) {
      console.debug('[PageWatcher] Signature computation error:', error);
      return `${Date.now()}`;
    }
  }

  /**
   * Trigger callback if it exists
   */
  _triggerCallback(callbackName, data) {
    if (this.callbacks[callbackName] && typeof this.callbacks[callbackName] === 'function') {
      try {
        this.callbacks[callbackName](data);
      } catch (error) {
        console.error(`[PageWatcher] Callback ${callbackName} error:`, error);
      }
    }
  }

  /**
   * Manually trigger change detection
   */
  forceCheck(reason = 'manual') {
    const sig = this._computeSignature();
    if (sig !== this.state.lastSig) {
      this.state.lastSig = sig;
      this._triggerCallback('onSignatureChange', { 
        signature: sig, 
        reason 
      });
      return true;
    }
    return false;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart polling if interval changed
    if (oldConfig.pollIntervalMs !== this.config.pollIntervalMs && this.state.isWatching) {
      this._startPolling();
    }

    return this.config;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      ...this.state,
      isWatching: this.state.isWatching,
      currentSignature: this._computeSignature(),
      currentHref: window.location.href
    };
  }

  /**
   * Reset internal state
   */
  reset() {
    this.state.lastHref = window.location.href;
    this.state.lastSig = this._computeSignature();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageWatcher;
}
