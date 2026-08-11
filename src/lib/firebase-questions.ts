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
  deleteField,
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

export async function createQuestion(
  examId: string,
  questionData: NewQuestionInput
): Promise<Question> {
  try {
    console.log("[FIREBASE] Creating question with:", {
      examId,
      questionType: questionData.questionType,
      hasImageUrl: !!questionData.imageUrl,
      imageUrl: questionData.imageUrl ? questionData.imageUrl.substring(0, 80) + "..." : null,
      imageDisplayMode: questionData.imageDisplayMode,
    });

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

    const baseQuestion: Record<string, any> = {
      examId,
      questionText: questionData.questionText,
      marks: questionData.marks,
      feedbackType: questionData.feedbackType,
      explanation: questionData.explanation ?? null,
      questionType: questionData.questionType,
      orderIndex: nextOrderIndex,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      imageUrl: questionData.imageUrl ?? null,
      imageDisplayMode: questionData.imageDisplayMode || "inline",
    };

    console.log("[FIREBASE] Question data to save:", {
      imageUrl: baseQuestion.imageUrl ? "SET (will save)" : "NOT SET (null/undefined)",
      imageDisplayMode: baseQuestion.imageDisplayMode,
    });

    const qType = String(questionData.questionType).replace(/_/g, '-');
    let questionDoc: Record<string, any> = { ...baseQuestion, questionType: qType };

    // Remove any undefined values before saving to Firestore
    Object.keys(questionDoc).forEach((key) => {
      if (questionDoc[key] === undefined) {
        delete questionDoc[key];
      }
    });

    switch (qType) {
      case "mcq":
        if ("options" in questionData) {
          questionDoc.options = questionData.options;
          questionDoc.correctOptionIndex = questionData.correctOptionIndex;
        }
        break;
      case "true-false":
        if ("correctAnswer" in questionData) {
          questionDoc.correctAnswer = questionData.correctAnswer;
        }
        break;
      case "short-answer":
        if ("correctAnswers" in questionData) {
          questionDoc.correctAnswers = questionData.correctAnswers;
          questionDoc.caseSensitive = questionData.caseSensitive || false;
          questionDoc.requireExactMatch = questionData.requireExactMatch || false;
        }
        break;
      case "essay":
        questionDoc.minWords = ("minWords" in questionData) ? questionData.minWords ?? null : null;
        questionDoc.maxWords = ("maxWords" in questionData) ? questionData.maxWords ?? null : null;
        questionDoc.rubricPoints = ("rubricPoints" in questionData) ? questionData.rubricPoints ?? null : null;
        questionDoc.requiresManualGrading = true;
        break;
    }

    const docRef = await addDoc(
      collection(db, "exams", examId, "questions"),
      questionDoc
    );

    const returnData = {
      questionId: docRef.id,
      ...questionDoc,
    };

    console.log("[FIREBASE] Question saved successfully:", {
      questionId: docRef.id,
      imageUrl: questionDoc.imageUrl ? "YES - SAVED" : "NO - NOT SAVED",
    });

    return returnData as Question;
  } catch (error) {
    console.error("Error creating question:", error);
    throw error;
  }
}

export async function getQuestions(examId: string): Promise<Question[]> {
  try {
    console.log("[FIREBASE] getQuestions called for examId:", examId);
    
    const questionsSnap = await getDocs(
      query(
        collection(db, "exams", examId, "questions"),
        orderBy("orderIndex", "asc")
      )
    );

    console.log("[FIREBASE] Retrieved", questionsSnap.docs.length, "questions");

    const questions = questionsSnap.docs.map((doc) => {
      const data = doc.data();
      console.log("[FIREBASE] Loading question", doc.id, ":", {
        questionType: data.questionType,
        hasImageUrl: !!data.imageUrl,
        imageUrl: data.imageUrl ? data.imageUrl.substring(0, 80) + "..." : "NO IMAGE",
      });
      
      return {
        questionId: doc.id,
        ...data,
      } as Question;
    });

    console.log("[FIREBASE] All questions loaded, total:", questions.length);

    return migrateLegacyQuestions(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    throw error;
  }
}

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

    return ensureQuestionType(question);
  } catch (error) {
    console.error("Error fetching question:", error);
    throw error;
  }
}

