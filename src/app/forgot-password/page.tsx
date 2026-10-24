import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

// The form owns its AuthCard so the card header (logo + heading +
// subtitle) can hide once the request succeeds.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
