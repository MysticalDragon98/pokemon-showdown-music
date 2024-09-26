const express = require('express');
const nocache = require('nocache');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const https = require('https');  // Import the https module
const { readSecondaryPlaylist } = require('./playlists');

const app = express();

const bgmpath = path.join(__dirname, 'public', 'bgm');

//? Configure SSL Certs
const credentials = {
    cert: fs.readFileSync("/Users/camilotd/certs/ps-music.pem", 'utf8'),
    key: fs.readFileSync("/Users/camilotd/certs/ps-music-key.pem", 'utf8'),
    ca: fs.readFileSync("/Users/camilotd/certs/ps-music.pem", 'utf8')
};

app.use(nocache());
app.use(cors());
app.use(express.static('public'));
app.get('/random.mp3', (req, res) => {
    const bgmlist = fs.readdirSync(bgmpath).filter(file => file.endsWith('.mp3'));
    const random = Math.floor(Math.random() * bgmlist.length);
    console.log(bgmlist[random]);
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(path.join('/bgm', bgmlist[random]));
});

app.get('/list', (req, res) => {
    const bgmlist = fs.readdirSync(bgmpath).filter(file => file.endsWith('.mp3'));;

    
    res.json(bgmlist);
});

app.post('/playlist', (req, res) => {
    res.json(readSecondaryPlaylist(req.body.format ?? "default"));
});

app.get('/playlist', (req, res) => {
    res.json(readSecondaryPlaylist(req.query.format ?? "default"));
});

// Use https.createServer() with your credentials and Express app
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(3000, () => {
    console.log('HTTPS Server running on port 3000');
});

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);
