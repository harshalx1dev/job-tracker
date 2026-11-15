// Writes docs/claude-playbook.md from the playbook the app serves.
// Run after editing src/lib/claude-playbook.ts: npx tsx scripts/write-playbook.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { PLAYBOOK } from "../src/lib/claude-playbook";

mkdirSync("docs", { recursive: true });
writeFileSync("docs/claude-playbook.md", PLAYBOOK);
console.log("docs/claude-playbook.md written");
