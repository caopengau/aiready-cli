/**
 * Discord Server Setup Script
 *
 * Sets up the AIReady Discord server with channels, roles, and permissions.
 *
 * Usage:
 *   pnpm --filter @aiready/discord setup
 *   or
 *   cd discord && pnpm setup
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import { SERVER_CONFIG } from '../config/server-config.js';

async function setupDiscordServer() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const serverId = process.env.DISCORD_SERVER_ID;

  if (!token) {
    console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
    console.log('   Set it in discord/.env or export it');
    process.exit(1);
  }

  if (!serverId) {
    console.error('❌ DISCORD_SERVER_ID environment variable is required');
    console.log('   Set it in discord/.env or export it');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  try {
    console.log('🚀 Connecting to Discord...');
    await client.login(token);

    const guild = await client.guilds.fetch(serverId);
    console.log(`✅ Connected to server: ${guild.name}`);

    // Create roles
    console.log('\n📋 Creating roles...');
    const roleMap: Record<string, string> = {};

    for (const roleConfig of SERVER_CONFIG.roles) {
      try {
        const existingRole = guild.roles.cache.find(
          (r) => r.name === roleConfig.name
        );
        if (existingRole) {
          console.log(`   ⏭️  Role "${roleConfig.name}" already exists`);
          roleMap[roleConfig.name] = existingRole.id;
        } else {
          const role = await guild.roles.create({
            name: roleConfig.name,
            color: roleConfig.color,
            permissions: roleConfig.permissions,
            hoist: roleConfig.hoist,
            mentionable: roleConfig.mentionable,
          });
          console.log(`   ✅ Created role: ${roleConfig.name}`);
          roleMap[roleConfig.name] = role.id;
        }
      } catch (error) {
        console.error(
          `   ❌ Failed to create role "${roleConfig.name}":`,
          error
        );
      }
    }

    // Get @everyone role ID
    const everyoneRoleId = guild.id;

    // Create categories and channels
    console.log('\n📁 Creating categories and channels...');

    for (const categoryConfig of SERVER_CONFIG.categories) {
      try {
        // Check if category exists
        let category = guild.channels.cache.find(
          (c) =>
            c.type === ChannelType.GuildCategory &&
            c.name === categoryConfig.name
        );

        if (!category) {
          category = await guild.channels.create({
            name: categoryConfig.name,
            type: ChannelType.GuildCategory,
          });
          console.log(`   ✅ Created category: ${categoryConfig.name}`);
        } else {
          console.log(
            `   ⏭️  Category "${categoryConfig.name}" already exists`
          );
        }

        // Create channels in category
        for (const channelConfig of categoryConfig.channels) {
          try {
            const existingChannel = guild.channels.cache.find(
              (c) =>
                c.name === channelConfig.name && c.parentId === category?.id
            );

            if (existingChannel) {
              console.log(
                `      ⏭️  Channel "${channelConfig.name}" already exists`
              );
              continue;
            }

            const permissionOverwrites =
              channelConfig.permissionOverwrites?.map((perm) => ({
                id:
                  perm.id === 'everyone'
                    ? everyoneRoleId
                    : roleMap[perm.id] || perm.id,
                allow: perm.allow || [],
                deny: perm.deny || [],
              })) || [];

            const channelOptions: any = {
              name: channelConfig.name,
              type: channelConfig.type,
              parent: category?.id,
              permissionOverwrites,
            };

            // Only add topic for text channels (voice channels don't have topics)
            if (
              channelConfig.type === ChannelType.GuildText &&
              channelConfig.topic
            ) {
              channelOptions.topic = channelConfig.topic;
            }

            const channel = await guild.channels.create(channelOptions);
            console.log(`      ✅ Created channel: ${channelConfig.name}`);
          } catch (error) {
            console.error(
              `      ❌ Failed to create channel "${channelConfig.name}":`,
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `   ❌ Failed to create category "${categoryConfig.name}":`,
          error
        );
      }
    }

    // Set up server settings
    console.log('\n⚙️  Configuring server settings...');
    try {
      await guild.setVerificationLevel(1);
      console.log('   ✅ Set verification level to Low');
    } catch (error) {
      console.error('   ❌ Failed to set verification level:', error);
    }

    // Post welcome message
    console.log('\n📝 Posting welcome message...');
    try {
      const welcomeChannel = guild.channels.cache.find(
        (c) => c.name === 'welcome' && c.type === ChannelType.GuildText
      );

      if (welcomeChannel && 'send' in welcomeChannel) {
        await welcomeChannel.send({
          embeds: [
            {
              title: '👋 Welcome to AIReady!',
              description:
                'We help developers make their codebases AI-ready. Scan your code, fix issues, and track improvements.',
              color: 0x0099ff,
              fields: [
                {
                  name: '🚀 Getting Started',
                  value:
                    '1. Run `npx @aiready/cli scan .` to analyze your code\n2. Check your AI readiness score\n3. Fix issues and improve',
                },
                {
                  name: '📚 Resources',
                  value:
                    '• [Website](https://getaiready.dev)\n• [GitHub](https://github.com/caopengau/aiready)\n• [Documentation](https://getaiready.dev/docs)',
                },
                {
                  name: '💬 Need Help?',
                  value:
                    "Post in #help or one of the support channels. We're here to help!",
                },
              ],
              footer: {
                text: 'AIReady - Making codebases AI-ready',
              },
              timestamp: new Date().toISOString(),
            },
          ],
        });
        console.log('   ✅ Posted welcome message');
      }
    } catch (error) {
      console.error('   ❌ Failed to post welcome message:', error);
    }

    console.log('\n✅ Discord server setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Assign Admin role to yourself');
    console.log('   2. Invite community members');
    console.log('   3. Pin rules in #rules channel');
    console.log('   4. Schedule first office hours');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

// Run the setup
setupDiscordServer();
