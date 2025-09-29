/**
 * Component Loader for JENNi Edge Components
 * Handles dynamic loading of modular components
 */

class ComponentLoader {
  constructor(basePath = './src/components/') {
    this.basePath = basePath;
    this.loadedComponents = new Map();
    this.loadingPromises = new Map();
  }

  /**
   * Load a component dynamically
   * @param {string} componentName - Name of the component to load
   * @returns {Promise<Function>} - Promise that resolves to the component constructor
   */
  async loadComponent(componentName) {
    // Return cached component if already loaded
    if (this.loadedComponents.has(componentName)) {
      return this.loadedComponents.get(componentName);
    }

    // Return existing loading promise if already loading
    if (this.loadingPromises.has(componentName)) {
      return this.loadingPromises.get(componentName);
    }

    // Start loading the component
    const loadingPromise = this.doLoadComponent(componentName);
    this.loadingPromises.set(componentName, loadingPromise);

    try {
      const component = await loadingPromise;
      this.loadedComponents.set(componentName, component);
      this.loadingPromises.delete(componentName);
      return component;
    } catch (error) {
      this.loadingPromises.delete(componentName);
      throw error;
    }
  }

  /**
   * Actually perform the component loading
   * @private
   */
  async doLoadComponent(componentName) {
    const componentPath = `${this.basePath}${componentName}.js`;

    try {
      // Try dynamic import first (ES6 modules)
      if (typeof import !== 'undefined') {
        const module = await import(componentPath);
        return module.default || module[componentName];
      }

      // Fallback to script loading for browsers
      return await this.loadComponentViaScript(componentPath, componentName);
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      throw new Error(`Component ${componentName} could not be loaded`);
    }
  }

  /**
   * Load component via script tag (browser fallback)
   * @private
   */
  loadComponentViaScript(scriptPath, componentName) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptPath;
      script.async = true;

      script.onload = () => {
        // Check if component is available on window
        if (window[componentName]) {
          resolve(window[componentName]);
        } else {
          reject(new Error(`Component ${componentName} not found on window after loading`));
        }
        document.head.removeChild(script);
      };

      script.onerror = () => {
        reject(new Error(`Failed to load script: ${scriptPath}`));
        document.head.removeChild(script);
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Load multiple components at once
   * @param {Array<string>} componentNames - Array of component names to load
   * @returns {Promise<Map>} - Promise that resolves to a map of component name -> constructor
   */
  async loadComponents(componentNames) {
    const loadPromises = componentNames.map(async (name) => {
      const component = await this.loadComponent(name);
      return [name, component];
    });

    const results = await Promise.all(loadPromises);
    return new Map(results);
  }

  /**
   * Preload components without waiting
   * @param {Array<string>} componentNames - Array of component names to preload
   */
  preloadComponents(componentNames) {
    componentNames.forEach(name => {
      this.loadComponent(name).catch(error => {
        console.warn(`Preload failed for component ${name}:`, error);
      });
    });
  }

  /**
   * Check if a component is loaded
   * @param {string} componentName - Name of the component
   * @returns {boolean} - True if component is loaded
   */
  isComponentLoaded(componentName) {
    return this.loadedComponents.has(componentName);
  }

  /**
   * Get a loaded component (synchronous)
   * @param {string} componentName - Name of the component
   * @returns {Function|null} - Component constructor or null if not loaded
   */
  getComponent(componentName) {
    return this.loadedComponents.get(componentName) || null;
  }

  /**
   * Clear loaded components cache
   */
  clearCache() {
    this.loadedComponents.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get loading status
   * @returns {Object} - Status object with loaded and loading component names
   */
  getStatus() {
    return {
      loaded: Array.from(this.loadedComponents.keys()),
      loading: Array.from(this.loadingPromises.keys())
    };
  }
}

// Create a singleton instance for global use
const componentLoader = new ComponentLoader();

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.ComponentLoader = ComponentLoader;
  window.componentLoader = componentLoader;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ComponentLoader, componentLoader };
}
