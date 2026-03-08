const axios = require('axios');
const cheerio = require('cheerio');

async function testLiveIndexScraper() {
    try {
        const eventId = "1";
        const url = `https://speedskatingresults.com/live.php?p=1&e=${eventId}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        console.log('Title:', $('title').text().trim());

        const raceUrls = [];
        $('a[href*="p=2"]').each((index, element) => {
            const href = $(element).attr('href');
            if (href && href.includes(`e=${eventId}`) && href.includes('r=')) {
                // Ignore schedule links containing 'c=' or other non-race params
                // Actually, live index usually links directly to race results
                if (!href.includes('c=')) {
                    const fullUrl = `https://speedskatingresults.com/${href}`;
                    if (!raceUrls.includes(fullUrl)) {
                        raceUrls.push(fullUrl);
                    }
                }
            }
        });

        console.log(`Found ${raceUrls.length} live race URLs:`);
        console.log(raceUrls);

    } catch (e) {
        console.error(e);
    }
}
testLiveIndexScraper();
