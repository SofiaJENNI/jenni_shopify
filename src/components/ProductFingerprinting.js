/**
 * Product Fingerprinting Component
 * Extracts product information from DOM elements and structured data
 */
class ProductFingerprinting {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Main fingerprinting method - extracts all product data
   */
  fingerprint() {
    // Enhanced selector helper with priority and validation
    const bySelectors = (selectors, validator = null) => {
      for (const s of selectors) {
        try {
          const el = document.querySelector(s);
          if (el) {
            const val = el.getAttribute('content') || el.getAttribute('value') || 
                       el.textContent?.trim() || el.innerText?.trim();
            if (val && (!validator || validator(val))) return val;
          }
        } catch {}
      }
      return null;
    };

    const isValidGtin = (v) => /^[0-9]{8,14}$/.test(v) && v.length >= 8;
    const isValidSku = (v) => v && v.length >= 2 && v.length <= 100;

    // Enhanced GTIN extraction with validation
    const gtin = bySelectors([
      // Schema.org microdata
      '[itemprop="gtin13"]', '[itemprop="gtin12"]', '[itemprop="gtin"]',
      '[itemprop="upc"]', '[itemprop="ean"]', '[itemprop="isbn"]',
      // Meta tags
      'meta[property="product:upc"]', 'meta[name="product:upc"]',
      'meta[property="product:ean"]', 'meta[name="product:ean"]',
      // Data attributes
      '[data-gtin]', '[data-upc]', '[data-ean]', '[data-barcode]',
      // Form inputs
      '[name="gtin"]', '[name="upc"]', '[name="ean"]', '[name="barcode"]',
      // Generic class patterns
      '.gtin', '.upc', '.ean', '.gtin'
    ], isValidGtin);

    // Enhanced SKU extraction
    const sku = bySelectors([
      // Schema.org
      '[itemprop="sku"]', '[itemprop="model"]', '[itemprop="mpn"]',
      // Data attributes (prioritized)
      '[data-sku]', '[data-product-sku]', '[data-variant-sku]', '[data-model]', '[data-mpn]',
      // Selected variant (common pattern)
      'select[name="id"] option:checked', 'input[name="id"]:checked',
      '.variant-sku.selected', '.selected-variant [data-sku]',
      // Form inputs
      '[name="sku"]', '[name="model"]', '[name="mpn"]', '[name="product_id"]',
      // Meta tags
      'meta[name="product:sku"]', 'meta[property="product:sku"]',
      'meta[name="product:model"]', 'meta[property="product:model"]',
      // Platform specific
      '[data-shopify-sku]', '[data-wc-sku]', '[data-magento-sku]',
      // Class patterns
      '.product-sku', '.sku', '.model-number', '.part-number'
    ], isValidSku);

    // Enhanced title extraction
    let title = bySelectors([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]', 
      'meta[name="title"]',
      'h1.product-title', 'h1.product-name', 'h1[itemprop="name"]',
      '.product-title h1', '.product-name h1',
      'h1'
    ]) || document.title;
    