export async function updateQuestion(
  examId: string,
  questionId: string,
  updateData: Partial<NewQuestionInput>
): Promise<void> {
  try {
    const docRef = doc(db, "exams", examId, "questions", questionId);

    const updatePayload: Record<string, any> = {
      questionText: updateData.questionText,
      marks: updateData.marks,
      feedbackType: updateData.feedbackType,
      explanation: updateData.explanation !== undefined ? (updateData.explanation || null) : undefined,
      updatedAt: Timestamp.now(),
      imageDisplayMode: updateData.imageDisplayMode || undefined,
    };

    if ("imageUrl" in updateData) {
      if (updateData.imageUrl === null || updateData.imageUrl === undefined) {
        updatePayload.imageUrl = deleteField();
      } else {
        updatePayload.imageUrl = updateData.imageUrl;
      }
    }

    // Remove all undefined values - Firestore doesn't accept undefined
    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });

    if (updateData.questionType) {
      const qType = String(updateData.questionType).replace(/_/g, '-');
      updatePayload.questionType = qType;

      switch (qType) {
        case "mcq":
          if ("options" in updateData) {
            updatePayload.options = updateData.options;
            updatePayload.correctOptionIndex = updateData.correctOptionIndex;
          }
          break;
        case "true-false":
          if ("correctAnswer" in updateData) {
            updatePayload.correctAnswer = updateData.correctAnswer;
          }
          break;
        case "short-answer":
          if ("correctAnswers" in updateData) {
            updatePayload.correctAnswers = updateData.correctAnswers;
            updatePayload.caseSensitive = updateData.caseSensitive || false;
            updatePayload.requireExactMatch = updateData.requireExactMatch || false;
          }
          break;
        case "essay":
          updatePayload.minWords = ("minWords" in updateData) ? (updateData.minWords ?? null) : undefined;
          updatePayload.maxWords = ("maxWords" in updateData) ? (updateData.maxWords ?? null) : undefined;
          updatePayload.rubricPoints = ("rubricPoints" in updateData) ? (updateData.rubricPoints ?? null) : undefined;
          updatePayload.requiresManualGrading = true;
          Object.keys(updatePayload).forEach(
            key => {
              if ((key === 'minWords' || key === 'maxWords' || key === 'rubricPoints') && updatePayload[key] === undefined) {
                delete updatePayload[key];
              }
            }
          );
          break;
      }
    }

    await updateDoc(docRef, updatePayload);
  } catch (error) {
    console.error("Error updating question:", error);
    throw error;
  }
}

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

export async function updateQuestionWithImageReplacement(
  examId: string,
  questionId: string,
  updateData: Partial<NewQuestionInput>,
  oldImageUrl?: string,
  onDeleteOldImage?: (imageUrl: string) => Promise<void>
): Promise<void> {
  try {
    if (oldImageUrl && updateData.imageUrl && oldImageUrl !== updateData.imageUrl) {
      if (onDeleteOldImage) {
        await onDeleteOldImage(oldImageUrl).catch((err) => {
          console.warn("Failed to delete old image, but continuing with update:", err);
        });
      }
    }

    await updateQuestion(examId, questionId, updateData);
  } catch (error) {
    console.error("Error updating question with image replacement:", error);
    throw error;
  }
}

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

export async function getTotalMarks(examId: string): Promise<number> {
  try {
    const questions = await getQuestions(examId);
    return questions.reduce((sum, q) => sum + q.marks, 0);
  } catch (error) {
    console.error("Error calculating total marks:", error);
    throw error;
  }
}
