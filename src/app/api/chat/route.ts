// src/app/api/chat/route.ts
// NaijaMarket Intel - AI Chatbot API
// Powered by Claude Sonnet with real-time price data access
// Updated: 2026-02-04

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// CONFIGURATION
// ============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Query limits by tier
const CHAT_LIMITS: Record<string, number> = {
  FREE: 5,
  SILVER: 10,
  GOLD: 50,
  BUSINESS: 100,
  CORPORATE: 500,
  ENTERPRISE: -1, // Unlimited
  OGA_BOSS: -1,
  GOVERNMENT: -1,
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the NaijaMarket Intel AI Assistant - a helpful, knowledgeable guide for Nigerian commodity prices and market intelligence.

## Your Personality
- Friendly and professional
- Understand Nigerian context (markets, Pidgin English, local terms)
- Concise but thorough
- Always helpful and solution-oriented

## Your Capabilities
1. **Price Queries**: Look up current commodity prices from any Nigerian market
2. **Market Comparisons**: Find the cheapest/most expensive markets for items
3. **Price Alerts**: Help users set up price alerts
4. **Trends**: Explain price movements and market dynamics
5. **FAQs**: Answer questions about NaijaMarket Intel platform

## Nigerian Markets You Know
- Mile 12 Market (Lagos) - Food items
- Onitsha Main Market (Anambra) - General goods
- Iddo Market (Lagos) - Building materials
- Ariaria Market (Abia) - Manufacturing materials
- Alaba International (Lagos) - Electronics
- Wuse Market (Abuja) - Food & General
- Sabon Gari Market (Kano) - Food & Textiles

## Response Guidelines
- Keep responses concise (2-4 sentences for simple queries)
- Use Nigerian Naira (₦) for all prices
- Format prices with commas (e.g., ₦45,000.00)
- If you don't have data, say so honestly
- Understand Pidgin English (e.g., "wetin be price" = "what is the price")
- Suggest related actions when helpful

## Example Interactions
User: "What's the price of rice in Mile 12?"
You: Check the database and respond with current price, brand options, and last update time.

User: "Wetin be cheapest market for cement?"
You: Compare prices across markets and recommend the best option.

User: "I wan set alert for tomato"
You: Guide them to set up a price alert with target price.

## Important
- Always use the provided tools to get real data
- Never make up prices - if no data, say "I don't have current price data for that item"
- Be honest about limitations
- Suggest upgrading tier if user hits limits`;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const tools: Anthropic.Tool[] = [
  {
    name: "get_price",
    description: "Get the current price of a commodity in a specific market. Use this when user asks about prices.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_name: {
          type: "string",
          description: "Name of the commodity (e.g., 'Rice', 'Tomatoes', 'Cement')"
        },
        market_name: {
          type: "string",
          description: "Name of the market (e.g., 'Mile 12 Market', 'Iddo Market'). Optional - if not provided, returns prices from all markets."
        }
      },
      required: ["item_name"]
    }
  },
  {
    name: "compare_markets",
    description: "Compare prices of an item across different markets to find the cheapest option.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_name: {
          type: "string",
          description: "Name of the commodity to compare"
        }
      },
      required: ["item_name"]
    }
  },
  {
    name: "list_items",
    description: "List available commodities/items in the database. Use when user asks what items are available.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Optional category filter (e.g., 'Staple Foods & Grains', 'Building Materials')"
        }
      },
      required: []
    }
  },
  {
    name: "list_markets",
    description: "List available markets in the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string",
          description: "Optional state filter (e.g., 'Lagos', 'Kano')"
        }
      },
      required: []
    }
  },
  {
    name: "create_alert_link",
    description: "Generate a link for the user to create a price alert.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_name: {
          type: "string",
          description: "Name of the commodity"
        },
        market_name: {
          type: "string",
          description: "Name of the market"
        },
        alert_type: {
          type: "string",
          enum: ["ABOVE", "BELOW"],
          description: "Alert when price goes above or below target"
        }
      },
      required: ["item_name"]
    }
  }
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

// Neutralize SQL string-literal breakout for values interpolated into the
// LIKE '%...%' patterns below. Mirrors the esc() used by the mobile compare/
// prices routes (double single-quotes traps the value inside the literal);
// length-cap bounds pathological inputs. Values here originate from LLM tool
// arguments derived from user chat text, so they are untrusted.
function esc(v: unknown): string {
  return String(v ?? "").slice(0, 100).replace(/'/g, "''");
}

async function handleToolCall(toolName: string, toolInput: any): Promise<string> {
  try {
    switch (toolName) {
      case "get_price": {
        const { item_name, market_name } = toolInput;
        
        let query = `
          SELECT TOP 5
            item_name,
            brand_name,
            market_name,
            state,
            price,
            unit,
            validated_at
          FROM Approved_Prices
          WHERE validation_status = 'APPROVED'
            AND item_name LIKE '%${esc(item_name)}%'
        `;
        
        if (market_name) {
          query += ` AND market_name LIKE '%${esc(market_name)}%'`;
        }
        
        query += ` ORDER BY validated_at DESC`;
        
        const results = await prisma.$queryRawUnsafe(query) as any[];
        
        if (results.length === 0) {
          return JSON.stringify({ 
            found: false, 
            message: `No price data found for "${item_name}"${market_name ? ` in ${market_name}` : ''}` 
          });
        }
        
        return JSON.stringify({
          found: true,
          count: results.length,
          prices: results.map(r => ({
            item: r.item_name,
            brand: r.brand_name,
            market: r.market_name,
            state: r.state,
            price: parseFloat(r.price),
            unit: r.unit,
            updated: r.validated_at
          }))
        });
      }
      
      case "compare_markets": {
        const { item_name } = toolInput;
        
        const results = await prisma.$queryRawUnsafe(`
          SELECT 
            item_name,
            market_name,
            state,
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price) as avg_price,
            COUNT(*) as submissions,
            MAX(validated_at) as last_updated
          FROM Approved_Prices
          WHERE validation_status = 'APPROVED'
            AND item_name LIKE '%${esc(item_name)}%'
          GROUP BY item_name, market_name, state
          ORDER BY min_price ASC
        `) as any[];
        
        if (results.length === 0) {
          return JSON.stringify({ 
            found: false, 
            message: `No price data found for "${item_name}" to compare` 
          });
        }
        
        return JSON.stringify({
          found: true,
          item: item_name,
          markets: results.map(r => ({
            market: r.market_name,
            state: r.state,
            min_price: parseFloat(r.min_price),
            max_price: parseFloat(r.max_price),
            avg_price: parseFloat(r.avg_price),
            submissions: r.submissions,
            last_updated: r.last_updated
          })),
          cheapest: {
            market: results[0].market_name,
            price: parseFloat(results[0].min_price)
          },
          most_expensive: {
            market: results[results.length - 1].market_name,
            price: parseFloat(results[results.length - 1].max_price)
          }
        });
      }
      
      case "list_items": {
        const { category } = toolInput;
        
        let query = `
          SELECT DISTINCT item_name, category_name
          FROM Approved_Prices
          WHERE validation_status = 'APPROVED'
        `;
        
        if (category) {
          query += ` AND category_name LIKE '%${esc(category)}%'`;
        }
        
        query += ` ORDER BY category_name, item_name`;
        
        const results = await prisma.$queryRawUnsafe(query) as any[];
        
        // Group by category
        const grouped: Record<string, string[]> = {};
        results.forEach((r: any) => {
          const cat = r.category_name || 'Other';
          if (!grouped[cat]) grouped[cat] = [];
          if (!grouped[cat].includes(r.item_name)) {
            grouped[cat].push(r.item_name);
          }
        });
        
        return JSON.stringify({
          total: results.length,
          categories: grouped
        });
      }
      
      case "list_markets": {
        const { state } = toolInput;
        
        let query = `
          SELECT DISTINCT market_name, state
          FROM Approved_Prices
          WHERE validation_status = 'APPROVED'
        `;
        
        if (state) {
          query += ` AND state LIKE '%${esc(state)}%'`;
        }
        
        query += ` ORDER BY state, market_name`;
        
        const results = await prisma.$queryRawUnsafe(query) as any[];
        
        // Group by state
        const grouped: Record<string, string[]> = {};
        results.forEach((r: any) => {
          const st = r.state || 'Unknown';
          if (!grouped[st]) grouped[st] = [];
          if (!grouped[st].includes(r.market_name)) {
            grouped[st].push(r.market_name);
          }
        });
        
        return JSON.stringify({
          total: results.length,
          states: grouped
        });
      }
      
      case "create_alert_link": {
        const { item_name, market_name, alert_type } = toolInput;
        
        // Get current price for reference
        let currentPrice = null;
        if (market_name) {
          const priceResult = await prisma.$queryRawUnsafe(`
            SELECT TOP 1 price FROM Approved_Prices
            WHERE item_name LIKE '%${esc(item_name)}%'
              AND market_name LIKE '%${esc(market_name)}%'
              AND validation_status = 'APPROVED'
            ORDER BY validated_at DESC
          `) as any[];
          
          if (priceResult.length > 0) {
            currentPrice = parseFloat(priceResult[0].price);
          }
        }
        
        return JSON.stringify({
          action: "create_alert",
          link: `/dashboard/alerts?item=${encodeURIComponent(item_name)}${market_name ? `&market=${encodeURIComponent(market_name)}` : ''}${alert_type ? `&type=${alert_type}` : ''}`,
          current_price: currentPrice,
          suggestion: currentPrice 
            ? `Current price is ₦${currentPrice.toLocaleString()}. You might want to set alert ${alert_type === 'BELOW' ? 'below' : 'above'} this.`
            : 'Set your target price on the alerts page.'
        });
      }
      
      default:
        return JSON.stringify({ error: "Unknown tool" });
    }
  } catch (error: any) {
    console.error(`Tool error (${toolName}):`, error);
    return JSON.stringify({ error: error.message });
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], consumerId, tier = "FREE" } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Chatbot not configured. Please contact support." },
        { status: 500 }
      );
    }
    
    // TODO: Implement rate limiting based on tier
    // const limit = CHAT_LIMITS[tier.toUpperCase()] || 5;
    
    // Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...history.map((h: any) => ({
        role: h.role as "user" | "assistant",
        content: h.content
      })),
      { role: "user", content: message }
    ];
    
    console.log(`💬 Chat request: "${message.substring(0, 50)}..."`);
    
    // Call Claude
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: tools,
      messages: messages
    });
    
    // Handle tool use
    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );
      
      if (!toolUseBlock) break;
      
      console.log(`🔧 Tool call: ${toolUseBlock.name}`, toolUseBlock.input);
      
      const toolResult = await handleToolCall(toolUseBlock.name, toolUseBlock.input);
      
      console.log(`📊 Tool result: ${toolResult.substring(0, 100)}...`);
      
      // Continue conversation with tool result
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: tools,
        messages: [
          ...messages,
          { role: "assistant", content: response.content },
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseBlock.id,
                content: toolResult
              }
            ]
          }
        ]
      });
    }
    
    // Extract text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    
    const assistantMessage = textBlock?.text || "I'm sorry, I couldn't process that request.";
    
    console.log(`✅ Response: "${assistantMessage.substring(0, 50)}..."`);
    
    return NextResponse.json({
      success: true,
      message: assistantMessage,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens
      }
    });
    
  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    // Handle specific errors
    if (error.message?.includes("API key")) {
      return NextResponse.json(
        { error: "Chatbot configuration error. Please try again later." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to process your message. Please try again." },
      { status: 500 }
    );
  }
}
