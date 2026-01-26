import { GoogleGenAI } from '@google/genai'
import { createLogger } from '@sim/logger'
import type { StreamingExecution } from '@/executor/types'
import { parseCustomGoogleModel } from '@/providers/custom-google/utils'
import { executeGeminiRequest } from '@/providers/gemini/core'
import { getProviderDefaultModel, getProviderModels } from '@/providers/models'
import type { ProviderConfig, ProviderRequest, ProviderResponse } from '@/providers/types'

const logger = createLogger('CustomGoogleProvider')
const CUSTOM_GOOGLE_VERSION = '1.0.0'

/**
 * Custom Google Gemini provider
 *
 * Uses the @google/genai SDK with custom baseURL support.
 * Enables connection to self-hosted or proxied Gemini-compatible endpoints.
 */
export const customGoogleProvider: ProviderConfig = {
  id: 'custom-google',
  name: 'Custom Google',
  description: 'Custom Google Gemini-compatible endpoints',
  version: CUSTOM_GOOGLE_VERSION,
  models: getProviderModels('custom-google'),
  defaultModel: getProviderDefaultModel('custom-google'),

  executeRequest: async (
    request: ProviderRequest
  ): Promise<ProviderResponse | StreamingExecution> => {
    const { endpointName, modelName } = parseCustomGoogleModel(request.model)

    logger.info('Preparing Custom Google request', {
      model: request.model,
      endpointName,
      modelName,
      hasSystemPrompt: !!request.systemPrompt,
      hasMessages: !!request.messages?.length,
      hasTools: !!request.tools?.length,
      toolCount: request.tools?.length || 0,
      stream: !!request.stream,
    })

    const baseUrl = request.customGoogleBaseUrl
    if (!baseUrl) {
      throw new Error(
        `Custom Google endpoint "${endpointName || 'unknown'}" not configured. Please configure the endpoint in workspace settings.`
      )
    }

    const apiKey = request.apiKey || 'empty'

    const httpOptions: { baseUrl: string; headers?: Record<string, string> } = {
      baseUrl,
    }

    if (request.customGoogleHeaders && Object.keys(request.customGoogleHeaders).length > 0) {
      httpOptions.headers = request.customGoogleHeaders
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions,
    })

    logger.info('Creating Custom Google client', { model: modelName, baseUrl })

    return executeGeminiRequest({
      ai,
      model: modelName,
      request: {
        ...request,
        model: modelName,
      },
      providerType: 'custom-google',
    })
  },
}

export { parseCustomGoogleModel } from '@/providers/custom-google/utils'
