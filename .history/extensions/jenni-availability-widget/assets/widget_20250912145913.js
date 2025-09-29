(()=> {
  // Enhanced widget with automatic zip detection and Apple-inspired UI
  let zipManager = null;
  let currentZip = null;

  async function check(zip, gtin, storeId, gid){
    const r = await fetch(`/apps/jenni/v1/eligibility?zip=${zip}&gtin=${gtin}&storeId=${storeId}&productGid=${gid}`);
    return r.json();
  }

  function createAppleUI(el, eligible, texts, zip) {
    el.className = 'jenni-widget-enhanced';
    
    const status = eligible ? 'available' : 'unavailable';
    const icon = eligible ? '✓' : '📦';
    const message = eligible ? texts.pos : texts.neg;
    
    el.innerHTML = `
      <div class="jenni-widget-content ${status}">
        <div class="jenni-widget-header">
          <span class="jenni-widget-icon">${icon}</span>
          <div class="jenni-widget-text">
            <div class="jenni-widget-title">${message}</div>
            <div class="jenni-widget-subtitle">
              ${eligible ? 'Same-day delivery available' : 'Standard shipping available'}
            </div>
          </div>
        </div>
        <div class="jenni-widget-location">
          <span class="jenni-location-icon">📍</span>
          <span class="jenni-location-text">${zip}</span>
          <button class="jenni-location-change" aria-label="Change location">Change</button>
        </div>
      </div>
    `;

    // Add styles if not already present
    injectStyles();

    // Handle location change
    const changeBtn = el.querySelector('.jenni-location-change');
    changeBtn.addEventListener('click', () => {
      showZipModal(el, (newZip) => {
        if (newZip && newZip !== zip) {
          currentZip = newZip;
          localStorage.setItem("jenni_zip_preference", newZip);
          // Re-check with new ZIP
          const gtin = el.dataset.gtin;
          const storeId = el.dataset.storeId;
          const gid = el.dataset.productGid;
          const texts = { pos: el.dataset.positive_text, neg: el.dataset.negative_text };
          check(newZip, gtin, storeId, gid).then(res=> {
            createAppleUI(el, res.eligible, texts, newZip);
          });
        }
      });
    });
  }

  function showZipModal(parentEl, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'jenni-zip-modal';
    modal.innerHTML = `
      <div class="jenni-zip-backdrop">
        <div class="jenni-zip-dialog">
          <h3>Update Delivery Location</h3>
          <div class="jenni-zip-input-group">
            <input type="text" class="jenni-zip-input" placeholder="Enter ZIP code" maxlength="5" value="${currentZip || ''}" />
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
      }
    });

    document.body.appendChild(modal);
    setTimeout(() => input.focus(), 100);
  }

  function injectStyles() {
    if (document.getElementById('jenni-widget-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'jenni-widget-styles';
    styles.textContent = `
      .jenni-widget-enhanced {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        padding: 16px;
        margin: 16px 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.2s ease;
      }

      .jenni-widget-enhanced:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      }

      .jenni-widget-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .jenni-widget-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
      }

      .available .jenni-widget-icon {
        background: #d1fae5;
        color: #059669;
      }

      .unavailable .jenni-widget-icon {
        background: #f3f4f6;
        color: #6b7280;
      }

      .jenni-widget-title {
        font-size: 16px;
        font-weight: 600;
        color: #111827;
        line-height: 1.2;
      }

      .available .jenni-widget-title {
        color: #059669;
      }

      .jenni-widget-subtitle {
        font-size: 13px;
        color: #6b7280;
        margin-top: 2px;
      }

      .jenni-widget-location {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 14px;
      }

      .jenni-location-icon {
        color: #6b7280;
      }

      .jenni-location-text {
        flex: 1;
        font-weight: 500;
        color: #374151;
      }

      .jenni-location-change {
        background: none;
        border: none;
        color: #2563eb;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s ease;
      }

      .jenni-location-change:hover {
        background: #dbeafe;
      }

      .jenni-zip-modal {
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
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .jenni-zip-dialog {
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 320px;
        width: 100%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        animation: jenni-modal-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes jenni-modal-enter {
        from {
          opacity: 0;
          transform: scale(0.8) translateY(20px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .jenni-zip-dialog h3 {
        margin: 0 0 16px;
        font-size: 18px;
        font-weight: 600;
        color: #111827;
        text-align: center;
      }

      .jenni-zip-input-group {
        margin-bottom: 20px;
      }

      .jenni-zip-input {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 16px;
        text-align: center;
        letter-spacing: 2px;
        font-weight: 600;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .jenni-zip-input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }

      .jenni-zip-buttons {
        display: flex;
        gap: 12px;
      }

      .jenni-btn {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .jenni-btn-primary {
        background: #2563eb;
        color: white;
      }

      .jenni-btn-primary:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .jenni-btn-primary:disabled {
        background: #d1d5db;
        cursor: not-allowed;
      }

      .jenni-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .jenni-btn-secondary:hover {
        background: #e5e7eb;
      }
    `;

    document.head.appendChild(styles);
  }

  // Initialize zip manager for auto-detection
  function initZipManager() {
    try {
      // Simple zip management without external dependencies
      const stored = localStorage.getItem("jenni_zip_preference");
      if (stored && /^\d{5}$/.test(stored)) {
        currentZip = stored;
        return Promise.resolve(stored);
      }

      // Try geolocation
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          currentZip = "60612"; // Default
          resolve(currentZip);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              // Simple reverse geocoding fallback
              const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
              const data = await response.json();
              const zip = data.postcode?.replace(/\D/g, '').slice(0, 5);
              
              if (zip && /^\d{5}$/.test(zip)) {
                currentZip = zip;
                localStorage.setItem("jenni_zip_preference", zip);
                resolve(zip);
              } else {
                currentZip = "60612";
                resolve(currentZip);
              }
            } catch (error) {
              currentZip = "60612";
              resolve(currentZip);
            }
          },
          () => {
            currentZip = "60612";
            resolve(currentZip);
          },
          { timeout: 5000 }
        );
      });
    } catch (error) {
      currentZip = "60612";
      return Promise.resolve(currentZip);
    }
  }

  document.addEventListener("DOMContentLoaded", async ()=> {
    const el = document.getElementById("jenni-widget");
    if(!el) return;

    // Initialize zip detection
    await initZipManager();

    // Try to get GTIN from product data, fallback to SKU
    const gtin = el.closest("[data-product-id]").querySelector("[name='gtin']")?.value || 
                 el.closest("[data-product-id]").querySelector("[name='sku']")?.value || '';
    const storeId = el.dataset.storeId;
    const gid = el.dataset.productGid;
    const texts = { 
      pos: el.dataset.positive_text || 'Available for same-day delivery', 
      neg: el.dataset.negative_text || 'Standard shipping available' 
    };

    // Store data attributes for later use
    el.dataset.gtin = gtin;
    el.dataset.storeId = storeId;
    el.dataset.productGid = gid;
    el.dataset.positive_text = texts.pos;
    el.dataset.negative_text = texts.neg;

    // Check eligibility and render
    check(currentZip, gtin, storeId, gid).then(res=> {
      createAppleUI(el, res.eligible, texts, currentZip);
    }).catch(() => {
      // Fallback rendering on error
      createAppleUI(el, false, texts, currentZip);
    });
  });
})();
