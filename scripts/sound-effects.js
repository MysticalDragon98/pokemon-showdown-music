// ==UserScript==
// @name         Battle PS Sound Effects!
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds damage, healing, effectivenes sound effects and more to pokemon showdown battles!
// @author       You
// @match        https://play.pokemonshowdown.com/*
// @match        https://replay.pokemonshowdown.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

{/* Variables */
    var URL = 'https://ps-music:3000';
    var nextBlocked = false;
    var preloadedSE = [
        "damage.wav",
        "faint.wav",
        "heal.wav",
        "not-very-effective.wav",
        "super-effective.wav",
        "boost",
        "unboost",
        "burn",
        "poison",
        "protect"
    ];
}

{/* Utils */
    //? 1. Prevents next sound effect from playing, 
    //? - this is useful when receiving -supereffective and -damage at the same time
    var blockNextSE =function blockNextSE () {
        nextBlocked = true;
    }

    //? 2. Preloads a sound effect so it doesnt take a little time before playing in battle
    var preloadSE = function preloadSE (name) {
        if (name.endsWith(".wav")) {
            const audio = new Audio(URL + "/se/" + name);
            audio.volume = 0;
            audio.play();
            audio.pause();
        } else {
            const audio = new Audio(URL + "/se/" + name + ".mp3");
            audio.volume = 0;
            audio.play();
            audio.pause();
        }
    }
    
    //? 3. Plays a sound effect
    var playSE = function playSE (name) {
        if (nextBlocked) {
            nextBlocked = false;
            return;
        }

        if (name.endsWith(".wav")) BattleSound.playEffect(URL + "/se/" + name)
        else BattleSound.playEffect(URL + "/se/" + name + ".mp3")
    }
}

