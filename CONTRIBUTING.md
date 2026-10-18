# Contributing

Please run `npm test` before submitting a change. Stage the intended files and run `npm run privacy-check` before pushing.

Use synthetic fixtures and clearly labelled demo screenshots. Do not commit `.env`, account captures, local paths, LAN addresses, device identifiers, firmware / NVS images, private backups or recordings of credentials.

New scenes should return exactly 256 RGB values (0–255). Preserve missing / zero distinctions for data-driven scenes. Hardware reports should name the model and firmware, separate emulation from a physical test, and avoid claiming support for untested devices.

Do not attach real account data or full device logs to public issues. A minimal redacted reproduction is preferred.
