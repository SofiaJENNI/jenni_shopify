## Enhanced Fingerprinting

The overlay now features comprehensive product detection:

- **GTIN/UPC/EAN extraction** from multiple DOM sources and JSON-LD
- **SKU and style code detection** with validation and platform-specific selectors
- **Brand extraction** from metadata, microdata, and title patterns
- **Price and variant detection** for selected options (size, color) - now handled server-side
- **Server-side fingerprinting** with enhanced product data extraction:
  - GTIN, SKU, brand, title extraction from HTML
  - Size and color variant detection
  - JSON-LD structured data parsing