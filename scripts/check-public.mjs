import fs from "node:fs";
import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
if (!files.length) throw Error("先 git add 本次要发布的文件，再运行发布检查");
const rules = [
  ["local user path", /\/Users\/[^/\s]+\//],
  [
    "private LAN address",
    /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/,
  ],
  [
    "credential-like string",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})\b/,
  ],
  ["hardware address", /\b(?:[a-f0-9]{2}:){5}[a-f0-9]{2}\b/i],
];
const failures = [];
for (const file of files) {
  if (
    /(?:^|\/)(?:backups|\.local|node_modules)(?:\/|$)|\.bin$|\.log$|\.private\.json$|(?:^|\/)\.env(?!\.example$)|verification.*\.json$/.test(
      file,
    )
  )
    failures.push(`${file}: private/generated file`);
  if (/\.(?:png|jpg|webp|gif)$/.test(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const [name, re] of rules)
    if (re.test(content)) failures.push(`${file}: ${name}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Public-source checks passed (${files.length} tracked files). Review screenshots separately; automated checks are not a secret-scanning guarantee.`,
  );
