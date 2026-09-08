import type { ProviderConfig } from "./types";

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    models: [
      { value: "gpt-4o", label: "GPT-4o", vision: true },
      { value: "gpt-4o-mini", label: "GPT-4o Mini", vision: true },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo", vision: true },
    ],
    supportsVision: true,
    fetchModelsDynamically: false,
    apiKeyRequired: true,
  },
  nvidia: {
    baseURL: "https://integrate.api.nvidia.com/v1",
    models: [
      { value: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B" },
      { value: "nvidia/llama-3.1-nemotron-ultra-253b-v1", label: "Nemotron Ultra 253B" },
      { value: "nvidia/llama-3.1-nemotron-nano-8b-v1", label: "Nemotron Nano 8B" },
      { value: "nvidia/nemotron-nano-12b-v2-vl", label: "Nemotron Nano 12B VL", vision: true },
      { value: "meta/llama-3.1-405b-instruct", label: "Llama 3.1 405B" },
      { value: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
      { value: "meta/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
      { value: "meta/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", vision: true },
      { value: "meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", vision: true },
      { value: "mistralai/mistral-large-2-instruct", label: "Mistral Large 2" },
      { value: "mistralai/mixtral-8x7b-instruct-v0.1", label: "Mixtral 8x7B" },
      { value: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B" },
      { value: "microsoft/phi-3.5-mini-instruct", label: "Phi 3.5 Mini" },
      { value: "qwen/qwen2.5-7b-instruct", label: "Qwen 2.5 7B" },
      { value: "deepseek-ai/deepseek-r1", label: "DeepSeek R1" },
    ],
    supportsVision: true,
    fetchModelsDynamically: true,
    apiKeyRequired: true,
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", vision: true },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", vision: true },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", vision: true },
    ],
    supportsVision: true,
    fetchModelsDynamically: false,
    apiKeyRequired: true,
  },
  claude: {
    baseURL: "https://api.anthropic.com/v1",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ],
    supportsVision: false,
    fetchModelsDynamically: false,
    apiKeyRequired: true,
  },
  ollama: {
    baseURL: "http://localhost:11434/v1",
    models: [
      { value: "llama3", label: "Llama 3" },
      { value: "mistral", label: "Mistral" },
      { value: "codellama", label: "Code Llama" },
    ],
    supportsVision: false,
    fetchModelsDynamically: false,
    apiKeyRequired: false,
  },
};
