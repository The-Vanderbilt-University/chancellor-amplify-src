import {
  AZURE_API_NAME,
  OPENAI_API_HOST,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
  AVAILABLE_MODELS,
} from '@/utils/app/const';

import { OpenAIModel, OpenAIModelID, OpenAIModels } from '@/types/openai';

export const config = {
  runtime: 'edge',
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { key } = (await req.json()) as {
      key: string;
    };

    let url = `${OPENAI_API_HOST}/v1/models`;
    if (OPENAI_API_TYPE === 'azure') {
      url = `${OPENAI_API_HOST}/${AZURE_API_NAME}/models?api-version=${OPENAI_API_VERSION}`;
    }

    //console.log("URL: " + url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(OPENAI_API_TYPE === 'openai' && {
          Authorization: `Bearer ${key ? key : process.env.OPENAI_API_KEY}`
        }),
        ...(OPENAI_API_TYPE === 'azure' && {
          'api-key': `${key ? key : process.env.OPENAI_API_KEY}`
        }),
        ...((OPENAI_API_TYPE === 'openai' && OPENAI_ORGANIZATION) && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
      },
    });

    //console.log("RESPONSE: " + response.status, response.headers);

    if (response.status === 401) {
      return new Response(response.body, {
        status: 500,
        headers: response.headers,
      });
    } else if (response.status !== 200) {
      console.error(
        `OpenAI API returned an error ${
          response.status
        }: ${await response.text()}`,
      );
      throw new Error('OpenAI API returned an error');
    }

    const json = await response.json();

    //const modelIds = Object.keys(OpenAIModels)

    // const result = json.data.filter(model => modelIds.includes(model.id))
    //     .map(model => ({
    //       id: model.id,
    //       name: OpenAIModels[model.id].name,
    //       maxLength: OpenAIModels[model.id].maxLength,
    //       tokenLimit: OpenAIModels[model.id].tokenLimit,
    //     }))

    const modelIds = AVAILABLE_MODELS.split(',');

    const models: OpenAIModel[] = json.data
      .map((model: any) => {
        const model_name = model.id; //(OPENAI_API_TYPE === 'azure') ? model.model : model.id;
        for (const [key, value] of Object.entries(OpenAIModelID)) {
          if (value === model_name && modelIds.includes(model.id)) {
            return {
              id: model.id,
              name: OpenAIModels[value].name,
              maxLength: OpenAIModels[value].maxLength,
              tokenLimit: OpenAIModels[value].tokenLimit,
            };
          }
        }
      })
      .filter(Boolean);

    //console.log(models);

    return new Response(JSON.stringify(models), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
};

export default handler;
