import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";

// ----------------------------------------------------------------------
// 1. 약관 상세 데이터 정의 (서버 사이드에서 참조)
// ----------------------------------------------------------------------
const POLICY_DETAILS: Record<string, { title: string; date: string; content: string[] }> = {
  privacy: {
    title: "개인정보 처리방침",
    date: "2026-04-06",
    content: [
      "제1조 (목적) 본 방침은 팬 메이드 비영리 프로젝트 '어이어이 바위게'(이하 '서비스') 이용자의 권익을 보호하고 개인정보 관련 고충을 처리하기 위해 수집 및 이용 기준을 규정합니다.",
      "제2조 (수집 항목) 서비스는 별도의 회원가입 없이 이용 가능하며, UX 개선을 위한 익명 기기 정보(Google Analytics) 및 응원법 공유 시의 최소한의 메타데이터만을 수집합니다.",
      "제3조 (보유 및 파기) 수집된 비식별 정보는 서비스 운영 목적 달성 시까지 보관하며, 이용자가 브라우저 쿠키 삭제 등을 통해 수집 거부를 요청할 경우 즉각 반영됩니다.",
    ],
  },
  terms: {
    title: "이용 약관",
    date: "2026-04-06",
    content: [
      "제1조 (독립성 명시) 본 서비스는 QWER 팬들에 의해 운영되는 독립적인 비영리 프로젝트이며, 아티스트 소속사인 '3Y Corporation' 및 'TAMAGO'와는 어떠한 공식적 관계도 없음을 밝힙니다.",
      "제2조 (이용 제한) 본 서비스는 응원법 연습이라는 본래 목적 외에 영리적 이용, 부당한 시스템 접근(크롤링 등), 아티스트의 명예를 훼손하는 행위에 대한 이용을 엄격히 금지합니다.",
      "제3조 (면책 조항) 서비스 내 정보는 팬들의 자발적 참여로 가공되었습니다. 실제 공식 응원법 및 공연 현장 상황과 차이가 있을 수 있으며, 이로 인해 발생하는 혼선에 대해 본 운영팀은 책임을 지지 않습니다.",
    ],
  },
  copyright: {
    title: "저작권 정책",
    date: "2026-04-06",
    content: [
      "본 서비스에 사용된 앨범 아트, 곡 제목, 아티스트 성명 등 모든 지식재산권은 원저작권자인 '3Y Corporation'에 귀속됩니다.",
      "본 서비스는 아티스트의 활동을 지원하고 팬덤 문화를 활성화하기 위한 비영리 목적으로만 운영되며, 저작권자의 요청이 있을 경우 관련 콘텐츠는 즉각 수정 또는 삭제됩니다.",
      "서비스 내 독자적으로 구성된 UI/UX 디자인 및 응원법 가이드 데이터의 권리는 '어이어이 바위게' 제작팀에 있으며, 무단 복제 및 상업적 재배포를 금합니다.",
    ],
  },
  email: {
    title: "이메일 무단 수집 거부",
    date: "2026-04-06",
    content: [
      "본 웹사이트에 게시된 운영진의 이메일 주소가 자동 수집 프로그램이나 기타 기술적 장치를 이용하여 무단으로 수집되는 것을 거부합니다.",
      "이를 위반하여 스팸 메일 발송 등 부당한 행위가 적발될 경우 관련 법령에 의해 처벌될 수 있음을 유념하시기 바랍니다.",
    ],
  },
  ga: {
    title: "GA 수집 안내",
    date: "2026-04-06",
    content: [
      "더 나은 팬 경험(UX)을 제공하기 위해 Google Analytics를 사용하여 익명의 방문 통계를 수집하고 있습니다.",
      "수집 정보는 개인을 특정할 수 없는 범위(연령대, 기기 종류, 페이지 체류 시간 등) 내에서만 활용되며, 이는 오직 서비스 사용성 개선을 위한 분석 목적으로만 사용됩니다.",
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
