"use client";

import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import {
  Settings as SettingsIcon,
  Bot,
  Mic,
  Phone,
  Mail,
  MessageCircle,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  Palette,
  Webhook,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { PROVIDER_CONFIGS } from "@/lib/ai/provider-configs";
import { THEME_PRESETS, getPresetById } from "@/lib/theme/presets";
import { CustomChannelsList, BuiltinChannelsGrid } from "@/components/channels/custom-channels-list";
import { useThemeAppearance } from "@/lib/hooks/use-theme-appearance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsData {
  businessName: string;
  businessDesc: string;
  welcomeMessage: string;
  tone: string;
  language: string;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
  maxTokens: number;
  temperature: number;
  elevenLabsKey: string;
  elevenLabsVoice: string;
  twilioSid: string;
  twilioToken: string;
  twilioPhone: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  whatsappMode: string;
  whatsappApiKey: string;
  whatsappPhone: string;
  themePreset: string;
  themeOverridesLight: Record<string, string>;
  themeOverridesDark: Record<string, string>;
  themeLogoUrl: string;
  themeLogoDarkUrl: string;
  themeFaviconUrl: string;
  appName: string;
  appNameShort: string;
  systemName: string;
  autoReplyEnabled: boolean;
}

interface CustomChannel {
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

type SectionKey =
  | "general"
  | "ai"
  | "voice"
  | "phone"
  | "email"
  | "whatsapp"
  | "channels"
  | "appearance";

interface TabDef {
  key: SectionKey;
  label: string;
  icon: React.ElementType;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const tabs: TabDef[] = [
  { key: "general", label: "General", icon: SettingsIcon },
  { key: "ai", label: "AI Configuration", icon: Bot },
  { key: "voice", label: "Voice (ElevenLabs)", icon: Mic },
  { key: "phone", label: "Phone (Twilio)", icon: Phone },
  { key: "email", label: "Email (SMTP/IMAP)", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "channels", label: "Channels", icon: Webhook },
  { key: "appearance", label: "Appearance", icon: Palette },
];

// Which fields belong to each section (used for partial saves)
const sectionFields: Record<SectionKey, (keyof SettingsData)[]> = {
  general: ["businessName", "businessDesc", "appName", "appNameShort", "systemName", "welcomeMessage", "tone", "language", "autoReplyEnabled"],
  ai: ["aiProvider", "aiModel", "aiApiKey", "aiBaseUrl", "maxTokens", "temperature"],
  voice: ["elevenLabsKey", "elevenLabsVoice"],
  phone: ["twilioSid", "twilioToken", "twilioPhone"],
  email: [
    "smtpHost",
    "smtpPort",
    "smtpUser",
    "smtpPass",
    "smtpFrom",
    "imapHost",
    "imapPort",
    "imapUser",
    "imapPass",
  ],
  whatsapp: ["whatsappMode", "whatsappApiKey", "whatsappPhone"],
  channels: [],
  appearance: ["themePreset", "themeOverridesLight", "themeOverridesDark", "themeLogoUrl", "themeLogoDarkUrl", "themeFaviconUrl"],
};

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-right",
            t.type === "success"
              ? "bg-owly-success text-white"
              : "bg-owly-danger text-white"
          )}
        >
          {t.type === "success" ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable form components
// ---------------------------------------------------------------------------

function FormField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-owly-text">
        {label}
      </label>
      {description && (
        <p className="text-xs text-owly-text-light">{description}</p>
      )}
      {children}
    </div>
  );
}

const inputClasses =
  "w-full px-3 py-2 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text placeholder:text-owly-text-light/60 focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary transition-colors";

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClasses}
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className={inputClasses}
    />
  );
}

function TextareaInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(inputClasses, "resize-none")}
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClasses}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClasses, "pr-10")}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-owly-text-light hover:text-owly-text rounded transition-colors"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  displayValue,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="flex-1 h-2 rounded-full appearance-none bg-owly-border accent-owly-primary cursor-pointer"
      />
      <span className="text-sm font-medium text-owly-text w-16 text-right">
        {displayValue ?? value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section save button
// ---------------------------------------------------------------------------

function SaveButton({
  onClick,
  saving,
}: {
  onClick: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex justify-end pt-4 border-t border-owly-border">
      <button
        onClick={onClick}
        disabled={saving}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
          saving
            ? "bg-owly-primary/60 text-white cursor-not-allowed"
            : "bg-owly-primary hover:bg-owly-primary-dark text-white"
        )}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function GeneralSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  return (
    <div className="space-y-5">
      <FormField label="Business Name" description="The name of your business or organization.">
        <TextInput
          value={data.businessName}
          onChange={(v) => update("businessName", v)}
          placeholder="My Business"
        />
      </FormField>
      <FormField label="Business Description" description="A short description used for context in AI interactions.">
        <TextareaInput
          value={data.businessDesc}
          onChange={(v) => update("businessDesc", v)}
          placeholder="Describe what your business does..."
        />
      </FormField>
      <FormField label="Application Name" description="Full name shown on login page, page titles, and descriptions.">
        <TextInput
          value={data.appName}
          onChange={(v) => update("appName", v)}
          placeholder="e.g. PowerDeck Help Desk"
        />
      </FormField>
      <FormField label="Application Short Name" description="Short name shown in the sidebar header and tight spaces.">
        <TextInput
          value={data.appNameShort}
          onChange={(v) => update("appNameShort", v)}
          placeholder="e.g. PowerDeck"
        />
      </FormField>
      <FormField label="System Name" description="Used for browser tab titles, PWA titles, and system-level branding.">
        <TextInput
          value={data.systemName}
          onChange={(v) => update("systemName", v)}
          placeholder="e.g. HelpDesk"
        />
      </FormField>
      <FormField label="Welcome Message" description="The greeting message sent to new customers.">
        <TextareaInput
          value={data.welcomeMessage}
          onChange={(v) => update("welcomeMessage", v)}
          placeholder="Hello! How can I help you today?"
        />
      </FormField>
      <FormField label="Tone" description="Choose the communication style for AI responses.">
        <SelectInput
          value={data.tone}
          onChange={(v) => update("tone", v)}
          options={[
            { value: "friendly", label: "Friendly" },
            { value: "professional", label: "Professional" },
            { value: "formal", label: "Formal" },
            { value: "technical", label: "Technical" },
          ]}
        />
      </FormField>
      <FormField label="Language" description="Primary language for AI responses. Auto will detect customer language.">
        <SelectInput
          value={data.language}
          onChange={(v) => update("language", v)}
          options={[
            { value: "auto", label: "Auto-detect" },
            { value: "en", label: "English" },
            { value: "tr", label: "Turkish" },
            { value: "de", label: "German" },
            { value: "fr", label: "French" },
            { value: "es", label: "Spanish" },
            { value: "pt", label: "Portuguese" },
            { value: "ar", label: "Arabic" },
            { value: "zh", label: "Chinese" },
            { value: "ja", label: "Japanese" },
          ]}
        />
      </FormField>
      <FormField label="Global Auto-Reply" description="Enable AI auto-reply for all channels by default. Can be overridden per-channel or per-message (inbound webhook payload).">
        <div className="flex items-center gap-2">
          <button
            onClick={() => update("autoReplyEnabled", !data.autoReplyEnabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              data.autoReplyEnabled ? "bg-owly-primary" : "bg-owly-border"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                data.autoReplyEnabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm text-owly-text-light">
            {data.autoReplyEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </FormField>
    </div>
  );
}

function AISection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  const [dynamicModels, setDynamicModels] = useState<{ value: string; label: string; vision?: boolean }[] | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  const { toast } = useToast();

  const providerConfig = PROVIDER_CONFIGS[data.aiProvider];
  const staticModels = providerConfig?.models || [];
  const modelOptions = dynamicModels || staticModels;
  const showCustomModel = customModel || (!!data.aiModel && !modelOptions.some((m) => m.value === data.aiModel));

  const providerOptions = Object.entries(PROVIDER_CONFIGS).map(([key, cfg]) => ({
    value: key,
    label: key === "nvidia" ? "NVIDIA NIM" : key === "gemini" ? "Google Gemini" : key.charAt(0).toUpperCase() + key.slice(1),
  }));

  async function handleFetchModels() {
    if (data.aiProvider !== "nvidia" || !data.aiApiKey) return;
    setFetchingModels(true);
    try {
      const res = await fetch("/api/ai/models", {
        headers: { "x-api-key": data.aiApiKey },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setDynamicModels(json.models);
    } catch {
      setDynamicModels(null);
      toast({ type: "error", title: "Failed to fetch NVIDIA models", description: "Check your API key and try again." });
    } finally {
      setFetchingModels(false);
    }
  }

  useEffect(() => {
    setDynamicModels(null);
    setCustomModel(false);
  }, [data.aiProvider]);

  return (
    <div className="space-y-5">
      <FormField label="AI Provider" description="Select which AI provider to use for generating responses.">
        <SelectInput
          value={data.aiProvider}
          onChange={(v) => {
            update("aiProvider", v);
            const cfg = PROVIDER_CONFIGS[v];
            if (cfg?.models?.length) {
              update("aiModel", cfg.models[0].value);
            }
            update("aiBaseUrl", "");
          }}
          options={providerOptions}
        />
      </FormField>
      <FormField label="Model" description="The specific model to use for AI responses.">
        {!showCustomModel ? (
          <SelectInput
            value={data.aiModel}
            onChange={(v) => update("aiModel", v)}
            options={modelOptions}
          />
        ) : (
          <TextInput
            value={data.aiModel}
            onChange={(v) => update("aiModel", v)}
            placeholder="Enter model ID (e.g. nvidia/llama-3.3-nemotron-super-49b-v1)"
          />
        )}
        <div className="flex items-center gap-3 mt-2">
          <label className="flex items-center gap-1.5 text-xs text-owly-text-light cursor-pointer">
            <input
              type="checkbox"
              checked={showCustomModel}
              onChange={(e) => setCustomModel(e.target.checked)}
              className="accent-owly-primary"
            />
            Custom model ID
          </label>
          {data.aiProvider === "nvidia" && !showCustomModel && (
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={fetchingModels || !data.aiApiKey}
              className="text-xs text-owly-primary hover:text-owly-primary-dark disabled:opacity-50"
            >
              {fetchingModels ? "Fetching..." : dynamicModels ? "Refresh models" : "Fetch all available models"}
            </button>
          )}
        </div>
      </FormField>
      <FormField label="API Key" description={providerConfig?.apiKeyRequired === false ? "Not required for this provider." : "Your provider API key."}>
        <PasswordInput
          value={data.aiApiKey}
          onChange={(v) => update("aiApiKey", v)}
          placeholder={
            providerConfig?.apiKeyRequired === false
              ? "Not required for local models"
              : "Enter your API key"
          }
        />
      </FormField>
      <FormField label="Custom Base URL" description="Override the default API endpoint. Leave empty to use the provider's default.">
        <TextInput
          value={data.aiBaseUrl}
          onChange={(v) => update("aiBaseUrl", v)}
          placeholder={providerConfig?.baseURL || "https://api.openai.com/v1"}
        />
      </FormField>
      <FormField label="Max Tokens" description="Maximum number of tokens per AI response.">
        <SliderInput
          value={data.maxTokens}
          onChange={(v) => update("maxTokens", v)}
          min={256}
          max={8192}
          step={256}
          displayValue={data.maxTokens.toLocaleString()}
        />
      </FormField>
      <FormField label="Temperature" description="Controls randomness. Lower values make responses more focused, higher values more creative.">
        <SliderInput
          value={data.temperature}
          onChange={(v) => update("temperature", v)}
          min={0}
          max={2}
          step={0.1}
          displayValue={data.temperature.toFixed(1)}
        />
      </FormField>
    </div>
  );
}

function VoiceSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg bg-owly-primary-50/50 border border-owly-primary/20">
        <p className="text-sm text-owly-text">
          Connect your ElevenLabs account to enable AI-powered voice responses for phone calls.
        </p>
      </div>
      <FormField label="API Key" description="Your ElevenLabs API key for text-to-speech.">
        <PasswordInput
          value={data.elevenLabsKey}
          onChange={(v) => update("elevenLabsKey", v)}
          placeholder="Enter your ElevenLabs API key"
        />
      </FormField>
      <FormField label="Voice ID" description="The ElevenLabs voice ID to use for speech synthesis.">
        <TextInput
          value={data.elevenLabsVoice}
          onChange={(v) => update("elevenLabsVoice", v)}
          placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
        />
      </FormField>
    </div>
  );
}

function PhoneSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg bg-owly-primary-50/50 border border-owly-primary/20">
        <p className="text-sm text-owly-text">
          Configure Twilio to enable phone call support. You will need an active Twilio account with a phone number.
        </p>
      </div>
      <FormField label="Account SID" description="Your Twilio Account SID from the dashboard.">
        <PasswordInput
          value={data.twilioSid}
          onChange={(v) => update("twilioSid", v)}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        />
      </FormField>
      <FormField label="Auth Token" description="Your Twilio authentication token.">
        <PasswordInput
          value={data.twilioToken}
          onChange={(v) => update("twilioToken", v)}
          placeholder="Enter your Twilio auth token"
        />
      </FormField>
      <FormField label="Phone Number" description="Your Twilio phone number in E.164 format.">
        <TextInput
          value={data.twilioPhone}
          onChange={(v) => update("twilioPhone", v)}
          placeholder="+1234567890"
        />
      </FormField>
    </div>
  );
}

function EmailSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* SMTP */}
      <div>
        <h4 className="text-sm font-semibold text-owly-text mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-owly-primary" />
          Outgoing Mail (SMTP)
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="SMTP Host">
              <TextInput
                value={data.smtpHost}
                onChange={(v) => update("smtpHost", v)}
                placeholder="smtp.gmail.com"
              />
            </FormField>
            <FormField label="SMTP Port">
              <NumberInput
                value={data.smtpPort}
                onChange={(v) => update("smtpPort", v)}
                min={1}
                max={65535}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Username">
              <TextInput
                value={data.smtpUser}
                onChange={(v) => update("smtpUser", v)}
                placeholder="your@email.com"
              />
            </FormField>
            <FormField label="Password">
              <PasswordInput
                value={data.smtpPass}
                onChange={(v) => update("smtpPass", v)}
                placeholder="Enter SMTP password"
              />
            </FormField>
          </div>
          <FormField label="From Address" description="The email address that will appear as the sender.">
            <TextInput
              value={data.smtpFrom}
              onChange={(v) => update("smtpFrom", v)}
              placeholder="support@yourbusiness.com"
            />
          </FormField>
        </div>
      </div>

      {/* IMAP */}
      <div>
        <h4 className="text-sm font-semibold text-owly-text mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-owly-primary" />
          Incoming Mail (IMAP)
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="IMAP Host">
              <TextInput
                value={data.imapHost}
                onChange={(v) => update("imapHost", v)}
                placeholder="imap.gmail.com"
              />
            </FormField>
            <FormField label="IMAP Port">
              <NumberInput
                value={data.imapPort}
                onChange={(v) => update("imapPort", v)}
                min={1}
                max={65535}
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Username">
              <TextInput
                value={data.imapUser}
                onChange={(v) => update("imapUser", v)}
                placeholder="your@email.com"
              />
            </FormField>
            <FormField label="Password">
              <PasswordInput
                value={data.imapPass}
                onChange={(v) => update("imapPass", v)}
                placeholder="Enter IMAP password"
              />
            </FormField>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-lg bg-owly-primary-50/50 border border-owly-primary/20">
        <p className="text-sm text-owly-text">
          Choose between WhatsApp Web (free, requires QR scan) or the official WhatsApp Business API (paid, more reliable).
        </p>
      </div>
      <FormField label="Connection Mode" description="Select how the system connects to WhatsApp.">
        <SelectInput
          value={data.whatsappMode}
          onChange={(v) => update("whatsappMode", v)}
          options={[
            { value: "web", label: "WhatsApp Web" },
            { value: "api", label: "WhatsApp Business API" },
          ]}
        />
      </FormField>
      {data.whatsappMode === "api" && (
        <>
          <FormField label="API Key" description="Your WhatsApp Business API key.">
            <PasswordInput
              value={data.whatsappApiKey}
              onChange={(v) => update("whatsappApiKey", v)}
              placeholder="Enter your WhatsApp API key"
            />
          </FormField>
          <FormField label="Phone Number" description="Your WhatsApp Business phone number in E.164 format.">
            <TextInput
              value={data.whatsappPhone}
              onChange={(v) => update("whatsappPhone", v)}
              placeholder="+1234567890"
            />
          </FormField>
        </>
      )}
    </div>
  );
}

