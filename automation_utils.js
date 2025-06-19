// automation_utils.js
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  humanType: async (page, selector, text, delayMin = 50, delayMax = 150) => {
    await page.focus(selector);
    for (const char of text) {
      await page.type(selector, char, { delay: Math.random() * (delayMax - delayMin) + delayMin });
      await delay(Math.random() * 100);
    }
  },
  
  randomDelay: async (min = 500, max = 3000) => {
    await delay(Math.floor(Math.random() * (max - min + 1) + min));
  },
  
  moveMouse: async (page, selector = null) => {
    if (!selector) {
      const viewport = page.viewport();
      await page.mouse.move(
        Math.random() * viewport.width,
        Math.random() * viewport.height,
        { steps: 10 }
      );
      return;
    }

    const rect = await page.evaluate(el => {
      const { top, left, width, height } = el.getBoundingClientRect();
      return { top, left, width, height };
    }, await page.$(selector));
    
    await page.mouse.move(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      { steps: Math.floor(Math.random() * 10) + 5 }
    );
  }
};
