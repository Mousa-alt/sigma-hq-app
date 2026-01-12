# Search Service - Vertex AI
import os
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

PROJECT_ID = 'sigma-hq-technical-office'
LOCATION = 'global'
ENGINE_ID = 'sigma-search_1767650825639'
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def search_documents(query, project_filter=None, doc_type_filter=None, page_size=10):
    """Search documents using Vertex AI Search"""
    client = discoveryengine.SearchServiceClient()
    serving_config = f'projects/{PROJECT_ID}/locations/{LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_config'
    
    filter_str = ''
    if project_filter:
        filter_str = f'project: "{project_filter}"'
    if doc_type_filter:
        if filter_str: filter_str += ' AND '
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
            data = {f.key: f.value for f in doc.struct_data.fields.items()} if doc.struct_data else {}
            results.append({
                'id': doc.id,
                'title': data.get('title', doc.id),
                'snippet': data.get('snippet', ''),
                'path': data.get('path', ''),
                'type': data.get('type', 'other'),
                'project': data.get('project', '')
            })
        return results
    except Exception as e:
        print(f'Search error: {e}')
        return []

def search_with_ai(query, context_docs=None):
    """AI-powered search with Gemini"""
    if not GEMINI_API_KEY:
        return {'error': 'Gemini not configured'}
    
    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    
    prompt = f"""You are a technical office assistant for Sigma Contractors.
Answer the following question based on the project documents.

Question: {query}

"""
    if context_docs:
        prompt += "Context documents:\n"
        for doc in context_docs[:5]:
            prompt += f"- {doc.get('title', 'Document')}: {doc.get('snippet', '')}\n"
    
    try:
        response = model.generate_content(prompt)
        return {'answer': response.text, 'sources': context_docs[:5] if context_docs else []}
    except Exception as e:
        return {'error': str(e)}
