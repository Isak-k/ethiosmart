# Requirements Document: ExamPro Complete Question Type System

## Introduction

The ExamPro Complete Question Type System extends the existing examination platform to support all question types (MCQ, True/False, Short Answer, and Essay) with optional image support throughout the entire question lifecycle. This system enables educators to create diverse assessments while maintaining full backward compatibility with existing MCQ-based exams. The solution provides unified question creation, editing, bulk import, and grading workflows, with a single unified question model that discriminates behavior based on question type.

## Glossary

- **System**: The ExamPro Complete Question Type System
- **Question**: An assessment item within an exam that can be of type MCQ, True/False, Short Answer, or Essay
- **MCQ (Multiple Choice Question)**: A question type with multiple options where exactly one is correct
- **True/False Question**: A binary question type with only two possible answers
- **Short Answer Question**: A question type requiring text input with configurable matching rules
- **Essay Question**: A question type requiring extended text that requires manual grading
- **Question Type**: The discriminator that determines which question structure and behavior to use (mcq, true-false, short-answer, essay)
- **Image**: An optional visual asset associated with a question (JPEG, PNG, WebP, or GIF)
- **Image Display Mode**: How an image is rendered (inline with question text, background, or main content)
- **Optional Image**: An image that may or may not be provided; missing images do not cause validation failure
- **Auto-Grade**: Automatic evaluation of answers based on correct answer criteria
- **Manual Review**: Essay grading requiring an educator to evaluate and score the answer
- **Bulk Import**: Loading multiple questions at once from a data source (CSV, JSON)
- **Backward Compatibility**: Existing MCQ questions and exams continue to function unchanged
- **Question Form**: The dynamic user interface for creating or editing questions
- **Form Validation State**: The state tracking errors and completeness of question form fields
- **Image Validation State**: Separate state tracking for image upload, independent from form validation
- **Acceptance Criteria**: Measurable conditions that define when a requirement is met
- **Pending Review Status**: Essays awaiting educator grading (marked as pending_review in system)
- **Marks**: Points awarded for correctly answering a question
- **Explanation**: Educational text provided to students after answering, explaining the correct answer
- **Feedback Type**: Configuration of when feedback is shown (instant during exam, or hidden until review)

---

## Requirements

### Requirement 1: Unified Question Model Architecture

**User Story:** As a system architect, I want a single unified question model that supports all question types, so that I can manage questions consistently across creation, editing, import, exam delivery, and grading workflows without duplicate logic.

#### Acceptance Criteria

1. THE System SHALL define a discriminated union type `Question` that can be MCQQuestion, TrueFalseQuestion, ShortAnswerQuestion, or EssayQuestion
2. THE System SHALL include a `questionType` field that discriminates which question structure applies
3. ALL question types SHALL share common base fields: questionId, examId, questionText, marks, orderIndex, feedbackType, explanation, imageUrl, imageDisplayMode, createdAt
4. THE System SHALL use type guard functions (isMCQQuestion, isTrueFalseQuestion, isShortAnswerQuestion, isEssayQuestion) to safely determine question type at runtime
5. WHEN a Question is loaded, THE System SHALL correctly deserialize it as the appropriate question type based on questionType field
6. WHILE processing questions, THE System SHALL maintain full type safety such that accessing type-specific fields requires type narrowing

---

### Requirement 2: MCQ Question Type

**User Story:** As an educator, I want to create Multiple Choice questions with options and a correct answer, so that I can assess student understanding through single-select questions.

#### Acceptance Criteria

1. THE System SHALL support MCQ questions with the following type-specific fields:
   - options: array of option strings
   - correctOptionIndex: integer representing the correct option position
2. WHEN creating an MCQ question, THE Creator SHALL specify 2 or more options
3. THE System SHALL validate that correctOptionIndex is within the bounds of the options array
4. WHEN an MCQ question is rendered in an exam, THE Renderer SHALL display all options as radio buttons or single-select UI
5. WHEN a student answers an MCQ question, THE System SHALL store selectedOptionIndex
6. WHEN an MCQ answer is evaluated, THE Evaluator SHALL compare selectedOptionIndex with correctOptionIndex and mark as correct if they match

