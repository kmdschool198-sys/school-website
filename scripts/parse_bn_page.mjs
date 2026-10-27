import fs from 'fs';

const html = fs.readFileSync('scripts/bn_page.html', 'utf8');

// Decode entities
const decoded = html.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
                    .replace(/&#([0-9]+);/gi, (_, d) => String.fromCharCode(parseInt(d, 10)));

fs.writeFileSync('scripts/bn_page_decoded.txt', decoded);
console.log('Decoded length:', decoded.length);

// Find all occurrences of Thai strings longer than 20 chars
const thaiMatches = decoded.match(/[\u0E00-\u0E7F\s]{20,}/g) || [];
console.log('Thai phrases found:', thaiMatches.length);
const uniqueThai = [...new Set(thaiMatches.map(t => t.trim()))].filter(t => t.length > 25);
console.log('Unique Thai (>25 chars):', uniqueThai.length);
uniqueThai.slice(0, 30).forEach((t, i) => console.log(`${i + 1}: ${t.slice(0, 100)}`));

// Find any story_fbid, pfbid, or post_id or entity_id
const fbidMatches = decoded.match(/(?:story_fbid|post_id|fbid|pfbid)[=:\"0-9a-zA-Z_]+/g) || [];
console.log('FBID matches:', [...new Set(fbidMatches)].slice(0, 20));

// Find any dates
const dates = decoded.match(/\b\d{1,2}\s+(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(?:256[0-9]|202[0-9])\b/g) || [];
console.log('Dates found:', [...new Set(dates)]);
