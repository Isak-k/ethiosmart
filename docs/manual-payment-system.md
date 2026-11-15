# EthioSmart Manual Payment System

This feature is being developed on `feature/manual-payment-system`. It is not deployed or production-ready until the checks below pass.

## Current implementation

- Student receipt submission using JPG/PNG images (5 MB maximum).
- Signed Cloudinary uploads; the API secret remains on the Functions runtime.
- Server-side receipt download, MIME/magic-byte validation, SHA-256 duplicate detection.
- One pending submission per user.
- Admin review with required rejection reason and immutable reviewer/decision metadata.
- Lifetime access grant on production approval; sandbox approvals do not grant production access.
- Admin payment dashboard, payment settings, and student payment status screen.
- In-app notification after an approval or rejection.
- Firestore client writes denied for payment records, payment accounts, receipt fingerprints, and notification records.
- Firestore rule prevents a client from forging lifetime access and prevents admin client writes from revoking existing lifetime access.

## Cloudinary setup

1. Create a Cloudinary account.
2. Copy `functions/.env.example` to `functions/.env.<firebase-project-id>`.
3. Fill in `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
4. Keep the filled-in environment file out of Git. Do not use a `VITE_` prefix for the secret.
5. Configure a Cloudinary upload limit/policy appropriate for receipts and test signed uploads.

The callable functions sign the upload request and verify the resulting image server-side. A receipt URL alone is never treated as proof of payment.

## Deploy after review

From the repository root:

```bash
cd functions
npm ci
npm run build
cd ..
firebase deploy --only functions,firestore:rules
```

Set the active Firebase project explicitly before deploying. Do not deploy to production until the app build, Functions build, Firestore rules tests, and end-to-end payment scenarios have passed.

## Important remaining work

This is not the complete originally requested payment scope yet. The remaining modules include device binding/change approval, server-enforced chapter/exam/note free allowances and usage counters, discounts, payment/refund/amount-difference workflows, push and Telegram notifications, offline receipt draft queue, full exports, and full production end-to-end tests. Content access must not be considered protected until the free/paid entitlement checks are integrated into the actual chapter, exam, and notes access paths.

## Lifetime access invariant

Once a production payment has been approved and lifetime access has been granted, changing payment settings or switching sandbox mode must never revoke that access. Sandbox approvals must never write production entitlement fields.
