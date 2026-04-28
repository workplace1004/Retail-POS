/** Matches webpanel `LanguageContext` — used for `Intl` region names and sorting. */
export type CountryLang = "nl" | "en";

/** ISO 3166-1 alpha-2 codes supported in country selects (same set as before). */
export const COUNTRY_CODES: readonly string[] = [
  "AF", "AL", "DZ", "AS", "VI", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "VG", "IO", "BN", "BG", "BF", "BI", "KH", "CA", "BQ", "CF", "CL", "CN", "CO", "KM", "CG", "CD", "CK", "CR", "CU", "CW", "CY", "DK", "DJ", "DM", "DO", "DE", "EC", "EG", "SV", "GQ", "ER", "EE", "ET", "FO", "FK", "FJ", "PH", "FI", "FR", "TF", "GF", "PF", "GA", "GM", "GE", "GH", "GI", "GD", "GR", "GL", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HN", "HU", "HK", "IE", "IS", "IN", "ID", "IQ", "IR", "IL", "IT", "CI", "JM", "JP", "YE", "JE", "JO", "CV", "CM", "KZ", "KE", "KG", "KI", "UM", "KW", "HR", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MV", "MY", "ML", "MT", "IM", "MA", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MZ", "MM", "NA", "NR", "NL", "NP", "NI", "NC", "NZ", "NE", "NG", "NU", "MP", "KP", "MK", "NO", "NF", "UG", "UA", "UZ", "OM", "AT", "TL", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "KN", "LC", "MF", "PM", "VC", "SB", "WS", "SM", "SA", "ST", "SN", "RS", "SC", "SL", "SG", "SH", "SX", "SI", "SK", "SD", "SO", "ES", "SJ", "LK", "SR", "SZ", "SY", "TJ", "TW", "TZ", "TH", "TG", "TK", "TO", "TT", "TD", "CZ", "TN", "TR", "TM", "TC", "TV", "UY", "VU", "VA", "VE", "AE", "US", "GB", "VN", "WF", "EH", "BY", "ZM", "ZW", "ZA", "GS", "KR", "SS", "SE", "CH",
];

const LOCALES: Record<CountryLang, string[]> = {
  nl: ["nl-BE", "nl"],
  en: ["en-GB", "en"],
};

let displayNl: Intl.DisplayNames | undefined;
let displayEn: Intl.DisplayNames | undefined;

function displayNamesFor(lang: CountryLang): Intl.DisplayNames | null {
  if (typeof Intl === "undefined" || !("DisplayNames" in Intl)) return null;
  try {
    if (lang === "nl") {
      if (!displayNl) displayNl = new Intl.DisplayNames(LOCALES.nl, { type: "region" });
      return displayNl;
    }
    if (!displayEn) displayEn = new Intl.DisplayNames(LOCALES.en, { type: "region" });
    return displayEn;
  } catch {
    return null;
  }
}

/** Localized country/territory label for an ISO alpha-2 code. */
export function getCountryName(code: string, lang: CountryLang): string {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return "";
  const dn = displayNamesFor(lang);
  if (dn) {
    try {
      const label = dn.of(c);
      if (label) return label;
    } catch {
      /* invalid code for runtime */
    }
  }
  return c;
}

/** Same codes as `COUNTRY_CODES`, sorted A–Z by localized display name. */
export function getSortedCountryCodes(lang: CountryLang): string[] {
  const collator = new Intl.Collator(lang === "nl" ? "nl-BE" : "en-GB", { sensitivity: "base" });
  return [...COUNTRY_CODES].sort((a, b) =>
    collator.compare(getCountryName(a, lang), getCountryName(b, lang)),
  );
}
