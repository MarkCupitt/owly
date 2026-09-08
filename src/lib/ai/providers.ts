import OpenAI from "openai";
import type { AIConfig, AIProvider } from "./types";
import { PROVIDER_CONFIGS } from "./provider-configs";

export { PROVIDER_CONFIGS } from "./provider-configs";

export function getProviderBaseURL(config: AIConfig): string {
  if (config.aiBaseUrl) return config.aiBaseUrl;
  return PROVIDER_CONFIGS[config.provider]?.baseURL || "https://api.openai.com/v1";
}

export function createProvider(config: AIConfig): AIProvider {
  const baseURL = getProviderBaseURL(config);
  const apiKey = config.apiKey || "ollama";

  const client = new OpenAI({ apiKey, baseURL });

  return {
    async chat({ model, messages, tools, maxTokens, temperature }) {
      const response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        tools: tools as OpenAI.ChatCompletionTool[] | undefined,
        max_tokens: maxTokens,
        temperature,
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls as
        | Array<{ id: string; type: string; function: { name: string; arguments: string } }>
        | undefined;

      return {
        content: choice.message.content || "",
        toolCalls: toolCalls?.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
        finishReason: choice.finish_reason || "stop",
      };
    },
  };
}

export async function fetchNvidiaModels(apiKey: string): Promise<{ value: string; label: string; vision?: boolean }[]> {
  try {
    const client = new OpenAI({ apiKey, baseURL: "https://integrate.api.nvidia.com/v1" });
    const list = await client.models.list();

    const chatModelPattern = /instruct|chat|nemotron|llama|mistral|qwen|gemma|phi|deepseek/i;
    const visionKeywords = /vl|vision|omni|scout|maverick|glimmer|inkling|cosmos/i;

    return list.data
      .filter((m: { id: string }) => chatModelPattern.test(m.id))
      .map((m: { id: string }) => ({
        value: m.id,
        label: m.id
          .split("/")
          .pop()!
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        vision: visionKeywords.test(m.id),
      }))
      .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
  } catch {
    return PROVIDER_CONFIGS.nvidia.models;
  }
}
