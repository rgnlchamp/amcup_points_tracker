# 🎯 US Speedskating AmCup Points Tracker

**Version 2.0.0** - 2025-2026 Season

A modern, high-performance web application to track, calculate, and report Points Standings for the US Speedskating American Cup (AmCup) series.

## 🚀 Features

### Data Management
- **Live Data Scraping**: Fetch race results directly from speedskatingresults.com
- **USA Filter**: Automatically excludes all non-USA skaters
- **Multi-Event Support**: Track AmCup 1, AmCup 2, and AmCup Final
- **DQ/DNF Handling**: Proper last-place points calculation

### Point System (ACRS Rules)
- **Standard Scoring**: 1st=60pts down to 40th=1pt
- **No Multipliers**: Equal weight for all events
- **Automatic Calculation**: Season totals across all distances

### Categories
- **Overall**: All USA skaters
- **Junior**: MC1, MC2, MB1, MB2, MA1, MA2 (excludes Neo-Seniors)
- **Master**: Ages 30-80+ (M30 to M80+)

### Reports
#### Combination Titles (Grand Champions)
- **Overall Sprint**: 500m + 1000m points
- **Overall Long Distance (Women)**: 1500m + 3000m + Mass Start
- **Overall Long Distance (Men)**: 1500m + 5000m + Mass Start

#### Individual Distance Titles
- 500m, 1000m, 1500m, 3000m, 5000m, Mass Start
- Separate standings for Overall, Junior, and Master

### Export Options
- **PDF Reports**: Professional multi-page formatted reports
- **Excel Export**: Download standings as .xlsx files

## 📦 Installation

```bash
# Clone or download the project
cd AmCup_Points_V2

# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at `http://localhost:3000`

## 🎨 Usage

### 1. Enter Event IDs
Enter the Event IDs from speedskatingresults.com for:
- AmCup #1
- AmCup #2
- AmCup Final

**Example Event ID**: `16234`

### 2. Fetch Results
Click "Fetch Results" for each event to download and process race data.

### 3. Calculate Standings
Once you've fetched at least one event, click "Calculate Season Standings" to generate all reports.

### 4. View Results
- Use **Category Tabs** to switch between Overall, Junior, and Master
- Use **Report Tabs** to view different standings (Sprint, Long Distance, Individual Distances)

### 5. Export
- **Generate Official PDF Report**: Creates a comprehensive PDF with all standings
- **Export to Excel**: Downloads current view as an Excel file

## 🏗️ Technical Stack

### Backend
- **Node.js** with Express.js
- **Axios** for HTTP requests
- **Cheerio** for HTML parsing
- **PDFKit** for PDF generation
- **ExcelJS** for Excel exports

### Frontend
- **HTML5** with semantic markup
- **CSS3** with modern design (gradients, glassmorphism, animations)
- **Vanilla JavaScript** for maximum performance

## 📊 Point Scale Reference

```
1st:  60 pts    11th: 27 pts    21st: 17 pts    31st:  7 pts
2nd:  54 pts    12th: 26 pts    22nd: 16 pts    32nd:  6 pts
3rd:  48 pts    13th: 25 pts    23rd: 15 pts    33rd:  5 pts
4th:  43 pts    14th: 24 pts    24th: 14 pts    34nd:  4 pts
5th:  40 pts    15th: 23 pts    25th: 13 pts    35th:  3 pts
6th:  37 pts    16th: 22 pts    26th: 12 pts    36th:  2 pts
7th:  34 pts    17th: 21 pts    27th: 11 pts    37th+: 1 pt
8th:  32 pts    18th: 20 pts    28th: 10 pts
9th:  30 pts    19th: 19 pts    29th:  9 pts
10th: 28 pts    20th: 18 pts    30th:  8 pts
```

## 🎯 Category Definitions

### Junior Categories
- **Men**: MC1, MC2, MB1, MB2, MA1, MA2
- **Women**: LC1, LC2, LB1, LB2, LA1, LA2
- **Excludes**: Neo-Seniors (MN)

### Master Categories
- **Age Groups**: 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80+
- **Format**: M30, M35... (Men), L30, L35... (Women)

## 🔧 API Endpoints

### POST `/api/scrape-event`
Scrapes and processes race results from speedskatingresults.com

**Request Body:**
```json
{
  "eventId": "16234",
  "eventName": "AmCup #1"
}
```

**Response:**
```json
{
  "success": true,
  "eventName": "AmCup #1",
  "results": [...],
  "standings": {...}
}
```

### POST `/api/generate-pdf`
Generates a comprehensive PDF report

**Request Body:**
```json
{
  "standings": {...},
  "combinations": {...}
}
```

**Response:** PDF file download

### POST `/api/generate-excel`
Generates an Excel export

**Request Body:**
```json
{
  "standings": {...},
  "combinations": {...}
}
```

**Response:** Excel file download

## 🎨 Design Features

- **Rich Color Palette**: Vibrant gradients and harmonious colors
- **Glassmorphism**: Modern frosted glass effects
- **Smooth Animations**: Micro-animations for enhanced UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark Mode**: Eye-friendly dark theme
- **Premium Typography**: Google Fonts (Inter, Outfit)

## 📝 Notes

- The application automatically filters for USA skaters only
- DQ and DNF receive last place points (N+1 where N = number of finishers)
- All events use standard 1.0x multiplier (no bonus multipliers)
- Men's Long Distance excludes 3000m (uses 5000m instead)
- Women's Long Distance includes 3000m

## 🤝 Support

For questions or issues, please refer to the ACRS Ranking System documentation or contact the development team.

## 📄 License

MIT License - © 2025 US Speedskating AmCup Points Tracker

---

**Powered by ACRS Ranking System** • **2025-2026 Season**
