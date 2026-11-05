const { readFileSync } = require('node:fs');
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
for (const name of ['er-diagram.png', 'relational-schema.png']) {
  const image = readFileSync('PantryPal_Report_Assets/' + name);
  if (!image.subarray(0, 8).equals(signature)) {
    throw new Error(name + ' must be a valid PNG.');
  }
}
console.log('Team-supplied Chen and relational schema images verified; images left unchanged.');
