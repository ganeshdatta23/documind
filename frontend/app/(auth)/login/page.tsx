"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useLogin } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginForm) => login(data);
  const apiError = (error as any)?.response?.data?.error?.message || "Invalid email or password";

  return (
    <div className="w-full max-w-sm">
      {/* mobile wordmark */}
      <div className="mb-10 flex items-center gap-2.5 lg:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fg text-canvas">
          <span className="text-base font-bold leading-none">D</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-fg">DocuMind</span>
      </div>

      <div className="mb-8">
        <h2 className="text-h1 text-fg">Welcome back</h2>
        <p className="mt-1.5 text-sm text-muted">Sign in to your workspace to continue.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password?.message}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="text-subtle transition-colors hover:text-muted"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("password")}
        />

        {error && (
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-subtle px-4 py-3">
            <p className="text-sm text-danger">{apiError}</p>
          </div>
        )}

        <Button type="submit" size="lg" isLoading={isPending} className="mt-2 w-full">
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-subtle">
        Protected by enterprise-grade security · SSO available on request
      </p>
    </div>
  );
}
