const DC = (process.env.ZOHO_DC ?? 'com').trim();
const CLIENT_ID = (process.env.ZOHO_CLIENT_ID ?? '').trim();
const CLIENT_SECRET = (process.env.ZOHO_CLIENT_SECRET ?? '').trim();
const CODE = (process.argv[2] ?? process.env.ZOHO_GRANT_CODE ?? '').trim();

const ACCOUNTS = `https://accounts.zoho.${DC}`;
const RECRUIT_ORG_ID = (process.env.ZOHO_RECRUIT_ORG_ID ?? '').replace(/^org/i, '').trim();

function die(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  die(
    'Set the two Self Client values first, then pass the grant code:\n\n' +
      "  export ZOHO_DC=com                 # or eu, in, com.au, jp, ca\n" +
      "  export ZOHO_CLIENT_ID='1000.XXXX'\n" +
      "  export ZOHO_CLIENT_SECRET='xxxx'\n" +
      '  node migration/zoho-refresh-token.mjs PASTE_GRANT_CODE_HERE',
  );
}

if (!CODE) {
  die(
    'No grant code given. Generate one at api-console.zoho.com under your Self Client,\n' +
      'Generate Code tab, with this scope string:\n\n' +
      '  ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL,ZohoCRM.modules.ALL,ZohoCRM.settings.READ,ZohoCRM.users.READ\n\n' +
      'It is single use and expires in 10 minutes, so run this straight after copying it:\n\n' +
      '  node migration/zoho-refresh-token.mjs PASTE_GRANT_CODE_HERE',
  );
}

async function post(params) {
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    die(`${ACCOUNTS} did not return JSON (HTTP ${res.status}):\n${text.slice(0, 400)}`);
  }
  return body;
}

function explain(error) {
  const hints = {
    invalid_code:
      'The grant code was already used, has expired (10 minutes), or was copied with\n' +
      'surrounding whitespace. Generate a fresh one and rerun immediately.',
    invalid_client:
      'Two causes give this same error, in this order of likelihood:\n' +
      '  1. the client id is wrong, truncated, or from a different Self Client\n' +
      `  2. ZOHO_DC=${DC} is not the data centre the client was created in. A client made\n` +
      '     on zoho.eu will not authenticate against accounts.zoho.com. Try eu, in,\n' +
      '     com.au, jp or ca.',
    INVALID_CLIENT:
      'Two causes give this same error: a wrong client id, or ZOHO_DC=' +
      `${DC} not matching the data centre the client was created in.`,
    invalid_client_secret: 'The client secret does not match the client id.',
    invalid_scope:
      'One scope in the Generate Code step is not permitted for your profile. API access\n' +
      'is a profile permission in Zoho, separate from being able to read records.',
  };
  return hints[error] ?? 'Check the client id, secret and data centre against api-console.zoho.com.';
}

const granted = await post({
  grant_type: 'authorization_code',
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  code: CODE,
});

if (granted.error) {
  die(`Zoho refused the exchange: ${granted.error}\n\n${explain(granted.error)}`);
}

if (!granted.refresh_token) {
  die(
    'Zoho accepted the code but returned no refresh_token. That happens when the Self\n' +
      'Client was created as a client-credentials client, which issues access tokens only.\n' +
      'That flow needs no refresh token at all: see migration/ZOHO-API-SETUP.md, "The short way".\n\n' +
      `Response keys: ${Object.keys(granted).join(', ')}`,
  );
}

const refreshed = await post({
  grant_type: 'refresh_token',
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  refresh_token: granted.refresh_token,
});

if (refreshed.error || !refreshed.access_token) {
  die(
    `The refresh token was issued but does not mint an access token: ${refreshed.error ?? 'no access_token'}\n\n` +
      'Do not store it. Generate a new grant code and try again.',
  );
}

let recruitCheck = 'skipped, ZOHO_RECRUIT_ORG_ID not set';
if (RECRUIT_ORG_ID) {
  const res = await fetch(`https://recruit.zoho.${DC}/recruit/v2/settings/modules`, {
    headers: { Authorization: `Zoho-oauthtoken ${refreshed.access_token}` },
  });
  recruitCheck =
    res.status === 200
      ? 'HTTP 200, the token reads Recruit'
      : `HTTP ${res.status}, the token did not read Recruit (${(await res.text()).slice(0, 160)})`;
}

console.log(`
Refresh token issued and verified.

  data centre      ${DC}
  api domain       ${granted.api_domain ?? 'not returned'}
  scopes           ${granted.scope ?? 'not returned'}
  access token     minted from the refresh token, expires in ${refreshed.expires_in ?? '?'}s
  Recruit check    ${recruitCheck}

The refresh token is the only new value, so it is the only one printed. Your client id,
secret and data centre are already exported in this shell. It is a long-lived credential:
keep it out of git and out of every file in this repo.

  export ZOHO_REFRESH_TOKEN='${granted.refresh_token}'
${RECRUIT_ORG_ID ? '' : "  export ZOHO_RECRUIT_ORG_ID=748xxxxxx      # from recruit.zoho.com/recruit/org748xxxxxx/\n"}${
    (process.env.ZOHO_CRM_ORG_ID ?? '').trim()
      ? ''
      : '  export ZOHO_CRM_ORG_ID=600xxxxxx          # from crm.zoho.com/crm/org600xxxxxx/\n'
  }
Then the dry run, which writes nothing to the database:

  node migration/zoho-api.mjs --limit 5
`);