---

### Requirement 3: True/False Question Type

**User Story:** As an educator, I want to create True/False questions, so that I can quickly assess factual knowledge with binary-choice questions.

#### Acceptance Criteria

1. THE System SHALL support True/False questions with the following type-specific field:
   - correctAnswer: boolean (true or false)
2. WHEN a True/False question is rendered in an exam, THE Renderer SHALL display two buttons labeled "True" and "False"
3. WHEN a student answers a True/False question, THE System SHALL store selectedBoolean (true or false)
4. WHEN a True/False answer is evaluated, THE Evaluator SHALL compare selectedBoolean with correctAnswer and mark as correct if they match

---

### Requirement 4: Short Answer Question Type

**User Story:** As an educator, I want to create Short Answer questions with multiple acceptable answers and flexible matching rules, so that I can grade text-based answers accurately.

#### Acceptance Criteria

1. THE System SHALL support Short Answer questions with the following type-specific fields:
   - correctAnswers: array of acceptable answer strings
   - caseSensitive: boolean flag (default: false)
   - requireExactMatch: boolean flag (default: false)
2. WHEN creating a Short Answer question, THE Creator SHALL specify one or more acceptable answers
3. THE System SHALL provide configuration options for case sensitivity and exact vs. partial matching
4. WHEN a Short Answer question is rendered in an exam, THE Renderer SHALL display a single-line text input field
5. WHEN a student answers a Short Answer question, THE System SHALL store textAnswer
6. WHEN a Short Answer answer is evaluated with requireExactMatch=true, THE Evaluator SHALL normalize case according to caseSensitive flag and check if textAnswer exactly matches any correctAnswer
7. WHEN a Short Answer answer is evaluated with requireExactMatch=false, THE Evaluator SHALL allow partial matching where any correctAnswer contains textAnswer or vice versa, after normalizing case

---

### Requirement 5: Essay Question Type

**User Story:** As an educator, I want to create Essay questions with optional word count constraints and grading rubrics, so that I can assess deeper understanding and provide flexible manual grading.

#### Acceptance Criteria

1. THE System SHALL support Essay questions with the following type-specific fields:
   - minWords: optional integer for minimum word count
   - maxWords: optional integer for maximum word count
   - rubricPoints: optional array of rubric criteria with associated points
2. WHEN an Essay question is rendered in an exam, THE Renderer SHALL display a textarea for text input
3. THE Renderer SHALL display a live word count while the student types
4. WHEN a student submits an Essay answer, THE System SHALL store textAnswer with a pending_review status
5. WHEN an Essay answer is evaluated, THE System SHALL validate word count constraints if provided:
   - IF textAnswer word count is less than minWords, THEN THE System SHALL set isCorrect to false
   - IF textAnswer word count exceeds maxWords, THEN THE System SHALL set isCorrect to false
   - IF textAnswer word count is within range OR no constraints provided, THEN status remains pending_review awaiting educator grading
6. THE System SHALL support rubricPoints configuration for educators to define grading criteria
7. WHEN educators manually grade an Essay answer, THE System SHALL record rubricScore and transition pending_review status to graded

---

### Requirement 6: Optional Image Support for All Question Types

**User Story:** As an educator, I want to add optional images to any question type, so that I can create visual assessments and enhance student understanding.

#### Acceptance Criteria

1. ALL question types (MCQ, True/False, Short Answer, Essay) SHALL support an optional imageUrl field
2. THE System SHALL support three image display modes (inline, background, main)
3. WHEN a question without an image is saved, THE System SHALL not require an image or fail validation
4. WHEN a question is rendered with an imageUrl, THE Renderer SHALL display the image according to imageDisplayMode:
   - inline: image displayed next to question text with max-width constraint
   - background: image displayed as subtle background with reduced opacity
   - main: image displayed prominently as primary content with question text below
5. WHEN rendering a question without an image, THE Renderer SHALL display the question normally
6. IF a stored imageUrl becomes inaccessible at render time, THE System SHALL still display the question text and not fail

---

### Requirement 7: Image Upload and Management

