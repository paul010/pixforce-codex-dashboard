# PixForce Codex Dashboard

A local 32×8 pixel dashboard for Codex usage and playful animations. Includes lifetime tokens, a 14-day activity chart, three procedural pixel cats, and 19 scenes in total.

This is an independent, unofficial project. The physical bridge has been tested on one PixForce C1 with original firmware 1.4.1.35e8735. Other firmware and hardware are unverified. No firmware or recovery backups are distributed.

## Try without hardware

Requires Node.js 22.21+. No runtime packages are required.

```sh
git clone https://github.com/paul010/pixforce-codex-dashboard.git
cd pixforce-codex-dashboard
npm run demo
```

Open http://127.0.0.1:8788/. Demo data is synthetic and clearly labelled. It does not read your account or connect to a clock.

Run `npm start` to preview your own account after installing and logging into the official Codex CLI. The app uses local App Server account methods; unavailable fields remain unknown.

## Always-on Ubuntu display with Mac statistics

Run the animation and MQTT sender on an always-on Ubuntu host. A Mac signed into Codex sends an allowlisted aggregate snapshot over existing SSH trust once per minute; Ubuntu reads it every 15 seconds. Set `PIXFORCE_METRICS_FILE` to the snapshot's absolute path to avoid requiring a Codex login on Ubuntu.

The clock keeps animating when the Mac sleeps or disconnects. Statistics become stale after 3 minutes and old values disappear after 5 minutes. Unknown days remain unknown. The app checks the actual MQTT subscription every 5 seconds and retries; manually returning to the original clock disables automatic takeover.

See the **[deployment guide](docs/ubuntu-mac-relay.md)** for Ubuntu user systemd setup, a clock-only firewall rule, Mac relay configuration, optional loopback SSH forwarding, the LaunchAgent installer, acceptance checks and rollback. The Mac relay uses this repository's independent App Server client, not a private external collector. Account method availability still depends on your CLI and account.

The Ubuntu/PixForce bridge was verified on Ubuntu 22.04 x86_64 with Node 22.23.4, including service restart recovery and continued animation while the Mac aggregate source was paused. A full VM or host reboot was not tested. Keep both the VM and its host running.

## Connect a clock

Copy `.env.example` to `.env`. Set `PIXFORCE_IP` to the clock address and `PIXFORCE_HOST_IP` to your computer's reachable LAN address. Run `npm run clock`.

Hardware mode changes the clock's Awtrix receiver configuration and enters that app. It preserves other display apps and does not flash firmware. Normal shutdown attempts to return to the original clock app. Network loss or a forced termination may require switching with the device buttons.

The console binds only to loopback. MQTT binds to the configured LAN interface and filters the clock IP; this is not authenticated transport. Use only on a trusted LAN, without public port forwarding.

`npm test` runs without hardware or an account; relay integration tests additionally use Python 3. See the [Chinese guide](README.md), [protocol notes](docs/hardware.md), and [data definitions](docs/data.md).

Original code and procedural artwork: MIT. See [NOTICE](NOTICE.md) for references and scope.
