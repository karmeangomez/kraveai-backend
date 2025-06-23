import puppeteer from 'puppeteer';
async function test() {
  const browser = await puppeteer.launch({headless: true});
  console.log('✅ Puppeteer funciona');
  await browser.close();
}
test();
