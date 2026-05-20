"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  seedMessage: string;
  observation: string;
  onClose: () => void;
};

/**
 * Bottom-sheet chat. On open it auto-sends the seed message so the user
 * lands on a useful response rather than a blank prompt. All streaming
 * happens through the Vercel AI Gateway via /api/chat.
 */
export function ChatSheet({ open, seedMessage, observation, onClose }: Props) {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const seededFor = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Send the seed once per (open, seed) pair so reopening with a new card
  // restarts the conversation cleanly.
  useEffect(() => {
    if (!open) return;
    const key = `${seedMessage}`;
    if (seededFor.current === key) return;
    seededFor.current = key;
    sendMessage({ text: seedMessage });
  }, [open, seedMessage, sendMessage]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Stick to the bottom as new tokens stream in.
  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, status]);

  if (!open) return null;

  const isStreaming = status === "submitted" || status === "streaming";

  function send() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage({ text });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trajectory chat"
        className="relative flex w-full max-w-[440px] flex-col rounded-t-2xl border-t"
        style={{
          height: "80vh",
          background: "var(--surface-primary)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <header className="px-5 pt-3">
          <div
            className="mx-auto h-1 w-9 rounded-full"
            style={{ background: "var(--border-subtle)" }}
          />
          <p
            className="mt-3 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {observation}
          </p>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ scrollbarGutter: "stable" }}
        >
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id}>
                <MessageBubble message={m} />
              </li>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <li>
                <p
                  className="text-[13px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Thinking…
                </p>
              </li>
            )}
            {error && (
              <li>
                <p
                  className="text-[13px]"
                  style={{ color: "var(--score-spending)" }}
                >
                  Something went wrong. Please try again.
                </p>
              </li>
            )}
          </ul>
        </div>

        <form
          className="flex gap-2 border-t px-5 py-3"
          style={{ borderColor: "var(--border-subtle)" }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up…"
            className="flex-1 rounded-lg border bg-transparent px-3 py-2.5 text-[15px]"
            style={{ borderColor: "var(--border-subtle)" }}
            disabled={isStreaming}
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={isStreaming || input.trim().length === 0}
            className="rounded-lg px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
            style={{
              background: "var(--text-primary)",
              color: "var(--surface-primary)",
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

type ChatMessage = ReturnType<typeof useChat>["messages"][number];

function MessageBubble({ message }: { message: ChatMessage }) {
  const text = message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
  const fromUser = message.role === "user";
  return (
    <div className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed"
        style={{
          background: fromUser
            ? "var(--text-primary)"
            : "var(--surface-secondary)",
          color: fromUser ? "var(--surface-primary)" : "var(--text-primary)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
