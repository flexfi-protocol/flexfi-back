/**
 * Validates if a password meets the security requirements
 * @param password Password to validate
 * @returns True if password is strong enough
 */
export function isPasswordStrong(password: string): boolean {
  // Minimum 12 caractères, au moins 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/;
  return regex.test(password);
}

/**
 * Validates email format
 * @param email Email to validate
 * @returns True if email format is valid
 */
export function validateEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

/**
 * Validates password strength
 * @param password Password to validate
 * @returns True if password meets requirements
 */
export function validatePassword(password: string): boolean {
  // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, and 1 special character
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return regex.test(password);
}
