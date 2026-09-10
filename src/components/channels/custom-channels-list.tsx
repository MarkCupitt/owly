"use client";

import { Radio, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomChannel {
  id: string | null;
  type: string;
  isActive: boolean;
  isCustom: boolean;
  displayName: string;
  outboundWebhookUrl: string;
  outboundWebhookHeaders: Record<string, string>;
  autoReplyEnabled: boolean;
  status: string;
  disabledReason: string;
}

interface CustomChannelsListProps {
  channels: CustomChannel[];
  savingId: string | null;
  onToggle: (channel: CustomChannel, updates: Partial<CustomChannel>) => void;
  onUpdate: (channel: CustomChannel, field: keyof CustomChannel, value: string) => void;
  onSave: (channel: CustomChannel) => void;
}

export function CustomChannelsList({
  channels,
  savingId,
  onToggle,
  onUpdate,
}: CustomChannelsListProps) {
  const customChannels = channels.filter((ch) => ch.isCustom);

  if (customChannels.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-owly-text">Custom Channels</h4>
        <p className="text-xs text-owly-text-light">
          Custom channels are auto-created when an inbound webhook sends a message with a new channel name.
          Configure the outbound webhook URL so staff replies can be delivered back to the channel.
        </p>
        <div className="text-sm text-owly-text-light italic py-4 text-center border border-dashed border-owly-border rounded-lg">
          No custom channels yet. They appear automatically when the first inbound webhook message is received.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-owly-text">Custom Channels</h4>
      <p className="text-xs text-owly-text-light">
        Custom channels are auto-created when an inbound webhook sends a message with a new channel name.
        Configure the outbound webhook URL so staff replies can be delivered back to the channel.
      </p>

      {customChannels.map((ch) => (
        <div
          key={ch.type}
          className={cn(
            "border rounded-lg p-4 space-y-3",
            ch.isActive
              ? "border-owly-border bg-owly-bg"
              : "border-owly-border bg-owly-bg opacity-60"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio
                className={cn(
                  "h-4 w-4",
                  ch.isActive ? "text-green-500" : "text-owly-text-light"
                )}
              />
              <span className="text-sm font-medium text-owly-text">
                {ch.displayName || ch.type}
              </span>
              <code className="text-xs text-owly-text-light bg-owly-bg px-1.5 py-0.5 rounded">
                {ch.type}
              </code>
            </div>
            <button
              onClick={() =>
                onToggle(ch, {
                  isActive: !ch.isActive,
                  disabledReason: ch.isActive ? "Manually disabled" : "",
                })
              }
              disabled={savingId === ch.type}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                ch.isActive ? "bg-owly-primary" : "bg-owly-border"
              )}
            >
              {savingId === ch.type && (
                <Loader2 className="absolute h-3 w-3 animate-spin text-white left-1/2 -translate-x-1/2" />
              )}
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  ch.isActive ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>

          {ch.isActive && (
            <>
              <div>
                <label className="text-xs font-medium text-owly-text-light">Display Name</label>
                <input
                  type="text"
                  value={ch.displayName}
                  onChange={(e) => onUpdate(ch, "displayName", e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-owly-border bg-owly-surface text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-owly-text-light">
                  Outbound Webhook URL (external system reply endpoint)
                </label>
                <input
                  type="url"
                  placeholder="https://workflow.example.com/webhook/owly-reply"
                  value={ch.outboundWebhookUrl}
                  onChange={(e) => onUpdate(ch, "outboundWebhookUrl", e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-owly-border bg-owly-surface text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-owly-text-light">
                    Channel Auto-Reply
                  </label>
                  <p className="text-xs text-owly-text-light mt-0.5">
                    Override global setting for this channel only.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onToggle(ch, { autoReplyEnabled: !ch.autoReplyEnabled })
                  }
                  disabled={savingId === ch.type}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                    ch.autoReplyEnabled ? "bg-owly-primary" : "bg-owly-border"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                      ch.autoReplyEnabled ? "translate-x-5" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </>
          )}

          {!ch.isActive && ch.disabledReason && (
            <p className="text-xs text-owly-text-light italic">
              Disabled: {ch.disabledReason}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function BuiltinChannelsGrid({ channels }: { channels: CustomChannel[] }) {
  const builtinChannels = channels.filter((ch) => !ch.isCustom);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-owly-text">Built-in Channels</h4>
      <div className="grid grid-cols-2 gap-2">
        {builtinChannels.map((ch) => (
          <div
            key={ch.type}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-owly-border bg-owly-bg text-sm"
          >
            <Radio
              className={cn(
                "h-3.5 w-3.5",
                ch.isActive ? "text-green-500" : "text-owly-text-light"
              )}
            />
            <span className="text-owly-text capitalize">{ch.type}</span>
            <span
              className={cn(
                "ml-auto text-xs",
                ch.isActive ? "text-green-500" : "text-owly-text-light"
              )}
            >
              {ch.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
