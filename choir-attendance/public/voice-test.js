// The hidden test version of the singing game: the same screens as the real game, with every level open
// and progress kept on this phone only (nothing is sent to the server).
import { mountGame } from './game.js';

mountGame(document.querySelector('#gameRoot'), { preview: true });
