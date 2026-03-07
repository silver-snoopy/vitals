import type { DataProvider } from '@vitals/shared';

class ProviderRegistry {
  private providers = new Map<string, DataProvider>();

  register(provider: DataProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): DataProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): DataProvider[] {
    return Array.from(this.providers.values());
  }

  names(): string[] {
    return Array.from(this.providers.keys());
  }

  clear(): void {
    this.providers.clear();
  }
}

export const registry = new ProviderRegistry();
