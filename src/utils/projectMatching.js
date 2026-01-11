/**
 * Project matching utilities
 * Used to match emails/messages to projects by code, name, or venue
 * 
 * Uses word-boundary matching to prevent false positives
 * e.g., "Bahra" won't match "Bahrain", "SPF" won't match "Springfield"
 */

// Normalize text for matching (lowercase, remove extra spaces)
export const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Check if text contains an EXACT word/phrase match
 * Uses word boundaries to prevent partial matches
 * 
 * @param {string} text - Text to search in
 * @param {string} term - Term to find (must be whole word/phrase)
 * @returns {boolean}
 */
const containsExactMatch = (text, term) => {
  if (!text || !term) return false;
  
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  
  // Skip very short terms (< 2 chars) - too prone to false matches
  if (normalizedTerm.length < 2) return false;
  
  // Use word boundary matching
  // This ensures "Bahra" doesn't match "Bahrain", "SPF" doesn't match "Springfield"
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`, 'i');
  return regex.test(normalizedText);
};

/**
 * Check if text matches a project
 * Priority: 1) Project Code (exact), 2) Project Name (exact), 3) Venue (exact)
 * 
 * @param {string} text - Text to search in (email subject, body, message)
 * @param {object} project - Project object with code, name, venue
 * @returns {boolean}
 */
export const matchesProject = (text, project) => {
  if (!text || !project) return false;
  
  // 1. Check project code first (most reliable) - EXACT match
  if (project.code) {
    if (containsExactMatch(text, project.code)) return true;
  }
  
  // 2. Check project name - EXACT match
  if (project.name) {
    if (containsExactMatch(text, project.name)) return true;
  }
  
  // 3. Check venue - EXACT match
  if (project.venue) {
    if (containsExactMatch(text, project.venue)) return true;
  }
  
  return false;
};

/**
 * Check if an item (email/message) belongs to a project
 * 
 * PRIORITY ORDER:
 * 1. Check item's project_name field for EXACT match with project code/name/venue
 * 2. Check email subject for EXACT match
 * 3. Optionally check body (first 500 chars)
 * 
 * @param {object} item - Email or message object
 * @param {object} project - Project object
 * @param {boolean} checkBody - Also check body content (slower)
 * @returns {boolean}
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip command center / general items
  const itemProjectName = normalizeText(item.project_name);
  if (itemProjectName === '__general__' || itemProjectName === 'general' || itemProjectName === 'command') {
    return false;
  }
  
  // BEST: Check if item's project_name field matches this project exactly
  if (item.project_name) {
    // Direct string comparison first (fastest)
    const normalizedItemProject = normalizeText(item.project_name);
    const normalizedProjectName = normalizeText(project.name);
    const normalizedProjectCode = normalizeText(project.code || '');
    const normalizedProjectVenue = normalizeText(project.venue || '');
    
    // Exact match on project_name field
    if (normalizedItemProject === normalizedProjectName) return true;
    if (normalizedProjectCode && normalizedItemProject === normalizedProjectCode) return true;
    if (normalizedProjectVenue && normalizedItemProject === normalizedProjectVenue) return true;
    
    // Also check if the project_name CONTAINS our project (for compound names)
    if (matchesProject(item.project_name, project)) return true;
  }
  
  // FALLBACK: Check email subject for exact word match
  if (item.subject && matchesProject(item.subject, project)) {
    return true;
  }
  
  // LAST RESORT: Check body (first 500 chars only)
  if (checkBody && item.body) {
    if (matchesProject(item.body.substring(0, 500), project)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Find which project an item belongs to
 * 
 * @param {object} item - Email or message object
 * @param {array} projects - Array of project objects
 * @returns {object|null} - Matching project or null
 */
export const findProjectForItem = (item, projects) => {
  if (!item || !projects?.length) return null;
  
  // First pass: look for exact project_name match
  for (const project of projects) {
    const itemProjectName = normalizeText(item.project_name);
    const projectName = normalizeText(project.name);
    const projectCode = normalizeText(project.code || '');
    
    if (itemProjectName && (itemProjectName === projectName || itemProjectName === projectCode)) {
      return project;
    }
  }
  
  // Second pass: use full matching logic
  for (const project of projects) {
    if (itemBelongsToProject(item, project, true)) {
      return project;
    }
  }
  
  return null;
};
