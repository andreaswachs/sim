'use client'

import { useState } from 'react'
import { createLogger } from '@sim/logger'
import { Eye, EyeOff, Pencil, Plus, Server, Trash2, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import {
  Button,
  Input as EmcnInput,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@/components/emcn'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/ui'
import {
  type CustomLlmApiType,
  type CustomLlmEndpoint,
  useCreateCustomLlmEndpoint,
  useCustomLlmEndpoints,
  useDeleteCustomLlmEndpoint,
  useUpdateCustomLlmEndpoint,
} from '@/hooks/queries/custom-llm-endpoints'

const logger = createLogger('CustomLlmSettings')

const API_TYPE_OPTIONS = [
  { value: 'openai', label: 'OpenAI Compatible', modelPrefix: 'custom-openai' },
  { value: 'anthropic', label: 'Anthropic Compatible', modelPrefix: 'custom-anthropic' },
  { value: 'google', label: 'Google Gemini Compatible', modelPrefix: 'custom-google' },
] as const

interface HeaderEntry {
  key: string
  value: string
}

function EndpointSkeleton() {
  return (
    <div className='flex items-center justify-between gap-[12px]'>
      <div className='flex items-center gap-[12px]'>
        <Skeleton className='h-9 w-9 flex-shrink-0 rounded-[6px]' />
        <div className='flex min-w-0 flex-col justify-center gap-[1px]'>
          <Skeleton className='h-[14px] w-[120px]' />
          <Skeleton className='h-[13px] w-[200px]' />
        </div>
      </div>
      <Skeleton className='h-[32px] w-[72px] rounded-[6px]' />
    </div>
  )
}

interface EndpointFormData {
  name: string
  baseUrl: string
  apiType: CustomLlmApiType
  apiKey: string
  headers: HeaderEntry[]
}

export function CustomLlm() {
  const params = useParams()
  const workspaceId = (params?.workspaceId as string) || ''

  const { data, isLoading } = useCustomLlmEndpoints(workspaceId)
  const endpoints = data?.endpoints ?? []
  const createEndpoint = useCreateCustomLlmEndpoint()
  const updateEndpoint = useUpdateCustomLlmEndpoint()
  const deleteEndpoint = useDeleteCustomLlmEndpoint()

  const [editingEndpoint, setEditingEndpoint] = useState<CustomLlmEndpoint | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<EndpointFormData>({
    name: '',
    baseUrl: '',
    apiType: 'openai',
    apiKey: '',
    headers: [],
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [showHeaderValues, setShowHeaderValues] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const [deleteConfirmEndpoint, setDeleteConfirmEndpoint] = useState<CustomLlmEndpoint | null>(null)

  const isEditing = !!editingEndpoint
  const isModalOpen = isCreating || isEditing

  const handleOpenCreate = () => {
    setIsCreating(true)
    setEditingEndpoint(null)
    setFormData({ name: '', baseUrl: '', apiType: 'openai', apiKey: '', headers: [] })
    setShowApiKey(false)
    setShowHeaderValues({})
    setError(null)
  }

  const handleOpenEdit = (endpoint: CustomLlmEndpoint) => {
    setIsCreating(false)
    setEditingEndpoint(endpoint)
    setFormData({
      name: endpoint.name,
      baseUrl: endpoint.baseUrl,
      apiType: endpoint.apiType || 'openai',
      apiKey: '',
      headers: endpoint.headerNames.map((key) => ({ key, value: '' })),
    })
    setShowApiKey(false)
    setShowHeaderValues({})
    setError(null)
  }

  const handleCloseModal = () => {
    setIsCreating(false)
    setEditingEndpoint(null)
    setFormData({ name: '', baseUrl: '', apiType: 'openai', apiKey: '', headers: [] })
    setShowApiKey(false)
    setShowHeaderValues({})
    setError(null)
  }

  const handleAddHeader = () => {
    setFormData((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }))
  }

  const handleRemoveHeader = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, i) => i !== index),
    }))
    setShowHeaderValues((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      headers: prev.headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    }))
    if (error) setError(null)
  }

  const toggleHeaderVisibility = (index: number) => {
    setShowHeaderValues((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      setError('Name and Base URL are required')
      return
    }

    // Validate name format
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      setError('Name must contain only letters, numbers, underscores, and hyphens')
      return
    }

    // Validate headers - keys must be non-empty if present
    const invalidHeaders = formData.headers.filter(
      (h) => (h.key.trim() && !h.value.trim()) || (!h.key.trim() && h.value.trim())
    )
    if (invalidHeaders.length > 0) {
      setError('Header names and values must both be provided')
      return
    }

    setError(null)

    // Convert headers array to Record, filtering out empty entries
    const headersRecord = formData.headers
      .filter((h) => h.key.trim() && h.value.trim())
      .reduce(
        (acc, h) => {
          acc[h.key.trim()] = h.value.trim()
          return acc
        },
        {} as Record<string, string>
      )

    // For editing: only include headers if any values were actually provided
    // If user just has existing header names with no values, we keep existing headers
    const hasHeaderChanges = formData.headers.some((h) => h.value.trim())
    const headersToSend =
      isEditing && !hasHeaderChanges && formData.headers.length > 0
        ? undefined
        : Object.keys(headersRecord).length > 0
          ? headersRecord
          : isEditing
            ? undefined
            : undefined

    try {
      if (isEditing && editingEndpoint) {
        await updateEndpoint.mutateAsync({
          workspaceId,
          endpointId: editingEndpoint.id,
          name: formData.name.trim(),
          baseUrl: formData.baseUrl.trim(),
          apiKey: formData.apiKey.trim() || undefined,
          headers: headersToSend,
        })
      } else {
        await createEndpoint.mutateAsync({
          workspaceId,
          name: formData.name.trim(),
          baseUrl: formData.baseUrl.trim(),
          apiType: formData.apiType,
          apiKey: formData.apiKey.trim() || undefined,
          headers: Object.keys(headersRecord).length > 0 ? headersRecord : undefined,
        })
      }
      handleCloseModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save endpoint'
      setError(message)
      logger.error('Failed to save custom LLM endpoint', { error: err })
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmEndpoint) return

    try {
      await deleteEndpoint.mutateAsync({
        workspaceId,
        endpointId: deleteConfirmEndpoint.id,
      })
      setDeleteConfirmEndpoint(null)
    } catch (err) {
      logger.error('Failed to delete custom LLM endpoint', { error: err })
    }
  }

  const isPending = createEndpoint.isPending || updateEndpoint.isPending

  return (
    <>
      <div className='flex h-full flex-col gap-[16px]'>
        <div className='flex items-start justify-between gap-4'>
          <p className='text-[13px] text-[var(--text-secondary)]'>
            Configure custom LLM endpoints compatible with OpenAI, Anthropic, or Google Gemini APIs.
            Use models with format:{' '}
            <code className='text-[12px]'>custom-{'{api}'}:endpoint-name/model</code>
          </p>
          <Button
            variant='primary'
            className='!bg-[var(--brand-tertiary-2)] !text-[var(--text-inverse)] hover:!bg-[var(--brand-tertiary-2)]/90 flex-shrink-0'
            onClick={handleOpenCreate}
          >
            <Plus className='mr-1 h-4 w-4' />
            Add Endpoint
          </Button>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          {isLoading ? (
            <div className='flex flex-col gap-[8px]'>
              <EndpointSkeleton />
              <EndpointSkeleton />
            </div>
          ) : endpoints.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Server className='mb-3 h-10 w-10 text-[var(--text-muted)]' />
              <p className='font-medium text-[14px] text-[var(--text-secondary)]'>
                No custom endpoints configured
              </p>
              <p className='mt-1 text-[13px] text-[var(--text-muted)]'>
                Add an endpoint to use self-hosted LLMs
              </p>
            </div>
          ) : (
            <div className='flex flex-col gap-[8px]'>
              {endpoints.map((endpoint) => {
                const apiTypeLabel = API_TYPE_OPTIONS.find(
                  (opt) => opt.value === (endpoint.apiType || 'openai')
                )?.label
                return (
                  <div key={endpoint.id} className='flex items-center justify-between gap-[12px]'>
                    <div className='flex items-center gap-[12px]'>
                      <div className='flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--surface-6)]'>
                        <Server className='h-4 w-4' />
                      </div>
                      <div className='flex min-w-0 flex-col justify-center gap-[1px]'>
                        <div className='flex items-center gap-[8px]'>
                          <span className='font-medium text-[14px]'>{endpoint.name}</span>
                          <span className='rounded-[4px] bg-[var(--surface-5)] px-[6px] py-[1px] text-[10px] text-[var(--text-muted)]'>
                            {apiTypeLabel}
                          </span>
                        </div>
                        <p className='truncate text-[13px] text-[var(--text-muted)]'>
                          {endpoint.baseUrl}
                          {(endpoint.hasApiKey || endpoint.headerNames?.length > 0) && ' ('}
                          {endpoint.hasApiKey && 'API key'}
                          {endpoint.hasApiKey && endpoint.headerNames?.length > 0 && ', '}
                          {endpoint.headerNames?.length > 0 &&
                            `${endpoint.headerNames.length} header${endpoint.headerNames.length !== 1 ? 's' : ''}`}
                          {(endpoint.hasApiKey || endpoint.headerNames?.length > 0) && ')'}
                        </p>
                      </div>
                    </div>

                    <div className='flex flex-shrink-0 items-center gap-[8px]'>
                      <Button variant='ghost' size='sm' onClick={() => handleOpenEdit(endpoint)}>
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setDeleteConfirmEndpoint(endpoint)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <ModalContent className='w-[480px]'>
          <ModalHeader>
            {isEditing ? `Edit Endpoint: ${editingEndpoint?.name}` : 'Add Custom LLM Endpoint'}
          </ModalHeader>
          <ModalBody className='max-h-[60vh] overflow-y-auto'>
            <p className='text-[12px] text-[var(--text-secondary)]'>
              {isEditing
                ? 'Update the endpoint configuration. Leave API key blank to keep the existing key.'
                : 'Configure a custom LLM endpoint. Choose the API type that matches your endpoint.'}
            </p>

            <div className='mt-[16px] flex flex-col gap-[16px]'>
              <div className='flex flex-col gap-[8px]'>
                <p className='font-medium text-[13px] text-[var(--text-secondary)]'>API Type</p>
                <Select
                  value={formData.apiType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, apiType: value as CustomLlmApiType }))
                  }
                  disabled={isEditing}
                >
                  <SelectTrigger className='h-9'>
                    <SelectValue placeholder='Select API type' />
                  </SelectTrigger>
                  <SelectContent className='z-[501]'>
                    {API_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-[11px] text-[var(--text-muted)]'>
                  {isEditing
                    ? 'API type cannot be changed after creation'
                    : 'Select the API format your endpoint supports'}
                </p>
              </div>

              <div className='flex flex-col gap-[8px]'>
                <p className='font-medium text-[13px] text-[var(--text-secondary)]'>
                  Endpoint Name
                </p>
                <EmcnInput
                  value={formData.name}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                    if (error) setError(null)
                  }}
                  placeholder='e.g., gpu-server, local-vllm'
                  className='h-9'
                  autoFocus
                  disabled={isEditing}
                />
                <p className='text-[11px] text-[var(--text-muted)]'>
                  Letters, numbers, underscores, and hyphens only. Used in model name:{' '}
                  {API_TYPE_OPTIONS.find((opt) => opt.value === formData.apiType)?.modelPrefix}:
                  {formData.name || 'name'}/model
                </p>
              </div>

              <div className='flex flex-col gap-[8px]'>
                <p className='font-medium text-[13px] text-[var(--text-secondary)]'>Base URL</p>
                <EmcnInput
                  value={formData.baseUrl}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))
                    if (error) setError(null)
                  }}
                  placeholder='e.g., https://gpu-server.internal:8000'
                  className='h-9'
                />
                <p className='text-[11px] text-[var(--text-muted)]'>
                  The base URL of your API endpoint (without trailing path like /v1)
                </p>
              </div>

              <div className='flex flex-col gap-[8px]'>
                <p className='font-medium text-[13px] text-[var(--text-secondary)]'>
                  API Key (Optional)
                </p>
                <div className='relative'>
                  <EmcnInput
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, apiKey: e.target.value }))
                      if (error) setError(null)
                    }}
                    placeholder={
                      isEditing && editingEndpoint?.hasApiKey
                        ? 'Leave blank to keep existing key'
                        : 'Enter API key if required'
                    }
                    className='h-9 pr-[36px]'
                    autoComplete='off'
                    autoCorrect='off'
                    autoCapitalize='off'
                    data-lpignore='true'
                    data-form-type='other'
                  />
                  <Button
                    variant='ghost'
                    className='-translate-y-1/2 absolute top-1/2 right-[4px] h-[28px] w-[28px] p-0'
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className='h-[14px] w-[14px]' />
                    ) : (
                      <Eye className='h-[14px] w-[14px]' />
                    )}
                  </Button>
                </div>
                <p className='text-[11px] text-[var(--text-muted)]'>
                  If your endpoint requires authentication
                </p>
              </div>

              <div className='flex flex-col gap-[8px]'>
                <div className='flex items-center justify-between'>
                  <p className='font-medium text-[13px] text-[var(--text-secondary)]'>
                    Custom Headers (Optional)
                  </p>
                  <Button variant='ghost' size='sm' onClick={handleAddHeader} className='h-7 px-2'>
                    <Plus className='mr-1 h-3 w-3' />
                    Add Header
                  </Button>
                </div>

                {formData.headers.length > 0 && (
                  <div className='flex flex-col gap-[8px]'>
                    {formData.headers.map((header, index) => (
                      <div key={index} className='flex items-center gap-[8px]'>
                        <EmcnInput
                          value={header.key}
                          onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                          placeholder='Header name'
                          className='h-8 flex-1 text-[12px]'
                          autoComplete='off'
                        />
                        <div className='relative flex-1'>
                          <EmcnInput
                            type={showHeaderValues[index] ? 'text' : 'password'}
                            value={header.value}
                            onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                            placeholder={
                              isEditing && editingEndpoint?.headerNames?.includes(header.key)
                                ? 'Leave blank to keep'
                                : 'Header value'
                            }
                            className='h-8 pr-[32px] text-[12px]'
                            autoComplete='off'
                          />
                          <Button
                            variant='ghost'
                            className='-translate-y-1/2 absolute top-1/2 right-[2px] h-[24px] w-[24px] p-0'
                            onClick={() => toggleHeaderVisibility(index)}
                          >
                            {showHeaderValues[index] ? (
                              <EyeOff className='h-[12px] w-[12px]' />
                            ) : (
                              <Eye className='h-[12px] w-[12px]' />
                            )}
                          </Button>
                        </div>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleRemoveHeader(index)}
                          className='h-8 w-8 flex-shrink-0 p-0'
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className='text-[11px] text-[var(--text-muted)]'>
                  Add custom HTTP headers to be sent with every request
                  {isEditing &&
                    editingEndpoint?.headerNames &&
                    editingEndpoint.headerNames.length > 0 &&
                    '. Leave values blank to keep existing headers.'}
                </p>
              </div>

              {error && (
                <p className='text-[12px] text-[var(--text-error)] leading-tight'>{error}</p>
              )}
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant='default' onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button
              variant='tertiary'
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.baseUrl.trim() || isPending}
            >
              {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmEndpoint} onOpenChange={() => setDeleteConfirmEndpoint(null)}>
        <ModalContent size='sm'>
          <ModalHeader>Delete Endpoint</ModalHeader>
          <ModalBody>
            <p className='text-[12px] text-[var(--text-secondary)]'>
              Are you sure you want to delete the{' '}
              <span className='font-medium text-[var(--text-primary)]'>
                {deleteConfirmEndpoint?.name}
              </span>{' '}
              endpoint? Any workflows using this endpoint will no longer work.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant='default' onClick={() => setDeleteConfirmEndpoint(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={handleDelete}
              disabled={deleteEndpoint.isPending}
            >
              {deleteEndpoint.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
