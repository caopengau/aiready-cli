import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Events,
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
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Welcome new members
client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`👋 New member joined: ${member.user.tag}`);

  try {
    // Assign Member role
    const memberRole = member.guild.roles.cache.find(
      (r) => r.name === 'Member'
    );
    if (memberRole) {
      await member.roles.add(memberRole);
      console.log(`   ✅ Assigned Member role to ${member.user.tag}`);
    }

    // Send welcome DM
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('👋 Welcome to AIReady!')
      .setDescription(
        'Thanks for joining our community! We help developers make their codebases AI-ready.'
      )
      .setColor(Colors.Blue)
      .addFields(
        {
          name: '🚀 Getting Started',
          value:
            '1. Introduce yourself in #welcome\n2. Check out #general for discussions\n3. Run `npx @aiready/cli scan .` on your codebase',
        },
        {
          name: '📚 Resources',
          value:
            '• [Website](https://getaiready.dev)\n• [GitHub](https://github.com/caopengau/aiready)\n• [Documentation](https://getaiready.dev/docs)',
        },
        {
          name: '💬 Need Help?',
          value: 'Post in #help or one of the support channels!',
        }
      )
      .setFooter({ text: 'AIReady - Making codebases AI-ready' })
      .setTimestamp();

    await member.send({ embeds: [welcomeEmbed] });
    console.log(`   ✅ Sent welcome DM to ${member.user.tag}`);
  } catch (error) {
    console.error(`   ❌ Failed to process new member:`, error);
  }
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'ping') {
    await interaction.reply('🏓 Pong!');
  }

  if (commandName === 'setup-rules') {
    await setupRules(interaction);
  }

  if (commandName === 'setup-welcome') {
    await setupWelcome(interaction);
  }

  if (commandName === 'announce') {
    await postAnnouncement(interaction);
  }
});

async function setupRules(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('❌ This command must be used in a server.');
      return;
    }

    const rulesChannel = guild.channels.cache.find(
      (c: any) => c.name === 'rules' && c.type === ChannelType.GuildText
    );

    if (!rulesChannel || !('send' in rulesChannel)) {
      await interaction.editReply('❌ Rules channel not found.');
      return;
    }

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
      .setFooter({ text: 'Violations may result in warnings, mutes, or bans.' })
      .setTimestamp();

    await rulesChannel.send({ embeds: [rulesEmbed] });
    await interaction.editReply('✅ Rules posted in #rules channel.');
  } catch (error) {
    console.error('Failed to setup rules:', error);
    await interaction.editReply('❌ Failed to setup rules.');
  }
}

async function setupWelcome(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('❌ This command must be used in a server.');
      return;
    }

    const welcomeChannel = guild.channels.cache.find(
      (c: any) => c.name === 'welcome' && c.type === ChannelType.GuildText
    );

    if (!welcomeChannel || !('send' in welcomeChannel)) {
      await interaction.editReply('❌ Welcome channel not found.');
      return;
    }

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
    await interaction.editReply(
      '✅ Welcome message posted in #welcome channel.'
    );
  } catch (error) {
    console.error('Failed to setup welcome:', error);
    await interaction.editReply('❌ Failed to setup welcome message.');
  }
}

async function postAnnouncement(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply('❌ This command must be used in a server.');
      return;
    }

    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');

    if (!title || !message) {
      await interaction.editReply('❌ Title and message are required.');
      return;
    }

    const announcementsChannel = guild.channels.cache.find(
      (c: any) => c.name === 'announcements' && c.type === ChannelType.GuildText
    );

    if (!announcementsChannel || !('send' in announcementsChannel)) {
      await interaction.editReply('❌ Announcements channel not found.');
      return;
    }

    const announcementEmbed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(Colors.Gold)
      .setFooter({ text: 'AIReady Announcements' })
      .setTimestamp();

    await announcementsChannel.send({
      content: '@everyone',
      embeds: [announcementEmbed],
    });
    await interaction.editReply('✅ Announcement posted.');
  } catch (error) {
    console.error('Failed to post announcement:', error);
    await interaction.editReply('❌ Failed to post announcement.');
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
