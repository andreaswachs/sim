import { createLogger } from '@sim/logger'
import { getApiKeyWithBYOK } from '@/lib/api-key/byok'
import { getCostMultiplier } from '@/lib/core/config/feature-flags'
import { getCustomEndpointByName } from '@/lib/custom-llm/endpoints'
import type { StreamingExecution } from '@/executor/types'
import { parseCustomAnthropicModel } from '@/providers/custom-anthropic'
import { parseCustomGoogleModel } from '@/providers/custom-google'
import { parseCustomOpenAIModel } from '@/providers/custom-openai'
import { getProviderExecutor } from '@/providers/registry'
import type { ProviderId, ProviderRequest, ProviderResponse } from '@/providers/types'
import {
  calculateCost,
  generateStructuredOutputInstructions,
  shouldBillModelUsage,
  supportsTemperature,
} from '@/providers/utils'

const logger = createLogger('Providers')

/**
 * Maximum number of iterations for tool call loops to prevent infinite loops.
 * Used across all providers that support tool/function calling.
 */
export const MAX_TOOL_ITERATIONS = 20

function sanitizeRequest(request: ProviderRequest): ProviderRequest {
  const sanitizedRequest = { ...request }

  if (sanitizedRequest.model && !supportsTemperature(sanitizedRequest.model)) {
    sanitizedRequest.temperature = undefined
  }

  return sanitizedRequest
}

function isStreamingExecution(response: any): response is StreamingExecution {
  return response && typeof response === 'object' && 'stream' in response && 'execution' in response
}

function isReadableStream(response: any): response is ReadableStream {
  return response instanceof ReadableStream
}

