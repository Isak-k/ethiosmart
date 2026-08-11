# Bulk Import Question Type Selection Implementation

## Overview
Updated the BulkImportQuestions component to require users to select a question type first before proceeding with import.

## Changes Made

### 1. Question Type Selection Screen
- Added a full-screen selection UI that displays before the import tabs
- Shows 4 question type cards: MCQ, True/False, Short Answer, Essay
- Each card displays the type label and description
- Users cannot proceed to import options until a type is selected

### 2. Type-Specific Import Flow
- After selecting a type, users see a "Change Type" button at the top to switch
- Badge shows the currently selected question type
- Only questions matching the selected type are shown in preview
- Manual input and AI generation tabs remain available

### 3. Data Filtering
- `handleAnalyze()`: Now filters parse results to only include questions matching selected type
  - Counts invalid type questions as errors
  - Shows preview only for matching question type
  
- `handleImport()`: 
  - Filters all parsed questions by selected type before saving
  - Only saves questions matching the selected type to database
  - Resets selected type when import completes

### 4. Dialog State Management
- When dialog closes, all state resets (type, text, parse result)
- User must select type again when reopening
- "Change Type" button allows switching types without closing dialog

## User Experience Flow

1. User clicks "Bulk Import" button
2. Dialog opens showing question type selection screen
3. User selects one of the 4 question types
4. Import interface appears with selected type badge
5. User can choose Manual Input or AI Generation
6. When analyzing/importing, only matching questions are processed
7. User can click "Change Type" to switch before closing dialog
8. Dialog closes on successful import and resets all state

## Technical Implementation

### Modified Files
- `src/components/exam/BulkImportQuestions.tsx`

### Key Changes
- Added conditional rendering for type selection screen
- Updated Dialog state handler to reset on close
- Enhanced handleAnalyze with type filtering
- Enhanced handleImport with type filtering and reset
- Added "Change Type" button functionality

## Testing Checklist
- [ ] Dialog opens showing question type selection
- [ ] All 4 question types are clickable
- [ ] After selection, shows selected type badge
- [ ] "Change Type" button resets to selection screen
- [ ] Manual input filters to selected type
- [ ] AI generation works with selected type
- [ ] Import only saves matching question types
- [ ] Dialog resets completely on close
