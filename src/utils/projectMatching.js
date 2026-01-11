/**
 * Project matching utilities
 * Used to match emails/messages to projects by code, name, or venue
 * 
 * IMPORTANT: Code takes highest priority. Venue is ONLY used if:
 * - No project code is found in the text
 * - The venue is specific enough (not shared by multiple projects)
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
 */
const containsExactMatch = (text, term) => {
  if (!text || !term) return false;
  
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  
  if (normalizedTerm.length < 2) return false;
  
  const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalizedTerm)}([^a-z0-9]|$)`, 'i');
  return regex.test(normalizedText);
};

/**
 * Extract project code from text (looks for patterns like SPF-D5, BHR-D5, etc.)
 * Returns the code if found, null otherwise
 */
const extractProjectCode = (text) => {
  if (!text) return null;
  
  // Common project code patterns: XXX-YY, XXXX-YY, XX-YYY
  const codePattern = /\b([A-Z]{2,4}[-_]?[A-Z0-9]{1,3})\b/gi;
  const matches = text.match(codePattern);
  
  return matches ? matches[0].toUpperCase() : null;
};

/**
 * Check if text matches a project's CODE specifically
 * This is the highest priority match
 */
const matchesProjectCode = (text, projectCode) => {
  if (!text || !projectCode) return false;
  return containsExactMatch(text, projectCode);
};

/**
 * Check if text matches a project
 * Priority: 1) Code (highest), 2) Name, 3) Venue (lowest, easily conflicts)
 * 
 * @param {string} text - Text to search in
 * @param {object} project - Project object
 * @param {boolean} strictMode - If true, don't match by venue (prevents cross-matching)
 */
export const matchesProject = (text, project, strictMode = false) => {
  if (!text || !project) return false;
  
  // 1. CODE match - highest priority
  if (project.code && matchesProjectCode(text, project.code)) {
    return true;
  }
  
  // 2. NAME match - medium priority
  if (project.name && containsExactMatch(text, project.name)) {
    return true;
  }
  
  // 3. VENUE match - lowest priority, SKIP in strict mode
  // Venue matching causes cross-project issues when projects share venues
  if (!strictMode && project.venue && containsExactMatch(text, project.venue)) {
    return true;
  }
  
  return false;
};

/**
 * Check if text contains ANOTHER project's code
 * Used to prevent cross-matching
 */
const containsOtherProjectCode = (text, thisProjectCode) => {
  if (!text) return false;
  
  const normalizedText = text.toUpperCase();
  const thisCode = (thisProjectCode || '').toUpperCase();
  
  // Common Sigma project codes - add more as needed
  const knownCodes = ['SPF', 'BHR', 'EIC', 'AGR', 'ECO'];
  
  for (const code of knownCodes) {
    // If we find a known code that's NOT this project's code, return true
    if (normalizedText.includes(code) && !thisCode.includes(code)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Check if an item (email/message) belongs to a project
 * 
 * MATCHING RULES:
 * 1. If item has project_name field matching this project's code/name → MATCH
 * 2. If subject contains THIS project's code → MATCH
 * 3. If subject contains ANOTHER project's code → NO MATCH (even if venue matches)
 * 4. If subject contains project name → MATCH
 * 5. Venue matching is DISABLED to prevent cross-project issues
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip general/command items
  const itemProjectName = normalizeText(item.project_name);
  if (itemProjectName === '__general__' || itemProjectName === 'general' || itemProjectName === 'command') {
    return false;
  }
  
  const projectCode = normalizeText(project.code || '');
  const projectName = normalizeText(project.name || '');
  
  // RULE 1: Check item's project_name field for exact match
  if (item.project_name) {
    if (itemProjectName === projectName) return true;
    if (projectCode && itemProjectName === projectCode) return true;
    if (projectCode && itemProjectName.includes(projectCode)) return true;
  }
  
  // Build search text from subject (and optionally body)
  let searchText = item.subject || '';
  if (checkBody && item.body) {
    searchText += ' ' + item.body.substring(0, 300);
  }
  
  if (!searchText.trim()) return false;
  
  // RULE 2: If subject contains THIS project's CODE → MATCH
  if (projectCode && matchesProjectCode(searchText, project.code)) {
    return true;
  }
  
  // RULE 3: If subject contains ANOTHER project's code → NO MATCH
  // This prevents "SPF-EGY-DISTRICT 5" from matching Bahra just because of "District 5"
  if (containsOtherProjectCode(searchText, project.code)) {
    return false;
  }
  
  // RULE 4: Match by project NAME (not venue - too generic)
  if (project.name && containsExactMatch(searchText, project.name)) {
    return true;
  }
  
  // RULE 5: NO venue matching - causes too many cross-project issues
  // when multiple projects share the same venue (e.g., "District 5")
  
  return false;
};

/**
 * Find which project an item belongs to
 */
export const findProjectForItem = (item, projects) => {
  if (!item || !projects?.length) return null;
  
  // First: exact project_name match
  for (const project of projects) {
    const itemProjectName = normalizeText(item.project_name);
    const projectName = normalizeText(project.name);
    const projectCode = normalizeText(project.code || '');
    
    if (itemProjectName && (itemProjectName === projectName || itemProjectName === projectCode)) {
      return project;
    }
  }
  
  // Second: code in subject
  for (const project of projects) {
    if (project.code && item.subject && matchesProjectCode(item.subject, project.code)) {
      return project;
    }
  }
  
  // Third: full matching logic
  for (const project of projects) {
    if (itemBelongsToProject(item, project, true)) {
      return project;
    }
  }
  
  return null;
};
