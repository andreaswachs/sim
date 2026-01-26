import { createLogger } from '@sim/logger'
import { nanoid } from 'nanoid'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { generateRequestId } from '@/lib/core/utils/request'
import {
  createCustomEndpoint,
  getCustomEndpoints,
  isEndpointNameAvailable,
} from '@/lib/custom-llm/endpoints'
import { getUserEntityPermissions, getWorkspaceById } from '@/lib/workspaces/permissions/utils'

const logger = createLogger('CustomLlmEndpointsAPI')

const CreateEndpointSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Name must contain only letters, numbers, underscores, and hyphens'),
  baseUrl: z.string().url('Base URL must be a valid URL'),
  apiType: z.enum(['openai', 'anthropic', 'google']).default('openai'),
  apiKey: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  const workspaceId = (await params).id

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized custom LLM endpoints access attempt`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const ws = await getWorkspaceById(workspaceId)
    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const permission = await getUserEntityPermissions(userId, 'workspace', workspaceId)
    if (!permission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const endpoints = await getCustomEndpoints(workspaceId)

    return NextResponse.json({ endpoints })
  } catch (error: unknown) {
    logger.error(`[${requestId}] Custom LLM endpoints GET error`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load custom LLM endpoints' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  const workspaceId = (await params).id

  try {
    const session = await getSession()
    if (!session?.user?.id) {
      logger.warn(`[${requestId}] Unauthorized custom LLM endpoint creation attempt`)
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

    const body = await request.json()
    const { name, baseUrl, apiType, apiKey, headers } = CreateEndpointSchema.parse(body)

    // Check if name is available
    const isAvailable = await isEndpointNameAvailable(workspaceId, name)
    if (!isAvailable) {
      return NextResponse.json(
        { error: `An endpoint with the name "${name}" already exists in this workspace` },
        { status: 409 }
      )
    }

    const endpoint = await createCustomEndpoint({
      id: nanoid(),
      workspaceId,
      name,
      baseUrl,
      apiType,
      apiKey,
      headers,
      createdBy: userId,
    })

    logger.info(`[${requestId}] Created custom LLM endpoint "${name}" in workspace ${workspaceId}`)

    return NextResponse.json({ success: true, endpoint })
  } catch (error: unknown) {
    logger.error(`[${requestId}] Custom LLM endpoint POST error`, error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create custom LLM endpoint' },
      { status: 500 }
    )
  }
}
