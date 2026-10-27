async function test() {
  const url = 'https://www.facebook.com/BnKhlngMddang/posts/pfbid02W5z4HnN6w1X186J83yQ4e3aV2cWnKxZk9Ew8Q9H6jLg';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'facebookexternalhit/1.1' }
  });
  const html = await res.text();
  const ogTitle = (html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i))?.[1] || '';
  const ogDesc = (html.match(/property="og:description"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:description"/i))?.[1] || '';
  const ogImg = (html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i))?.[1] || '';
  console.log('Title:', ogTitle);
  console.log('Desc:', ogDesc);
  console.log('Img:', ogImg);
}
test();