**User Story:** As an educator, I want to upload images during question creation or editing, so that I can add visual content to assessments.

#### Acceptance Criteria

1. WHEN an educator selects an image file, THE System SHALL validate it meets requirements:
   - File type must be JPEG, PNG, WebP, or GIF
   - File size must not exceed 5MB
2. IF a file fails validation, THE System SHALL display a clear error message specifying the reason
3. WHEN a file passes validation, THE System SHALL upload it to Firebase Storage at path question-images/{examId}/{questionId}/{timestamp}
4. AFTER upload completes, THE System SHALL retrieve and store the download URL in the question's imageUrl field
5. WHEN an educator selects a new image for an existing question WITH an old image, THE System SHALL delete the old image from Firebase Storage before storing the new URL
6. WHEN an educator removes an image, THE System SHALL delete the image from Firebase Storage and clear the imageUrl field
7. WHEN an image upload fails, THE System SHALL display an error message and allow retry without affecting question form state
8. IMAGE upload progress and validation errors SHALL be managed independently from form validation state

---

### Requirement 8: Image Validation and Display Modes

**User Story:** As a system, I want to validate image accessibility and provide flexible display options, so that images render reliably and educators can control visual presentation.

#### Acceptance Criteria

1. WHEN an image URL is stored in a question, THE System MAY validate accessibility by attempting to fetch image metadata
2. IF an image URL cannot be accessed, THE System SHALL log a warning but continue processing
3. WHEN a question is rendered for exam display, THE System SHALL apply CSS classes based on imageDisplayMode:
   - inline mode: max-width constraint (e.g., max-w-md)
   - background mode: full-width with reduced opacity
   - main mode: full-width with larger height constraint
4. IF imageDisplayMode is not specified, THE System SHALL default to inline mode
5. WHEN rendering multiple question types with images, THE Renderer SHALL apply display mode consistently

---

### Requirement 9: Manual Question Creation Form

**User Story:** As an educator, I want a form to create questions with an intuitive interface, so that I can create assessments efficiently without needing to understand system architecture.

#### Acceptance Criteria

1. WHEN an educator accesses the question creation form, THE System SHALL display a Question_Type_Selector dropdown
2. WHEN the educator selects a question type from the dropdown, THE System SHALL display type-specific form fields:
   - MCQ: Question Text, Options (list), Correct Answer (selector), Marks, Image, Explanation, Feedback Type
   - True/False: Question Text, Correct Answer (True/False buttons), Marks, Image, Explanation, Feedback Type
   - Short Answer: Question Text, Acceptable Answers (list), Case Sensitive (toggle), Exact Match (toggle), Marks, Image, Explanation, Feedback Type
   - Essay: Question Text, Min Words (optional), Max Words (optional), Rubric Points (optional list), Marks, Image, Explanation, Feedback Type
3. ALL question types SHALL display: Question Text input, Marks input, Image Upload area, Explanation textarea, Feedback Type selector
4. WHEN the educator fills in form fields and clicks Save, THE System SHALL validate all required fields for the selected type
5. IF validation fails, THE System SHALL display errors next to the relevant fields and not save
6. IF validation succeeds, THE System SHALL save the question to Firestore and return to the exam view
7. WHEN adding options (MCQ) or acceptable answers (Short Answer), THE System SHALL provide Add/Remove controls
8. WHEN the educator is selecting a correct option or answer, THE System SHALL highlight the selection

---

### Requirement 10: Edit Existing Questions

**User Story:** As an educator, I want to edit existing questions, so that I can correct errors or update content.

#### Acceptance Criteria

1. WHEN an educator loads a question for editing, THE System SHALL populate the form with existing question data
2. THE System SHALL display the current question type in the Type_Selector (optionally as read-only or with change capability)
3. WHEN the educator modifies question text, THE System SHALL update it
4. WHEN the educator modifies type-specific fields (options, correct answers, constraints), THE System SHALL update them
5. WHEN the educator uploads a new image, THE System SHALL replace the old image and update imageUrl
6. WHEN the educator clicks the remove image button, THE System SHALL delete the image and clear imageUrl
7. WHEN the educator changes marks or explanation, THE System SHALL update those fields
8. WHEN the editor is changed, IF the question type is changed AND that is safe to do, THE System SHALL allow it; OTHERWISE THE System SHALL prevent type change with explanation
9. WHEN the educator clicks Save, THE System SHALL validate and update the question in Firestore

