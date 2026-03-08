const axios = require('axios');
async function run() {
    try {
        console.log("Fetching LIVE:1 from API...");
        const response = await axios.post('http://localhost:3000/api/scrape-event', {
            eventId: 'LIVE:1',
            eventName: 'AmCup #3'
        });
        const data = response.data;
        if (!data.success) {
            console.error("API error", data);
            return;
        }
        console.log(`Results array size: ${data.results.length}`);
        if (data.results.length > 0) {
            console.log("First result:", data.results[0]);
        }

        console.log("\nChecking Overall 500m Standings for AmCup #3:");
        const overall = data.standings.overall;
        let foundAny = false;
        for (const [name, skater] of Object.entries(overall)) {
            if (skater.distances && skater.distances['500m'] && skater.distances['500m']['AmCup #3']) {
                console.log(`${name}: ${skater.distances['500m']['AmCup #3']} pts`);
                foundAny = true;
            }
        }
        if (!foundAny) {
            console.log("NO 500m POINTS FOUND FOR AMCUP #3!");
        }
    } catch (e) {
        console.error(e.message);
    }
}
run();
