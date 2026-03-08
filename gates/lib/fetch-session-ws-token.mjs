import fs from "node:fs";
import process from "node:process";

const [baseUrl, sessionId, cookieJarPath] = process.argv.slice(2);

if (!baseUrl || !sessionId || !cookieJarPath) {
  console.error(
    "Usage: node gates/lib/fetch-session-ws-token.mjs <base_url> <session_id> <cookie_jar_path>",
  );
  process.exit(1);
}

function buildCookieHeader(jarPath, hostname) {
  const raw = fs.readFileSync(jarPath, "utf8");
  const cookies = [];

  for (const line of raw.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("\t");
    if (parts.length < 7) continue;

    const [domain, , path, secure, , name, value] = parts;
    const normalizedDomain = domain.replace(/^\./, "");
    const matchesDomain =
      hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);

    if (!matchesDomain) continue;
    if (secure === "TRUE" && !baseUrl.startsWith("https://")) continue;
    if (!path.startsWith("/")) continue;

    cookies.push(`${name}=${value}`);
  }

  return cookies.join("; ");
}

function findDashboardToken(value) {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDashboardToken(item);
      if (found) return found;
    }
    return null;
  }

  if ("dashboardWsToken" in value && typeof value.dashboardWsToken === "string") {
    return value.dashboardWsToken;
  }

  for (const nested of Object.values(value)) {
    const found = findDashboardToken(nested);
    if (found) return found;
  }

  return null;
}

function decodeHtmlMatch(rawValue) {
  try {
    return JSON.parse(`"${rawValue}"`);
  } catch {
    return rawValue;
  }
}

const cookieHeader = buildCookieHeader(cookieJarPath, new URL(baseUrl).hostname);
const requestHeaders = cookieHeader ? { Cookie: cookieHeader } : {};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: requestHeaders,
    redirect: "follow",
  });

  return {
    status: response.status,
    body: await response.text(),
  };
}

const dataUrl = `${baseUrl}/session/${sessionId}/__data.json`;
const dataResponse = await fetchText(dataUrl);

if (dataResponse.status === 200) {
  try {
    const parsed = JSON.parse(dataResponse.body);
    const token = findDashboardToken(parsed);
    if (token) {
      console.log(token);
      process.exit(0);
    }
  } catch {
    // Fall through to HTML parsing.
  }
}

const pageUrl = `${baseUrl}/session/${sessionId}`;
const pageResponse = await fetchText(pageUrl);
if (pageResponse.status !== 200) {
  console.error(`Failed to load session page for websocket token (HTTP ${pageResponse.status})`);
  process.exit(1);
}

const htmlMatch = pageResponse.body.match(/"dashboardWsToken":"([^"]+)"/);
if (!htmlMatch?.[1]) {
  console.error("dashboardWsToken not found in session page payload");
  process.exit(1);
}

console.log(decodeHtmlMatch(htmlMatch[1]));
