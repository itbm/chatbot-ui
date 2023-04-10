import { OpenAIModel, OpenAIModelID, OpenAIModels } from '@/types/openai';
import { OPENAI_API_HOST, OPENAI_API_TYPE, OPENAI_API_VERSION, OPENAI_ORGANIZATION } from '@/utils/app/const';

export const config = {
  runtime: 'edge',
};

const findModels = async (key : string | undefined): Promise<OpenAIModel[]> => {

  let url = `${OPENAI_API_HOST}/v1/models`;
  if (OPENAI_API_TYPE === 'azure') {
    url = `${OPENAI_API_HOST}/openai/deployments?api-version=${OPENAI_API_VERSION}`;
  }

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

  if (response.status === 401) {
    throw new Error(await response.text()) ;
  } else if (response.status !== 200) {
    console.error(
      `OpenAI API returned an error ${
        response.status
      }: ${await response.text()}`,
    );
    throw new Error('OpenAI API returned an error');
  }

  const json = await response.json();

  const models: OpenAIModel[] = json.data
    .map((model: any) => {
      const modelId = OPENAI_API_TYPE === 'azure' ? model.model : model.id
      for (const [key, value] of Object.entries(OpenAIModelID)) {
        if (value === modelId) {
          return {
            id: modelId,
            name: OpenAIModels[modelId as OpenAIModelID].name,
            alias: model.id
          };
        }
      }
    })
    .filter(Boolean);

    return models ;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const { key } = (await req.json()) as {
      key: string;
    };

    const models = findModels(key) ;

    return new Response(JSON.stringify(models), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
};

export default handler;

export const findModelById = async (modelId: string) => {
  const models: OpenAIModel[] = await findModels(undefined) ;

  return models.find((model: OpenAIModel) => model.id == modelId) ;
}