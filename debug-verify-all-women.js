const axios = require('axios');
async function run() {
    try {
        const response = await axios.post('http://localhost:3000/api/scrape-event', {
            eventId: 'LIVE:1',
            eventName: 'AmCup #3'
        });
        const data = response.data;

        console.log(`Total results: ${data.results.length}`);

        // Count women in overall
        const overall = data.standings.overall;
        const women = Object.entries(overall).filter(([_, s]) => !s.category.startsWith('M'));
        console.log(`\nWomen in OVERALL standings: ${women.length}`);
        women.sort((a, b) => {
            const ptsA = a[1].distances['500m'] ? Object.values(a[1].distances['500m'])[0] : 0;
            const ptsB = b[1].distances['500m'] ? Object.values(b[1].distances['500m'])[0] : 0;
            return ptsB - ptsA;
        });
        women.forEach(([name, s], i) => {
            const pts500 = s.distances['500m'] ? s.distances['500m']['AmCup #3'] : '-';
            console.log(`${i + 1}. ${name} (${s.category}) - 500m: ${pts500} pts`);
        });

        // Count women in master
        const master = data.standings.master;
        const masterWomen = Object.entries(master).filter(([_, s]) => !s.category.startsWith('M'));
        console.log(`\nWomen in MASTER standings: ${masterWomen.length}`);
        masterWomen.forEach(([name, s]) => {
            const pts500 = s.distances['500m'] ? s.distances['500m']['AmCup #3'] : '-';
            console.log(`  ${name} (${s.category}) - 500m: ${pts500} pts`);
        });
    } catch (e) {
        console.error(e.message);
    }
}
run();
