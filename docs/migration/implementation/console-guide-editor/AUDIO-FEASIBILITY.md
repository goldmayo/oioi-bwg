---
title: "응원법 편집 오디오 기술 타당성 검토"
kind: migration-evidence
status: recorded
observed_at: "2026-10-05"
source_commit: a8d157960adea83c26d692709a0ad45b71884c88
---

# 오디오 기술 검토

[설계 제안](DESIGN.md)의 기술 근거다. 공식 문서·원저자 저장소를 2026-10-05에 확인했다.
실제 음원 benchmark는 하지 않았다. 아래 난이도·UX 효과·채택 판단은 현재 코드(E08~E12)와
기술 특성을 바탕으로 한 **설계 추론**이며, 정확도 수치나 운영비 견적을 측정값처럼 제시하지 않는다.

## 1. 가장 먼저 풀어야 할 문제: 분석 가능한 음원

현재 입력은 `youtubeId`와 가사 JSON이다. [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)는
재생·seek·현재 시각 제어용이며 분석용 PCM을 제공하지 않는다. iframe에서 Web Audio buffer를 얻는
경로를 가정하지 않는다. [현행 Domain §20](../../DOMAIN_SPECIFICATION.md)도 YouTube를 waveform source로 사용하지 않는다.

사용자는 조사 중 **음원을 절대 웹서버에 공유하지 않는다**고 명시했다. 따라서 MVP 기본은
**YouTube iframe + 파형 없는 Cue/Grid 편집**이다. 서버의 다운로드·upload·중계·일시 저장·stem 생성도 제외한다.
선택 가능한 확장안은 운영자가 이용 권한을 확인한 파일을 브라우저에서 선택하고, 해당 탭의 메모리에서만
decode/재생하는 것이다. 파일은 업로드하거나 IndexedDB·service worker에 저장하지 않는다.
작업을 다시 열면 파일을 다시 선택한다. 해시·길이·reference 대응을 확인한 파형 peak JSON만 선택적으로
저장한다. 정식 구매만으로 서버 분석·재배포 권한까지 자동 확보했다고 간주하지 않는다.

로컬 분석을 사용하지 않으면 YouTube + 수동 시간·BPM/offset·Cue track으로 편집한다. 파형 생성 실패가 조회/저장을
차단하지 않게 한다. 저장된 peak는 소리가 아니므로 peak만 남은 상태에서 로컬 오디오를 재생할 수 없다.
YouTube의 인트로·광고·다른 master/라이브 편집과 파일의 시간축을 자동으로 같다고 취급하지 않는다.

### yt-dlp를 쓸 수 있는가

