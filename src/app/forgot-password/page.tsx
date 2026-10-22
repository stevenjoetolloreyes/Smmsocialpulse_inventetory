import { AuthCard } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      heading="Forgot password"
      subtitle="We will email you a link to set a new password"
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
