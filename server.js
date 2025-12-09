const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const POINT_SCALE = [
    60, 54, 48, 43, 40, 37, 34, 32, 30, 28,
    27, 26, 25, 24, 23, 22, 21, 20, 19, 18,
    17, 16, 15, 14, 13, 12, 11, 10, 9, 8,
    7, 6, 5, 4, 3, 2, 1, 1, 1, 1
];

const JUNIOR_CATEGORIES = ['MC1', 'MC2', 'MB1', 'MB2', 'MA1', 'MA2', 'LC1', 'LC2', 'LB1', 'LB2', 'LA1', 'LA2'];
const MASTER_AGE_CODES = ['M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60', 'M65', 'M70', 'M75', 'M80', 'L30', 'L35', 'L40', 'L45', 'L50', 'L55', 'L60', 'L65', 'L70', 'L75', 'L80'];

async function scrapeRaceResults(eventId) {
    try {
        const eventUrl = `https://speedskatingresults.com/index.php?p=2&e=${eventId}`;
        const eventResponse = await axios.get(eventUrl);
        const $event = cheerio.load(eventResponse.data);

        const raceUrls = [];
        $event('a[href*="p=3"]').each((index, element) => {
            const href = $event(element).attr('href');
            if (href && href.includes(`e=${eventId}`) && href.includes('r=')) {
                const path = href.startsWith('/') ? href.substring(1) : href;
                const fullUrl = href.startsWith('http') ? href : `https://speedskatingresults.com/${path}`;
                if (!raceUrls.includes(fullUrl)) {
                    raceUrls.push(fullUrl);
                }
            }
        });

        const allResults = [];

        for (const raceUrl of raceUrls) {
            try {
                const raceResponse = await axios.get(raceUrl);
                const $ = cheerio.load(raceResponse.data);
                const pageTitle = $('title').text();

                let distance = '';
                if (pageTitle.match(/\b5000m\b/i)) distance = '5000m';
                else if (pageTitle.match(/\b3000m\b/i)) distance = '3000m';
                else if (pageTitle.match(/\b1500m\b/i)) distance = '1500m';
                else if (pageTitle.match(/\b1000m\b/i)) distance = '1000m';
                else if (pageTitle.match(/\b500m\b/i)) distance = '500m';
                else if (pageTitle.toLowerCase().includes('mass')) distance = 'Mass Start';

                if (!distance) continue;

                let gender = 'men';
                const titleLower = pageTitle.toLowerCase();
                if (titleLower.includes('women') || titleLower.includes('ladies') || titleLower.includes(' lad')) {
                    gender = 'women';
                }

                $('table tr').each((index, element) => {
                    if (index === 0) return;
                    const cells = $(element).find('td');
                    if (cells.length < 6) return;

                    const rank = $(cells[0]).text().trim();
                    const name = $(cells[1]).text().trim();
                    const category = $(cells[2]).text().trim();
                    const country = $(cells[4]).text().trim();
                    const time = $(cells[5]).text().trim();

                    if (country === 'USA' && rank && name && distance) {
                        allResults.push({
                            rank, name, country,
                            category: category || 'Unknown',
                            time: time || 'N/A',
                            distance, gender,
                            status: (time.includes('DQ') || time.includes('DNF') || time.includes('DNS')) ? 'DQ/DNF' : 'OK'
                        });
                    }
                });
            } catch (raceError) {
                console.error(`Error scraping race ${raceUrl}:`, raceError.message);
            }
        }

        return allResults;
    } catch (error) {
        console.error('Error scraping race results:', error);
        throw error;
    }
}

function calculatePoints(rank, totalFinishers, status) {
    if (status === 'DQ/DNF') {
        const lastPlaceRank = totalFinishers + 1;
        return lastPlaceRank <= 40 ? POINT_SCALE[lastPlaceRank - 1] || 1 : 1;
    }
    const numericRank = parseInt(rank);
    if (isNaN(numericRank) || numericRank < 1) return 0;
    if (numericRank > 40) return 1;
    return POINT_SCALE[numericRank - 1];
}

function classifySkater(category) {
    const categories = { overall: true, junior: false, master: false };
    if (JUNIOR_CATEGORIES.includes(category)) categories.junior = true;
    if (MASTER_AGE_CODES.some(code => category.startsWith(code)) && !category.startsWith('MN')) {
        categories.master = true;
    }
    return categories;
}

function parseTime(timeStr) {
    if (!timeStr) return 999;
    const match = timeStr.match(/(\d+),(\d+)(?:\((\d+)\))?/);
    if (match) {
        const seconds = parseInt(match[1]);
        const centiseconds = parseInt(match[2]);
        const thousandths = match[3] ? parseInt(match[3]) : 0;
        return seconds + (centiseconds / 100) + (thousandths / 1000);
    }
    return parseFloat(timeStr.replace(',', '.')) || 999;
}

