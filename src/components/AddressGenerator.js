/**
 * Address Generation Utilities
 * Generates realistic addresses for stores and users based on ZIP codes
 */

class AddressGenerator {
  constructor() {
    this.streetNumbers = ['123', '456', '789', '1001', '2500', '3300', '4455', '5678'];
    this.storeStreetNames = [
      'Main Street', 'Oak Avenue', 'First Street', 'Second Avenue', 'Park Boulevard',
      'Washington Street', 'Lincoln Avenue', 'Madison Street', 'Jefferson Avenue',
      'Market Street', 'Broadway', 'Center Street', 'Church Street', 'Elm Street'
    ];
    this.userStreetNames = [
      'Maple Street', 'Cedar Avenue', 'Pine Street', 'Birch Avenue', 'Willow Drive',
      'Sunset Boulevard', 'Highland Avenue', 'Valley Street', 'Ridge Road', 'Grove Street'
    ];
    this.cityVariations = {
      downtown: 'Downtown',
      uptown: 'Uptown',
      west: 'West Side',
      east: 'East Side',
      north: 'North Side',
      south: 'South Side'
    };
  }

  /**
   * Generate a realistic store address based on store info
   * @param {Object} store - Store object with name and other details
   * @param {string} zipCode - ZIP code for the address
   * @returns {Object} - Address object with street, city, state, zip
   */
  generateStoreAddress(store, zipCode = '60612') {
    const streetNumber = this.getRandomElement(this.streetNumbers);
    const streetName = this.getRandomElement(this.storeStreetNames);
    const cityName = this.getCityFromStoreName(store.name);
    
    return {
      street: `${streetNumber} ${streetName}`,
      city: cityName,
      state: this.getStateFromZip(zipCode),
      zip: zipCode,
      full: `${streetNumber} ${streetName}, ${cityName}, ${this.getStateFromZip(zipCode)} ${zipCode}`
    };
  }

  /**
   * Generate a realistic user address
   * @param {string} zipCode - ZIP code for the address
   * @returns {string} - Street address string
   */
  generateUserAddress(zipCode = '60612') {
    const streetNumber = this.getRandomElement(this.streetNumbers);
    const streetName = this.getRandomElement(this.userStreetNames);
    
    return `${streetNumber} ${streetName}`;
  }

  /**
   * Generate a full user address object
   * @param {string} zipCode - ZIP code for the address
   * @returns {Object} - Complete address object
   */
  generateFullUserAddress(zipCode = '60612') {
    const streetAddress = this.generateUserAddress(zipCode);
    const city = this.getDefaultCity(zipCode);
    const state = this.getStateFromZip(zipCode);
    
    return {
      street: streetAddress,
      city: city,
      state: state,
      zip: zipCode,
      full: `${streetAddress}, ${city}, ${state} ${zipCode}`
    };
  }

  /**
   * Extract city name from store name or return default
   * @private
   */
  getCityFromStoreName(storeName) {
    const name = storeName.toLowerCase();
    
    for (const [key, city] of Object.entries(this.cityVariations)) {
      if (name.includes(key)) {
        return city;
      }
    }
    
    return 'Downtown'; // Default fallback
  }

  /**
   * Get state abbreviation from ZIP code (simplified logic)
   * @private
   */
  getStateFromZip(zipCode) {
    if (!zipCode || zipCode.length < 5) return 'IL';
    
    const firstDigit = zipCode.charAt(0);
    
    // Simplified ZIP to state mapping
    const zipToState = {
      '0': 'MA', // Massachusetts
      '1': 'NY', // New York
      '2': 'DC', // Washington DC
      '3': 'FL', // Florida
      '4': 'GA', // Georgia
      '5': 'TX', // Texas
      '6': 'IL', // Illinois
      '7': 'TX', // Texas
      '8': 'CO', // Colorado
      '9': 'CA'  // California
    };
    
    return zipToState[firstDigit] || 'IL';
  }

  /**
   * Get default city name for a ZIP code
   * @private
   */
  getDefaultCity(zipCode) {
    if (!zipCode || zipCode.length < 5) return 'Chicago';
    
    const firstDigit = zipCode.charAt(0);
    
    const zipToCity = {
      '0': 'Boston',
      '1': 'New York',
      '2': 'Washington',
      '3': 'Miami',
      '4': 'Atlanta',
      '5': 'Dallas',
      '6': 'Chicago',
      '7': 'Houston',
      '8': 'Denver',
      '9': 'Los Angeles'
    };
    
    return zipToCity[firstDigit] || 'Chicago';
  }

  /**
   * Get random element from array
   * @private
   */
  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate multiple address suggestions for autocomplete
   * @param {string} zipCode - ZIP code for addresses
   * @param {number} count - Number of suggestions to generate
   * @returns {Array} - Array of address strings
   */
  generateAddressSuggestions(zipCode = '60612', count = 5) {
    const suggestions = [];
    const usedCombinations = new Set();
    
    while (suggestions.length < count && usedCombinations.size < this.streetNumbers.length * this.userStreetNames.length) {
      const streetNumber = this.getRandomElement(this.streetNumbers);
      const streetName = this.getRandomElement(this.userStreetNames);
      const combination = `${streetNumber}-${streetName}`;
      
      if (!usedCombinations.has(combination)) {
        usedCombinations.add(combination);
        suggestions.push(`${streetNumber} ${streetName}`);
      }
    }
    
    return suggestions;
  }

  /**
   * Validate address format
   * @param {string} address - Address string to validate
   * @returns {boolean} - True if address appears valid
   */
  isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    
    const trimmed = address.trim();
    if (trimmed.length < 5) return false;
    
    // Basic pattern: should have numbers and letters
    const hasNumbers = /\d/.test(trimmed);
    const hasLetters = /[a-zA-Z]/.test(trimmed);
    
    return hasNumbers && hasLetters;
  }

  /**
   * Format address for display
   * @param {Object} addressObj - Address object
   * @param {string} format - Format type: 'short', 'medium', 'full'
   * @returns {string} - Formatted address string
   */
  formatAddress(addressObj, format = 'full') {
    if (!addressObj) return '';
    
    switch (format) {
      case 'short':
        return addressObj.street || '';
      case 'medium':
        return `${addressObj.street}, ${addressObj.city}`;
      case 'full':
      default:
        return `${addressObj.street}, ${addressObj.city}, ${addressObj.state} ${addressObj.zip}`;
    }
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.AddressGenerator = AddressGenerator;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AddressGenerator;
}
