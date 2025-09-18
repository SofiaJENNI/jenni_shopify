/**
 * Retailer Navigation Component
 * Provides clickable links to major retailers with product search functionality
 */
class RetailerNavigation {
  constructor(config = {}) {
    this.config = {
      trackClicks: true,
      maxRetailers: 5,
      ...config
    };

    // Retailer configuration with search URLs and priorities
    // Best Buy ALWAYS has priority 0 (highest priority)
    this.RETAILERS = [
      {
        name: 'Best Buy',
        searchUrl: 'https://www.bestbuy.com/site/searchpage.jsp?&st=',
        priority: 0,
        category: 'electronics'
      },
      {
        name: 'Target', 
        searchUrl: 'https://www.target.com/s?searchTerm=',
        priority: 2,
        category: 'general'
      },
      {
        name: 'Walmart',
        searchUrl: 'https://www.walmart.com/search?q=',
        priority: 3,
        category: 'general'
      },
      {
        name: 'Costco',
        searchUrl: 'https://www.costco.com/CatalogSearch?keyword=',
        priority: 4,
        category: 'warehouse'
      },
      {
        name: 'Micro Center',
        searchUrl: 'https://www.microcenter.com/search/search_results.aspx?Ntk=all&sortby=match&N=&myStore=false&Ntt=',
        priority: 5,
        category: 'electronics'
      },
      {
        name: 'Apple Store',
        searchUrl: 'https://www.apple.com/search/',
        priority: 6,
        category: 'apple',
        queryParam: '?src=serp&f=product&q='
      },
      {
        name: 'Amazon',
        searchUrl: 'https://www.amazon.com/s?k=',
        priority: 7,
        category: 'general'
      }
    ];
  }

  /**
   * Clean and encode product title for URL
   * If title contains Amazon, remove it and ignore brand
   */
  processProductTitle(title, brand = '') {
    if (!title) return '';

    let cleanTitle = title;
    let shouldIgnoreBrand = false;

    // Check if title contains Amazon (case insensitive)
    if (cleanTitle.toLowerCase().includes('amazon')) {
      shouldIgnoreBrand = true;
    }

    // Remove text after last colon FIRST (Amazon-style titles)
    const lastColonIndex = cleanTitle.lastIndexOf(':');
    if (lastColonIndex !== -1) {
      cleanTitle = cleanTitle.substring(0, lastColonIndex).trim();
    }

    // THEN remove Amazon.com and any Amazon references
    if (shouldIgnoreBrand) {
      cleanTitle = cleanTitle.replace(/amazon\.com/gi, '').replace(/amazon/gi, '').trim();
      
      // Also remove the brand from the title if it appears at the beginning
      if (brand && cleanTitle.toLowerCase().startsWith(brand.toLowerCase())) {
        cleanTitle = cleanTitle.substring(brand.length).trim();
      }
    }

    // If we should ignore brand due to Amazon, don't include it
    // Otherwise, combine brand and title if brand is separate
    if (!shouldIgnoreBrand && brand && !cleanTitle.toLowerCase().includes(brand.toLowerCase())) {
      cleanTitle = `${brand} ${cleanTitle}`;
    }

    // Clean and encode for URL
    return encodeURIComponent(
      cleanTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
        .replace(/\s+/g, ' ')     // Normalize spaces
        .trim()
    ).replace(/%20/g, '+'); // Use + for spaces in URLs
  }

  /**
   * Generate retailer search URL with product title
   */
  generateRetailerURL(retailer, productTitle, brand = '') {
    const cleanTitle = this.processProductTitle(productTitle, brand);
    
    // Handle special cases
    if (retailer.name === 'Apple Store' && retailer.queryParam) {
      return `${retailer.searchUrl}${retailer.queryParam}${cleanTitle}`;
    }
    
    return `${retailer.searchUrl}${cleanTitle}`;
  }

  /**
   * Get prioritized retailers based on product brand/category
   */
  getPrioritizedRetailers(productData = {}) {
    const { brand = '', title = '', category = '' } = productData;
    const brandLower = brand.toLowerCase();
    
    let retailers = [...this.RETAILERS];

    // Boost specific retailers for certain brands
    retailers = retailers.map(retailer => {
      let priorityBoost = 0;

      // BEST BUY ALWAYS FIRST - Force priority -100 to ensure it's always #1
      if (retailer.name === 'Best Buy') {
        priorityBoost = -100;
      }
      // Apple products -> prioritize Apple Store (but Best Buy still first)
      else if (brandLower.includes('apple') && retailer.name === 'Apple Store') {
        priorityBoost = -10;
      }
      // Sony products -> boost electronics stores (but Best Buy still first)
      else if (brandLower.includes('sony') && retailer.category === 'electronics') {
        priorityBoost = -3;
      }
      // Samsung products -> boost electronics stores (but Best Buy still first)
      else if (brandLower.includes('samsung') && retailer.category === 'electronics') {
        priorityBoost = -2;
      }
      // Microsoft products -> boost electronics stores (but Best Buy still first)
      else if (brandLower.includes('microsoft') && retailer.category === 'electronics') {
        priorityBoost = -2;
      }

      return {
        ...retailer,
        effectivePriority: retailer.priority + priorityBoost
      };
    });

    // Sort by effective priority (Best Buy will always be first with -100 boost)
    return retailers
      .sort((a, b) => a.effectivePriority - b.effectivePriority)
      .slice(0, this.config.maxRetailers);
  }

