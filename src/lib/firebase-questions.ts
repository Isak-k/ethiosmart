/**
 * Firebase Question Operations
 * CRUD operations for all question types with backward compatibility
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import {
  Question,
  isMCQQuestion,
  isTrueFalseQuestion,
  isShortAnswerQuestion,
  isEssayQuestion,
} from "@/integrations/firebase/types";
import { ensureQuestionType, migrateLegacyQuestions } from "./question-migration";
import { NewQuestionInput } from "@/lib/validations";

/**
 * Create a new question of any type
 */
export async function createQuestion(
  examId: string,
  questionData: NewQuestionInput
): Promise<Question> {
  try {
    // Get existing question count for orderIndex
    const questionsSnap = await getDocs(
      query(
        collection(db, "exams", examId, "questions"),
        orderBy("orderIndex", "desc")
      )
    );

    const nextOrderIndex =
      questionsSnap.docs.length > 0
        ? questionsSnap.docs[0].data().orderIndex + 1
        : 0;

    // Build question document based on type
    const baseQuestion = {
      examId,
      questionText: questionData.questionText,
      marks: questionData.marks,
      feedbackType: questionData.feedbackType,
      explanation: questionData.explanation || null,
      questionType: questionData.questionType,
      orderIndex: nextOrderIndex,
      createdAt: Timestamp.now(),
      // Image fields (optional)
      imageUrl: questionData.imageUrl || null,
      imageDisplayMode: questionData.imageDisplayMode || "inline",
    };

    let questionDoc: any = baseQuestion;

    // Add type-specific fields
    if (questionData.questionType === "mcq" && "options" in questionData) {
      questionDoc = {
        ...questionDoc,
        options: questionData.options,
        correctOptionIndex: questionData.correctOptionIndex,
      };
    } else if (
      questionData.questionType === "true-false" &&
      "correctAnswer" in questionData
    ) {
      questionDoc = {
        ...questionDoc,
        correctAnswer: questionData.correctAnswer,
      };
    } else if (
      questionData.questionType === "short-answer" &&
      "correctAnswers" in questionData
    ) {
      questionDoc = {
        ...questionDoc,
        correctAnswers: questionData.correctAnswers,
        caseSensitive: questionData.caseSensitive || false,
        requireExactMatch: questionData.requireExactMatch || false,
      };
    } else if (
      questionData.questionType === "essay" &&
      ("minWords" in questionData || "maxWords" in questionData)
    ) {
      questionDoc = {
        ...questionDoc,
        minWords: questionData.minWords,
        maxWords: questionData.maxWords,
        rubricPoints: questionData.rubricPoints || null,
      };
    }

    const docRef = await addDoc(
      collection(db, "exams", examId, "questions"),
      questionDoc
    );

    return {
      questionId: docRef.id,
      ...questionDoc,
    } as Question;
  } catch (error) {
    console.error("Error creating question:", error);
    throw error;
  }
}

/**
 * Get all questions for an exam with backward compatibility
 */
export async function getQuestions(examId: string): Promise<Question[]> {
  try {
    const questionsSnap = await getDocs(
      query(
        collection(db, "exams", examId, "questions"),
        orderBy("orderIndex", "asc")
      )
    );

    const questions = questionsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        questionId: doc.id,
        ...data,
      } as Question;
    });

    // Migrate legacy questions (add questionType if missing)
    return migrateLegacyQuestions(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    throw error;
  }
}

/**
 * Get a single question by ID
 */
