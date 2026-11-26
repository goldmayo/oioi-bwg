"use client";

import { useState } from "react";
import { AlertCircle, Check, CircleHelp, Layers2, Save } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { AlbumArtwork, PreviewBrand, SourceBadge } from "./preview-parts";

const surfaceTokens = [
  ["--oioi-ground", "바탕", "화면 전체와 탐색 셸"],
  ["--oioi-panel", "패널", "타임라인·목록·속성 영역"],
  ["--oioi-inset", "내부 면", "보조 정보와 입력 주변"],
  ["--oioi-control", "컨트롤", "버튼·행·타일의 기본 면"],
  ["--oioi-hover", "호버", "선택하지 않은 대상의 일시적 반응"],
  ["--oioi-selected", "선택", "선택한 곡·구간·필터"],
] as const;

function StateSamples({ theme }: { theme: string }) {
  const [selected, setSelected] = useState(true);
  return (
    <div className="oioi-preview oioi-theme-sample" data-theme={theme}>
      <h3>{theme === "light" ? "라이트" : "다크"}</h3>
      <div className="oioi-sample-panel">
        <div className="oioi-sample-title">
          <strong>응원법 작업본</strong>
          <SourceBadge source="팬덤" />
        </div>
        <div className="oioi-state-buttons">
          <Button className="oioi-button">기본</Button>
          <Button className="oioi-button oioi-demo-hover">호버</Button>
          <Button className="oioi-button oioi-demo-focus">포커스</Button>
          <Button className="oioi-button" disabled>
            비활성
          </Button>
        </div>
        <button
          className="oioi-sample-row"
          aria-pressed={selected}
          onClick={() => setSelected(!selected)}
        >
          <AlbumArtwork album="manito" size={36} />
          <span>
            <strong>고민중독</strong>
            <small>MANITO · 콘서트</small>
          </span>
          {selected && <Check size={16} />}
        </button>
        <p className="oioi-muted">행을 눌러 선택을 바꾸고, 포인터를 올려 비교합니다.</p>
        <label className="oioi-field">
          곡명
          <input defaultValue="고민중독" />
        </label>
        <label className="oioi-field">
          시작 시간
          <input
            aria-invalid="true"
            aria-describedby={`oioi-demo-error-${theme}`}
            defaultValue="-1"
          />
          <span className="oioi-error" id={`oioi-demo-error-${theme}`}>
            <AlertCircle size={13} /> 0초 이상으로 입력해 주세요.
          </span>
        </label>
        <div className="oioi-sample-notice">
          <CircleHelp size={15} /> 저장한 작업본은 공개되지 않습니다.
        </div>
      </div>
    </div>
  );
}