  /**
   * Render retailer links HTML
   */
  renderRetailerLinks(productData = {}) {
    const { title = '', brand = '' } = productData;
    
    if (!title && !brand) {
      return '<div class="jenni-retailer-section" style="display:none;"></div>';
    }

    const retailers = this.getPrioritizedRetailers(productData);
    
    const retailerLinksHTML = retailers.map((retailer, index) => {
      const url = this.generateRetailerURL(retailer, title, brand);
      const isTopTier = index < 2; // First 2 retailers get emphasis
      const isPrimary = index === 0; // First retailer gets most emphasis
      
      return `
        <a href="${url}" 
           target="_blank" 
           rel="noopener noreferrer"
           class="jenni-retailer-link ${isPrimary ? 'primary-retailer' : (isTopTier ? 'secondary-retailer' : 'tertiary-retailer')}"
           onclick="window.JenniEdge?.trackRetailerClick?.('${retailer.name}', '${title}')"
           title="Search for '${title}' at ${retailer.name}">
          ${retailer.name}
        </a>
      `;
    }).join('');

    return `
      <div class="jenni-retailer-section">
        <div class="jenni-retailer-header">
          <span class="jenni-retailer-title">🔍 Find at retailers</span>
        </div>
        <div class="jenni-retailer-links">
          ${retailerLinksHTML}
        </div>
      </div>
    `;
  }

  /**
   * Get CSS styles for retailer links
   */
  getStyles() {
    return `
      .jenni-retailer-section {
        border-bottom: 1px solid #f3f4f6;
        padding: 12px;
        background: #fafafa;
      }
      
      .jenni-retailer-header {
        margin-bottom: 8px;
      }
      
      .jenni-retailer-title {
        font-size: 12px;
        font-weight: 600;
        color: #374151;
      }
      
      .jenni-retailer-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      
      .jenni-retailer-link {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.15s ease;
        border: 1px solid transparent;
      }
      
      .jenni-retailer-link:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }
      
      /* Primary retailer (Best Buy, Apple Store, etc.) */
      .primary-retailer {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        color: white;
        font-weight: 600;
        font-size: 12px;
        padding: 6px 12px;
      }
      
      .primary-retailer:hover {
        background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      }
      
      /* Secondary retailer (Target, etc.) */
      .secondary-retailer {
        background: #0f766e;
        color: white;
        font-weight: 500;
        padding: 5px 10px;
      }
      
      .secondary-retailer:hover {
        background: #0d9488;
      }
      
      /* Tertiary retailers */
      .tertiary-retailer {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      
      .tertiary-retailer:hover {
        background: #e5e7eb;
        border-color: #9ca3af;
      }
      
      /* Mobile responsive */
      @media (max-width: 480px) {
        .jenni-retailer-links {
          flex-direction: column;
        }
        
        .jenni-retailer-link {
          text-align: center;
          padding: 8px 12px;
        }
      }
    `;
  }

  /**
   * Track retailer click for analytics
   */
  trackRetailerClick(retailerName, productTitle) {
    if (!this.config.trackClicks) return;

    try {
      // Send to analytics if available
      if (typeof gtag !== 'undefined') {
        gtag('event', 'retailer_click', {
          retailer_name: retailerName,
          product_title: productTitle,
          event_category: 'jenni_navigation'
        });
      }

      // Console log for debugging
      console.debug('[RetailerNavigation] Retailer clicked:', {
        retailer: retailerName,
        product: productTitle,
        timestamp: new Date().toISOString()
      });

      // Custom callback if provided
      if (this.config.onRetailerClick) {
        this.config.onRetailerClick(retailerName, productTitle);
      }

    } catch (error) {
      console.error('[RetailerNavigation] Tracking error:', error);
    }
  }

  /**
   * Update retailer configuration
   */
  updateRetailers(newRetailers) {
    this.RETAILERS = [...newRetailers];
    return this;
  }

  /**
   * Add custom retailer
   */
  addRetailer(retailer) {
    this.RETAILERS.push({
      priority: this.RETAILERS.length + 1,
      category: 'custom',
      ...retailer
    });
    return this;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RetailerNavigation;
}
