#!/usr/bin/env python3
"""
Smoke tests for STAGED deployment.
Tests the new revision BEFORE traffic is routed to it.
If these tests fail, the deployment is rolled back automatically.

Usage:
    python tests/smoke_test_staged.py <STAGED_URL>
"""

import sys
import json
import requests
from typing import Tuple, List, Optional

# Test project name (must exist in GCS)
TEST_PROJECT = "Amin_Fattouh"

# WhatsApp backend (not staged, just health check)
WHATSAPP_WEBHOOK_URL = "https://sigma-whatsapp-71025980302.europe-west1.run.app"


def test_endpoint(
    name: str, 
    method: str, 
    url: str, 
    json_data: dict = None, 
    expected_keys: List[str] = None,
    check_not_empty: str = None
) -> Tuple[bool, str]:
    """Test a single endpoint"""
    try:
        headers = {'Content-Type': 'application/json'}
        
        if method == "GET":
            resp = requests.get(url, timeout=30, headers=headers)
        else:
            resp = requests.post(url, json=json_data, timeout=30, headers=headers)
        
        if resp.status_code != 200:
            return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        
        data = resp.json()
        
        if expected_keys:
            missing = [k for k in expected_keys if k not in data]
            if missing:
                return False, f"Missing keys: {missing}"
        
        if check_not_empty:
            arr = data.get(check_not_empty, [])
            if not arr or len(arr) == 0:
                return False, f"'{check_not_empty}' is empty"
        
        return True, "OK"
    except requests.exceptions.Timeout:
        return False, "Timeout (>30s)"
    except requests.exceptions.ConnectionError as e:
        return False, f"Connection failed"
    except json.JSONDecodeError:
        return False, "Invalid JSON response"
    except Exception as e:
        return False, str(e)


def run_tests(staged_url: str) -> bool:
    """Run smoke tests against staged revision."""
    
    tests = [
        # Health check - verify new version deployed
        ("Health Check", "GET", f"{staged_url}/", None, ["status", "version"], None),
        
        # CRITICAL: These are the exact requests the frontend makes
        # If any of these fail, the Vault will be broken
        
        ("POST /files with projectName", "POST", f"{staged_url}/files", 
         {"projectName": TEST_PROJECT, "folderPath": ""}, 
         ["files"], "files"),
        
        ("POST /files with project", "POST", f"{staged_url}/files", 
         {"project": TEST_PROJECT, "path": ""}, 
         ["files"], None),
        
        ("POST /latest with projectName", "POST", f"{staged_url}/latest",
         {"projectName": TEST_PROJECT}, 
         ["approved", "recent"], None),
        
        # Also verify GET still works (backwards compatibility)
        ("GET /files", "GET", f"{staged_url}/files?project={TEST_PROJECT}", 
         None, ["files"], None),
    ]
    
    print("\n" + "="*70)
    print("STAGED DEPLOYMENT SMOKE TESTS")
    print("="*70)
    print(f"Testing: {staged_url}")
    print(f"Project: {TEST_PROJECT}")
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
        print("\n🚫 BLOCKING DEPLOYMENT - Tests failed!")
        print("The new revision will NOT receive traffic.")
        print("Production remains on the previous working version.\n")
        for name, msg in failures:
            print(f"  ❌ {name}: {msg}")
        return False
    else:
        print("\n✅ All tests passed - safe to route traffic")
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python smoke_test_staged.py <STAGED_URL>")
        print("Example: python smoke_test_staged.py https://test---sigma-sync-worker-xxx.run.app")
        sys.exit(1)
    
    staged_url = sys.argv[1]
    success = run_tests(staged_url)
    sys.exit(0 if success else 1)
