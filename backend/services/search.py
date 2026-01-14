# Search Service - Vertex AI + Firestore Hybrid
import os
from google.cloud import discoveryengine_v1 as discoveryengine
import google.generativeai as genai

# Absolute imports
from config import PROJECT_ID, LOCATION, ENGINE_ID, GEMINI_API_KEY, APP_ID
from clients import GEMINI_ENABLED, firestore_client, FIRESTORE_ENABLED, get_bucket
from utils.document import detect_document_type

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


def search_firestore(query, project_filter=None, doc_type_filter=None, limit=10):
    """Search documents in Firestore as fallback"""
    if not FIRESTORE_ENABLED or not firestore_client:
        return []
    
    try:
        docs_ref = firestore_client.collection('artifacts').document(APP_ID)\
            .collection('public').document('data').collection('documents')
        
        # Build query
        db_query = docs_ref
        
        if project_filter:
            db_query = db_query.where('project', '==', project_filter)
        
        if doc_type_filter:
            db_query = db_query.where('type', '==', doc_type_filter)
        
        # Limit results
        db_query = db_query.limit(limit * 3)  # Get more to filter
        
        docs = db_query.stream()
        results = []
        query_lower = query.lower()
        query_words = query_lower.split()
        
        for doc in docs:
            data = doc.to_dict()
            filename = data.get('filename', '')
            path = data.get('path', '')
            subject = data.get('subject', '')
            
            # Simple text matching
            search_text = f"{filename} {path} {subject}".lower()
            
            # Score based on word matches
            score = sum(1 for word in query_words if word in search_text)
            
            if score > 0:
                doc_type = data.get('type', 'other')
                results.append({
                    'id': doc.id,
                    'title': filename,
                    'snippets': [f"Project: {data.get('project', '')} | {subject}"],
                    'link': path,
                    'docType': doc_type,
                    'docTypeLabel': DOC_TYPE_LABELS.get(doc_type, 'Document'),
                    'priority': 0,
                    'project': data.get('project', ''),
                    'score': score
                })
        
        # Sort by score and return top results
        results.sort(key=lambda x: -x.get('score', 0))
        return results[:limit]
    
    except Exception as e:
        print(f"Firestore search error: {e}")
        import traceback
        traceback.print_exc()
        return []


def search_gcs(query, project_filter=None, limit=10):
    """Search GCS bucket for documents matching query"""
    try:
        bucket = get_bucket()
        prefix = f"{project_filter}/" if project_filter else ""
        
        blobs = bucket.list_blobs(prefix=prefix)
        results = []
        query_lower = query.lower()
        query_words = query_lower.split()
        
        for blob in blobs:
            if blob.name.endswith('/'):
                continue
            
            filename = blob.name.split('/')[-1]
            path = blob.name
            
            # Simple text matching
            search_text = f"{filename} {path}".lower()
            
            # Score based on word matches
            score = sum(1 for word in query_words if word in search_text)
            
            if score > 0:
                doc_type = detect_document_type(filename, path)
                project = path.split('/')[0] if '/' in path else ''
                
                results.append({
                    'id': blob.id or blob.name,
                    'title': filename,
                    'snippets': [f"Path: {path}"],
                    'link': path,
                    'docType': doc_type,
                    'docTypeLabel': DOC_TYPE_LABELS.get(doc_type, 'Document'),
                    'priority': 0,
                    'project': project,
                    'score': score
                })
            
            # Stop after checking enough files
            if len(results) >= limit * 10:
                break
        
        # Sort by score and return top results
        results.sort(key=lambda x: -x.get('score', 0))
        return results[:limit]
    
    except Exception as e:
        print(f"GCS search error: {e}")
        import traceback
        traceback.print_exc()
        return []


def search_documents(query, project_filter=None, doc_type_filter=None, page_size=10):
    """Search documents - tries Vertex AI first, falls back to Firestore/GCS"""
    
    # Try Vertex AI Search first
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
                    if hasattr(value, 'string_value'):
                        data[key] = value.string_value
                    elif hasattr(value, 'number_value'):
                        data[key] = value.number_value
                    else:
                        data[key] = str(value)
            
            doc_type = data.get('type', 'other')
            snippet_text = data.get('snippet', '')
            title = data.get('title', '')
            path = data.get('path', '')
            
            results.append({
                'id': doc.id,
                'title': title or doc.id,
                'snippets': [snippet_text] if snippet_text else [],
                'link': path,
                'docType': doc_type,
                'docTypeLabel': DOC_TYPE_LABELS.get(doc_type, 'Document'),
                'priority': int(data.get('priority', 0)) if data.get('priority') else 0,
                'project': data.get('project', '')
            })
        
        # Check if Vertex AI returned useful results (with metadata)
        has_useful_results = any(r.get('title') and r.get('title') != r.get('id') for r in results)
        
        if results and has_useful_results:
            return results
        
    except Exception as e:
        print(f'Vertex AI Search error: {e}')
        import traceback
        traceback.print_exc()
    
    # Fallback to Firestore search
    print("Falling back to Firestore search...")
    firestore_results = search_firestore(query, project_filter, doc_type_filter, page_size)
    if firestore_results:
        return firestore_results
    
    # Final fallback to GCS direct search
    print("Falling back to GCS search...")
    return search_gcs(query, project_filter, page_size)


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
            project = doc.get('project', '')
            context += f"{i}. [{doc_type}] {title}"
            if project:
                context += f" (Project: {project})"
            context += "\n"
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
