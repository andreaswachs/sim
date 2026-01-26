import { db } from '@sim/db'
import { customLlmEndpoints } from '@sim/db/schema'
import { createLogger } from '@sim/logger'
import { and, eq } from 'drizzle-orm'
import { decryptSecret, encryptSecret } from '@/lib/core/security/encryption'
import type { CustomLlmApiType } from '@/providers/types'

const logger = createLogger('CustomLlmEndpoints')

export interface CustomLlmEndpoint {
  id: string
  workspaceId: string
  name: string
  baseUrl: string
  apiType: CustomLlmApiType
  hasApiKey: boolean
  headerNames: string[]
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomLlmEndpointWithCredentials {
  id: string
  workspaceId: string
  name: string
  baseUrl: string
  apiType: CustomLlmApiType
  apiKey: string | null
  headers: Record<string, string> | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Get all custom LLM endpoints for a workspace (without decrypted credentials)
 */
export async function getCustomEndpoints(workspaceId: string): Promise<CustomLlmEndpoint[]> {
  try {
    const endpoints = await db
      .select({
        id: customLlmEndpoints.id,
        workspaceId: customLlmEndpoints.workspaceId,
        name: customLlmEndpoints.name,
        baseUrl: customLlmEndpoints.baseUrl,
        apiType: customLlmEndpoints.apiType,
        encryptedApiKey: customLlmEndpoints.encryptedApiKey,
        encryptedHeaders: customLlmEndpoints.encryptedHeaders,
        createdBy: customLlmEndpoints.createdBy,
        createdAt: customLlmEndpoints.createdAt,
        updatedAt: customLlmEndpoints.updatedAt,
      })
      .from(customLlmEndpoints)
      .where(eq(customLlmEndpoints.workspaceId, workspaceId))
      .orderBy(customLlmEndpoints.name)

    const results: CustomLlmEndpoint[] = []

    for (const endpoint of endpoints) {
      let headerNames: string[] = []

      if (endpoint.encryptedHeaders) {
        try {
          const { decrypted } = await decryptSecret(endpoint.encryptedHeaders)
          const headers = JSON.parse(decrypted) as Record<string, string>
          headerNames = Object.keys(headers)
        } catch (decryptError) {
          logger.error('Failed to decrypt headers for endpoint', {
            endpointId: endpoint.id,
            workspaceId,
            error: decryptError,
          })
        }
      }

      results.push({
        id: endpoint.id,
        workspaceId: endpoint.workspaceId,
        name: endpoint.name,
        baseUrl: endpoint.baseUrl,
        apiType: (endpoint.apiType || 'openai') as CustomLlmApiType,
        hasApiKey: !!endpoint.encryptedApiKey,
        headerNames,
        createdBy: endpoint.createdBy,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt,
      })
    }

    return results
  } catch (error) {
    logger.error('Failed to get custom endpoints', { workspaceId, error })
    throw error
  }
}

/**
 * Get a single custom LLM endpoint by name with decrypted credentials
 * Used for executing requests
 */
export async function getCustomEndpointByName(
  workspaceId: string,
  endpointName: string
): Promise<CustomLlmEndpointWithCredentials | null> {
  try {
    const result = await db
      .select()
      .from(customLlmEndpoints)
      .where(
        and(
          eq(customLlmEndpoints.workspaceId, workspaceId),
          eq(customLlmEndpoints.name, endpointName)
        )
      )
      .limit(1)

    if (!result.length) {
      return null
    }

    const endpoint = result[0]
    let apiKey: string | null = null
    let headers: Record<string, string> | null = null

    if (endpoint.encryptedApiKey) {
      try {
        const { decrypted } = await decryptSecret(endpoint.encryptedApiKey)
        apiKey = decrypted
      } catch (decryptError) {
        logger.error('Failed to decrypt API key for endpoint', {
          endpointName,
          workspaceId,
          error: decryptError,
        })
      }
    }

    if (endpoint.encryptedHeaders) {
      try {
        const { decrypted } = await decryptSecret(endpoint.encryptedHeaders)
        headers = JSON.parse(decrypted) as Record<string, string>
      } catch (decryptError) {
        logger.error('Failed to decrypt headers for endpoint', {
          endpointName,
          workspaceId,
          error: decryptError,
        })
      }
    }

    return {
      id: endpoint.id,
      workspaceId: endpoint.workspaceId,
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      apiType: (endpoint.apiType || 'openai') as CustomLlmApiType,
      apiKey,
      headers,
      createdBy: endpoint.createdBy,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    }
  } catch (error) {
    logger.error('Failed to get custom endpoint by name', { workspaceId, endpointName, error })
    throw error
  }
}

/**
 * Get a single custom LLM endpoint by ID with decrypted credentials
 */
export async function getCustomEndpointById(
  endpointId: string
): Promise<CustomLlmEndpointWithCredentials | null> {
  try {
    const result = await db
      .select()
      .from(customLlmEndpoints)
      .where(eq(customLlmEndpoints.id, endpointId))
      .limit(1)

    if (!result.length) {
      return null
    }

    const endpoint = result[0]
    let apiKey: string | null = null
    let headers: Record<string, string> | null = null

    if (endpoint.encryptedApiKey) {
      try {
        const { decrypted } = await decryptSecret(endpoint.encryptedApiKey)
        apiKey = decrypted
      } catch (decryptError) {
        logger.error('Failed to decrypt API key for endpoint', {
          endpointId,
          error: decryptError,
        })
      }
    }

    if (endpoint.encryptedHeaders) {
      try {
        const { decrypted } = await decryptSecret(endpoint.encryptedHeaders)
        headers = JSON.parse(decrypted) as Record<string, string>
      } catch (decryptError) {
        logger.error('Failed to decrypt headers for endpoint', {
          endpointId,
          error: decryptError,
        })
      }
    }

    return {
      id: endpoint.id,
      workspaceId: endpoint.workspaceId,
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      apiType: (endpoint.apiType || 'openai') as CustomLlmApiType,
      apiKey,
      headers,
      createdBy: endpoint.createdBy,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    }
  } catch (error) {
    logger.error('Failed to get custom endpoint by ID', { endpointId, error })
    throw error
  }
}

export interface CreateCustomEndpointParams {
  id: string
  workspaceId: string
  name: string
  baseUrl: string
  apiType?: CustomLlmApiType
  apiKey?: string
  headers?: Record<string, string>
  createdBy: string
}

/**
 * Create a new custom LLM endpoint
 */
export async function createCustomEndpoint(
  params: CreateCustomEndpointParams
): Promise<CustomLlmEndpoint> {
  try {
    let encryptedApiKey: string | null = null
    if (params.apiKey) {
      const { encrypted } = await encryptSecret(params.apiKey)
      encryptedApiKey = encrypted
    }

    let encryptedHeaders: string | null = null
    let headerNames: string[] = []
    if (params.headers && Object.keys(params.headers).length > 0) {
      const { encrypted } = await encryptSecret(JSON.stringify(params.headers))
      encryptedHeaders = encrypted
      headerNames = Object.keys(params.headers)
    }

    const [newEndpoint] = await db
      .insert(customLlmEndpoints)
      .values({
        id: params.id,
        workspaceId: params.workspaceId,
        name: params.name,
        baseUrl: params.baseUrl,
        apiType: params.apiType || 'openai',
        encryptedApiKey,
        encryptedHeaders,
        createdBy: params.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    logger.info('Created custom LLM endpoint', {
      endpointId: newEndpoint.id,
      name: newEndpoint.name,
      workspaceId: newEndpoint.workspaceId,
      apiType: newEndpoint.apiType,
      headerCount: headerNames.length,
    })

    return {
      id: newEndpoint.id,
      workspaceId: newEndpoint.workspaceId,
      name: newEndpoint.name,
      baseUrl: newEndpoint.baseUrl,
      apiType: (newEndpoint.apiType || 'openai') as CustomLlmApiType,
      hasApiKey: !!encryptedApiKey,
      headerNames,
      createdBy: newEndpoint.createdBy,
      createdAt: newEndpoint.createdAt,
      updatedAt: newEndpoint.updatedAt,
    }
  } catch (error) {
    logger.error('Failed to create custom endpoint', { params, error })
    throw error
  }
}

export interface UpdateCustomEndpointParams {
  name?: string
  baseUrl?: string
  apiKey?: string | null // null means remove the API key
  headers?: Record<string, string> | null // null means remove all headers
}

/**
 * Update an existing custom LLM endpoint
 */
export async function updateCustomEndpoint(
  endpointId: string,
  params: UpdateCustomEndpointParams
): Promise<CustomLlmEndpoint> {
  try {
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    }

    if (params.name !== undefined) {
      updates.name = params.name
    }

    if (params.baseUrl !== undefined) {
      updates.baseUrl = params.baseUrl
    }

    if (params.apiKey !== undefined) {
      if (params.apiKey === null) {
        updates.encryptedApiKey = null
      } else {
        const { encrypted } = await encryptSecret(params.apiKey)
        updates.encryptedApiKey = encrypted
      }
    }

    let headerNames: string[] | undefined
    if (params.headers !== undefined) {
      if (params.headers === null) {
        updates.encryptedHeaders = null
        headerNames = []
      } else if (Object.keys(params.headers).length > 0) {
        const { encrypted } = await encryptSecret(JSON.stringify(params.headers))
        updates.encryptedHeaders = encrypted
        headerNames = Object.keys(params.headers)
      } else {
        updates.encryptedHeaders = null
        headerNames = []
      }
    }

    const [updatedEndpoint] = await db
      .update(customLlmEndpoints)
      .set(updates)
      .where(eq(customLlmEndpoints.id, endpointId))
      .returning()

    if (!updatedEndpoint) {
      throw new Error(`Endpoint with ID ${endpointId} not found`)
    }

    // If headers weren't updated, we need to get the existing header names
    if (headerNames === undefined && updatedEndpoint.encryptedHeaders) {
      try {
        const { decrypted } = await decryptSecret(updatedEndpoint.encryptedHeaders)
        const headers = JSON.parse(decrypted) as Record<string, string>
        headerNames = Object.keys(headers)
      } catch (decryptError) {
        logger.error('Failed to decrypt headers for updated endpoint', {
          endpointId,
          error: decryptError,
        })
        headerNames = []
      }
    }

    logger.info('Updated custom LLM endpoint', {
      endpointId: updatedEndpoint.id,
      name: updatedEndpoint.name,
      headerCount: headerNames?.length ?? 0,
    })

    return {
      id: updatedEndpoint.id,
      workspaceId: updatedEndpoint.workspaceId,
      name: updatedEndpoint.name,
      baseUrl: updatedEndpoint.baseUrl,
      apiType: (updatedEndpoint.apiType || 'openai') as CustomLlmApiType,
      hasApiKey: !!updatedEndpoint.encryptedApiKey,
      headerNames: headerNames ?? [],
      createdBy: updatedEndpoint.createdBy,
      createdAt: updatedEndpoint.createdAt,
      updatedAt: updatedEndpoint.updatedAt,
    }
  } catch (error) {
    logger.error('Failed to update custom endpoint', { endpointId, params, error })
    throw error
  }
}

/**
 * Delete a custom LLM endpoint
 */
export async function deleteCustomEndpoint(endpointId: string): Promise<void> {
  try {
    await db.delete(customLlmEndpoints).where(eq(customLlmEndpoints.id, endpointId))

    logger.info('Deleted custom LLM endpoint', { endpointId })
  } catch (error) {
    logger.error('Failed to delete custom endpoint', { endpointId, error })
    throw error
  }
}

/**
 * Check if an endpoint name is available in a workspace
 */
export async function isEndpointNameAvailable(
  workspaceId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  try {
    const result = await db
      .select({ id: customLlmEndpoints.id })
      .from(customLlmEndpoints)
      .where(
        and(eq(customLlmEndpoints.workspaceId, workspaceId), eq(customLlmEndpoints.name, name))
      )
      .limit(1)

    if (!result.length) {
      return true
    }

    // If we're excluding an ID (for update), check if it's the same endpoint
    if (excludeId && result[0].id === excludeId) {
      return true
    }

    return false
  } catch (error) {
    logger.error('Failed to check endpoint name availability', { workspaceId, name, error })
    throw error
  }
}
