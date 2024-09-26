// ==UserScript==
// @name         Custom PS Music
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Custom pokemon showdown music!
// @author       You
// @match        https://play.pokemonshowdown.com/*
// @match        https://replay.pokemonshowdown.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

{/* Variables */
    var URL = 'https://ps-music:3000';
    var bgmList = [];
}

{/* Server Functions */

    //? 1. Loads the bgm list from the server
    var loadBGMList = async function loadBGMList () {
        bgmList = await fetch(URL + '/playlist').then(res => res.json());
    }

}

{/* Utils */
    var randomBGM = function randomBGM (category) {
        const list = bgmList[category];
        console.log("Random BGM: ", {
            category,
            list,
            bgmList
        })
        return URL + '/' + list[Math.floor(Math.random() * list.length)];
    }
}

{/* Hooks */

    //? 1. Plays background music on battle start
    //? - Replace the default hardcoded music with a random one
    BattleScene.prototype.setBgm = function setBgm(bgmNum) {
        if (this.bgmNum === bgmNum) return;
        this.bgmNum = bgmNum;

        switch (bgmNum) {
            case -1:
                this.bgm = BattleSound.loadBgm('audio/bw2-homika-dogars.mp3', 1661, 68131, this.bgm);
                break;
            default:
                this.bgm = BattleSound.loadBgm('', 0, Infinity, this.bgm);

                (async () => {
                    const start = Date.now();
                    while (!this.battle.p1.leaderboard || !this.battle.p2.leaderboard) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        if (Date.now() - start > 5000) {
                            console.log("[Custom-BGM] Failed to load leaderboard");
                            return;
                        }
                    }
    
                    console.log("[Custom-BGM] Loaded Music leaderboard: ", this.battle.p1.leaderboard, this.battle.p2.leaderboard);

                    const bgm = randomBGM(this.battle.farSide.leaderboard.category);
                    console.log("[Custom-BGM] Playing: ", bgm);
                    
                    this.bgm = BattleSound.loadBgm(bgm, 0, Infinity, this.bgm);
                    this.updateBgm();
                })();
                break;
        }

        this.updateBgm();
    }

    //? 2. Loads the URL from the server
    //? - This is the same as the original function, but it also adds the capability to use the URL from a custom server
    BattleSound.getSound = function getSound(url) {
        if (!window.HTMLAudioElement) return;
        if (this.soundCache[url]) return this.soundCache[url];
        try {
            const sound = document.createElement('audio');
            if (url.startsWith('http')) {
                sound.crossOrigin = 'anonymous';
                sound.src = url;
            } else {
                sound.src = 'https://' + Config.routes.client + '/' + url;
            }
            sound.volume = this.effectVolume / 100;
            this.soundCache[url] = sound;
            return sound;
        } catch {}
    }

    //? 3. Loads the BGM from the server
};

(function() {
    loadBGMList().then(() => {
        console.log('[CustomScript] BGM List loaded');
    });
})();