const axios = require('axios');
const cheerio = require('cheerio');

async function debug500m() {
    const raceUrl = 'https://speedskatingresults.com/index.php?p=3&e=30910&r=1&s=78596';
    console.log('Testing 500m Men scraping...\n');

    const response = await axios.get(raceUrl);
    const $ = cheerio.load(response.data);

    console.log('First 10 USA skaters:');
    let count = 0;
    $('table tr').each((index, element) => {
        if (index === 0) return;
        const cells = $(element).find('td');
        if (cells.length < 6) return;

        const rank = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const category = $(cells[2]).text().trim();
        const country = $(cells[4]).text().trim();
        const time = $(cells[5]).text().trim();

        if (country === 'USA' && count < 10) {
            count++;
            console.log(`${count}. Rank="${rank}" Name="${name}" Cat="${category}" Time="${time}"`);
        }
    });
}

debug500m();
