const axios = require('axios');
const cheerio = require('cheerio');

async function testUSAScraper() {
    const raceUrl = 'https://speedskatingresults.com/index.php?p=3&e=30910&r=1&s=78596';
    console.log('Testing USA scraper fix...\n');

    const response = await axios.get(raceUrl);
    const $ = cheerio.load(response.data);

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
            usaCount++;
            console.log(`${rank}. ${name} (${category}) - ${time}`);
        }
    });

    console.log(`\nTotal USA skaters: ${usaCount}`);
}

testUSAScraper();
