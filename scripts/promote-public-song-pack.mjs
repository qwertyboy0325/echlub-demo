#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourcePath = resolve(process.env.PACK_PATH ?? "local-reconstruction/shiki-no-uta.score-concept.pack.json");
const outputPath = resolve(process.env.OUTPUT_PATH ?? "public/shiki-no-uta.demo.pack.json");
const pack = JSON.parse(await readFile(sourcePath, "utf8"));

pack.metadata = {
  ...pack.metadata,
  id: "shiki-no-uta-cover-public-demo-v1",
  title: "Shiki No Uta · EchLub browser cover demo",
  source: "public-demo",
};
pack.provenance = {
  ...pack.provenance,
  createdBy: "EchLub owner-authorized public cover demo",
  rightsBasis: "owner-authorized-public-cover",
  referenceAssetIds: [],
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`Wrote public derived-data pack: ${outputPath}`);
