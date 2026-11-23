import { APP_STATE_STORE_CAPABILITY, SHELL_CAPABILITY } from './registry';

const registry = window.qwappRegistry;
const app = document.querySelector<HTMLDivElement>('#app')!;

// The shell is contributed by a module (whichever shell module is on the
// classpath), so it registers itself some time after this script has run.
let mounted = false;
function mountShell() {
  const shell = registry.getCapability(SHELL_CAPABILITY);
  if (shell && !mounted) {
    mounted = true;
    app.append(document.createElement(shell.tagName));
  }
}
registry.addEventListener('change', mountShell);
mountShell();

// Common to all shells: apply the theme setting.
const appStateStore = registry.getCapability(APP_STATE_STORE_CAPABILITY);
appStateStore?.subscribeSlice(
  (state) => state.settings.theme,
  (theme) => {
    if (theme) {
      document.documentElement.dataset.theme = theme;
    }
  },
  { fireImmediately: true }
);