---

### Requirement 11: Bulk Question Import

**User Story:** As an educator, I want to import multiple questions at once, so that I can quickly populate exams from existing question banks.

#### Acceptance Criteria

1. WHEN an educator accesses the bulk import interface, THE System SHALL provide options to import from CSV or JSON
2. WHEN importing questions, THE System SHALL identify question type from a type field in the import data for EACH question
3. THE System SHALL support all question types in bulk import (MCQ, True/False, Short Answer, Essay)
4. WHEN import data includes optional image references, THE System SHALL attempt to download and store images
5. IF an image reference is missing or download fails, THE System SHALL NOT fail the entire import; images are optional
6. WHEN import data contains a question without required type-specific fields, THE System SHALL display a validation error for that question
7. WHEN import validation completes, THE System SHALL display a preview showing questions to be imported with any errors highlighted
8. WHEN the educator confirms the import, THE System SHALL create all valid questions in Firestore and return a summary report
9. THE System SHALL clear the import queue after successful completion

---

### Requirement 12: Image References in Bulk Import

**User Story:** As an educator, I want to include image references in bulk import files, so that visual questions can be imported at scale.

#### Acceptance Criteria

1. WHEN import data includes an imageUrl field, THE System SHALL treat it as an optional reference
2. IF imageUrl points to a valid external image (HTTP/HTTPS), THE System SHALL download and re-upload to Firebase Storage
3. IF imageUrl points to a Firebase Storage URL, THE System SHALL copy the reference
4. IF imageUrl cannot be accessed or download fails, THE System SHALL log a warning and continue without the image
5. THE System SHALL include a preview of images in the import confirmation dialog
6. WHEN import completes, questions without images SHALL be created successfully (images not required)

---

### Requirement 13: Type-Safe Answer Storage

**User Story:** As a system, I want to store answers in a unified format that accommodates all question types, so that I can process answers consistently.

#### Acceptance Criteria

1. THE System SHALL define an Answer interface with the following fields:
   - questionId: string
   - attemptId: string
   - selectedOptionIndex: optional number (MCQ only)
   - selectedBoolean: optional boolean (True/False only)
   - textAnswer: optional string (Short Answer, Essay)
   - isCorrect: boolean or null (null for pending essays)
   - timeSpentSeconds: optional number
   - answeredAt: Timestamp
   - rubricScore: optional number (Essay grading only)
2. WHEN a student answers an MCQ question, THE System SHALL store selectedOptionIndex
3. WHEN a student answers a True/False question, THE System SHALL store selectedBoolean
4. WHEN a student answers a Short Answer or Essay question, THE System SHALL store textAnswer
5. WHEN an answer is submitted, THE System SHALL store the answerTime in answeredAt

---

### Requirement 14: Auto-Grading for MCQ, True/False, and Short Answer

**User Story:** As a system, I want to automatically grade MCQ, True/False, and Short Answer questions, so that students receive immediate feedback.

#### Acceptance Criteria

1. WHEN an MCQ answer is submitted, THE Evaluator SHALL compare selectedOptionIndex with correctOptionIndex
2. THE Evaluator SHALL mark MCQ correct if indices match, incorrect otherwise
3. WHEN a True/False answer is submitted, THE Evaluator SHALL compare selectedBoolean with correctAnswer
4. THE Evaluator SHALL mark True/False correct if values match, incorrect otherwise
5. WHEN a Short Answer answer is submitted, THE Evaluator SHALL apply matching rules (case sensitive, exact/partial)
6. THE Evaluator SHALL mark Short Answer correct if textAnswer matches any correctAnswer per configured rules
7. WHEN answers are graded, THE System SHALL calculate points as marks × (1 if correct, 0 if incorrect)
8. THE System SHALL store grading results immediately and make them available for feedback display

---

### Requirement 15: Manual Grading for Essays

