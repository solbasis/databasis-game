import { Game } from './game.js';
import { UI   } from './ui.js';

const canvas = document.getElementById('game-canvas');
const ui     = new UI();
const game   = new Game(canvas, ui);

// Bind all UI → game interactions
ui.bindShopClicks(game);

// Initial UI state (menu visible, game not started)
ui.update(game);
