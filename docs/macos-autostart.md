# macOS 登录后启动

先手动验证 `npm run clock`。项目运行目录建议放在本机普通目录，避免仅存在于 iCloud 的占位文件。

通过系统“登录项”或用户 LaunchAgent 启动时：

- 使用 Node 的绝对可执行路径。
- 把工作目录设为本项目目录，以便读取该目录 `.env`。
- 参数为 `--env-file-if-exists=.env`、`server.mjs`、`--activate`。
- 保证 PATH 包含 `codex`，或在 `.env` 指定 `CODEX_BIN`。
- 每个设备只运行一份硬件服务，避免 MQTT / HTTP 端口冲突。
- 将日志放在项目外或被忽略的本地目录；不要把日志、系统启动项中的个人路径或 `.env` 提交到 Git。

仓库不附带绑定作者用户名的 LaunchAgent，也不会自动安装启动项。修改后请读回进程状态、控制台和时钟显示，再认为自动启动已生效。

若使用 [Ubuntu 常驻 + Mac 汇总同步](ubuntu-mac-relay.md)，Mac 不再运行上述硬件服务。该模式提供单独的 `deploy/install-mac-relay.mjs`，由用户手动运行后生成统计同步 LaunchAgent；它不接管时钟、不安装管理隧道。旧硬件启动项应停用备用，避免 Ubuntu 和 Mac 同时控制设备。
