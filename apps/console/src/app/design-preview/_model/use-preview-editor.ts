"use client";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import {
  albums,
  cueKinds,
  initialCues,
  type PreviewCue,
  previewDuration,
  songs,
} from "./preview-data";
export type Draft = { cues: PreviewCue[] };
const storageKey = "oioi-bwg.design-preview.draft.v1";

export function usePreviewEditor() {
  const [selected, setSelected] = useState(4);
  const [panel, setPanel] = useState("timing");
  const [songId, setSongId] = useState("t-b-h");
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(14.26);
  const [message, setMessage] = useState("저장한 작업본은 공개되지 않습니다.");
  const inspector = useRef<HTMLElement>(null);
  const form = useForm<Draft>({ defaultValues: { cues: structuredClone(initialCues) } });
  const { fields, append } = useFieldArray({ control: form.control, name: "cues" });
  const watchedCues = useWatch({ control: form.control, name: "cues" });
  const cues = fields.map((field, index) => watchedCues[index] ?? field);
  const song = songs.find((item) => item.id === songId) ?? songs[0];
  const cue = cues[selected];
  const visibleSongs = songs.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()),
  );
  const album = albums.find((item) => item.id === song.album);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setPosition((value) => {
          if (value >= previewDuration) return 0;
          return value + 0.1;
        }),
      100,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  function chooseSong(id: string) {
    if (id === songId) return;
    setSongId(id);
    setPlaying(false);
    setPosition(14.26);
    setMessage(
      "편집 조작에는 공통 예시 구간을 사용합니다. 곡별 원문 데이터는 연결하지 않았습니다.",
    );
  }
  function chooseCue(index: number) {
    setSelected(index);
    setPosition(cues[index].time);
  }
  function resetDraft() {
    form.reset({ cues: structuredClone(initialCues) });
    setSelected(4);
    setMessage("구간을 처음 예시로 되돌렸습니다. 브라우저에 저장한 사본은 유지됩니다.");
  }
  const saveDraft = form.handleSubmit(
    (draft) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
        form.reset(draft);
        setMessage("시안 작업본을 이 탭에 저장했습니다. 서버에는 반영되지 않습니다.");
      } catch {
        setMessage("브라우저 저장소를 사용할 수 없습니다. 입력은 이 화면에 남아 있습니다.");
      }
    },
    () => {
      setMessage("입력값을 확인해 주세요. 문구와 시작 시간을 확인한 뒤 다시 저장합니다.");
    },
  );
  function restoreDraft() {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (
        !saved ||
        typeof saved !== "object" ||
        !("cues" in saved) ||
        !Array.isArray(saved.cues) ||
        saved.cues.length < 1 ||
        saved.cues.length > 100 ||
        !saved.cues.every((item: unknown) => {
          if (!item || typeof item !== "object") return false;
          return (
            "time" in item &&
            typeof item.time === "number" &&
            Number.isFinite(item.time) &&
            item.time >= 0 &&
            item.time <= previewDuration &&
            "text" in item &&
            typeof item.text === "string" &&
            item.text.trim().length > 0 &&
            item.text.length <= 200 &&
            "kind" in item &&
            cueKinds.some((kind) => kind === item.kind)
          );
        })
      ) {
        setMessage("이 탭에 불러올 수 있는 시안 작업본이 없습니다.");
        return;
      }
      form.reset({ cues: saved.cues as PreviewCue[] });
      setSelected(0);
      setMessage("이 탭에 저장한 시안 작업본을 불러왔습니다.");
    } catch {
      setMessage("저장본을 읽지 못했습니다. 현재 입력은 유지됩니다.");
    }
  }

  return {
    selected,
    setSelected,
    panel,
    setPanel,
    songId,
    query,
    setQuery,
    playing,
    setPlaying,
    position,
    setPosition,
    message,
    inspector,
    form,
    fields,
    append,
    cues,
    cue,
    visibleSongs,
    song,
    album,
    chooseSong,
    chooseCue,
    resetDraft,
    restoreDraft,
    saveDraft,
  };
}
