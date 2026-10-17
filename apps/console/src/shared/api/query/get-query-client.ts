import "server-only";

import { cache } from "react";

import { createQueryClient } from "./query-client";

/** RSC 요청·렌더 주기마다 QueryClient 하나를 만들며 프로세스 전역으로 공유하지 않는다. */
export const getQueryClient = cache(createQueryClient);
