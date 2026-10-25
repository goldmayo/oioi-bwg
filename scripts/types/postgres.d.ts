import type { Helper, ParameterOrFragment, PendingQuery, Row } from "postgres";

// postgres 3.4.8의 Omit<Sql, ...>이 잃은 호출 서명 중 운영 스크립트가 쓰는 두 형태를 복원한다.
// https://github.com/porsager/postgres/issues/1143 — upstream 수정 버전 적용 시 제거한다.
// begin/end 같은 connection API는 transaction에 추가하지 않는다.
declare module "postgres" {
  interface TransactionSql<TTypes extends Record<string, unknown>> {
    <T extends readonly (object | undefined)[] = Row[]>(
      template: TemplateStringsArray,
      ...parameters: readonly ParameterOrFragment<TTypes[keyof TTypes]>[]
    ): PendingQuery<T>;
    (identifier: string): Helper<string, []>;
  }
}
