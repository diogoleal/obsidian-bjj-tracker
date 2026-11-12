// Copies the built plugin into a vault: VAULT=/path/to/vault npm run install-vault
import fs from "fs";
import path from "path";

const vault = process.env.VAULT || process.argv[2];
if (!vault) {
  console.error("Usage: VAULT=/path/to/vault npm run install-vault");
  process.exit(1);
}
if (!fs.existsSync(path.join(vault, ".obsidian"))) {
  console.error(`"${vault}" does not look like an Obsidian vault (no .obsidian folder).`);
  process.exit(1);
}
const dest = path.join(vault, ".obsidian", "plugins", "bjj-tracker");
fs.mkdirSync(dest, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  fs.copyFileSync(f, path.join(dest, f));
}
console.log(`Installed to ${dest}. Enable "BJJ Tracker" under Settings → Community plugins.`);
