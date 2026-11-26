"use client";

import { BookOpen, ListMusic, Moon, PanelLeftClose, PencilLine, Sun } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { Button } from "@/shared/ui/button";

import { DesignGuide } from "./design-guide";
import { GuideEditor } from "./guide-editor";
import { SongCatalog } from "./song-catalog";

const screens = ["editor", "songs", "guide"] as const;
const themes = ["dark", "light"] as const;
const navigation = [
  { id: "editor", title: "응원법 편집", icon: PencilLine },
  { id: "songs", title: "사용자 곡 목록", icon: ListMusic },
  { id: "guide", title: "디자인 가이드", icon: BookOpen },
] as const;

function Workspace() {
  const [screen, setScreen] = useQueryState(
    "screen",
    parseAsStringLiteral(screens).withDefault("editor"),
  );
  const [theme, setTheme] = useQueryState(
    "theme",
    parseAsStringLiteral(themes).withDefault("dark"),
  );
  return (
    <div className="oioi-preview oioi-workbench" data-theme={theme}>
      <a className="oioi-skip" href="#oioi-preview-content">
        본문으로 이동
      </a>
      <div className="oioi-preview-bar">
        <span className="oioi-preview-label">
          <PanelLeftClose size={14} aria-hidden="true" /> 디자인 미리보기
        </span>
        <nav aria-label="시안 화면 선택">
          {navigation.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              aria-current={screen === id ? "page" : undefined}
              onClick={() => void setScreen(id)}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <Button
          variant="ghost"
          className="oioi-button oioi-icon-button"
          aria-label={theme === "dark" ? "라이트 테마로 전환" : "다크 테마로 전환"}
          onClick={() => void setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
      </div>
      <div className="oioi-demo-note">
        화면 시안 · 예시 데이터 · 변경은 이 브라우저의 시안에만 적용됩니다.
      </div>
      <main id="oioi-preview-content" tabIndex={-1}>
        <div hidden={screen !== "editor"}>
          <GuideEditor theme={theme} />
        </div>
        <div hidden={screen !== "songs"}>
          <SongCatalog theme={theme} />
        </div>
        <div hidden={screen !== "guide"}>
          <DesignGuide />
        </div>
      </main>
    </div>
  );
}
export function PreviewWorkspace() {
  return (
    <NuqsAdapter>
      <Workspace />
    </NuqsAdapter>
  );
}
