const skater = {
    name: 'Skater A',
    details: {
        '500m': { 'AmCup #3': 60 },
        '1000m': {}
    }
};

const firstKey = Object.keys(skater.details)[0];
const firstValue = skater.details[firstKey];

console.log("First Key:", firstKey);
console.log("First Value:", firstValue);
console.log("Typeof First Value:", typeof firstValue);

// But what if it's the other way around?
const skaterB = {
    name: 'Skater B',
    details: {
        '500m': {},
        '1000m': { 'AmCup #3': 60 }
    }
};

const firstKeyB = Object.keys(skaterB.details)[0];
const firstValueB = skaterB.details[firstKeyB];

console.log("\nSkater B - First Key:", firstKeyB);
console.log("Skater B - First Value:", firstValueB);
console.log("Skater B - Typeof First Value:", typeof firstValueB);

// The issue is NOT flat vs nested. The old bug was caching.
// But the user still sees no AmCup #3 in "500m - Overall". 
// This means "500m" array in `appState.allStandings.overall` doesn't have AmCup #3.
// Let's check `mergeEventStandings` again with an empty event.

const events = [
    {
        eventName: 'AmCup #1',
        standings: {
            overall: { 'Skater A': { name: 'Skater A', category: 'LSA', distances: { '500m': { 'AmCup #1': 60 } }, totalPoints: 60 } }
        }
    },
    {
        eventName: 'AmCup #3',
        standings: {
            overall: { 'Skater A': { name: 'Skater A', category: 'LSA', distances: { '500m': { 'AmCup #3': 60 } }, totalPoints: 60 } }
        }
    }
];

const merged = { overall: {} };
events.forEach(event => {
    Object.entries(event.standings.overall).forEach(([name, data]) => {
        if (!merged.overall[name]) {
            merged.overall[name] = { name: name, category: data.category, distances: {}, totalPoints: 0 };
        }
        Object.entries(data.distances).forEach(([distance, eventPoints]) => {
            if (!merged.overall[name].distances[distance]) {
                merged.overall[name].distances[distance] = {};
            }
            Object.entries(eventPoints).forEach(([eventName, points]) => {
                merged.overall[name].distances[distance][eventName] = points;
                merged.overall[name].totalPoints += points;
            });
        });
    });
});

console.log("\nMerged output:");
console.log(JSON.stringify(merged, null, 2));

