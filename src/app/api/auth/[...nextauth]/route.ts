// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration with Phone OTP
// FIXED v3: Now queries OTP_Codes table (not Consumer_OTP) with correct columns
// Updated: 2026-01-18

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

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

        console.log("[AUTH] Attempting login for phone:", phone, "OTP:", otp);

        try {
          // ============================================================
          // FIXED: Query OTP_Codes table (not Consumer_OTP!)
          // Columns: identifier, code, verified (not phone_number, otp_code)
          // ============================================================
          const otpRecords = await prisma.$queryRaw`
            SELECT * FROM OTP_Codes
            WHERE identifier = ${phone}
            AND code = ${otp}
            AND verified = 1
            AND expires_at > GETDATE()
            ORDER BY created_at DESC
          ` as any[];

          console.log("[AUTH] OTP query result count:", otpRecords?.length || 0);

          if (!otpRecords || otpRecords.length === 0) {
            console.log("[AUTH] No verified OTP found, checking for unverified...");
            
            // Check if there's an unverified OTP we can verify now
            const unverifiedOtp = await prisma.$queryRaw`
              SELECT * FROM OTP_Codes
              WHERE identifier = ${phone}
              AND code = ${otp}
              AND verified = 0
              AND expires_at > GETDATE()
            ` as any[];
            
            if (unverifiedOtp && unverifiedOtp.length > 0) {
              console.log("[AUTH] Found unverified OTP, verifying now...");
              await prisma.$executeRaw`
                UPDATE OTP_Codes
                SET verified = 1, verified_at = GETDATE()
                WHERE identifier = ${phone} AND code = ${otp}
              `;
            } else {
              console.log("[AUTH] No valid OTP found at all");
              throw new Error("Invalid or expired OTP");
            }
          }

          console.log("[AUTH] OTP verified for:", phone);

          // Find or create consumer - use flexible phone matching
          const phoneLastDigits = phone.slice(-9);
          let consumers = await prisma.$queryRaw`
            SELECT 
              consumer_id,
              phone_number,
              full_name,
              first_name,
              last_name,
              subscription_tier,
              account_status
            FROM Consumers 
            WHERE phone_number = ${phone}
               OR phone_number LIKE ${'%' + phoneLastDigits}
          ` as any[];

          console.log("[AUTH] Consumer query result count:", consumers?.length || 0);

          let consumer;

          if (consumers && consumers.length > 0) {
            consumer = consumers[0];
            console.log("[AUTH] Found consumer:", consumer.consumer_id, "Tier:", consumer.subscription_tier, "Name:", consumer.full_name);

            // Update last active
            await prisma.$executeRaw`
              UPDATE Consumers
              SET last_active_at = GETDATE(), updated_at = GETDATE()
              WHERE consumer_id = ${consumer.consumer_id}
            `;
          } else {
            // Create new consumer
            const consumerId = `CON${Date.now()}`;
            const now = new Date().toISOString();

            console.log("[AUTH] Creating new consumer:", consumerId);

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
              SELECT 
                consumer_id,
                phone_number,
                full_name,
                first_name,
                last_name,
                subscription_tier,
                account_status
              FROM Consumers 
              WHERE consumer_id = ${consumerId}
            ` as any[];

            consumer = newConsumers[0];
          }

          // Build display name
          const displayName = consumer.full_name 
            || `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim() 
            || `User ${phone.slice(-4)}`;

          console.log("[AUTH] SUCCESS - Name:", displayName, "Tier:", consumer.subscription_tier);

          // Return user object for session
          return {
            id: consumer.consumer_id,
            phone: consumer.phone_number,
            name: displayName,
            tier: consumer.subscription_tier || "FREE",
            status: consumer.account_status || "ACTIVE",
          };
        } catch (error: any) {
          console.error("[AUTH] Error:", error.message);
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
        console.log("[JWT] Initial sign-in - ID:", token.id, "Tier:", token.tier, "Name:", token.name);
      }

      // Refresh tier from database on each request
      if (token.phone) {
        try {
          const phoneLastDigits = String(token.phone).slice(-9);
          const consumers = await prisma.$queryRaw`
            SELECT 
              consumer_id,
              phone_number,
              full_name,
              first_name,
              last_name,
              subscription_tier,
              account_status
            FROM Consumers 
            WHERE phone_number = ${token.phone}
               OR phone_number LIKE ${'%' + phoneLastDigits}
          ` as any[];

          if (consumers && consumers.length > 0) {
            const consumer = consumers[0];
            
            token.id = consumer.consumer_id;
            token.tier = consumer.subscription_tier || "FREE";
            token.status = consumer.account_status || "ACTIVE";
            
            // Build name from available fields
            const newName = consumer.full_name 
              || `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim();
            
            if (newName) {
              token.name = newName;
            }

            console.log("[JWT] Refreshed - ID:", token.id, "Tier:", token.tier, "Name:", token.name);
          }
        } catch (error) {
          console.error("[JWT] Error refreshing user data:", error);
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
      
      console.log("[SESSION] Name:", session.user?.name, "Tier:", (session.user as any)?.tier);
      
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

  // Handle numbers with + prefix already removed
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return cleaned;
  }

  // Handle Finnish numbers for testing (+358)
  if (cleaned.startsWith("358")) {
    return cleaned;
  }

  // Handle Belgian numbers (+32)
  if (cleaned.startsWith("32")) {
    return cleaned;
  }

  // Handle other international formats - return as-is
  return cleaned;
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
