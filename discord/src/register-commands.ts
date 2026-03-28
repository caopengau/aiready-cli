/**
 * Register Discord Slash Commands
 *
 * Run this script to register commands with Discord.
 * Commands are registered globally (takes ~1 hour to propagate)
 * or to a specific guild (instant).
 *
 * Usage:
 *   cd discord && npx tsx src/register-commands.ts
 */

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;
const serverId = process.env.DISCORD_SERVER_ID;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

if (!applicationId) {
  console.error('❌ DISCORD_APPLICATION_ID is required');
  console.log('   Get it from: https://discord.com/developers/applications');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if the bot is alive'),

  new SlashCommandBuilder()
    .setName('setup-rules')
    .setDescription('Post the community rules in #rules channel'),

  new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Post the welcome message in #welcome channel'),

  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Post an announcement')
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Announcement title')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Announcement message')
        .setRequired(true)
    ),
];

const rest = new REST({ version: '10' }).setToken(token);

async function registerCommands() {
  try {
    console.log('🔄 Registering slash commands...');

    if (serverId) {
      // Register to specific guild (instant)
      console.log(`   Registering to guild: ${serverId}`);
      await rest.put(
        Routes.applicationGuildCommands(applicationId!, serverId),
        {
          body: commands,
        }
      );
    } else {
      // Register globally (takes ~1 hour)
      console.log('   Registering globally (takes ~1 hour to propagate)');
      await rest.put(Routes.applicationCommands(applicationId!), {
        body: commands,
      });
    }

    console.log('✅ Commands registered successfully!');
    console.log('\nCommands:');
    commands.forEach((cmd) => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  }
}

registerCommands();
