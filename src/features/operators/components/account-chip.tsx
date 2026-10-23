import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { signOutAction } from "../server/auth-actions";
import { requireOperator } from "../server/session";

/** Who is signed in, for which organization, and the way out. */
export async function AccountChip() {
  const [operator, t] = await Promise.all([
    requireOperator(),
    getTranslations("operator.nav"),
  ]);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 text-right text-sm leading-tight">
        <p className="truncate font-bold">{operator.orgName}</p>
        <p className="truncate text-muted-foreground">
          {operator.name ?? operator.email} · {t(`roles.${operator.role}`)}
        </p>
      </div>
      <form action={signOutAction}>
        <Button
          variant="outline"
          type="submit"
          aria-label={t("signOut")}
          className="h-10 rounded-full px-3 font-semibold"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">{t("signOut")}</span>
        </Button>
      </form>
    </div>
  );
}
