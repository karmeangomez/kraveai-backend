export function randomDelay(min = 500, max = 1500) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function humanType(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 15000 });
  for (const char of text) {
    await page.type(selector, char);
    await randomDelay(50, 150);
  }
}

export async function moveMouse(page) {
  const x = Math.floor(Math.random() * 300);
  const y = Math.floor(Math.random() * 300);
  await page.mouse.move(x, y, { steps: 10 });
}
