import fs from 'fs';
import path from 'path';

const images = [
  {
    file: 'fb_bm_school_ceo.jpg',
    url: 'https://scontent.fbkk7-2.fna.fbcdn.net/v/t39.30808-6/763089246_122320233740031761_4918734136643040236_n.jpg?stp=dst-jpg_tt6&cstp=mx1448x2048&ctp=p600x600&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=b96d88&_nc_ohc=g2ST0FT6_EYQ7kNvwGr5qp1&_nc_oc=AdrcSVfi1rNPWAP3HtVP_Sxox1ddJ0ukOy6kG5NkPg_0YGUDk_6cFyusNBWJZ6CVV9A&_nc_zt=23&_nc_ht=scontent.fbkk7-2.fna&_nc_gid=a3xtYUM5Bz1eT7BGnkF6TQ&_nc_ss=7f289&oh=00_AQIvtbQP1tIJuxOPy54GP9VCrPyyjsuVFsqEKO4gSMAXpw&oe=6AB28951'
  },
  {
    file: 'fb_bm_thanks.jpg',
    url: 'https://scontent.fbkk6-1.fna.fbcdn.net/v/t39.30808-6/741209718_122316803654031761_8437268682363918563_n.jpg?stp=dst-jpg_tt6&cstp=mx1448x1086&ctp=p600x600&_nc_cat=108&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=cae128&_nc_ohc=aS95aSnJdHkQ7kNvwHhL8F_&_nc_oc=AdrbuAt4z8J_etr-T0DcbdEf_5I-9kENI2a1FZ89HSDE_MyHtjtKUZhJ5MH4MYhcBzA&_nc_zt=23&_nc_ht=scontent.fbkk6-1.fna&_nc_gid=nzUF8R0Zjr2N12-qzuz-Fg&_nc_ss=7f289&oh=00_AQKGHN_cSeBMvu-V5RlIreZxaJXOfHl2JmXjx2SaRPA-VQ&oe=6AB28B3F'
  },
  {
    file: 'fb_paka_science.jpg',
    url: 'https://scontent.fbkk7-3.fna.fbcdn.net/v/t15.5256-10/780648493_1605602424415425_2048974358088616562_n.jpg?_nc_cat=107&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=a27664&_nc_ohc=-MHzoiHRBJ8Q7kNvwFiWK7q&_nc_oc=AdpTlNY8792D2JwT3xA70Oe7riR9tqe6-Cs3mQe5Qa35rA2lxpfWXfGFC5x-94XvM-8&_nc_zt=23&_nc_ht=scontent.fbkk7-3.fna&_nc_gid=iSlkXSH_P-TYm5KmYvimYA&_nc_ss=7f289&oh=00_AQLohcJnIWureShwV1L8pxF1oDaURi5euxY_JKIwriYcFg&oe=6AB29197'
  },
  {
    file: 'fb_paka_thanks.jpg',
    url: 'https://scontent.fbkk6-2.fna.fbcdn.net/v/t39.30808-6/790505763_122295457790122470_1443569291363509014_n.jpg?stp=cp6_dst-jpg_tt6&cstp=mx1320x808&ctp=p600x600&_nc_cat=106&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=b96d88&_nc_ohc=IrQBgxQ7GpAQ7kNvwHgNj7l&_nc_oc=Adr9kqzOiiOpH86IhbFdTH5BkFFWDUJjcwqkBBXwFJ9agLrENhHB0fQV7HWa4lF0uP0&_nc_zt=23&_nc_ht=scontent.fbkk6-2.fna&_nc_gid=tQrWdbbP-ZXVZrrQ2Y7bgg&_nc_ss=7f289&oh=00_AQLDdYipgxkOoBIL1vJDy0RwZYFmP8E5mFrXdM6t0v9Csw&oe=6AB2B6F6'
  }
];

async function download() {
  for (const item of images) {
    const dest = path.join('public', 'news', item.file);
    try {
      const res = await fetch(item.url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buffer));
        console.log(`Downloaded: ${item.file} (${buffer.byteLength} bytes)`);
      } else {
        console.error(`Failed ${item.file}: ${res.status}`);
      }
    } catch(e) {
      console.error(`Error downloading ${item.file}:`, e.message);
    }
  }
}
download();
