// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration with Phone OTP
// Updated: Refreshes tier from database on each session

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma"; // Use singleton

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Phone number and OTP are required");
        }

        const phone = normalizePhone(credentials.phone);
        const otp = credentials.otp;

        try {
          // Verify OTP
          const otpRecords = await prisma.$queryRaw`
            SELECT * FROM Consumer_OTP
            WHERE phone_number = ${phone}
            AND otp_code = ${otp}
            AND verified = 0
            AND expires_at > GETDATE()
            ORDER BY created_at DESC
          ` as any[];

          if (!otpRecords || otpRecords.length === 0) {
            throw new Error("Invalid or expired OTP");
          }

          // Mark OTP as verified
          await prisma.$executeRaw`
            UPDATE Consumer_OTP
            SET verified = 1
            WHERE phone_number = ${phone} AND otp_code = ${otp}
          `;

          // Find or create consumer
          let consumers = await prisma.$queryRaw`
            SELECT * FROM Consumers WHERE phone_number = ${phone}
          ` as any[];

          let consumer;

          if (consumers && consumers.length > 0) {
            consumer = consumers[0];

            // Update last active
            await prisma.$executeRaw`
              UPDATE Consumers
              SET last_active_at = GETDATE(), updated_at = GETDATE()
              WHERE phone_number = ${phone}
            `;
          } else {
            // Create new consumer
            const consumerId = `CON${Date.now()}`;
            const now = new Date().toISOString();

            await prisma.$executeRaw`
              INSERT INTO Consumers (
                consumer_id, phone_number, subscription_tier,
                account_status, registration_date, created_at, updated_at
              ) VALUES (
                ${consumerId}, ${phone}, 'FREE',
                'ACTIVE', ${now}, ${now}, ${now}
              )
            `;

            // Fetch the new consumer
            const newConsumers = await prisma.$queryRaw`
              SELECT * FROM Consumers WHERE consumer_id = ${consumerId}
            ` as any[];

            consumer = newConsumers[0];
          }

          // Return user object for session
          return {
            id: consumer.consumer_id,
            phone: consumer.phone_number,
            name: consumer.consumer_name || consumer.full_name || `User ${phone.slice(-4)}`,
            tier: consumer.subscription_tier || "FREE",
            status: consumer.account_status || "ACTIVE",
          };
        } catch (error: any) {
          console.error("Auth error:", error);
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign in, store user data in token
      if (user) {
        token.id = user.id;
        token.phone = (user as any).phone;
        token.tier = (user as any).tier;
        token.status = (user as any).status;
        token.name = user.name;
      }

      // Refresh tier from database every time (or you can add a timestamp check)
      // This ensures tier changes are reflected immediately
      if (token.phone) {
        try {
          const consumers = await prisma.$queryRaw`
            SELECT consumer_id, consumer_name, full_name, subscription_tier, account_status
            FROM Consumers 
            WHERE phone_number = ${token.phone}
          ` as any[];

          if (consumers && consumers.length > 0) {
            const consumer = consumers[0];
            token.id = consumer.consumer_id;
            token.tier = consumer.subscription_tier || "FREE";
            token.status = consumer.account_status || "ACTIVE";
            token.name = consumer.consumer_name || consumer.full_name || token.name;
          }
        } catch (error) {
          console.error("Error refreshing user data:", error);
          // Keep existing token data if refresh fails
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).phone = token.phone;
        (session.user as any).tier = token.tier;
        (session.user as any).status = token.status;
        session.user.name = token.name as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  debug: process.env.NODE_ENV === "development",
};

// Helper function to normalize phone numbers
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");

  // Convert 080... to 234... (Nigerian format)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "234" + cleaned.substring(1);
  }

  // Handle numbers with + prefix
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return cleaned;
  }

  // Handle Finnish numbers for testing (+358)
  if (cleaned.startsWith("358")) {
    return cleaned;
  }

  // Handle other international formats - return as-is
  return cleaned;
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
