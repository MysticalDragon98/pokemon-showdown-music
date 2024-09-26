const fs = require('fs');
const { join } = require('path');

const folders = [
    "champion",
    "subchampion",
    "challenger",
    "elite4",
    "master",
    "rookie",
    "starcandidate",
    "starplayer",
    "veteran",
]

function readMp3Files (path) {
    try {
        const files = fs.readdirSync(join(__dirname, 'public', path))
            .filter(file => file.endsWith('.mp3'));
    
        return files.map(file => {
            return path + '/' + file;
        });
    } catch (exc) {
        if (exc.code === 'ENOENT') {
            return null;
        }

        throw exc;
    }
}

exports.readPlaylist = function (name) {
    return {
        champion: readMp3Files(join('playlists', name, 'champion')),
        subchampion: readMp3Files(join('playlists', name, 'subchampion')),
        challenger: readMp3Files(join('playlists', name, 'challenger')),
        elite4: readMp3Files(join('playlists', name, 'elite4')),
        master: readMp3Files(join('playlists', name, 'master')),
        rookie: readMp3Files(join('playlists', name, 'rookie')),
        starcandidate: readMp3Files(join('playlists', name, 'starcandidate')),
        starplayer: readMp3Files(join('playlists', name, 'starplayer')),
        veteran: readMp3Files(join('playlists', name, 'veteran'))
    }
}

exports.readSecondaryPlaylist = function (name) {
    const defaultPlaylist = exports.readPlaylist("default");
    const playlist = exports.readPlaylist(name);

    return {
        champion: playlist.champion || defaultPlaylist.champion,
        subchampion: playlist.subchampion || defaultPlaylist.subchampion,
        challenger: playlist.challenger || defaultPlaylist.challenger,
        elite4: playlist.elite4 || defaultPlaylist.elite4,
        master: playlist.master || defaultPlaylist.master,
        rookie: playlist.rookie || defaultPlaylist.rookie,
        starcandidate: playlist.starcandidate || defaultPlaylist.starcandidate,
        starplayer: playlist.starplayer || defaultPlaylist.starplayer,
        veteran: playlist.veteran || defaultPlaylist.veteran
    }
}