import fs from 'fs';

const text = fs.readFileSync('scripts/debug_decoded.txt', 'utf8');
const match = text.match(/href="https:\/\/m\.facebook\.com\/61550952843702\/posts\/([^"]+)"/);
if (match) {
  console.log('Decoded URL slug:\n', decodeURIComponent(match[1]));
}

