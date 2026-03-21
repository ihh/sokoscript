// Central preset registry — used by both web and terminal apps

import forestFire from './forest-fire.js';
import sokoban from './sokoban.js';
import ecosystem from './ecosystem.js';
import rockPaperScissors from './rock-paper-scissors.js';
import sandpile from './sandpile.js';
import diffusion from './diffusion.js';
import appleCollector from './apple-collector.js';
import predatorPrey from './predator-prey.js';
import plagueDoctor from './plague-doctor.js';
import keyDoor from './key-door.js';
import treasureMiner from './treasure-miner.js';

const presets = {
  [forestFire.name]: forestFire,
  [sokoban.name]: sokoban,
  [ecosystem.name]: ecosystem,
  [rockPaperScissors.name]: rockPaperScissors,
  [sandpile.name]: sandpile,
  [diffusion.name]: diffusion,
  [appleCollector.name]: appleCollector,
  [predatorPrey.name]: predatorPrey,
  [plagueDoctor.name]: plagueDoctor,
  [keyDoor.name]: keyDoor,
  [treasureMiner.name]: treasureMiner,
};

export default presets;
