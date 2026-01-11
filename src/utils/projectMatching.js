/**
 * Project matching utilities
 * Used to match emails/messages to projects by code, name, or venue
 * 
 * SIMPLE RULES:
 * 1. Match by project_name field (exact)
 * 2. Match by CODE in subject (exact word)
 * 3. Match by NAME in subject (exact word)
 * 4. SKIP venue matching (causes cross-project issues)
 */

// Normalize text for matching (lowercase, remove extra spaces)
export const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
};

/**
 * Check if text matches a project
 * Priority: 1) Project Code, 2) Project Name
 * NO venue matching - too generic
 */
export const matchesProject = (text, project) => {
  if (!text || !project) return false;
  
  const normalized = normalizeText(text);
  
  // 1. Check project code first (most reliable)
  if (project.code) {
    const code = normalizeText(project.code);
    if (normalized.includes(code)) return true;
  }
  
  // 2. Check project name
  if (project.name) {
    const name = normalizeText(project.name);
    if (normalized.includes(name)) return true;
  }
  
  // 3. NO venue matching - causes cross-project issues
  // when multiple projects share the same venue (e.g., "District 5")
  
  return false;
};

/**
 * Check if an item (email/message) belongs to a project
 * Checks project_name field, then subject/body for emails
 */
export const itemBelongsToProject = (item, project, checkBody = false) => {
  if (!item || !project) return false;
  
  // Skip command center / general items
  const itemProjectName = normalizeText(item.project_name);
  if (itemProjectName === '__general__' || itemProjectName === 'general' || itemProjectName === 'command') {
    return false;
  }
  
  // Check if item's project_name matches
  if (item.project_name && matchesProject(item.project_name, project)) {
    return true;
  }
  
  // For emails, check subject
  if (item.subject && matchesProject(item.subject, project)) {
    return true;
  }
  
  // Optionally check body (first 500 chars to avoid performance issues)
  if (checkBody && item.body) {
    if (matchesProject(item.body.substring(0, 500), project)) {
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
  
  for (const project of projects) {
    if (itemBelongsToProject(item, project, true)) {
      return project;
    }
  }
  
  return null;
};
