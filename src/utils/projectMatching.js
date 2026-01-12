/**
 * Project matching utilities
 * 
 * STRICT RULES:
 * 1. Email MUST contain project CODE or NAME to match
 * 2. Venue alone is NOT enough
 * 3. Generic emails (no project identifier) don't match any project
 */

// Simple lowercase
const normalize = (text) => {
  if (!text) return '';
  return text.toLowerCase().trim();
};

// Extract code prefix (e.g., "SPF" from "SPF-D5", "EIC" from "EIC-001")
const getCodePrefix = (code) => {
  if (!code) return '';
  return code.toUpperCase().split(/[-_\s\d]/)[0];
};

// Known project code prefixes - helps identify if email belongs to another project
const KNOWN_CODE_PREFIXES = ['SPF', 'BHR', 'EIC', 'AGR', 'ECO', 'RYD', 'CAI', 'JED', 'DMM'];

/**
 * Check if text contains another project's code
 */
const hasOtherProjectCode = (text, thisProjectCode) => {
  if (!text) return false;
  const upperText = text.toUpperCase();
  const thisPrefix = getCodePrefix(thisProjectCode);
  
  for (const prefix of KNOWN_CODE_PREFIXES) {
    if (prefix === thisPrefix) continue;
    if (upperText.includes(prefix + '-') || upperText.includes(prefix + '_') || 
        new RegExp(`\\b${prefix}\\b`).test(upperText)) {
      return true;
    }
  }
  return false;
};

/**
 * Check if text contains a specific term as a word (not substring)
 * e.g., "EIC" should match "EIC-123" but not "Eichholtz"
 */
const containsWord = (text, term) => {
  if (!text || !term || term.length < 2) return false;
  
  const lowerText = normalize(text);
  const lowerTerm = normalize(term);
  
  // For short codes (2-4 chars), require word boundary or dash/underscore
  if (lowerTerm.length <= 4) {
    // Must be followed by non-letter or end, and preceded by non-letter or start
    const regex = new RegExp(`(^|[^a-z])${lowerTerm}([^a-z]|$)`, 'i');
    return regex.test(text);
  }
  
  // For longer terms, simple includes is fine
  return lowerText.includes(lowerTerm);
};

/**
 * Check if text matches a project - STRICT matching
 * Returns true only if there's a clear project identifier match
 */
export const matchesProject = (text, project) => {
  if (!text || !project) return false;
  
  const lowerText = normalize(text);
  
  // 1. Check full code (e.g., "spf-d5", "eic-001")
  if (project.code) {
    const code = normalize(project.code);
    if (lowerText.includes(code)) return true;
    
    // Check code prefix with word boundary (e.g., "SPF" not "Springfield")
    const prefix = getCodePrefix(project.code);
    if (prefix && prefix.length >= 2) {
      if (containsWord(text, prefix)) return true;
    }
  }
  
  // 2. Check project name - must be clear match
  if (project.name) {
    const name = normalize(project.name);
    // For short names, require word boundary
    if (name.length <= 6) {
      if (containsWord(text, project.name)) return true;
    } else {
      if (lowerText.includes(name)) return true;
    }
  }
  
  // 3. NO venue-only matching - too generic
  // Venue is NOT checked here
  
  return false;
};

/**
 * Check if an item belongs to a project - STRICT
 * Only matches if project CODE or NAME is found
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip command center / general items
  const itemProject = normalize(item.project_name);
  if (itemProject === '__general__' || itemProject === 'general' || itemProject === 'command') {
    return false;
  }
  
  // 1. Check project_name field first (most reliable - set by webhook)
  if (item.project_name) {
    if (matchesProject(item.project_name, project)) {
      return true;
    }
  }
  
  // 2. Check subject for project identifier
  if (item.subject) {
    // Skip if another project's code is in subject
    if (hasOtherProjectCode(item.subject, project.code)) {
      return false;
    }
    
    if (matchesProject(item.subject, project)) {
      return true;
    }
  }
  
  // 3. Check body if requested (but only for clear matches)
  if (checkBody && item.body) {
    const bodyStart = item.body.substring(0, 300);
    
    // Skip if another project's code is in body
    if (hasOtherProjectCode(bodyStart, project.code)) {
      return false;
    }
    
    if (matchesProject(bodyStart, project)) {
      return true;
    }
  }
  
  // No match found - email doesn't belong to this project
  return false;
};

/**
 * Find which project an item belongs to
 * Returns null if no clear match (item is "general")
 */
export const findProjectForItem = (item, projects) => {
  if (!item || !projects?.length) return null;
  
  // Skip items marked as general
  const itemProject = normalize(item.project_name);
  if (itemProject === '__general__' || itemProject === 'general' || itemProject === 'command') {
    return null;
  }
  
  // First: check by code in project_name or subject (most reliable)
  for (const project of projects) {
    if (project.code) {
      const code = normalize(project.code);
      const prefix = getCodePrefix(project.code);
      
      // Check project_name field
      if (item.project_name) {
        const pn = normalize(item.project_name);
        if (pn.includes(code) || (prefix && containsWord(item.project_name, prefix))) {
          return project;
        }
      }
      
      // Check subject
      if (item.subject) {
        if (containsWord(item.subject, code) || (prefix && containsWord(item.subject, prefix))) {
          return project;
        }
      }
    }
  }
  
  // Second: check by name
  for (const project of projects) {
    if (project.name && item.subject) {
      if (matchesProject(item.subject, project)) {
        return project;
      }
    }
  }
  
  // No match - this is a general/unassigned email
  return null;
};

// Export for use elsewhere
export const normalizeText = normalize;
