# Vertex AI Search - Document search using Discovery Engine

from google.cloud import discoveryengine_v1 as discoveryengine
from google.cloud import storage

from config import GCP_PROJECT, GCS_BUCKET, VERTEX_LOCATION, ENGINE_ID
from utils.revision_parser import sort_results_by_revision

# Initialize storage client for revision sorting
storage_client = storage.Client()


def search_documents(query, project_name=None, limit=10):
    """Search for documents using Vertex AI Search (Discovery Engine)
    
    Results are sorted by revision/date (latest first)
    
    Args:
        query: Search query string
        project_name: Optional project name to filter results
        limit: Maximum number of results to return
    
    Returns:
        list: List of document dictionaries with name, path, gcs_path, etc.
    """
    results = []
    
    try:
        client = discoveryengine.SearchServiceClient()
        serving_config = f"projects/{GCP_PROJECT}/locations/{VERTEX_LOCATION}/collections/default_collection/engines/{ENGINE_ID}/servingConfigs/default_search"
        
        # Add project name to query if specified
        search_query = f"{query} {project_name}" if project_name else query
        
        # Fetch more results than needed for post-filtering and sorting
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=search_query,
            page_size=limit * 2,  # Get extra for filtering
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                    return_snippet=True,
                    max_snippet_count=1
                ),
            ),
        )
        
        response = client.search(request)
        
        for result in response.results:
            doc = result.document
            doc_data = {
                'name': '',
                'path': '',
                'gcs_path': '',
                'project': '',
                'drive_id': '',
                'drive_link': '',
                'snippets': []
            }
            
            if doc.derived_struct_data:
                struct = dict(doc.derived_struct_data)
                link = struct.get('link', '')
                title = struct.get('title', '')
                
                # Extract filename from link or title
                if link:
                    doc_data['drive_link'] = link
                    # Extract path parts
                    gcs_path = link.replace('gs://sigma-docs-repository/', '')
                    doc_data['gcs_path'] = gcs_path
                    parts = gcs_path.split('/')
                    if parts:
                        doc_data['name'] = parts[-1] if parts[-1] else title
                        doc_data['path'] = '/'.join(parts[:-1]) if len(parts) > 1 else ''
                        doc_data['project'] = parts[0] if parts else ''
                else:
                    doc_data['name'] = title
                
                # Get snippets
                for snippet in struct.get('snippets', []):
                    if isinstance(snippet, dict) and snippet.get('snippet'):
                        doc_data['snippets'].append(snippet.get('snippet'))
                
                # Filter by project if specified
                if project_name:
                    project_lower = project_name.lower().replace(' ', '_').replace('-', '_')
                    link_lower = link.lower().replace('-', '_')
                    if project_lower not in link_lower:
                        continue
                
                results.append(doc_data)
        
        # Sort by revision/date (latest first)
        results = sort_results_by_revision(results, storage_client, GCS_BUCKET)
        
        # Limit to requested count
        results = results[:limit]
        
        print(f"Vertex AI Search returned {len(results)} results (sorted by revision) for: {search_query}")
        
    except Exception as e:
        print(f"Vertex AI Search error: {e}")
    
    return results


def get_folder_structure(project_name):
    """Get standard folder structure for a project"""
    folders = [
        "00-Project_Info",
        "01-Contract_Documents", 
        "02-Design_Drawings",
        "03-Specifications",
        "04-Quantity_Surveying",
        "05-Correspondence",
        "06-Site_Reports",
        "07-Quality_Control",
        "08-Health_Safety",
        "09-Shop_Drawings",
        "10-Handover"
    ]
    return folders