    // Clean up Amazon titles
    if (title && (title.toLowerCase().includes('amazon.com') || window.location.href.toLowerCase().includes('amazon.com'))) {
      title = title.replace(/amazon\.com/gi, '').trim();
      const lastColonIndex = title.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        title = title.substring(0, lastColonIndex).trim();
      }
    }

    // Enhanced brand extraction
    let brand = bySelectors([
      // Schema.org
      '[itemprop="brand"]', 
      // Meta tags
      'meta[property="product:brand"]', 'meta[name="product:brand"]',
      'meta[property="og:brand"]', 'meta[name="brand"]',
      // Data attributes
      '[data-brand]', '[data-product-brand]', '[data-manufacturer]',
      // Form inputs
      '[name="brand"]', '[name="manufacturer"]',
      // Class patterns
      '.product-brand', '.brand-name', '.manufacturer',
      '.product-details .brand', '.product-info .brand'
    ]);

    // Product ID extraction
    const productId = bySelectors([
      '[data-product-id]', '[data-pid]', '[name="product_id"]',
      'meta[name="product:id"]', '.product-id'
    ]);

    // Enhanced JSON-LD parsing
    const ld = { gtin13: null, gtin12: null, gtin: null, sku: null, brand: null, name: null, offers: null, mpn: null };
    try {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const sc of scripts) {
        try {
          const jsonText = sc.textContent || sc.innerHTML || '';
          if (!jsonText.trim()) continue;
          
          const json = JSON.parse(jsonText);
          const arr = Array.isArray(json) ? json : [json];
          
          for (const item of arr) {
            this.extractFromJsonLd(item, ld);
          }
        } catch (e) {
          console.debug('[ProductFingerprinting] JSON-LD parse error:', e);
        }
      }
    } catch (e) {
      console.debug('[ProductFingerprinting] JSON-LD extraction error:', e);
    }

    // Combine results with priority
    const strongGtin = ld.gtin13 || ld.gtin12 || ld.gtin || gtin || null;
    const strongSku = ld.sku || ld.mpn || sku || null;
    const strongTitle = ld.name || title || null;
    const strongBrand = ld.brand || brand || null;

    // Brand extraction from title if not found
    if (!strongBrand && strongTitle) {
      brand = this.extractBrandFromTitle(strongTitle);
    }

    const price = this.extractCurrentPrice();
    const styleCode = this.extractStyleCode();
    const variant = this.detectSelectedVariant();

    return {
      gtin: strongGtin,
      sku: strongSku,
      title: strongTitle,
      brand: strongBrand || brand,
      price,
      styleCode,
      variant,
      productId,
      url: window.location.href,
      timestamp: Date.now()
    };
  }

  /**
   * Extract data from JSON-LD structured data
   */
  extractFromJsonLd(node, ld) {
    if (!node || typeof node !== 'object') return;

    const type = (node['@type'] || node.type || '').toString().toLowerCase();
    
    if (type.includes('product')) {
      ld.name = ld.name || node.name || null;
      ld.sku = ld.sku || node.sku || null;
      ld.mpn = ld.mpn || node.mpn || null;
      ld.gtin13 = ld.gtin13 || node.gtin13 || null;
      ld.gtin12 = ld.gtin12 || node.gtin12 || null;
      ld.gtin = ld.gtin || node.gtin || null;
      
      if (node.brand) {
        ld.brand = ld.brand || (typeof node.brand === 'string' ? node.brand : node.brand.name) || null;
      }
      
      if (node.offers) {
        ld.offers = node.offers;
      }
    }

    // Recursively check nested objects
    for (const key in node) {
      if (typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(item => this.extractFromJsonLd(item, ld));
        } else {
          this.extractFromJsonLd(node[key], ld);
        }
      }
    }
  }

  /**
   * Extract brand from product title using patterns
   */
  extractBrandFromTitle(title) {
    if (!title) return null;

    const brandPatterns = [
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/,  // "Brand Name Product..."
      /\b(Nike|Adidas|Apple|Sony|Samsung|Microsoft|Dell|HP|Canon|Nikon)\b/i,
      /^([A-Z]{2,})\s+/,  // "BRAND Product..."
    ];

    for (const pattern of brandPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract style code from URL or page elements
   */
  extractStyleCode() {
    // URL patterns
    const urlPatterns = [
      /\/([A-Z0-9]{4,}-[0-9]{3})/i,
      /style[_-]?code[=:]([A-Z0-9-]+)/i,
      /model[=:]([A-Z0-9-]+)/i
    ];

    for (const pattern of urlPatterns) {
      const match = location.href.match(pattern);
      if (match && match[1]) return match[1].toUpperCase();
    }

    // DOM selectors
    const styleSelectors = [
      '[data-style-code]', '[data-model-code]', '[data-style]',
      'meta[name="style-code"]', 'meta[property="product:style"]',
      '.style-code', '.model-code'
    ];

    for (const selector of styleSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const value = el.getAttribute('content') || el.getAttribute('value') || 
                       el.getAttribute('data-style-code') || el.textContent?.trim();
          if (value && /^[A-Z0-9-]{4,}$/i.test(value)) {
            return value.toUpperCase();
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Extract current price from page elements
   */
  extractCurrentPrice() {
    const priceSelectors = [
      '.price', '.current-price', '.sale-price', '.product-price',
      '[data-price]', '[itemprop="price"]', '[data-product-price]',
      'meta[property="product:price:amount"]',
      '.price-current', '.price-now', '.offer-price'
    ];

    for (const selector of priceSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const priceText = el.getAttribute('content') || el.getAttribute('data-price') || 
                           el.textContent || el.innerText || '';
          
          if (priceText) {
            const match = priceText.match(/[\d,]+\.?\d*/);
            if (match) {
              const price = parseFloat(match[0].replace(/,/g, ''));
              if (price > 0 && price < 10000) return price;
            }
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Detect selected product variant (size, color, etc.)
   */
  detectSelectedVariant() {
    const variant = {};

    // Size detection
    const sizeSelectors = [
      'select[name*="size"] option:checked', 'input[name*="size"]:checked',
      '.size-selector .selected', '[data-selected-size]',
      'meta[property="product:size"]'
    ];

    for (const selector of sizeSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const size = el.textContent || el.value || el.getAttribute('data-selected-size');
          if (size && /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,2}|\d{1,2}\.\d)$/.test(size.trim())) {
            variant.size = size.trim().toUpperCase();
            break;
          }
        }
      } catch {}
    }

    // Color detection
    const colorSelectors = [
      'select[name*="color"] option:checked', 'input[name*="color"]:checked',
      '.color-selector .selected', '[data-selected-color]',
      'meta[property="product:color"]'
    ];

    for (const selector of colorSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const color = el.textContent || el.value || el.getAttribute('data-selected-color');
          if (color && color.trim().length <= 20) {
            variant.color = color.trim().toLowerCase();
            break;
          }
        }
      } catch {}
    }

    return Object.keys(variant).length > 0 ? variant : null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductFingerprinting;
}
