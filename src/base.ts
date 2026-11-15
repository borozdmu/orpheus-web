// API paths are defined at the core root; the UI may live below an ingress prefix.
export function appPath(path: string) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
