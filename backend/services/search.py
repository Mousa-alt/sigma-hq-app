# Search Service - Vertex AI
import os
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

# Absolute imports
from config import PROJECT_ID, LOCATION, ENGINE_ID, GEMINI_API_KEY
from clients import GEMINI_ENABLED

# Document type labels
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
    try:
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
        
        response = client.search(request)
        results = []
        for result in response.results:
            doc = result.document
            data = {}
            if doc.struct_data:
                for key, value in doc.struct_data.fields.items():
                    # Extract the actual value from protobuf Value
                    if hasattr(value, 'string_value'):
                        data[key] = value.string_value
                    elif hasattr(value, 'number_value'):
                        data[key] = value.number_value
                    else:
                        data[key] = str(value)
            
            doc_type = data.get('type', 'other')
            snippet_text = data.get('snippet', '')
            
            results.append({
                'id': doc.id,
                'title': data.get('title', doc.id),
                'snippets': [snippet_text] if snippet_text else [],
                'link': data.get('path', ''),
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
    """Generate AI summary using Gemini"""
    if not GEMINI_ENABLED:
        return None
    
    if not docs:
        return "No documents found matching your query."
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Build context from documents
        context = ""
        for i, doc in enumerate(docs[:5], 1):
            title = doc.get('title', 'Document')
            snippets = doc.get('snippets', [])
            snippet_text = snippets[0] if snippets else ''
            doc_type = doc.get('docTypeLabel', 'Document')
            context += f"{i}. [{doc_type}] {title}\n"
            if snippet_text:
                context += f"   Content: {snippet_text[:300]}...\n"
            context += "\n"
        
        prompt = f"""You are a technical office assistant for Sigma Contractors, a construction company.
Based on the following project documents, answer the user's question concisely and helpfully.

User Question: {query}

Relevant Documents:
{context}

Instructions:
- Answer directly based on the documents
- If documents contain specific approvals, specifications, or details, mention them
- If no relevant information is found, say so
- Be concise but informative
- Format your answer clearly
"""
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f'Gemini error: {e}')
        import traceback
        traceback.print_exc()
        return None


def search_with_ai(query, context_docs=None):
    """AI-powered search with Gemini (legacy function)"""
    if not GEMINI_ENABLED:
        return {'error': 'Gemini not configured'}
    
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
                prompt += f"- {doc.get('title', 'Document')}: {doc.get('snippets', [''])[0]}\n"
        
        response = model.generate_content(prompt)
        return {
            'answer': response.text,
            'sources': context_docs[:5] if context_docs else []
        }
    except Exception as e:
        return {'error': str(e)}
