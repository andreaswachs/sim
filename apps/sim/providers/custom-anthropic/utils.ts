/**
 * Parses a custom-anthropic model name to extract endpoint name and model name.
 * Format: custom-anthropic:{endpoint-name}/{model-name}
 * Example: custom-anthropic:my-server/claude-3-opus
 */
export function parseCustomAnthropicModel(model: string): {
  endpointName: string
  modelName: string
} {
  const withoutPrefix = model.replace(/^custom-anthropic:/, '')
  const slashIndex = withoutPrefix.indexOf('/')
  if (slashIndex === -1) {
    return { endpointName: '', modelName: withoutPrefix }
  }
  return {
    endpointName: withoutPrefix.slice(0, slashIndex),
    modelName: withoutPrefix.slice(slashIndex + 1),
  }
}