function processRaceData(raceResults, eventName) {
    const standings = { overall: {}, junior: {}, master: {} };
    const byDistanceGender = {};

    raceResults.forEach(result => {
        const key = `${result.distance}-${result.gender}`;
        if (!byDistanceGender[key]) byDistanceGender[key] = [];
        byDistanceGender[key].push(result);
    });

    Object.keys(byDistanceGender).forEach(key => {
        const groupResults = byDistanceGender[key];
        const [distance, gender] = key.split('-');

        const sortedResults = groupResults.sort((a, b) => {
            const rankA = parseInt(a.rank) || 999;
            const rankB = parseInt(b.rank) || 999;
            if (rankA !== rankB) return rankA - rankB;
            return parseTime(a.time) - parseTime(b.time);
        });

        const finisherCount = sortedResults.filter(r => r.status === 'OK').length;

        // Assign categories to each result
        sortedResults.forEach(result => {
            result.categories = classifySkater(result.category);
        });

        // OVERALL: All USA skaters ranked together
        sortedResults.forEach((result, index) => {
            const usaRank = index + 1;
            const points = calculatePoints(usaRank, finisherCount, result.status);

            if (!standings.overall[result.name]) {
                standings.overall[result.name] = {
                    name: result.name,
                    category: result.category,
                    distances: {},
                    totalPoints: 0
                };
            }
            if (!standings.overall[result.name].distances[distance]) {
                standings.overall[result.name].distances[distance] = {};
            }
            standings.overall[result.name].distances[distance][eventName] = points;
            standings.overall[result.name].totalPoints += points;
        });

        // JUNIOR: Only juniors, re-ranked among themselves
        const juniorResults = sortedResults.filter(r => r.categories.junior);
        const juniorFinisherCount = juniorResults.filter(r => r.status === 'OK').length;

        juniorResults.forEach((result, index) => {
            const juniorRank = index + 1;
            const juniorPoints = calculatePoints(juniorRank, juniorFinisherCount, result.status);

            if (!standings.junior[result.name]) {
                standings.junior[result.name] = {
                    name: result.name,
                    category: result.category,
                    distances: {},
                    totalPoints: 0
                };
            }
            if (!standings.junior[result.name].distances[distance]) {
                standings.junior[result.name].distances[distance] = {};
            }
            standings.junior[result.name].distances[distance][eventName] = juniorPoints;
            standings.junior[result.name].totalPoints += juniorPoints;
        });

        // MASTER: Only masters, re-ranked among themselves
        const masterResults = sortedResults.filter(r => r.categories.master);
        const masterFinisherCount = masterResults.filter(r => r.status === 'OK').length;

        masterResults.forEach((result, index) => {
            const masterRank = index + 1;
            const masterPoints = calculatePoints(masterRank, masterFinisherCount, result.status);

            if (!standings.master[result.name]) {
                standings.master[result.name] = {
                    name: result.name,
                    category: result.category,
                    distances: {},
                    totalPoints: 0
                };
            }
            if (!standings.master[result.name].distances[distance]) {
                standings.master[result.name].distances[distance] = {};
            }
            standings.master[result.name].distances[distance][eventName] = masterPoints;
            standings.master[result.name].totalPoints += masterPoints;
        });
    });

    return standings;
}

function calculateCombinationStandings(allStandings) {
    const combinations = {
        overall: { sprint: { men: [], women: [] }, longDistance: { men: [], women: [] } }
    };

    // Only calculate for overall - Sprint and Long Distance are overall-only competitions
    const categoryStandings = allStandings.overall;

    Object.values(categoryStandings).forEach(skater => {
        const sprint500 = skater.distances['500m'] || {};
        const sprint1000 = skater.distances['1000m'] || {};
        const sprintPoints = sumPoints(sprint500) + sumPoints(sprint1000);

        if (sprintPoints > 0) {
            const gender = skater.category.startsWith('M') ? 'men' : 'women';
            combinations.overall.sprint[gender].push({
                name: skater.name,
                category: skater.category,
                points: sprintPoints,
                details: { '500m': sprint500, '1000m': sprint1000 }
            });
        }

        const ld1500 = skater.distances['1500m'] || {};
        const ldMass = skater.distances['Mass Start'] || {};
        const ld3000 = skater.distances['3000m'] || {};
        const ld5000 = skater.distances['5000m'] || {};
        const isWomen = skater.category.startsWith('L') || skater.category.startsWith('W');

        let ldPoints = sumPoints(ld1500) + sumPoints(ldMass);
        const details = { '1500m': ld1500, 'Mass Start': ldMass };

        if (isWomen) {
            ldPoints += sumPoints(ld3000);
            details['3000m'] = ld3000;
        } else {
            ldPoints += sumPoints(ld5000);
            details['5000m'] = ld5000;
        }

        if (ldPoints > 0) {
            const gender = skater.category.startsWith('M') ? 'men' : 'women';
            combinations.overall.longDistance[gender].push({
                name: skater.name,
                category: skater.category,
                points: ldPoints,
                details: details
            });
        }
    });

    combinations.overall.sprint.men.sort((a, b) => b.points - a.points);
    combinations.overall.sprint.women.sort((a, b) => b.points - a.points);
    combinations.overall.longDistance.men.sort((a, b) => b.points - a.points);
    combinations.overall.longDistance.women.sort((a, b) => b.points - a.points);

    return combinations;
}

function sumPoints(distanceObj) {
    return Object.values(distanceObj).reduce((sum, pts) => sum + pts, 0);
}

app.post('/api/scrape-event', async (req, res) => {
    try {
        const { eventId, eventName } = req.body;
        if (!eventId || !eventName) {
            return res.status(400).json({ error: 'Event ID and name are required' });
        }

        const results = await scrapeRaceResults(eventId);
        const standings = processRaceData(results, eventName);
        const combinations = calculateCombinationStandings({
            overall: standings.overall,
            junior: standings.junior,
            master: standings.master
        });

        res.json({ success: true, eventName, results, standings, combinations });
    } catch (error) {
        console.error('Error in scrape-event:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=amcup-standings.pdf');
        doc.pipe(res);
        doc.fontSize(24).text('US Speedskating AmCup', { align: 'center' });
        doc.fontSize(20).text('2025-2026 Season Standings', { align: 'center' });
        doc.moveDown(2);
        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-excel', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('AmCup Standings');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=amcup-standings.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AmCup Points Tracker running on http://localhost:${PORT}`);
});
