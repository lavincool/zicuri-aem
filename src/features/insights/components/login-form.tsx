"use client";

import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LoginState, login } from "../server/actions";

export function LoginForm() {
  const t = useTranslations("panel.login");
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );
  const error =
    state?.error === "rate_limited"
      ? t("rateLimited")
      : state?.error === "disabled"
        ? t("disabled")
        : state?.error === "invalid"
          ? t("invalid")
          : null;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="panel-password">{t("password")}</Label>
        <Input
          id="panel-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "panel-login-error" : undefined}
          className="h-12 rounded-xl text-base"
        />
      </div>
      {error ? (
        <p
          id="panel-login-error"
          role="alert"
          className="text-sm font-semibold text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl text-base font-bold"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {t("submit")}
      </Button>
    </form>
  );
}
