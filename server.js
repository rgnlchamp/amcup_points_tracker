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

// Helper to draw a table in PDF
function drawTable(doc, title, headers, rows, options = {}) {
    const startX = 50;
    let currentY = doc.y;
    const colWidth = (options.width || 500) / headers.length;

    // Check for page break
    if (currentY + 100 > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
    }

    // Title
    doc.fontSize(16).fillColor(options.titleColor || 'black').text(title, startX, currentY);
    currentY += 30;

    // Header
    doc.rect(startX, currentY, options.width || 500, 20).fill(options.headerColor || '#003087');
    doc.fillColor('white').fontSize(10);

    headers.forEach((header, i) => {
        doc.text(header, startX + (i * colWidth) + 5, currentY + 5, { width: colWidth - 10, align: 'left' });
    });

    currentY += 20;

    // Rows
    doc.fillColor('black');
    rows.forEach((row, rowIndex) => {
        // Check for page break inside table
        if (currentY + 20 > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
            // Redraw header
            doc.rect(startX, currentY, options.width || 500, 20).fill(options.headerColor || '#003087');
            doc.fillColor('white');
            headers.forEach((header, i) => {
                doc.text(header, startX + (i * colWidth) + 5, currentY + 5, { width: colWidth - 10, align: 'left' });
            });
            currentY += 20;
            doc.fillColor('black');
        }

        // Stripe row
        if (rowIndex % 2 === 1) {
            doc.rect(startX, currentY, options.width || 500, 20).fill('#f5f5f5');
            doc.fillColor('black'); // Reset fill after stripe
        }

        row.forEach((cell, i) => {
            doc.text(cell.toString(), startX + (i * colWidth) + 5, currentY + 5, { width: colWidth - 10, align: 'left' });
        });
        currentY += 20;
    });

    doc.moveDown(2);
}

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { standings, combinations, exportOptions } = req.body;
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=amcup-standings.pdf');
        doc.pipe(res);

        // Title Page
        doc.fontSize(24).fillColor('#003087').text('US Speedskating AmCup', { align: 'center' });
        doc.fontSize(20).text('2025-2026 Season Standings', { align: 'center' });
        doc.moveDown(2);

        const type = exportOptions.type || 'full';

        const generateSection = (title, data, isWomen = false, detailedInfo = null) => {
            if (!data || data.length === 0) return;

            let headers = ['Rank', 'Name', 'Cat'];
            let valueExtractors = [];

            // Determine dynamic columns based on detailedInfo
            if (detailedInfo) {
                if (detailedInfo.type === 'combination') {
                    // Flatten details: 500m AmCup1, 500m AmCup2, etc.
                    const colMap = new Map(); // key: "500m-AmCup1", label: "500m\nAmCup1"

                    // Scan all data to find all possible columns
                    data.forEach(skater => {
                        if (skater.details) {
                            Object.keys(skater.details).forEach(dist => {
                                Object.keys(skater.details[dist]).forEach(eventName => {
                                    const key = `${dist}-${eventName}`;
                                    if (!colMap.has(key)) {
                                        colMap.set(key, { dist, eventName });
                                    }
                                });
                            });
                        }
                    });

                    colMap.forEach((val, key) => {
                        headers.push(`${val.dist}\n${val.eventName.replace('AmCup ', '#').replace('##', '#')}`);
                        valueExtractors.push(s => (s.details[val.dist] && s.details[val.dist][val.eventName]) || '-');
                    });

                } else if (detailedInfo.type === 'distance') {
                    // Individual distance columns
                    const events = new Set();
                    data.forEach(skater => {
                        if (skater.distances && skater.distances[detailedInfo.key]) {
                            Object.keys(skater.distances[detailedInfo.key]).forEach(e => events.add(e));
                        }
                    });

                    Array.from(events).forEach(eventName => {
                        headers.push(eventName.replace('AmCup ', '#').replace('##', '#'));
                        valueExtractors.push(s => (s.distances[detailedInfo.key] && s.distances[detailedInfo.key][eventName]) || '-');
                    });
                }
            }

            headers.push('Total');

            const rows = data.map((skater, index) => {
                const row = [
                    index + 1,
                    skater.name,
                    skater.category.replace('Master', 'M').replace('Junior', 'J')
                ];

                valueExtractors.forEach(fn => row.push(fn(skater)));

                row.push(skater.points);
                return row;
            });

            const color = isWomen ? '#e83e8c' : '#003087';
            drawSmartTable(doc, title, headers, rows, { headerColor: color, titleColor: color });
        };

        const processCategory = (catName, catKey) => {
            // Sprint
            if (type === 'full' || type === 'sprint' || type === 'overall') {
                const sprint = combinations[catKey].sprint;
                if (!catKey.includes('over') && (type === 'overall')) return;

                if (sprint.men && sprint.men.length > 0)
                    generateSection(`${catName} - Sprint (Men)`, sprint.men, false, { type: 'combination' });
                if (sprint.women && sprint.women.length > 0)
                    generateSection(`${catName} - Sprint (Women)`, sprint.women, true, { type: 'combination' });
            }

            // Long Distance
            if (type === 'full' || type === 'long-distance' || type === 'overall') {
                const ld = combinations[catKey].longDistance;
                if (!catKey.includes('over') && (type === 'overall')) return;

                if (ld.men && ld.men.length > 0)
                    generateSection(`${catName} - Long Distance (Men)`, ld.men, false, { type: 'combination' });
                if (ld.women && ld.women.length > 0)
                    generateSection(`${catName} - Long Distance (Women)`, ld.women, true, { type: 'combination' });
            }

            // Distances
            if (type === 'full' || (!['sprint', 'long-distance', 'overall'].includes(type))) {
                const distances = ['500m', '1000m', '1500m', '3000m', '5000m', 'Mass Start'];
                const catData = standings[catKey];

                distances.forEach(dist => {
                    const skaters = [];
                    Object.values(catData).forEach(skater => {
                        if (skater.distances[dist]) {
                            const points = sumPoints(skater.distances[dist]);
                            if (points > 0) skaters.push({ ...skater, points });
                        }
                    });

                    skaters.sort((a, b) => b.points - a.points);

                    const men = skaters.filter(s => s.category.startsWith('M'));
                    const women = skaters.filter(s => !s.category.startsWith('M'));

                    if (men.length > 0)
                        generateSection(`${catName} - ${dist} (Men)`, men, false, { type: 'distance', key: dist });
                    if (women.length > 0)
                        generateSection(`${catName} - ${dist} (Women)`, women, true, { type: 'distance', key: dist });
                });
            }
        };

        // Execution based on selection
        if (type === 'full' || type === 'overall' || type === 'sprint' || type === 'long-distance') {
            processCategory('Overall', 'overall');
        }

        if (type === 'full' || type === 'junior') {
            processCategory('Junior', 'junior');
        }

        if (type === 'full' || type === 'master') {
            processCategory('Master', 'master');
        }

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