[yt-dlp](https://github.com/yt-dlp/yt-dlp)는 로컬 CLI로 영상/음원을 다운로드할 수 있고 오디오 후처리는
ffmpeg 등의 dependency를 사용한다. **기술적으로 가능하지만 위치와 허용 범위를 구분해야 한다.**

| 방식                                                               | 음원 웹서버 비전송 조건                                                | 판단                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------- |
| YouTube iframe 링크                                                | 만족. 서비스 서버가 음원을 받지 않음                                   | 기본 채택. waveform/자동 음원 분석은 불가     |
| 서버 yt-dlp → 분석 후 삭제                                         | 임시라도 서버가 음원을 수신하므로 불만족                               | 제외                                          |
| yt-dlp로 URL만 얻어 browser fetch                                  | CORS·서명 URL/만료·추출 조건에 의존. iframe PCM API가 생기는 것이 아님 | 안정적인 웹 기능으로 채택하지 않음            |
| 관리자 PC의 CLI → PC에서 분석 → peak/BPM/marker JSON만 선택 import | 음원 비전송 조건을 기술적으로 만족 가능                                | source 사용 허용 확인과 명세 개정 후 선택 R&D |
| 합법적으로 확보한 로컬 파일 → browser memory 분석                  | 음원 비전송 조건 만족 가능                                             | 서버 업로드가 없는 선택 확장안                |

[YouTube 이용약관](https://www.youtube.com/static?template=terms)은 서비스가 허용하거나 필요한 허가를
받은 경우 등으로 콘텐츠 다운로드 사용을 제한한다. [API 개발자 정책](https://developers.google.com/youtube/terms/developer-policies)은
시청각 콘텐츠 다운로드/캐시와 audio/video 분리도 제한한다. 로컬 도구가 기술적으로 된다는 사실만으로
특정 영상의 이용 허용을 확정하지 않는다. 이 검토에서 다운로드를 실행하거나 우회 수단을 구현하지 않았다.
repository의 현행 “YouTube는 production waveform source로 사용하지 않음” 규정도 그대로이며,
로컬 yt-dlp 결과를 서비스 파형으로 쓰려면 이 정책의 변경 범위를 먼저 확정해야 한다.

단순한 “링크만 입력하면 브라우저가 파형까지 자동 생성”은 현재 API/입력 조건에서 가능한 약속이 아니다.
사용자가 원하는 **서버 음원 0바이트**와 **웹 편집**은 양립 가능하지만, 파형에는 로컬 분석이라는
별도 작업이 필요하다. 이 경로가 불필요하면 파형 없이도 목표 Cue 배치 workflow를 완성할 수 있다.

## 2. 파형 라이브러리 비교

| 후보                                                                                                            | 실제 제공 범위                                                                 | bundle/runtime·한계                                                                                                | 판단                                                             |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [wavesurfer.js](https://wavesurfer.xyz/)                                                                        | TypeScript API, 파형, Regions, Timeline/Minimap, HTML audio·Web Audio 연계     | Cue 도메인, Undo/Redo, 저장·승인·beat snap은 앱 책임. console editor에서만 dynamic import하고 필요한 plugin만 사용 | 로컬 파일 prototype의 1순위                                      |
| [Peaks.js](https://github.com/bbc/peaks.js/) / [API](https://github.com/bbc/peaks.js/blob/master/doc/API.md)    | overview/zoom waveform, points/segments, HTML media element 또는 custom player | annotation 중심 요구에 잘 맞음. Konva/audio waveform 처리와 custom cue UI를 포함한 실제 build 비교 필요            | wavesurfer의 region/viewport 통합이 불편하면 대안                |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData) + Canvas/SVG | decode된 AudioBuffer로 waveform·clock·분석을 직접 구성 가능                    | 좌표·zoom·resize·pointer·접근성·해제·codec 실패를 직접 소유. 라이브러리 byte가 줄어도 개발비가 늘 수 있음          | Grid/Cue overlay는 직접 작성; 전체 player/waveform 재작성은 보류 |
| CSS/SVG Cue rail만                                                                                              | 현재 player 위에서 정밀 입력·nudge·grid 제공                                   | 실제 파형은 없음                                                                                                   | 음원 없는 곡의 필수 fallback, 가장 싼 첫 개선                    |

[wavesurfer FAQ](https://github.com/katspaugh/wavesurfer.js#questions)는 CORS가 허용된 음원 접근,
브라우저 전체 decode의 메모리 한계, 큰 파일의 사전 계산 peak, VBR 재생/파형 불일치를 명시한다.
따라서 임의 YouTube URL 전달이나 “라이브러리 설치로 파형 확보”는 성립하지 않는다.
호환성·정확한 gzip byte 수·동시 Cue 개수 한계는 version을 고정한 prototype으로 비교한다.

4분 stereo 44.1 kHz float32 PCM만 약 `240 × 44100 × 2 × 4 = 84,672,000 bytes`다.
이는 계산상 약 80.7 MiB이며 decoder·복사본·파형 배열·player의 추가 메모리를 포함하지 않는다.
파일 길이/decoded size 상한, 취소, buffer/Object URL 해제, Safari 실기기 검증을 둔다.
`decodeAudioData`는 전체 파일 decoding API이므로 Worker로 옮긴다고 무조건 streaming·저메모리가 되지 않는다.
지원되는 문맥에서 decode한 PCM을 분석 Worker에 전달하되 복사량과 transfer 정책을 측정한다.

## 3. BPM·Beat Grid·Downbeat

BPM을 quarter-note 기준으로 명시하고 MVP는 **고정 tempo, 4/4** 지원부터 시작하는 것을 권고한다.
다른 박자/tempo 변화는 입력을 조용히 4/4로 해석하지 않고 snap을 끄고 편집하도록 한다.

```text
quarterMs = 60000 / BPM
gridStepMs = quarterMs × 4 / noteDenominator
barMs = quarterMs × meterNumerator × 4 / meterDenominator
grid(k) = beatOffsetMs + k × gridStepMs
snap(t) = beatOffsetMs + round((t - beatOffsetMs) / gridStepMs) × gridStepMs
```

`1/2·1/4·1/8·1/16`은 온음표 대비 음표 길이이며 “한 beat의 1/16”이 아니다.
120 BPM, 4/4면 1 Bar=2000 ms, 1/2=1000 ms, 1/4=500 ms, 1/8=250 ms, 1/16=125 ms다.
offset=0, 1/16에서 32.137초는 32.125초에 붙는다. 반올림은 최종 저장 ms에 한 번 적용하고,
매 grid tick을 누적 반올림하지 않는다. 정확히 중간이면 뒤 tick을 선택하는 등 tie 규칙을 고정한다.
0·duration 경계 밖의 tick은 후보에서 제외하고 마지막 부분 마디에서도 유효 시간을 유지한다.

**BPM만으로 위상을 알 수 없다.** 관리자가 들으면서 “현재 위치를 마디 첫 박으로 지정”해야 한다.
여기서 `beatOffsetMs`는 canonical 재생 시간축의 첫 마디 기준점이며, 로컬 파일과 영상 사이의
`sourceOffsetMs`와 다르다. 박 번호/강박 표시에는 time signature와 bar anchor도 필요하다.
자동 BPM의 절반/두 배 오류, pickup, rubato, tempo 변화, swing은 별도 문제다.
Grid 변경은 표시만 바꾸고 기존 Cue를 이동하지 않는다. Quantize는 선택한 Cue에 명시적으로 적용하고 Undo 가능해야 한다.
tempo map과 자동 downbeat는 실제 샘플에서 고정 grid가 실패하는 비율을 확인한 다음 단계다.

## 4. Peak·Onset·Beat 후보

| 방법                         | 탐지하는 것                                    | 놓치는 것 / 오탐                                                                           | 실행 위치·판정                                          |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| amplitude peak/RMS threshold | 큰 소리·에너지 증가                            | 압축된 상업 음원의 지속 고음량, snare가 vocal보다 큼; 무음 사이 실제 응원 위치를 설명 못함 | 브라우저의 선택 구간 탐색 보조로만 실험                 |
| spectral flux + peak picking | 주파수별 에너지 증가의 시간 변화               | 악기 attack·드럼도 onset; 보컬 의미·가사·강박 아님                                         | 소형 FFT/Worker로 실험, 입력/threshold/최소 간격을 조절 |
| beat tracking                | onset의 주기성과 tempo 일관성에 맞는 beat 후보 | offbeat·절반/두 배 tempo·변박·라이브 drift. 첫 beat가 downbeat라는 보장 없음               | 관리자 검수 후 grid 후보로만 채택                       |
| vocal onset                  | 노래 목소리의 시작 후보                        | 합창·호흡·반주 masking·연음·성악 발성                                                      | amplitude peak와 같은 기능으로 광고하지 않음            |
| Python/librosa               | 재현 가능한 offline 기준 분석                  | 배포·native dependency·파일 수명·CPU 격리 비용                                             | 운영 서버 없이 개발자 장비의 기준 실험부터              |
| Essentia.js/WASM             | 브라우저 music-analysis 알고리즘 후보          | WASM 초기화·다운로드·메모리·라이선스 검토 추가                                             | 단순 onset으로 부족함을 측정한 후 검토                  |

[librosa onset strength](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html)는 spectral flux,
[onset detect](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_detect.html)는 envelope의 peak 탐지를 설명한다.
[beat_track](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html)는 onset strength, tempo 추정,
tempo에 맞는 peak 선택을 조합한다. [Essentia.js](https://github.com/MTG/essentia.js)는 WASM 기반 대안이다.
이 기술 설명에서 **음악적 beat나 응원 Cue의 정답**까지 추론할 수는 없다.

Marker는 후보 track에 분리하고 종류·확신도·생성 버전을 기록한다. 관리자가 채택하기 전에는 Cue가 아니다.
선택 구간, 최대 후보 수, 최소 간격, 숨김/삭제, 이전·다음 이동을 제공한다.
단순 threshold는 강한 attack을 찾는 작업에서는 유용할 수 있으나, 다음 후보를 듣고 버리는 시간이
수동 탐색보다 길면 출시하지 않는다. 신뢰도 낮은 후보로 자동 save/publish하지 않는다.

## 5. Alignment 계열의 문제 정의와 판정

| 기술                     | 필요한 입력 / 출력                                                              | 현재 문제에 대한 판단                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| VocALign / Revoice Pro   | 비슷한 수행 내용의 guide audio와 dub audio → dub timing/pitch 등을 맞춤         | 응원 **텍스트** 위치 생성 문제와 다름. 현 요구의 도입안에서 **폐기**                                      |
| WhisperX alignment       | 실제 발화 audio + 이에 대응하는 transcript + 언어별 alignment model → 단어 시각 | 실제로 노래한 가사의 위치를 찾는 **실험 기능** 후보; 없는 응원 문구 자동 정렬은 **폐기**                  |
| Montreal Forced Aligner  | 대응하는 음원·transcript·발음 사전·acoustic model → word/phone alignment        | 정제 가사/녹음 corpus가 생긴 경우에만 **보류/R&D**                                                        |
| aeneas                   | 대응하는 speech/text, TTS/MFCC/DTW → 구간 sync map                              | 공식 제한에 song captioning 부적합 명시. 주 엔진으로 **폐기**                                             |
| DTW                      | 대응하는 두 feature sequence → 시간 warping path                                | 같은 곡의 두 녹음 간 coarse 대응은 **실험 가능**. 텍스트만으로 음악 내 cue를 발견하는 기능으로는 **폐기** |
| Demucs source separation | mixed music → vocal/drum 등 stem                                                | alignment 보조 **보류**; 없어도 되는 기본 의존성                                                          |

근거: [Revoice Match Process](https://www.synchroarts.com/manuals/RevoiceProV5/Manual/HTML/processes.html),
[WhisperX 연구](https://arxiv.org/abs/2303.00747), [WhisperX 구현·제약](https://github.com/m-bain/whisperX),
[MFA 입력 형식](https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/corpus_structure.html),
[aeneas limitations](https://github.com/readbeyond/aeneas#limitations-and-missing-features),
[DTW API](https://librosa.org/doc/0.11.0/generated/librosa.sequence.dtw.html),
[Demucs](https://github.com/facebookresearch/demucs). 판정은 문서의 입력 조건을 현재 서비스에 적용한 추론이다.
Demucs 원 저장소는 2025-01-01 archive 상태라 새 의존성 채택 시 유지보수 주체도 다시 확인해야 한다.

요청한 열 가지 질문에 대한 답:

1. **현재 바로 가능한가:** mixed music + 임의 Cheer Text의 일반적인 자동 배치는 불가. 음원에 실제 존재하는 가사 구간 alignment만 제한적으로 가능하다.
2. **입력은:** 이용 가능한 동일 master 음원, 정확한 실제 가사, 언어/발음 정규화, 대략적인 verse/chorus 구간. 응원 문구는 별도로 lyric anchor + beat offset 또는 수동 시각에 연결해야 한다.
3. **vocal stem 필수인가:** 필수 조건은 아니지만 반주가 강한 샘플에서 도움이 될 가능성이 있다. clean/mixed/stem별 결과를 비교해야 한다.
4. **Demucs가 필요한가:** 기본 의존성은 아니다. stem이 timing 오류를 줄이는지 실험한 후 판단하며, 분리 artifact가 오히려 음소 경계를 손상할 수 있다.
5. **한국어/일본어는:** [WhisperX 언어 매핑](https://github.com/m-bain/whisperX/blob/main/whisperx/alignment.py)에 ko/ja 후보가 있다. 모델 존재가 노래 정확도 보장은 아니다. 한국어 연음·영문 혼용, 일본어 한자 읽기·분절, 반복 후렴/늘인 음절을 별도 평가한다.
6. **Browser 가능한가:** 소형 onset/tempo는 가능 후보. Python/CUDA 계열을 그대로 browser에 넣을 수 없고 모델 이식·WASM/WebGPU·다운로드 비용 검증이 필요하다. MVP 범위 밖이다.
7. **Server 필요한가:** R&D는 관리자 개발 장비의 CLI로 충분하다. 이번 사용자 제약에서는 서버 음원 처리를 도입하지 않는다.
8. **GPU 필수인가:** 모든 방법의 필수 조건은 아니다. WhisperX는 CPU 실행도 안내한다. 모델·음원 길이에 따라 GPU가 실용적일 수 있으나 현재 OCI 2 OCPU에 실시간 처리 가능하다고 약속하지 않는다.
9. **비용 합리적인가:** 비용은 `곡 수 × 곡당 처리 시간 × 장비 시간단가 + 재검수 시간 + 유지보수`로 산정해야 한다. 입력 샘플/빈도/장비가 없어 금액 미정. 상시 GPU·Queue·Python 서버를 먼저 추가할 근거는 없다.
10. **Grid보다 ROI가 큰가:** 현재 근거로는 아니다. 존재하지 않는 응원 소리를 alignment로 복원할 수 없고, 검수 비용도 든다. Grid·Loop·Nudge를 먼저 측정하고 남는 가사 탐색 비용이 클 때만 실험한다.

## 6. 기능별 종합 비교

| 기능              | 구현 난이도    | 운영 비용                          | 예상 UX 효과                   | 정확도/한계                        | 추천                     |
| ----------------- | -------------- | ---------------------------------- | ------------------------------ | ---------------------------------- | ------------------------ |
| Manual Timestamp  | 낮음·기존 있음 | 매우 낮음                          | baseline·fallback              | 사람·player 오차, 반복 비용        | 유지                     |
| Waveform          | 중간           | 로컬 분석이면 서버 비용 낮음       | 위치 탐색·미세 조정에 높음     | 소리 크기 시각화, cue 의미는 없음  | source 조건 충족 시 도입 |
| BPM Grid          | 낮음~중간      | 매우 낮음                          | 규칙적인 박자 작업에 높음      | BPM·offset·박자 맞아야 함          | 우선 도입                |
| Snap              | 낮음           | 매우 낮음                          | 반복 정렬에 높음               | intentional offbeat를 망칠 수 있음 | ON/OFF·일시 해제로 도입  |
| Onset Detection   | 중간           | browser 낮음 / local CLI 관리 추가 | 샘플에 따라 다름               | peak ≠ beat ≠ vocal ≠ cheer        | 실험                     |
| Forced Alignment  | 높음           | 모델·검수 비용 높음                | 실제 가사 anchor에는 잠재 효과 | 없는 문구·반복·노래에 취약         | 운영 도입 보류           |
| Source Separation | 높음           | CPU/GPU·파일 관리 높음             | 다른 분석의 보조               | artifact·master mismatch           | 보류                     |

## 7. 검증 계획과 중단 기준

아래 값은 **제안하는 합격 기준**이다. 실측·확정 SLA가 아니다.

- 운영자가 허용한 한국어/일본어, 강한 반주, 느린 곡, 라이브/변속, 같은 곡의 다른 master를 포함한 10곡 내외에서 같은 20개 Cue 배치·수정 과제를 수행한다. 학습효과를 줄이도록 기존/새 editor 수행 순서를 교차한다.
- 총 편집 시간, seek·재청취 횟수, 저장 충돌/실패, Cue timing의 사람 기준 오차, 만족도를 측정한다. “원클릭 분석 성공”을 생산성 지표로 대체하지 않는다.
- MVP는 중앙 편집 시간 25% 이상 감소와 기존 대비 오차 악화 없음이 목표다. 관리자가 정답으로 확신하지 못하는 구간은 오차 통계에서 별도로 표기한다.
- 분석 후보는 관리자 채택률과 후보 검토를 포함한 전체 시간으로 평가한다. beat/downbeat와 onset은 별도 정답 집합으로 평가하며 ±50/±100 ms 기준과 허용 half/double-tempo 처리 규칙을 기록한다.
- Alignment는 실제 가사만 평가하고 median/p95 시각 오차, unaligned 비율, 반복 후렴 오배치, CPU/GPU·peak RAM·보정 시간을 기록한다. 수동 Grid보다 전체 작업 시간이 20% 이상 줄지 않으면 운영 승격을 중단한다.
- desktop Chrome/Firefox/Safari와 지원 대상 모바일 Safari에서 파일 decode 실패·취소·백그라운드 복귀·메모리·키보드 동작을 검증한다. drag 중 저장은 없고 포인터를 놓을 때 1회 draft/history 반영되어야 한다.
- web 초기 bundle에는 editor/audio 분석 패키지 증가가 없어야 한다. console dynamic chunk의 전후 byte와 긴 작업을 측정하고 허용 예산을 prototype 결과로 확정한다.
- 로컬 파일/CLI 경로는 network 검사로 음원/PCM/stem이 API·R2·관측 도구·오류 첨부에 전송되지 않음을 검증한다. import는 상한과 schema가 있는 peak/marker JSON만 허용한다. 서버 음원 처리는 이번 범위에서 제외한다.
