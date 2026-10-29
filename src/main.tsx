import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initApp } from './lib/app';
import { loadSession } from './lib/flow';
import { registerPwa } from './pwa';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<div style={{ padding: 24, fontFamily: 'system-ui' }}>Loading…</div>);

initApp()
  .then(loadSession)
  .then(() => root.render(<App />))
  .catch((e: unknown) => {
    console.error(e);
    root.render(
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Could not start</h1>
        <p>{String(e instanceof Error ? e.message : e)}</p>
        <p>If you are offline and opening the app for the first time, connect once so it can be installed.</p>
      </div>,
    );
  });

registerPwa();
