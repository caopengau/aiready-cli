/**
 * Post Initial Content to Discord
 *
 * Posts rules and welcome messages to the Discord server.
 *
 * Usage:
 *   cd discord && npx tsx src/post-initial-content.ts
 */

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;
const serverId = process.env.DISCORD_SERVER_ID;

if (!token || !serverId) {
  console.error('❌ DISCORD_BOT_TOKEN and DISCORD_SERVER_ID are required');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function postContent() {
  try {
    console.log('🚀 Connecting to Discord...');
    await client.login(token);

    const guild = await client.guilds.fetch(serverId);
    console.log(`✅ Connected to server: ${guild.name}`);

    // Fetch all channels
    await guild.channels.fetch();
    console.log(`   Found ${guild.channels.cache.size} channels`);

    // Post rules
    console.log('\n📋 Posting rules...');
    const rulesChannel = guild.channels.cache.find(
      (c) => c?.name === 'rules' && c.type === ChannelType.GuildText
    );

    if (rulesChannel && 'send' in rulesChannel) {
      const rulesEmbed = new EmbedBuilder()
        .setTitle('📋 Community Guidelines')
        .setDescription(
          'Please read and follow these rules to keep our community healthy and productive.'
        )
        .setColor(Colors.Blue)
        .addFields(
          {
            name: '1. Be Respectful',
            value:
              'Treat everyone with dignity. No harassment, discrimination, or personal attacks.',
          },
          {
            name: '2. Stay On Topic',
            value:
              'Use appropriate channels for different discussions. Keep conversations relevant.',
          },
          {
            name: '3. No Spam',
            value:
              "Don't post the same message multiple times. No excessive self-promotion.",
          },
          {
            name: '4. Help Others',
            value:
              'If you know the answer, help others. We learn together as a community.',
          },
          {
            name: '5. Share Knowledge',
            value:
              "Share your wins, tutorials, and insights. We celebrate each other's successes.",
          },
          {
            name: '6. English Only',
            value:
              "For now, we're an English-speaking community to ensure everyone can participate.",
          },
          {
            name: '7. No Secrets',
            value:
              "Don't share API keys, passwords, or sensitive information in public channels.",
          },
          {
            name: '8. Have Fun',
            value: "We're here to learn and build together. Enjoy the journey!",
          }
        )
        .setFooter({
          text: 'Violations may result in warnings, mutes, or bans.',
        })
        .setTimestamp();

      await rulesChannel.send({ embeds: [rulesEmbed] });
      console.log('   ✅ Rules posted');
    } else {
      console.log('   ⚠️  Rules channel not found');
    }

    // Post welcome message
    console.log('\n👋 Posting welcome message...');
    const welcomeChannel = guild.channels.cache.find(
      (c) => c?.name === 'welcome' && c.type === ChannelType.GuildText
    );

    if (welcomeChannel && 'send' in welcomeChannel) {
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('👋 Welcome to AIReady!')
        .setDescription(
          'We help developers make their codebases AI-ready. Scan your code, fix issues, and track improvements.'
        )
        .setColor(Colors.Blue)
        .addFields(
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
          {
            name: '🤝 Contributing',
            value:
              'Want to contribute? Check out #contributions and #good-first-issues',
          }
        )
        .setFooter({ text: 'AIReady - Making codebases AI-ready' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Website')
          .setStyle(ButtonStyle.Link)
          .setURL('https://getaiready.dev'),
        new ButtonBuilder()
          .setLabel('GitHub')
          .setStyle(ButtonStyle.Link)
          .setURL('https://github.com/caopengau/aiready'),
        new ButtonBuilder()
          .setLabel('Documentation')
          .setStyle(ButtonStyle.Link)
          .setURL('https://getaiready.dev/docs')
      );

      await welcomeChannel.send({
        embeds: [welcomeEmbed],
        components: [row],
      });
      console.log('   ✅ Welcome message posted');
    } else {
      console.log('   ⚠️  Welcome channel not found');
    }

    // Post first announcement
    console.log('\n📢 Posting launch announcement...');
    const announcementsChannel = guild.channels.cache.find(
      (c) => c?.name === 'announcements' && c.type === ChannelType.GuildText
    );

    if (announcementsChannel && 'send' in announcementsChannel) {
      const announcementEmbed = new EmbedBuilder()
        .setTitle('🚀 AIReady Community Launch!')
        .setDescription(
          "We're excited to launch the AIReady community! Join us in building the future of AI-ready codebases."
        )
        .setColor(Colors.Gold)
        .addFields(
          {
            name: 'What is AIReady?',
            value:
              'AIReady helps developers make their codebases AI-ready. We analyze your code and show you exactly where AI tools struggle - and how to fix it.',
          },
          {
            name: 'What can you do here?',
            value:
              '• Get help with AIReady tools\n• Share your wins and improvements\n• Contribute to the project\n• Learn about AI code quality',
          },
          {
            name: 'Quick Start',
            value:
              '```bash\nnpx @aiready/cli scan .\n```\nRun this command to analyze your codebase!',
          }
        )
        .setFooter({ text: 'AIReady - Making codebases AI-ready' })
        .setTimestamp();

      await announcementsChannel.send({
        content: '@everyone',
        embeds: [announcementEmbed],
      });
      console.log('   ✅ Launch announcement posted');
    } else {
      console.log('   ⚠️  Announcements channel not found');
    }

    console.log('\n✅ All initial content posted!');
    console.log('\n📝 Next steps:');
    console.log('   1. Assign Admin role to yourself');
    console.log('   2. Invite community members');
    console.log('   3. Start engaging in channels');
  } catch (error) {
    console.error('❌ Failed to post content:', error);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

postContent();
