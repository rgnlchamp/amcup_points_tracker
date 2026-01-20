const axios = require('axios');
const cheerio = require('cheerio');

const POINT_SCALE = [
    60, 54, 48, 43, 40, 37, 34, 32, 30, 28,
    27, 26, 25, 24, 23, 22, 21, 20, 19, 18,
    17, 16, 15, 14, 13, 12, 11, 10, 9, 8,
    7, 6, 5, 4, 3, 2, 1, 1, 1, 1
];

function parseTime(timeStr) {
    if (!timeStr) return 999;
    const match = timeStr.match(/(\d+),(\d+)(?:\((\d+)\))?/);
    if (match) {
        const seconds = parseInt(match[1]);
        const centiseconds = parseInt(match[2]);
        const thousandths = match[3] ? parseInt(match[3]) : 0;
        return seconds + (centiseconds / 100) + (thousandths / 1000);
    }
    return parseFloat(timeStr.replace(',', '.')) || 999;
}

async function run() {
    const eventId = 31322; // AmCup 2
    console.log('Fetching event:', eventId);

    const eventUrl = `https://speedskatingresults.com/index.php?p=2&e=${eventId}`;
    const eventResponse = await axios.get(eventUrl);
    const $event = cheerio.load(eventResponse.data);

    const raceUrls = [];
    $event('a[href*="p=3"]').each((index, element) => {
        const href = $event(element).attr('href');
        if (href && href.includes(`e=${eventId}`) && href.includes('r=')) {
            const path = href.startsWith('/') ? href.substring(1) : href;
            const fullUrl = href.startsWith('http') ? href : `https://speedskatingresults.com/${path}`;
            if (!raceUrls.includes(fullUrl)) {
                raceUrls.push(fullUrl);
            }
        }
    });

    const allResults = [];

    for (const raceUrl of raceUrls) {
        const raceResponse = await axios.get(raceUrl);
        const $ = cheerio.load(raceResponse.data);
        const pageTitle = $('title').text();

        if (!pageTitle.match(/\b500m\b/i)) continue;

        console.log('Found 500m Race:', pageTitle);

        // Regex from server.js
        const raceLabelMatch = pageTitle.match(/\(\d+\)(?!\s*laps)|Semi \d+|Final/i);
        const raceLabel = raceLabelMatch ? raceLabelMatch[0] : '';
        console.log('Label:', raceLabel);

        $('table tr').each((index, element) => {
            if (index === 0) return;
            const cells = $(element).find('td');
            if (cells.length < 6) return;

            const name = $(cells[1]).text().trim();
            const country = $(cells[4]).text().trim();
            const time = $(cells[5]).text().trim();

            if (country === 'USA') {
                allResults.push({
                    name, time, rawTime: parseTime(time), raceLabel
                });
            }
        });
    }

    // Checking Sam Chamberlain
    const sam = allResults.filter(r => r.name.includes('CHAMBERLAIN'));
    console.log('\nSam Chamberlain Results:', sam);

    // Current Server Logic Simulation (Split)
    console.log('\n--- Current Logic (Split by Label) ---');
    const byLabel = {};
    allResults.forEach(r => {
        const key = r.raceLabel;
        if (!byLabel[key]) byLabel[key] = [];
        byLabel[key].push(r);
    });

    Object.keys(byLabel).forEach(label => {
        console.log(`Race ${label}:`);
        byLabel[label].sort((a, b) => a.rawTime - b.rawTime);
        byLabel[label].forEach((r, i) => {
            const rank = i + 1;
            const pts = rank <= 40 ? POINT_SCALE[rank - 1] : 1;
            if (r.name.includes('CHAMBERLAIN')) {
                console.log(`  Sam Rank: ${rank}, Points: ${pts}`);
            }
        });
    });


    // Proposed Logic Simulation (Merge & Best Time)
    console.log('\n--- Proposed Logic (Merge & Best Time) ---');
    const bestTimes = {};
    allResults.forEach(r => {
        if (!bestTimes[r.name] || r.rawTime < bestTimes[r.name].rawTime) {
            bestTimes[r.name] = r;
        }
    });

    const sortedBest = Object.values(bestTimes).sort((a, b) => a.rawTime - b.rawTime);
    sortedBest.forEach((r, i) => {
        const rank = i + 1;
        const pts = rank <= 40 ? POINT_SCALE[rank - 1] : 1;
        if (r.name.includes('CHAMBERLAIN')) {
            console.log(`  Sam Rank: ${rank}, Points: ${pts} (Time: ${r.time})`);
        }
    });

}

run();
