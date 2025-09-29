/**
 * Form Validation Utilities
 * Handles email validation and form field validation for JENNi components
 */

class FormValidators {
  constructor() {
    this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }

  /**
   * Validate email input field
   * @param {HTMLInputElement} input - Email input element
   * @returns {boolean} - True if valid, false otherwise
   */
  validateEmail(input) {
    const email = input.value;
    const errorDiv = input.parentElement.querySelector('.jenni-form-error');
    
    if (!errorDiv) {
      console.warn('FormValidators: No error div found for email validation');
      return this.isValidEmail(email);
    }

    if (!email) {
      this.showError(input, errorDiv, 'Email is required');
      return false;
    } else if (!this.emailRegex.test(email)) {
      this.showError(input, errorDiv, 'Please enter a valid email address');
      return false;
    } else {
      this.clearError(input, errorDiv);
      return true;
    }
  }

  /**
   * Check if email format is valid without UI updates
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid email format
   */
  isValidEmail(email) {
    return email && this.emailRegex.test(email);
  }

  /**
   * Validate all required form fields
   * @param {HTMLElement} container - Container element with form fields
   * @returns {boolean} - True if all fields are valid
   */
  validateForm(container) {
    const inputs = container.querySelectorAll('.jenni-form-input[required]');
    const emailInput = container.querySelector('input[name="email"]');
    let isValid = true;

    // Validate required fields
    inputs.forEach(input => {
      if (!input.value.trim()) {
        input.classList.add('error');
        isValid = false;
      } else {
        input.classList.remove('error');
      }
    });

    // Validate email specifically
    if (emailInput && !this.validateEmail(emailInput)) {
      isValid = false;
    }

    return isValid;
  }

  /**
   * Validate individual field
   * @param {HTMLInputElement} input - Input element to validate
   * @param {Object} rules - Validation rules
   * @returns {boolean} - True if valid
   */
  validateField(input, rules = {}) {
    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Required validation
    if (rules.required && !value) {
      isValid = false;
      errorMessage = rules.requiredMessage || `${this.getFieldLabel(input)} is required`;
    }

    // Min length validation
    if (isValid && rules.minLength && value.length < rules.minLength) {
      isValid = false;
      errorMessage = rules.minLengthMessage || `Minimum ${rules.minLength} characters required`;
    }

    // Max length validation
    if (isValid && rules.maxLength && value.length > rules.maxLength) {
      isValid = false;
      errorMessage = rules.maxLengthMessage || `Maximum ${rules.maxLength} characters allowed`;
    }

    // Pattern validation
    if (isValid && rules.pattern && !rules.pattern.test(value)) {
      isValid = false;
      errorMessage = rules.patternMessage || 'Invalid format';
    }

    // Email validation
    if (isValid && input.type === 'email' && value) {
      if (!this.isValidEmail(value)) {
        isValid = false;
        errorMessage = 'Please enter a valid email address';
      }
    }

    // Update UI
    const errorDiv = input.parentElement.querySelector('.jenni-form-error');
    if (errorDiv) {
      if (isValid) {
        this.clearError(input, errorDiv);
      } else {
        this.showError(input, errorDiv, errorMessage);
      }
    } else if (!isValid) {
      input.classList.add('error');
    } else {
      input.classList.remove('error');
    }

    return isValid;
  }

  /**
   * Show error state on input
   * @private
   */
  showError(input, errorDiv, message) {
    input.classList.add('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  /**
   * Clear error state on input
   * @private
   */
  clearError(input, errorDiv) {
    input.classList.remove('error');
    errorDiv.style.display = 'none';
  }

  /**
   * Get field label for error messages
   * @private
   */
  getFieldLabel(input) {
    const label = input.parentElement.querySelector('.jenni-form-label');
    if (label) {
      return label.textContent;
    }
    
    return input.getAttribute('aria-label') || 
           input.getAttribute('placeholder') || 
           input.getAttribute('name') || 
           'Field';
  }

  /**
   * Setup real-time validation for a form
   * @param {HTMLElement} form - Form container
   * @param {Object} fieldRules - Validation rules for each field
   */
  setupRealTimeValidation(form, fieldRules = {}) {
    const inputs = form.querySelectorAll('.jenni-form-input');
    
    inputs.forEach(input => {
      const fieldName = input.getAttribute('name');
      const rules = fieldRules[fieldName] || {};
      
      // Validate on blur
      input.addEventListener('blur', () => {
        this.validateField(input, rules);
      });
      
      // Clear errors on focus
      input.addEventListener('focus', () => {
        input.classList.remove('error');
        const errorDiv = input.parentElement.querySelector('.jenni-form-error');
        if (errorDiv) {
          errorDiv.style.display = 'none';
        }
      });
    });
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.FormValidators = FormValidators;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormValidators;
}
