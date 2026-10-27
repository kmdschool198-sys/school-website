import fs from 'fs';

function decodeEntities(str) {
  return str.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&#([0-9]+);/gi, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
}

const list = [
  { name: 'KPP2 Avocado', url: 'https://www.facebook.com/BnKhlngMddang/photos/1579001500689363/' },
  { name: 'ESPORTS Video', url: 'https://www.facebook.com/BnKhlngMddang/videos/2250679102441102/' },
  { name: 'BM School CEO', url: 'https://www.facebook.com/61550952843702/posts/122320233626031761/' },
  { name: 'BM Thank You', url: 'https://www.facebook.com/61550952843702/posts/122316803672031761/' },
  { name: 'Paka Science', url: 'https://www.facebook.com/61553674109132/posts/122294113502122470/' },
  { name: 'Paka Expand/Thanks', url: 'https://www.facebook.com/61553674109132/posts/122295458078122470/' },
  { name: 'Paka Sunthornphu', url: 'https://www.facebook.com/61553674109132/photos/122291371400122470/' }
];

async function check() {
  const out = [];
  for (const item of list) {
    try {
      const res = await fetch(item.url, {
        headers: { 'User-Agent': 'facebookexternalhit/1.1' }
      });
      const html = await res.text();
      const ogTitle = (html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i))?.[1] || '';
      const ogDesc = (html.match(/property="og:description"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:description"/i))?.[1] || '';
      const ogImg = (html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i))?.[1] || '';
      const decodedTitle = decodeEntities(ogTitle);
      const decodedDesc = decodeEntities(ogDesc);
      console.log('=== ' + item.name + ' ===');
      console.log('Title:', decodedTitle);
      console.log('Desc:', decodedDesc.slice(0, 150));
      console.log('Img:', ogImg ? ogImg.slice(0, 80) + '...' : 'none');
      out.push({
        ...item,
        title: decodedTitle,
        desc: decodedDesc,
        img: ogImg
      });
    } catch(e) {
      console.log('Error for ' + item.name + ':', e.message);
    }
  }
  fs.writeFileSync('scripts/candidate_results.json', JSON.stringify(out, null, 2));
}
check();
