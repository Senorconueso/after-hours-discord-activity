import React from 'react';
import { createRoot } from 'react-dom/client';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import App from './App';
import './index.css';

// Render the game regardless of whether the page is loaded inside Discord.
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Discord injects these parameters only when it launches an Activity.
const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
const params = new URLSearchParams(window.location.search);
const isDiscordActivity =
  params.has('frame_id') &&
  params.has('instance_id') &&
  params.has('platform');

if (isDiscordActivity && clientId) {
  try {
    const sdk = new DiscordSDK(clientId);
    sdk.ready()
      .then(() => console.info('[After Hours] Discord Activity connected'))
      .catch(error => console.error('[After Hours] Discord SDK error:', error));
  } catch (error) {
    console.error('[After Hours] Discord initialization failed:', error);
  }
} else {
  console.info('[After Hours] Running in standalone browser mode');
}
