# Search Service - Vertex AI + Gemini RAG
import os
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

# Absolute imports
from config import PROJECT_ID, LOCATION, ENGINE_ID, GEMINI_API_KEY
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


def search_documents(query, project_filter=None, doc_type_filter=None, page_size=10):
    """Search documents using Vertex AI Search"""
    client = discoveryengine.SearchServiceClient()
    serving_config = f'projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_config'
    
    filter_str = ''
    if project_filter:
        filter_str = f'project: "{project_filter}"'
    if doc_type_filter:
        if filter_str:
            filter_str += ' AND '
        filter_str += f'type: "{doc_type_filter}"'
    
    request = discoveryengine.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=page_size,
        filter=filter_str if filter_str else None
    )
    
    try:
        response = client.search(request)
        results = []
        for result in response.results:
            doc = result.document
            data = {}
            if doc.struct_data:
                for key, value in doc.struct_data.fields.items():
                    # Extract actual value from protobuf
                    if hasattr(value, 'string_value'):
                        data[key] = value.string_value
                    elif hasattr(value, 'number_value'):
                        data[key] = value.number_value
                    else:
                        data[key] = str(value)
            
            doc_type = data.get('type', 'other')
            snippet = data.get('snippet', '')
            path = data.get('path', '')
            
            results.append({
                'id': doc.id,
                'title': data.get('title', doc.id),
                'snippets': [snippet] if snippet else [path],  # Frontend expects array
                'link': path,  # Frontend expects 'link' not 'path'
                'docType': doc_type,
                'docTypeLabel': DOC_TYPE_LABELS.get(doc_type, 'Document'),
                'priority': int(data.get('priority', 0)) if data.get('priority') else 0,
                'project': data.get('project', '')
            })
        return results
    except Exception as e:
        print(f'Search error: {e}')
        import traceback
        traceback.print_exc()
        return []


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
