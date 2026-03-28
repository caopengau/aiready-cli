import { ChannelType, PermissionsBitField } from 'discord.js';

export interface ChannelConfig {
  name: string;
  type: ChannelType;
  topic?: string;
  parent?: string;
  permissionOverwrites?: Array<{
    id: string;
    allow?: bigint[];
    deny?: bigint[];
  }>;
}

export interface RoleConfig {
  name: string;
  color?: number;
  permissions?: bigint[];
  hoist?: boolean;
  mentionable?: boolean;
}

export interface CategoryConfig {
  name: string;
  channels: ChannelConfig[];
}

export interface ServerConfig {
  name: string;
  roles: RoleConfig[];
  categories: CategoryConfig[];
}

export const SERVER_CONFIG: ServerConfig = {
  name: 'AIReady',
  roles: [
    {
      name: 'Admin',
      color: 0xff0000,
      permissions: [PermissionsBitField.Flags.Administrator],
      hoist: true,
      mentionable: true,
    },
    {
      name: 'Moderator',
      color: 0x00ff00,
      permissions: [
        PermissionsBitField.Flags.ManageMessages,
        PermissionsBitField.Flags.KickMembers,
        PermissionsBitField.Flags.MuteMembers,
        PermissionsBitField.Flags.DeafenMembers,
        PermissionsBitField.Flags.MoveMembers,
      ],
      hoist: true,
      mentionable: true,
    },
    {
      name: 'Contributor',
      color: 0x0099ff,
      permissions: [],
      hoist: true,
      mentionable: true,
    },
    {
      name: 'Ambassador',
      color: 0xff9900,
      permissions: [],
      hoist: true,
      mentionable: true,
    },
    {
      name: 'Member',
      color: 0x99aab5,
      permissions: [],
      hoist: false,
      mentionable: false,
    },
  ],
  categories: [
    {
      name: '📌 INFORMATION',
      channels: [
        {
          name: 'welcome',
          type: ChannelType.GuildText,
          topic: 'Welcome to AIReady! Read the rules and introduce yourself.',
        },
        {
          name: 'rules',
          type: ChannelType.GuildText,
          topic: 'Community guidelines and rules.',
        },
        {
          name: 'announcements',
          type: ChannelType.GuildText,
          topic: 'Product updates, releases, and important news.',
          permissionOverwrites: [
            {
              id: 'everyone',
              deny: [PermissionsBitField.Flags.SendMessages],
            },
          ],
        },
      ],
    },
    {
      name: '💬 COMMUNITY',
      channels: [
        {
          name: 'general',
          type: ChannelType.GuildText,
          topic: 'Open conversation about AI readiness and development.',
        },
        {
          name: 'showcase',
          type: ChannelType.GuildText,
          topic:
            'Share what you built with AIReady. Include screenshots or code.',
        },
        {
          name: 'feedback',
          type: ChannelType.GuildText,
          topic: 'Feature requests, bug reports, and suggestions.',
        },
        {
          name: 'off-topic',
          type: ChannelType.GuildText,
          topic: 'Non-product discussions. Keep it friendly!',
        },
      ],
    },
    {
      name: '🛠️ SUPPORT',
      channels: [
        {
          name: 'help',
          type: ChannelType.GuildText,
          topic: 'Get help with AIReady. Search before asking!',
        },
        {
          name: 'cli-support',
          type: ChannelType.GuildText,
          topic: 'Help with the AIReady CLI tool.',
        },
        {
          name: 'platform-support',
          type: ChannelType.GuildText,
          topic: 'Help with the AIReady Platform.',
        },
        {
          name: 'vscode-support',
          type: ChannelType.GuildText,
          topic: 'Help with the VS Code extension.',
        },
      ],
    },
    {
      name: '🚀 CLAWMORE',
      channels: [
        {
          name: 'clawmore-general',
          type: ChannelType.GuildText,
          topic: 'Discussion about ClawMore managed infrastructure.',
        },
        {
          name: 'clawmore-support',
          type: ChannelType.GuildText,
          topic: 'Get help with ClawMore.',
        },
        {
          name: 'clawmore-showcase',
          type: ChannelType.GuildText,
          topic: 'Share your ClawMore deployments and wins.',
        },
      ],
    },
    {
      name: '🤝 CONTRIBUTING',
      channels: [
        {
          name: 'contributions',
          type: ChannelType.GuildText,
          topic: 'Share your PRs, get feedback, collaborate.',
        },
        {
          name: 'good-first-issues',
          type: ChannelType.GuildText,
          topic: 'Find issues to contribute to.',
        },
        {
          name: 'code-review',
          type: ChannelType.GuildText,
          topic: 'Request and provide code reviews.',
        },
      ],
    },
    {
      name: '🎤 VOICE',
      channels: [
        {
          name: 'office-hours',
          type: ChannelType.GuildVoice,
        },
        {
          name: 'pair-programming',
          type: ChannelType.GuildVoice,
        },
        {
          name: 'hangout',
          type: ChannelType.GuildVoice,
        },
      ],
    },
  ],
};
