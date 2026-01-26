import { createLogger } from '@sim/logger'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { generateRequestId } from '@/lib/core/utils/request'
import {
  deleteCustomEndpoint,
  getCustomEndpointById,
  isEndpointNameAvailable,
  updateCustomEndpoint,
} from '@/lib/custom-llm/endpoints'
import { getUserEntityPermissions } from '@/lib/workspaces/permissions/utils'

const logger = createLogger('CustomLlmEndpointAPI')

const UpdateEndpointSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name must contain only letters, numbers, underscores, and hyphens')
    .optional(),
  baseUrl: z.string().url('Base URL must be a valid URL').optional(),
  apiKey: z.string().nullable().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  const requestId = generateRequestId()
  const { id: workspaceId, endpointId } = await params

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized custom LLM endpoint access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const permission = await getUserEntityPermissions(userId, 'workspace', workspaceId)
    if (!permission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const endpoint = await getCustomEndpointById(endpointId)

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    // Verify endpoint belongs to this workspace
    if (endpoint.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    // Return endpoint without credentials (just indicate if API key/headers exist)
    return NextResponse.json({
      endpoint: {
        id: endpoint.id,
        workspaceId: endpoint.workspaceId,
        name: endpoint.name,
        baseUrl: endpoint.baseUrl,
        apiType: endpoint.apiType,
        hasApiKey: !!endpoint.apiKey,
        headerNames: endpoint.headers ? Object.keys(endpoint.headers) : [],
        createdBy: endpoint.createdBy,
        createdAt: endpoint.createdAt,
        updatedAt: endpoint.updatedAt,
      },
    })
  } catch (error: unknown) {
    logger.error(`[${requestId}] Custom LLM endpoint GET error`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load custom LLM endpoint' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  const requestId = generateRequestId()
  const { id: workspaceId, endpointId } = await params

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized custom LLM endpoint update attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const permission = await getUserEntityPermissions(userId, 'workspace', workspaceId)
    if (permission !== 'admin') {
      return NextResponse.json(
        { error: 'Only workspace admins can manage custom LLM endpoints' },
        { status: 403 }
      )
    }

    // Verify endpoint exists and belongs to workspace
    const existingEndpoint = await getCustomEndpointById(endpointId)
    if (!existingEndpoint || existingEndpoint.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, baseUrl, apiKey, headers } = UpdateEndpointSchema.parse(body)

    // If name is being changed, check availability
    if (name && name !== existingEndpoint.name) {
      const isAvailable = await isEndpointNameAvailable(workspaceId, name, endpointId)
      if (!isAvailable) {
        return NextResponse.json(
          { error: `An endpoint with the name "${name}" already exists in this workspace` },
          { status: 409 }
        )
      }
    }

    const endpoint = await updateCustomEndpoint(endpointId, {
      name,
      baseUrl,
      apiKey,
      headers,
    })

    logger.info(`[${requestId}] Updated custom LLM endpoint ${endpointId}`)

    return NextResponse.json({ success: true, endpoint })
  } catch (error: unknown) {
    logger.error(`[${requestId}] Custom LLM endpoint PATCH error`, error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update custom LLM endpoint' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; endpointId: string }> }
) {
  const requestId = generateRequestId()
  const { id: workspaceId, endpointId } = await params

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized custom LLM endpoint deletion attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const permission = await getUserEntityPermissions(userId, 'workspace', workspaceId)
    if (permission !== 'admin') {
      return NextResponse.json(
        { error: 'Only workspace admins can manage custom LLM endpoints' },
        { status: 403 }
      )
    }

    // Verify endpoint exists and belongs to workspace
    const existingEndpoint = await getCustomEndpointById(endpointId)
    if (!existingEndpoint || existingEndpoint.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
    }

    await deleteCustomEndpoint(endpointId)

    logger.info(`[${requestId}] Deleted custom LLM endpoint ${endpointId}`)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    logger.error(`[${requestId}] Custom LLM endpoint DELETE error`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete custom LLM endpoint' },
      { status: 500 }
    )
  }
}
