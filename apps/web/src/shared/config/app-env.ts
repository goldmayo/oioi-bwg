export const APP_ENVIRONMENTS = ["local", "production"] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/** 공개 build 입력을 읽으며 NODE_ENV나 요청 URL로 배포 환경을 추론하지 않는다. */
export function getAppEnvironment(): AppEnvironment | undefined {
  const value = process.env.NEXT_PUBLIC_APP_ENV;
  return APP_ENVIRONMENTS.find((environment) => environment === value);
}

/** Next dev/build 경계에서 잘못된 공개 입력을 산출물 생성 전에 거절한다. */
export function validateAppEnvironment(): AppEnvironment {
  const environment = getAppEnvironment();
  if (!environment) throw new Error("NEXT_PUBLIC_APP_ENV must be local or production.");
  return environment;
}
