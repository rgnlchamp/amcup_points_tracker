const axios = require('axios');
const cheerio = require('cheerio');

async function testLiveScraper() {
    try {
        // Let's check a completed race from the same live event 
        // 500m Women was Race 1
        const url = 'https://speedskatingresults.com/live.php?p=2&e=1&r=1';
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        console.log('Title:', $('title').text().trim());

        $('table').each((i, table) => {
            console.log(`\nTable ${i}:`);
            $(table).find('tr').slice(0, 10).each((j, row) => {
                const cells = [];
                $(row).find('th, td').each((k, cell) => {
                    cells.push($(cell).text().replace(/\s+/g, ' ').trim());
                });
                console.log(` Row ${j}:`, cells);
            });
        });
    } catch (e) {
        console.error(e);
    }
}
testLiveScraper();
