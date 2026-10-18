# References and provenance

This repository contains an independent local dashboard and protocol client. It does not vendor, build or redistribute any device firmware, third-party source tree, large cat sprite sheet, recovery utility, flash dump, NVS image or device credential.

- [yinbaiyuan/Dot2d_esp32](https://github.com/yinbaiyuan/Dot2d_esp32): original project context. Its own LICENSE is separate and is not replaced by this repository's MIT license.
- [PixForce Awtrix manual](https://www.yinbaiyuan.com/doc/16/): original receiver settings and concept.
- [yinbaiyuan/AWTRIX2.0-Controller](https://github.com/yinbaiyuan/AWTRIX2.0-Controller), forked from the AWTRIX controller: reference for the wire command format (DrawBMP, RGB565, Show), not copied firmware. Upstream declares BSD-2-Clause; its source remains under its own license.
- [OpenAI App Server documentation](https://learn.chatgpt.com/docs/app-server): account method and stdio initialization reference. The standalone client here does not depend on the author's private dashboard or session files.
- The three cats are original programmatic pixel interpretations of the author's cats, named 国庆, 贝果 and 点点. No photograph or pre-existing sprite-sheet pixels are included.
- `test/fixtures` and `demo.mjs` contain synthetic examples, not real device identities or account usage. The README screenshot is captured from that synthetic demo.

OpenAI, Codex, PixForce and AWTRIX names identify interoperability targets and their respective owners. This is not an official integration or a claim that every model/firmware is compatible.
