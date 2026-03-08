const axios = require('axios');
async function run() {
    try {
        const response = await axios.post('http://localhost:3000/api/scrape-event', {
            eventId: 'LIVE:1',
            eventName: 'AmCup #3'
        });
        const data = response.data;

        const overall = data.standings.overall;
        const men = Object.entries(overall).filter(([_, s]) => s.category.startsWith('M'));
        const women = Object.entries(overall).filter(([_, s]) => !s.category.startsWith('M'));

        console.log(`Total results: ${data.results.length}`);
        console.log(`Men in overall: ${men.length}`);
        console.log(`Women in overall: ${women.length}`);

        // Show men with 500m
        const men500 = men.filter(([_, s]) => s.distances['500m']);
        console.log(`\nMen with 500m points: ${men500.length}`);
        men500.sort((a, b) => (b[1].distances['500m']['AmCup #3'] || 0) - (a[1].distances['500m']['AmCup #3'] || 0));
        men500.forEach(([name, s], i) => {
            const pts = s.distances['500m']['AmCup #3'] || '-';
            console.log(`  ${i + 1}. ${name} (${s.category}) - 500m: ${pts} pts`);
        });

        // Show all distances found in results
        const distances = new Set();
        data.results.forEach(r => distances.add(r.distance));
        console.log(`\nDistances found in results: ${[...distances].join(', ')}`);

        // Count men results
        const menResults = data.results.filter(r => r.gender === 'men');
        console.log(`Men race results: ${menResults.length}`);
        menResults.forEach(r => console.log(`  ${r.name} (${r.category}) - ${r.distance} - rank ${r.rank}`));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
run();
