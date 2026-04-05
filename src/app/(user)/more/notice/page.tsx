import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";
import { NoticeAccordion } from "@/shared/components/more/NoticeAccordion";

// 공지사항 상세 데이터 (Server Side)
const NOTICES = [
  {
    id: 1,
    title: "리뉴얼 기념 서비스 점검 및 최적화 안내",
    date: "2024-04-01",
    category: "공지",
    content:
      "어이어이 바위게 리뉴얼을 기념하여 대규모 서버 최적화 작업을 진행 중입니다. 더 빠르고 쾌적한 응원법 연습 환경을 위해 끊임없이 노력하겠습니다.",
  },
  {
    id: 2,
    title: "공식 팬카페 '바위게' 닉네임 정책 가이드",
    date: "2024-03-25",
    category: "안내",
    content:
      "공식 카페 연동 기능 사용 시 정책에 어긋나는 닉네임은 필터링될 수 있습니다. 커뮤니티 가이드라인을 준수해 주세요.",
  },
];

export default function NoticesPage() {
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="공지사항" subTitle="Official Notices" className="mt-12" />

      {/* 공지사항 목록 (Client Accordion inside Server Page) */}
      <div className="flex flex-col gap-4">
        {NOTICES.map((notice) => (
          <NoticeAccordion key={notice.id} notice={notice} />
        ))}
      </div>
    </div>
  );
}
