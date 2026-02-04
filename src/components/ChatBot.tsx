"use client";

// src/components/ChatBot.tsx
// NaijaMarket Intel - AI Chatbot Component
// Floating chat button with expandable panel
// Updated: 2026-02-04

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  label: string;
  message: string;
  icon: string;
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Check Prices", message: "What commodities can I check prices for?", icon: "💰" },
  { label: "Compare Markets", message: "Which markets do you have data for?", icon: "📊" },
  { label: "Set Alert", message: "How do I set up a price alert?", icon: "🔔" },
  { label: "Help", message: "What can you help me with?", icon: "❓" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function ChatBot() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content: `👋 Welcome to NaijaMarket Intel!\n\nI'm your AI assistant. I can help you:\n\n• 💰 Check commodity prices\n• 📊 Compare prices across markets\n• 🔔 Set up price alerts\n• ❓ Answer your questions\n\nWhat would you like to know?`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Prepare history (exclude welcome message)
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          history,
          consumerId: (session?.user as any)?.id,
          tier: (session?.user as any)?.tier || "FREE",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle quick action
  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.message);
  };

  // Format message content with line breaks
  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg transition-all duration-300
          ${isOpen 
            ? "bg-red-500 hover:bg-red-600 rotate-0" 
            : "bg-gradient-to-r from-emerald-500 to-yellow-500 hover:from-emerald-600 hover:to-yellow-600"
          }
        `}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div 
          className="
            fixed bottom-24 right-6 z-50
            w-[380px] max-w-[calc(100vw-48px)]
            h-[550px] max-h-[calc(100vh-120px)]
            bg-[#0a0a0a] border border-[#2a2a2a]
            rounded-2xl shadow-2xl
            flex flex-col overflow-hidden
            animate-in slide-in-from-bottom-4 fade-in duration-300
          "
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-yellow-500/10 border-b border-[#2a2a2a] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-yellow-500 flex items-center justify-center">
                <span className="text-black font-bold text-sm">NM</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm">NaijaMarket Assistant</h3>
                <p className="text-emerald-400 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Online • AI-Powered
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-4 py-3 text-sm
                    ${msg.role === "user"
                      ? "bg-emerald-500 text-white rounded-br-md"
                      : "bg-[#1a1a1a] text-gray-200 rounded-bl-md border border-[#2a2a2a]"
                    }
                  `}
                >
                  {formatContent(msg.content)}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                    <span className="text-gray-400 text-xs">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (show only if no messages yet or after welcome) */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    className="
                      flex items-center gap-1.5 px-3 py-1.5
                      bg-[#1a1a1a] hover:bg-[#2a2a2a]
                      border border-[#2a2a2a] hover:border-emerald-500/50
                      rounded-full text-xs text-gray-300 hover:text-white
                      transition-all duration-200
                    "
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-[#2a2a2a]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about prices, markets..."
                disabled={isLoading}
                className="
                  flex-1 bg-[#1a1a1a] border border-[#2a2a2a]
                  rounded-xl px-4 py-2.5 text-sm text-white
                  placeholder-gray-500
                  focus:outline-none focus:border-emerald-500/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="
                  bg-gradient-to-r from-emerald-500 to-emerald-600
                  hover:from-emerald-600 hover:to-emerald-700
                  disabled:from-gray-600 disabled:to-gray-700
                  disabled:cursor-not-allowed
                  text-white rounded-xl px-4 py-2.5
                  transition-all duration-200
                "
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 text-center">
              Powered by Claude AI • Prices updated in real-time
            </p>
          </form>
        </div>
      )}
    </>
  );
}
