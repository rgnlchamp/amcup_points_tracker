const fs = require('fs');

const mockEvent = {
    eventName: 'AmCup #3',
    standings: {
        overall: {
            'Skater A': { name: 'Skater A', category: 'LSA', distances: { '500m': { 'AmCup #3': 60 }, '1000m': { 'AmCup #3': 54 } } }
        }
    }
};

const appState = {
    events: [
        {
            eventName: 'AmCup #1',
            standings: {
                overall: { 'Skater A': { name: 'Skater A', category: 'LSA', distances: { '500m': { 'AmCup #1': 54 }, '1000m': { 'AmCup #1': 60 } } } }
            }
        },
        {
            eventName: 'AmCup #2',
            standings: {
                overall: { 'Skater A': { name: 'Skater A', category: 'LSA', distances: { '500m': { 'AmCup #2': 48 }, '1000m': { 'AmCup #2': 48 } } } }
            }
        },
        mockEvent
    ]
};

// Simplified merge
function mergeEventStandings(events) {
    const merged = { overall: {} };
    events.forEach(event => {
        Object.entries(event.standings.overall).forEach(([name, data]) => {
            if (!merged.overall[name]) {
                merged.overall[name] = { name, category: data.category, distances: {}, totalPoints: 0 };
            }
            Object.entries(data.distances).forEach(([distance, eventPoints]) => {
                if (!merged.overall[name].distances[distance]) merged.overall[name].distances[distance] = {};
                Object.entries(eventPoints).forEach(([eventName, points]) => {
                    merged.overall[name].distances[distance][eventName] = points;
                    merged.overall[name].totalPoints += points;
                });
            });
        });
    });
    return merged;
}

const merged = mergeEventStandings(appState.events);
console.log('Merged Distances for 500m:', merged.overall['Skater A'].distances['500m']);

// Combinations
const sprint500 = merged.overall['Skater A'].distances['500m'];
const sprint1000 = merged.overall['Skater A'].distances['1000m'];

const combination = {
    details: {
        '500m': sprint500,
        '1000m': sprint1000
    }
};

console.log('Combination details:', JSON.stringify(combination.details, null, 2));

// Test frontend loop logic in `renderStandingsTable`
const skaters = [combination];
let html = '';
const eventKeys = Object.keys(skaters[0].details);
eventKeys.forEach(key => {
    const events = skaters[0].details[key];
    console.log(`Processing Distance ${key}, Events Object keys:`, Object.keys(events));
    Object.keys(events).forEach(eventName => {
        html += `<th>${key}<br>${eventName}</th>\n`;
    });
});
console.log('Generated combinations HTML Headers:');
console.log(html);
