# Getting the Zoho data by API instead of by export

The API reaches things the CSV exports cannot. Two of the three original reasons survive contact with the live API, and the first does not. Verified 2026-09-03 with a live Recruit token.

1. ~~**Education and Experience.**~~ **Wrong, corrected 2026-09-03 against the live API.**
   The claim was that the CSV export was lossy and the API would return these subforms
   inline on the candidate detail record. Neither half is true. There is no education or
   experience data in the Zoho org at all, so there was never anything to import.

   Two independent sources agree. `Candidates_Educational_Details.csv` and
   `Candidates_Experience_Details.csv` each hold **0 data rows** under their three
   header columns. And a live run over 40 candidates returned 0 subform entries, with
   **no education or experience field among the 97 keys** present on a detail record;
   the only subform-shaped key is `Skill_Set`, empty on all 40. The detail endpoint does
   not return them inline because there is nothing to return, and Recruit exposes no
   Education or Experience module among its 23 modules.

   This does not need chasing further. It needs the migration plan to stop listing it.
2. **Attachment file bytes. Confirmed 2026-09-03 against the live API.** `Attachment URL`
   was empty on all 50 exported rows, so the export is metadata only. The API returns
   the real files: 50 attachments across 40 distinct candidates, PDFs of 60KB to 220KB,
   with `File_Name`, `Size` and an `id` per attachment. This is the reason the API route
   is worth the setup.

   **The export's `Parent Id` is prefixed `Zrecruit_`.** `Zrecruit_837085000004666040`
   must be stripped to `837085000004666040` to address a candidate. Unstripped, the
   attachments endpoint returns HTTP 404 `INVALID_URL_PATTERN`; stripped, HTTP 200 with
   the attachment list. Anything joining export rows to API records has to strip it, or
   every attachment silently fails to find its candidate.
3. **Job openings and applications.** Never exported at all. Without them, 13 of the 154
   notes have no parent to attach to.

It also removes the need to ask anyone to run an export by hand each time.

## Read this before running anything: credits and scale

**Zoho meters API credits per day.** The org's allowance is **6,250**, and every request costs one, including the paging calls that merely enumerate records. The console shows consumption under API usage.

**The Recruit org held over 70,200 candidates on 2026-09-03.** The CSV export the whole migration was built against holds **75**. That is not a sample, it is 0.1% of the data, and every count in the migration reports is a count of those 75.

That changes what is feasible. One detail call plus one attachment call per candidate over 70,200 records is about **140,000 credits, roughly 23 days of full daily allowance**:

| Work | Requests |
| :---- | :---- |
| Paging 70,200 candidates at 200 per page | 351 |
| One detail call per candidate | 70,200 |
| One attachment call per candidate | 70,200 |
| **Total** | **140,751** |

So `zoho-api.mjs` now carries a **credit budget, default 1,500**, counted per request and enforced before the request is sent. Exceeding it aborts the whole run rather than one module. An unbounded run prints the numbers above before it starts.

```sh
node migration/zoho-api.mjs --limit 200            # a bounded sample
node migration/zoho-api.mjs --budget 3000 ...      # raise the ceiling deliberately
```

Two consequences worth deciding before spending anything else:

- **The per-candidate detail call is the wrong shape at this scale.** The list endpoint accepts a `fields` parameter, so the fields currently fetched one record at a time can come back in the 351 paging calls instead. That is a 200x reduction and it is the only way a full pull is affordable.
- **Attachments have no bulk endpoint**, so they genuinely cost one call per candidate. They have to be scoped to the candidates actually being imported, not the whole org.

## The short way: client credentials

**Correction, 2026-09-02.** The authorization-code steps below are not the only route and not the easiest one. A Self Client also supports the **client credentials** flow, which needs no grant code, no 10-minute window and no OTP. Two values from the console plus one from the address bar.

