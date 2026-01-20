const axios = require('axios');
const cheerio = require('cheerio');

const POINT_SCALE = [
    60, 54, 48, 43, 40, 37, 34, 32, 30, 28,
    27, 26, 25, 24, 23, 22, 21, 20, 19, 18,
    17, 16, 15, 14, 13, 12, 11, 10, 9, 8,
    7, 6, 5, 4, 3, 2, 1, 1, 1, 1
];

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

    console.log('Found race URLs:', raceUrls.length);

    const allResults = [];

    for (const raceUrl of raceUrls) {
        // Filter for relevant mass start races for debugging
        // if (!raceUrl.includes('r=31322')) continue; // Just a guess, let's process all and filter log

        const raceResponse = await axios.get(raceUrl);
        const $ = cheerio.load(raceResponse.data);
        const pageTitle = $('title').text();

        if (!pageTitle.toLowerCase().includes('mass')) continue;

        console.log('---------------------------------------------------');
        console.log('Processing Race:', pageTitle);
        console.log('URL:', raceUrl);

        let distance = 'Mass Start';
        const raceLabelMatch = pageTitle.match(/\(\d+\)(?!\s*laps)|Semi \d+|Final/i);
        const raceLabel = raceLabelMatch ? raceLabelMatch[0] : '';
        console.log('Extracted Label:', raceLabel);

        let parsedCount = 0;
        let usaCount = 0;

        $('table tr').each((index, element) => {
            if (index === 0) return;
            const cells = $(element).find('td');
            if (cells.length < 6) return;

            const rank = $(cells[0]).text().trim();
            const name = $(cells[1]).text().trim();
            const category = $(cells[2]).text().trim();
            const country = $(cells[4]).text().trim();
            const time = $(cells[5]).text().trim();

            if (country === 'USA') {
                allResults.push({
                    rank, name, country, category, time, distance, raceLabel, title: pageTitle
                });
                usaCount++;
                // console.log(`  USA Skater: ${name}, Rank: ${rank}, Cat: ${category}`);
            }
            parsedCount++;
        });
        console.log(`Parsed ${parsedCount} rows, ${usaCount} USA skaters.`);
    }

    console.log('\nProcessing Standings...');
    const standings = {};
    const byKey = {};

    allResults.forEach(result => {
        // Updated Key Logic from server.js
        const key = `${result.distance}|Men|${result.raceLabel}`;
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(result);
    });

    Object.keys(byKey).forEach(key => {
        console.log('\nScoring Group:', key);
        const groupResults = byKey[key];

        // Sorting logic from server.js
        const sortedResults = groupResults.sort((a, b) => {
            const rankA = parseInt(a.rank) || 999;
            const rankB = parseInt(b.rank) || 999;
            if (rankA !== rankB) return rankA - rankB;
            return 0; // Simple sort
        });

        const finisherCount = sortedResults.length; // Simplified for debug

        sortedResults.forEach((result, index) => {
            const usaRank = index + 1;
            const numericRank = parseInt(result.rank);
            // Logic from server.js:
            // const points = calculatePoints(usaRank, finisherCount, result.status);
            // Wait, server.js uses usaRank for calculatePoints!

            // Let's check exactly what server.js does.
            // const points = calculatePoints(usaRank, finisherCount, result.status);

            const points = usaRank <= 40 ? POINT_SCALE[usaRank - 1] || 1 : 1;

            console.log(`  ${usaRank}. ${result.name} (Orig Rank: ${result.rank}) -> ${points} pts`);

            if (!standings[result.name]) standings[result.name] = 0;
            standings[result.name] += points;
        });
    });

    console.log('\nTotal Points (Men - Mass Start):');
    Object.entries(standings).sort((a, b) => b[1] - a[1]).forEach(([name, pts]) => {
        console.log(`${name}: ${pts}`);
    });
}

run();
