# Search Service - Vertex AI + Gemini RAG (v7.5)
# Fixed: Removed broken filter, using path-based post-filtering for projects
import os
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

# Absolute imports
from config import PROJECT_ID, LOCATION, ENGINE_ID, GEMINI_API_KEY, GCS_BUCKET
from clients import GEMINI_ENABLED

# Document type labels for display
DOC_TYPE_LABELS = {
    'cvi': 'CVI',
    'vo': 'Variation Order',
    'approval': 'Approval',
    'shop_drawing': 'Shop Drawing',
    'rfi': 'RFI',
    'mom': 'Meeting Minutes',
    'submittal': 'Submittal',
    'specification': 'Specification',
    'boq': 'BOQ',
    'contract': 'Contract',
    'correspondence': 'Correspondence',
    'report': 'Report',
    'drawing': 'Drawing',
    'invoice': 'Invoice',
    'other': 'Document'
}


def search_documents(query, project_filter=None, doc_type_filter=None, page_size=20):
    """
    Search documents using Vertex AI Search.
    
    Since the datastore is unstructured (Cloud Storage), we cannot filter by metadata fields.
    Instead, we fetch more results and post-filter by GCS path prefix.
    
    Args:
        query: Search query string
        project_filter: GCS folder name (e.g., 'Agora-GEM') to filter results
        doc_type_filter: Document type to filter (post-filter)
        page_size: Number of results to fetch (increased for post-filtering)
    """
    client = discoveryengine.SearchServiceClient()
    serving_config = f'projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_config'
    
    # Fetch more results if we need to post-filter by project
    fetch_size = page_size * 3 if project_filter else page_size
    
    # Note: Unstructured Cloud Storage datastores don't support metadata filtering
    # We'll post-filter by URI path instead
    request = discoveryengine.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=min(fetch_size, 50)  # Cap at 50 to avoid slow responses
    )
    
    try:
        response = client.search(request)
        results = []
        
        # Build the expected path prefix for filtering
        # Documents are stored as: gs://sigma-docs-repository/Agora-GEM/...
        path_prefix = f"gs://{GCS_BUCKET}/{project_filter}/" if project_filter else None
        
        for result in response.results:
            doc = result.document
            
            # Get document URI from derivedStructData or name
            doc_uri = ''
            if doc.derived_struct_data:
                for key, value in doc.derived_struct_data.fields.items():
                    if key == 'link' or key == 'uri':
                        doc_uri = value.string_value if hasattr(value, 'string_value') else str(value)
                        break
            
            # Fallback to document name/id if no URI found
            if not doc_uri:
                doc_uri = doc.name or doc.id or ''
            
            # Post-filter by project path
            if path_prefix and not doc_uri.startswith(path_prefix):
                continue
            
            # Extract metadata from struct_data
            data = {}
            if doc.struct_data:
                for key, value in doc.struct_data.fields.items():
                    if hasattr(value, 'string_value'):
                        data[key] = value.string_value
                    elif hasattr(value, 'number_value'):
                        data[key] = value.number_value
                    else:
                        data[key] = str(value)
            
            # Also check derived_struct_data for additional fields
            if doc.derived_struct_data:
                for key, value in doc.derived_struct_data.fields.items():
                    if key not in data:
                        if hasattr(value, 'string_value'):
                            data[key] = value.string_value
                        elif hasattr(value, 'number_value'):
                            data[key] = value.number_value
            
            # Detect document type from path
            doc_type = detect_doc_type_from_path(doc_uri)
            
            # Post-filter by document type if specified
            if doc_type_filter and doc_type != doc_type_filter:
                continue
            
            # Extract title from path
            title = extract_title_from_uri(doc_uri)
            
            # Get snippet/extractive answer
            snippet = data.get('snippet', data.get('extractive_segment', ''))
            
            results.append({
                'id': doc.id,
                'title': title,
                'snippets': [snippet] if snippet else [doc_uri],
                'link': doc_uri,
                'docType': doc_type,
                'docTypeLabel': DOC_TYPE_LABELS.get(doc_type, 'Document'),
                'priority': calculate_priority(doc_uri, doc_type),
                'project': extract_project_from_uri(doc_uri)
            })
            
            # Stop once we have enough results
            if len(results) >= page_size:
                break
        
        return results
        
    except Exception as e:
        print(f'Search error: {e}')
        import traceback
        traceback.print_exc()
        return []


