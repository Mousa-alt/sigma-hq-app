# Sigma HQ - Feature Roadmap

**Last Updated:** 2026-01-14  
**Owner:** Mosallam

> This document tracks all planned features. Update when priorities change.

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

## 📋 Task System Reimagining

### 5. Multi-Message Task Detection
- **Problem:** A task isn't always one message - it's a conversation thread
- **Solution:** AI detects when topic/task ends and new one starts
- **Challenge:** Group conversations are messy
- **Status:** Not started

### 6. Task Extraction from Manager Messages
- **Problem:** Executives give verbal tasks in groups
- **Example:** "Install the marble next week" → Creates task to:
  - Check if contractor is ready
  - Check if drawings are approved
  - Create sub-tasks if needed
- **Status:** Not started

### 7. "Complete with AI" Button
- **Problem:** Tasks need follow-up actions
- **Solution:** Button beside each task that can:
  - Send an email
  - Create a draft
  - Generate a report
  - Whatever the task requires
- **Status:** Not started

### 8. @Mention Bot in Groups
- **Problem:** Need to interact with bot from any group
- **Solution:** Bot responds when @mentioned
- **Features:**
  - Ask questions
  - Create tasks
  - Get document summaries
- **Like:** @Grok functionality
- **Status:** Not started

---

## 🏗️ Project & Organization Management

### 9. "Create Project" Button
- **Location:** Organization page
- **Problem:** Requested multiple times, not implemented
- **Features:**
  - Create new project from UI
  - Assign team members
  - Set up folder structure
- **Status:** NOT STARTED - HIGH PRIORITY

### 10. Group Management for Planning Projects
- **Problem:** Some groups are for projects still in planning
- **Solution:** 
  - Add groups even before project is official
  - Assign people for future projects
  - Track pre-project discussions
- **Status:** Not started

### 11. Project Team → Correspondence Sheet Auto-Fill
- **Problem:** Manual work to fill contact list template
- **Solution:**
  - Select project
  - Select team members assigned
  - Press button → Auto-fill Excel/Google Sheet template
- **Template:** Already exists
- **Status:** Not started

---

## ⚡ Performance & Security (Gemini Recommendations)

### 12. Redis Caching
- **Problem:** GCS file lists slow as buckets grow
- **Solution:** Redis cache (Google Cloud Memorystore)
- **Benefit:** ~3 seconds → <100ms load times
- **Status:** Not started

### 13. Firebase Authentication + RBAC
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
| 9 | Create Project Button | High | Low | 🔴 P1 |
| 5 | Multi-Message Tasks | Medium | High | 🟡 P2 |
| 6 | Manager Task Extraction | High | High | 🟡 P2 |
| 7 | Complete with AI | Medium | Medium | 🟡 P2 |
| 8 | @Mention Bot | Medium | Medium | 🟡 P2 |
| 10 | Planning Groups | Medium | Low | 🟡 P2 |
| 11 | Auto-Fill Sheet | Medium | Low | 🟡 P2 |
| 12 | Redis Caching | Medium | Medium | 🟢 P3 |
| 13 | Firebase Auth | Medium | High | 🟢 P3 |

---

## Implementation Order (Suggested)

**Phase 1: Foundation**
1. Sender Identification (match phone to team member)
2. Create Project Button
3. Simple Task Creation UI

**Phase 2: Voice & Reminders**
4. Voice Note Transcription
5. WhatsApp Reminder System
6. @Mention Bot Support

**Phase 3: Smart Tasks**
7. Manager Task Extraction
8. Multi-Message Task Detection
9. "Complete with AI" Button

**Phase 4: Scale**
10. Redis Caching
11. Firebase Auth + RBAC
12. Auto-Fill Correspondence Sheet

---

## Notes

- Task system is currently "useless" - needs complete reimagining
- Voice commands are critical for field use
- Manager identification is key for task prioritization
- Planning projects need group support before official creation

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-14 | Initial roadmap created |
