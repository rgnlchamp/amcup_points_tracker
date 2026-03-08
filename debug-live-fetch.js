const axios = require('axios');

axios.post('http://localhost:3000/api/scrape-event', { eventId: 'LIVE:1', eventName: 'AmCup Final Live' })
    .then(res => {
        console.log("Success payload:");
        console.log(JSON.stringify(res.data, null, 2));
    })
    .catch(err => {
        console.error("Error from API:");
        if (err.response) {
            console.error(err.response.data);
        } else {
            console.error(err.message);
        }
    });
