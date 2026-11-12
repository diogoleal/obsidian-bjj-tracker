// Copia o plugin compilado para um vault: VAULT=/caminho/do/vault npm run install-vault
import fs from "fs";
import path from "path";

const vault = process.env.VAULT || process.argv[2];
if (!vault) {
  console.error("Informe o vault: VAULT=/caminho/do/vault npm run install-vault");
  process.exit(1);
}
if (!fs.existsSync(path.join(vault, ".obsidian"))) {
  console.error(`"${vault}" não parece ser um vault do Obsidian (sem pasta .obsidian).`);
  process.exit(1);
}
const dest = path.join(vault, ".obsidian", "plugins", "bjj-tracker");
fs.mkdirSync(dest, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  fs.copyFileSync(f, path.join(dest, f));
}
console.log(`Instalado em ${dest}. Ative "BJJ Tracker" em Configurações → Plugins da comunidade.`);
