/**
 * Output sanitization utilities.
 * All LLM model output MUST pass through these before rendering.
 * Prevents XSS from model-generated content.
 */
import DOMPurify from "dompurify";

/**
 * Sanitize model output for safe display.
 * Strips all HTML tags and attributes — outputs plain text only.
 * This is the default for model responses.
 */
export function sanitizeText(input) {
  if (typeof input !== "string") return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize with minimal formatting (bold, italic, code).
 * Use only when you explicitly want basic formatting from trusted analysis.
 */
export function sanitizeWithFormatting(input) {
  if (typeof input !== "string") return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "code", "pre", "br"],
    ALLOWED_ATTR: [],
  });
}

/**
 * Escape HTML entities for safe embedding in attributes or text.
 * Lightweight alternative when DOMPurify is overkill.
 */
export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}
