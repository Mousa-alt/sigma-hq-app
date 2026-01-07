// =========================================================
// Document Utilities - Parsing, Hierarchy, File Handling
// =========================================================

/**
 * Document type hierarchy (higher number = higher priority)
 * When conflicting info exists, higher priority doc wins
 */
export const DOCUMENT_HIERARCHY = {
  // Highest priority - official changes
  'cvi': { priority: 100, label: 'CVI', color: 'red', description: 'Consultant Variation Instruction' },
  'variation': { priority: 95, label: 'VO', color: 'red', description: 'Variation Order' },
  'addendum': { priority: 90, label: 'Addendum', color: 'red', description: 'Contract Addendum' },
  
  // High priority - formal correspondence
  'mom': { priority: 80, label: 'MOM', color: 'purple', description: 'Minutes of Meeting' },
  'letter': { priority: 75, label: 'Letter', color: 'purple', description: 'Official Letter' },
  'rfi_response': { priority: 70, label: 'RFI Resp', color: 'purple', description: 'RFI Response' },
  
  // Medium priority - submittals & approvals
  'approved_sample': { priority: 60, label: 'Approved', color: 'emerald', description: 'Approved Sample' },
  'approved_drawing': { priority: 60, label: 'Approved', color: 'emerald', description: 'Approved Drawing' },
  'shop_drawing': { priority: 55, label: 'Shop Dwg', color: 'blue', description: 'Shop Drawing' },
  'sample': { priority: 50, label: 'Sample', color: 'blue', description: 'Material Sample' },
  
  // Standard documents
  'specification': { priority: 40, label: 'Spec', color: 'indigo', description: 'Specification' },
  'boq': { priority: 35, label: 'BOQ', color: 'amber', description: 'Bill of Quantities' },
  'invoice': { priority: 30, label: 'Invoice', color: 'emerald', description: 'Invoice' },
  'report': { priority: 25, label: 'Report', color: 'sky', description: 'Report' },
  
  // Base documents
  'contract': { priority: 20, label: 'Contract', color: 'slate', description: 'Contract Document' },
  'design_drawing': { priority: 15, label: 'Design', color: 'slate', description: 'Design Drawing' },
  
  // Default
  'document': { priority: 0, label: 'Doc', color: 'slate', description: 'Document' },
};

/**
 * Parse Sigma file naming convention
 * Format: [Serial]_[Project]-[Location]-[Description]-[Initials]-[Date]-Rev_[XX]
 * Example: 05_AGORA-GEM-Approved_Sample_list-SB_I_25_12_2025-Rev_00.pdf
 */
export function parseFilename(filename) {
  if (!filename) return null;
  
  const result = {
    original: filename,
    serial: null,
    project: null,
    location: null,
    description: null,
    initials: null,
    date: null,
    revision: null,
    extension: null,
    docType: 'document',
  };
  
  // Get extension
  const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    result.extension = extMatch[1].toLowerCase();
  }
  
  // Remove extension for parsing
  const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '');
  
  // Try to parse structured format
  // Pattern: Serial_Project-Location-Description-Initials-Date-Rev_XX
  const parts = nameWithoutExt.split(/[-_]/);
  
  // Check for serial number at start
  if (parts[0] && /^\d+$/.test(parts[0])) {
    result.serial = parts[0];
  }
  
  // Check for revision at end
  const revMatch = nameWithoutExt.match(/Rev[_\s]?(\d+)/i);
  if (revMatch) {
    result.revision = revMatch[1];
  }
  
  // Check for date pattern (DD_MM_YYYY or similar)
  const dateMatch = nameWithoutExt.match(/(\d{1,2})[_\.](\d{1,2})[_\.](\d{4}|\d{2})/);
  if (dateMatch) {
    result.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  }
  
  // Check for initials (2-3 uppercase letters)
  const initialsMatch = nameWithoutExt.match(/[_-]([A-Z]{2,3})[_-]/);
  if (initialsMatch) {
    result.initials = initialsMatch[1];
  }
  
  // Try to extract project name (common patterns)
  if (nameWithoutExt.includes('AGORA')) {
    result.project = 'AGORA';
    if (nameWithoutExt.includes('GEM')) result.location = 'GEM';
    if (nameWithoutExt.includes('CAI')) result.location = 'Cairo';
  }
  
  // Detect document type from filename
  result.docType = detectDocumentType(filename, '');
  
  // Build description from remaining meaningful parts
  result.description = nameWithoutExt
    .replace(/^\d+[_-]/, '') // Remove serial
    .replace(/Rev[_\s]?\d+/i, '') // Remove revision
    .replace(/\d{1,2}[_\.]\d{1,2}[_\.]\d{2,4}/, '') // Remove date
    .replace(/[_-][A-Z]{2,3}[_-]/, '-') // Remove initials
    .replace(/AGORA[_-]?/i, '')
    .replace(/GEM[_-]?/i, '')
    .replace(/CAI[_-]?/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  
  return result;
}

