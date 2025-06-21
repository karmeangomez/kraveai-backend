export function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function humanType(page, selector, text) {
  const el = await page.$(selector);
  if (!el) throw new Error(`No se encontró el selector: ${selector}`);

  for (let char of text) {
    await el.type(char);
    await randomDelay(100, 200);
  }
}

export async function simulateMouseMovement(page) {
  const width = 800;
  const height = 600;
  await page.mouse.move(
    Math.floor(Math.random() * width),
    Math.floor(Math.random() * height),
    { steps: 10 }
  );
}

export async function humanInteraction(page) {
  await simulateMouseMovement(page);
  await randomDelay(1000, 2000);
}
