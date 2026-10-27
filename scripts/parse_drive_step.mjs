import fs from 'fs';

const html = fs.readFileSync('C:/Users/KruJames/.gemini/antigravity/brain/7ee11706-0566-4dcb-96e5-de35272a75b0/.system_generated/steps/1747/content.md', 'utf8');

const labels = [];
const labelRegex = /aria-label="([^"]+)"/g;
let m;
while ((m = labelRegex.exec(html)) !== null) {
  labels.push(m[1]);
}
console.log('Total aria-labels found:', labels.length);
labels.forEach(l => console.log(' -', l));

// Also search for folder links or IDs
const folderMatches = html.match(/folders\/[a-zA-Z0-9_-]+/g) || [];
console.log('Folder links:', [...new Set(folderMatches)]);
