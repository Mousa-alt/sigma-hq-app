# Document Type Detection & Hierarchy
import re
import os

# Document type hierarchy with priorities
DOCUMENT_HIERARCHY = {
    'shop_drawing': {'priority': 100, 'label': 'Shop Drawing', 'description': 'Shop Drawing'},
    'approval': {'priority': 90, 'label': 'Approval', 'description': 'Material/Shop Drawing Approval'},
    'rfi': {'priority': 85, 'label': 'RFI', 'description': 'Request for Information Response'},
    'mom': {'priority': 80, 'label': 'MOM', 'description': 'Minutes of Meeting'},
    'submittal': {'priority': 75, 'label': 'Submittal', 'description': 'Material Submittal'},
    'specification': {'priority': 70, 'label': 'Spec', 'description': 'Technical Specification'},
    'boq': {'priority': 65, 'label': 'BOQ', 'description': 'Bill of Quantities'},
    'vo': {'priority': 60, 'label': 'VO', 'description': 'Variation Order (Financial)'},
    'contract': {'priority': 55, 'label': 'Contract', 'description': 'Contract Document'},
    'correspondence': {'priority': 50, 'label': 'Letter', 'description': 'Correspondence'},
    'report': {'priority': 45, 'label': 'Report', 'description': 'Site/Progress Report'},
    'drawing': {'priority': 40, 'label': 'Drawing', 'description': 'Design Drawing'},
    'invoice': {'priority': 35, 'label': 'Invoice', 'description': 'Invoice/Payment'},
    'procurement': {'priority': 33, 'label': 'Procurement', 'description': 'Purchase Order / Quotation'},
    'other': {'priority': 10, 'label': 'Document', 'description': 'General Document'},
}


def detect_document_type(filename, path):
    """
    Detect document type based on FOLDER PATH (primary) and filename (secondary).
    Supports both OLD and NEW folder structures.
    """
    lower_name = filename.lower()
    lower_path = path.lower()
    
    # === NEW FOLDER STRUCTURE ===
    if '01.correspondence' in lower_path:
        return 'correspondence'
    if '03.design-drawings' in lower_path:
        return 'drawing'
    if '04.shop-drawings' in lower_path:
        return 'shop_drawing'
    if '05.contract-boq' in lower_path:
        if '/contract' in lower_path:
            return 'contract'
        if '/boq' in lower_path:
            return 'boq'
        return 'contract'
    if '06.qs-procurement' in lower_path:
        if '/purchase' in lower_path:
            return 'procurement'
        return 'boq'
    if '07.submittals' in lower_path:
        return 'submittal'
    if '08.reports-mom' in lower_path:
        if '/mom' in lower_path:
            return 'mom'
        return 'report'
    if '09.invoices-variations' in lower_path:
        if '/variation' in lower_path:
            return 'vo'
        return 'invoice'
    if '10.handover' in lower_path:
        if '/as-built' in lower_path:
            return 'drawing'
        return 'other'
    if '02.project-info' in lower_path:
        if '/tender' in lower_path:
            return 'contract'
        return 'other'
    
    # === OLD FOLDER STRUCTURE ===
    if '08.variation' in lower_path or 'extra work' in lower_path:
        return 'vo'
    if '01.drawings' in lower_path and '02.drawings' in lower_path:
        return 'shop_drawing'
    if '04-shop' in lower_path or '04_shop' in lower_path:
        return 'shop_drawing'
    if '/drawings/' in lower_path and 'design' not in lower_path:
        return 'shop_drawing'
    if '02.design' in lower_path or '02-design' in lower_path:
        return 'drawing'
    if '01.mom' in lower_path or '/mom/' in lower_path or '06.mom' in lower_path:
        return 'mom'
    if '02.report' in lower_path or '07-site' in lower_path or '/reports/' in lower_path:
        return 'report'
    if '07.invoice' in lower_path or '/invoices/' in lower_path:
        return 'invoice'
    if '10.submittal' in lower_path or '/submittal' in lower_path:
        return 'submittal'
    if '04.qs' in lower_path or '06-quantity' in lower_path or '/qs/' in lower_path:
        return 'boq'
    if '03.loi' in lower_path or '01-contract' in lower_path:
        return 'contract'
    if '03-spec' in lower_path or '/spec/' in lower_path:
        return 'specification'
    if '/rfi/' in lower_path:
        return 'rfi'
    if '09-corr' in lower_path or '/correspondence/' in lower_path:
        return 'correspondence'
    
    # === FILENAME FALLBACK ===
    if re.search(r'\bvo\b|variation', lower_name): return 'vo'
    if re.search(r'\bmom\b|minute.?of.?meeting', lower_name): return 'mom'
    if re.search(r'\brfi\b', lower_name): return 'rfi'
    if re.search(r'invoice|inv[-_]\d', lower_name): return 'invoice'
    if re.search(r'submittal', lower_name): return 'submittal'
    if re.search(r'report', lower_name): return 'report'
    if re.search(r'أمر.?شراء|عرض.?سعر|purchase|quotation|po[-_]', lower_name): return 'procurement'
    
    return 'other'


def detect_email_type(subject, body=''):
    """Detect email document type from subject and body"""
    text = f"{subject} {body}".lower()
    
    if re.search(r'\brfi\b|request.?for.?information', text): return 'rfi'
    if re.search(r'approv|موافقة', text): return 'approval'
    if re.search(r'shop.?draw|شوب', text): return 'shop_drawing'
    if re.search(r'submittal|تقديم', text): return 'submittal'
    if re.search(r'\bvo\b|variation|فارييشن', text): return 'vo'
    if re.search(r'invoice|فاتورة|inv[-_]\d', text): return 'invoice'
    if re.search(r'أمر.?شراء|عرض.?سعر|purchase|quotation|po[-_]|procurement', text): return 'procurement'
    if re.search(r'mom|minute|محضر|اجتماع', text): return 'mom'
    if re.search(r'report|تقرير', text): return 'report'
    
    return 'correspondence'


