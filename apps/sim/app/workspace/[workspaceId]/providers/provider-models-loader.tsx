'use client'

import { useEffect } from 'react'
import { createLogger } from '@sim/logger'
import { useParams } from 'next/navigation'
import { useCustomLlmEndpoints } from '@/hooks/queries/custom-llm-endpoints'
import { useProviderModels } from '@/hooks/queries/providers'
import {
  updateOllamaProviderModels,
  updateOpenRouterProviderModels,
  updateVLLMProviderModels,
} from '@/providers/utils'
import { type ProviderName, useProvidersStore } from '@/stores/providers'

const logger = createLogger('ProviderModelsLoader')

type FetchableProvider = Exclude<ProviderName, 'custom-openai' | 'custom-anthropic' | 'custom-google'>

function useSyncProvider(provider: FetchableProvider) {
  const setProviderModels = useProvidersStore((state) => state.setProviderModels)
  const setProviderLoading = useProvidersStore((state) => state.setProviderLoading)
  const setOpenRouterModelInfo = useProvidersStore((state) => state.setOpenRouterModelInfo)
  const { data, isLoading, isFetching, error } = useProviderModels(provider)

  useEffect(() => {
    setProviderLoading(provider, isLoading || isFetching)
  }, [provider, isLoading, isFetching, setProviderLoading])

  useEffect(() => {
    if (!data) return

    try {
      if (provider === 'ollama') {
        updateOllamaProviderModels(data.models)
      } else if (provider === 'vllm') {
        updateVLLMProviderModels(data.models)
      } else if (provider === 'openrouter') {
        void updateOpenRouterProviderModels(data.models)
        if (data.modelInfo) {
          setOpenRouterModelInfo(data.modelInfo)
        }
      }
    } catch (syncError) {
      logger.warn(`Failed to sync provider definitions for ${provider}`, syncError as Error)
    }

    setProviderModels(provider, data.models)
  }, [provider, data, setProviderModels, setOpenRouterModelInfo])

  useEffect(() => {
    if (error) {
      logger.error(`Failed to load ${provider} models`, error)
    }
  }, [provider, error])
}

function useSyncCustomEndpoints() {
  const params = useParams()
  const workspaceId = params?.workspaceId as string | undefined
  const setProviderModels = useProvidersStore((state) => state.setProviderModels)
  const setProviderLoading = useProvidersStore((state) => state.setProviderLoading)
  const { data, isLoading, isFetching, error } = useCustomLlmEndpoints(workspaceId ?? '')

  useEffect(() => {
    const loading = isLoading || isFetching
    setProviderLoading('custom-openai', loading)
    setProviderLoading('custom-anthropic', loading)
    setProviderLoading('custom-google', loading)
  }, [isLoading, isFetching, setProviderLoading])

  useEffect(() => {
    if (!data?.endpoints) return

    // Group endpoints by API type and format as model options
    const openaiEndpoints = data.endpoints
      .filter((e) => !e.apiType || e.apiType === 'openai')
      .map((endpoint) => `custom-openai:${endpoint.name}/`)

    const anthropicEndpoints = data.endpoints
      .filter((e) => e.apiType === 'anthropic')
      .map((endpoint) => `custom-anthropic:${endpoint.name}/`)

    const googleEndpoints = data.endpoints
      .filter((e) => e.apiType === 'google')
      .map((endpoint) => `custom-google:${endpoint.name}/`)

    setProviderModels('custom-openai', openaiEndpoints)
    setProviderModels('custom-anthropic', anthropicEndpoints)
    setProviderModels('custom-google', googleEndpoints)

    logger.info('Synced custom LLM endpoints', {
      openai: openaiEndpoints.length,
      anthropic: anthropicEndpoints.length,
      google: googleEndpoints.length,
    })
  }, [data, setProviderModels])

  useEffect(() => {
    if (error) {
      logger.error('Failed to load custom LLM endpoints', error)
    }
  }, [error])
}

export function ProviderModelsLoader() {
  useSyncProvider('base')
  useSyncProvider('ollama')
  useSyncProvider('vllm')
  useSyncProvider('openrouter')
  useSyncCustomEndpoints()
  return null
}
