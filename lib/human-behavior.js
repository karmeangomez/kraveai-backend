// lib/human-behavior.js

const randomDelay = (min = 800, max = 2500) => {
  return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
};

const humanScroll = async (page, steps = 5) => {
  const viewportHeight = page.viewport().height;

  for (let i = 0; i < steps; i++) {
    const distance = Math.floor(viewportHeight * (0.5 + Math.random() * 0.5));
    await page.evaluate((scrollY) => {
      window.scrollBy(0, scrollY);
    }, distance);

    await randomDelay(800, 2000);
  }
};

const humanClick = async (page, selector) => {
  const element = await page.$(selector);
  if (!element) return;

  const box = await element.boundingBox();
  if (!box) return;

  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);

  await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) });
  await randomDelay(300, 700);
  await element.click();
};

const humanType = async (page, selector, text, speed = 80) => {
  await page.focus(selector);
  for (const char of text) {
    await page.type(selector, char, { delay: speed + Math.random() * 30 });
    if (Math.random() > 0.7) await randomDelay(50, 150);
  }
};

module.exports = {
  humanScroll,
  humanClick,
  humanType,
  randomDelay
};
