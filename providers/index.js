const providers = new Map();

function registerProvider(provider) {
  if (!provider.id || !provider.name) throw new Error('Provider must have id and name');
  providers.set(provider.id, provider);
}

function getProvider(id) {
  return providers.get(id) || null;
}

function getAllProviders() {
  return Array.from(providers.values());
}
