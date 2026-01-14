# Sigma HQ - Feature Roadmap

**Last Updated:** 2026-01-14  
**Owner:** Mosallam

> This document tracks all planned features. Update when priorities change.

---

## ✅ Recently Completed

| Feature | Date | Notes |
|---------|------|-------|
| Planning Projects in OrgChart | 2026-01-14 | Add future projects for resource planning with 🔮 visual distinction |

---

## 🔥 High Priority (Next Sprint)

### 1. Voice Note Transcription
- **Problem:** Many messages are voice notes, currently unprocessed
- **Solution:** Transcribe voice notes using Whisper API or Google Speech-to-Text
- **Flow:** Voice note received → Transcribe → Classify like text message
- **Status:** Not started

### 2. Sender Identification (Who Said What)
- **Problem:** Don't know who sent WhatsApp messages
- **Solution:** Match phone numbers to `team_members` in Firestore
- **Data:** Phone numbers already being added to organization
- **Why Important:** Managers/executives give tasks - need to identify them
- **Status:** Not started

### 3. Simple Task Creation
- **Problem:** No easy way to create tasks
- **Solution:** 
  - Quick task form in Dashboard
  - Create task from WhatsApp message
  - Create task via voice command
- **Status:** Not started

### 4. WhatsApp Reminders
- **Problem:** Need to be reminded of tasks via WhatsApp
- **Solution:**
  - Send "remind me to call X tomorrow at 10am" to Command Center group
  - Bot sends WhatsApp message back at scheduled time
  - Can reference phone numbers for context
- **Flow:** Message → Parse reminder → Schedule → Send at time
- **Status:** Not started

---

## 🏗️ Organization & Resource Management

### 5. Workload Indicator
- **Location:** OrgChart - all views
- **Problem:** Can't see at a glance if someone is overloaded
- **Solution:** Color-coded badge showing project count per person
  - 🟢 Green: 1-2 projects (available capacity)
  - 🟡 Yellow: 3-4 projects (busy)
  - 🔴 Red: 5+ projects (overloaded)
- **Display:** Badge on person card + column in Team List
- **Status:** Not started

### 6. Promote Planning → Active Project
- **Location:** OrgChart Assignments tab + Planning Project modal
- **Problem:** When a planning project becomes real, need to create it properly
- **Solution:** 
  - "Promote to Active" button on planning projects
  - Opens project creation form pre-filled with planning project data
  - Keeps all existing assignments
  - Optionally deletes the planning project after promotion
- **Flow:** Planning Project → Click Promote → Create Real Project → Keep Assignments
- **Status:** Not started

### 7. "Create Project" Button
- **Location:** Organization page + Overview
- **Problem:** Requested multiple times, not implemented
- **Features:**
  - Create new project from UI
  - Assign team members
  - Set up folder structure in GCS
  - Link to Google Drive folder
- **Status:** NOT STARTED - HIGH PRIORITY

### 8. Group Management for Planning Projects
- **Problem:** Some groups are for projects still in planning
- **Solution:** 
  - Add groups even before project is official
  - Assign people for future projects
  - Track pre-project discussions
- **Status:** Not started

### 9. Project Team → Correspondence Sheet Auto-Fill
- **Problem:** Manual work to fill contact list template
- **Solution:**
  - Select project
  - Select team members assigned
  - Press button → Auto-fill Excel/Google Sheet template
- **Template:** Already exists
- **Status:** Not started

---

## 📁 Document Management (Vault)

### 10. Document Expiry Alerts
- **Location:** Vault + Dashboard notifications
- **Problem:** Critical documents expire (permits, insurance, warranties, licenses)
- **Solution:**
  - Mark documents with expiry date when uploading
  - Dashboard widget showing "Expiring Soon" (30/60/90 days)
  - Color coding: 🔴 Expired, 🟡 <30 days, 🟢 OK
  - Optional: Email/WhatsApp reminder before expiry
- **Document Types:** Permits, Insurance, Warranties, Licenses, Contracts
- **Status:** Not started

### 11. Bulk Upload with Auto-Classification
- **Location:** Vault
- **Problem:** Uploading files one by one is slow
- **Solution:**
  - Drag & drop multiple files
  - AI auto-detects document type (drawing, submittal, correspondence, etc.)
  - Shows preview with suggested classification
  - User confirms or adjusts before upload
- **Tech:** Use existing `detect_document_type()` logic
- **Status:** Not started

### 12. Version Comparison (Drawing Diff)
- **Location:** Vault - when viewing drawings
- **Problem:** Hard to see what changed between revisions
- **Solution:**
  - Select two versions of same drawing
  - Side-by-side comparison view
  - Highlight differences (overlay mode)
  - Works with PDF/images
- **Tech:** PDF.js for rendering, image diff library
- **Status:** Not started

---

## 💬 WhatsApp & Communication

### 13. Message Tagging
- **Location:** WhatsApp Feed / Task Hub
- **Problem:** Messages are just text, no categorization
- **Solution:**
  - Quick-tag buttons: 📋 Action Item | ✅ Decision | ℹ️ Info | ⚠️ Urgent
  - Tags saved to Firestore
  - Filter messages by tag
  - AI can auto-suggest tags