/**
 * Detect document type from filename and path
 */
export function detectDocumentType(filename, path) {
  const lower = (filename + ' ' + path).toLowerCase();
  
  // Check for specific document types
  if (lower.includes('cvi') || lower.includes('consultant variation')) return 'cvi';
  if (lower.includes('variation') && lower.includes('order')) return 'variation';
  if (lower.includes('addendum')) return 'addendum';
  if (lower.includes('mom') || lower.includes('minutes of meeting') || lower.includes('meeting minutes')) return 'mom';
  if (lower.includes('rfi') && lower.includes('response')) return 'rfi_response';
  if (lower.includes('letter')) return 'letter';
  if ((lower.includes('approved') && lower.includes('sample')) || lower.includes('sample_list')) return 'approved_sample';
  if (lower.includes('approved') && (lower.includes('drawing') || lower.includes('shop'))) return 'approved_drawing';
  if (lower.includes('shop') && lower.includes('drawing')) return 'shop_drawing';
  if (lower.includes('sample')) return 'sample';
  if (lower.includes('spec')) return 'specification';
  if (lower.includes('boq') || lower.includes('bill of quantities')) return 'boq';
  if (lower.includes('invoice')) return 'invoice';
  if (lower.includes('report') || lower.includes('progress')) return 'report';
  if (lower.includes('contract')) return 'contract';
  if (lower.includes('design') && lower.includes('drawing')) return 'design_drawing';
  
  return 'document';
}

/**
 * Get document type info (label, color, priority)
 */
export function getDocTypeInfo(docType) {
  return DOCUMENT_HIERARCHY[docType] || DOCUMENT_HIERARCHY['document'];
}

/**
 * Sort results by document hierarchy (highest priority first)
 */
export function sortByHierarchy(results) {
  return [...results].sort((a, b) => {
    const typeA = detectDocumentType(a.title || '', a.link || '');
    const typeB = detectDocumentType(b.title || '', b.link || '');
    const prioA = DOCUMENT_HIERARCHY[typeA]?.priority || 0;
    const prioB = DOCUMENT_HIERARCHY[typeB]?.priority || 0;
    return prioB - prioA; // Higher priority first
  });
}

/**
 * Parse GCS link to extract useful info
 */
export function parseGCSLink(gcsLink) {
  if (!gcsLink) return { path: '', filename: 'Unknown', folder: '', projectFolder: '' };
  
  // gs://sigma-docs-repository/Agora-GEM/01.Contract_Documents/...
  const path = gcsLink.replace('gs://sigma-docs-repository/', '');
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const projectFolder = parts[0] || '';
  const folder = parts.slice(1, -1).join(' > ');
  
  return { path, filename, folder, projectFolder };
}

/**
 * Convert GCS path to a preview/download URL
 * This generates a URL that the backend can handle
 */
export function getFileViewURL(gcsLink, syncWorkerUrl) {
  if (!gcsLink || !syncWorkerUrl) return null;
  
  // Encode the GCS path for URL
  const encodedPath = encodeURIComponent(gcsLink.replace('gs://sigma-docs-repository/', ''));
  return `${syncWorkerUrl}/view?path=${encodedPath}`;
}

/**
 * Get file icon based on extension
 */
export function getFileIcon(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return 'file-text';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'file-spreadsheet';
  if (['doc', 'docx'].includes(ext)) return 'file-text';
  if (['dwg', 'dxf'].includes(ext)) return 'ruler';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
  if (['ppt', 'pptx'].includes(ext)) return 'presentation';
  return 'file';
}

/**
 * Format date for display
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Generate AI context about document hierarchy
 * This can be sent to the backend to improve AI responses
 */
export function getHierarchyContext() {
  return `
Document Priority Rules (higher priority overrides lower):
1. CVI (Consultant Variation Instruction) - HIGHEST - Official changes to scope/specs
2. Variation Orders - Official contract changes
3. Addendums - Contract amendments
4. Minutes of Meeting (MOM) - Recent meetings override older ones
5. Official Letters - Formal correspondence
6. RFI Responses - Clarifications
7. Approved Samples/Drawings - Confirmed materials and designs
8. Shop Drawings - Submitted for approval
9. Specifications - Technical requirements
10. BOQ - Bill of Quantities
11. Contract Documents - Base agreement
12. Design Drawings - Original designs

When information conflicts, always cite the highest priority, most recent document.
Always mention the source document name and date in your answer.
`.trim();
}
