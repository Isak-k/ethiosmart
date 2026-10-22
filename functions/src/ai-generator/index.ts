import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GenerateBatchRequest, GenerateBatchResponse, ProviderStatusInfo } from './types';
import { orchestrateGenerationBatch, getProviderStatus, ProviderKeys } from './orchestrator';

export * from './types';
export * from './orchestrator';
export * from './normalizer';

function getServerKeys(): ProviderKeys {
  return {
    gemini: process.env.GEMINI_API_KEY || (functions.config().ai ? functions.config().ai.gemini_key : undefined),
    groq: process.env.GROQ_API_KEY || (functions.config().ai ? functions.config().ai.groq_key : undefined),
    openrouter: process.env.OPENROUTER_API_KEY || (functions.config().ai ? functions.config().ai.openrouter_key : undefined),
    huggingface: process.env.HUGGING_FACE_API_KEY || (functions.config().ai ? functions.config().ai.huggingface_key : undefined),
  };
}

async function verifyAdminUser(context: functions.https.CallableContext): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const uid = context.auth.uid;
  const token = context.auth.token;

  // Check custom claim first
  if (token.role === 'admin' || token.role === 'superadmin' || token.admin === true) {
    return;
  }

  // Fallback to Firestore users collection
  const userDoc = await admin.firestore().collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User profile does not exist.'
    );
  }

  const role = userDoc.data()?.role;
  if (role !== 'admin' && role !== 'superadmin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Administrator permissions are required to generate exams.'
    );
  }
}

/**
 * Callable Firebase Cloud Function to generate an AI exam batch
 */
export const generateAIExamBatch = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'HUGGING_FACE_API_KEY']
  })
  .https.onCall(async (data: GenerateBatchRequest, context): Promise<GenerateBatchResponse> => {
    // 1. Verify authentication and admin authorization
    await verifyAdminUser(context);

    // 2. Validate input parameters
    if (!data || typeof data !== 'object') {
      throw new functions.https.HttpsError('invalid-argument', 'Request body must be an object.');
    }

    const count = Number(data.count);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Batch count must be an integer between 1 and 50.'
      );
    }

    if (!data.prompt && !data.topic && !data.sourceMaterial) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one of prompt, topic, or sourceMaterial must be provided.'
      );
    }

    // 3. Orchestrate with fallback
    const keys = getServerKeys();
    return await orchestrateGenerationBatch(data, keys);
  });

/**
 * Callable Firebase Cloud Function to check AI provider statuses
 */
export const getAIProviderStatus = functions
  .https.onCall(async (_data, context): Promise<ProviderStatusInfo[]> => {
    await verifyAdminUser(context);
    const keys = getServerKeys();
    return getProviderStatus(keys);
  });