- **Benefit:** Quickly find decisions made, actions needed
- **Status:** Not started

### 14. Daily Digest
- **Location:** Dashboard + Email/WhatsApp
- **Problem:** Too many messages to track manually
- **Solution:**
  - Auto-generated summary of each project's WhatsApp activity
  - Key points: decisions made, tasks assigned, questions raised
  - Sent daily at configurable time (e.g., 6 PM)
  - Delivery: Dashboard widget + optional email/WhatsApp
- **Tech:** Gemini summarization of day's messages per project
- **Status:** Not started

### 15. @Mention Bot in Groups
- **Problem:** Need to interact with bot from any group
- **Solution:** Bot responds when @mentioned
- **Features:**
  - Ask questions
  - Create tasks
  - Get document summaries
- **Like:** @Grok functionality
- **Status:** Not started

---

## 📋 Task System Reimagining

### 16. Multi-Message Task Detection
- **Problem:** A task isn't always one message - it's a conversation thread
- **Solution:** AI detects when topic/task ends and new one starts
- **Challenge:** Group conversations are messy
- **Status:** Not started

### 17. Task Extraction from Manager Messages
- **Problem:** Executives give verbal tasks in groups
- **Example:** "Install the marble next week" → Creates task to:
  - Check if contractor is ready
  - Check if drawings are approved
  - Create sub-tasks if needed
- **Status:** Not started

### 18. "Complete with AI" Button
- **Problem:** Tasks need follow-up actions
- **Solution:** Button beside each task that can:
  - Send an email
  - Create a draft
  - Generate a report
  - Whatever the task requires
- **Status:** Not started

---

## ⚡ Performance & Security

### 19. Redis Caching
- **Problem:** GCS file lists slow as buckets grow
- **Solution:** Redis cache (Google Cloud Memorystore)
- **Benefit:** ~3 seconds → <100ms load times
- **Status:** Not started

### 20. Firebase Authentication + RBAC
- **Problem:** Simple password gate, no role-based access
- **Solution:** Firebase Auth with roles
- **Roles:**
  - Site Engineers: WhatsApp feed, Vault
  - Project Managers: OrgChart, Task Hub
  - Admins: Everything
- **Status:** Not started

---

## 📊 Priority Matrix

| # | Feature | Impact | Effort | Priority |
|---|---------|--------|--------|----------|
| 1 | Voice Transcription | High | Medium | 🔴 P1 |
| 2 | Sender Identification | High | Low | 🔴 P1 |
| 3 | Simple Task Creation | High | Medium | 🔴 P1 |
| 4 | WhatsApp Reminders | High | Medium | 🔴 P1 |
| 7 | Create Project Button | High | Low | 🔴 P1 |
| 5 | Workload Indicator | Medium | Low | 🟡 P2 |
| 6 | Promote Planning → Active | Medium | Low | 🟡 P2 |
| 10 | Document Expiry Alerts | High | Medium | 🟡 P2 |
| 13 | Message Tagging | Medium | Low | 🟡 P2 |
| 14 | Daily Digest | High | Medium | 🟡 P2 |
| 11 | Bulk Upload | Medium | Medium | 🟡 P2 |
| 16 | Multi-Message Tasks | Medium | High | 🟡 P2 |
| 17 | Manager Task Extraction | High | High | 🟡 P2 |
| 18 | Complete with AI | Medium | Medium | 🟡 P2 |
| 15 | @Mention Bot | Medium | Medium | 🟡 P2 |
| 8 | Planning Groups | Medium | Low | 🟡 P2 |
| 9 | Auto-Fill Sheet | Medium | Low | 🟢 P3 |
| 12 | Version Comparison | Medium | High | 🟢 P3 |
| 19 | Redis Caching | Medium | Medium | 🟢 P3 |
| 20 | Firebase Auth | Medium | High | 🟢 P3 |

---

## Implementation Order (Suggested)

**Phase 1: Foundation**
1. Sender Identification (match phone to team member)
2. Create Project Button
3. Simple Task Creation UI
4. Workload Indicator
5. Promote Planning → Active

**Phase 2: Voice & Reminders**
6. Voice Note Transcription
7. WhatsApp Reminder System
8. Message Tagging
9. Daily Digest

**Phase 3: Document Management**
10. Document Expiry Alerts
11. Bulk Upload with Auto-Classification
12. @Mention Bot Support

**Phase 4: Smart Tasks**
13. Manager Task Extraction
14. Multi-Message Task Detection
15. "Complete with AI" Button

**Phase 5: Scale & Polish**
16. Redis Caching
17. Firebase Auth + RBAC
18. Version Comparison
19. Auto-Fill Correspondence Sheet

---

## Notes

- Task system is currently "useless" - needs complete reimagining
- Voice commands are critical for field use
- Manager identification is key for task prioritization
- Planning projects need group support before official creation
- Document expiry is critical for compliance (permits, insurance)
- Daily digest will reduce "message fatigue" significantly

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Added: Workload Indicator, Promote Planning→Active, Document Expiry Alerts, Bulk Upload, Version Comparison, Message Tagging, Daily Digest |
| 2026-01-14 | Completed: Planning Projects in OrgChart |
| 2026-01-14 | Initial roadmap created |
