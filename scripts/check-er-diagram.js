const { readFileSync } = require('node:fs');
const image = readFileSync('PantryPal_Report_Assets/er-diagram.png');
if (!image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
  throw new Error('The supplied ER diagram must be a valid PNG.');
}
console.log('Team-supplied Chen diagram verified; image left unchanged.');