function AppearanceSection({
  data,
  update,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => void;
}) {
  const { setAppearance } = useThemeAppearance();
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [overrideMode, setOverrideMode] = useState<"light" | "dark">("light");
  const [uploading, setUploading] = useState<string | null>(null);

  const colorVarNames = [
    "--owly-primary", "--owly-primary-dark", "--owly-primary-light",
    "--owly-primary-50", "--owly-primary-100", "--owly-accent",
    "--owly-accent-light", "--owly-bg", "--owly-surface",
    "--owly-text", "--owly-text-light", "--owly-border",
    "--owly-sidebar", "--owly-sidebar-hover", "--owly-sidebar-active",
    "--owly-success", "--owly-warning", "--owly-danger",
  ];

  function applyAppearance(presetId?: string, overridesLight?: Record<string, string>, overridesDark?: Record<string, string>) {
    setAppearance({
      themePreset: presetId ?? data.themePreset,
      themeOverridesLight: overridesLight ?? data.themeOverridesLight,
      themeOverridesDark: overridesDark ?? data.themeOverridesDark,
      themeLogoUrl: data.themeLogoUrl,
      themeLogoDarkUrl: data.themeLogoDarkUrl,
      themeFaviconUrl: data.themeFaviconUrl,
      appName: data.appName,
      appNameShort: data.appNameShort,
      systemName: data.systemName,
    });
  }

  const currentPreset = getPresetById(data.themePreset);
  const presetColors = currentPreset
    ? (overrideMode === "light" ? currentPreset.colors.light : currentPreset.colors.dark)
    : {};

  async function handleUpload(file: File, field: "themeLogoUrl" | "themeLogoDarkUrl" | "themeFaviconUrl") {
    setUploading(field);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/assets/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      update(field, json.path);
      toast({ type: "success", title: "File uploaded", description: json.path });
    } catch {
      toast({ type: "error", title: "Upload failed", description: "Please try again." });
    } finally {
      setUploading(null);
    }
  }

  const activeOverrides = overrideMode === "light" ? data.themeOverridesLight : data.themeOverridesDark;

  function setOverrideVar(varName: string, value: string) {
    const field = overrideMode === "light" ? "themeOverridesLight" : "themeOverridesDark";
    const current = { ...(overrideMode === "light" ? data.themeOverridesLight : data.themeOverridesDark) };
    if (value) {
      current[varName] = value;
    } else {
      delete current[varName];
    }
    update(field, current);
  }

  function resetOverrideVar(varName: string) {
    const field = overrideMode === "light" ? "themeOverridesLight" : "themeOverridesDark";
    const current = { ...(overrideMode === "light" ? data.themeOverridesLight : data.themeOverridesDark) };
    delete current[varName];
    update(field, current);
  }

  function resetAllOverrides() {
    const field = overrideMode === "light" ? "themeOverridesLight" : "themeOverridesDark";
    update(field, {});
  }

  return (
    <div className="space-y-5">
      <FormField label="Theme Preset" description="Choose a color theme for your instance.">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                update("themePreset", preset.id);
                update("themeOverridesLight", {});
                update("themeOverridesDark", {});
                applyAppearance(preset.id, {}, {});
              }}
              className={`rounded-lg border p-3 text-left transition-all ${
                data.themePreset === preset.id
                  ? "border-owly-primary ring-1 ring-owly-primary bg-owly-primary-50"
                  : "border-owly-border hover:border-owly-primary-light"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-5 h-5 rounded-full border border-owly-border"
                  style={{ backgroundColor: preset.colors.light["--owly-primary"] }}
                />
                <span
                  className="w-5 h-5 rounded-full border border-owly-border"
                  style={{ backgroundColor: preset.colors.light["--owly-accent"] }}
                />
                <span
                  className="w-5 h-5 rounded-full border border-owly-border"
                  style={{ backgroundColor: preset.colors.light["--owly-sidebar"] }}
                />
              </div>
              <div className="text-sm font-medium text-owly-text">{preset.name}</div>
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Branding" description="Upload your logo and favicon, or enter a URL. Uploaded files are stored at /uploads/.">
        <div className="space-y-3 mt-2">
          <div>
            <label className="block text-xs font-medium text-owly-text-light mb-1">Logo (light mode)</label>
            <div className="flex gap-2">
              <TextInput
                value={data.themeLogoUrl}
                onChange={(v) => update("themeLogoUrl", v)}
                placeholder="/uploads/logo.png or https://example.com/logo.png"
              />
              <label className="flex items-center px-3 py-2 text-xs font-medium rounded-lg border border-owly-border cursor-pointer hover:bg-owly-surface whitespace-nowrap">
                {uploading === "themeLogoUrl" ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "themeLogoUrl");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-owly-text-light mb-1">Logo (dark mode, optional)</label>
            <p className="text-xs text-owly-text-light mb-1">If empty, the light mode logo is used in dark mode as well.</p>
            <div className="flex gap-2">
              <TextInput
                value={data.themeLogoDarkUrl}
                onChange={(v) => update("themeLogoDarkUrl", v)}
                placeholder="Leave empty to use light mode logo"
              />
              <label className="flex items-center px-3 py-2 text-xs font-medium rounded-lg border border-owly-border cursor-pointer hover:bg-owly-surface whitespace-nowrap">
                {uploading === "themeLogoDarkUrl" ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "themeLogoDarkUrl");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-owly-text-light mb-1">Favicon</label>
            <div className="flex gap-2">
              <TextInput
                value={data.themeFaviconUrl}
                onChange={(v) => update("themeFaviconUrl", v)}
                placeholder="/uploads/favicon.ico or https://example.com/favicon.ico"
              />
              <label className="flex items-center px-3 py-2 text-xs font-medium rounded-lg border border-owly-border cursor-pointer hover:bg-owly-surface whitespace-nowrap">
                {uploading === "themeFaviconUrl" ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, "themeFaviconUrl");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </FormField>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm font-medium text-owly-primary hover:text-owly-primary-dark"
        >
          {showAdvanced ? "Hide" : "Show"} Advanced Color Customization
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border border-owly-border p-4 bg-owly-bg">
          <div className="flex items-center justify-between">
            <p className="text-xs text-owly-text-light">
              Override individual colors on top of the selected preset. Changes apply on save.
            </p>
            <div className="flex items-center gap-1 rounded-lg border border-owly-border p-0.5">
              <button
                type="button"
                onClick={() => setOverrideMode("light")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  overrideMode === "light" ? "bg-owly-primary text-white" : "text-owly-text-light hover:text-owly-text"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setOverrideMode("dark")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  overrideMode === "dark" ? "bg-owly-primary text-white" : "text-owly-text-light hover:text-owly-text"
                }`}
              >
                Dark
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {colorVarNames.map((varName) => {
              const currentOverride = (activeOverrides as Record<string, string>)[varName] || "";
              return (
                <div key={varName} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={currentOverride || (presetColors as Record<string, string>)[varName] || "#000000"}
                    onChange={(e) => setOverrideVar(varName, e.target.value)}
                    className="h-8 w-12 rounded border border-owly-border cursor-pointer"
                  />
                  <span className="text-xs font-mono text-owly-text-light flex-1">{varName}</span>
                  {currentOverride && (
                    <button
                      type="button"
                      onClick={() => resetOverrideVar(varName)}
                      className="text-xs text-owly-danger hover:text-red-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={resetAllOverrides}
            className="text-xs text-owly-text-light hover:text-owly-text"
          >
            Reset all {overrideMode} overrides to preset defaults
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Channels Section (custom webhook channels)
// ---------------------------------------------------------------------------

function ChannelsSection({
  data,
  update,
  addToast,
}: {
  data: SettingsData;
  update: (field: keyof SettingsData, value: string | number | Record<string, string> | boolean) => void;
  addToast: (type: "success" | "error", message: string) => void;
}) {
  const [channels, setChannels] = useState<CustomChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchChannels = useCallback(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data: CustomChannel[]) => {
        setChannels(Array.isArray(data) ? data : []);
      })
      .catch(() => addToast("error", "Failed to load channels"))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const updateChannel = async (ch: CustomChannel, changes: Partial<CustomChannel>) => {
    setSavingId(ch.type);
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: ch.type,
          ...changes,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast("success", `Channel '${ch.displayName || ch.type}' updated`);
      fetchChannels();
    } catch {
      addToast("error", "Failed to update channel");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-owly-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global auto-reply setting */}
      <div className="border border-owly-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-owly-text">Global Auto-Reply</label>
            <p className="text-xs text-owly-text-light mt-0.5">
              Default for all channels. Can be overridden per-channel or per-message (inbound webhook payload).
            </p>
          </div>
          <button
            onClick={() => update("autoReplyEnabled", !data.autoReplyEnabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              data.autoReplyEnabled ? "bg-owly-primary" : "bg-owly-border"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                data.autoReplyEnabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </div>

      {/* Custom channels */}
      <CustomChannelsList
        channels={channels}
        savingId={savingId}
        onToggle={updateChannel}
        onUpdate={(ch, field, value) => {
          const updated = channels.map((c) =>
            c.type === ch.type ? { ...c, [field]: value } : c
          );
          setChannels(updated);
        }}
        onSave={() => {}}
      />

      {/* Built-in channels status (read-only) */}
      <BuiltinChannelsGrid channels={channels} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------

const defaultSettings: SettingsData = {
  businessName: "My Business",
  businessDesc: "",
  welcomeMessage: "Hello! How can I help you today?",
  tone: "friendly",
  language: "auto",
  aiProvider: "openai",
  aiModel: "gpt-4o-mini",
  aiApiKey: "",
  aiBaseUrl: "",
  maxTokens: 2048,
  temperature: 0.7,
  elevenLabsKey: "",
  elevenLabsVoice: "",
  twilioSid: "",
  twilioToken: "",
  twilioPhone: "",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  imapHost: "",
  imapPort: 993,
  imapUser: "",
  imapPass: "",
  whatsappMode: "web",
  whatsappApiKey: "",
  whatsappPhone: "",
  themePreset: "owly-default",
  themeOverridesLight: {},
  themeOverridesDark: {},
  themeLogoUrl: "",
  themeLogoDarkUrl: "",
  themeFaviconUrl: "",
  appName: "HelpDesk",
  appNameShort: "HelpDesk",
  systemName: "HelpDesk",
  autoReplyEnabled: true,
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SectionKey>("general");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((settings) => {
        const merged = { ...defaultSettings };
        for (const key of Object.keys(merged) as (keyof SettingsData)[]) {
          if (settings[key] !== undefined && settings[key] !== null) {
            (merged as Record<string, unknown>)[key] = settings[key];
          }
        }
        setData(merged);

        if (settings.themePreset) {
          const { setAppearance } = useThemeAppearance.getState();
          const rawLight = settings.themeOverridesLight;
          const rawDark = settings.themeOverridesDark;
          const safeLight = (typeof rawLight === "object" && rawLight !== null && !Array.isArray(rawLight))
            ? rawLight as Record<string, string>
            : {};
          const safeDark = (typeof rawDark === "object" && rawDark !== null && !Array.isArray(rawDark))
            ? rawDark as Record<string, string>
            : {};
          setAppearance({
            themePreset: settings.themePreset,
            themeOverridesLight: safeLight,
            themeOverridesDark: safeDark,
            themeLogoUrl: settings.themeLogoUrl || "",
            themeLogoDarkUrl: settings.themeLogoDarkUrl || "",
            themeFaviconUrl: settings.themeFaviconUrl || "",
            appName: settings.appName || "HelpDesk",
            appNameShort: settings.appNameShort || "HelpDesk",
            systemName: settings.systemName || "HelpDesk",
          });
        }
      })
      .catch(() => addToast("error", "Failed to load settings"))
      .finally(() => setLoading(false));
  }, [addToast]);

  const update = (field: keyof SettingsData, value: string | number | boolean | Record<string, string>) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const saveSection = async () => {
    setSaving(true);
    try {
      const fields = sectionFields[activeTab];
      const payload: Record<string, unknown> = {};
      for (const f of fields) {
        payload[f] = data[f];
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");
      addToast("success", "Settings saved successfully");

      if (activeTab === "appearance") {
        const { setAppearance } = useThemeAppearance.getState();
        setAppearance({
          themePreset: data.themePreset,
          themeOverridesLight: data.themeOverridesLight,
          themeOverridesDark: data.themeOverridesDark,
          themeLogoUrl: data.themeLogoUrl,
          themeLogoDarkUrl: data.themeLogoDarkUrl,
          themeFaviconUrl: data.themeFaviconUrl,
          appName: data.appName,
          appNameShort: data.appNameShort,
        });
      } else if (activeTab === "general") {
        const { setAppearance } = useThemeAppearance.getState();
        setAppearance({
          appName: data.appName,
          appNameShort: data.appNameShort,
        });
      }
    } catch {
      addToast("error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const sectionRenderers: Record<SectionKey, React.ReactNode> = {
    general: <GeneralSection data={data} update={update} />,
    ai: <AISection data={data} update={update} />,
    voice: <VoiceSection data={data} update={update} />,
    phone: <PhoneSection data={data} update={update} />,
    email: <EmailSection data={data} update={update} />,
    whatsapp: <WhatsAppSection data={data} update={update} />,
    channels: <ChannelsSection data={data} update={update} addToast={addToast} />,
    appearance: <AppearanceSection data={data} update={update} />,
  };

  if (loading) {
    return (
      <>
        <Header title="Settings" description="Configure your instance" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-owly-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Settings" description="Configure your instance" />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Tab navigation */}
          <div className="relative mb-6">
            <div className="flex gap-1 p-1 bg-owly-bg rounded-xl border border-owly-border overflow-x-auto scrollbar-thin scrollbar-thumb-owly-border scrollbar-track-transparent">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0",
                      isActive
                        ? "bg-owly-surface text-owly-primary shadow-sm"
                        : "text-owly-text-light hover:text-owly-text hover:bg-owly-surface/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section content */}
          <div className="bg-owly-surface rounded-xl border border-owly-border p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-owly-text">
                {tabs.find((t) => t.key === activeTab)?.label}
              </h3>
              <p className="text-sm text-owly-text-light mt-0.5">
                {activeTab === "general" &&
                  "Configure your business identity and communication preferences."}
                {activeTab === "ai" &&
                  "Set up the AI model that powers your customer interactions."}
                {activeTab === "voice" &&
                  "Configure text-to-speech for voice-based support channels."}
                {activeTab === "phone" &&
                  "Connect your Twilio account for phone call handling."}
                {activeTab === "email" &&
                  "Set up email sending and receiving for support tickets."}
                {activeTab === "whatsapp" &&
                  "Configure WhatsApp integration for messaging support."}
                {activeTab === "channels" &&
                  "Manage custom webhook channels (inbound webhooks, integrations). Channels auto-create on first message."}
                {activeTab === "appearance" &&
                  "Customize the look and feel of your instance."}
              </p>
            </div>

            {sectionRenderers[activeTab]}

            <SaveButton onClick={saveSection} saving={saving} />
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} />
    </>
  );
}
