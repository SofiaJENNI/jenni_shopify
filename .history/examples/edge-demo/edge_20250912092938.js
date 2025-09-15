(() => {
  const JenniEdge = {
    config: { apiBase: '', tenant: 'demo', zip: '', selector: 'body', autoRefresh: true, autoOpenPanel: false, debug: false, forceMock: false, position: 'bottom-right', offsetX: 16, offsetY: 20, keepOpenOnRefresh: true, requestTimeoutMs: 10000, mockData: { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 } },
  state: { data: null, nodes: [], panelOpen: false, panelEl: null, openedOnce: false, lastHref: '', lastSig: '', refreshTimer: null, inFlightAbort: null, inFlightTimer: null, sigDebounceTimer: null, pollTimer: null },

    init(opts = {}) {
      this.config = { ...this.config, ...opts };
      this.injectStyles();
      this.installWatchers();
      this.run();
      return this;
    },

    fingerprint() {
      // Enhanced selector helper with priority and validation
      const bySelectors = (selectors, validator = null) => {
        for (const s of selectors) {
          try {
          const el = document.querySelector(s);
            if (!el) continue;
            
            let value = el.getAttribute('content') || el.getAttribute('value') || 
                       el.textContent || el.innerText || null;
            
            if (value) {
              value = value.trim();
              if (validator ? validator(value) : value) return value;
            }
          } catch {}
        }
        return null;
      };

      // GTIN/UPC/EAN validators
      const isValidGtin = (v) => /^[0-9]{8,14}$/.test(v) && v.length >= 8;
      const isValidSku = (v) => v && v.length >= 2 && v.length <= 100;

      // Enhanced GTIN extraction (UPC, EAN, GTIN variants)
      const gtin = bySelectors([
        // Schema.org microdata
        '[itemprop="gtin13"]', '[itemprop="gtin12"]', '[itemprop="gtin14"]', '[itemprop="gtin8"]', '[itemprop="gtin"]',
        // Common data attributes
        '[data-gtin]', '[data-gtin13]', '[data-gtin12]', '[data-upc]', '[data-ean]', '[data-barcode]',
        // Form inputs
        '[name="gtin"]', '[name="upc"]', '[name="ean"]', '[name="barcode"]',
        // Meta tags
        'meta[name="product:upc"]', 'meta[property="product:upc"]',
        'meta[name="product:ean"]', 'meta[property="product:ean"]',
        // Shopify specific
        '[data-product-barcode]', '.product-barcode',
        // WooCommerce
        '.woocommerce-product-barcode', '[data-sku-barcode]',
        // Generic class patterns
        '.barcode', '.upc', '.ean', '.gtin'
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
      const title = bySelectors([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]', 
        'meta[name="title"]',
        'h1.product-title', 'h1.product-name', 'h1[itemprop="name"]',
        '.product-title h1', '.product-name h1',
        'h1'
      ]) || document.title;

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
        '[data-product-id]', '[data-productid]', '[data-id]',
        'meta[name="product:id"]', 'meta[property="product:id"]',
        '[name="product_id"]', '[name="id"]',
        '.product-id', '#product-id'
      ]);

      // Enhanced JSON-LD parsing with better error handling and nesting support
      const ld = { gtin13: null, gtin12: null, gtin: null, sku: null, brand: null, name: null, offers: null, mpn: null };
      try {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const sc of scripts) {
          try {
            const jsonText = sc.textContent || sc.innerHTML || '';
            if (!jsonText.trim()) continue;
            
            let json = JSON.parse(jsonText);
          const arr = Array.isArray(json) ? json : [json];
            
          for (const node of arr) {
              this.extractFromJsonLdNode(node, ld);
            }
          } catch (e) {
            if (this.config.debug) console.log('[JenniEdge] JSON-LD parse error:', e);
          }
        }
      } catch {}

      // Priority resolution with validation
      const strongGtin = ld.gtin13 || ld.gtin12 || ld.gtin || gtin || null;
      const strongSku = ld.sku || ld.mpn || sku || null;
      const strongTitle = ld.name || title || null;
      brand = ld.brand || brand || this.extractBrandFromTitle(strongTitle) || null;

      // Enhanced style code extraction (URL + content)
      let styleCode = this.extractStyleCode();
      
      // Price extraction from current page state
      const price = this.extractCurrentPrice();

      // Variant detection
      const variant = this.detectSelectedVariant();

      return { 
        url: location.href, 
        title: strongTitle, 
        brand, 
        sku: strongSku, 
        gtin: strongGtin, 
        styleCode, 
        productId, 
        price,
        variant,
        ld,
        timestamp: Date.now(),
        userAgent: navigator.userAgent.split(' ')[0] // First part for debugging
      };
    },

    // Helper: Extract from JSON-LD node recursively
    extractFromJsonLdNode(node, ld) {
      if (!node || typeof node !== 'object') return;
      
      const type = (node['@type'] || node.type || '').toString().toLowerCase();
      
      if (type.includes('product') || type.includes('offer')) {
        // Basic properties
        ld.name = ld.name || node.name || null;
        ld.sku = ld.sku || node.sku || null;
        ld.mpn = ld.mpn || node.mpn || null;
        
        // GTIN variants
        ld.gtin13 = ld.gtin13 || node.gtin13 || null;
        ld.gtin12 = ld.gtin12 || node.gtin12 || null;  
        ld.gtin = ld.gtin || node.gtin || node.gtin14 || node.gtin8 || null;
        
        // Brand handling (string or object)
        if (node.brand && !ld.brand) {
          if (typeof node.brand === 'string') {
            ld.brand = node.brand;
          } else if (node.brand.name) {
            ld.brand = node.brand.name;
          } else if (node.brand['@type'] && node.brand['@type'].includes('Brand')) {
            ld.brand = node.brand.name || node.brand.alternateName || null;
          }
        }
        
        // Offers handling
        if (node.offers && !ld.offers) {
          ld.offers = node.offers;
        }
      }
      
      // Recursive search in nested objects/arrays
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('@')) continue; // Skip JSON-LD metadata
        
        if (Array.isArray(value)) {
          value.forEach(item => this.extractFromJsonLdNode(item, ld));
        } else if (typeof value === 'object' && value !== null) {
          this.extractFromJsonLdNode(value, ld);
        }
      }
    },

    // Helper: Extract brand from title using common patterns
    extractBrandFromTitle(title) {
      if (!title) return null;
      
      // Common brand patterns in titles
      const brandPatterns = [
        /^([A-Z][a-zA-Z]+)\s+/,  // "Nike Air Max"
        /\b(Nike|Adidas|Puma|Jordan|Converse|Vans|New Balance|ASICS|Under Armour|Reebok)\b/i,
        /\b([A-Z]{2,})\s+[A-Z0-9-]+/,  // "NIKE ABC-123"
      ];
      
      for (const pattern of brandPatterns) {
        const match = title.match(pattern);
        if (match) return match[1];
      }
      
      return null;
    },

    // Helper: Enhanced style code extraction
    extractStyleCode() {
      // URL-based extraction (improved patterns)
      const urlPatterns = [
        /\/([A-Z0-9]{2,}-[A-Z0-9]{2,})/i,          // /ABC-123
        /\/([A-Z]{2,}[0-9]{3,})/i,                  // /ABC123
        /product[\/\-]([A-Z0-9]{4,}-[0-9]{3,})/i,  // product/ABC-123
        /-([A-Z0-9]{4,}-[0-9]{3,})/i,              // something-ABC-123
      ];
      
      for (const pattern of urlPatterns) {
        const match = location.pathname.match(pattern) || location.href.match(pattern);
        if (match) return match[1];
      }
      
      // Content-based extraction
      const contentPatterns = [
        '.style-code', '.product-code', '.model-code',
        '[data-style]', '[data-style-code]',
        '.product-details:contains("Style")',
      ];
      
      for (const selector of contentPatterns) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent || el.getAttribute('data-style') || '';
            const match = text.match(/([A-Z0-9]{4,}-[0-9]{3,})/i);
            if (match) return match[1];
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Enhanced price extraction with multiple formats and currencies
    extractCurrentPrice() {
      const priceSelectors = [
        // Current/sale prices (priority)
        '.price.current', '.current-price', '.sale-price', '.price-now', '.price-special',
        '[data-price]', '[data-current-price]', '[data-sale-price]',
        '.price:not(.original):not(.was):not(.regular)', 
        '.product-price .price', '.price-current',
        // Schema.org and meta
        'meta[property="product:price:amount"]', 'meta[name="product:price"]',
        '[itemprop="price"]', '[itemprop="lowPrice"]', '[itemprop="offers"] [itemprop="price"]',
        // Platform specific
        '.shopify-price', '.woocommerce-price-amount', '.magento-price',
        '[data-shopify-price]', '[data-wc-price]',
        // Generic patterns
        '.selling-price', '.final-price', '.discounted-price', '.offer-price'
      ];
      
      const priceData = {
        current: null,
        original: null,
        currency: 'USD',
        isOnSale: false,
        priceRange: null,
        confidence: 0
      };
      
      // Try structured selectors first
      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let priceText = el.getAttribute('content') || 
                         el.getAttribute('data-price') || 
                         el.getAttribute('data-currency-value') ||
                         el.textContent || 
                         el.innerText || '';
          
          const parsed = this.parsePrice(priceText.trim());
          if (parsed.price > 0) {
            priceData.current = parsed.price;
            priceData.currency = parsed.currency;
            priceData.confidence = 0.9;
            break;
          }
        } catch {}
      }
      
      // Look for original/regular prices if we found a current price
      if (priceData.current) {
        const originalSelectors = [
          '.price.original', '.regular-price', '.was-price', '.price-was',
          '[data-original-price]', '[data-regular-price]',
          '.price.crossed-out', '.price.strikethrough',
          '[itemprop="highPrice"]', 'meta[property="product:price:standard_amount"]'
        ];
        
        for (const selector of originalSelectors) {
          try {
            const el = document.querySelector(selector);
            if (!el) continue;
            
            const priceText = el.getAttribute('content') || el.textContent || '';
            const parsed = this.parsePrice(priceText.trim());
            if (parsed.price > priceData.current) {
              priceData.original = parsed.price;
              priceData.isOnSale = true;
              break;
            }
          } catch {}
        }
      }
      
      // Check for price ranges
      if (!priceData.current) {
        const rangeSelectors = ['.price-range', '.price-from-to', '[data-price-range]'];
        for (const selector of rangeSelectors) {
          try {
            const el = document.querySelector(selector);
            if (!el) continue;
            
            const rangeText = el.textContent || '';
            const range = this.parsePriceRange(rangeText);
            if (range) {
              priceData.priceRange = range;
              priceData.current = range.min;
              priceData.confidence = 0.7;
              break;
            }
          } catch {}
        }
      }
      
      // Fallback: parse from product description or title
      if (!priceData.current) {
        const fallbackPrice = this.extractPriceFromDescription();
        if (fallbackPrice) {
          priceData.current = fallbackPrice.price;
          priceData.currency = fallbackPrice.currency;
          priceData.confidence = 0.5;
        }
      }
      
      return priceData.current ? priceData : null;
    },

    // Helper: Parse price text with multiple formats and currencies
    parsePrice(priceText) {
      if (!priceText) return { price: 0, currency: 'USD' };
      
      // Currency detection patterns
      const currencyPatterns = [
        { regex: /\$/, currency: 'USD' },
        { regex: /€/, currency: 'EUR' },
        { regex: /£/, currency: 'GBP' },
        { regex: /¥/, currency: 'JPY' },
        { regex: /USD/i, currency: 'USD' },
        { regex: /EUR/i, currency: 'EUR' },
        { regex: /GBP/i, currency: 'GBP' },
        { regex: /CAD/i, currency: 'CAD' }
      ];
      
      let currency = 'USD';
      for (const pattern of currencyPatterns) {
        if (pattern.regex.test(priceText)) {
          currency = pattern.currency;
          break;
        }
      }
      
      // Price extraction patterns (handle different formats)
      const pricePatterns = [
        /[\$€£¥]?\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/,  // $1,234.56
        /(\d{1,3}(?:,\d{3})*\.?\d{0,2})\s*[\$€£¥]/,   // 1,234.56$
        /(\d{1,3}(?:\.\d{3})*,\d{2})/,                // European: 1.234,56
        /(\d+\.?\d*)/                                  // Simple: 123.45
      ];
      
      for (const pattern of pricePatterns) {
        const match = priceText.match(pattern);
        if (match) {
          let priceStr = match[1];
          
          // Handle European format (1.234,56 -> 1234.56)
          if (priceStr.includes('.') && priceStr.includes(',') && priceStr.lastIndexOf(',') > priceStr.lastIndexOf('.')) {
            priceStr = priceStr.replace(/\./g, '').replace(',', '.');
          } else {
            // Remove thousand separators
            priceStr = priceStr.replace(/,/g, '');
          }
          
          const price = parseFloat(priceStr);
          if (price > 0) {
            return { price, currency };
          }
        }
      }
      
      return { price: 0, currency };
    },

    // Helper: Parse price ranges (e.g., "$50 - $100", "From $25")
    parsePriceRange(rangeText) {
      if (!rangeText) return null;
      
      const rangePatterns = [
        /[\$€£¥]?\s*(\d+(?:\.\d{2})?)\s*[-–—]\s*[\$€£¥]?\s*(\d+(?:\.\d{2})?)/,  // $50 - $100
        /from\s+[\$€£¥]?\s*(\d+(?:\.\d{2})?)/i,                                  // From $25
        /starting\s+at\s+[\$€£¥]?\s*(\d+(?:\.\d{2})?)/i,                        // Starting at $30
        /[\$€£¥]?\s*(\d+(?:\.\d{2})?)\s*\+/                                     // $50+
      ];
      
      for (const pattern of rangePatterns) {
        const match = rangeText.match(pattern);
        if (match) {
          const min = parseFloat(match[1]);
          const max = match[2] ? parseFloat(match[2]) : min * 1.5; // Estimate max if not provided
          
          if (min > 0) {
            return { min, max, text: rangeText.trim() };
          }
        }
      }
      
      return null;
    },

    // Helper: Extract price from product descriptions as fallback
    extractPriceFromDescription() {
      const descSelectors = [
        '.product-description', '.product-details', '.description',
        '[data-product-description]', '.product-summary', '.product-info'
      ];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent || '';
          const parsed = this.parsePrice(text);
          if (parsed.price > 0) {
            return parsed;
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Enhanced clothing variant detection
    detectSelectedVariant() {
      const variantInfo = {};
      
      // Enhanced size detection with clothing size standards
      const sizeData = this.extractSizeInformation();
      if (sizeData) variantInfo.size = sizeData;
      
      // Enhanced color detection
      const colorData = this.extractColorInformation();
      if (colorData) variantInfo.color = colorData;
      
      // Material detection
      const material = this.extractMaterial();
      if (material) variantInfo.material = material;
      
      // Fit detection (for clothing)
      const fit = this.extractFit();
      if (fit) variantInfo.fit = fit;
      
      // Style/pattern detection
      const style = this.extractStyle();
      if (style) variantInfo.style = style;
      
      return Object.keys(variantInfo).length > 0 ? variantInfo : null;
    },

    // Helper: Extract size information with validation
    extractSizeInformation() {
      const sizeSelectors = [
        // Selected options
        'select[name*="size"] option:checked', 'select[name*="Size"] option:checked',
        'input[name*="size"]:checked', 'input[name*="Size"]:checked',
        '.size-option.selected', '.size-selector.selected', '.size.selected',
        '[data-size].selected', '[data-size-value].selected',
        // Active/current size indicators
        '.size-option.active', '.size.active', '.size-current',
        // Schema.org
        '[itemprop="size"]',
        // Platform specific
        '.shopify-size.selected', '.wc-size.selected'
      ];
      
      for (const selector of sizeSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let sizeValue = el.value || el.textContent || el.getAttribute('data-size') || 
                         el.getAttribute('data-size-value') || el.getAttribute('title');
          
          if (sizeValue) {
            sizeValue = sizeValue.trim();
            const validated = this.validateSize(sizeValue);
            if (validated) {
              return {
                value: validated.size,
                type: validated.type,
                confidence: 0.9,
                source: 'selected'
              };
            }
          }
        } catch {}
      }
      
      // Fallback: parse from description
      const descSize = this.extractSizeFromDescription();
      if (descSize) {
        return {
          value: descSize.size,
          type: descSize.type,
          confidence: 0.6,
          source: 'description'
        };
      }
      
      return null;
    },

    // Helper: Validate and categorize sizes
    validateSize(sizeText) {
      if (!sizeText) return null;
      
      const size = sizeText.toUpperCase().trim();
      
      // Clothing size patterns
      const sizePatterns = [
        { regex: /^(XXS|XS|S|M|L|XL|XXL|XXXL)$/, type: 'letter' },
        { regex: /^(\d+)$/, type: 'numeric' },
        { regex: /^(\d{1,2}\/\d{1,2})$/, type: 'fraction' },
        { regex: /^(\d{1,2}[A-Z]?)$/, type: 'numeric_letter' },
        { regex: /^(ONE SIZE|OS|ONESIZE)$/, type: 'onesize' },
        // Shoe sizes
        { regex: /^(\d{1,2}\.?\d?)([A-Z]?)$/, type: 'shoe' },
        // European sizes
        { regex: /^(\d{2,3})$/, type: 'european' },
        // UK sizes
        { regex: /^UK\s*(\d{1,2}\.?\d?)$/, type: 'uk' },
        // US sizes
        { regex: /^US\s*(\d{1,2}\.?\d?)$/, type: 'us' }
      ];
      
      for (const pattern of sizePatterns) {
        const match = size.match(pattern.regex);
        if (match) {
          return {
            size: match[1] || size,
            type: pattern.type,
            original: sizeText
          };
        }
      }
      
      return null;
    },

    // Helper: Extract size from product description
    extractSizeFromDescription() {
      const descSelectors = [
        '.product-description', '.product-details', '.description',
        '.product-summary', '.size-guide', '.sizing-info'
      ];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent || '';
          
          // Look for size mentions
          const sizePatterns = [
            /size:?\s*(XXS|XS|S|M|L|XL|XXL|XXXL)/i,
            /size:?\s*(\d{1,2})/i,
            /(small|medium|large)/i
          ];
          
          for (const pattern of sizePatterns) {
            const match = text.match(pattern);
            if (match) {
              const validated = this.validateSize(match[1]);
              if (validated) return validated;
            }
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Extract color information
    extractColorInformation() {
      const colorSelectors = [
        // Selected color options
        'select[name*="color"] option:checked', 'select[name*="Color"] option:checked',
        'input[name*="color"]:checked', 'input[name*="Color"]:checked',
        '.color-option.selected', '.color-selector.selected', '.color.selected',
        '[data-color].selected', '[data-color-name].selected',
        // Active color indicators
        '.color-option.active', '.color.active', '.color-current',
        // Schema.org
        '[itemprop="color"]',
        // Platform specific
        '.shopify-color.selected', '.wc-color.selected'
      ];
      
      for (const selector of colorSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let colorValue = el.value || el.textContent || el.getAttribute('data-color') || 
                          el.getAttribute('data-color-name') || el.getAttribute('title') ||
                          el.getAttribute('alt');
          
          if (colorValue) {
            colorValue = colorValue.trim();
            const validated = this.validateColor(colorValue);
            if (validated) {
              return {
                name: validated.name,
                hex: validated.hex,
                confidence: 0.9,
                source: 'selected'
              };
            }
          }
          
          // Check for background color or style attributes
          const bgColor = el.style.backgroundColor;
          if (bgColor) {
            const hex = this.rgbToHex(bgColor);
            if (hex) {
              return {
                name: colorValue || 'Unknown',
                hex: hex,
                confidence: 0.7,
                source: 'style'
              };
            }
          }
        } catch {}
      }
      
      // Fallback: parse from title or description
      const descColor = this.extractColorFromDescription();
      if (descColor) {
        return {
          name: descColor,
          confidence: 0.6,
          source: 'description'
        };
      }
      
      return null;
    },

    // Helper: Validate color names and convert to hex if possible
    validateColor(colorText) {
      if (!colorText) return null;
      
      const color = colorText.toLowerCase().trim();
      
      // Common color mappings
      const colorMap = {
        'black': '#000000', 'white': '#FFFFFF', 'red': '#FF0000', 'blue': '#0000FF',
        'green': '#008000', 'yellow': '#FFFF00', 'orange': '#FFA500', 'purple': '#800080',
        'pink': '#FFC0CB', 'brown': '#A52A2A', 'gray': '#808080', 'grey': '#808080',
        'navy': '#000080', 'beige': '#F5F5DC', 'tan': '#D2B48C', 'maroon': '#800000'
      };
      
      // Check if it's a hex color
      if (/^#[0-9A-F]{6}$/i.test(color)) {
        return { name: colorText, hex: color.toUpperCase() };
      }
      
      // Check common color names
      if (colorMap[color]) {
        return { name: colorText, hex: colorMap[color] };
      }
      
      // Multi-word colors (e.g., "Dark Blue", "Light Gray")
      for (const [colorName, hex] of Object.entries(colorMap)) {
        if (color.includes(colorName)) {
          return { name: colorText, hex };
        }
      }
      
      // If we can't map it, still return the name
      return { name: colorText, hex: null };
    },

    // Helper: Convert RGB to hex
    rgbToHex(rgb) {
      if (!rgb) return null;
      
      const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
      }
      
      return null;
    },

    // Helper: Extract color from description
    extractColorFromDescription() {
      const descSelectors = [
        '.product-description', '.product-title', 'h1', '.product-name'
      ];
      
      const colorWords = [
        'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple',
        'pink', 'brown', 'gray', 'grey', 'navy', 'beige', 'tan', 'maroon',
        'silver', 'gold', 'cream', 'ivory'
      ];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent.toLowerCase();
          
          for (const color of colorWords) {
            if (text.includes(color)) {
              return color;
            }
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Extract material information
    extractMaterial() {
      const materialSelectors = [
        '[data-material]', '[itemprop="material"]', '.material',
        '.fabric', '.composition', '.material-info'
      ];
      
      for (const selector of materialSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let material = el.getAttribute('data-material') || 
                        el.textContent || 
                        el.getAttribute('content');
          
          if (material) {
            return this.validateMaterial(material.trim());
          }
        } catch {}
      }
      
      // Parse from description
      return this.extractMaterialFromDescription();
    },

    // Helper: Validate material
    validateMaterial(materialText) {
      if (!materialText) return null;
      
      const commonMaterials = [
        'cotton', 'polyester', 'wool', 'silk', 'linen', 'denim', 'leather',
        'nylon', 'spandex', 'elastane', 'viscose', 'rayon', 'acrylic',
        'cashmere', 'bamboo', 'hemp', 'modal'
      ];
      
      const text = materialText.toLowerCase();
      
      for (const material of commonMaterials) {
        if (text.includes(material)) {
          return material;
        }
      }
      
      return materialText.length < 50 ? materialText : null;
    },

    // Helper: Extract material from description
    extractMaterialFromDescription() {
      const descSelectors = [
        '.product-description', '.product-details', '.composition',
        '.fabric-content', '.material-info'
      ];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent || '';
          
          // Look for material patterns
          const materialPattern = /(?:made of|material:|fabric:|composition:)\s*([^.;]+)/i;
          const match = text.match(materialPattern);
          
          if (match) {
            return this.validateMaterial(match[1].trim());
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Extract fit information
    extractFit() {
      const fitSelectors = [
        '[data-fit]', '.fit', '.fit-type', '.silhouette'
      ];
      
      for (const selector of fitSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let fit = el.getAttribute('data-fit') || el.textContent;
          if (fit) {
            return this.validateFit(fit.trim());
          }
        } catch {}
      }
      
      return this.extractFitFromDescription();
    },

    // Helper: Validate fit
    validateFit(fitText) {
      if (!fitText) return null;
      
      const commonFits = [
        'regular', 'slim', 'skinny', 'loose', 'relaxed', 'fitted', 'oversized',
        'tailored', 'straight', 'wide', 'cropped', 'bootcut', 'flare'
      ];
      
      const text = fitText.toLowerCase();
      
      for (const fit of commonFits) {
        if (text.includes(fit)) {
          return fit;
        }
      }
      
      return fitText.length < 20 ? fitText : null;
    },

    // Helper: Extract fit from description
    extractFitFromDescription() {
      const descSelectors = ['.product-description', '.product-details', '.fit-guide'];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent.toLowerCase();
          
          const fitPattern = /(?:fit:|style:)\s*([^.;]+)/i;
          const match = text.match(fitPattern);
          
          if (match) {
            return this.validateFit(match[1].trim());
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Extract style/pattern
    extractStyle() {
      const styleSelectors = [
        '[data-style]', '[data-pattern]', '.style', '.pattern'
      ];
      
      for (const selector of styleSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          let style = el.getAttribute('data-style') || 
                     el.getAttribute('data-pattern') || 
                     el.textContent;
          
          if (style) {
            return this.validateStyle(style.trim());
          }
        } catch {}
      }
      
      return this.extractStyleFromDescription();
    },

    // Helper: Validate style/pattern
    validateStyle(styleText) {
      if (!styleText) return null;
      
      const commonStyles = [
        'solid', 'striped', 'plaid', 'checkered', 'floral', 'geometric',
        'polka dot', 'abstract', 'paisley', 'animal print', 'camouflage'
      ];
      
      const text = styleText.toLowerCase();
      
      for (const style of commonStyles) {
        if (text.includes(style)) {
          return style;
        }
      }
      
      return styleText.length < 30 ? styleText : null;
    },

    // Helper: Extract style from description
    extractStyleFromDescription() {
      const descSelectors = ['.product-description', '.product-title'];
      
      for (const selector of descSelectors) {
        try {
          const el = document.querySelector(selector);
          if (!el) continue;
          
          const text = el.textContent.toLowerCase();
          
          const stylePattern = /(?:pattern:|style:|design:)\s*([^.;]+)/i;
          const match = text.match(stylePattern);
          
          if (match) {
            return this.validateStyle(match[1].trim());
          }
        } catch {}
      }
      
      return null;
    },

    // Helper: Enhanced fingerprint quality calculation with clothing attributes
    calculateFingerprintQuality(fp) {
      if (!fp) return 0;
      
      let score = 0;
      const qualityData = {
        identifiers: {},
        attributes: {},
        pricing: {},
        confidence: {},
        warnings: []
      };
      
      // Core identifiers (60% of total score)
      if (fp.gtin) {
        score += 0.35;
        qualityData.identifiers.gtin = { value: fp.gtin, confidence: 'high' };
      } else {
        qualityData.warnings.push('Missing GTIN - primary product identifier');
      }
      
      if (fp.sku) {
        score += 0.15;
        qualityData.identifiers.sku = { value: fp.sku, confidence: 'high' };
      }
      
      if (fp.styleCode) {
        score += 0.1;
        qualityData.identifiers.styleCode = { value: fp.styleCode, confidence: 'medium' };
      }
      
      // Product information (25% of total score)
      if (fp.brand) {
        score += 0.1;
        qualityData.identifiers.brand = { value: fp.brand, confidence: 'high' };
      } else {
        qualityData.warnings.push('Missing brand information');
      }
      
      if (fp.title) {
        score += 0.05;
        qualityData.identifiers.title = { value: fp.title?.substring(0, 50) + '...', confidence: 'medium' };
      }
      
      // Pricing information (10% of total score)
      if (fp.price) {
        if (typeof fp.price === 'object' && fp.price.current) {
          score += 0.08;
          qualityData.pricing = {
            current: fp.price.current,
            currency: fp.price.currency,
            isOnSale: fp.price.isOnSale,
            confidence: fp.price.confidence
          };
          if (fp.price.isOnSale && fp.price.original) {
            score += 0.02;
            qualityData.pricing.original = fp.price.original;
          }
        } else if (typeof fp.price === 'number') {
          score += 0.06;
          qualityData.pricing = { current: fp.price, confidence: 'medium' };
        }
      } else {
        qualityData.warnings.push('No price information detected');
      }
      
      // Variant/clothing attributes (15% of total score)
      if (fp.variant) {
        let variantScore = 0;
        
        if (fp.variant.size) {
          variantScore += 0.06;
          qualityData.attributes.size = {
            value: fp.variant.size.value || fp.variant.size,
            type: fp.variant.size.type,
            confidence: fp.variant.size.confidence
          };
        }
        
        if (fp.variant.color) {
          variantScore += 0.04;
          qualityData.attributes.color = {
            name: fp.variant.color.name || fp.variant.color,
            hex: fp.variant.color.hex,
            confidence: fp.variant.color.confidence
          };
        }
        
        if (fp.variant.material) {
          variantScore += 0.02;
          qualityData.attributes.material = { value: fp.variant.material, confidence: 'medium' };
        }
        
        if (fp.variant.fit) {
          variantScore += 0.02;
          qualityData.attributes.fit = { value: fp.variant.fit, confidence: 'medium' };
        }
        
        if (fp.variant.style) {
          variantScore += 0.01;
          qualityData.attributes.style = { value: fp.variant.style, confidence: 'medium' };
        }
        
        score += Math.min(0.15, variantScore);
      } else {
        qualityData.warnings.push('No variant attributes detected');
      }
      
      // Data quality validation
      const validation = this.validateFingerprintData(fp);
      qualityData.validation = validation;
      
      // Apply validation penalties
      if (validation.hasAmbiguousData) {
        score *= 0.9;
        qualityData.warnings.push('Ambiguous data detected');
      }
      
      if (validation.hasInconsistentData) {
        score *= 0.85;
        qualityData.warnings.push('Inconsistent data detected');
      }
      
      // Store quality breakdown for debugging
      fp._qualityBreakdown = qualityData;
      
      return Math.min(1, score);
    },

    // Helper: Validate fingerprint data quality
    validateFingerprintData(fp) {
      const validation = {
        hasAmbiguousData: false,
        hasInconsistentData: false,
        dataQuality: 'good',
        issues: []
      };
      
      // Check for ambiguous identifiers
      if (fp.sku && fp.styleCode && fp.sku !== fp.styleCode) {
        // This is normal - different identifier types
      }
      
      // Check GTIN validity
      if (fp.gtin) {
        if (!/^[0-9]{8,14}$/.test(fp.gtin)) {
          validation.hasAmbiguousData = true;
          validation.issues.push('Invalid GTIN format');
        }
      }
      
      // Check price consistency
      if (fp.price && typeof fp.price === 'object') {
        if (fp.price.isOnSale && fp.price.original && fp.price.current >= fp.price.original) {
          validation.hasInconsistentData = true;
          validation.issues.push('Sale price is not lower than original price');
        }
        
        if (fp.price.current <= 0) {
          validation.hasAmbiguousData = true;
          validation.issues.push('Invalid price value');
        }
      }
      
      // Check title-brand consistency
      if (fp.brand && fp.title) {
        const titleLower = fp.title.toLowerCase();
        const brandLower = fp.brand.toLowerCase();
        if (!titleLower.includes(brandLower) && brandLower.length > 2) {
          validation.issues.push('Brand not mentioned in title (may be normal)');
        }
      }
      
      // Check size validity
      if (fp.variant && fp.variant.size) {
        const size = fp.variant.size;
        if (size.confidence < 0.7) {
          validation.hasAmbiguousData = true;
          validation.issues.push('Low confidence size detection');
        }
      }
      
      // Determine overall data quality
      if (validation.issues.length === 0) {
        validation.dataQuality = 'excellent';
      } else if (validation.issues.length <= 2 && !validation.hasInconsistentData) {
        validation.dataQuality = 'good';
      } else if (validation.issues.length <= 4) {
        validation.dataQuality = 'fair';
      } else {
        validation.dataQuality = 'poor';
      }
      
      return validation;
    },

    async run() {
      try {
        if (this.config.forceMock) {
          this.render(this.config.mockData || { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 });
          return;
        }
        // Abort any in-flight request
        if (this.state.inFlightAbort) {
          try { this.state.inFlightAbort.abort(); } catch {}
          this.state.inFlightAbort = null;
        }
        const ac = new AbortController();
        this.state.inFlightAbort = ac;
        if (this.state.inFlightTimer) clearTimeout(this.state.inFlightTimer);
        this.state.inFlightTimer = setTimeout(() => { try { ac.abort(); } catch {} }, this.config.requestTimeoutMs || 6000);
        const payload = { tenant: this.config.tenant, zip: this.config.zip, url: location.href, fingerprint: this.fingerprint() };
        if (this.config.debug) { try { console.log('[JenniEdge] resolve payload', payload); } catch {} }
        const base = this.config.apiBase || '';
        const res = await fetch(`${base}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal });
        const data = await res.json();
        if (this.config.debug) { try { console.log('[JenniEdge] resolve result', data); } catch {} }
        this.render(data);
      } catch (e) {
        const aborted = (e && (e.name === 'AbortError' || /abort/i.test(e.message||'')));
        if (aborted) {
          this.render({ eligible: false, loading: true, message: 'Still checking nearby availability…' });
          return;
        }
        if (this.config.forceMock) {
          this.render(this.config.mockData || { eligible: true, etaMinutes: 110, node_count: 3, matching_score: 0.9 });
          return;
        }
        this.render({ eligible: false, error: e?.message || 'Resolve failed' });
      } finally {
        this.state.inFlightAbort = null;
        if (this.state.inFlightTimer) { clearTimeout(this.state.inFlightTimer); this.state.inFlightTimer = null; }
      }
    },

  installWatchers() {
      if (!this.config.autoRefresh) return;
    // Navigation changes (SPA & history)
      this.state.lastHref = location.href;
      const onNav = () => {
        if (location.href !== this.state.lastHref) {
          this.state.lastHref = location.href;
      if (this.config.debug) { try { console.log('[JenniEdge] nav detected -> refresh'); } catch {} }
      this.scheduleRefresh(true);
      // Force signature reset so next mutation/poll triggers
      this.state.lastSig = '';
        }
      };
      const wrap = (fn) => function() { const r = fn.apply(this, arguments); try { window.dispatchEvent(new Event('jenni:nav')); } catch {} return r; };
      try {
        history.pushState = wrap(history.pushState);
        history.replaceState = wrap(history.replaceState);
      } catch {}
      window.addEventListener('popstate', onNav);
      window.addEventListener('hashchange', onNav);
      window.addEventListener('jenni:nav', onNav);

      // Helper to compute stable product signature
      const computeSig = () => {
        const fp = this.fingerprint();
        return [fp.productId, fp.gtin, fp.sku, fp.styleCode, fp.title, fp.brand].filter(Boolean).join('|');
      };

      const debouncedCheck = (reason='mutation') => {
        if (this.state.sigDebounceTimer) clearTimeout(this.state.sigDebounceTimer);
        this.state.sigDebounceTimer = setTimeout(() => {
          const sig = computeSig();
          if (sig && sig !== this.state.lastSig) {
            if (this.config.debug) { try { console.log('[JenniEdge] product change via', reason, '->', sig); } catch {} }
            this.state.lastSig = sig;
            this.scheduleRefresh();
          }
        }, 350); // allow DOM to settle
      };

      // DOM mutation observer to catch variant changes / PDP swaps
      const mo = new MutationObserver((mutations) => {
        // Ignore pure attribute changes on non-product nodes by limiting frequency
        debouncedCheck('mutation');
      });
      try {
        mo.observe(document.documentElement || document.body, { subtree: true, childList: true, characterData: false, attributes: false });
      } catch {}
      this.state.mo = mo;

      // Periodic polling as fallback (covers frameworks that batch DOM replacement silently)
      const startPolling = () => {
        if (this.state.pollTimer) clearInterval(this.state.pollTimer);
        this.state.pollTimer = setInterval(() => {
          const sig = computeSig();
          if (sig && sig !== this.state.lastSig) {
            if (this.config.debug) { try { console.log('[JenniEdge] product change via poll ->', sig); } catch {} }
            this.state.lastSig = sig;
            this.scheduleRefresh();
          }
        }, 1500);
      };
      startPolling();

      // Initialize first signature
      try { this.state.lastSig = computeSig(); } catch {}
    },

    scheduleRefresh(isNav=false) {
      if (!this.config.autoRefresh) return;
      if (this.state.refreshTimer) clearTimeout(this.state.refreshTimer);
      if (this.state.panelOpen && this.state.panelEl) {
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = '<div class="jenni-edge-node loading">Updating availability…</div>';
      }
      this.state.refreshTimer = setTimeout(() => { this.run(); }, isNav ? 200 : 500);
    },

    injectStyles() {
      const css = `
  .jenni-edge-pill{position:fixed;right:16px;bottom:20px;display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;background:linear-gradient(135deg,#16a34a,#10b981);color:#fff;box-shadow:0 10px 30px rgba(16,185,129,.35);cursor:pointer;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;pointer-events:auto !important;-webkit-user-select:none;user-select:none;outline:none;touch-action:manipulation;isolation:isolate}
        .jenni-edge-pill.neg{background:linear-gradient(135deg,#6b7280,#4b5563);box-shadow:0 10px 30px rgba(75,85,99,.35)}
        .jenni-edge-pill.pick{background:linear-gradient(135deg,#2563eb,#3b82f6);box-shadow:0 10px 30px rgba(59,130,246,.35)}
        .jenni-edge-ic{display:inline-flex;width:18px;height:18px}
        .jenni-edge-pill .txt{font-size:14px;font-weight:600;letter-spacing:.2px}
        .jenni-edge-pill .sub{font-size:12px;opacity:.9}
        .jenni-edge-panel{position:fixed;right:16px;bottom:72px;width:360px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.22);overflow:hidden;z-index:2147483647;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;border:1px solid #eef2f7}
        .jenni-edge-hd{display:flex;align-items:center;gap:8px;padding:14px 14px 10px;border-bottom:1px solid #f1f5f9}
        .jenni-edge-title{font-weight:700;color:#0f172a}
        .jenni-edge-eta{margin-left:auto;font-size:12px;color:#64748b}
        .jenni-edge-body{padding:12px;max-height:48vh;overflow:auto}
        .jenni-edge-node{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;border:1px solid #eef2f7;margin-bottom:8px}
        .jenni-edge-node .name{font-weight:600;color:#111827}
        .jenni-edge-node .meta{font-size:12px;color:#64748b}
        .jenni-edge-cta{display:block;width:calc(100% - 24px);margin:8px 12px 12px;background:#111827;color:#fff;border:none;border-radius:10px;padding:10px 12px;font-size:14px;cursor:pointer}
        .jenni-edge-foot{padding:0 12px 12px;font-size:11px;color:#64748b}
        .jenni-edge-close{margin-left:auto;background:transparent;border:none;color:#64748b;cursor:pointer}
        .jenni-edge-formula{margin:6px 0 10px;font-size:12px;color:#64748b}
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    },

    render(data) {
      this.state.data = data;
      // Remove existing pill(s) but keep panel if configured
      document.querySelectorAll('.jenni-edge-pill').forEach(n=>n.remove());
      if (!(this.config.keepOpenOnRefresh && this.state.panelOpen && this.state.panelEl && document.body.contains(this.state.panelEl))) {
        // Remove orphaned panels only if not maintaining
        document.querySelectorAll('.jenni-edge-panel').forEach(n=>{ if (n !== this.state.panelEl) n.remove(); });
        if (!this.config.keepOpenOnRefresh) {
          document.querySelectorAll('.jenni-edge-panel').forEach(n=>n.remove());
          this.state.panelOpen = false; this.state.panelEl = null;
        }
      }
      const ok = !!data?.eligible;
      const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');
      const preview = !!this.config.forceMock || !!data?.preview;
      const pill = document.createElement('div');
      pill.className = 'jenni-edge-pill' + (cta === 'fallback' ? ' neg' : (cta === 'pickup_today' ? ' pick' : ''));
      pill.setAttribute('role','button');
      pill.setAttribute('tabindex','0');
      // Apply configured position
      this.applyPillPosition(pill);
      const pg = data?.profitGuard || null;
      const titleTxt = cta === 'arrives_today' ? 'Arrives Today' : (cta === 'pickup_today' ? 'Pickup Today' : 'Fast shipping available');
      const subParts = [];
      const eta = this.etaText(data);
      if (eta) subParts.push(eta);
      pill.innerHTML = `
        <span class="jenni-edge-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M3 13h13l3 5H6l-3-5Z"/><path d="M16 13V7H3v6"/></svg>
        </span>
        <div>
          <div class="txt">${titleTxt}</div>
          <div class="sub">${subParts.join(' • ')}</div>
        </div>
      `;
      // Robust event handlers to beat site interceptors
  const open = (e) => { try { e.preventDefault(); e.stopPropagation(); } catch(_){} this.openPanel(); };
      pill.addEventListener('click', open, true);        // capture phase
  pill.addEventListener('mousedown', open, true);
      pill.addEventListener('pointerdown', open, true);
      pill.addEventListener('touchstart', open, { capture: true, passive: false });
      pill.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openPanel(); }};
      document.body.appendChild(pill);

      // Auto-open support OR maintain open panel content
      if (this.state.panelOpen && this.config.keepOpenOnRefresh && this.state.panelEl) {
        try { this.updatePanelContent(this.state.panelEl, data); } catch {}
      } else if (this.config.autoOpenPanel && !this.state.openedOnce) {
        this.state.openedOnce = true;
        setTimeout(()=>this.openPanel(), 10);
      }

      // Click the pill to open the detail panel

    },

    applyPillPosition(el){
      const pos = String(this.config.position || 'bottom-right');
      const x = (this.config.offsetX ?? 16) + 'px';
      const y = (this.config.offsetY ?? 20) + 'px';
      el.style.position = 'fixed';
      el.style.left = 'auto'; el.style.right = 'auto'; el.style.top = 'auto'; el.style.bottom = 'auto';
      if (pos === 'bottom-left') { el.style.left = x; el.style.bottom = y; }
      else if (pos === 'top-right') { el.style.right = x; el.style.top = y; }
      else if (pos === 'top-left') { el.style.left = x; el.style.top = y; }
      else { el.style.right = x; el.style.bottom = y; } // bottom-right default
    },

    etaText(data){
      if (!data?.etaMinutes || !Number.isFinite(data.etaMinutes)) return '';
      const mins = Math.round(data.etaMinutes);
      const now = new Date();
      const eta = new Date(now.getTime() + mins*60000);
      const sameDay = now.toDateString() === eta.toDateString();
      const opts = { hour: 'numeric', minute: '2-digit' };
      const when = eta.toLocaleTimeString([], opts);
      return sameDay ? `by ${when}` : `by ${when} tomorrow`;
    },

  async openPanel(){
      if (this.state.panelOpen) return;
      // Guard against site errors: reset flag on failure
      this.state.panelOpen = true;
      const data = this.state.data || {};
      const ok = !!data.eligible;
      const cta = (data && data.decision && data.decision.cta) || (ok ? 'arrives_today' : 'fallback');
      let panel;
      try {
        panel = document.createElement('div');
        panel.className = 'jenni-edge-panel';
        panel.setAttribute('role','dialog');
      // Position panel near the pill based on config
      const pos = String(this.config.position || 'bottom-right');
      const x = (this.config.offsetX ?? 16) + 'px';
      const y = (this.config.offsetY ?? 20) + 'px';
      panel.style.position = 'fixed';
      panel.style.left = 'auto'; panel.style.right = 'auto'; panel.style.top = 'auto'; panel.style.bottom = 'auto';
      if (pos === 'bottom-left') { panel.style.left = x; panel.style.bottom = (parseInt(y)+52)+'px'; }
      else if (pos === 'top-right') { panel.style.right = x; panel.style.top = (parseInt(y)+52)+'px'; }
      else if (pos === 'top-left') { panel.style.left = x; panel.style.top = (parseInt(y)+52)+'px'; }
      else { panel.style.right = x; panel.style.bottom = (parseInt(y)+52)+'px'; }
      const pg = data && data.profitGuard ? data.profitGuard : null;
      const profitTitle = pg ? `Margin $${Math.round(pg.margin||0)} vs target $${Math.round(pg.floor||0)}` : '';
      const panelTitle = cta === 'arrives_today' ? 'Local delivery' : (cta === 'pickup_today' ? 'Pickup options' : 'Fast delivery options');
      const ctaText = cta === 'arrives_today' ? 'Deliver with JENNi' : (cta === 'pickup_today' ? 'Pick up today' : 'See delivery options');
      panel.innerHTML = `
        <div class="jenni-edge-hd">
          <div class="jenni-edge-title">${panelTitle}</div>
          <div class="jenni-edge-eta">${this.etaText(data)}</div>
          <button class="jenni-edge-close" aria-label="Close">✕</button>
        </div>
        <div class="jenni-edge-body">
        <div class="jenni-edge-node loading">Finding nearby stores…</div>
        </div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
            <input aria-label="ZIP code" class="zip-input" placeholder="ZIP" value="${this.config.zip}" style="flex:0 0 90px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px"/>
            <button class="zip-apply" style="padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer">Update</button>
            <button class="fingerprint-toggle" style="padding:4px 8px;border-radius:6px;border:1px solid #e5e7eb;background:#f8fafc;cursor:pointer;font-size:11px;margin-left:auto">🔍</button>
          </div>
          <div class="jenni-edge-fingerprint" style="display:none;margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb"></div>
          <div class="jenni-edge-formula"></div>


        <button class="jenni-edge-cta">${ctaText}</button>
        <div class="jenni-edge-foot">ZIP ${this.config.zip}</div>
      `;
  panel.querySelector('.jenni-edge-close').onclick = () => { panel.remove(); this.state.panelOpen = false; this.state.panelEl = null; };
      panel.querySelector('.jenni-edge-cta').onclick = () => {
        const base = (this.config.apiBase || '');
        fetch(`${base}/test-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: location.href, zip: this.config.zip, tenant: this.config.tenant }) })
          .then(r=>r.json()).then(j=>alert(`Test order created: ${j.orderId || 'OK'}`)).catch(()=>alert('Test order simulated.'));
      };
      const zipInput = panel.querySelector('.zip-input');
      const applyZip = () => {
        const z = zipInput.value.replace(/[^0-9]/g,'').slice(0,10);
        if (z && z !== this.config.zip) { this.setZip(z, { reopen: true }); }
      };
      panel.querySelector('.zip-apply').onclick = applyZip;
      zipInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ e.preventDefault(); applyZip(); }});
      
      // Fingerprint toggle functionality
      const fingerprintToggle = panel.querySelector('.fingerprint-toggle');
      const fingerprintEl = panel.querySelector('.jenni-edge-fingerprint');
      let fingerprintVisible = false;
      
      fingerprintToggle.onclick = () => {
        fingerprintVisible = !fingerprintVisible;
        fingerprintEl.style.display = fingerprintVisible ? 'block' : 'none';
        fingerprintToggle.textContent = fingerprintVisible ? '🔍✓' : '🔍';
        
        if (fingerprintVisible) {
          this.renderFingerprint(fingerprintEl);
        }
      };
      
  document.body.appendChild(panel);
  this.state.panelEl = panel;
      // Populate formula and nodes: prefer nodes from resolve payload, else fetch
      try {
        let nodes = Array.isArray((this.state.data||{}).nodes) ? (this.state.data||{}).nodes : null;
        if (!nodes || !nodes.length) {
          nodes = await this.fetchNodes();
        }
        this.state.nodes = nodes || [];
        // Update formula using current ProfitGuard economics
        try {
          const pgNow = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
          const formulaEl = panel.querySelector('.jenni-edge-formula');
          if (formulaEl && pgNow) {
            const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
            formulaEl.textContent = `PDP $${r(pgNow.price)} → Buy $${r(pgNow.buy_cost||pgNow.landed_cost)} + Courier $${r(pgNow.courier_est)} + Fee $${r(pgNow.fee)} = Profit $${r(pgNow.margin)}`;
          }
        } catch {}
        this.renderNodes(panel.querySelector('.jenni-edge-body'), this.state.nodes);
      } catch {
        this.renderNodes(panel.querySelector('.jenni-edge-body'), []);
      }
      } catch(err){
        try { console.error('[JenniEdge] openPanel failed', err); } catch {}
        this.state.panelOpen = false; this.state.panelEl = null;
        try { alert('Jenni panel failed to open on this site. Try the preview overlay.'); } catch {}
        return;
      }
    },

    async fetchNodes(){
      // If no API base or forceMock, synthesize nodes
      if (!this.config.apiBase || this.config.forceMock){
        const base = [
          { id: 'demo_1', name: 'Downtown', etaMinutes: 90, distanceMiles: 3.2, stock: 7 },
          { id: 'demo_2', name: 'Uptown', etaMinutes: 120, distanceMiles: 5.1, stock: 4 },
        ];
        return base;
      }
      const fp = this.fingerprint();
      const q = encodeURIComponent((fp.styleCode || fp.sku || fp.title || 'sneakers').toString());
      const brand = encodeURIComponent((fp.brand || '').toString());
      const sc = encodeURIComponent((fp.styleCode || '').toString());
      const probe = this.config.accuracyProbe ? '&probe=1' : '';
      const r = await fetch(`${this.config.apiBase}/places?zip=${encodeURIComponent(this.config.zip)}&q=${q}&brand=${brand}&sc=${sc}${probe}`);
      const j = await r.json();
      return j?.nodes || [];
    },

  renderNodes(container, nodes){
      container.innerHTML = '';
      if (!nodes || !nodes.length){
        const empty = document.createElement('div');
        empty.className = 'jenni-edge-node';
    const reason = (this.state.data && (this.state.data.availability?.reason || this.state.data.decision?.reason)) || 'not_available';
    empty.textContent = reason === 'no_nearby_stores' ? 'No nearby stores found.' : 'No local availability — showing fastest shipping.';
        container.appendChild(empty);
        return;
      }
      const pg = (this.state.data && this.state.data.profitGuard) ? this.state.data.profitGuard : null;
      nodes.slice(0,3).forEach(n => {
        const row = document.createElement('div');
        row.className = 'jenni-edge-node';
        const pass = n.pgPass ? '<span style="margin-left:6px;font-size:11px;color:#155e75;background:#e0f2fe;border:1px solid #bae6fd;border-radius:6px;padding:2px 6px">Pass</span>' : '<span style="margin-left:6px;font-size:11px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 6px">Hold</span>';
        const linkHref = (n.productUrl && /^https?:/i.test(n.productUrl))
          ? n.productUrl
          : ((n.website && /^https?:/i.test(n.website)) ? n.website : `https://www.google.com/search?q=${encodeURIComponent(n.name+' '+(this.state.data?.product?.styleCode||'product'))}`);
        const nameHtml = `<a href="${linkHref}" target="_blank" rel="noopener" style="color:#0f766e;text-decoration:none">${n.name}</a>`;
        row.innerHTML = `
          <div class="name">${nameHtml}${pass}</div>
          <div class="meta">${Math.round(n.distanceMiles)} mi • ~${Math.round(n.etaMinutes)}m</div>
          <div class="meta">Profit $${Math.round(n.margin||0)}</div>
        `;
        container.appendChild(row);
      });

      // Omit accuracy boost in simplified demo UI
    },

    updatePanelContent(panel, data){
      if (!panel) return;
      try {
        const body = panel.querySelector('.jenni-edge-body');
        if (body) {
          // Re-render nodes if we have them
          if (Array.isArray(data?.nodes)) {
            this.renderNodes(body, data.nodes);
          }
        }
        const etaEl = panel.querySelector('.jenni-edge-eta');
        if (etaEl) etaEl.textContent = this.etaText(data);
        const foot = panel.querySelector('.jenni-edge-foot');
        if (foot) foot.textContent = `ZIP ${this.config.zip}`;
        const formulaEl = panel.querySelector('.jenni-edge-formula');
        if (formulaEl && data?.profitGuard) {
          const pg = data.profitGuard;
          const r = (n)=> Number.isFinite(n)?Math.round(n):'-';
          formulaEl.textContent = `PDP $${r(pg.price)} → Buy $${r(pg.buy_cost||pg.landed_cost)} + Courier $${r(pg.courier_est)} + Fee $${r(pg.fee)} = Profit $${r(pg.margin)}`;
        }
        
        // Update fingerprint if visible
        const fingerprintEl = panel.querySelector('.jenni-edge-fingerprint');
        if (fingerprintEl && fingerprintEl.style.display !== 'none') {
          this.renderFingerprint(fingerprintEl);
        }
      } catch {}
    },

    renderFingerprint(container) {
      if (!container) return;
      
      const fp = this.fingerprint();
      const quality = this.calculateFingerprintQuality(fp);
      
      // Quality indicator
      const qualityColor = quality >= 0.8 ? '#16a34a' : (quality >= 0.5 ? '#ca8a04' : '#dc2626');
      const qualityText = quality >= 0.8 ? 'Excellent' : (quality >= 0.5 ? 'Good' : 'Poor');
      
      const formatValue = (val, label) => {
        if (!val) return `<span style="color:#9ca3af">${label}: None</span>`;
        const truncated = String(val).length > 30 ? String(val).substring(0, 30) + '...' : val;
        return `<span style="color:#374151">${label}: <strong>${truncated}</strong></span>`;
      };
      
      const formatVariant = (variant) => {
        if (!variant) return '<span style="color:#9ca3af">Variant: None</span>';
        const parts = [];
        if (variant.size) parts.push(`Size: ${variant.size}`);
        if (variant.color) parts.push(`Color: ${variant.color}`);
        return `<span style="color:#374151">Variant: <strong>${parts.join(', ')}</strong></span>`;
      };
      
      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-weight:600;font-size:12px">Fingerprint Quality</div>
          <div style="background:${qualityColor};color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${Math.round(quality * 100)}%</div>
          <div style="font-size:11px;color:#6b7280">${qualityText}</div>
        </div>
        <div style="display:grid;gap:3px;font-size:11px;line-height:1.3">
          ${formatValue(fp.gtin, 'GTIN')}
          ${formatValue(fp.sku, 'SKU')}
          ${formatValue(fp.styleCode, 'Style')}
          ${formatValue(fp.brand, 'Brand')}
          ${formatValue(fp.price ? '$' + fp.price.toFixed(2) : null, 'Price')}
          ${formatVariant(fp.variant)}
        </div>
        <div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280">
          Updated: ${new Date(fp.timestamp).toLocaleTimeString()}
        </div>
        ${this.config.debug ? `<details style="margin-top:6px;font-size:10px">
          <summary style="cursor:pointer;color:#6b7280">Debug Info</summary>
          <pre style="margin:4px 0;padding:4px;background:#f3f4f6;border-radius:4px;overflow:auto;max-height:100px;font-size:9px">${JSON.stringify(fp, null, 2)}</pre>
        </details>` : ''}
      `;
    },

    setZip(newZip, opts={}) {
      const z = (newZip||'').replace(/[^0-9]/g,'').slice(0,10);
      if (!z) return;
      if (z === this.config.zip && !opts.force) return;
      this.config.zip = z;
      if (this.config.debug) { try { console.log('[JenniEdge] ZIP updated ->', z); } catch {} }
      if (this.state.panelOpen && this.state.panelEl) {
        const input = this.state.panelEl.querySelector('.zip-input');
        if (input) input.value = z;
        const body = this.state.panelEl.querySelector('.jenni-edge-body');
        if (body) body.innerHTML = '<div class="jenni-edge-node loading">Refreshing for ZIP '+z+'…</div>';
      }
      this.run();
    }
  };

  window.JenniEdge = JenniEdge;
})();
