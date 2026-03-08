const axios = require('axios');

async function testLiveWomen500m() {
    try {
        const response = await axios.post('http://localhost:3000/api/scrape-event', {
            eventId: 'LIVE:1',
            eventName: 'Test Event'
        });

        const data = response.data;
        if (!data.success) {
            console.error('Failed API Response', data);
            return;
        }

        console.log('--- Women 500m Overall Standings ---');
        const overall = data.standings.overall;
        let women500m = [];
        for (const [name, skater] of Object.entries(overall)) {
            // Check if women (Cat L or W...)
            const isWomen = skater.category.startsWith('L') || skater.category.startsWith('W') || skater.category.startsWith('N');
            // the code checks gender by: titleLower.includes('women') || titleLower.includes('ladies') || titleLower.includes(' lad')
            if (skater.distances && skater.distances['500m'] && Object.keys(skater.distances['500m']).length > 0) {
                // To be safe, let's also output category
                women500m.push({
                    name,
                    category: skater.category,
                    points: skater.distances['500m']['Test Event']
                });
            }
        }

        // Sort by points descending
        women500m.sort((a, b) => b.points - a.points);
        console.log(JSON.stringify(women500m.filter(s => s.category.startsWith('L') || s.category.startsWith('W') || s.category.startsWith('N') || !s.category.startsWith('M')), null, 2));
    } catch (e) {
        console.error(e.message);
    }
}
testLiveWomen500m();
