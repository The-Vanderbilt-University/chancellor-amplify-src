import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import { OpenAIError, OpenAIStream } from '@/utils/server';
import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0'
import { ChatBody, Message } from '@/types/chat';

// @ts-expect-error
import wasm from '../../node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm?module';

import tiktokenModel from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken, init } from '@dqbd/tiktoken/lite/init';

export const config = {
  runtime: 'edge',
};

const handler = async (req: Request): Promise<Response> => {
  try {

    console.log("Chat request received",
    //current time
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    const { model, messages, key, prompt, temperature, functions, function_call } = (await req.json()) as ChatBody;

    console.log("Chat request unmarshalled",
        `Model Id: ${model.id}, Temperature: ${temperature}`,
        //current time
        new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    await init((imports) => WebAssembly.instantiate(wasm, imports));
    const encoding = new Tiktoken(
      tiktokenModel.bpe_ranks,
      tiktokenModel.special_tokens,
      tiktokenModel.pat_str,
    );

    let promptToSend = prompt;
    if (!promptToSend) {
      promptToSend = DEFAULT_SYSTEM_PROMPT;
    }

    let temperatureToUse = temperature;
    if (temperatureToUse == null) {
      temperatureToUse = DEFAULT_TEMPERATURE;
    }

    const prompt_tokens = encoding.encode(promptToSend);

    let tokenCount = prompt_tokens.length;
    let messagesToSend: Message[] = [];

    var maxTokens = model.tokenLimit;
    if (typeof maxTokens === "undefined") {
      //console.log("Token Limit is undefined, setting to 8192");
      maxTokens = 4000
    }

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = encoding.encode(message.content);

      if (tokenCount + tokens.length + 1200 > maxTokens) {
        break;
      }
      tokenCount += tokens.length;
      messagesToSend = [message, ...messagesToSend];
    }

    //console.log("Sending: "+ tokenCount + " [max: " + maxTokens +"]")

    encoding.free();

    console.log("Chat request built",
        `Token Count: ${tokenCount}`,
        //current time
        new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));

    const stream = await OpenAIStream(model, promptToSend, temperatureToUse, key, messagesToSend, functions, function_call);

    return new Response(stream);
  } catch (error) {
    console.error(error);
    if (error instanceof OpenAIError) {
      return new Response('Error', { status: 500, statusText: error.message });
    } else {
      return new Response('Error', { status: 500 });
    }
  }
};

export default handler;
