---
title: "YouTube 링크에서 파형 JSON 생성 기술 검토"
kind: migration-evidence
status: recorded
observed_at: "2026-10-05"
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
updated_at: "2026-10-05"
revision: 3
---

# 파형 JSON 생성 기술 검토

[최소 설계](DESIGN.md)의 기술 근거다. 공식 문서 기준의 가능성과 아래 구현 제안을 구분한다.
실제 다운로드·container 실행·benchmark는 하지 않았다. 최초판의 로컬 분석/장기 R&D 제안은 대체한다.

## 1. 필요한 도구만 사용

| 도구                                                                             | 확인된 역할                                                                          | 적용 제안                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) | play/pause/seek/currentTime 제공, 분석 PCM API 없음                                  | 기존 player를 재사용한다. 파형 생성은 독립 worker가 담당한다.                                            |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp)                                       | YouTube acquisition, stdout 미디어 출력. `-j`는 영상 메타데이터 JSON이며 파형이 아님 | 단일 영상의 audio stream을 pipe로 출력. YouTube 지원에 필요한 yt-dlp-ejs/JS runtime만 이미지에 포함한다. |
| [ffmpeg](https://ffmpeg.org/ffmpeg-protocols.html#pipe)                          | pipe 입력/출력과 audio decode·resample                                               | acquisition 출력 → mono PCM stream. 전체 파일을 앱 메모리에 읽지 않는다.                                 |
| [BBC audiowaveform](https://github.com/bbc/audiowaveform)                        | min/max waveform·JSON 생성, stdin/stdout 지원                                        | 직접 peak 추출기를 만들지 않고 이 CLI를 사용한다.                                                        |
| [Peaks.js](https://github.com/bbc/peaks.js/blob/master/doc/API.md)               | 사전 생성 JSON·overview/zoom·point/segment 편집                                      | 해당 JSON을 표시하고 기존 가사 행을 point marker로 연결한다.                                             |

기본 image는 yt-dlp 실행에 필요한 Python과 위 CLI만 포함한다. librosa/NumPy/모델 서버는 넣지 않는다.
audiowaveform의 build dependency는 build stage에서만 사용한다. OCI ARM64용 실제 image 검증은 P08의 첫 작업이다.
현재 문서만으로 최신 조합의 추출 성공이나 streaming 호환을 보장하지 않는다.

## 2. 처리 경로와 음원 수명

```text
canonical YouTube videoId
  → yt-dlp audio stdout
  → ffmpeg decode / mono / 24kHz PCM WAV pipe
  → audiowaveform min/max JSON stdout
  → VM runner가 JSON 수집/검증 → Console 내부 결과 API → PostgreSQL jsonb
```

audiowaveform의 공식 ffmpeg pipe 예제처럼 WAV stdin을 쓰고 input/output format을 명시한다.
pinned 도구 조합의 streaming을 검증하고, 필요할 때만 **컨테이너 tmpfs의 임시 WAV**를 fallback으로 사용한다.
JSON 반환 전에 모든 pipeline exit code·형식·길이를 확인한다. 일부 출력이나 yt-dlp 메타데이터를 성공한 peak로 저장하지 않는다.

| 경계      | 유지 조건                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 입력      | Console에서 URL을 videoId로 정규화하고 canonical YouTube URL만 worker에 전달. playlist/live·임의 URL·shell 옵션은 허용하지 않는다.                                       |
| 파일      | read-only root + tmpfs `/tmp`. TMPDIR/cache 위치도 tmpfs로 고정하며 yt-dlp disk cache를 끈다. audio host volume/bind mount/R2/DB 저장은 없다.                            |
| 자원/종료 | Runner concurrency 1, 길이·출력 byte·CPU/RAM/pids 제한, cap-drop·no-new-privileges, timeout/종료 시 하위 프로세스와 named container 제거. restart 없음, `--rm` 사용.     |
| 비영속성  | [Docker tmpfs](https://docs.docker.com/engine/storage/tmpfs/)도 swap될 수 있다. swap/core dump를 차단·확인한다. 삭제 함수 성공만으로 보관 금지를 검증했다고 하지 않는다. |
| 로그/결과 | raw audio는 container 내부 pipe에만 흐른다. Docker/OCI/오류 수집에는 음원·PCM·입력/출력 본문을 기록하지 않고 상태/오류 코드만 남긴다.                                    |

실행은 Console Job API → OCI Queue → VM-local runner → one-shot worker로 한다.
Runner는 long poll·job 검증·고정 container 실행·결과 반영·message delete만 맡고 분석하지 않는다.
worker에는 DB/Auth/R2/OCI credential을 주지 않는다. 임의 image/command/env/volume을 message로 받지 않는다.
결과를 DB에 저장한 뒤에만 delete하며 재전달·visibility 연장·DLQ·SSE는 [설계 §6](DESIGN.md#6-waveform-worker)가 소유한다.
Queue 비교나 별도 실행/알림 framework를 이 문서에 추가하지 않는다.

## 3. JSON 계약

라이브러리 호환성을 위해 **BBC 원래 JSON을 peaks 필드에 보존**한다. 별도 파형 포맷을 발명하지 않는다.

```text
{
  durationMs,
  bucketSizeMs,
  peaks: BBCWaveformJSON,
  source: { type: "youtube", id: videoId },
  generationVersion: 1
}
```

`BBCWaveformJSON`은 [원래 형식](https://github.com/bbc/audiowaveform/blob/master/doc/DataFormat.md)의
version/sample_rate/samples_per_pixel/bits/length/data를 보존한다. channels는 v2에 있으며 v1은 mono다.
mono 8-bit min/max를 채택하고, 24kHz에서 480 samples/bucket이면 20ms다.
4분 곡은 12,000 bucket·24,000 정수값이다. PCM 시료를 보관하는 데이터가 아니라 각 구간의 최소/최대 진폭 요약이다.
JSON byte 크기와 렌더링 비용은 실제 image/editor prototype으로 측정한다. 20ms보다 확대해도 파형 세부 정보가 추가되지는 않는다.
Cue의 10ms fine nudge는 파형 해상도와 독립적이며 필요할 때만 bucket을 더 작게 재생성한다.

durationMs는 분석 스트림의 길이, bucketSizeMs는 실제 sample_rate/samples_per_pixel에서 계산한다.
Zod로 byte/길이/정수 범위·min≤max·array 길이와 metadata 일치를 검사한다.
worker JSON source가 Song.youtubeId와 다르면 적용하지 않는다. 영상 변경 시 파형을 무효화하고 Cue는 자동 이동하지 않는다.
직전 정상 JSON은 재생성 성공 때 교체한다. JSON으로 음원 재생은 불가능하며 재생은 계속 YouTube가 담당한다.

## 4. 기존 player와 editor 연결

Peaks.js는 [custom player interface](https://github.com/bbc/peaks.js/blob/master/doc/customizing.md#player-interface)를 제공한다.
공식 인터페이스의 play/pause/seek/time/duration과 event만 현재 YouTubePlayer에 연결한다.
`waveformData.json`에 peaks를 주고 audioElement/Web Audio 분석 없이 표시한다. 현재 시각·seek 후 event는 실제 player에서 가져온다.
Cue point drag·zoom·시간 눈금은 Peaks.js 기능을 사용하고, 앱은 가사 draft·Snap·Undo·저장 규칙만 담당한다.
이 연결은 문서로 가능한 방식이지만 YouTube 광고·seek 지연·전체 지원 브라우저에서 실제 동작 검증이 필요하다.

## 5. 착수 전 확인과 검증

YouTube acquisition은 [이용약관](https://www.youtube.com/static?template=terms)의 허용 범위와 실제 영상 이용 권한을 확인해야 한다.
분석 후 삭제만으로 다운로드 이용 조건까지 충족하는 것은 아니다.
현행 [Domain §20](../../DOMAIN_SPECIFICATION.md)의 YouTube source 규칙도 이 임시 분석 경로에 맞게 해당 구현 PR에서 개정한다.

P08~P09는 짧은/긴 곡에서 JSON·ARM64 자원 사용을 확인하고, 추출/분석/결과 API 실패·timeout·강제 종료 뒤
container/host/volume/log에 음원이 남지 않는지 검사한다. worker가 끝난 뒤 새 탭에서 JSON만 조회해 waveform을 표시한다.
동일 videoId의 초반·중간·후반에서 최소 3개 anchor를 골라 waveform timestamp와 YouTube IFrame currentTime을 비교한다.
광고/seek 과도 구간은 구분하고 영상 길이만 같다는 이유로 통과시키지 않는다. anchor별 차이와 측정 조건을 기록한다.
일정 offset이면 명시적 보정 가능 여부와 검증된 보정값의 적용 위치를 정하고 Cue 시각을 조용히 이동하지 않는다.
후반으로 갈수록 drift가 누적되면 decode/timebase/영상 편집 원인을 확인하기 전에는 P09 integration 완료로 보지 않는다.
이 시간축 검증을 통과한 JSON만 실제 Cue timing reference로 사용한다. 허용 오차는 구현 prototype에서 고정하고 실측으로 확인한다.
자동 BPM/onset, Forced Alignment, Whisper, Demucs, stem, 응원 텍스트 자동 배치와 GPU/ML infrastructure는 이번 검토·로드맵에서 제외한다.
