// Application State
let appState = {
    events: {
        amcup1: null,
        amcup2: null,
        amcup3: null
    },
    allStandings: null,
    combinations: null,
    currentCategory: 'overall', // overall, junior, master
    currentReport: 'sprint', // sprint, long-distance, 500m, 1000m, etc.
    currentGender: 'all' // all, men, women
};

// API Base URL
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : '';

/**
 * Fetch event data from the server (with localStorage caching)
 */
async function fetchEvent(eventKey, forceRefresh = false) {
    const inputId = `${eventKey}-id`;
    const eventId = document.getElementById(inputId).value.trim();

    if (!eventId) {
        showStatus('error', `Please enter an Event ID for ${eventKey.toUpperCase()}`);
        return;
    }

    // Check localStorage first (unless force refresh)
    const storageKey = `amcup_event_${eventKey}_${eventId}`;

    if (!forceRefresh) {
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData) {
            try {
                const data = JSON.parse(cachedData);
                appState.events[eventKey] = data;
                showStatus('success', `✅ Loaded ${data.results.length} USA results from cache (${data.eventName})`);
                checkCalculationReadiness();
                return;
            } catch (e) {
                console.warn('Failed to parse cached data, fetching fresh:', e);
            }
        }
    }

    showLoading(true);

    try {
        const eventName = eventKey.replace('amcup', 'AmCup #');

        const response = await fetch(`${API_URL}/api/scrape-event`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                eventId: eventId,
                eventName: eventName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch event data');
        }

        const data = await response.json();

        // Store event data
        appState.events[eventKey] = data;

        // Save to localStorage
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
            console.log(`Saved ${eventName} to localStorage`);
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }

        showStatus('success', `✅ Successfully fetched ${data.results.length} USA results from ${eventName}`);

        // Check if we have all events and can calculate standings
        checkCalculationReadiness();

    } catch (error) {
        console.error('Error fetching event:', error);
        showStatus('error', `❌ Error fetching event: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Check if all events are loaded and enable calculation
 */
function checkCalculationReadiness() {
    const eventsLoaded = Object.values(appState.events).filter(e => e !== null).length;

    if (eventsLoaded > 0) {
        showStatus('info', `📊 ${eventsLoaded} event(s) loaded. ${eventsLoaded === 3 ? 'Ready to calculate!' : 'You can add more events or calculate now.'}`);
    }
}

/**
 * Calculate season standings from all loaded events
 */
async function calculateStandings() {
    // Check if at least one event is loaded
    const loadedEvents = Object.values(appState.events).filter(e => e !== null);

    if (loadedEvents.length === 0) {
        showStatus('error', '❌ Please fetch at least one event before calculating standings');
        return;
    }

    showLoading(true);

    try {
        // Merge all event standings
        const mergedStandings = mergeEventStandings(loadedEvents);

        // Calculate combination standings
        const combinations = calculateCombinations(mergedStandings);

        // Store in app state
        appState.allStandings = mergedStandings;
        appState.combinations = combinations;

        // Show standings section
        document.getElementById('standings-section').style.display = 'block';

        // Render current view
        renderStandings();

        showStatus('success', '🎉 Season standings calculated successfully!');

        // Scroll to standings
        document.getElementById('standings-section').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

    } catch (error) {
        console.error('Error calculating standings:', error);
        showStatus('error', `❌ Error calculating standings: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Merge standings from multiple events
 */
function mergeEventStandings(events) {
    console.log('Merging events:', events);
    const merged = {
        overall: {},
        junior: {},
        master: {}
    };

    events.forEach(event => {
        console.log('Processing event:', event.eventName, 'Standings:', event.standings);
        ['overall', 'junior', 'master'].forEach(category => {
            const categoryStandings = event.standings[category];

            Object.entries(categoryStandings).forEach(([name, data]) => {
                if (!merged[category][name]) {
                    merged[category][name] = {
                        name: name,
                        category: data.category,
                        distances: {},
                        totalPoints: 0
                    };
                }

                // Merge distance points
                Object.entries(data.distances).forEach(([distance, eventPoints]) => {
                    if (!merged[category][name].distances[distance]) {
                        merged[category][name].distances[distance] = {};
                    }

                    Object.entries(eventPoints).forEach(([eventName, points]) => {
                        merged[category][name].distances[distance][eventName] = points;
                        merged[category][name].totalPoints += points;
                    });
                });
            });
        });
    });

    console.log('Merged standings:', merged);
    return merged;
}

/**
 * Calculate combination standings (Sprint and Long Distance)
 */
function calculateCombinations(allStandings) {
    const combinations = {
        overall: { sprint: { men: [], women: [] }, longDistance: { men: [], women: [] } },
        junior: { sprint: { men: [], women: [] }, longDistance: { men: [], women: [] } },
        master: { sprint: { men: [], women: [] }, longDistance: { men: [], women: [] } }
    };

    ['overall', 'junior', 'master'].forEach(category => {
        const categoryStandings = allStandings[category];

        Object.values(categoryStandings).forEach(skater => {
            // Improved gender detection - check category code or use 'men' as default
            let gender = 'men';
            if (skater.category) {
                const cat = skater.category.toUpperCase();
                // Women's categories start with L (Ladies) or W (Women)
                if (cat.startsWith('L') || cat.startsWith('W') || cat.includes('WOMEN') || cat.includes('LADIES')) {
                    gender = 'women';
                }
                // Men's categories start with M (but not Master indicators like M30, M35 which need distance-based detection)
                // If category looks like M followed by non-digit, it's likely Men
                else if (cat.match(/^M[ABC]/)) {
                    gender = 'men';
                }
            }

            // Sprint (500m + 1000m)
            const sprint500 = skater.distances['500m'] || {};
            const sprint1000 = skater.distances['1000m'] || {};
            const sprintPoints = sumPoints(sprint500) + sumPoints(sprint1000);

            if (sprintPoints > 0) {
                combinations[category].sprint[gender].push({
                    name: skater.name,
                    category: skater.category,
                    points: sprintPoints,
                    details: {
                        '500m': sprint500,
                        '1000m': sprint1000
                    }
                });
            }

            // Long Distance
            const ld1500 = skater.distances['1500m'] || {};
            const ld3000 = skater.distances['3000m'] || {};
            const ld5000 = skater.distances['5000m'] || {};
            const ldMass = skater.distances['Mass Start'] || {};

            let ldPoints = sumPoints(ld1500) + sumPoints(ldMass);
            const details = {
                '1500m': ld1500,
                'Mass Start': ldMass
            };

            // Women: include 3000m, Men: include 5000m
            if (gender === 'women') {
                ldPoints += sumPoints(ld3000);
                details['3000m'] = ld3000;
            } else {
                ldPoints += sumPoints(ld5000);
                details['5000m'] = ld5000;
            }

            if (ldPoints > 0) {
                combinations[category].longDistance[gender].push({
                    name: skater.name,
                    category: skater.category,
                    points: ldPoints,
                    details: details
                });
            }
        });

        // Sort all by points (descending)
        combinations[category].sprint.men.sort((a, b) => b.points - a.points);
        combinations[category].sprint.women.sort((a, b) => b.points - a.points);
        combinations[category].longDistance.men.sort((a, b) => b.points - a.points);
        combinations[category].longDistance.women.sort((a, b) => b.points - a.points);
    });

    return combinations;
}

/**
 * Sum all points in an object
 */
function sumPoints(pointsObj) {
    return Object.values(pointsObj).reduce((sum, val) => sum + val, 0);
}

/**
 * Show category standings (Overall, Junior, Master)
 */
function showCategory(category) {
    appState.currentCategory = category;

    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    renderStandings();
}

/**
 * Show report type (Sprint, Long Distance, Individual Distances)
 */
function showReport(reportType) {
    appState.currentReport = reportType;

    // Update active tab
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Hide Junior/Master tabs for Sprint and Long Distance (they're overall-only)
    const categoryTabs = document.querySelector('.category-tabs');
    if (reportType === 'sprint' || reportType === 'long-distance') {
        categoryTabs.style.display = 'none';
        // Force to overall category for these views
        appState.currentCategory = 'overall';
    } else {
        categoryTabs.style.display = 'flex';
    }

    renderStandings();
}

/**
 * Filter by gender (All, Men, Women)
 */
function filterGender(gender) {
    appState.currentGender = gender;

    // Update active button
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    renderStandings();
}


/**
 * Render standings based on current selection
 */
function renderStandings() {
    if (!appState.allStandings) return;

    const container = document.getElementById('standings-container');
    const category = appState.currentCategory;
    const report = appState.currentReport;

    let html = '';

    if (report === 'sprint') {
        html = renderCombinationStandings('sprint', category);
    } else if (report === 'long-distance') {
        html = renderCombinationStandings('longDistance', category);
    } else {
        // Individual distance
        const distanceMap = {
            '500m': '500m',
            '1000m': '1000m',
            '1500m': '1500m',
            '3000m': '3000m',
            '5000m': '5000m',
            'mass-start': 'Mass Start'
        };
        const distance = distanceMap[report];
        html = renderIndividualDistance(distance, category);
    }

    container.innerHTML = html;
}

/**
 * Render combination standings (Sprint or Long Distance)
 */
function renderCombinationStandings(type, category) {
    const data = appState.combinations[category][type];
    const title = type === 'sprint' ? 'Overall Sprint' : 'Overall Long Distance';

    let html = `<h3 class="section-title">${title} - ${capitalizeFirst(category)}</h3>`;

    const gender = appState.currentGender;

    // Men's standings
    if ((gender === 'all' || gender === 'men') && data.men && data.men.length > 0) {
        html += `<div class="men-section">`;
        html += `<h4 class="mt-lg mb-lg">👨 Men</h4>`;
        html += renderStandingsTable(data.men, true);
        html += `</div>`;
    }

    // Women's standings
    if ((gender === 'all' || gender === 'women') && data.women && data.women.length > 0) {
        html += `<div class="women-section">`;
        html += `<h4 class="mt-lg mb-lg">👩 Women</h4>`;
        html += renderStandingsTable(data.women, true);
        html += `</div>`;
    }

    const showingData = (gender === 'all' && (data.men.length > 0 || data.women.length > 0)) ||
        (gender === 'men' && data.men.length > 0) ||
        (gender === 'women' && data.women.length > 0);

    if (!showingData) {
        html += '<p class="text-center text-muted">No data available for this selection</p>';
    }

    return html;
}

/**
 * Render individual distance standings
 */
function renderIndividualDistance(distance, category) {
    const standings = appState.allStandings[category];

    // Extract skaters who competed in this distance
    const skaters = [];
    Object.values(standings).forEach(skater => {
        if (skater.distances[distance]) {
            const totalPoints = sumPoints(skater.distances[distance]);
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

    // Sort by points
    skaters.sort((a, b) => b.points - a.points);

    // Separate by gender
    const men = skaters.filter(s => s.category.startsWith('M'));
    const women = skaters.filter(s => !s.category.startsWith('M'));

    let html = `<h3 class="section-title">${distance} - ${capitalizeFirst(category)}</h3>`;

    const gender = appState.currentGender;

    if ((gender === 'all' || gender === 'men') && men.length > 0) {
        html += `<div class="men-section">`;
        html += `<h4 class="mt-lg mb-lg">👨 Men</h4>`;
        html += renderStandingsTable(men, true);
        html += `</div>`;
    }

    if ((gender === 'all' || gender === 'women') && women.length > 0) {
        html += `<div class="women-section">`;
        html += `<h4 class="mt-lg mb-lg">👩 Women</h4>`;
        html += renderStandingsTable(women, true);
        html += `</div>`;
    }

    const showingData = (gender === 'all' && (men.length > 0 || women.length > 0)) ||
        (gender === 'men' && men.length > 0) ||
        (gender === 'women' && women.length > 0);

    if (!showingData) {
        html += '<p class="text-center text-muted">No data available for this selection</p>';
    }

    return html;
}

/**
 * Render standings table
 */
function renderStandingsTable(skaters, showDetails = false) {
    let html = '<table class="standings-table"><thead><tr>';
    html += '<th>Rank</th>';
    html += '<th>Name</th>';
    html += '<th>Category</th>';

    if (showDetails && skaters.length > 0 && skaters[0].details) {
        const eventKeys = Object.keys(skaters[0].details);
        eventKeys.forEach(key => {
            const events = skaters[0].details[key];
            Object.keys(events).forEach(eventName => {
                html += `<th>${key}<br>${eventName}</th>`;
            });
        });
    }

    html += '<th>Total Points</th>';
    html += '</tr></thead><tbody>';

    skaters.forEach((skater, index) => {
        const rank = index + 1;
        let rankClass = 'rank-cell';
        if (rank === 1) rankClass += ' podium-1';
        else if (rank === 2) rankClass += ' podium-2';
        else if (rank === 3) rankClass += ' podium-3';

        html += '<tr>';
        html += `<td class="${rankClass}">${rank}</td>`;
        html += `<td>${skater.name}</td>`;
        html += `<td>${skater.category}</td>`;

        if (showDetails && skater.details) {
            Object.values(skater.details).forEach(distPoints => {
                Object.values(distPoints).forEach(points => {
                    html += `<td>${points}</td>`;
                });
            });
        }

        html += `<td><strong>${skater.points}</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

/**
 * Generate PDF Report
 */
async function generatePDF() {
    if (!appState.allStandings) {
        showStatus('error', 'Please calculate standings first');
        return;
    }

    const exportType = document.getElementById('export-type').value;
    showLoading(true);

    try {
        const response = await fetch(`${API_URL}/api/generate-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                standings: appState.allStandings,
                combinations: appState.combinations,
                exportOptions: {
                    type: exportType,
                    // Pass current names for filenames if needed
                    eventName: 'AmCup-Season-Standings'
                }
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AmCup-Standings-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus('success', '✅ PDF report generated successfully');
    } catch (error) {
        console.error('Error generating PDF:', error);
        showStatus('error', `❌ Error generating PDF: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Generate Excel Export
 */
async function generateExcel() {
    if (!appState.allStandings) {
        showStatus('error', 'Please calculate standings first');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_URL}/api/generate-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                standings: appState.allStandings,
                combinations: appState.combinations
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate Excel file');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AmCup-Standings-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus('success', '✅ Excel file generated successfully');
    } catch (error) {
        console.error('Error generating Excel:', error);
        showStatus('error', `❌ Error generating Excel: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * Clear all data and reset application
 */
function clearAllData() {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        return;
    }

    appState = {
        events: {
            amcup1: null,
            amcup2: null,
            amcup3: null
        },
        allStandings: null,
        combinations: null,
        currentCategory: 'overall',
        currentReport: 'sprint',
        currentGender: 'all'
    };

    // Clear input fields
    document.getElementById('amcup1-id').value = '';
    document.getElementById('amcup2-id').value = '';
    document.getElementById('amcup3-id').value = '';

    // Hide standings section
    document.getElementById('standings-section').style.display = 'none';

    // Clear status messages
    document.getElementById('status-messages').innerHTML = '';

    // Clear localStorage
    localStorage.clear();
    console.log('localStorage cleared');

    showStatus('info', '🔄 All data has been cleared');
}

/**
 * Show status message
 */
function showStatus(type, message) {
    const container = document.getElementById('status-messages');

    const messageEl = document.createElement('div');
    messageEl.className = `status-message status-${type}`;
    messageEl.textContent = message;

    container.appendChild(messageEl);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageEl.style.opacity = '0';
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 AmCup Points Tracker initialized');
});
