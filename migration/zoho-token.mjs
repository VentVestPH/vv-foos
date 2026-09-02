const DC = (process.env.ZOHO_DC ?? 'com').trim();
const CLIENT_ID = (process.env.ZOHO_CLIENT_ID ?? '').trim();
const CLIENT_SECRET = (process.env.ZOHO_CLIENT_SECRET ?? '').trim();

const orgId = (v) => (v ?? '').trim().replace(/^org/i, '');

const SERVICES = {
  recruit: {
    service: 'ZohoRecruit',
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    orgId: orgId(process.env.ZOHO_RECRUIT_ORG_ID),
    orgVar: 'ZOHO_RECRUIT_ORG_ID',
    probe: `https://recruit.zoho.${DC}/recruit/v2/settings/modules`,
    where: 'recruit.zoho.com/recruit/org<ID>/',
  },
  crm: {
    service: 'ZohoCRM',
    scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ,ZohoCRM.users.READ',
    orgId: orgId(process.env.ZOHO_CRM_ORG_ID),
    orgVar: 'ZOHO_CRM_ORG_ID',
    probe: 'https://www.zohoapis.com/crm/v2/settings/modules',
    where: 'crm.zoho.com/crm/org<ID>/',
  },
};

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = wanted.length ? wanted : ['recruit', 'crm'];

function die(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  die(
    'Set the Self Client values first:\n\n' +
      '  export ZOHO_DC=com                 # or eu, in, com.au, jp, ca\n' +
      "  export ZOHO_CLIENT_ID='1000.XXXX'\n" +
      "  export ZOHO_CLIENT_SECRET='xxxx'\n" +
      '  export ZOHO_RECRUIT_ORG_ID=748xxxxxx\n' +
      '  export ZOHO_CRM_ORG_ID=600xxxxxx\n\n' +
      '  node migration/zoho-token.mjs            # both products\n' +
      '  node migration/zoho-token.mjs crm        # just one',
  );
}

for (const key of targets) {
  const cfg = SERVICES[key];
  if (!cfg) die(`Unknown product "${key}". Use recruit, crm, or neither for both.`);

  console.log(`\n${cfg.service}`);

  if (!cfg.orgId) {
    console.log(`  skipped: ${cfg.orgVar} is not set. The org id is in the address bar`);
    console.log(`  while you are logged in, as ${cfg.where}`);
    continue;
  }

  const res = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: cfg.scope,
      soid: `${cfg.service}.${cfg.orgId}`,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!json?.access_token) {
    const err = json?.error ?? `HTTP ${res.status}`;
    const hint =
      err === 'invalid_soid'
        ? `${cfg.orgVar}=${cfg.orgId} is not this product's org id. Recruit and CRM have\n` +
          '  different numbers, and it is easy to paste the other one.'
        : err === 'invalid_client' || err === 'INVALID_CLIENT'
          ? 'Either the client id is wrong, or ZOHO_DC=' +
            `${DC} is not the data centre the Self Client was created in.`
          : err === 'invalid_scope'
            ? 'This product is not enabled for the Self Client, or API access is not\n' +
              '  permitted on your Zoho profile. That is a profile permission, separate\n' +
              '  from being able to read records in the UI.'
            : 'Check the client id, secret, data centre and org id.';
    console.log(`  FAILED: ${err}\n  ${hint}`);
    continue;
  }

  const probe = await fetch(cfg.probe, {
    headers: { Authorization: `Zoho-oauthtoken ${json.access_token}` },
  });
  const body = probe.ok ? null : (await probe.text()).slice(0, 140);

  console.log(`  token minted, expires in ${json.expires_in ?? '?'}s`);
  console.log(`  scope granted   ${json.scope ?? 'not returned'}`);
  console.log(`  api domain      ${json.api_domain ?? 'not returned'}`);
  console.log(
    probe.ok
      ? `  read check      HTTP 200 against ${new URL(cfg.probe).host}`
      : `  read check      HTTP ${probe.status} against ${new URL(cfg.probe).host} :: ${body}`,
  );
  console.log(`  export ZOHO_ACCESS_TOKEN='${json.access_token}'`);
}

console.log(`
These tokens last one hour and cannot be renewed. You do not need to keep them:
migration/zoho-api.mjs mints its own per product and re-mints on expiry, given
ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and the two org ids. Use this script to prove the
credentials work, then let the client do it.
`);
