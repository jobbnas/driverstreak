import { render } from 'preact';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/animations.css';
import '@/styles/game.css';
import { App } from '@/app';
import { UpdateToast } from '@/ui/UpdateToast';
import { setupPwa } from '@/pwa';
import { applyMotionSetting } from '@/store';

applyMotionSetting();
setupPwa();

render(
  <>
    <App />
    <UpdateToast />
  </>,
  document.getElementById('app')!,
);
