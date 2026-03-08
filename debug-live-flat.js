const appState = {
    allStandings: {
        overall: {
            'Skater A': {
                name: 'Skater A',
                category: 'LSA',
                distances: { '500m': { 'AmCup #1': 60, 'AmCup #2': 48, 'AmCup #3': 60 } }
            },
            'Skater B': {
                name: 'Skater B',
                category: 'LSA',
                distances: { '500m': { 'AmCup #1': 54, 'AmCup #2': 60 } }
            }
        }
    }
};

const distance = '500m';
const category = 'overall';
const standings = appState.allStandings[category];
const skaters = [];
Object.values(standings).forEach(skater => {
    if (skater.distances[distance]) {
        const totalPoints = Object.values(skater.distances[distance]).reduce((sum, val) => sum + val, 0);
        if (totalPoints > 0) {
            skaters.push({
                name: skater.name,
                category: skater.category,
                points: totalPoints,
                details: skater.distances[distance]
            });
        }
    }
});

let isFlat = false;
let eventNames = [];

if (skaters.length > 0 && skaters.some(s => s.details)) {
    const firstSkaterWithDetails = skaters.find(s => s.details && Object.keys(s.details).length > 0);

    if (firstSkaterWithDetails) {
        const firstKey = Object.keys(firstSkaterWithDetails.details)[0];
        const firstValue = firstSkaterWithDetails.details[firstKey];

        if (typeof firstValue === 'number') {
            isFlat = true;
            skaters.forEach(skater => {
                if (!skater.details) return;
                Object.keys(skater.details).forEach(eventName => {
                    if (!eventNames.includes(eventName)) {
                        eventNames.push(eventName);
                    }
                });
            });
            // Try default sort
            const defaultSorted = [...eventNames].sort();
            console.log("Default Sorted Flat Event Names:", defaultSorted);
        }
    }
}
