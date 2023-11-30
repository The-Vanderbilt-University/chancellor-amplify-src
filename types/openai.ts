import { OPENAI_API_TYPE } from '../utils/app/const';

export interface OpenAIModel {
  id: string;
  name: string;
  maxLength: number; // maximum length of a message
  tokenLimit: number;
  visible?: boolean;
}

export enum OpenAIModelID {
  GPT_4_TURBO = 'gpt-4-1106-preview',
  GPT_4_TURBO_AZ = 'gpt-4-turbo',
  GPT_3_5 = 'gpt-3.5-turbo',
  GPT_3_5_FN = 'gpt-3.5-turbo-0613',
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_3_5_16K = 'gpt-3.5-turbo-16k',
  GPT_4 = 'gpt-4',
  GPT_4_FN = 'gpt-4-0613',
  GPT_4_32K = 'gpt-4-32k',
}

// in case the `DEFAULT_MODEL` environment variable is not set or set to an unsupported model
export const fallbackModelID = OpenAIModelID.GPT_3_5;

export const OpenAIModels: Record<OpenAIModelID, OpenAIModel> = {

  [OpenAIModelID.GPT_4_TURBO_AZ]: {
    id: OpenAIModelID.GPT_4_TURBO,
    name: 'GPT-4-Turbo (Azure)',
    maxLength: 24000,
    tokenLimit: 8000,
    visible: true,
  },
  [OpenAIModelID.GPT_4_TURBO]: {
      id: OpenAIModelID.GPT_4_TURBO,
      name: 'GPT-4-Turbo',
      maxLength: 24000,
      tokenLimit: 8000,
      visible: true,
  },
  [OpenAIModelID.GPT_3_5]: {
    id: OpenAIModelID.GPT_3_5,
    name: 'GPT-3.5',
    maxLength: 12000,
    tokenLimit: 4000,
    visible: true,
  },
  [OpenAIModelID.GPT_3_5_16K]: {
    id: OpenAIModelID.GPT_3_5_16K,
    name: 'GPT-3.5 16K',
    maxLength: 12000,
    tokenLimit: 16000,
    visible: true,
  },
  [OpenAIModelID.GPT_3_5_FN]: {
    id: OpenAIModelID.GPT_3_5_FN,
    name: 'GPT-3.5 Function Calling',
    maxLength: 12000,
    tokenLimit: 4000,
    visible: false,
  },
  [OpenAIModelID.GPT_3_5_AZ]: {
    id: OpenAIModelID.GPT_3_5_AZ,
    name: 'GPT-3.5 (Azure)',
    maxLength: 12000,
    tokenLimit: 4000,
    visible: false,
  },
  [OpenAIModelID.GPT_4]: {
    id: OpenAIModelID.GPT_4,
    name: 'GPT-4',
    maxLength: 24000,
    tokenLimit: 8000,
    visible: true,
  },
  [OpenAIModelID.GPT_4_FN]: {
    id: OpenAIModelID.GPT_4_FN,
    name: 'GPT-4 Function Calling',
    maxLength: 24000,
    tokenLimit: 8000,
    visible: false,
  },
  [OpenAIModelID.GPT_4_32K]: {
    id: OpenAIModelID.GPT_4_32K,
    name: 'GPT-4-32K',
    maxLength: 96000,
    tokenLimit: 32000,
    visible: false,
  },
};
