# Revision Parser - Extract revision numbers and sort documents
# Handles: Rev 01, Rev A, V1, R01, dates in filenames

import re
from datetime import datetime


def extract_revision_score(filename):
    """Extract revision number from filename and return a sortable score.
    Higher score = newer revision.
    
    Patterns supported:
    - Rev 01, Rev 1, Rev A, Rev B, REV01, R01, R1
    - V1, V01, Version 1
    - _01, _02 at end of filename
    - Date patterns: 2024-01-15, 15-01-2024, 20240115
    """
    if not filename:
        return 0
    
    name_upper = filename.upper()
    score = 0
    
    # Pattern 1: Rev XX or REV XX or R XX (numeric)
    rev_num = re.search(r'REV[_\s\-\.]*(\d+)', name_upper)
    if rev_num:
        score = int(rev_num.group(1)) * 100
        return score
    
    # Pattern 2: R01, R1 (standalone revision)
    r_num = re.search(r'[_\-\s]R(\d+)[_\-\s\.]', name_upper)
    if r_num:
        score = int(r_num.group(1)) * 100
        return score
    
    # Pattern 3: Rev A, Rev B (letter revisions)
    rev_letter = re.search(r'REV[_\s\-\.]*([A-Z])', name_upper)
    if rev_letter:
        # A=1, B=2, etc.
        score = (ord(rev_letter.group(1)) - ord('A') + 1) * 10
        return score
    
    # Pattern 4: V1, V01, Version 1
    version = re.search(r'V(?:ERSION)?[_\s\-\.]*(\d+)', name_upper)
    if version:
        score = int(version.group(1)) * 100
        return score
    
    # Pattern 5: _01, _02 suffix before extension
    suffix_num = re.search(r'[_\-](\d{2,3})(?:\.[a-zA-Z]+)?$', filename)
    if suffix_num:
        score = int(suffix_num.group(1))
        return score
    
    return score


def extract_date_score(filename):
    """Extract date from filename and return timestamp score.
    Higher score = more recent date.
    
    Patterns:
    - 2024-01-15, 2024_01_15
    - 15-01-2024, 15_01_2024
    - 20240115
    """
    if not filename:
        return 0
    
    # Pattern 1: YYYY-MM-DD or YYYY_MM_DD
    match = re.search(r'(20\d{2})[_\-](\d{2})[_\-](\d{2})', filename)
    if match:
        try:
            dt = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            return int(dt.timestamp())
        except:
            pass
    
    # Pattern 2: DD-MM-YYYY or DD_MM_YYYY
    match = re.search(r'(\d{2})[_\-](\d{2})[_\-](20\d{2})', filename)
    if match:
        try:
            dt = datetime(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            return int(dt.timestamp())
        except:
            pass
    
    # Pattern 3: YYYYMMDD
    match = re.search(r'(20\d{2})(\d{2})(\d{2})', filename)
    if match:
        try:
            dt = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            return int(dt.timestamp())
        except:
            pass
    
    return 0


def get_file_modified_time(storage_client, bucket_name, gcs_path):
    """Get file modification time from GCS metadata"""
    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(gcs_path)
        if blob.exists():
            blob.reload()
            if blob.updated:
                return int(blob.updated.timestamp())
    except Exception as e:
        print(f"Error getting file time: {e}")
    return 0


def sort_results_by_revision(results, storage_client=None, bucket_name=None):
    """Sort search results by revision (latest first).
    
    Priority:
    1. Revision number (Rev 05 > Rev 01)
    2. Date in filename (2024-12-01 > 2024-01-01)
    3. File modification time
    """
    def get_sort_key(doc):
        filename = doc.get('name', '')
        gcs_path = doc.get('gcs_path', '')
        
        # Get scores (higher = newer)
        rev_score = extract_revision_score(filename)
        date_score = extract_date_score(filename)
        
        # Only fetch GCS time if no other indicators and storage client provided
        mod_time = 0
        if rev_score == 0 and date_score == 0 and gcs_path and storage_client and bucket_name:
            mod_time = get_file_modified_time(storage_client, bucket_name, gcs_path)
        
        # Combine scores: revision is most important, then date, then mod time
        # Multiply to ensure proper ordering
        return (rev_score * 1000000000) + (date_score) + (mod_time // 1000)
    
    # Sort descending (highest score = latest revision first)
    return sorted(results, key=get_sort_key, reverse=True)


def get_revision_indicator(filename):
    """Get a display string for the revision (e.g., 'REV05', 'V2')"""
    if not filename:
        return None
    
    name_upper = filename.upper()
    
    # Check for revision patterns
    rev_match = re.search(r'(REV[_\s\-\.]*\d+|REV[_\s\-\.]*[A-Z]|V\d+|R\d+)', name_upper)
    if rev_match:
        return rev_match.group(1)
    
    return None
