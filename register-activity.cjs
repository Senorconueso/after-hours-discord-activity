// One-time Discord Activity Entry Point registration.
// Run: node --env-file=.env register-activity.cjs  (Node.js 22+)
// Never use a VITE_ prefixed variable to store a bot token.
const token = process.env.DISCORD_TOKEN;
const applicationId = process.env.VITE_DISCORD_CLIENT_ID;
if (!token || !applicationId || applicationId === 'YOUR_APPLICATION_ID_HERE') {
  console.error('Missing DISCORD_TOKEN or VITE_DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const base = `https://discord.com/api/v10/applications/${applicationId}/commands`;
async function discord(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : {}; }
  catch { result = { message: raw.slice(0, 400) }; }
  if (!response.ok) {
    throw new Error(`Discord API ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}

(async () => {
  const commands = await discord('');
  const prior = commands.find(cmd => cmd.type === 4); // PRIMARY_ENTRY_POINT
  const entry = {
    name: prior?.name ?? 'launch',
    description: 'Launch After Hours, the interactive party game',
    type: 4, // PRIMARY_ENTRY_POINT
    handler: 2, // DISCORD_LAUNCH_ACTIVITY
    nsfw: true, // adult party game; requires appropriate Discord age restrictions
    integration_types: [0], // guild install
    contexts: [0], // guild channels
  };
  if (prior) {
    if (prior.handler === 2 && prior.nsfw === true) {
      console.log(`Activity launcher already registered: ${prior.name}`);
      return;
    }
    const updated = await discord(`/${prior.id}`, 'PATCH', entry);
    console.log(`Updated Activity Entry Point: ${updated.name}`);
  } else {
    const created = await discord('', 'POST', entry);
    console.log(`Registered Activity Entry Point: ${created.name}`);
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
