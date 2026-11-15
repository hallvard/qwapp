import './qwapp-dock-shell';
import { SHELL_CAPABILITY } from 'qwapp-frontend-api';
import { MENU_CONTRIBUTIONS_CAPABILITY } from './menu';
import { viewMenu } from './view-menu';

window.qwappRegistry.registerCapability(SHELL_CAPABILITY, { tagName: 'qwapp-dock-shell' });
window.qwappRegistry.registerCapability(MENU_CONTRIBUTIONS_CAPABILITY, viewMenu);