1. At `api-console.zoho.com`, create a **Self Client** and copy the **Client ID** and **Client Secret**. That is all the console is needed for; there is no Generate Code step in this flow.
2. Get the org id from the address bar while logged in. Zoho puts it in the path: `recruit.zoho.com/recruit/org748xxxxxx/...` and `crm.zoho.com/crm/org600xxxxxx/...`. Recruit and CRM have different ids.
3. Set four variables and run the client:

   ```sh
   export ZOHO_DC=com
   export ZOHO_CLIENT_ID=...
   export ZOHO_CLIENT_SECRET=...
   export ZOHO_RECRUIT_ORG_ID=...
   export ZOHO_CRM_ORG_ID=...

   node migration/zoho-api.mjs --limit 5
   ```

### Proving the credentials, one product at a time

`migration/zoho-token.mjs` mints a client-credentials token per product and proves it with a read, so a credential problem is separated from a client problem:

```sh
node migration/zoho-token.mjs            # both products
node migration/zoho-token.mjs crm        # just one
```

It reports the scope Zoho actually granted, the api domain it returned, and the result of a live `settings/modules` read. Each error carries its cause: `invalid_soid` means the org id belongs to the other product, `invalid_client` means a wrong client id or a `ZOHO_DC` mismatch, and `invalid_scope` means the product is not enabled on the Self Client or API access is not permitted on your Zoho profile.

**The two products do not share a host.** Recruit answers on `recruit.zoho.{dc}` and returns 404 on `zohoapis.com/recruit`; CRM answers on `www.zohoapis.com/crm` and not on `crm.zoho.com`. Verified 2026-09-03.

Nothing needs keeping from this script. It exists to prove the four values are right; after that `zoho-api.mjs` mints its own tokens per product and re-mints on expiry.

The `soid` parameter is `{service}.{orgid}`, for example `ZohoRecruit.748xxxxxx`, and the client builds it. Because the scope is per request, Recruit and CRM get separate access tokens, which the client mints and caches independently.

What you give up: **there is no refresh token in this flow.** An access token lasts one hour, and the client simply requests another when it expires, which costs nothing extra because the credentials never change. For a migration run that is strictly better than storing a token that never expires.

`invalid_soid` means the org id belongs to the other product or another portal. `INVALID_CLIENT` still means `ZOHO_DC` does not match the data centre.

## Whether you can do this yourself

You said John owns both Zoho accounts and gave you access. That is usually enough, with
one condition: **your user profile in each Zoho org needs API access enabled.** In Zoho
that is a profile permission, not the same thing as being able to log in and read
records. Two possible outcomes:

- Your profile already permits it. You create a Self Client yourself and never involve
  John.
- Your profile does not. Zoho will refuse to issue the grant token, and John has to
  either enable API access on your profile or create the Self Client once and hand you
  the three values. That is a two-minute job for him and does not require him to run
  exports again, which is the thing you were trying to avoid.

Try it first. You will know within five minutes.

## Steps

Everything happens at `api-console.zoho.com`, logged in with **your own** Zoho account.

1. Go to `https://api-console.zoho.com` and choose **Self Client**. Not "Server-based",
   not "Web-based": Self Client is the one that issues a token without a redirect URL.
2. Note the **Client ID** and **Client Secret**.
3. Open the **Generate Code** tab and enter, as one comma-separated string:

   ```
   ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL,ZohoCRM.modules.ALL,ZohoCRM.settings.READ,ZohoCRM.users.READ
   ```

   Set the duration to 10 minutes and give any description. Pick the correct
   **portal/organisation** if you are asked, since you have access to John's.
4. Copy the **grant code**. It is single-use and expires in 10 minutes.
5. Exchange it for a refresh token straight away, with `migration/zoho-refresh-token.mjs` rather than a raw curl. The script does the exchange, then proves the token by minting an access token from it and reading Recruit's module list, and it names the cause of each Zoho error rather than leaving you with a bare code:

   ```sh
   export ZOHO_DC=com                 # or eu, in, com.au, jp, ca
   export ZOHO_CLIENT_ID='1000.XXXX'
   export ZOHO_CLIENT_SECRET='xxxx'
   export ZOHO_RECRUIT_ORG_ID=748xxxxxx     # optional, enables the Recruit read check

   node migration/zoho-refresh-token.mjs PASTE_GRANT_CODE_HERE
   ```

   It prints only the refresh token, because that is the one new value, and never echoes the client secret back to the terminal. `invalid_code` means the code was reused or the 10 minutes elapsed. `invalid_client` has two causes and the script lists both: a wrong client id first, a `ZOHO_DC` mismatch second. If Zoho accepts the code but returns no refresh token, the Self Client was created for client credentials, which needs no refresh token at all: use "The short way" above.

   The response contains `refresh_token`. **That value does not expire** and is
   equivalent to standing access to both systems, so treat it like a password.

