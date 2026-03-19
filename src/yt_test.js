async function testVideo(url) {
    console.log(`Testing: ${url}`);
    try {
        const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        console.log(`Status: ${response.status}`);
        if (response.ok) {
            const data = await response.json();
            console.log(`Data: ${JSON.stringify(data, null, 2)}`);
            if (data.html) {
                console.log(`Result: SUCCESS (HTML found)`);
            } else {
                console.log(`Result: BLOCKED (No HTML)`);
            }
        } else {
            console.log(`HTTP Error: ${response.status}`);
        }
    } catch (e) {
        console.error(`Fetch failed: ${e.message}`);
    }
    console.log('---');
}

async function start() {
    console.log('User Provided Video:');
    await testVideo('https://www.youtube.com/watch?v=CgCVZdcKcqY');
}
start();
