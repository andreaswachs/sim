/**
 * Parses a custom-google model name to extract endpoint name and model name.
 * Format: custom-google:{endpoint-name}/{model-name}
 * Example: custom-google:my-server/gemini-2.0-flash
 */
export function parseCustomGoogleModel(model: string): {
  endpointName: string
  modelName: string
} {
  const withoutPrefix = model.replace(/^custom-google:/, '')
  const slashIndex = withoutPrefix.indexOf('/')
  if (slashIndex === -1) {
    return { endpointName: '', modelName: withoutPrefix }
  }
  return {
    endpointName: withoutPrefix.slice(0, slashIndex),
    modelName: withoutPrefix.slice(slashIndex + 1),
  }
}