**User Story:** As an educator, I want to manually grade essay answers, so that I can evaluate complex student responses.

#### Acceptance Criteria

1. WHEN an essay answer is submitted, THE System SHALL set isCorrect to null and status to pending_review
2. WHEN viewing submitted exams, THE System SHALL display essay answers with pending_review status
3. WHEN an educator opens an essay for grading, THE System SHALL display the student answer and optional rubric
4. THE System SHALL provide a rubricScore input field for the educator to enter points
5. WHEN an educator submits a grade, THE System SHALL store rubricScore and mark the answer as graded
6. WHEN exam results are calculated, THE System SHALL include pending_review essays with a note indicating pending grading
7. THE System SHALL prevent result publication until all essays are graded or explicitly excluded

---

### Requirement 16: Question Rendering in Exam Mode

**User Story:** As a student, I want to see questions rendered correctly with appropriate answer interfaces, so that I can answer all question types in exams.

#### Acceptance Criteria

1. WHEN an exam question is loaded, THE Renderer SHALL display question text and any associated image
2. WHEN rendering an MCQ question, THE Renderer SHALL display options as radio buttons or single-select UI
3. WHEN rendering a True/False question, THE Renderer SHALL display two clearly labeled buttons (True, False)
4. WHEN rendering a Short Answer question, THE Renderer SHALL display a single-line text input
5. WHEN rendering an Essay question, THE Renderer SHALL display a textarea with live word count display
6. IF a question has an image, THE Renderer SHALL display it according to imageDisplayMode
7. WHEN a student interacts with an answer interface, THE System SHALL capture their selection
8. WHEN a student navigates to another question, THE System SHALL save their answer

---

### Requirement 17: Question Rendering in Practice Mode

**User Story:** As a student, I want to see immediate feedback in practice mode, so that I can learn from my answers while taking practice exams.

#### Acceptance Criteria

1. WHEN an exam is configured for practice mode, THE Renderer SHALL render questions with answer interfaces per their type
2. WHEN practice mode has showFeedback=true, THE System SHALL display correct/incorrect status after answering
3. WHEN practice mode has showExplanations=true, THE System SHALL display question explanation after answering
4. WHEN a student answers an essay question in practice mode, THE System SHALL display word count validation results (if minWords/maxWords configured)
5. WHEN a student has an essay pending_review, THE System SHALL display status indicating manual grading required
6. THE System SHALL support all question types with appropriate feedback display

---

### Requirement 18: Exam Creation with Mixed Question Types

**User Story:** As an educator, I want to create exams containing different question types, so that I can design comprehensive assessments.

#### Acceptance Criteria

1. WHEN creating an exam, THE System SHALL allow adding questions of any type (MCQ, True/False, Short Answer, Essay)
2. THE System SHALL display question type when listing questions in exam
3. WHEN an exam contains multiple question types, THE System SHALL total marks correctly across all types
4. WHEN shuffling questions is enabled, THE System SHALL shuffle questions regardless of type
5. WHEN shuffling options is enabled, THE System SHALL shuffle options for MCQ questions only (not applicable to other types)
6. THE System SHALL maintain correct question ordering throughout exam session

---

### Requirement 19: Timer and Navigation for All Question Types

**User Story:** As a system, I want to support exam features consistently across all question types, so that exam behavior is uniform.

#### Acceptance Criteria

1. THE System SHALL support timer functionality for exams containing any question type mix
2. THE System SHALL support question navigation (next, previous, jump to specific question) for all types
3. THE System SHALL support auto-save functionality for all question types
4. WHEN a student submits an exam with unanswered essay questions, THE System SHALL mark them as pending_review

---

### Requirement 20: Backward Compatibility with Existing MCQ Exams

**User Story:** As a system operator, I want existing exams and questions to continue working, so that no data migration or disruption occurs.

#### Acceptance Criteria

1. WHEN loading an existing exam created before multi-type support, THE System SHALL treat all questions as MCQ type
2. WHEN loading a question without a questionType field, THE System SHALL default to 'mcq' and auto-add the field on save
3. THE System SHALL NOT modify any existing question data during migration
4. WHEN rendering legacy MCQ questions, THE Renderer SHALL display them identically to before
5. WHEN grading legacy MCQ answers, THE Evaluator SHALL grade them using the same logic as before
6. WHEN an educator loads a legacy exam for editing, THE System SHALL allow editing without forcing type conversion
7. THE System SHALL preserve all existing answer data and result records

