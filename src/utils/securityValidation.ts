
// Security validation utilities
export const validateInput = (input: string, type: 'text' | 'email' | 'phone' | 'name' = 'text'): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  // Basic length checks
  if (input.length === 0 || input.length > 1000) return false;
  
  // Check for potential XSS patterns
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) return false;
  }
  
  // Check for SQL injection patterns
  const sqlPatterns = [
    /('|(\\))/gi,
    /(;|--|\*|\/\*|\*\/)/gi,
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) return false;
  }
  
  // Type-specific validation
  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(input) && input.length <= 254;
    
    case 'phone':
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return phoneRegex.test(input.replace(/[\s\-\(\)]/g, ''));
    
    case 'name':
      const nameRegex = /^[a-zA-Z\s\-\.\']+$/;
      return nameRegex.test(input) && input.length <= 100;
    
    default:
      return input.length <= 500;
  }
};

export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and > characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const weakPasswords = [
    'password', '123456', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon'
  ];
  
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
