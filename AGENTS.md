# Working on DONATECONTROL

Read [docs/agent-context.md](docs/agent-context.md) before changing this project. It contains the full feature descriptions, current UI requirements, provider setup and limitations, storage/security behavior, architecture, and verification workflow moved out of the README.

Additional references:

- [docs/api-integration.md](docs/api-integration.md): provider endpoints, normalization, and privacy rules.
- [docs/provider-verification.md](docs/provider-verification.md): dated test evidence and remaining real-account checks.
- [docs/overlay-themes.md](docs/overlay-themes.md): themes, fonts, animation, and rendering behavior.
- [docs/design.md](docs/design.md): dashboard design reference; current product requirements in agent-context take precedence.

Use Node.js 22.12+ and npm. Build with `npm run build`, run with `npm start`, or use `npm run dev` for source watching. Validate relevant changes with `npm run typecheck`, `npm test`, and `npm run build`; visually check UI changes at desktop and mobile widths.

Preserve local configuration, credentials, donation history, and operator settings. Use an isolated NodeCG root/port for tests that alter runtime data or trigger alerts. Do not commit `.env`, `.secrets/`, `db/`, logs, uploaded assets, or the real `cfg/nodecg.json`.

Keep the internal `gofundme-live` bundle name and `classic` theme key compatible with existing URLs and persisted settings. The public names are DONATECONTROL and Custom.

Update agent context when behavior changes. Keep the README short: name, author, installation, and current features.