---

### Requirement 21: Image Handling During Question Lifecycle

**User Story:** As a system, I want to manage images consistently throughout question lifecycle, so that image storage is clean and references are maintained.

#### Acceptance Criteria

1. WHEN a question with an image is created, THE System SHALL upload the image to Firebase Storage
2. WHEN a question with an image is edited and image is replaced, THE System SHALL delete the old image
3. WHEN a question with an image is deleted, THE System SHALL delete the associated image from Firebase Storage
4. WHEN a question is duplicated, THE System SHALL re-upload the image (not share references)
5. WHEN questions are bulk imported with images, THE System SHALL upload each image independently
6. WHEN image storage encounters failures, THE System SHALL not fail question operations (images are optional)

---

### Requirement 22: Marks and Feedback Configuration

**User Story:** As an educator, I want to configure marks and feedback for all question types, so that I can control grading and student learning experience.

#### Acceptance Criteria

1. ALL question types SHALL support a marks field indicating points for correct answer
2. ALL question types SHALL support a feedbackType field (instant or hidden)
3. WHEN feedbackType is 'instant', THE System SHALL display feedback during exam
4. WHEN feedbackType is 'hidden', THE System SHALL hide feedback until results are published
5. THE System SHALL apply marks consistently: correct answer = marks, incorrect/pending = 0
6. WHEN calculating exam score, THE System SHALL sum marks for all correct answers plus all graded essays

---

### Requirement 23: Type-Specific Validation

**User Story:** As a system, I want to validate questions according to their type, so that invalid questions cannot be saved.

#### Acceptance Criteria

1. WHEN validating an MCQ question, THE System SHALL ensure:
   - Question text is not empty
   - At least 2 options exist
   - correctOptionIndex is valid
   - marks is a positive number
2. WHEN validating a True/False question, THE System SHALL ensure:
   - Question text is not empty
   - correctAnswer is explicitly set (true or false)
   - marks is a positive number
3. WHEN validating a Short Answer question, THE System SHALL ensure:
   - Question text is not empty
   - At least 1 acceptable answer exists
   - marks is a positive number
4. WHEN validating an Essay question, THE System SHALL ensure:
   - Question text is not empty
   - If minWords and maxWords are provided, minWords <= maxWords
   - marks is a positive number
5. WHEN optional fields (images, explanations) are missing, THE System SHALL NOT fail validation
6. WHEN validation fails, THE System SHALL display specific error messages

---

### Requirement 24: Question Type Migration and Safe Type Changes

**User Story:** As an educator, I want to change question type when it's safe to do so, so that I can repurpose questions.

#### Acceptance Criteria

1. WHEN an educator attempts to change a question's type, THE System SHALL assess safety:
   - Changing MCQ to True/False: SAFE if exactly 2 options and one is marked correct
   - Changing True/False to MCQ: SAFE (convert correct answer to option index)
   - Changing to Essay: SAFE (existing answer becomes essay text)
   - Other changes: MAY require confirmation due to data loss risk
2. IF type change is safe, THE System SHALL allow it
3. IF type change may lose data, THE System SHALL display confirmation dialog
4. WHEN type change is confirmed, THE System SHALL perform mapping and update question
5. WHEN viewing exam results, THE System SHALL not allow changing question type if answers exist

---

### Requirement 25: Results and Scoring with Mixed Question Types

**User Story:** As an educator, I want to see exam results that correctly account for all question types, so that I can accurately assess student performance.

#### Acceptance Criteria

1. WHEN viewing exam results, THE System SHALL display results for all question types
2. THE System SHALL show correct/incorrect for auto-graded questions (MCQ, True/False, Short Answer)
3. THE System SHALL show pending_review status for unanswered essays
4. THE System SHALL show graded status and score for manually graded essays
5. WHEN calculating total score, THE System SHALL sum points from all questions including graded essays
6. WHEN not all essays are graded, THE System SHALL display a note indicating incomplete grading
7. WHEN results are exported, THE System SHALL include all question types and their scores
8. THE System SHALL support filtering/sorting results by question type

