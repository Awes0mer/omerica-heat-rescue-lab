# Run Heat Rescue without OpenAI Sites

The complete app can run on your own computer or server using **Caddy**, an open-source HTTP server. No OpenAI account, Sites deployment, API key, Valency account, database, npm installation, Docker Desktop, or external model service is required at runtime.

Caddy serves the files in `dist/`. The browser runs the simulation and AI optimizer in local Web Workers. Fonts, scripts, citations and saved benchmark data are included. The supplied server policy restricts executable resources and runtime connections to the same origin. Scientific reference links remain ordinary external links that open only when clicked.

## Start locally

1. Install Caddy using its [official installation instructions](https://caddyserver.com/docs/install). On a Mac with Homebrew, `brew install caddy` is an available option. Caddy is a separate installation, not bundled in this repository.
2. From the project folder, run:

```sh
./hosting/run.sh
```

3. Open **http://127.0.0.1:8088/#ai** in a browser. Stop the foreground server with **Ctrl+C**.

The default binds only to this computer. Explicit local HTTP avoids installing a local certificate authority or changing your trust store. To use a separately downloaded Caddy executable:

```sh
HEAT_RESCUE_CADDY_BIN=/absolute/path/to/caddy ./hosting/run.sh
```

Validate without starting a listener:

```sh
./hosting/run.sh validate
```

If port 8088 is occupied, choose another port:

```sh
HEAT_RESCUE_ADDRESS=http://127.0.0.1:8090 ./hosting/run.sh
```

Serve the app over HTTP rather than opening `index.html` as a local file; browsers restrict module workers under `file://`. Once Caddy and the source are installed, the experiment needs no internet connection. The machine must stay awake while serving the app.

## Use your own Linux server later

Linux + Caddy + an open-source browser such as Firefox provide an open-source runtime stack. A Mac can run the same server, but macOS itself is proprietary. Hardware, internet connectivity, domain registration and certificate services are separate from the application source license.

Install Caddy through its official distribution instructions. Copy the repository to a directory readable by the server user, then supply your own DNS name and explicit network binding:

```sh
HEAT_RESCUE_ADDRESS=heat.your-domain.example \
HEAT_RESCUE_BIND=0.0.0.0 \
./hosting/run.sh
```

Replace the example name with a domain you control. Point its DNS A record to the server; configure AAAA only if IPv6 also reaches Caddy. Public HTTPS requires reachable ports 80/443, permission to bind them, and persistent writable certificate storage. Use Caddy's documented [system service setup](https://caddyserver.com/docs/running) for a permanent deployment. Preserve the environment variables and ensure the service reads the absolute `dist/` path. This configuration disables Caddy's admin API, so use service restart rather than API reload.

Caddy's [automatic HTTPS](https://caddyserver.com/docs/automatic-https) obtains and renews public certificates once those conditions are met. The local demo does not create DNS records, expose your Mac to the internet, request a public certificate, or migrate the existing hosted URL.

## Licenses and boundaries

- Heat Rescue source and these hosting scripts/configuration: [MIT](LICENSE).
- Separately installed Caddy: [Apache License 2.0](https://github.com/caddyserver/caddy/blob/v2.11.7/LICENSE), with upstream dependencies retaining their own licenses. Tested server version: **2.11.7**. Use an official unmodified package; this repository does not redistribute its compiled binary.
- Bundled fonts and random routine: retained [OFL and CC0/public-domain notices](dist/third-party/README.md).

The app's original authoring and optional OpenAI Sites demo are separate services. This setup removes the requirement to use OpenAI Sites for hosting; it does not claim those external services or the Mac operating system became open source. Valency's prior research role and licensing scope are documented in [COMPLIANCE.md](dist/COMPLIANCE.md).

## Verification

Use `npm test` for the scientific/model tests, or serve the app and run the AI experiments in the browser. Hosting checks should verify a full worker campaign, no off-origin runtime requests, locally loaded fonts, correct JavaScript MIME types, and 404 responses for repository configuration paths. Only `dist/` is exposed; source/configuration above that directory is not served.

Local verification on October 22, 2026 used unmodified Caddy 2.11.7 on macOS ARM64 at port 8088. With every off-origin browser request blocked, all 54 experiment observations completed, both fonts loaded, and the browser reported zero errors or attempted external requests. Blocking pipe B raised its modeled hot plate from 63.3°C to 63.9°C while total generated power changed from 1.28 W to 1.17 W during the check. JavaScript and font MIME types were correct; `.git`, `.openai`, hosting configuration and unknown paths returned HTTP 404. These checks verify the hosting path, not hardware accuracy.

No physical model parameters or benchmark results are changed by this hosting setup.