// Smart table drawing with calculated widths
function drawSmartTable(doc, title, headers, rows, options = {}) {
    const startX = 50;
    const tableWidth = options.width || 500;
    let currentY = doc.y;

    // Calculate column widths
    const colWidths = headers.map((header, i) => {
        if (header === 'Rank') return 40;
        if (header === 'Name') return 160;
        if (header === 'Cat' || header === 'Category') return 60;
        if (header === 'Total' || header === 'Points') return 50;
        return 0; // Dynamic columns
    });

    const usedWidth = colWidths.reduce((a, b) => a + b, 0);
    const dynamicCols = colWidths.filter(w => w === 0).length;
    const remainingWidth = tableWidth - usedWidth;
    const dynamicWidth = dynamicCols > 0 ? remainingWidth / dynamicCols : 0;

    // Fill in dynamic widths
    const finalColWidths = colWidths.map(w => w === 0 ? dynamicWidth : w);

    // Calculate x positions
    const colXPoints = [startX];
    for (let i = 0; i < finalColWidths.length; i++) {
        colXPoints.push(colXPoints[i] + finalColWidths[i]);
    }

    // Check for page break
    if (currentY + 100 > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
    }

    // Title
    doc.fontSize(16).fillColor(options.titleColor || 'black').text(title, startX, currentY);
    currentY += 30;

    // Header
    doc.rect(startX, currentY, tableWidth, 25).fill(options.headerColor || '#003087');
    doc.fillColor('white').fontSize(9);

    headers.forEach((header, i) => {
        doc.text(header, colXPoints[i] + 2, currentY + 5, { width: finalColWidths[i] - 4, align: 'left' });
    });

    currentY += 25;

    // Rows
    doc.fillColor('black').fontSize(10);
    rows.forEach((row, rowIndex) => {
        // Check for page break inside table
        if (currentY + 20 > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
            // Redraw header
            doc.rect(startX, currentY, tableWidth, 25).fill(options.headerColor || '#003087');
            doc.fillColor('white').fontSize(9);
            headers.forEach((header, i) => {
                doc.text(header, colXPoints[i] + 2, currentY + 5, { width: finalColWidths[i] - 4, align: 'left' });
            });
            currentY += 25;
            doc.fillColor('black').fontSize(10);
        }

        // Stripe row
        if (rowIndex % 2 === 1) {
            doc.rect(startX, currentY, tableWidth, 20).fill('#f5f5f5');
            doc.fillColor('black'); // Reset fill after stripe
        }

        row.forEach((cell, i) => {
            doc.text(cell.toString(), colXPoints[i] + 2, currentY + 5, { width: finalColWidths[i] - 4, align: 'left', height: 15, ellipsis: true });
        });
        currentY += 20;
    });

    doc.moveDown(2);
}
