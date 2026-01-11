/**
 * Project matching utilities
 * Used to match emails/messages to projects by code, name, or venue
 * 
 * MATCHING RULES:
 * 1. CODE match → Always matches (SPF, BHR, SPF-D5, BHR-D5)
 * 2. NAME match → Always matches (Springfield, Bahra) - fuzzy tolerant
 * 3. NAME + VENUE together → Matches
 * 4. VENUE alone → NEVER matches (too generic, multiple projects share venues)
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
 * Fuzzy match - allows for common typos and variations
 * e.g., "Springfeild" matches "Springfield", "SPF" matches project with code containing "SPF"
 */
const fuzzyMatch = (text, term, threshold = 0.8) => {
  if (!text || !term) return false;
  
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  
  // Exact substring match
  if (normalizedText.includes(normalizedTerm)) return true;
  
  // Check if term appears as a word (with boundaries)
  if (containsExactMatch(text, term)) return true;
  
  // For short codes (2-4 chars), require exact match
  if (normalizedTerm.length <= 4) {
    return containsExactMatch(text, term);
  }
  
  // For longer terms, check each word in text against term
  const textWords = normalizedText.split(/\s+/);
  for (const word of textWords) {
    if (word.length < 3) continue;
    
    // Levenshtein-like simple check: if 80% of chars match, consider it a match
    if (word.length >= normalizedTerm.length * 0.7 && word.length <= normalizedTerm.length * 1.3) {
      let matches = 0;
      const shorter = word.length < normalizedTerm.length ? word : normalizedTerm;
      const longer = word.length < normalizedTerm.length ? normalizedTerm : word;
      
      for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
      }
      
      if (matches / shorter.length >= threshold) return true;
    }
  }
  
  return false;
};

/**
 * Check if text contains a project code
 * Handles formats like: SPF, BHR, SPF-D5, BHR-D5, SPF_D5
 */
const matchesCode = (text, code) => {
  if (!text || !code) return false;
  
  const normalizedText = text.toUpperCase();
  const normalizedCode = code.toUpperCase().replace(/[-_]/g, '');
  
  // Check full code first (e.g., "SPFD5" or "SPF-D5")
  if (normalizedText.includes(normalizedCode)) return true;
  if (containsExactMatch(text, code)) return true;
  
  // Check code prefix (first 2-4 letters before any dash/number)
  const codePrefix = code.toUpperCase().match(/^[A-Z]{2,4}/)?.[0];
  if (codePrefix && codePrefix.length >= 2) {
    // Must be a standalone word or followed by dash/number
    const prefixRegex = new RegExp(`(^|[^A-Z])${codePrefix}([^A-Z]|$|[-_]?[0-9])`, 'i');
    if (prefixRegex.test(text)) return true;
  }
  
  return false;
};

/**
 * Check if text matches a project
 * 
 * @param {string} text - Text to search in
 * @param {object} project - Project object with code, name, venue
 * @returns {boolean}
 */
export const matchesProject = (text, project) => {
  if (!text || !project) return false;
  
  // 1. CODE match - highest priority, exact
  if (project.code && matchesCode(text, project.code)) {
    return true;
  }
  
  // 2. NAME match - fuzzy tolerant for typos
  if (project.name && fuzzyMatch(text, project.name)) {
    return true;
  }
  
  // 3. NAME + VENUE together - for unique identification
  if (project.name && project.venue) {
    const normalizedText = normalizeText(text);
    const hasName = fuzzyMatch(text, project.name);
    const hasVenue = containsExactMatch(text, project.venue);
    
    // Only match if BOTH name and venue are present
    if (hasName && hasVenue) return true;
  }
  
  // 4. VENUE alone - NEVER match (too generic)
  // This is intentionally not checked
  
  return false;
};

/**
 * Check if text contains ANOTHER project's code (to prevent cross-matching)
 * 
 * @param {string} text - Text to check
 * @param {string} thisProjectCode - Current project's code (to exclude)
 * @param {array} allProjectCodes - List of all known project codes
 */
