# FOOS local isolation

FOOS owns the Supabase project identity `VV-FoOS`. The CLI creates project-scoped containers, persistent database and Storage volumes, and a Docker network. Do not attach this stack to a shared network or reuse another project's volumes or credentials.

| Service | Local port |
| --- | --- |
| Shadow database | 56320 |
| API, Auth, REST, Storage, Realtime and Edge Functions gateway | 56321 |
| PostgreSQL | 56322 |
| Studio | 56323 |
| Mailpit web interface | 56324 |
| Mailpit SMTP | 56325 |
| Mailpit POP3 | 56326 |
| Analytics | 56327 |
| Edge runtime inspector | 56328 |
| Optional pooler (disabled by default) | 56329 |
| Frontend | 5176 |

Mailpit captures local Auth mail. Its inbox and SMTP service belong to this stack. Google/Gmail integration is separate: use local test secrets and avoid configuring real Google accounts for isolated development.

Run from this checkout:

```sh
npm run local:check
npm run local:start
npm run local:status
FOOS_PORT=5176 npm run dev --workspace=app
```

`local:check` verifies the project identity, all ten backend ports, and local URL overrides. It temporarily binds each port to check availability. `local:start` performs the same checks before starting services; if any port is occupied, it refuses and leaves its owner running. If FOOS is already running, use `local:status` instead of starting it again. Start Vite with `FOOS_PORT=5176` (the checked free port in this setup). The test config uses the same value from `tests/.env`.

Visit Studio at <http://127.0.0.1:56323> and Mailpit at <http://127.0.0.1:56324>. SMTP clients use `127.0.0.1:56325`.

`npm run local:stop` targets only `VV-FoOS` and preserves its volumes. The wrapper accepts no extra flags, including flags that stop all projects or remove data. It anchors CLI operations to this checkout and removes inherited `SUPABASE_*` overrides. Never run host-wide Docker prune, stop or restart commands for this project.

`npm run db:reset` explicitly resets the FOOS **local** database, applies migrations and seed data, then seeds test personas. It destroys FOOS local records; it is not a startup command. Recovery restarts address only `supabase_edge_runtime_VV-FoOS` and `supabase_kong_VV-FoOS`. Missing containers cause a skip, never a fallback to another project.

Development reads `app/.env.development`, and tests read `tests/.env`. Both must use `http://127.0.0.1:56321` and FOOS's local anon key from `local:status`. Database tools use `postgresql://postgres:postgres@127.0.0.1:56322/postgres`. Local helpers reject other loopback ports. Import commands that already support explicit remote operation still require their remote opt-in. The frontend binds to port 5176; Supabase Auth redirects are scoped to that frontend port. Hosted deployment configuration is independent from local startup.

Verify isolation without starting, resetting or restarting a database:

```sh
npm run test:local-isolation
npm run local:check
```

The regression suite mocks lifecycle commands and checks exact container targeting, occupied-port refusal, project configuration, URL validation, inherited CLI overrides and rejection of broad stop flags. It does not prove runtime networking or migration success; those require starting the FOOS stack.
