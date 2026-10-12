require('dotenv').config();

const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_TOKEN);

async function checkCommands() {
  const commands = await rest.get(
    Routes.applicationCommands(process.env.CLIENT_ID)
  );

  console.log('Registered global commands:');
  console.log(JSON.stringify(commands, null, 2));
}

checkCommands().catch(console.error);

console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('DISCORD_TOKEN loaded:', !!process.env.DISCORD_TOKEN);