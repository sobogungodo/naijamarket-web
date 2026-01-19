// src/app/api/auth/[...nextauth]/route.ts
// NaijaMarket Intel - NextAuth Configuration with Phone OTP
// FIXED v4: Added countryCode to credentials, matching phone format with send-otp
// Updated: 2026-01-19

import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

// ============================================================================
// PHONE FORMATTING - MUST MATCH send-otp/route.ts EXACTLY!
// ============================================================================
function formatPhoneNumber(phone: string, countryCode?: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  // If phone already starts with +, just remove the + and return
  if (cleaned.startsWith("+")) {
    return cleaned.substring(1);
  }
  
  // If country code is provided separately (from UI dropdown)
  if (countryCode) {
    // Remove + from country code if present
    const cleanCountryCode = countryCode.replace("+", "");
    
    // If phone starts with 0, remove it (local format)
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    
    // If phone already starts with country code, don't duplicate
    if (cleaned.startsWith(cleanCountryCode)) {
      return cleaned;
    }
    
    return cleanCountryCode + cleaned;
  }
  
  // If no country code and starts with 0, assume Nigerian
  if (cleaned.startsWith("0")) {
    return "234" + cleaned.substring(1);
  }
  
  // Return as-is (already has country code without +)
  return cleaned;
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "phone-otp",
      name: "Phone OTP",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        countryCode: { label: "Country Code", type: "text" },  // ✅ ADDED!
        otp: { label: "OTP Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          throw new Error("Phone number and OTP are required");
        }

        // ✅ FIXED: Use same formatting function as send-otp
        const phone = formatPhoneNumber(credentials.phone, credentials.countryCode);
        const otp = credentials.otp;

        console.log("[AUTH] Attempting login for phone:", phone, "OTP:", otp);
        console.log("[AUTH] Country code received:", credentials.countryCode);

        try {
          // ============================================================
          // Check for verified OTP in OTP_Codes table
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
              console.log("[AUTH] No valid OTP found at all for identifier:", phone);
              
              // Debug: Show what identifiers exist
              const debugOtps = await prisma.$queryRaw`
                SELECT TOP 5 identifier, code, verified, expires_at 
                FROM OTP_Codes 
                WHERE type = 'phone'
                ORDER BY created_at DESC
              ` as any[];
              console.log("[AUTH] Recent OTPs in DB:", debugOtps);
              
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
