## Enhanced Fingerprinting

The overlay now features comprehensive product detection:

- **GTIN/UPC/EAN extraction** from multiple DOM sources and JSON-LD
- **SKU and style code detection** with validation and platform-specific selectors
- **Brand extraction** from metadata, microdata, and title patterns
- **Price and variant detection** for selected options (size, color)
- **Visual quality checker** - click the 🔍 button in the panel to see:
  - Real-time fingerprint quality scoring (0-100%)
  - Detailed breakdown of extracted product identifiers
  - Debug mode with full JSON when `debug: true`