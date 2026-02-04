import { AuthPageBackground } from "@/components/auth/AuthPageBackground";
import { SignInForm, SignUpForm, ForgotPasswordForm } from "@/components/auth/AuthForms";
import Link from "next/link";

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { path: "sign-in" },
    { path: "sign-up" },
    { path: "forgot-password" },
  ];
}

export default async function AuthPage({
  params,
  searchParams
}: {
  params: Promise<{ path: string }>;
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { path } = await params;
  const { redirect_url } = await searchParams;

  let redirectTo = redirect_url;
  if (!redirectTo) {
    if (path === "sign-in") {
      redirectTo = "/home";
    } else {
      redirectTo = "/onboarding";
    }
  }

  let title = "Welcome to ThinkEx";
  if (path === "sign-up") title = "Create an account";
  if (path === "forgot-password") title = "Reset Password";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 md:p-6 overflow-hidden">
      {/* Background with grid and cards */}
      <AuthPageBackground />

      {/* Auth content */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-center mb-6 text-foreground">
          {title}
        </h1> */}

        <div className="w-full flex justify-center">
          <div className="w-full bg-background/60 backdrop-blur-md border border-blue-500/20 shadow-xl rounded-xl p-6 md:p-8">
            {path === "sign-in" && <SignInForm redirectTo={redirectTo} />}
            {path === "sign-up" && <SignUpForm redirectTo={redirectTo} />}
            {path === "forgot-password" && <ForgotPasswordForm redirectTo={redirectTo} />}
          </div>
        </div>
      </div>
    </main>
  );
}


