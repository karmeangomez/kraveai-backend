export async function humanType(page, selector, text, clear = false) {
    if (clear) await page.$eval(selector, el => el.value = '');
    await page.type(selector, text, { delay: 50 + Math.random() * 100 });
}

export function randomDelay(min, max) {
    return new Promise(resolve => 
        setTimeout(resolve, min + Math.random() * (max - min))
    );
}

export async function simulateMouseMovement(page) {
    await page.mouse.move(
        100 + Math.random() * 100,
        100 + Math.random() * 100
    );
}