export async function executeProviderRequest(
  providerId: string,
  request: ProviderRequest
): Promise<ProviderResponse | ReadableStream | StreamingExecution> {
  const provider = await getProviderExecutor(providerId as ProviderId)
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`)
  }

  if (!provider.executeRequest) {
    throw new Error(`Provider ${providerId} does not implement executeRequest`)
  }

  let resolvedRequest = sanitizeRequest(request)
  let isBYOK = false

  // Handle custom endpoint resolution
  if (providerId === 'custom-openai' && request.workspaceId) {
    const { endpointName } = parseCustomOpenAIModel(request.model)
    if (endpointName) {
      try {
        const endpointConfig = await getCustomEndpointByName(request.workspaceId, endpointName)
        if (!endpointConfig) {
          throw new Error(
            `Custom LLM endpoint "${endpointName}" not found. Please configure it in workspace settings.`
          )
        }
        resolvedRequest = {
          ...resolvedRequest,
          customOpenaiBaseUrl: endpointConfig.baseUrl,
          customOpenaiEndpointName: endpointConfig.name,
          customOpenaiHeaders: endpointConfig.headers || undefined,
          apiKey: endpointConfig.apiKey || 'empty',
        }
        logger.info(`Resolved custom-openai endpoint: ${endpointName}`, {
          baseUrl: endpointConfig.baseUrl,
          hasApiKey: !!endpointConfig.apiKey,
          headerCount: endpointConfig.headers ? Object.keys(endpointConfig.headers).length : 0,
        })
      } catch (error) {
        logger.error('Failed to resolve custom LLM endpoint:', {
          endpointName,
          workspaceId: request.workspaceId,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  } else if (providerId === 'custom-anthropic' && request.workspaceId) {
    const { endpointName } = parseCustomAnthropicModel(request.model)
    if (endpointName) {
      try {
        const endpointConfig = await getCustomEndpointByName(request.workspaceId, endpointName)
        if (!endpointConfig) {
          throw new Error(
            `Custom LLM endpoint "${endpointName}" not found. Please configure it in workspace settings.`
          )
        }
        resolvedRequest = {
          ...resolvedRequest,
          customAnthropicBaseUrl: endpointConfig.baseUrl,
          customAnthropicEndpointName: endpointConfig.name,
          customAnthropicHeaders: endpointConfig.headers || undefined,
          apiKey: endpointConfig.apiKey || 'empty',
        }
        logger.info(`Resolved custom-anthropic endpoint: ${endpointName}`, {
          baseUrl: endpointConfig.baseUrl,
          hasApiKey: !!endpointConfig.apiKey,
          headerCount: endpointConfig.headers ? Object.keys(endpointConfig.headers).length : 0,
        })
      } catch (error) {
        logger.error('Failed to resolve custom LLM endpoint:', {
          endpointName,
          workspaceId: request.workspaceId,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  } else if (providerId === 'custom-google' && request.workspaceId) {
    const { endpointName } = parseCustomGoogleModel(request.model)
    if (endpointName) {
      try {
        const endpointConfig = await getCustomEndpointByName(request.workspaceId, endpointName)
        if (!endpointConfig) {
          throw new Error(
            `Custom LLM endpoint "${endpointName}" not found. Please configure it in workspace settings.`
          )
        }
        resolvedRequest = {
          ...resolvedRequest,
          customGoogleBaseUrl: endpointConfig.baseUrl,
          customGoogleEndpointName: endpointConfig.name,
          customGoogleHeaders: endpointConfig.headers || undefined,
          apiKey: endpointConfig.apiKey || 'empty',
        }
        logger.info(`Resolved custom-google endpoint: ${endpointName}`, {
          baseUrl: endpointConfig.baseUrl,
          hasApiKey: !!endpointConfig.apiKey,
          headerCount: endpointConfig.headers ? Object.keys(endpointConfig.headers).length : 0,
        })
      } catch (error) {
        logger.error('Failed to resolve custom LLM endpoint:', {
          endpointName,
          workspaceId: request.workspaceId,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    }
  } else if (request.workspaceId) {
    try {
      const result = await getApiKeyWithBYOK(
        providerId,
        request.model,
        request.workspaceId,
        request.apiKey
      )
      resolvedRequest = { ...resolvedRequest, apiKey: result.apiKey }
      isBYOK = result.isBYOK
    } catch (error) {
      logger.error('Failed to resolve API key:', {
        provider: providerId,
        model: request.model,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  resolvedRequest.isBYOK = isBYOK
  const sanitizedRequest = resolvedRequest

  if (sanitizedRequest.responseFormat) {
    if (
      typeof sanitizedRequest.responseFormat === 'string' &&
      sanitizedRequest.responseFormat === ''
    ) {
      logger.info('Empty response format provided, ignoring it')
      sanitizedRequest.responseFormat = undefined
    } else {
      const structuredOutputInstructions = generateStructuredOutputInstructions(
        sanitizedRequest.responseFormat
      )

      if (structuredOutputInstructions.trim()) {
        const originalPrompt = sanitizedRequest.systemPrompt || ''
        sanitizedRequest.systemPrompt =
          `${originalPrompt}\n\n${structuredOutputInstructions}`.trim()

        logger.info('Added structured output instructions to system prompt')
      }
    }
  }

  const response = await provider.executeRequest(sanitizedRequest)

  if (isStreamingExecution(response)) {
    logger.info('Provider returned StreamingExecution')
    return response
  }

  if (isReadableStream(response)) {
    logger.info('Provider returned ReadableStream')
    return response
  }

  if (response.tokens) {
    const { input: promptTokens = 0, output: completionTokens = 0 } = response.tokens
    const useCachedInput = !!request.context && request.context.length > 0

    const shouldBill = shouldBillModelUsage(response.model) && !isBYOK
    if (shouldBill) {
      const costMultiplier = getCostMultiplier()
      response.cost = calculateCost(
        response.model,
        promptTokens,
        completionTokens,
        useCachedInput,
        costMultiplier,
        costMultiplier
      )
    } else {
      response.cost = {
        input: 0,
        output: 0,
        total: 0,
        pricing: {
          input: 0,
          output: 0,
          updatedAt: new Date().toISOString(),
        },
      }
      if (isBYOK) {
        logger.debug(`Not billing model usage for ${response.model} - workspace BYOK key used`)
      } else {
        logger.debug(
          `Not billing model usage for ${response.model} - user provided API key or not hosted model`
        )
      }
    }
  }

  return response
}
