"use client";

import { FlaskConical, LoaderCircle, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DemoSignInState,
  demoSignInAction,
  type LinkRequestState,
  requestLoginLinkAction,
} from "../server/auth-actions";

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const t = useTranslations("operator.login");
  const [state, action, pending] = useActionState<LinkRequestState, FormData>(
    requestLoginLinkAction,
    null,
  );
  const error =
    state && "error" in state
      ? state.error === "rate_limited"
        ? t("rateLimited")
        : t("invalidEmail")
      : null;

  return (
    <div className="space-y-5">
      {state && "status" in state ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-water/10 px-3 py-3 font-semibold"
        >
          <MailCheck className="mt-0.5 size-5 shrink-0 text-water" />
          {t("sent")}
        </p>
      ) : null}
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="operator-email">{t("email")}</Label>
          <Input
            id="operator-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "operator-login-error" : undefined}
            className="h-12 rounded-xl text-base"
          />
        </div>
        {error ? (
          <p
            id="operator-login-error"
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
      {demoMode ? <DemoSignIn /> : null}
    </div>
  );
}

function DemoSignIn() {
  const t = useTranslations("operator.login");
  const [state, action, pending] = useActionState<DemoSignInState>(
    demoSignInAction,
    null,
  );
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-3 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {t("or")}
      </p>
      <form action={action} className="space-y-2">
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="h-12 w-full rounded-xl text-base font-bold"
        >
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <FlaskConical className="size-5" />
          )}
          {t("demo")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("demoHint")}
        </p>
        {state?.error ? (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {state.error === "missing" ? t("demoMissing") : t("demoDisabled")}
          </p>
        ) : null}
      </form>
    </div>
  );
}