export function DesignGuide() {
  return (
    <div className="oioi-guide">
      <header className="oioi-guide-header">
        <PreviewBrand />
        <span>디자인 가이드 · 시안 v1</span>
      </header>
      <h1>콘텐츠가 먼저 읽히는 화면</h1>
      <p className="oioi-guide-lead">
        어이어이바위게의 곡 탐색과 응원법 편집을 위한 공통 시각 규칙입니다.
        <br />
        팬에게는 편안한 읽기, 관리자에게는 명확한 선택과 정확한 작업 결과를 제공합니다.
      </p>
      <nav className="oioi-guide-toc" aria-label="디자인 가이드 목차">
        <a href="#oioi-principles">원칙</a>
        <a href="#oioi-tokens">토큰</a>
        <a href="#oioi-scale">글자와 크기</a>
        <a href="#oioi-states">테마와 상태</a>
        <a href="#oioi-composition">화면 조합</a>
      </nav>
      <section id="oioi-principles">
        <h2>원칙과 적용 범위</h2>
        <div className="oioi-principles">
          <article>
            <h3>면으로 묶고, 여백으로 나눕니다.</h3>
            <p>
              바탕·패널·입력의 밝기를 달리해 관계를 드러냅니다. 선은 열 정렬, 입력 경계와 고정
              영역에 씁니다. 그림자는 대화상자처럼 떠 있는 요소에만 둡니다.
            </p>
          </article>
          <article>
            <h3>호버보다 선택을 오래 유지합니다.</h3>
            <p>
              호버는 중립 면 한 단계, 선택은 옅은 강조 면으로 표시합니다. 선택한 행 위에 포인터를
              올려도 선택 면을 유지합니다. 체크와 굵기는 색 외의 식별 단서입니다.
            </p>
          </article>
          <article>
            <h3>색의 역할을 늘리지 않습니다.</h3>
            <p>
              청록은 현재 조작과 선택, 빨강은 오류입니다. 완료색은 견본에서 비교하며 저장 결과는
              문구로 알립니다. 떼창·네임콜·추임새 색은 데이터의 의미를 가지며 상태색과 혼용하지
              않습니다.
            </p>
          </article>
          <article>
            <h3>작업에 맞게 밀도를 바꿉니다.</h3>
            <p>
              사용자 목록은 16px 곡명과 76px 행으로 읽기 여백을 둡니다. Console은 14px 본문과 48px
              행으로 비교를 돕습니다. 모바일 컨트롤은 최소 44px로 넓힙니다.
            </p>
          </article>
        </div>
        <p className="oioi-guide-exception">
          예외: 포커스는 2px 외곽선, 오류는 입력 테두리와 설명을 함께 사용합니다. 데이터 색은 의미를
          유지하며 테마에 따라 글자 명도를 조정합니다.
        </p>
      </section>
      <section id="oioi-tokens">
        <h2>의미 토큰</h2>
        <p>
          색은 시안 루트에서 선언하고 구성 요소는 역할 이름으로 참조합니다. 운영 앱의 전역 테마는
          변경하지 않습니다.
        </p>
        <div className="oioi-token-list">
          {surfaceTokens.map(([token, label, usage]) => (
            <div key={token}>
              <i style={{ background: `var(${token})` }} />
              <strong>{label}</strong>
              <code>{token}</code>
              <span>{usage}</span>
            </div>
          ))}
        </div>
        <div className="oioi-semantic-colors">
          <span>
            <i className="oioi-color-accent" />
            강조 · 선택 / 포커스
          </span>
          <span>
            <i className="oioi-color-success" />
            완료 · 저장 결과
          </span>
          <span>
            <i className="oioi-color-danger" />
            위험 · 입력 오류
          </span>
          <span>
            <i className="oioi-color-call" />
            네임콜 · 응원 데이터
          </span>
        </div>
        <p className="oioi-muted">
          글자: --oioi-text / --oioi-muted · 경계: --oioi-line / --oioi-input-line · 상태:
          --oioi-accent / --oioi-success / --oioi-danger
        </p>
      </section>
      <section id="oioi-scale">
        <h2>글자·간격·곡률·컨트롤</h2>
        <div className="oioi-scale-grid">
          <div>
            <h3>글자</h3>
            <p className="oioi-type-display">함께 부를 다음 곡</p>
            <p>설치된 Pretendard를 우선하고, 맑은 고딕·시스템 서체로 대체합니다.</p>
            <p className="oioi-muted">
              제목 24–32px / 본문 14–16px / 보조 12px
              <br />행 높이 1.5 · 숫자 tabular-nums
            </p>
          </div>
          <div>
            <h3>간격과 모서리</h3>
            <div className="oioi-spacing-samples">
              {[4, 8, 12, 16, 24, 32].map((size) => (
                <span key={size}>
                  <i style={{ width: size }} />
                  {size}px
                </span>
              ))}
            </div>
            <p className="oioi-muted">
              기본 2px 단위 · 컨트롤 6px 곡률
              <br />
              패널 8px · 앨범 표지 4px
            </p>
          </div>
          <div>
            <h3>컨트롤</h3>
            <Button className="oioi-button">
              <Save /> 작업본 저장
            </Button>
            <p className="oioi-muted">
              Console 36px / 공개 검색 52px
              <br />
              모바일 누름 영역 최소 44px
            </p>
          </div>
        </div>
      </section>
      <section id="oioi-states">
        <h2>동일한 구성 요소, 두 가지 테마</h2>
        <p>
          기본·호버·선택·포커스·비활성·오류를 동일한 콘텐츠로 비교합니다. 포커스 견본은 표시용이며
          실제 컨트롤도 키보드로 조작할 수 있습니다.
        </p>
        <div className="oioi-theme-comparison">
          <StateSamples theme="light" />
          <StateSamples theme="dark" />
        </div>
      </section>
      <section id="oioi-composition">
        <h2>실제 화면에서 조합하기</h2>
        <div className="oioi-composition-grid">
          <article>
            <Layers2 size={18} />
            <h3>곡 목록</h3>
            <p>
              곡명 → 앨범 → 공연 종류·출처 → 연습 진입 순으로 읽습니다. 표지는 곡을 찾는 단서로
              유지하고 검색·필터는 결과 가까이에 둡니다.
            </p>
            <div className="oioi-mini-row">
              <AlbumArtwork album="manito" />
              <div>
                <strong>고민중독</strong>
                <small>MANITO · 콘서트</small>
              </div>
              <SourceBadge source="팬덤" />
            </div>
          </article>
          <article>
            <Layers2 size={18} />
            <h3>응원법 편집</h3>
            <p>
              곡 정보와 저장 결과는 상단, 타임라인과 가사는 중앙, 선택 구간은 오른쪽에 둡니다. 좁은
              화면에서는 속성이 본문 아래로 이어집니다.
            </p>
            <div className="oioi-mini-editor">
              <span>00:14.260</span>
              <strong>어떤 인사가 괜찮을까</strong>
              <Check size={14} />
            </div>
          </article>
        </div>
      </section>
      <footer className="oioi-guide-footer">
        이 가이드는 디자인 시안의 규칙입니다. 채택 후 운영 컴포넌트와 토큰으로 옮길 범위를 별도로
        결정합니다.
      </footer>
    </div>
  );
}
