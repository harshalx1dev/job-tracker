import { writeFileSync } from "node:fs";
import { generateKitSource, kitVersion } from "./kit-source";

writeFileSync("src/lib/claude-kit.generated.ts", generateKitSource());
writeFileSync("docs/claude-code-kit/.kit-version", `${kitVersion()}\n`);
console.log(
  "src/lib/claude-kit.generated.ts and docs/claude-code-kit/.kit-version written",
);