export async function getQuestion(
  examId: string,
  questionId: string
): Promise<Question | null> {
  try {
    const docRef = doc(db, "exams", examId, "questions", questionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const question = {
      questionId: docSnap.id,
      ...data,
    } as any;

    // Ensure migration
    return ensureQuestionType(question);
  } catch (error) {
    console.error("Error fetching question:", error);
    throw error;
  }
}

/**
 * Update a question
 */
export async function updateQuestion(
  examId: string,
  questionId: string,
  updateData: Partial<NewQuestionInput>
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId, "questions", questionId);

    // Build update payload based on question type
    const updatePayload: any = {
      questionText: updateData.questionText,
      marks: updateData.marks,
      feedbackType: updateData.feedbackType,
      explanation: updateData.explanation || null,
      updatedAt: Timestamp.now(),
      // Image fields
      imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : undefined,
      imageDisplayMode: updateData.imageDisplayMode || "inline",
    };

    // Remove undefined fields
    Object.keys(updatePayload).forEach(
      key => updatePayload[key] === undefined && delete updatePayload[key]
    );

    // Add type-specific fields
    if (updateData.questionType === "mcq" && "options" in updateData) {
      updatePayload.options = updateData.options;
      updatePayload.correctOptionIndex = updateData.correctOptionIndex;
    } else if (
      updateData.questionType === "true-false" &&
      "correctAnswer" in updateData
    ) {
      updatePayload.correctAnswer = updateData.correctAnswer;
    } else if (
      updateData.questionType === "short-answer" &&
      "correctAnswers" in updateData
    ) {
      updatePayload.correctAnswers = updateData.correctAnswers;
      updatePayload.caseSensitive = updateData.caseSensitive || false;
      updatePayload.requireExactMatch = updateData.requireExactMatch || false;
    } else if (
      updateData.questionType === "essay" &&
      ("minWords" in updateData || "maxWords" in updateData)
    ) {
      updatePayload.minWords = updateData.minWords;
      updatePayload.maxWords = updateData.maxWords;
      updatePayload.rubricPoints = updateData.rubricPoints || null;
    }

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    console.error("Error updating question:", error);
    throw error;
  }
}

/**
 * Delete a question
 */
export async function deleteQuestion(
  examId: string,
  questionId: string
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId, "questions", questionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting question:", error);
    throw error;
  }
}

/**
 * Update question with image replacement
 * Handles deletion of old image before storing new one
 */
export async function updateQuestionWithImageReplacement(
  examId: string,
  questionId: string,
  updateData: Partial<NewQuestionInput>,
  oldImageUrl?: string,
  onDeleteOldImage?: (imageUrl: string) => Promise<void>
): Promise<void> {
  try {
    // Delete old image if new image is different
    if (oldImageUrl && updateData.imageUrl && oldImageUrl !== updateData.imageUrl) {
      if (onDeleteOldImage) {
        await onDeleteOldImage(oldImageUrl).catch((err) => {
          console.warn("Failed to delete old image, but continuing with update:", err);
        });
      }
    }

    // Update the question
    await updateQuestion(examId, questionId, updateData);
  } catch (error) {
    console.error("Error updating question with image replacement:", error);
    throw error;
  }
}

/**
 * Update question image display mode
 */
export async function updateQuestionImageDisplayMode(
  examId: string,
  questionId: string,
  displayMode: "inline" | "background" | "main"
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId, "questions", questionId);
    await updateDoc(docRef, {
      imageDisplayMode: displayMode,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating image display mode:", error);
    throw error;
  }
}

/**
 * Reorder questions
 */
export async function reorderQuestions(
  examId: string,
  questionIds: string[]
): Promise<void> {
  try {
    const updatePromises = questionIds.map((qId, index) =>
      updateDoc(doc(db, "exams", examId, "questions", qId), {
        orderIndex: index,
      })
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error("Error reordering questions:", error);
    throw error;
  }
}

/**
 * Bulk create questions
 */
export async function bulkCreateQuestions(
  examId: string,
  questionsList: NewQuestionInput[]
): Promise<Question[]> {
  try {
    const createdQuestions: Question[] = [];

    for (const questionData of questionsList) {
      const question = await createQuestion(examId, questionData);
      createdQuestions.push(question);
    }

    return createdQuestions;
  } catch (error) {
    console.error("Error bulk creating questions:", error);
    throw error;
  }
}

/**
 * Get question count for an exam
 */
export async function getQuestionCount(examId: string): Promise<number> {
  try {
    const questionsSnap = await getDocs(
      collection(db, "exams", examId, "questions")
    );
    return questionsSnap.docs.length;
  } catch (error) {
    console.error("Error fetching question count:", error);
    throw error;
  }
}

/**
 * Get total marks for an exam
 */
export async function getTotalMarks(examId: string): Promise<number> {
  try {
    const questions = await getQuestions(examId);
    return questions.reduce((sum, q) => sum + q.marks, 0);
  } catch (error) {
    console.error("Error calculating total marks:", error);
    throw error;
  }
}
