const axios = require('axios');
const cheerio = require('cheerio');

async function testScraper() {
    try {
        // Test fetching one specific race
        const raceUrl = 'https://speedskatingresults.com/index.php?p=3&e=30910&r=1&s=78596';
        console.log('Fetching:', raceUrl);

        const response = await axios.get(raceUrl);
        const $ = cheerio.load(response.data);

        console.log('\nPage title:', $('title').text());

        // Find all tables
        console.log('\nTables found:', $('table').length);

        // Try to find the results table
        $('table').each((i, table) => {
            console.log(`\nTable ${i}:`);
            const rows = $(table).find('tr');
            console.log(`  Rows: ${rows.length}`);

            rows.slice(0, 5).each((j, row) => {
                const cells = $(row).find('td, th');
                const cellTexts = [];
                cells.each((k, cell) => {
                    cellTexts.push($(cell).text().trim());
                });
                console.log(`  Row ${j}:`, cellTexts);
            });
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testScraper();
