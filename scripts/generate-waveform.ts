import {
  generateLocalWaveform,
  parseWaveformArguments,
} from "../tools/repository/src/operators/generate-waveform";

try {
  console.log(
    JSON.stringify(await generateLocalWaveform(parseWaveformArguments(process.argv.slice(2)))),
  );
} catch {
  console.error(
    "LOCAL_WAVEFORM_FAILED: 입력 접근·고정 이미지·기존 출력 파일과 oioi-waveform-local 컨테이너 상태를 확인해 주세요.",
  );
  process.exitCode = 1;
}
