/**
 * Input validation utilities for edge functions.
 * Enforces prompt constraints and sanitizes input.
 */

const MAX_PROMPT_LENGTH = 1000;
const BINARY_PATTERN = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validates and sanitizes a user-submitted prompt.
 * - Rejects empty prompts
 * - Enforces max length
 * - Rejects binary data
 * - Trims whitespace
 * - Strips HTML tags
 */
export function validatePrompt(input: unknown): ValidationResult {
  if (typeof input !== "string") {
    return { valid: false, error: "Prompt must be a string." };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Prompt cannot be empty." };
  }

  if (trimmed.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`,
    };
  }

  if (BINARY_PATTERN.test(trimmed)) {
    return { valid: false, error: "Prompt contains invalid binary data." };
  }

  // Strip HTML tags to prevent stored XSS
  const sanitized = stripHtml(trimmed);

  return { valid: true, sanitized };
}

/**
 * Remove all HTML tags from a string.
 */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
