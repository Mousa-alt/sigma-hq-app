/**
 * Project matching utilities
 * 
 * RULES (tested and working):
 * 1. Match by CODE PREFIX (SPF, BHR) - highest priority
 * 2. Match by NAME (Springfield, Bahra)
 * 3. Match by VENUE - but ONLY if no other project's code is in text
 */

// Simple lowercase - NO replacing dashes/underscores
const normalize = (text) => {
  if (!text) return '';
  return text.toLowerCase().trim();
};

// Extract code prefix (e.g., "SPF" from "SPF-D5")
const getCodePrefix = (code) => {
  if (!code) return '';
  return code.toUpperCase().split(/[-_\s]/)[0];
};

// Known project code prefixes - add new ones here
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
    if (upperText.includes(prefix)) return true;
  }
  return false;
};

/**
 * Check if text matches a project
 */
export const matchesProject = (text, project, allowVenue = true) => {
  if (!text || !project) return false;
  
  const lowerText = normalize(text);
  
  // 1. Check full code (e.g., "spf-d5")
  if (project.code) {
    const code = normalize(project.code);
    if (lowerText.includes(code)) return true;
    
    // 2. Check code prefix (e.g., "spf")
    const prefix = getCodePrefix(project.code).toLowerCase();
    if (prefix.length >= 2 && lowerText.includes(prefix)) return true;
  }
  
  // 3. Check project name
  if (project.name) {
    const name = normalize(project.name);
    if (lowerText.includes(name)) return true;
  }
  
  // 4. Check venue - BUT skip if another project's code is in the text
  if (allowVenue && project.venue) {
    // Don't match by venue if text contains another project's code
    if (hasOtherProjectCode(text, project.code)) {
      return false;
    }
    const venue = normalize(project.venue);
    if (lowerText.includes(venue)) return true;
  }
  
  return false;
};

/**
 * Check if an item belongs to a project
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip command center / general items
  const itemProject = normalize(item.project_name);
  if (itemProject === '__general__' || itemProject === 'general' || itemProject === 'command') {
    return false;
  }
  
  // Check project_name field first (most reliable)
  if (item.project_name) {
    // Direct match on project_name field
    if (matchesProject(item.project_name, project, false)) {
      return true;
    }
  }
  
  // Check subject (with venue matching)
  if (item.subject) {
    if (matchesProject(item.subject, project, true)) {
      return true;
    }
  }
  
  // Check body if requested
  if (checkBody && item.body) {
    if (matchesProject(item.body.substring(0, 500), project, true)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Find which project an item belongs to
 */
export const findProjectForItem = (item, projects) => {
  if (!item || !projects?.length) return null;
  
  // First: check by code/name (most reliable)
  for (const project of projects) {
    if (item.project_name && matchesProject(item.project_name, project, false)) {
      return project;
    }
    if (item.subject) {
      // Check code prefix first
      const prefix = getCodePrefix(project.code);
      if (prefix && item.subject.toUpperCase().includes(prefix)) {
        return project;
      }
    }
  }
  
  // Second: full matching with venue
  for (const project of projects) {
    if (itemBelongsToProject(item, project, true)) {
      return project;
    }
  }
  
  return null;
};

// Export for use elsewhere
export const normalizeText = normalize;
