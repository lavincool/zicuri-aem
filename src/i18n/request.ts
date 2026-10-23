import { getRequestConfig } from "next-intl/server";
import { PILOT } from "@/config/pilot";
import { DEFAULT_LOCALE } from "./config";

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    timeZone: PILOT.timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
