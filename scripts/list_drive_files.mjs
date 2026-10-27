import fs from 'fs';
const html = fs.readFileSync('C:/Users/KruJames/.gemini/antigravity/brain/7ee11706-0566-4dcb-96e5-de35272a75b0/.system_generated/steps/1491/content.md', 'utf8');

const allLabels = [];
const regex = /aria-label="([^"]+)"/g;
let match;
while ((match = regex.exec(html)) !== null) {
  allLabels.push(match[1]);
}
console.log('Total aria-labels:', allLabels.length);
console.log('Sample non-image labels:', allLabels.filter(l => !l.includes('.jpg')).slice(0, 30));