def detect_doc_type_from_path(path):
    """Detect document type from GCS path"""
    path_lower = path.lower()
    
    # Check folder patterns
    if 'shop-drawing' in path_lower or 'shop_drawing' in path_lower or '04-shop' in path_lower or '04.shop' in path_lower:
        return 'shop_drawing'
    if 'submittal' in path_lower or '07.submittal' in path_lower:
        return 'submittal'
    if 'correspondence' in path_lower or '01.correspondence' in path_lower or '09-correspondence' in path_lower:
        return 'correspondence'
    if 'mom' in path_lower or 'meeting' in path_lower or '08.reports' in path_lower:
        return 'mom'
    if 'invoice' in path_lower or '09.invoice' in path_lower:
        return 'invoice'
    if 'boq' in path_lower or '05.contract' in path_lower:
        return 'boq'
    if 'rfi' in path_lower:
        return 'rfi'
    if 'drawing' in path_lower or 'design' in path_lower or '02.design' in path_lower or '03.design' in path_lower:
        return 'drawing'
    if 'specification' in path_lower or 'spec' in path_lower:
        return 'specification'
    if 'approval' in path_lower or 'approved' in path_lower:
        return 'approval'
    if 'cvi' in path_lower:
        return 'cvi'
    if 'vo' in path_lower or 'variation' in path_lower:
        return 'vo'
    if 'report' in path_lower:
        return 'report'
    if 'contract' in path_lower:
        return 'contract'
    
    return 'other'


def extract_title_from_uri(uri):
    """Extract readable title from GCS URI"""
    if not uri:
        return 'Unknown Document'
    
    # Remove gs://bucket/ prefix
    path = uri.replace(f'gs://{GCS_BUCKET}/', '')
    
    # Get filename (last part)
    parts = path.split('/')
    filename = parts[-1] if parts else path
    
    # Clean up filename
    # Remove extension
    if '.' in filename:
        filename = filename.rsplit('.', 1)[0]
    
    # Replace underscores/hyphens with spaces
    filename = filename.replace('_', ' ').replace('-', ' ')
    
    return filename or 'Document'


def extract_project_from_uri(uri):
    """Extract project folder name from GCS URI"""
    if not uri:
        return ''
    
    # Remove gs://bucket/ prefix
    path = uri.replace(f'gs://{GCS_BUCKET}/', '')
    
    # Get first folder (project name)
    parts = path.split('/')
    return parts[0] if parts else ''


def calculate_priority(path, doc_type):
    """Calculate document priority for sorting"""
    priority = 0
    path_lower = path.lower()
    
    # Approved documents get highest priority
    if 'approved' in path_lower:
        priority += 100
    
    # By document type
    type_priorities = {
        'approval': 90,
        'shop_drawing': 80,
        'submittal': 70,
        'specification': 60,
        'drawing': 50,
        'mom': 40,
        'correspondence': 30,
        'invoice': 20,
        'report': 10
    }
    priority += type_priorities.get(doc_type, 0)
    
    return priority


