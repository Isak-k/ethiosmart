import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSetup() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Administrator provisioning</CardTitle>
          <CardDescription>
            Administrator roles must be assigned by a trusted project operator, not
            granted from a public browser page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            In Firebase Console, create or select the account in Authentication, then
            create its <code>users/{`{uid}`}</code> Firestore document with the
            authenticated user's UID as the document ID, <code>role: "admin"</code>, and
            the required <code>sectionPermissions.manageExams.edit: true</code> grant.
            Keep the account's email, display name, and other profile fields consistent
            with the existing user documents.
          </p>
          <p>
            Do not grant this role through self-signup or client-side code. The Firestore
            rules now prevent users from changing their own role or permissions.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