{/* Hooks */

    //? 1. Run when a message is received from the server, used to play sound effects
    //? - Yeah, this function is a HELL
    Battle.prototype.runMinor = function runMinor(args, kwArgs, nextArgs, nextKwargs) {
        if (nextArgs && nextKwargs) {
            if (args[2] === 'Sturdy' && args[0] === '-activate') {
                args[2] = 'ability: Sturdy';
            }
            if (['-crit', '-supereffective', '-resisted'].includes(args[0]) || args[2] === 'ability: Sturdy') {
                kwArgs.then = '.';
            }
            if (args[0] === '-damage' && !kwArgs.from && args[1] !== nextArgs[1] && (
                ['-crit', '-supereffective', '-resisted'].includes(nextArgs[0]) ||
                (nextArgs[0] === '-damage' && !nextKwargs.from)
            )) {
                kwArgs.then = '.';
            }
            if (args[0] === '-damage' && nextArgs[0] === '-damage' && kwArgs.from && kwArgs.from === nextKwargs.from) {
                kwArgs.then = '.';
            }
            if (args[0] === '-ability' && (args[2] === 'Intimidate' || args[3] === 'boost')) {
                kwArgs.then = '.';
            }
            if (args[0] === '-unboost' && nextArgs[0] === '-unboost') {
                kwArgs.then = '.';
            }
            if (args[0] === '-boost' && nextArgs[0] === '-boost') {
                kwArgs.then = '.';
            }
            if (args[0] === '-damage' && kwArgs.from === 'Leech Seed' && nextArgs[0] === '-heal' && nextKwargs.silent) {
                kwArgs.then = '.';
            }
            if (args[0] === 'detailschange' && nextArgs[0] === '-mega') {
                if (this.scene.closeMessagebar()) {
                    this.currentStep--;
                    return;
                }
                kwArgs.simult = '.';
            }
        }
        if (kwArgs.then) this.waitForAnimations = false;
        if (kwArgs.simult) this.waitForAnimations = 'simult';

        const CONSUMED = ['eaten', 'popped', 'consumed', 'held up'];
        console.log("[RunMinor]", args);
        switch (args[0]) {
        case '-damage': {
            let poke = this.getPokemon(args[1]);
            let damage = poke.healthParse(args[2], true);
            if (damage === null) break;

            if (!kwArgs.from) {
                playSE("damage.wav");
            }

            let range = poke.getDamageRange(damage);

            if (kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                let ofpoke = this.getPokemon(kwArgs.of);
                this.activateAbility(ofpoke, effect);
                if (effect.effectType === 'Item') {
                    const itemPoke = ofpoke || poke;
                    if (itemPoke.prevItem !== effect.name && !CONSUMED.includes(itemPoke.prevItemEffect)) {
                        itemPoke.item = effect.name;
                    }
                }
                switch (effect.id) {
                case 'brn':
                    playSE("burn");
                    this.scene.runStatusAnim('brn', [poke]);
                    break;
                case 'psn':
                    playSE("poison");
                    this.scene.runStatusAnim('psn', [poke]);
                    break;
                case 'baddreams':
                    this.scene.runStatusAnim('cursed', [poke]);
                    break;
                case 'curse':
                    this.scene.runStatusAnim('cursed', [poke]);
                    break;
                case 'confusion':
                    this.scene.runStatusAnim('confusedselfhit', [poke]);
                    break;
                case 'leechseed':
                    this.scene.runOtherAnim('leech', [ofpoke, poke]);
                    break;
                case 'bind':
                case 'wrap':
                    this.scene.runOtherAnim('bound', [poke]);
                    break;
                }
            } else {
                if (this.dex.moves.get(this.lastMove).category !== 'Status') {
                    poke.timesAttacked++;
                }
                let damageinfo = '' + Pokemon.getFormattedRange(range, damage[1] === 100 ? 0 : 1, '\u2013');
                if (damage[1] !== 100) {
                    let hover = '' + ((damage[0] < 0) ? '\u2212' : '') +
                        Math.abs(damage[0]) + '/' + damage[1];
                    if (damage[1] === 48) { // this is a hack
                        hover += ' pixels';
                    }
                    // battle-log will convert this into <abbr>
                    damageinfo = '||' + hover + '||' + damageinfo + '||';
                }
                args[3] = damageinfo;
            }
            this.scene.damageAnim(poke, Pokemon.getFormattedRange(range, 0, ' to '));
            this.log(args, kwArgs);
            break;
        }
        case '-heal': {
            let poke = this.getPokemon(args[1]);
            let damage = poke.healthParse(args[2], true, true);
            if (!kwArgs.from) playSE("heal.wav");
            if (damage === null) break;
            let range = poke.getDamageRange(damage);

            if (kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                this.activateAbility(poke, effect);
                if (effect.effectType === 'Item' && !CONSUMED.includes(poke.prevItemEffect)) {
                    if (poke.prevItem !== effect.name) {
                        poke.item = effect.name;
                    }
                }
                switch (effect.id) {
                case 'lunardance':
                    for (let trackedMove of poke.moveTrack) {
                        trackedMove[1] = 0;
                    }
                    // falls through
                case 'healingwish':
                    this.lastMove = 'healing-wish';
                    this.scene.runResidualAnim('healingwish', poke);
                    poke.side.wisher = null;
                    poke.statusData.sleepTurns = 0;
                    poke.statusData.toxicTurns = 0;
                    break;
                case 'wish':
                    this.scene.runResidualAnim('wish', poke);
                    break;
                case 'revivalblessing':
                    this.scene.runResidualAnim('wish', poke);
                    const {siden} = this.parsePokemonId(args[1]);
                    const side = this.sides[siden];
                    poke.fainted = false;
                    poke.status = '';
                    this.scene.updateSidebar(side);
                    break;
                }
            }
            this.scene.runOtherAnim('heal', [poke]);
            this.scene.healAnim(poke, Pokemon.getFormattedRange(range, 0, ' to '));
            this.log(args, kwArgs);
            break;
        }
        case '-sethp': {
            for (let k = 0; k < 2; k++) {
                let cpoke = this.getPokemon(args[1 + 2 * k]);
                if (cpoke) {
                    let damage = cpoke.healthParse(args[2 + 2 * k]);
                    let range = cpoke.getDamageRange(damage);
                    let formattedRange = Pokemon.getFormattedRange(range, 0, ' to ');
                    let diff = damage[0];
                    if (diff > 0) {
                        this.scene.healAnim(cpoke, formattedRange);
                    } else {
                        this.scene.damageAnim(cpoke, formattedRange);
                    }
                }
            }
            this.log(args, kwArgs);
            break;
        }
        case '-boost': {
            let poke = this.getPokemon(args[1]);
            let stat = args[2] ;
            playSE("boost");
            if (this.gen === 1 && stat === 'spd') break;
            if (this.gen === 1 && stat === 'spa') stat = 'spc';
            let amount = parseInt(args[3], 10);
            if (amount === 0) {
                this.scene.resultAnim(poke, 'already ' + poke.getBoost(stat), 'neutral');
                this.log(args, kwArgs);
                break;
            }
            if (!poke.boosts[stat]) {
                poke.boosts[stat] = 0;
            }
            poke.boosts[stat] += amount;

            if (!kwArgs.silent && kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                let ofpoke = this.getPokemon(kwArgs.of);
                if (!(effect.id === 'weakarmor' && stat === 'spe')) {
                    this.activateAbility(ofpoke || poke, effect);
                }
            }
            this.scene.resultAnim(poke, poke.getBoost(stat), 'good');
            this.log(args, kwArgs);
            break;
        }
        case '-unboost': {
            let poke = this.getPokemon(args[1]);
            let stat = args[2] ;
            playSE("unboost");
            if (this.gen === 1 && stat === 'spd') break;
            if (this.gen === 1 && stat === 'spa') stat = 'spc';
            let amount = parseInt(args[3], 10);
            if (amount === 0) {
                this.scene.resultAnim(poke, 'already ' + poke.getBoost(stat), 'neutral');
                this.log(args, kwArgs);
                break;
            }
            if (!poke.boosts[stat]) {
                poke.boosts[stat] = 0;
            }
            poke.boosts[stat] -= amount;

            if (!kwArgs.silent && kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                let ofpoke = this.getPokemon(kwArgs.of);
                this.activateAbility(ofpoke || poke, effect);
            }
            this.scene.resultAnim(poke, poke.getBoost(stat), 'bad');
            this.log(args, kwArgs);
            break;
        }
        case '-setboost': {
            let poke = this.getPokemon(args[1]);
            let stat = args[2] ;
            let amount = parseInt(args[3], 10);
            poke.boosts[stat] = amount;
            this.scene.resultAnim(poke, poke.getBoost(stat), (amount > 0 ? 'good' : 'bad'));
            this.log(args, kwArgs);
            break;
        }
        case '-swapboost': {
            let poke = this.getPokemon(args[1]);
            let poke2 = this.getPokemon(args[2]);
            let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
            for (const stat of stats) {
                let tmp = poke.boosts[stat];
                poke.boosts[stat] = poke2.boosts[stat];
                if (!poke.boosts[stat]) delete poke.boosts[stat];
                poke2.boosts[stat] = tmp;
                if (!poke2.boosts[stat]) delete poke2.boosts[stat];
            }
            this.scene.resultAnim(poke, 'Stats swapped', 'neutral');
            this.scene.resultAnim(poke2, 'Stats swapped', 'neutral');

            this.log(args, kwArgs);
            break;
        }
        case '-clearpositiveboost': {
            let poke = this.getPokemon(args[1]);
            let ofpoke = this.getPokemon(args[2]);
            let effect = Dex.getEffect(args[3]);
            for (const stat in poke.boosts) {
                if (poke.boosts[stat] > 0) delete poke.boosts[stat];
            }
            this.scene.resultAnim(poke, 'Boosts lost', 'bad');

            if (effect.id) {
                switch (effect.id) {
                case 'spectralthief':
                    // todo: update StealBoosts so it animates 1st on Spectral Thief
                    this.scene.runOtherAnim('spectralthiefboost', [ofpoke, poke]);
                    break;
                }
            }
            this.log(args, kwArgs);
            break;
        }
        case '-clearnegativeboost': {
            let poke = this.getPokemon(args[1]);
            for (const stat in poke.boosts) {
                if (poke.boosts[stat] < 0) delete poke.boosts[stat];
            }
            this.scene.resultAnim(poke, 'Restored', 'good');

            this.log(args, kwArgs);
            break;
        }
        case '-copyboost': {
            let poke = this.getPokemon(args[1]);
            let frompoke = this.getPokemon(args[2]);
            if (!kwArgs.silent && kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                this.activateAbility(poke, effect);
            }
            let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
            for (const stat of stats) {
                poke.boosts[stat] = frompoke.boosts[stat];
                if (!poke.boosts[stat]) delete poke.boosts[stat];
            }
            if (this.gen >= 6) {
                const volatilesToCopy = ['focusenergy', 'gmaxchistrike', 'laserfocus'];
                for (const volatile of volatilesToCopy) {
                    if (frompoke.volatiles[volatile]) {
                        poke.addVolatile(volatile);
                    } else {
                        poke.removeVolatile(volatile);
                    }
                }
            }
            this.scene.resultAnim(poke, 'Stats copied', 'neutral');

            this.log(args, kwArgs);
            break;
        }
        case '-clearboost': {
            let poke = this.getPokemon(args[1]);
            poke.boosts = {};
            if (!kwArgs.silent && kwArgs.from) {
                let effect = Dex.getEffect(kwArgs.from);
                let ofpoke = this.getPokemon(kwArgs.of);
                this.activateAbility(ofpoke || poke, effect);
            }
            this.scene.resultAnim(poke, 'Stats reset', 'neutral');

            this.log(args, kwArgs);
            break;
        }
        case '-invertboost': {
            let poke = this.getPokemon(args[1]);
            for (const stat in poke.boosts) {
                poke.boosts[stat] = -poke.boosts[stat];
            }
            this.scene.resultAnim(poke, 'Stats inverted', 'neutral');

            this.log(args, kwArgs);
            break;
        }
        case '-clearallboost': {
            let timeOffset = this.scene.timeOffset;
            for (const active of this.getAllActive()) {
                active.boosts = {};
                this.scene.timeOffset = timeOffset;
                this.scene.resultAnim(active, 'Stats reset', 'neutral');
            }

            this.log(args, kwArgs);
            break;
        }
        case '-crit': {
            let poke = this.getPokemon(args[1]);
            if (poke) this.scene.resultAnim(poke, 'Critical hit', 'bad');
            if (this.activeMoveIsSpread) kwArgs.spread = '.';
            this.log(args, kwArgs);
            break;
        }
        case '-supereffective': {
            let poke = this.getPokemon(args[1]);
            playSE('super-effective.wav');
            if (nextArgs[0] === "-damage") {
                blockNextSE();
            }
            if (poke) {
                this.scene.resultAnim(poke, 'Super-effective', 'bad');
                if (window.Config?.server?.afd) {
                    this.scene.runOtherAnim('hitmark', [poke]);
                }
            }
            if (this.activeMoveIsSpread) kwArgs.spread = '.';
            this.log(args, kwArgs);
            break;
        }
        case '-resisted': {
            let poke = this.getPokemon(args[1]);
            playSE('not-very-effective.wav');
            if (nextArgs[0] === "-damage") {
                blockNextSE();
            }
            if (poke) this.scene.resultAnim(poke, 'Resisted', 'neutral');
            if (this.activeMoveIsSpread) kwArgs.spread = '.';
            this.log(args, kwArgs);
            break;
        }
        case '-immune': {
            let poke = this.getPokemon(args[1]);
            let fromeffect = Dex.getEffect(kwArgs.from);
            this.activateAbility(this.getPokemon(kwArgs.of) || poke, fromeffect);
            this.log(args, kwArgs);
            this.scene.resultAnim(poke, 'Immune', 'neutral');
            break;
        }
        case '-miss': {
            let target = this.getPokemon(args[2]);
            if (target) {
                this.scene.resultAnim(target, 'Missed', 'neutral');
            }
            this.log(args, kwArgs);
            break;
        }
        case '-fail': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            let fromeffect = Dex.getEffect(kwArgs.from);
            let ofpoke = this.getPokemon(kwArgs.of);
            if (fromeffect.id === 'clearamulet') {
                ofpoke.item = 'Clear Amulet';
            } else {
                this.activateAbility(ofpoke || poke, fromeffect);
            }
            switch (effect.id) {
            case 'brn':
                this.scene.resultAnim(poke, 'Already burned', 'neutral');
                break;
            case 'tox':
            case 'psn':
                this.scene.resultAnim(poke, 'Already poisoned', 'neutral');
                break;
            case 'slp':
                if (fromeffect.id === 'uproar') {
                    this.scene.resultAnim(poke, 'Failed', 'neutral');
                } else {
                    this.scene.resultAnim(poke, 'Already asleep', 'neutral');
                }
                break;
            case 'par':
                this.scene.resultAnim(poke, 'Already paralyzed', 'neutral');
                break;
            case 'frz':
                this.scene.resultAnim(poke, 'Already frozen', 'neutral');
                break;
            case 'unboost':
                this.scene.resultAnim(poke, 'Stat drop blocked', 'neutral');
                break;
            default:
                if (poke) {
                    this.scene.resultAnim(poke, 'Failed', 'neutral');
                }
                break;
            }
            this.scene.animReset(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-block': {
            let poke = this.getPokemon(args[1]);
            let ofpoke = this.getPokemon(kwArgs.of);
            let effect = Dex.getEffect(args[2]);
            this.activateAbility(ofpoke || poke, effect);
            switch (effect.id) {
            case 'quickguard':
                poke.addTurnstatus('quickguard');
                this.scene.resultAnim(poke, 'Quick Guard', 'good');
                break;
            case 'wideguard':
                poke.addTurnstatus('wideguard');
                this.scene.resultAnim(poke, 'Wide Guard', 'good');
                break;
            case 'craftyshield':
                poke.addTurnstatus('craftyshield');
                this.scene.resultAnim(poke, 'Crafty Shield', 'good');
                break;
            case 'protect':
                playSE("protect");
                poke.addTurnstatus('protect');
                this.scene.resultAnim(poke, 'Protected', 'good');
                break;

            case 'safetygoggles':
                poke.item = 'Safety Goggles';
                break;
            case 'protectivepads':
                poke.item = 'Protective Pads';
                break;
            case 'abilityshield':
                poke.item = 'Ability Shield';
                break;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-center': case '-notarget': case '-ohko':
        case '-combine': case '-hitcount': case '-waiting': case '-zbroken': {
            this.log(args, kwArgs);
            break;
        }
        case '-zpower': {
            let poke = this.getPokemon(args[1]);
            this.scene.runOtherAnim('zpower', [poke]);
            this.log(args, kwArgs);
            break;
        }
        case '-prepare': {
            let poke = this.getPokemon(args[1]);
            let moveid = toID(args[2]);
            let target = this.getPokemon(args[3]) || poke.side.foe.active[0] || poke;
            this.scene.runPrepareAnim(moveid, poke, target);
            this.log(args, kwArgs);
            break;
        }
        case '-mustrecharge': {
            let poke = this.getPokemon(args[1]);
            poke.addMovestatus('mustrecharge');
            this.scene.updateStatbar(poke);
            break;
        }
        case '-status': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(kwArgs.from);
            let ofpoke = this.getPokemon(kwArgs.of) || poke;
            poke.status = args[2];
            this.activateAbility(ofpoke || poke, effect);
            if (effect.effectType === 'Item') {
                ofpoke.item = effect.name;
            }

            switch (args[2]) {
            case 'brn':
                this.scene.resultAnim(poke, 'Burned', 'brn');
                this.scene.runStatusAnim('brn', [poke]);
                break;
            case 'tox':
                this.scene.resultAnim(poke, 'Toxic poison', 'psn');
                this.scene.runStatusAnim('psn', [poke]);
                poke.statusData.toxicTurns = (effect.name === "Toxic Orb" ? -1 : 0);
                break;
            case 'psn':
                this.scene.resultAnim(poke, 'Poisoned', 'psn');
                this.scene.runStatusAnim('psn', [poke]);
                break;
            case 'slp':
                this.scene.resultAnim(poke, 'Asleep', 'slp');
                if (effect.id === 'rest') {
                    poke.statusData.sleepTurns = 0; // for Gen 2 use through Sleep Talk
                }
                break;
            case 'par':
                this.scene.resultAnim(poke, 'Paralyzed', 'par');
                this.scene.runStatusAnim('par', [poke]);
                break;
            case 'frz':
                this.scene.resultAnim(poke, 'Frozen', 'frz');
                this.scene.runStatusAnim('frz', [poke]);
                break;
            default:
                this.scene.updateStatbar(poke);
                break;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-curestatus': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(kwArgs.from);

            if (effect.id) {
                switch (effect.id) {
                case 'flamewheel':
                case 'flareblitz':
                case 'fusionflare':
                case 'sacredfire':
                case 'scald':
                case 'steameruption':
                    kwArgs.thaw = '.';
                    break;
                }
            }
            if (poke) {
                poke.status = '';
                switch (args[2]) {
                case 'brn':
                    this.scene.resultAnim(poke, 'Burn cured', 'good');
                    break;
                case 'tox':
                case 'psn':
                    poke.statusData.toxicTurns = 0;
                    this.scene.resultAnim(poke, 'Poison cured', 'good');
                    break;
                case 'slp':
                    this.scene.resultAnim(poke, 'Woke up', 'good');
                    poke.statusData.sleepTurns = 0;
                    break;
                case 'par':
                    this.scene.resultAnim(poke, 'Paralysis cured', 'good');
                    break;
                case 'frz':
                    this.scene.resultAnim(poke, 'Thawed', 'good');
                    break;
                default:
                    poke.removeVolatile('confusion');
                    this.scene.resultAnim(poke, 'Cured', 'good');
                }
            }
            this.log(args, kwArgs);
            break;

        }
        case '-cureteam': { // For old gens when the whole team was always cured
            let poke = this.getPokemon(args[1]);
            for (const target of poke.side.pokemon) {
                target.status = '';
                this.scene.updateStatbarIfExists(target);
            }

            this.scene.resultAnim(poke, 'Team Cured', 'good');
            this.log(args, kwArgs);
            break;
        }
        case '-item': {
            let poke = this.getPokemon(args[1]);
            let item = Dex.items.get(args[2]);
            let effect = Dex.getEffect(kwArgs.from);
            let ofpoke = this.getPokemon(kwArgs.of);
            poke.item = item.name;
            poke.itemEffect = '';
            poke.removeVolatile('airballoon');
            if (item.id === 'airballoon') poke.addVolatile('airballoon');

            if (effect.id) {
                switch (effect.id) {
                case 'pickup':
                    this.activateAbility(poke, "Pickup");
                    // falls through
                case 'recycle':
                    poke.itemEffect = 'found';
                    this.scene.resultAnim(poke, item.name, 'neutral');
                    break;
                case 'frisk':
                    this.activateAbility(ofpoke, "Frisk");
                    if (poke && poke !== ofpoke) { // used for gen 6
                        poke.itemEffect = 'frisked';
                        this.scene.resultAnim(poke, item.name, 'neutral');
                    }
                    break;
                case 'magician':
                case 'pickpocket':
                    this.activateAbility(poke, effect.name);
                    // falls through
                case 'thief':
                case 'covet':
                    // simulate the removal of the item from the ofpoke
                    ofpoke.item = '';
                    ofpoke.itemEffect = '';
                    ofpoke.prevItem = item.name;
                    ofpoke.prevItemEffect = 'stolen';
                    ofpoke.addVolatile('itemremoved');
                    poke.itemEffect = 'stolen';
                    this.scene.resultAnim(poke, item.name, 'neutral');
                    this.scene.resultAnim(ofpoke, 'Item Stolen', 'bad');
                    break;
                case 'harvest':
                    poke.itemEffect = 'harvested';
                    this.activateAbility(poke, "Harvest");
                    this.scene.resultAnim(poke, item.name, 'neutral');
                    break;
                case 'bestow':
                    poke.itemEffect = 'bestowed';
                    this.scene.resultAnim(poke, item.name, 'neutral');
                    break;
                case 'switcheroo':
                case 'trick':
                    poke.itemEffect = 'tricked';
                    // falls through
                default:
                    break;
                }
            } else {
                switch (item.id) {
                case 'airballoon':
                    this.scene.resultAnim(poke, 'Balloon', 'good');
                    break;
                }
            }
            this.log(args, kwArgs);
            break;
        }
        case '-enditem': {
            let poke = this.getPokemon(args[1]);
            let item = Dex.items.get(args[2]);
            let effect = Dex.getEffect(kwArgs.from);
            if (this.gen > 4 || effect.id !== 'knockoff') {
                poke.item = '';
                poke.itemEffect = '';
                poke.prevItem = item.name;
                poke.prevItemEffect = '';
            }
            poke.removeVolatile('airballoon');
            poke.addVolatile('itemremoved');
            if (kwArgs.eat) {
                poke.prevItemEffect = 'eaten';
                this.scene.runOtherAnim('consume', [poke]);
                this.lastMove = item.id;
            } else if (kwArgs.weaken) {
                poke.prevItemEffect = 'eaten';
                this.lastMove = item.id;
            } else if (effect.id) {
                switch (effect.id) {
                case 'fling':
                    poke.prevItemEffect = 'flung';
                    break;
                case 'knockoff':
                    if (this.gen <= 4) {
                        poke.itemEffect = 'knocked off';
                    } else {
                        poke.prevItemEffect = 'knocked off';
                    }
                    this.scene.runOtherAnim('itemoff', [poke]);
                    this.scene.resultAnim(poke, 'Item knocked off', 'neutral');
                    break;
                case 'stealeat':
                    poke.prevItemEffect = 'stolen';
                    break;
                case 'gem':
                    poke.prevItemEffect = 'consumed';
                    break;
                case 'incinerate':
                    poke.prevItemEffect = 'incinerated';
                    break;
                }
            } else {
                switch (item.id) {
                case 'airballoon':
                    poke.prevItemEffect = 'popped';
                    poke.removeVolatile('airballoon');
                    this.scene.resultAnim(poke, 'Balloon popped', 'neutral');
                    break;
                case 'focussash':
                    poke.prevItemEffect = 'consumed';
                    this.scene.resultAnim(poke, 'Sash', 'neutral');
                    break;
                case 'focusband':
                    this.scene.resultAnim(poke, 'Focus Band', 'neutral');
                    break;
                case 'redcard':
                    poke.prevItemEffect = 'held up';
                    break;
                default:
                    poke.prevItemEffect = 'consumed';
                    break;
                }
            }
            this.log(args, kwArgs);
            break;
        }
        case '-ability': {
            let poke = this.getPokemon(args[1]);
            let ability = Dex.abilities.get(args[2]);
            let effect = Dex.getEffect(kwArgs.from);
            let ofpoke = this.getPokemon(kwArgs.of);
            poke.rememberAbility(ability.name, effect.id && !kwArgs.fail);

            if (kwArgs.silent) {
                // do nothing
            } else if (effect.id) {
                switch (effect.id) {
                case 'trace':
                    this.activateAbility(poke, "Trace");
                    this.scene.wait(500);
                    this.activateAbility(poke, ability.name, true);
                    ofpoke.rememberAbility(ability.name);
                    break;
                case 'powerofalchemy':
                case 'receiver':
                    this.activateAbility(poke, effect.name);
                    this.scene.wait(500);
                    this.activateAbility(poke, ability.name, true);
                    ofpoke.rememberAbility(ability.name);
                    break;
                case 'roleplay':
                    this.activateAbility(poke, ability.name, true);
                    ofpoke.rememberAbility(ability.name);
                    break;
                case 'desolateland':
                case 'primordialsea':
                case 'deltastream':
                    if (kwArgs.fail) {
                        this.activateAbility(poke, ability.name);
                    }
                    break;
                default:
                    this.activateAbility(poke, ability.name);
                    break;
                }
            } else {
                this.activateAbility(poke, ability.name);
            }
            this.scene.updateWeather();
            this.log(args, kwArgs);
            break;
        }
        case '-endability': {
            // deprecated; use |-start| for Gastro Acid
            // and the third arg of |-ability| for Entrainment et al
            let poke = this.getPokemon(args[1]);
            let ability = Dex.abilities.get(args[2]);
            poke.ability = '(suppressed)';

            if (ability.id) {
                if (!poke.baseAbility) poke.baseAbility = ability.name;
            }
            this.log(args, kwArgs);
            break;
        }
        case 'detailschange': {
            let poke = this.getPokemon(args[1]);
            poke.removeVolatile('formechange');
            poke.removeVolatile('typeadd');
            poke.removeVolatile('typechange');

            let newSpeciesForme = args[2];
            let commaIndex = newSpeciesForme.indexOf(',');
            if (commaIndex !== -1) {
                let level = newSpeciesForme.substr(commaIndex + 1).trim();
                if (level.charAt(0) === 'L') {
                    poke.level = parseInt(level.substr(1), 10);
                }
                newSpeciesForme = args[2].substr(0, commaIndex);
            }
            let species = this.dex.species.get(newSpeciesForme);

            poke.speciesForme = newSpeciesForme;
            poke.ability = poke.baseAbility = (species.abilities ? species.abilities['0'] : '');

            poke.details = args[2];
            poke.searchid = args[1].substr(0, 2) + args[1].substr(3) + '|' + args[2];

            let isCustomAnim = species.id !== 'palafinhero';
            this.scene.animTransform(poke, isCustomAnim, true);
            this.log(args, kwArgs);
            break;
        }
        case '-transform': {
            let poke = this.getPokemon(args[1]);
            let tpoke = this.getPokemon(args[2]);
            let effect = Dex.getEffect(kwArgs.from);
            if (poke === tpoke) throw new Error("Transforming into self");

            if (!kwArgs.silent) {
                this.activateAbility(poke, effect);
            }

            poke.boosts = {...tpoke.boosts};
            poke.copyTypesFrom(tpoke, true);
            poke.ability = tpoke.ability;
            poke.timesAttacked = tpoke.timesAttacked;
            const targetForme = tpoke.volatiles.formechange;
            const speciesForme = (targetForme && !targetForme[1].endsWith('-Gmax')) ? targetForme[1] : tpoke.speciesForme;
            const pokemon = tpoke;
            const shiny = tpoke.shiny;
            const gender = tpoke.gender;
            const level = tpoke.level;
            poke.addVolatile('transform', pokemon, shiny, gender, level);
            poke.addVolatile('formechange', speciesForme);
            for (const trackedMove of tpoke.moveTrack) {
                poke.rememberMove(trackedMove[0], 0);
            }
            this.scene.animTransform(poke);
            this.scene.resultAnim(poke, 'Transformed', 'good');
            this.log(['-transform', args[1], args[2], tpoke.speciesForme], kwArgs);
            break;
        }
        case '-formechange': {
            let poke = this.getPokemon(args[1]);
            let species = Dex.species.get(args[2]);
            let fromeffect = Dex.getEffect(kwArgs.from);
            let isCustomAnim = species.name.startsWith('Wishiwashi');
            if (!poke.getSpeciesForme().endsWith('-Gmax') && !species.name.endsWith('-Gmax')) {
                poke.removeVolatile('typeadd');
                poke.removeVolatile('typechange');
                if (this.gen >= 6) poke.removeVolatile('autotomize');
            }

            if (!kwArgs.silent) {
                this.activateAbility(poke, fromeffect);
            }
            poke.addVolatile('formechange', species.name); // the formechange volatile reminds us to revert the sprite change on switch-out
            this.scene.animTransform(poke, isCustomAnim);
            this.log(args, kwArgs);
            break;
        }
        case '-mega': {
            let poke = this.getPokemon(args[1]);
            let item = Dex.items.get(args[3]);
            if (args[3]) {
                poke.item = item.name;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-primal': case '-burst': {
            this.log(args, kwArgs);
            break;
        }
        case '-terastallize': {
            let poke = this.getPokemon(args[1]);
            let type = Dex.types.get(args[2]).name;
            poke.terastallized = type;
            poke.details += `, tera:${type}`;
            poke.searchid += `, tera:${type}`;
            this.scene.animTransform(poke, true);
            this.scene.resetStatbar(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-start': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            let ofpoke = this.getPokemon(kwArgs.of);
            let fromeffect = Dex.getEffect(kwArgs.from);

            this.activateAbility(poke, effect);
            this.activateAbility(ofpoke || poke, fromeffect);
            switch (effect.id) {
            case 'typechange':
                if (poke.terastallized) break;
                if (ofpoke && fromeffect.id === 'reflecttype') {
                    poke.copyTypesFrom(ofpoke);
                } else {
                    const types = Dex.sanitizeName(args[3] || '???');
                    poke.removeVolatile('typeadd');
                    poke.addVolatile('typechange', types);
                    if (!kwArgs.silent) {
                        this.scene.typeAnim(poke, types);
                    }
                }
                this.scene.updateStatbar(poke);
                break;
            case 'typeadd':
                const type = Dex.sanitizeName(args[3]);
                poke.addVolatile('typeadd', type);
                if (kwArgs.silent) break;
                this.scene.typeAnim(poke, type);
                break;
            case 'dynamax':
                poke.addVolatile('dynamax', !!args[3]);
                this.scene.animTransform(poke, true);
                break;
            case 'powertrick':
                this.scene.resultAnim(poke, 'Power Trick', 'neutral');
                break;
            case 'foresight':
            case 'miracleeye':
                this.scene.resultAnim(poke, 'Identified', 'bad');
                break;
            case 'telekinesis':
                this.scene.resultAnim(poke, 'Telekinesis', 'neutral');
                break;
            case 'confusion':
                playSE("confusion");
                if (!kwArgs.already) {
                    this.scene.runStatusAnim('confused', [poke]);
                    this.scene.resultAnim(poke, 'Confused', 'bad');
                }
                break;
            case 'leechseed':
                this.scene.updateStatbar(poke);
                break;
            case 'healblock':
                this.scene.resultAnim(poke, 'Heal Block', 'bad');
                break;
            case 'yawn':
                this.scene.resultAnim(poke, 'Drowsy', 'slp');
                break;
            case 'taunt':
                this.scene.resultAnim(poke, 'Taunted', 'bad');
                break;
            case 'imprison':
                this.scene.resultAnim(poke, 'Imprisoning', 'good');
                break;
            case 'disable':
                this.scene.resultAnim(poke, 'Disabled', 'bad');
                break;
            case 'embargo':
                this.scene.resultAnim(poke, 'Embargo', 'bad');
                break;
            case 'torment':
                this.scene.resultAnim(poke, 'Tormented', 'bad');
                break;
            case 'ingrain':
                this.scene.resultAnim(poke, 'Ingrained', 'good');
                break;
            case 'aquaring':
                this.scene.resultAnim(poke, 'Aqua Ring', 'good');
                break;
            case 'stockpile1':
                this.scene.resultAnim(poke, 'Stockpile', 'good');
                break;
            case 'stockpile2':
                poke.removeVolatile('stockpile1');
                this.scene.resultAnim(poke, 'Stockpile&times;2', 'good');
                break;
            case 'stockpile3':
                poke.removeVolatile('stockpile2');
                this.scene.resultAnim(poke, 'Stockpile&times;3', 'good');
                break;
            case 'perish0':
                poke.removeVolatile('perish1');
                break;
            case 'perish1':
                poke.removeVolatile('perish2');
                this.scene.resultAnim(poke, 'Perish next turn', 'bad');
                break;
            case 'perish2':
                poke.removeVolatile('perish3');
                this.scene.resultAnim(poke, 'Perish in 2', 'bad');
                break;
            case 'perish3':
                if (!kwArgs.silent) this.scene.resultAnim(poke, 'Perish in 3', 'bad');
                break;
            case 'encore':
                this.scene.resultAnim(poke, 'Encored', 'bad');
                break;
            case 'bide':
                this.scene.resultAnim(poke, 'Bide', 'good');
                break;
            case 'attract':
                this.scene.resultAnim(poke, 'Attracted', 'bad');
                break;
            case 'autotomize':
                this.scene.resultAnim(poke, 'Lightened', 'good');
                if (poke.volatiles.autotomize) {
                    poke.volatiles.autotomize[1]++;
                } else {
                    poke.addVolatile('autotomize', 1);
                }
                break;
            case 'focusenergy':
                this.scene.resultAnim(poke, '+Crit rate', 'good');
                break;
            case 'curse':
                this.scene.resultAnim(poke, 'Cursed', 'bad');
                break;
            case 'nightmare':
                this.scene.resultAnim(poke, 'Nightmare', 'bad');
                break;
            case 'magnetrise':
                this.scene.resultAnim(poke, 'Magnet Rise', 'good');
                break;
            case 'smackdown':
                this.scene.resultAnim(poke, 'Smacked Down', 'bad');
                poke.removeVolatile('magnetrise');
                poke.removeVolatile('telekinesis');
                if (poke.lastMove === 'fly' || poke.lastMove === 'bounce') this.scene.animReset(poke);
                break;
            case 'substitute':
                playSE("substitute");
                blockNextSE();
                if (kwArgs.damage) {
                    this.scene.resultAnim(poke, 'Damage', 'bad');
                } else if (kwArgs.block) {
                    this.scene.resultAnim(poke, 'Blocked', 'neutral');
                }
                break;

            // Gen 1-2
            case 'mist':
                this.scene.resultAnim(poke, 'Mist', 'good');
                break;
            // Gen 1
            case 'lightscreen':
                this.scene.resultAnim(poke, 'Light Screen', 'good');
                break;
            case 'reflect':
                this.scene.resultAnim(poke, 'Reflect', 'good');
                break;
            }
            if (!(effect.id === 'typechange' && poke.terastallized)) {
                poke.addVolatile(effect.id);
            }
            this.scene.updateStatbar(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-end': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            let fromeffect = Dex.getEffect(kwArgs.from);
            poke.removeVolatile(effect.id);

            if (kwArgs.silent) {
                // do nothing
            } else {
                switch (effect.id) {
                case 'dynamax':
                    this.scene.animTransform(poke);
                    break;
                case 'powertrick':
                    this.scene.resultAnim(poke, 'Power Trick', 'neutral');
                    break;
                case 'telekinesis':
                    this.scene.resultAnim(poke, 'Telekinesis&nbsp;ended', 'neutral');
                    break;
                case 'skydrop':
                    if (kwArgs.interrupt) {
                        this.scene.anim(poke, {time: 100});
                    }
                    break;
                case 'confusion':
                    this.scene.resultAnim(poke, 'Confusion&nbsp;ended', 'good');
                    break;
                case 'leechseed':
                    if (fromeffect.id === 'rapidspin') {
                        this.scene.resultAnim(poke, 'De-seeded', 'good');
                    }
                    break;
                case 'healblock':
                    this.scene.resultAnim(poke, 'Heal Block ended', 'good');
                    break;
                case 'attract':
                    this.scene.resultAnim(poke, 'Attract&nbsp;ended', 'good');
                    break;
                case 'taunt':
                    this.scene.resultAnim(poke, 'Taunt&nbsp;ended', 'good');
                    break;
                case 'disable':
                    this.scene.resultAnim(poke, 'Disable&nbsp;ended', 'good');
                    break;
                case 'embargo':
                    this.scene.resultAnim(poke, 'Embargo ended', 'good');
                    break;
                case 'torment':
                    this.scene.resultAnim(poke, 'Torment&nbsp;ended', 'good');
                    break;
                case 'encore':
                    this.scene.resultAnim(poke, 'Encore&nbsp;ended', 'good');
                    break;
                case 'bide':
                    this.scene.runOtherAnim('bideunleash', [poke]);
                    break;
                case 'illusion':
                    this.scene.resultAnim(poke, 'Illusion ended', 'bad');
                    poke.rememberAbility('Illusion');
                    break;
                case 'slowstart':
                    this.scene.resultAnim(poke, 'Slow Start ended', 'good');
                    break;
                case 'perishsong': // for backwards compatibility
                    poke.removeVolatile('perish3');
                    break;
                case 'substitute':
                    this.scene.resultAnim(poke, 'Faded', 'bad');
                    break;
                case 'stockpile':
                    poke.removeVolatile('stockpile1');
                    poke.removeVolatile('stockpile2');
                    poke.removeVolatile('stockpile3');
                    break;
                case 'protosynthesis':
                    poke.removeVolatile('protosynthesisatk');
                    poke.removeVolatile('protosynthesisdef');
                    poke.removeVolatile('protosynthesisspa');
                    poke.removeVolatile('protosynthesisspd');
                    poke.removeVolatile('protosynthesisspe');
                    break;
                case 'quarkdrive':
                    poke.removeVolatile('quarkdriveatk');
                    poke.removeVolatile('quarkdrivedef');
                    poke.removeVolatile('quarkdrivespa');
                    poke.removeVolatile('quarkdrivespd');
                    poke.removeVolatile('quarkdrivespe');
                    break;
                default:
                    if (effect.effectType === 'Move') {
                        if (effect.name === 'Doom Desire') {
                            this.scene.runOtherAnim('doomdesirehit', [poke]);
                        }
                        if (effect.name === 'Future Sight') {
                            this.scene.runOtherAnim('futuresighthit', [poke]);
                        }
                    }
                }
            }
            this.scene.updateStatbar(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-singleturn': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            if (effect.id === 'roost' && !poke.getTypeList().includes('Flying')) {
                break;
            }
            poke.addTurnstatus(effect.id);
            switch (effect.id) {
            case 'roost':
                this.scene.resultAnim(poke, 'Landed', 'neutral');
                break;
            case 'quickguard':
                this.scene.resultAnim(poke, 'Quick Guard', 'good');
                break;
            case 'wideguard':
                this.scene.resultAnim(poke, 'Wide Guard', 'good');
                break;
            case 'craftyshield':
                this.scene.resultAnim(poke, 'Crafty Shield', 'good');
                break;
            case 'matblock':
                this.scene.resultAnim(poke, 'Mat Block', 'good');
                break;
            case 'protect':
                this.scene.resultAnim(poke, 'Protected', 'good');
                break;
            case 'endure':
                this.scene.resultAnim(poke, 'Enduring', 'good');
                break;
            case 'helpinghand':
                this.scene.resultAnim(poke, 'Helping Hand', 'good');
                break;
            case 'focuspunch':
                this.scene.resultAnim(poke, 'Focusing', 'neutral');
                poke.rememberMove(effect.name, 0);
                break;
            case 'shelltrap':
                this.scene.resultAnim(poke, 'Trap set', 'neutral');
                poke.rememberMove(effect.name, 0);
                break;
            case 'beakblast':
                this.scene.runOtherAnim('bidecharge', [poke]);
                this.scene.resultAnim(poke, 'Beak Blast', 'neutral');
                break;
            }
            this.scene.updateStatbar(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-singlemove': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            poke.addMovestatus(effect.id);
            switch (effect.id) {
            case 'grudge':
                this.scene.resultAnim(poke, 'Grudge', 'neutral');
                break;
            case 'destinybond':
                this.scene.resultAnim(poke, 'Destiny Bond', 'neutral');
                break;
            }
            this.scene.updateStatbar(poke);
            this.log(args, kwArgs);
            break;
        }
        case '-activate': {
            let poke = this.getPokemon(args[1]);
            let effect = Dex.getEffect(args[2]);
            let target = this.getPokemon(args[3]);
            this.activateAbility(poke, effect);
            switch (effect.id) {
            case 'poltergeist':
                poke.item = kwArgs.item;
                poke.itemEffect = 'disturbed';
                break;
            case 'grudge':
                poke.rememberMove(kwArgs.move, Infinity);
                break;
            case 'substitute':
                if (kwArgs.damage) {
                    this.scene.resultAnim(poke, 'Damage', 'bad');
                } else if (kwArgs.block) {
                    this.scene.resultAnim(poke, 'Blocked', 'neutral');
                }
                break;
            case 'attract':
                this.scene.runStatusAnim('attracted', [poke]);
                break;
            case 'bide':
                this.scene.runOtherAnim('bidecharge', [poke]);
                break;

            // move activations
            case 'aromatherapy':
                this.scene.resultAnim(poke, 'Team Cured', 'good');
                break;
            case 'healbell':
                this.scene.resultAnim(poke, 'Team Cured', 'good');
                break;
            case 'brickbreak':
                target.side.removeSideCondition('Reflect');
                target.side.removeSideCondition('LightScreen');
                break;
            case 'hyperdrill':
            case 'hyperspacefury':
            case 'hyperspacehole':
            case 'phantomforce':
            case 'shadowforce':
            case 'feint':
                this.scene.resultAnim(poke, 'Protection broken', 'bad');
                poke.removeTurnstatus('protect');
                for (const curTarget of poke.side.pokemon) {
                    curTarget.removeTurnstatus('wideguard');
                    curTarget.removeTurnstatus('quickguard');
                    curTarget.removeTurnstatus('craftyshield');
                    curTarget.removeTurnstatus('matblock');
                    this.scene.updateStatbar(curTarget);
                }
                break;
            case 'eeriespell':
            case 'gmaxdepletion':
            case 'spite':
                let move = Dex.moves.get(kwArgs.move).name;
                let pp = Number(kwArgs.number);
                if (isNaN(pp)) pp = 4;
                poke.rememberMove(move, pp);
                break;
            case 'gravity':
                poke.removeVolatile('magnetrise');
                poke.removeVolatile('telekinesis');
                this.scene.anim(poke, {time: 100});
                break;
            case 'skillswap': case 'wanderingspirit':
                if (this.gen <= 4) break;
                let pokeability = Dex.sanitizeName(kwArgs.ability) || target.ability;
                let targetability = Dex.sanitizeName(kwArgs.ability2) || poke.ability;
                if (pokeability) {
                    poke.ability = pokeability;
                    if (!target.baseAbility) target.baseAbility = pokeability;
                }
                if (targetability) {
                    target.ability = targetability;
                    if (!poke.baseAbility) poke.baseAbility = targetability;
                }
                if (poke.side !== target.side) {
                    this.activateAbility(poke, pokeability, true);
                    this.activateAbility(target, targetability, true);
                }
                break;

            // ability activations
            case 'electromorphosis':
            case 'windpower':
                poke.addMovestatus('charge');
                break;
            case 'forewarn':
                if (target) {
                    target.rememberMove(kwArgs.move, 0);
                } else {
                    let foeActive = [];
                    for (const maybeTarget of poke.side.foe.active) {
                        if (maybeTarget && !maybeTarget.fainted) foeActive.push(maybeTarget);
                    }
                    if (foeActive.length === 1) {
                        foeActive[0].rememberMove(kwArgs.move, 0);
                    }
                }
                break;
            case 'lingeringaroma':
            case 'mummy':
                if (!kwArgs.ability) break; // if Mummy activated but failed, no ability will have been sent
                let ability = Dex.abilities.get(kwArgs.ability);
                this.activateAbility(target, ability.name);
                this.activateAbility(poke, effect.name);
                this.scene.wait(700);
                this.activateAbility(target, effect.name, true);
                break;

            // item activations
            case 'leppaberry':
            case 'mysteryberry':
                poke.rememberMove(kwArgs.move, effect.id === 'leppaberry' ? -10 : -5);
                break;
            case 'focusband':
                poke.item = 'Focus Band';
                break;
            case 'quickclaw':
                poke.item = 'Quick Claw';
                break;
            case 'abilityshield':
                poke.item = 'Ability Shield';
                break;
            default:
                if (kwArgs.broken) { // for custom moves that break protection
                    this.scene.resultAnim(poke, 'Protection broken', 'bad');
                }
            }
            this.log(args, kwArgs);
            break;
        }
        case '-sidestart': {
            let side = this.getSide(args[1]);
            let effect = Dex.getEffect(args[2]);
            side.addSideCondition(effect, !!kwArgs.persistent);

            switch (effect.id) {
            case 'tailwind':
            case 'auroraveil':
            case 'reflect':
            case 'lightscreen':
            case 'safeguard':
            case 'mist':
            case 'gmaxwildfire':
            case 'gmaxvolcalith':
            case 'gmaxvinelash':
            case 'gmaxcannonade':
            case 'grasspledge':
            case 'firepledge':
            case 'waterpledge':
                this.scene.updateWeather();
                break;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-sideend': {
            let side = this.getSide(args[1]);
            let effect = Dex.getEffect(args[2]);
            // let from = Dex.getEffect(kwArgs.from);
            // let ofpoke = this.getPokemon(kwArgs.of);
            side.removeSideCondition(effect.name);
            this.log(args, kwArgs);
            break;
        }
        case '-swapsideconditions': {
            this.swapSideConditions();
            this.scene.updateWeather();
            this.log(args, kwArgs);
            break;
        }
        case '-weather': {
            let effect = Dex.getEffect(args[1]);
            let poke = this.getPokemon(kwArgs.of) || undefined;
            let ability = Dex.getEffect(kwArgs.from);
            if (!effect.id || effect.id === 'none') {
                kwArgs.from = this.weather;
            }
            this.changeWeather(effect.name, poke, !!kwArgs.upkeep, ability);
            this.log(args, kwArgs);
            break;
        }
        case '-fieldstart': {
            let effect = Dex.getEffect(args[1]);
            let poke = this.getPokemon(kwArgs.of);
            let fromeffect = Dex.getEffect(kwArgs.from);
            this.activateAbility(poke, fromeffect);
            let minTimeLeft = 5;
            let maxTimeLeft = 0;
            if (effect.id.endsWith('terrain')) {
                for (let i = this.pseudoWeather.length - 1; i >= 0; i--) {
                    let pwID = toID(this.pseudoWeather[i][0]);
                    if (pwID.endsWith('terrain')) {
                        this.pseudoWeather.splice(i, 1);
                        continue;
                    }
                }
                if (this.gen > 6) maxTimeLeft = 8;
            }
            if (kwArgs.persistent) minTimeLeft += 2;
            this.addPseudoWeather(effect.name, minTimeLeft, maxTimeLeft);

            switch (effect.id) {
            case 'gravity':
                if (this.seeking !== null) break;
                for (const active of this.getAllActive()) {
                    this.scene.runOtherAnim('gravity', [active]);
                }
                break;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-fieldend': {
            let effect = Dex.getEffect(args[1]);
            // let poke = this.getPokemon(kwArgs.of);
            this.removePseudoWeather(effect.name);
            this.log(args, kwArgs);
            break;
        }
        case '-fieldactivate': {
            let effect = Dex.getEffect(args[1]);
            switch (effect.id) {
            case 'perishsong':
                this.scene.updateStatbars();
                break;
            }
            this.log(args, kwArgs);
            break;
        }
        case '-anim': {
            let poke = this.getPokemon(args[1]);
            let move = Dex.moves.get(args[2]);
            if (this.checkActive(poke)) return;
            let poke2 = this.getPokemon(args[3]);
            this.scene.beforeMove(poke);
            this.animateMove(poke, move, poke2, kwArgs);
            this.scene.afterMove(poke);
            break;
        }
        case '-hint': case '-message': case '-candynamax': {
            this.log(args, kwArgs);
            break;
        }
        default: {
            throw new Error(`Unrecognized minor action: ${args[0]}`);
            break;
        }}
    }
};

(function () {
    setTimeout(() => {
        preloadedSE.forEach(preloadSE);
    }, 30000);
})();