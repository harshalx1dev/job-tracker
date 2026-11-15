import { writeFileSync } from "node:fs";
import { generateKitSource } from "./kit-source";

writeFileSync("src/lib/claude-kit.generated.ts", generateKitSource());
console.log("src/lib/claude-kit.generated.ts written");
