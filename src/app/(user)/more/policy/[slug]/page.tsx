import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";

// ----------------------------------------------------------------------
// 1. 약관 상세 데이터 정의 (서버 사이드에서 참조)
// ----------------------------------------------------------------------
const POLICY_DETAILS: Record<string, { title: string; date: string; content: string[] }> = {
  privacy: {
    title: "개인정보 처리방침",
    date: "2024-04-01",
    content: [
      "제1조 (목적) 본 방침은 '어이어이 바위게' 서비스 이용 시 수집되는 개인정보의 보호를 목적으로 합니다.",
      "제2조 (수집 항목) 서비스 개선을 위한 쿠키 및 기본 기기 정보(GA 수집 포함), 응원법 공유 시의 메타데이터를 수집합니다.",
      "제3조 (이용 기간) 수집된 정보는 서비스 목적 달성 시까지 보관하며, 관련 법령에 따라 안전하게 파기합니다.",
    ],
  },
  terms: {
    title: "이용 약관",
    date: "2024-04-01",
    content: [
      "제1조 (동작 원리) 본 서비스는 QWER 응원법 연습을 돕는 보조 툴입니다.",
      "제2조 (금지 행위) 불법적인 크롤링이나 비정상적인 접근은 서비스 이용이 제한될 수 있습니다.",
      "제3조 (책임 제한) 서비스 내 정보는 가공된 데이터이며, 실제 오피셜 정보와 차이가 있을 수 있습니다.",
    ],
  },
  copyright: {
    title: "저작권 정책",
    date: "2024-04-01",
    content: [
      "본 서비스에서 제공되는 앨범 아트 및 곡 명칭은 원저작권자(TAMAGO / QWER)에게 있습니다.",
      "가공된 응원법 텍스트 및 레이아웃의 저작권은 '어이어이 바위게' 프로젝트 팀에 있습니다.",
      "무단 복제 배포는 자제 부탁드립니다.",
    ],
  },
  email: {
    title: "이메일 무단 수집 거부",
    date: "2024-04-01",
    content: [
      "본 웹사이트에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용하여 무단으로 수집되는 것을 거부합니다.",
      "이를 위반 시 정보통신망법에 의해 형사 처벌될 수 있음을 유념하시기 바랍니다.",
    ],
  },
  ga: {
    title: "GA 수집 안내",
    date: "2024-04-01",
    content: [
      "더 나은 UX를 제공하기 위해 Google Analytics를 사용하여 익명의 사용자 방문 통계를 수집하고 있습니다.",
      "수집된 정보는 성별, 연령대, 로딩 속도 등의 성능 데이터를 식별하기 위한 목적이며, 특정 개인을 특정하지 않습니다.",
    ],
  },
};

// ----------------------------------------------------------------------
// 2. SSG를 위한 정적 파라미터 생성
// ----------------------------------------------------------------------
export async function generateStaticParams() {
  return Object.keys(POLICY_DETAILS).map((slug) => ({
    slug,
  }));
}

// ----------------------------------------------------------------------
// 3. 서버 컴포넌트 (SSG)
// ----------------------------------------------------------------------
export default async function PolicyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = POLICY_DETAILS[slug] || POLICY_DETAILS.privacy;

  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton href="/more/policy" label="Back to Policy" />

      <MoreHeader title={detail.title} className="mt-12" />

      {/* 약관 상세 섹션 */}
      <section className="border-border bg-card overflow-hidden rounded-3xl border shadow-xl">
        <div className="border-border bg-accent/40 border-b p-6">
          <p className="text-2xs text-muted-foreground text-2xs font-bold tracking-widest uppercase">
            Effective Date: {detail.date}
          </p>
        </div>

        <div className="flex flex-col gap-10 p-8 lg:p-12">
          {detail.content.map((text, idx) => (
            <div key={idx} className="flex gap-6">
              <span className="text-qwer-bwg/20 text-xl font-black italic">
                {(idx + 1).toString().padStart(2, "0")}
              </span>
              <p className="text-muted-foreground text-base leading-relaxed font-medium">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-border mt-20 border-t pt-12 opacity-30">
        <p className="text-muted-foreground text-xs font-medium">
          본 약관의 구체적인 내용은 서비스의 업데이트에 따라 사전 고지 없이 변경될 수 있습니다.
        </p>
      </footer>
    </div>
  );
}
