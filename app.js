const API_TOKEN = ''; // Remove the actual token
const OPENAI_API_KEY = ''; // Remove the actual key
const API_BASE_URL = 'https://api.sportmonks.com/v3/football';

// Cache for storing frequently accessed data
const cache = {
    types: null,
    states: null,
    seasons: null
};

document.getElementById('predict-btn').addEventListener('click', getPrediction);

async function getPrediction() {
    const team1 = document.getElementById('team1').value;
    const team2 = document.getElementById('team2').value;
    const resultDiv = document.getElementById('result');
    const newsDiv = document.getElementById('news');
    const statsDiv = document.getElementById('stats');

    if (!team1 || !team2) {
        resultDiv.innerHTML = 'Please enter both team names.';
        return;
    }

    resultDiv.innerHTML = 'Loading prediction...';
    newsDiv.innerHTML = '';
    statsDiv.innerHTML = '';

    try {
        // Fetch team data from Sportmonks API
        const teamData = await fetchTeamData(team1, team2);

        // Display news and stats
        displayNews(teamData.preMatchNews);
        displayStats(teamData.seasonStats);

        // Get prediction from OpenAI
        const prediction = await getPredictionFromOpenAI(teamData);

        resultDiv.innerHTML = prediction;
    } catch (error) {
        resultDiv.innerHTML = 'An error occurred while fetching the prediction.';
        console.error(error);
    }
}

async function fetchTeamData(team1, team2) {
    // Ensure cache is populated
    await populateCache();

    // Fetch team IDs
    const team1Id = await getTeamId(team1);
    const team2Id = await getTeamId(team2);

    // Fetch team statistics
    const team1Stats = await getTeamStats(team1Id);
    const team2Stats = await getTeamStats(team2Id);

    // Fetch head-to-head data
    const h2hData = await getHeadToHead(team1Id, team2Id);

    // Fetch pre-match news
    const preMatchNews = await getPreMatchNews(team1Id, team2Id);

    // Fetch season statistics
    const seasonStats = await getSeasonStatistics(team1Id, team2Id);

    return {
        team1: { name: team1, id: team1Id, stats: team1Stats },
        team2: { name: team2, id: team2Id, stats: team2Stats },
        headToHead: h2hData,
        preMatchNews: preMatchNews,
        seasonStats: seasonStats
    };
}

async function populateCache() {
    if (!cache.types) {
        cache.types = await fetchAllTypes();
    }
    if (!cache.states) {
        cache.states = await fetchAllStates();
    }
    if (!cache.seasons) {
        cache.seasons = await fetchAllSeasons();
    }
}

async function fetchAllTypes() {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/types?api_token=${API_TOKEN}`);
    return response.data;
}

async function fetchAllStates() {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/states?api_token=${API_TOKEN}`);
    return response.data;
}

async function fetchAllSeasons() {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/seasons?api_token=${API_TOKEN}`);
    return response.data;
}

async function getTeamId(teamName) {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/teams/search/${teamName}?api_token=${API_TOKEN}`);
    return response.data[0].id;
}

async function getTeamStats(teamId) {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/teams/${teamId}?api_token=${API_TOKEN}&include=stats`);
    return response.data.stats;
}

async function getHeadToHead(team1Id, team2Id) {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/fixtures/head-to-head/${team1Id}/${team2Id}?api_token=${API_TOKEN}`);
    return response.data;
}

async function getPreMatchNews(team1Id, team2Id) {
    const response = await fetchWithRateLimit(`${API_BASE_URL}/news/pre-match?api_token=${API_TOKEN}&include=fixture`);
    return response.data.filter(news => 
        news.fixture.localteam_id === team1Id && news.fixture.visitorteam_id === team2Id ||
        news.fixture.localteam_id === team2Id && news.fixture.visitorteam_id === team1Id
    );
}

async function getSeasonStatistics(team1Id, team2Id) {
    const currentSeason = getCurrentSeason();
    const team1Stats = await fetchWithRateLimit(`${API_BASE_URL}/statistics/seasons/teams/${team1Id}/${currentSeason}?api_token=${API_TOKEN}`);
    const team2Stats = await fetchWithRateLimit(`${API_BASE_URL}/statistics/seasons/teams/${team2Id}/${currentSeason}?api_token=${API_TOKEN}`);
    
    return {
        team1: team1Stats,
        team2: team2Stats
    };
}

function getCurrentSeason() {
    return cache.seasons.find(season => season.is_current).id;
}

// Implement client-side rate limiting
const queue = [];
const RATE_LIMIT = 180; // 3 requests per second
const INTERVAL = 1000; // 1 second

async function fetchWithRateLimit(url) {
    return new Promise((resolve, reject) => {
        queue.push({ url, resolve, reject });
        processQueue();
    });
}

function processQueue() {
    if (queue.length === 0) return;

    const { url, resolve, reject } = queue.shift();
    fetch(url)
        .then(response => response.json())
        .then(resolve)
        .catch(reject)
        .finally(() => {
            setTimeout(processQueue, INTERVAL / RATE_LIMIT);
        });
}

function displayNews(news) {
    const newsDiv = document.getElementById('news');
    newsDiv.innerHTML = '<h2>Pre-Match News</h2>';
    news.forEach(item => {
        newsDiv.innerHTML += `<p>${item.title}</p>`;
    });
}

function displayStats(stats) {
    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = '<h2>Season Statistics</h2>';
    statsDiv.innerHTML += `<p>Team 1: ${JSON.stringify(stats.team1)}</p>`;
    statsDiv.innerHTML += `<p>Team 2: ${JSON.stringify(stats.team2)}</p>`;
}

async function getPredictionFromOpenAI(teamData) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'system',
                content: 'You are a football analyst. Provide a prediction for the match based on the given team statistics, head-to-head data, pre-match news, and season statistics.'
            }, {
                role: 'user',
                content: `Analyze the following data and provide a prediction for the match between ${teamData.team1.name} and ${teamData.team2.name}:

                Team 1 (${teamData.team1.name}) stats: ${JSON.stringify(teamData.team1.stats)}
                Team 2 (${teamData.team2.name}) stats: ${JSON.stringify(teamData.team2.stats)}
                Head-to-head data: ${JSON.stringify(teamData.headToHead)}
                Pre-match news: ${JSON.stringify(teamData.preMatchNews)}
                Season statistics:
                - Team 1: ${JSON.stringify(teamData.seasonStats.team1)}
                - Team 2: ${JSON.stringify(teamData.seasonStats.team2)}
                
                Please provide a detailed analysis and prediction based on this information.`
            }]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}
