# Gemini question generation setup

## Firebase and model configuration

The feature uses the existing Firebase app and Firebase AI Logic's Gemini Developer
API backend (`getAI(app, { backend: new GoogleAIBackend() })`). It currently selects
the `gemini-2.5-flash` model, which supports structured JSON output. The model name is
defined in `src/lib/gemini-questions.ts`; check Firebase's supported-model list before
changing it.

In the Firebase Console, open **AI Logic** for the same Firebase project, choose the
Gemini Developer API, and complete its setup so the Firebase AI Logic API and required
provider APIs are enabled. No Gemini API key or service-account credential belongs in
the React app: Firebase AI Logic uses its proxy so the Gemini Developer API key stays
server-side.

Official references:

- [Firebase AI Logic for web](https://firebase.google.com/docs/ai-logic/get-started?api=web)
- [Supported models and model names](https://firebase.google.com/docs/ai-logic/models)
- [Structured JSON output](https://firebase.google.com/docs/ai-logic/generate-structured-output)
- [App Check for Firebase AI Logic](https://firebase.google.com/docs/ai-logic/app-check)
- [Firebase AI Logic quotas](https://firebase.google.com/docs/ai-logic/quotas)
- [Firebase AI Logic pricing](https://firebase.google.com/docs/ai-logic/pricing)

## App Check, billing, and quotas

For production, register the web app with Firebase App Check and enforce App Check for
Firebase AI Logic in the Firebase Console. Configure the web reCAPTCHA v3 site key as
`VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` in the local environment and deployment
environment. The app initializes App Check when this value is present. For local
development, use the Firebase App Check debug-token workflow and safelist the token in
the Console; never ship a debug token.

The Gemini Developer API has a limited free tier for eligible models and usage. Paid
tiers require a Cloud Billing account, and usage becomes pay-as-you-go after billing
is linked. Quotas vary by project/model and can return 429 errors. Configure quotas,
budget alerts, and spend controls in Google AI Studio / Google Cloud before production
use. A Gemini Pro subscription does **not** grant API credits or cover these API calls.
Firebase AI Logic itself has no separate SDK charge; provider usage and other Firebase
services can still incur costs. See the official pricing and quota links above for
current terms.

The UI limits each generation to 20 questions, prevents concurrent submissions, and
applies a local limit of 5 requests per minute. These are client-side usability limits,
not a server-enforced per-administrator budget. Use App Check and Firebase AI Logic API
quotas to control abuse and project-wide usage.

## Authorization and saving

The generator is shown only to administrators with the existing `manageExams` edit
permission, and it checks the signed-in user's Firestore role before requesting
generation. Approved questions are written through ExamPro's existing
`exams/{examId}/questions` batch-save workflow and existing Firestore rules. The rules
now prevent users from creating or changing their own admin role, permissions, or
disabled status; self-created profiles are limited to students. Bootstrap an admin
only through a trusted Firebase Console/operator workflow.
Before deploying the rules, review existing `users` documents for any admin roles that
may have been self-assigned under the previous rules; the new rules do not revoke
existing roles.

The generator does not save during generation or preview. It only permits saving when
the exam is unpublished; publish the exam separately after reviewing it. If the exam
has already been published, unpublish it before generating or saving questions. The
Firestore rules require AI-tagged question writes to come from an administrator and
the parent exam to be unpublished, so a non-admin exam creator cannot write these
records and a publish/save race is denied. Existing question rules still allow an exam
creator to write untagged questions in that exam's question subcollection, as in the
current ExamPro behavior.

## Local testing

1. Add the Firebase web app configuration to the usual `VITE_FIREBASE_*` environment
   variables and set the App Check site-key variable when using reCAPTCHA.
2. Ensure Firebase AI Logic / Gemini Developer API is enabled for the configured
   project and that an administrator account has an `admin` role and
   `manageExams.edit` permission.
3. Run `npm run dev`, sign in as that administrator, and open an unpublished exam's
   edit page.
4. Select **Generate with Gemini**, enter a subject and topic, choose question type,
   difficulty, language, and count, then generate.
5. Review and edit the preview. Remove or regenerate questions as needed. Only
   **Approve and save** writes questions to Firestore; canceling discards the preview.
6. Run the focused validation and workflow tests with:
   `npx vitest run src/lib/gemini-question-validation.test.ts src/components/exam/GenerateQuestionsDialog.test.tsx`

Generation requires a network connection. Closing the preview never saves questions;
an in-flight model request can still finish and consume quota.

## Deployment and troubleshooting

Deploy the reviewed Firestore rules with `firebase deploy --only firestore:rules`
after confirming the role-provisioning change is appropriate for the project. Deploy
the frontend with the Firebase AI Logic and App Check configuration above. App Check
enforcement and production reCAPTCHA registration are Firebase Console actions and
must be completed by a project operator.

- **AI Logic not configured / API not enabled:** complete Firebase AI Logic setup for
  this project and verify the app's Firebase config.
- **HTTP 401 / API key rejected:** local development uses the built-in fallback Firebase
  web-app config when no `VITE_FIREBASE_*` values are set. In Firebase Console, open
  **Project settings > General > Your apps**, select the web app for this project,
  and use its current SDK configuration. Set the matching `VITE_FIREBASE_*` values
  in a local `.env` file (do not commit it), making sure all values belong to the same
  project, then restart Vite. In Google Cloud
  Console, open **APIs & Services > Credentials**, locate that web app's API key,
  and verify its API restrictions allow Firebase AI Logic
  (`firebasevertexai.googleapis.com`) and its application restrictions allow your
  development origin (for example, `http://localhost:8080`) and production domain.
  Keep appropriate restrictions in place; do not paste API keys into chat or source
  control. If the key still returns 401, create/use a valid web API key for the same
  Firebase project and update the local environment with the matching web-app config.
- **App Check rejected:** verify the production site key, registered app/domain, and
  enforcement configuration; for local use, register the debug token.
- **Quota / 429:** check the model's provider quota and Firebase AI Logic API quotas.
- **Model unavailable:** check current model availability for this project and update
  `GEMINI_QUESTION_MODEL` to a supported stable model if Google retires the selected
  version.
- **Firestore permission denied:** verify the current admin role, exam edit
  permission, and deployed rules. Role changes must be made by a trusted operator.
- **Invalid output:** retry generation; the application rejects malformed, duplicate,
  incomplete, or wrong-count responses rather than saving them.
