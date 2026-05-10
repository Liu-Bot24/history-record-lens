const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:\/\//i;

export function safeParseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed.replace(/^\/\//, "")}`);
    } catch {
      return null;
    }
  }
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

export function stripUrlScheme(input: string): string {
  return input.trim().replace(URL_SCHEME_RE, "").replace(/^\/\//, "");
}

export function trimTrailingSlash(input: string): string {
  if (input.length > 1 && input.endsWith("/")) return input.slice(0, -1);
  return input;
}

export function cleanUrlPattern(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parsed = safeParseUrl(trimmed);
  if (parsed && (URL_SCHEME_RE.test(trimmed) || trimmed.includes("."))) {
    const host = normalizeHost(parsed.host);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const search = parsed.search;
    const hash = parsed.hash;
    return trimTrailingSlash(`${host}${path}${search}${hash}`);
  }

  return trimTrailingSlash(stripUrlScheme(trimmed)).toLowerCase();
}

export function extractHost(input: string): string {
  const parsed = safeParseUrl(input);
  if (parsed) return normalizeHost(parsed.hostname);

  const stripped = stripUrlScheme(input);
  const firstSegment = stripped.split(/[/?#]/)[0] ?? "";
  return normalizeHost(firstSegment);
}

export function hostMatchesPattern(host: string, rawPattern: string): boolean {
  const normalizedHost = normalizeHost(host);
  const patternHost = extractHost(rawPattern);
  if (!patternHost) return false;
  return normalizedHost === patternHost || normalizedHost.endsWith(`.${patternHost}`);
}

export function normalizeComparableUrl(input: string): string {
  return cleanUrlPattern(input).toLowerCase();
}

export function ensureHttpUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (URL_SCHEME_RE.test(trimmed)) return trimmed;
  return `https://${stripUrlScheme(trimmed)}`;
}

export function labelFromUrl(input: string): string {
  const host = extractHost(input);
  if (!host) return "New site";
  const withoutWww = host.replace(/^www\./, "");
  const [label] = withoutWww.split(".");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : withoutWww;
}

export function sanitizeUrlForAi(input: string, includeQueryStrings: boolean): string {
  const parsed = safeParseUrl(input);
  if (!parsed) return input;
  if (!includeQueryStrings) {
    parsed.search = "";
    parsed.hash = "";
  }
  return parsed.toString();
}

export function hostAndPath(input: string): { host: string; path: string } {
  const parsed = safeParseUrl(input);
  if (!parsed) return { host: "", path: "" };
  return {
    host: normalizeHost(parsed.hostname),
    path: parsed.pathname === "/" ? "" : parsed.pathname
  };
}

export function originPermissionPattern(baseUrl: string): string | null {
  const parsed = safeParseUrl(baseUrl);
  if (!parsed || !["http:", "https:"].includes(parsed.protocol)) return null;
  return `${parsed.protocol}//${parsed.host}/*`;
}
