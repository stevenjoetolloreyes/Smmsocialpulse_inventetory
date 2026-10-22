import { AuthCard } from "@/components/AuthShell";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthCard heading="Set a new password" subtitle="Choose a new password for your account">
      <ResetPasswordForm token={token ?? ""} />
    </AuthCard>
  );
}
