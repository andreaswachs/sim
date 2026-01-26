import { createLogger } from '@sim/logger'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_ENDPOINTS } from '@/stores/constants'

const logger = createLogger('CustomLlmEndpointsQueries')

export type CustomLlmApiType = 'openai' | 'anthropic' | 'google'

export interface CustomLlmEndpoint {
  id: string
  workspaceId: string
  name: string
  baseUrl: string
  apiType: CustomLlmApiType
  hasApiKey: boolean
  headerNames: string[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomLlmEndpointsResponse {
  endpoints: CustomLlmEndpoint[]
}

export const customLlmEndpointsKeys = {
  all: ['custom-llm-endpoints'] as const,
  workspace: (workspaceId: string) =>
    [...customLlmEndpointsKeys.all, 'workspace', workspaceId] as const,
  endpoint: (workspaceId: string, endpointId: string) =>
    [...customLlmEndpointsKeys.workspace(workspaceId), endpointId] as const,
}

async function fetchCustomLlmEndpoints(workspaceId: string): Promise<CustomLlmEndpointsResponse> {
  const response = await fetch(API_ENDPOINTS.WORKSPACE_CUSTOM_LLM_ENDPOINTS(workspaceId))
  if (!response.ok) {
    throw new Error(`Failed to load custom LLM endpoints: ${response.statusText}`)
  }
  const data = await response.json()
  return {
    endpoints: data.endpoints ?? [],
  }
}

export function useCustomLlmEndpoints(workspaceId: string) {
  return useQuery({
    queryKey: customLlmEndpointsKeys.workspace(workspaceId),
    queryFn: () => fetchCustomLlmEndpoints(workspaceId),
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    select: (data) => data,
  })
}

interface CreateCustomLlmEndpointParams {
  workspaceId: string
  name: string
  baseUrl: string
  apiType?: CustomLlmApiType
  apiKey?: string
  headers?: Record<string, string>
}

export function useCreateCustomLlmEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      baseUrl,
      apiType,
      apiKey,
      headers,
    }: CreateCustomLlmEndpointParams) => {
      const response = await fetch(API_ENDPOINTS.WORKSPACE_CUSTOM_LLM_ENDPOINTS(workspaceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, baseUrl, apiType, apiKey, headers }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.error || `Failed to create custom LLM endpoint: ${response.statusText}`
        )
      }

      logger.info(`Created custom LLM endpoint "${name}" in workspace ${workspaceId}`)
      return await response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customLlmEndpointsKeys.workspace(variables.workspaceId),
      })
    },
  })
}

interface UpdateCustomLlmEndpointParams {
  workspaceId: string
  endpointId: string
  name?: string
  baseUrl?: string
  apiKey?: string | null
  headers?: Record<string, string> | null
}

export function useUpdateCustomLlmEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      workspaceId,
      endpointId,
      name,
      baseUrl,
      apiKey,
      headers,
    }: UpdateCustomLlmEndpointParams) => {
      const response = await fetch(
        `${API_ENDPOINTS.WORKSPACE_CUSTOM_LLM_ENDPOINTS(workspaceId)}/${endpointId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, baseUrl, apiKey, headers }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.error || `Failed to update custom LLM endpoint: ${response.statusText}`
        )
      }

      logger.info(`Updated custom LLM endpoint ${endpointId}`)
      return await response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customLlmEndpointsKeys.workspace(variables.workspaceId),
      })
    },
  })
}

interface DeleteCustomLlmEndpointParams {
  workspaceId: string
  endpointId: string
}

export function useDeleteCustomLlmEndpoint() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workspaceId, endpointId }: DeleteCustomLlmEndpointParams) => {
      const response = await fetch(
        `${API_ENDPOINTS.WORKSPACE_CUSTOM_LLM_ENDPOINTS(workspaceId)}/${endpointId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.error || `Failed to delete custom LLM endpoint: ${response.statusText}`
        )
      }

      logger.info(`Deleted custom LLM endpoint ${endpointId}`)
      return await response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: customLlmEndpointsKeys.workspace(variables.workspaceId),
      })
    },
  })
}