const containsOtherProjectCode = (text, thisProjectCode, allProjectCodes = []) => {
  if (!text) return false;
  
  const normalizedText = text.toUpperCase();
  const thisCode = (thisProjectCode || '').toUpperCase();
  const thisPrefix = thisCode.match(/^[A-Z]{2,4}/)?.[0] || '';
  
  // Check against provided codes
  for (const code of allProjectCodes) {
    const upperCode = code.toUpperCase();
    const prefix = upperCode.match(/^[A-Z]{2,4}/)?.[0] || '';
    
    // Skip if it's the same project
    if (upperCode === thisCode || prefix === thisPrefix) continue;
    
    // Check if this other code appears in the text
    if (matchesCode(text, code)) return true;
  }
  
  // Fallback: check for common Sigma project code patterns
  const knownPrefixes = ['SPF', 'BHR', 'EIC', 'AGR', 'ECO', 'RYD', 'CAI'];
  for (const prefix of knownPrefixes) {
    if (prefix === thisPrefix) continue;
    
    const prefixRegex = new RegExp(`(^|[^A-Z])${prefix}([^A-Z]|$|[-_]?[0-9D])`, 'i');
    if (prefixRegex.test(text)) return true;
  }
  
  return false;
};

/**
 * Check if an item (email/message) belongs to a project
 * 
 * MATCHING RULES:
 * 1. If item.project_name matches this project's code/name → MATCH
 * 2. If subject contains THIS project's code → MATCH
 * 3. If subject contains ANOTHER project's code → NO MATCH
 * 4. If subject contains project name (fuzzy) → MATCH
 * 5. If subject contains name + venue together → MATCH
 * 6. Venue alone → NEVER MATCH
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip general/command items
  const itemProjectName = normalizeText(item.project_name);
  if (itemProjectName === '__general__' || itemProjectName === 'general' || itemProjectName === 'command') {
    return false;
  }
  
  const projectCode = project.code || '';
  const projectName = project.name || '';
  
  // RULE 1: Check item's project_name field for match
  if (item.project_name) {
    const normalizedItemProject = normalizeText(item.project_name);
    const normalizedProjectName = normalizeText(projectName);
    const normalizedProjectCode = normalizeText(projectCode);
    
    // Exact match on project_name
    if (normalizedItemProject === normalizedProjectName) return true;
    if (normalizedProjectCode && normalizedItemProject === normalizedProjectCode) return true;
    
    // Code in project_name
    if (projectCode && matchesCode(item.project_name, projectCode)) return true;
    
    // Name in project_name (fuzzy)
    if (projectName && fuzzyMatch(item.project_name, projectName)) return true;
  }
  
  // Build search text
  let searchText = item.subject || '';
  if (checkBody && item.body) {
    searchText += ' ' + item.body.substring(0, 300);
  }
  
  if (!searchText.trim()) return false;
  
  // RULE 2: If subject contains THIS project's CODE → MATCH
  if (projectCode && matchesCode(searchText, projectCode)) {
    return true;
  }
  
  // RULE 3: If subject contains ANOTHER project's code → NO MATCH
  if (containsOtherProjectCode(searchText, projectCode)) {
    return false;
  }
  
  // RULE 4: Match by project NAME (fuzzy for typos)
  if (projectName && fuzzyMatch(searchText, projectName)) {
    return true;
  }
  
  // RULE 5: NAME + VENUE together
  if (projectName && project.venue) {
    const hasName = fuzzyMatch(searchText, projectName);
    const hasVenue = containsExactMatch(searchText, project.venue);
    if (hasName && hasVenue) return true;
  }
  
  // RULE 6: Venue alone → NEVER MATCH
  
  return false;
};

/**
 * Find which project an item belongs to
 */
export const findProjectForItem = (item, projects) => {
  if (!item || !projects?.length) return null;
  
  const allCodes = projects.map(p => p.code).filter(Boolean);
  
  // First pass: exact project_name or code match
  for (const project of projects) {
    const itemProjectName = normalizeText(item.project_name);
    const projectName = normalizeText(project.name);
    const projectCode = normalizeText(project.code || '');
    
    if (itemProjectName) {
      if (itemProjectName === projectName || itemProjectName === projectCode) {
        return project;
      }
      if (project.code && matchesCode(item.project_name, project.code)) {
        return project;
      }
    }
  }
  
  // Second pass: code in subject (highest priority)
  if (item.subject) {
    for (const project of projects) {
      if (project.code && matchesCode(item.subject, project.code)) {
        return project;
      }
    }
  }
  
  // Third pass: name matching
  for (const project of projects) {
    if (itemBelongsToProject(item, project, true)) {
      return project;
    }
  }
  
  return null;
};
