#!/usr/bin/env python3
"""
Automatic smoke tests for Sigma HQ backends.
These run AFTER every Cloud Build deployment.
If tests fail, the build fails and alerts are sent.

Tests verify:
1. All backend services are responding
2. Critical endpoints work with the exact parameters frontend sends
3. Data is actually being returned (not empty responses)
"""

import sys
import json
import requests
from typing import Tuple, List, Optional

# Production URLs
SYNC_WORKER_URL = "https://sigma-sync-worker-71025980302.europe-west1.run.app"
WHATSAPP_WEBHOOK_URL = "https://sigma-whatsapp-71025980302.europe-west1.run.app"
EMAIL_SYNC_URL = "https://sigma-email-sync-71025980302.europe-west1.run.app"

# Test project name (must exist in GCS)
TEST_PROJECT = "Amin_Fattouh"


def test_endpoint(
    name: str, 
    method: str, 
    url: str, 
    json_data: dict = None, 
    expected_keys: List[str] = None,
    check_not_empty: str = None  # Key that should have non-empty array
) -> Tuple[bool, str]:
    """Test a single endpoint and return (success, message)"""
    try:
        if method == "GET":
            resp = requests.get(url, timeout=30)
        else:
            resp = requests.post(url, json=json_data, timeout=30)
        
        if resp.status_code != 200:
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        
        data = resp.json()
        
        # Check required keys exist
        if expected_keys:
            missing = [k for k in expected_keys if k not in data]
            if missing:
                return False, f"Missing keys: {missing}"
        
        # Check that specified array is not empty
        if check_not_empty:
            arr = data.get(check_not_empty, [])
            if not arr or len(arr) == 0:
                return False, f"'{check_not_empty}' is empty - no data returned"
        
        return True, "OK"
    except requests.exceptions.Timeout:
        return False, "Timeout (>30s)"
    except requests.exceptions.ConnectionError as e:
        return False, f"Connection failed: {e}"
    except json.JSONDecodeError:
        return False, "Invalid JSON response"
    except Exception as e:
        return False, str(e)


def run_tests(base_url: str = None) -> bool:
    """Run all smoke tests. Returns True if all pass."""
    
    sync_url = base_url or SYNC_WORKER_URL
    
    tests = [
        # === SYNC WORKER BACKEND ===
        
        # Health check with version
        ("Sync Worker Health", "GET", f"{sync_url}/", None, ["status", "version"], None),
        
        # CRITICAL: Vault /files endpoint - Frontend sends POST with projectName
        # This is exactly what broke on 2026-01-13
        ("Vault /files (POST + projectName)", "POST", f"{sync_url}/files", 
         {"projectName": TEST_PROJECT, "folderPath": ""}, 
         ["files"], "files"),  # Must return non-empty files array
        
        # CRITICAL: Vault /latest endpoint - Frontend sends POST with projectName
        ("Vault /latest (POST + projectName)", "POST", f"{sync_url}/latest",
         {"projectName": TEST_PROJECT}, 
         ["approved", "recent"], None),
        
        # Also test with 'project' parameter (alternative name)
        ("Vault /files (POST + project)", "POST", f"{sync_url}/files", 
         {"project": TEST_PROJECT, "path": ""}, 
         ["files"], None),
        
        # === WHATSAPP BACKEND ===
        
        ("WhatsApp Health", "GET", f"{WHATSAPP_WEBHOOK_URL}/", None, ["status", "version"], None),
        
        ("WhatsApp Groups List", "GET", f"{WHATSAPP_WEBHOOK_URL}/waha/groups", 
         None, ["groups"], None),
        
        ("WhatsApp Session Status", "GET", f"{WHATSAPP_WEBHOOK_URL}/waha/session", 
         None, ["connected"], None),
    ]
    
    print("\n" + "="*70)
    print("SIGMA HQ POST-DEPLOYMENT SMOKE TESTS")
    print("="*70)
    print(f"Sync Worker: {sync_url}")
    print(f"WhatsApp:    {WHATSAPP_WEBHOOK_URL}")
    print(f"Test Project: {TEST_PROJECT}")
    print("="*70 + "\n")
    
    passed = 0
    failed = 0
    failures = []
    
    for name, method, url, json_data, expected_keys, check_not_empty in tests:
        success, message = test_endpoint(name, method, url, json_data, expected_keys, check_not_empty)
        
        if success:
            print(f"✅ PASS | {name}")
            passed += 1
        else:
            print(f"❌ FAIL | {name}")
            print(f"         └── {message}")
            failed += 1
            failures.append((name, message))
    
    print("\n" + "="*70)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("="*70)
    
    if failed > 0:
        print("\n⚠️  DEPLOYMENT MAY HAVE BROKEN FUNCTIONALITY!")
        print("Failed tests:")
        for name, msg in failures:
            print(f"  • {name}: {msg}")
        print("\nCheck the code changes and fix immediately.")
        print("="*70 + "\n")
        return False
    else:
        print("\n✅ All critical endpoints working correctly.")
        print("="*70 + "\n")
        return True


if __name__ == "__main__":
    local_mode = "--local" in sys.argv
    
    if local_mode:
        print("Testing against localhost:8080...")
        base_url = "http://localhost:8080"
    else:
        print("Testing against production...")
        base_url = None
    
    success = run_tests(base_url)
    sys.exit(0 if success else 1)
