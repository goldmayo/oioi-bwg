import { Options } from "ky";

import type { ApiSuccessResponse } from "@/shared/types/api";

import { getKy } from "./index";

export class BaseApi {
  /**
   * 💡 내부적으로 getKy()를 호출하여 환경(Server/Client)에 맞는 인스턴스를 가져옵니다.
   * `ky`의 afterResponse 훅에서 success: false인 경우 이미 Error를 던지도록 처리되어 있으므로,
   * 이곳에 도달한 응답은 무조건 ApiSuccessResponse<T> 임이 보장됩니다.
   * 따라서 지저분한 타입 캐스팅 없이 깔끔하게 .data를 추출합니다.
   */
  public async get<T>(url: string, options?: Options): Promise<T> {
    const client = await getKy();
    const response = await client.get(url, options).json<ApiSuccessResponse<T>>();
    return response.data;
  }

  public async post<T>(url: string, body?: unknown, options?: Options): Promise<T> {
    const client = await getKy();
    const response = await client
      .post(url, {
        json: body,
        ...options,
      })
      .json<ApiSuccessResponse<T>>();
    return response.data;
  }

  public async put<T>(url: string, body?: unknown, options?: Options): Promise<T> {
    const client = await getKy();
    const response = await client
      .put(url, {
        json: body,
        ...options,
      })
      .json<ApiSuccessResponse<T>>();
    return response.data;
  }

  public async delete<T>(url: string, options?: Options): Promise<T> {
    const client = await getKy();
    const response = await client.delete(url, options).json<ApiSuccessResponse<T>>();
    return response.data;
  }
}

// 애플리케이션 전역에서 사용할 수 있는 싱글톤 인스턴스를 하나 export 해둡니다.
// 내부 메서드(get, post)가 호출되는 시점에 환경(SSR/CSR)을 동적으로 판별하므로 안전합니다.
export const api = new BaseApi();