def get_document_priority(filename, path):
    """Get priority score for document ranking"""
    doc_type = detect_document_type(filename, path)
    base_priority = DOCUMENT_HIERARCHY.get(doc_type, DOCUMENT_HIERARCHY['other'])['priority']
    
    rev_match = re.search(r'rev[._-]?(\d+)|r(\d+)', filename.lower())
    if rev_match:
        rev_num = int(rev_match.group(1) or rev_match.group(2))
        base_priority += min(rev_num * 2, 10)
    
    if 'final' in filename.lower() or 'approved' in filename.lower():
        base_priority += 15
    
    return base_priority, doc_type


def extract_revision(filename):
    """Extract revision number from filename"""
    lower = filename.lower()
    patterns = [
        r'rev[._\-\s]?(\d+)',
        r'revision[._\-\s]?(\d+)',
        r'\br(\d+)\b',
        r'_r(\d+)_',
        r'-r(\d+)-',
        r'v(\d+)(?:\.\d+)?(?:[_\-\s]|$)',
    ]
    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            rev_num = int(match.group(1))
            return rev_num, f"Rev {str(rev_num).zfill(2)}"
    return 0, None


def extract_subject(filename, path):
    """Extract subject/category from filename and path"""
    lower = filename.lower()
    lower_path = path.lower()
    
    # Folder-based detection
    if '10.architecture' in lower_path or '/architecture/' in lower_path: return 'architectural'
    if '20.electrical' in lower_path or '/electrical/' in lower_path: return 'electrical'
    if '30.air conditioning' in lower_path or '/ac/' in lower_path or 'hvac' in lower_path: return 'mechanical'
    if '40.fire fighting' in lower_path or '/fire' in lower_path: return 'fire'
    if '50.plumbing' in lower_path or '/plumbing/' in lower_path: return 'plumbing'
    if '01.interior' in lower_path: return 'interior'
    if '04.lighting' in lower_path: return 'lighting'
    if '08.floor' in lower_path: return 'flooring'
    if '09.door' in lower_path: return 'door'
    if 'mep' in lower_path or 'x0.mep' in lower_path: return 'mep'
    
    # Keyword-based detection
    subjects = {
        'flooring': ['floor', 'tile', 'carpet', 'vinyl', 'marble', 'granite', 'porcelain'],
        'kitchen': ['kitchen', 'ktc', 'pantry'],
        'bathroom': ['bathroom', 'bath', 'toilet', 'wc', 'lavatory', 'washroom'],
        'ceiling': ['ceiling', 'clg', 'gypsum', 'soffit', 'bulkhead', 'rcp'],
        'wall': ['wall', 'partition', 'drywall', 'cladding'],
        'door': ['door', 'entrance', 'gate', 'shutter'],
        'window': ['window', 'glazing', 'curtain wall', 'facade', 'shop front'],
        'electrical': ['electrical', 'elec', 'lighting', 'power', 'small power', 'db', 'panel'],
        'mechanical': ['mechanical', 'mech', 'hvac', 'ac', 'ahu', 'fcu', 'duct', 'diffuser', 'grill'],
        'plumbing': ['plumbing', 'plumb', 'drainage', 'sanitary', 'water', 'pipe'],
        'fire': ['fire', 'sprinkler', 'smoke', 'alarm', 'firefighting'],
        'furniture': ['furniture', 'furn', 'joinery', 'millwork', 'casework', 'carpentry'],
        'signage': ['signage', 'sign', 'wayfinding', 'graphics'],
        'architectural': ['layout', 'plan', 'elevation', 'section', 'setting out', 'construction'],
    }
    
    for subject, keywords in subjects.items():
        for kw in keywords:
            if kw in lower or kw in lower_path:
                return subject
    
    code_match = re.search(r'-([aempf])-', lower)
    if code_match:
        code_map = {'a': 'architectural', 'e': 'electrical', 'm': 'mechanical', 'p': 'plumbing', 'f': 'fire'}
        if code_match.group(1) in code_map:
            return code_map[code_match.group(1)]
    
    return 'general'


def is_valid_document(filename):
    """Check if file is a valid document (not font, template, etc.)"""
    lower = filename.lower()
    ext = os.path.splitext(lower)[1]
    valid_ext = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'}
    if ext not in valid_ext:
        return False
    
    skip_patterns = [
        'font', 'arial', 'calibri', 'times', 'helvetica', 
        'template', 'blank', 'empty', 'backup', 'copy of', 
        'old_', '~$', 'desktop.ini', 'thumbs.db', '.ds_store'
    ]
    for pattern in skip_patterns:
        if pattern in lower:
            return False
    return True


def is_approved_folder(path):
    """Check if file is in an approved folder (supports both old and new structures)"""
    lower_path = path.lower()
    
    if '/approved/' in lower_path or '/approved' in lower_path:
        return True
    if '05-approved' in lower_path:
        return True
    if '04.shop-drawings' in lower_path and '/approved' in lower_path:
        return True
    if '07.submittals/approved' in lower_path:
        return True
    
    return False


def is_email_folder(path):
    """Check if path is in an email/correspondence folder"""
    lower_path = path.lower()
    if '09-correspondence/' in lower_path or '09.correspondence/' in lower_path:
        return True
    if '01.correspondence/' in lower_path:
        return True
    return False
