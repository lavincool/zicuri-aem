"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  signInWithTokenAction,
  type TokenSignInState,
} from "../server/auth-actions";

/** Signs in on an explicit tap, so email scanners that open links don't burn them. */
export function TokenForm({ token }: { token: string }) {
  const t = useTranslations("operator.link");
  const [state, action, pending] = useActionState<TokenSignInState, FormData>(
    signInWithTokenAction,
    null,
  );
  if (state?.error) return <DeadLink message={t("unknown")} />;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl text-base font-bold"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {t("continue")}
      </Button>
    </form>
  );
}

export function DeadLink({ message }: { message: string }) {
  const t = useTranslations("operator.link");
  return (
    <div className="space-y-4">
      <p role="alert" className="font-semibold text-destructive">
        {message}
      </p>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/operador/entrar" />}
        className="h-12 w-full rounded-xl text-base font-bold"
      >
        {t("requestNew")}
      </Button>
    </div>
  );
}