6. Put the values in your shell, not in a file in this repository:

   ```sh
   export ZOHO_DC=com
   export ZOHO_CLIENT_ID=...
   export ZOHO_CLIENT_SECRET=...
   export ZOHO_REFRESH_TOKEN=...
   ```

### Data centre

`ZOHO_DC` has to match the data centre the account lives in, and the accounts URL in
step 5 has to match too. If the org is on `zoho.eu` then it is `accounts.zoho.eu` and
`ZOHO_DC=eu`. A mismatch shows up as `401 INVALID_CLIENT`, which is confusing because
the client really does exist, just in another region. Check the domain in your browser
when logged in to Zoho.

## Pulling the data

```sh
node migration/zoho-api.mjs                          # everything, metadata only
node migration/zoho-api.mjs --module Candidates      # one module
node migration/zoho-api.mjs --limit 5                # first 5 records, to prove access
node migration/zoho-api.mjs --with-files             # also download attachment bytes
```

Start with `--limit 5`. It confirms the credentials and the scopes without pulling
thousands of records or burning the daily API quota.

Output is JSON, one file per module, into `migration/zoho-exports/`. That directory is
gitignored: these are real candidate and customer records.

## Rate limits

Zoho enforces per-minute and per-day API credit limits, and the exact numbers depend on
the edition. The client backs off on 429 and on 5xx rather than retrying immediately.
The per-candidate detail and attachment calls are the expensive part: one call each per
candidate, so 75 candidates is roughly 150 calls plus the list pages. `--with-files`
adds one more call per attachment.

## How this fits with the importer

**The API does not replace the importer.** The file-based importer stays the way data
gets into FOOS. The API is only a faster way of getting the same files, without asking
anyone to run an export by hand.

So `zoho-api.mjs` writes two things:

| Path | What it is |
| :---- | :---- |
| `migration/zoho-exports/api-csv/` | The same CSV shape the hand exports have, ready for `import.mjs` with no changes |
| `migration/zoho-exports/api-raw/` | The raw JSON, kept because it is richer and worth having if a mapping question comes up |

The CSV writer takes its column order from an existing hand export of the same name, so
keep one of each in `migration/zoho-exports/` as the header template. It converts Zoho's
ISO-8601 timestamps back to the `MM/DD/YYYY hh:mm AM/PM` the exports use, and flattens
`{id, name}` lookups to the display name, so the importer's parser needs no second code
path.

To use a pull:

```sh
node migration/zoho-api.mjs --limit 5                       # prove access first
node migration/zoho-api.mjs                                 # full pull
node migration/import.mjs --dir migration/zoho-exports/api-csv   # dry run on it
```

### The field-name caveat

Zoho's API field names are usually the display label with underscores, but not always,
and there are 110 candidate columns. Rather than invent all of them, the tool derives
each name and then **reports every export column that matched no API field on any
record**. Those are the wrong guesses, and they are the ones to correct in
`src/api-field-names.mjs` once you have a real pull in front of you. Blank columns are
therefore visible rather than silent, which is the failure mode that matters: a silently
blank `Rating` column would look like a clean import and lose the grading.

## Least-privilege note

The scope list above includes `ZohoRecruit.modules.ALL`, which is read **and write**.
Zoho does not offer a read-only variant for the modules scope, so this is as tight as it
gets while still being able to read. Nothing in `zoho-api.mjs` issues a POST, PUT or
DELETE against Zoho: it only reads and writes to local disk. Revoke the client in the
API console when the migration is done.
