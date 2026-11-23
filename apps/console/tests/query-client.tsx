import type { ReactNode } from "react";
import { QueryClient, type QueryClientConfig, QueryClientProvider } from "@tanstack/react-query";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/** suite가 직접 등록하고 각 시나리오가 독립 client와 cache를 만든다. */
export function createQueryClientFixture() {
  const clients = new Set<QueryClient>();
  afterEach(() => {
    cleanup();
    for (const client of clients) client.clear();
    clients.clear();
  });
  return (config?: QueryClientConfig) => {
    const client = new QueryClient(config);
    clients.add(client);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrapper };
  };
}
