const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Catch console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    await page.goto('http://localhost:5173/games/zigzag/index.html');

    // Wait for the game to load
    await page.waitForSelector('#start-screen');

    console.log('Clicking PLAY...');
    await page.evaluate(() => {
        document.querySelector('#start-screen .start-btn').click();
    });

    // Wait 1 second and force game over
    await page.waitForTimeout(1000);
    console.log('Forcing GAME OVER...');
    await page.evaluate(() => {
        gameOver();
    });

    // Wait 1 second to ensure popup is fully visible
    await page.waitForTimeout(1000);

    // Click RETRY
    console.log('Clicking RETRY...');
    await page.evaluate(() => {
        document.querySelector('#game-over .start-btn').click();
    });

    // Wait 1 second (longer than 0.3s transition)
    await page.waitForTimeout(1000);

    // Check opacity and classes
    const popupData = await page.evaluate(() => {
        const el = document.getElementById('game-over');
        const style = window.getComputedStyle(el);
        return {
            opacity: style.opacity,
            display: style.display,
            visibility: style.visibility,
            pointerEvents: style.pointerEvents,
            classList: Array.from(el.classList)
        };
    });

    console.log('POPUP AFTER RETRY:', popupData);

    await browser.close();
})();
