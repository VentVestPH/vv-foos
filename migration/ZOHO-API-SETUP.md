# Getting the Zoho data by API instead of by export

The API reaches three things the CSV exports cannot, which is why it is worth the setup:

1. **Education and Experience.** These are subforms. The CSV export produced only
   `TABULARROWID, Candidate Id, Candidate Name` with no institution, degree, employer,
   title or date column, so nothing was importable. The API returns them inline on the
   candidate detail record.
2. **Attachment file bytes.** `Attachment URL` was empty on all 50 exported rows, so the
   export is metadata only. The API has a download endpoint per attachment.
3. **Job openings and applications.** Never exported at all. Without them, 13 of the 154
   notes have no parent to attach to.

It also removes the need to ask anyone to run an export by hand each time.

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
5. Exchange it for a refresh token straight away. Replace the three values and run:

   ```sh
   curl -s -X POST 'https://accounts.zoho.com/oauth/v2/token' \
     -d 'grant_type=authorization_code' \
     -d 'client_id=YOUR_CLIENT_ID' \
     -d 'client_secret=YOUR_CLIENT_SECRET' \
     -d 'code=YOUR_GRANT_CODE'
   ```

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
