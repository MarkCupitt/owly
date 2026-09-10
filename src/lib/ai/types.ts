export interface TextPart {
  type: "text";
  text: string;
}

export interface ImagePart {
  type: "image_url";
  image_url: { url: string };
}

export type ContentPart = TextPart | ImagePart;

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

export interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  aiBaseUrl?: string;
}

export interface AIProvider {
  chat(params: {
    model: string;
    messages: AIMessage[];
    tools?: ToolDefinition[];
    maxTokens: number;
    temperature: number;
  }): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    finishReason: string;
  }>;
}

export interface ProviderConfig {
  baseURL: string;
  models: { value: string; label: string; vision?: boolean }[];
  supportsVision: boolean;
  fetchModelsDynamically: boolean;
  apiKeyLabel?: string;
  apiKeyRequired: boolean;
}

export interface ConversationContext {
  businessName: string;
  businessDesc: string;
  welcomeMessage: string;
  tone: string;
  language: string;
  knowledgeBase: KnowledgeItem[];
  customerName: string;
  customerHistory: string[];
  channel: string;
  appName: string;
}

export interface KnowledgeItem {
  category: string;
  title: string;
  content: string;
  priority: number;
}
