import path from "node:path";

import fs from "fs-extra";

import getNames from "./names.js";

const { batFilePath } = getNames();

fs.writeFileSync(batFilePath, `
@echo off
node "${path.resolve(import.meta.dirname, "..", "src", "main.js")}" %*
`);

console.log(`${batFilePath} created`);
