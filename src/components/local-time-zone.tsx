"use client";

import {
  NextIntlClientProvider,
  useLocale,
  useMessages,
  useTimeZone,
} from "next-intl";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Mexico spans several time zones (and the border follows US daylight saving), so
 * dates switch to the browser's own zone once hydrated; the server render uses
 * central time, which keeps hydration consistent.
 */
export function LocalTimeZone({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const [timeZone, setTimeZone] = useState(useTimeZone());

  useEffect(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local) setTimeZone(local);
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}
