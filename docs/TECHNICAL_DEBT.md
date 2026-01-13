# Technical Debt Tracker

Items that work but need proper implementation later.
**Claude should check this before adding more "quick fixes."**

---

## High Priority (Fix Soon)

### TD-001: No Staging Environment
**Added:** 2026-01-13  
**Impact:** High  
**Effort:** Medium

All changes deploy directly to production. One bad push breaks everything.

**Proper Fix:** 
- Create staging Cloud Run services
- Create staging Firestore database
- Test in staging before promoting to production

---

### TD-002: No Automated CI/CD Tests
**Added:** 2026-01-13  
**Impact:** High  
**Effort:** Medium

GitHub Actions workflow exists but needs GCP_SA_KEY secret to be set up.

**Proper Fix:**
1. Add GCP service account key to GitHub Secrets
2. Enable GitHub Actions workflow
3. Block merges if tests fail

---

### TD-003: Firestore Security Rules Not Configured
**Added:** 2026-01-13  
**Impact:** High  
**Effort:** Low

Currently using permissive rules. Need proper authentication.

**Proper Fix:**
- Implement proper auth rules
- Restrict write access to authenticated users

---

## Medium Priority

### TD-004: No Rate Limiting on APIs
**Added:** 2026-01-13  
**Impact:** Medium  
**Effort:** Low

Backend APIs have no rate limiting. Could be abused.

**Proper Fix:**
- Add rate limiting middleware
- Implement API keys for external access

---

### TD-005: Hardcoded URLs in Frontend
**Added:** 2026-01-13  
**Impact:** Medium  
**Effort:** Low

Backend URLs are in config.js. Should use environment variables.

**Proper Fix:**
- Use Vercel environment variables
- Different URLs for staging/production

---

### TD-006: No Error Tracking
**Added:** 2026-01-13  
**Impact:** Medium  
**Effort:** Medium

No Sentry or similar for frontend error tracking.

**Proper Fix:**
- Add Sentry to frontend
- Add Cloud Logging structured logs to backend

---

### TD-007: OrgChart Circular Reference Check
**Added:** 2026-01-13  
**Impact:** Medium  
**Effort:** Low

If someone sets circular reporting (A→B→A), app will crash.

**Proper Fix:**
- Add cycle detection in d3.stratify
- Show error message instead of crashing

---

## Low Priority (Nice to Have)

### TD-008: Frontend Bundle Size
**Added:** 2026-01-13  
**Impact:** Low  
**Effort:** Medium

Not optimized for code splitting.

**Proper Fix:**
- Lazy load components
- Split vendor bundles

---

### TD-009: No Database Backup Strategy
**Added:** 2026-01-13  
**Impact:** Low (Firestore has automatic backups)  
**Effort:** Low

Should have scheduled exports to GCS.

**Proper Fix:**
- Set up Firestore scheduled exports
- Document restore procedure

---

### TD-010: WhatsApp Session Persistence
**Added:** 2026-01-13  
**Impact:** Low  
**Effort:** Medium

WAHA session sometimes needs manual restart.

**Proper Fix:**
- Implement session recovery logic
- Auto-reconnect on disconnect

---

## Completed

| ID | Description | Completed | Resolution |
|----|-------------|-----------|------------|
| - | - | - | - |

---

## Rules

1. Don't add more debt without documenting it here
2. Fix high priority items before adding new features
3. Review this list weekly
