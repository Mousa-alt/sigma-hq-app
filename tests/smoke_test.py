#!/usr/bin/env python3
"""
Pre-deployment smoke tests for Sigma HQ backends.
Run this BEFORE deploying to catch breaking changes.

Usage:
    python tests/smoke_test.py [--local]
    
    --local: Test against localhost:8080 instead of production
"""

import sys
import json
import requests
from typing import Tuple, List

# Production URLs
SYNC_WORKER_URL = "https://sigma-sync-worker-71025980302.europe-west1.run.app"
WHATSAPP_WEBHOOK_URL = "https://sigma-whatsapp-71025980302.europe-west1.run.app"
EMAIL_SYNC_URL = "https://sigma-email-sync-71025980302.europe-west1.run.app"

# Test project name (must exist in GCS)
TEST_PROJECT = "Amin_Fattouh"


def test_endpoint(name: str, method: str, url: str, json_data: dict = None, 
                  expected_keys: List[str] = None) -> Tuple[bool, str]:
    """Test a single endpoint and return (success, message)"""
    try:
        if method == "GET":
            resp = requests.get(url, timeout=30)
        else:
            resp = requests.post(url, json=json_data, timeout=30)
        
        if resp.status_code != 200:
            return False, f"HTTP {resp.status_code}: {resp.text[:100]}"
        
        data = resp.json()
        
        if expected_keys:
            missing = [k for k in expected_keys if k not in data]
            if missing:
                return False, f"Missing keys: {missing}"
        
        return True, "OK"
    except requests.exceptions.Timeout:
        return False, "Timeout"
    except requests.exceptions.ConnectionError:
        return False, "Connection failed"
    except Exception as e:
        return False, str(e)


def run_tests(base_url: str = None) -> bool:
    """Run all smoke tests. Returns True if all pass."""
    
    sync_url = base_url or SYNC_WORKER_URL
    
    tests = [
        # Health checks
        ("Sync Worker Health", "GET", f"{sync_url}/", None, ["status"]),
        ("WhatsApp Health", "GET", f"{WHATSAPP_WEBHOOK_URL}/", None, ["status"]),
        
        # Critical Vault endpoints - MUST support POST with projectName
        ("Files endpoint (POST)", "POST", f"{sync_url}/files", 
         {"projectName": TEST_PROJECT, "folderPath": ""}, ["files"]),
        
        ("Latest endpoint (POST)", "POST", f"{sync_url}/latest",
         {"projectName": TEST_PROJECT}, ["approved", "recent"]),
        
        # WhatsApp endpoints
        ("WAHA Groups", "GET", f"{WHATSAPP_WEBHOOK_URL}/waha/groups", None, ["groups"]),
        ("WAHA Session", "GET", f"{WHATSAPP_WEBHOOK_URL}/waha/session", None, ["connected"]),
    ]
    
    print("\n" + "="*60)
    print("SIGMA HQ SMOKE TESTS")
    print("="*60 + "\n")
    
    all_passed = True
    
    for name, method, url, json_data, expected_keys in tests:
        success, message = test_endpoint(name, method, url, json_data, expected_keys)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name}")
        if not success:
            print(f"       └── {message}")
            all_passed = False
    
    print("\n" + "="*60)
    if all_passed:
        print("ALL TESTS PASSED - Safe to deploy")
    else:
        print("TESTS FAILED - DO NOT DEPLOY")
    print("="*60 + "\n")
    
    return all_passed


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
