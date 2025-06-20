module.exports.humanMouseMove = async (page, targetX, targetY) => {
  const startX = Math.floor(Math.random() * 100);
  const startY = Math.floor(Math.random() * 100);
  await page.mouse.move(startX, startY);
  
  const steps = 20 + Math.floor(Math.random() * 10);
  const dx = (targetX - startX) / steps;
  const dy = (targetY - startY) / steps;
  
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(
      startX + dx * i,
      startY + dy * i,
      { steps: 1 }
    );
    await page.waitForTimeout(50 + Math.random() * 100);
  }
};

module.exports.humanType = async (page, selector, text) => {
  const element = await page.$(selector);
  await element.click();
  
  for (const char of text) {
    await element.type(char, {
      delay: 80 + Math.random() * 120
    });
    
    // 10% de probabilidad de error tipográfico
    if (Math.random() < 0.1) {
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);
      await element.type(char);
    }
  }
};