---

### Requirement 26: Data Integrity and Consistency

**User Story:** As a system, I want to maintain data integrity across all operations, so that questions and answers remain consistent.

#### Acceptance Criteria

1. WHEN a question is saved, THE System SHALL validate type-specific fields before committing to Firestore
2. WHEN an answer is saved, THE System SHALL validate that the answer format matches the question type
3. IF type mismatch is detected, THE System SHALL log error and reject the operation
4. WHEN questions are queried, THE System SHALL use indexes for performant filtering by questionType
5. WHEN exams with deleted questions are accessed, THE System SHALL handle missing questions gracefully
6. WHEN Firestore transactions fail, THE System SHALL retry or provide clear error to user

---

## Acceptance Criteria Quality Standards

### Property-Based Testing Considerations

The following requirements are particularly suitable for property-based testing:

1. **Requirement 4 (Short Answer Matching)**: Text matching logic should be tested with property-based tests verifying that:
   - Partial matching is commutative: if "abc" matches "abcdef", then "abcdef" should match "abc"
   - Case sensitivity is consistent: if caseSensitive=false, both lowercase and uppercase variants should match
   - Exact match mode is stricter: any input matching in requireExactMatch=false should also match in requireExactMatch=true

2. **Requirement 14 (Auto-Grading)**: Grading logic should be tested with property-based tests verifying:
   - Grade correctness is deterministic: same answer always produces same grade
   - Marks calculation: correct answers always yield full marks, incorrect always yield 0
   - Round-trip consistency: storing and retrieving answers preserves correctness evaluation

3. **Requirement 7 (Image Upload)**: Image handling should be tested with property-based tests verifying:
   - File validation is consistent: any valid file always passes, any invalid file always fails
   - URL storage round-trip: uploaded images always have retrievable URLs
   - Size limits are enforced: no file > 5MB should ever be accepted

4. **Requirement 20 (Backward Compatibility)**: Legacy question handling should be tested with property-based tests verifying:
   - Default type assignment is idempotent: applying default type twice yields same result
   - Legacy questions render identically: MCQ questions render same before/after type field addition
   - Data preservation: no existing question fields should be modified during migration

### Round-Trip Testing (Critical)

1. **Question Creation → Save → Load → Edit → Save → Load**: Final loaded question should exactly match original
2. **Parse Import Data → Validate → Create → Export**: Exported data should match original import data
3. **Question Render → Answer → Grade → View Results → Export**: Results should consistently reflect answers

### Error Condition Testing

1. Invalid image files should be rejected with specific error messages
2. Duplicate question imports should be detected or handled gracefully
3. Missing required fields should fail validation with clear messages
4. Type conversions with data loss should require explicit confirmation

---

## Out of Scope

The following are explicitly not part of this requirement set:

- AI-powered answer evaluation for essays
- Voice-based question creation or answers
- Real-time collaborative question editing
- Question analytics and usage tracking
- Question versioning or audit history
- A/B testing question variants
- Transcribing images to text for accessibility
- Video question types
- Drag-and-drop matching question types

---

## Constraints and Assumptions

1. **Single Unified Model**: All question types use one Question model with a questionType discriminator, not separate systems
2. **Images Are Optional**: Missing images never cause validation failure or block any operations
3. **Image Management Isolated**: Image upload/deletion failures should not block question creation/editing
4. **Type-Safe Implementation**: System uses TypeScript discriminated unions and type guards, not string matching
5. **Backward Compatible**: No data migration, no modification of existing records, treat missing questionType as MCQ
6. **Firestore Schema**: Questions stored with explicit questionType field for all records
7. **Short Answer Flexibility**: Partial matching and case sensitivity are configurable, not hardcoded
8. **Essay Grading Manual**: Essays cannot be auto-graded; they always require manual review
9. **Marks Always Required**: All question types require positive marks value
10. **Image Limits**: 5MB file size limit, JPEG/PNG/WebP/GIF only
