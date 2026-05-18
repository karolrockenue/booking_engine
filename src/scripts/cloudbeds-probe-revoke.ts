// Probe Cloudbeds for an OAuth token revocation endpoint.
//
// Standard OAuth2 spec (RFC 7009) defines POST /revoke. Cloudbeds may
// expose this at one of several paths. We'll try the common ones with a
// dummy token first (so we don't kill a real session), then read the
// status + body to see which path responds with anything other than 404.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-probe-revoke.ts

const HOSTS = [
  "https://hotels.cloudbeds.com",
  "https://api.cloudbeds.com",
];

const PATHS = [
  "/api/v1.3/access_token/revoke",
  "/api/v1.3/access_token/disable",
  "/api/v1.3/revoke",
  "/api/v1.3/oauth/revoke",
  "/api/v1.3/disconnect",
  "/oauth/revoke",
  "/oauth/v2/revoke",
  "/revoke",
];

async function probe(host: string, path: string) {
  const url = host + path;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: "dummy-probe-token-not-real",
        client_id: process.env.CLOUDBEDS_CLIENT_ID ?? "",
        client_secret: process.env.CLOUDBEDS_CLIENT_SECRET ?? "",
      }),
    });
    const text = await res.text();
    const isHtml = text.trimStart().startsWith("<");
    const tag = res.status === 404 ? "✗" : res.status < 500 ? "?" : "✗";
    console.log(`${tag} ${res.status}  ${url}`);
    if (res.status !== 404 && !isHtml) {
      console.log(`    ${text.slice(0, 300)}`);
    }
  } catch (e) {
    console.log(`✗ err   ${url}  ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  console.log("Probing Cloudbeds for an OAuth revocation endpoint…\n");
  for (const host of HOSTS) {
    for (const path of PATHS) {
      await probe(host, path);
    }
  }
  process.exit(0);
}

main();
