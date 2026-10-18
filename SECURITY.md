# Security and privacy

This is a hobby integration for a trusted local network, not an authenticated public service. HTTP binds to loopback. Hardware MQTT filters an explicitly configured device IP but has no cryptographic authentication or TLS. Do not expose either service through public port forwarding.

The project reads account aggregates through the locally installed Codex CLI. It does not read auth files or conversations. Demo mode uses synthetic data and has no account or hardware access.

Do not post credentials, `.env`, account JSON, device identifiers or recovery dumps in public issues. For a sensitive finding, use GitHub's private vulnerability reporting if the repository offers it; otherwise post only a non-sensitive request for a private contact channel.
