import './qwapp-navbar-shell';
import { SHELL_CAPABILITY } from '@hallvard/qwapp-api';

window.qwappRegistry.registerCapability(SHELL_CAPABILITY, { tagName: 'qwapp-navbar-shell' });