def generate_summary(query, docs):
    """
    Generate intelligent, structured AI summary using Gemini.
    This is the brain of the RAG system - produces organized, actionable answers.
    """
    if not GEMINI_ENABLED or not GEMINI_API_KEY:
        return None
    
    if not docs:
        return "No documents found matching your query. Try different keywords or check if documents have been synced."
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Build rich context from documents
        context_parts = []
        for i, doc in enumerate(docs[:10], 1):
            title = doc.get('title', 'Unknown')
            snippets = doc.get('snippets', [])
            snippet = snippets[0] if snippets else ''
            doc_type = doc.get('docTypeLabel', 'Document')
            path = doc.get('link', '')
            
            # Extract location hints from path
            location_hints = []
            path_lower = path.lower()
            if 'kitchen' in path_lower:
                location_hints.append('Kitchen')
            if 'bathroom' in path_lower or 'wc' in path_lower:
                location_hints.append('Bathroom')
            if 'lobby' in path_lower:
                location_hints.append('Lobby')
            if 'corridor' in path_lower:
                location_hints.append('Corridor')
            if 'dining' in path_lower:
                location_hints.append('Dining')
            if 'bedroom' in path_lower:
                location_hints.append('Bedroom')
            if 'living' in path_lower:
                location_hints.append('Living Room')
            if 'approved' in path_lower:
                location_hints.append('APPROVED')
            
            location_str = f" [{', '.join(location_hints)}]" if location_hints else ""
            
            context_parts.append(f"""
Document {i}: {title}
Type: {doc_type}{location_str}
Path: {path}
Content: {snippet[:500] if snippet else 'No preview available'}
""")
        
        context = "\n".join(context_parts)
        
        # Sophisticated prompt engineering for structured output
        prompt = f"""You are an expert Technical Office AI Assistant for Sigma Contractors, a professional construction and fit-out company. Your role is to analyze project documents and provide clear, actionable intelligence to engineers.

## USER QUESTION
{query}

## AVAILABLE DOCUMENTS
{context}

## YOUR TASK
Analyze the documents above and provide a comprehensive, well-structured answer. Follow these guidelines:

### Response Structure
1. **Direct Answer First**: Start with a clear, direct answer to the question
2. **Organize by Category**: If multiple items exist (e.g., different areas, types), organize them clearly:
   - By Location (Kitchen, Bathroom, Lobby, etc.)
   - By Status (Approved, Pending, Rejected)
   - By Type (Shop Drawing, Submittal, Specification)
3. **Include Key Details**: For each item mention:
   - Document name/reference
   - Approval status if known
   - Relevant specifications or notes

### Formatting Rules
- Use **bold** for important terms, approvals, and document names
- Use bullet points for lists
- Keep paragraphs short and scannable
- If information is not found in the documents, clearly state that

### Example Format for Material Questions
"Based on the project documents:

**Kitchen Area:**
- Material: [Name] - [Status]
- Reference: [Document name]

**Bathroom Area:**
- Material: [Name] - [Status]
- Reference: [Document name]"

### Important
- Only include information found in the provided documents
- If no relevant information exists, say "No information found for [topic] in the current documents"
- Be specific about document references so users can locate them
- Highlight any approved items prominently

Now provide your structured response:"""

        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f'Gemini summary error: {e}')
        import traceback
        traceback.print_exc()
        return f"AI analysis temporarily unavailable. Found {len(docs)} relevant documents - please review them directly."


def search_with_ai(query, context_docs=None):
    """AI-powered search with Gemini (legacy endpoint)"""
    if not GEMINI_ENABLED:
        return {'error': 'Gemini not configured. Please set GEMINI_API_KEY environment variable.'}
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        prompt = f"""You are a technical office assistant for Sigma Contractors.
Answer the following question based on the project documents.

Question: {query}

"""
        if context_docs:
            prompt += "Context documents:\n"
            for doc in context_docs[:5]:
                title = doc.get('title', 'Document')
                snippets = doc.get('snippets', [''])
                snippet = snippets[0] if snippets else ''
                prompt += f"- {title}: {snippet}\n"
        
        response = model.generate_content(prompt)
        return {
            'answer': response.text,
            'sources': context_docs[:5] if context_docs else []
        }
    except Exception as e:
        return {'error': str(e)}
