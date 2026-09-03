import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      results.push(...walk(full));
    } else if (/\.(tsx?|jsx?)$/.test(full)) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('src');
const routes = new Set();
const apiCallDetails = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const matches = line.matchAll(/['"`](\/api\/[^'"`]+)['"`]/g);
    for (const m of matches) {
      routes.add(m[1]);
      apiCallDetails.push({ file: path.relative('.', file), line: idx + 1, call: m[1] });
    }
  });
}

console.log('--- ALL FRONTEND API ROUTES ---');
console.log(Array.from(routes).sort());
console.log('\n--- DETAILS ---');
for (const d of apiCallDetails) {
  console.log(`${d.file}:${d.line} -> ${d.call}`);
}
