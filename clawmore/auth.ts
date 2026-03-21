import NextAuth from 'next-auth';
import Credentials from '@auth/core/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { DynamoDBAdapter } from '@auth/dynamodb-adapter';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const dbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-2',
});

const documentClient = DynamoDBDocument.from(dbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DynamoDBAdapter(documentClient, {
    tableName: process.env.DYNAMO_TABLE,
    partitionKey: 'PK',
    sortKey: 'SK',
  }),
  providers: [
    {
      id: 'email',
      type: 'email',
      name: 'Email',
      options: {},
      from: process.env.SES_FROM_EMAIL || 'noreply@dev.getaiready.dev',
      maxAge: 24 * 60 * 60,
      async sendVerificationRequest({
        identifier: to,
        url,
        provider,
      }: {
        identifier: string;
        url: string;
        provider: any;
      }) {
        const sesClient = new SESClient({
          region: process.env.AWS_REGION || 'ap-southeast-2',
        });
        const command = new SendEmailCommand({
          Destination: { ToAddresses: [to] },
          Source: provider.from as string,
          Message: {
            Subject: { Data: 'Sign in to ClawMore', Charset: 'UTF-8' },
            Body: {
              Text: {
                Data: `Sign in to ClawMore by clicking here: ${url}`,
                Charset: 'UTF-8',
              },
              Html: {
                Data: `
                  <body style="font-family: sans-serif; padding: 20px;">
                    <h2>Sign in to ClawMore</h2>
                    <p>Click the button below to sign in to your account.</p>
                    <a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Sign In</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
                  </body>
                `,
                Charset: 'UTF-8',
              },
            },
          },
        });
        await sesClient.send(command);
      },
    } as any,
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: 'read:user user:email repo workflow',
        },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'Admin Access',
      credentials: {
        password: { label: 'Admin Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'ADMIN_PASSWORD environment variable is required in production'
            );
          }
          // Default for dev only if not production
          return null;
        }

        const isCorrectPassword = credentials?.password === adminPassword;

        // Use the first email from ADMIN_EMAILS or a default for local dev
        const adminEmails = process.env.ADMIN_EMAILS
          ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
          : ['admin@example.com'];
        const primaryAdminEmail = adminEmails[0];

        if (isCorrectPassword) {
          return {
            id: 'admin-001',
            name: 'ClawMore Admin',
            email: primaryAdminEmail,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.accessToken = token.accessToken;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      const adminEmails = process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim())
        : ['caopengau@gmail.com', 'admin@example.com']; // Fallbacks for existing flow

      const userEmail = auth?.user?.email || '';
      const isAdminEmail = adminEmails.includes(userEmail);

      const isOnAdmin = nextUrl.pathname.startsWith('/admin');
      const isOnAdminLogin = nextUrl.pathname === '/admin/login';

      if (isOnAdmin && !isOnAdminLogin) {
        // Must be logged in AND have an admin email
        if (isLoggedIn && isAdminEmail) return true;
        return false;
      }
      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
});
