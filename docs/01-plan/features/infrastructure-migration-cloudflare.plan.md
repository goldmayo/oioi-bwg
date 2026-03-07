# [PLAN] Infrastructure Migration to Cloudflare Workers (Vinext + Drizzle)

## 1. 개요
현재 Next.js 16 + Prisma + Vercel 기반의 인프라를 Cloudflare Workers 환경에 최적화된 **Vinext 프레임워크**와 **Drizzle ORM**으로 마이그레이션하여 비용 효율성과 성능(Cold Start 제로)을 극대화합니다.

## 2. 목표
- Vercel 벤더 종속성 탈피 및 운영 비용 절감
- Edge Runtime 최적화를 통한 글로벌 응답 속도 향상
- Serverless 환경에 최적화된 가벼운 ORM(Drizzle) 도입

## 3. 핵심 작업 단계 (Roadmap)

### Phase 1: Vinext 조사 및 환경 설정
- **기능 조사:** Vinext의 Next.js API 호환성(Server Actions, RSC 등) 재검증
- **환경 구축:** `wrangler.jsonc` 설정 및 Cloudflare Workers 프로젝트 초기화
- **의존성 교체:** `next` 패키지를 `vinext`로 교체 및 빌드 파이프라인 구성

### Phase 2: Drizzle ORM 마이그레이션
- **스키마 변환:** `prisma/schema.prisma` -> `src/db/schema.ts` 변환
- **클라이언트 구현:** Drizzle Client 설정 및 Supabase(PostgreSQL) 연결 (Hyperdrive 활용 검토)
- **데이터 로직 수정:** 기존 Prisma 쿼리를 Drizzle 문법으로 전수 교체

### Phase 3: 기능 이식 및 회귀 테스트
- **가사 싱크 엔진:** `gsap.ticker` 기반 싱크 로직의 Edge 환경 작동 확인
- **관리자 편집기:** 편집기 내 데이터 저장 및 라인 스플리터 기능 정상 작동 확인
- **반응형 UI:** Shadcn UI 및 Tailwind CSS 4의 Vite 빌드 호환성 확인

## 4. 성공 지표 (Acceptance Criteria)
- [ ] `vinext deploy` 명령어를 통한 Cloudflare Workers 배포 성공
- [ ] 모든 가사 데이터가 Drizzle을 통해 정상 조회 및 수정됨
- [ ] 모바일/데스크탑 가사 싱크 및 인터셉팅 라우트 모달 정상 작동
- [ ] 기존 Next.js 기반 성능 대비 콜드 스타트 지연 시간 감소

## 5. 리스크 관리
- **Vinext 실험적 특성:** 미지원 API 발생 시 Hono 또는 커스텀 핸들러로 우회 경로 마련
- **번들 사이즈 제한:** Cloudflare Free Tier(1MB) 초과 시 트리쉐이킹 및 유료 플랜(10MB) 검토

---
*Created by Gemini CLI (bkit methodology)*
