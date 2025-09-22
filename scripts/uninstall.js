import fs from "fs-extra";

import getNames from "./names.js";

const { batFilePath } = getNames();

fs.unlinkSync(batFilePath);

console.log(`${batFilePath} removed`);
