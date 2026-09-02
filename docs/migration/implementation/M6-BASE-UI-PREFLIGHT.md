# M6 Base UI 점진 전환 사전 점검

> 상태: **폐기(superseded)**. M6 범위에서 Base UI 실제 전환을 진행하지 않기로 결정했다. 이 문서는
> 당시 검토 결과를 보존하는 기록이며, shared primitive 교체·Playwright 회귀 검증·Radix 제거 작업은
> M6 완료 범위에서 제외한다.

## 목적

M6의 관리자 API·클라이언트 전환 이후 남은 UI foundation 작업의 범위와 검증 순서를 확정한다. 현재 `src/shared/ui`는 `radix-ui` unified package를 사용하고 있으며, 이번 문서는 코드나 의존성을 변경하지 않는 preflight다.

Base UI 전환은 관리자 기능 하나의 리팩터링이 아니라 공용 primitive의 키보드·포커스·portal·overlay 동작 계약을 바꾸는 작업이다. 따라서 한 번에 전체를 교체하지 않고 primitive 단위의 독립 PR로 진행한다. Radix와 Base UI의 공존은 허용하며, 모든 consumer가 전환되고 회귀 검증이 끝난 뒤에만 `radix-ui` 제거를 검토한다.

## 현재 상태

| 영역 | 현재 의존성/위치 | 전환 메모 |
| --- | --- | --- |
| Button, Slot 조합 | `src/shared/ui/button.tsx` / `radix-ui` Slot | Base UI의 `render` 조합 방식에 맞춰 public API를 유지할지 결정 |
| Label, Form | `label.tsx`, `form.tsx` | label 연결과 validation message 접근성 유지 |
| Checkbox, Switch | `checkbox.tsx`, `switch.tsx` | controlled 상태와 form 제출 동작 검증 |
| Tabs, Accordion | `tabs.tsx`, `accordion.tsx` | keyboard roving focus 및 URL/상태 연동 확인 |
| Select | `select.tsx` | portal, keyboard navigation, value/placeholder 계약 확인 |
| Dialog, Sheet, Dropdown | `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx` | overlay, focus trap, escape, stacking 순서 우선 검증 |
| Slider, ScrollArea, Separator | 해당 shared primitive | pointer/keyboard와 overflow 시각 회귀 확인 |

현재 공용 `src/shared/ui`의 외부 public import 경로는 유지한다. consumer가 `radix-ui` API를 직접 사용하지 않도록 한 뒤 내부 구현만 교체한다.

## 전환 순서

1. `@base-ui/react` 도입 여부와 현재 shadcn 생성 코드의 호환 범위를 확인한다.
2. 조합 영향이 작은 `Label`, `Separator`, `Button`부터 전환하고 type-check/lint를 통과시킨다.
3. 상태 primitive(`Checkbox`, `Switch`, `Tabs`, `Accordion`, `Slider`)를 전환한다.
4. portal·overlay primitive(`Dialog`, `Sheet`, `DropdownMenu`, `Select`, `ScrollArea`)를 전환한다.
5. 관리자 앨범·곡·가사 화면의 실제 consumer를 대상으로 Playwright 회귀를 실행한다.
6. `rg 'from "radix-ui"|from .+@radix-ui' src`로 잔여 직접 의존성을 확인하고, 잔여 consumer가 없을 때만 `radix-ui` 제거 PR을 만든다.

각 단계의 PR은 하나의 primitive군 또는 하나의 검증 가능한 migration checkpoint만 포함한다. shared public API를 바꾸는 경우에는 consumer 전환과 같은 PR에 포함하되, unrelated API/feature 리팩터링은 섞지 않는다.

## 필수 회귀 검증

- 키보드: Tab, Shift+Tab, Enter/Space, Arrow keys, Escape
- 포커스: trigger 복귀, focus trap, disabled 상태, 화면 전환 후 focus
- overlay/portal: 바깥 클릭, stacking, scroll lock, 모바일 viewport
- form: controlled/uncontrolled value, validation message, submit payload
- RSC/CSC: shared primitive의 client boundary와 hydration warning
- 실행: 해당 PR의 unit test와 Playwright 핵심 관리자 흐름, 이후 전체 `pnpm type-check`, `pnpm lint`, `pnpm lint:fsd`, `pnpm format:check`

## 보류 및 비목표

- `max-lines-per-function` 기준은 250줄을 유지한다. `SongManagerClient`는 책임 단위 리팩터링으로
  warning을 해소했다.
- 이번 preflight에서는 package.json, lockfile, shared primitive, 관리자 화면을 수정하지 않는다.
- Radix 제거는 Base UI 전환 폐기 결정에 따라 보류한다.

## 참고

- [shadcn/ui Base UI 기본값 안내](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [shadcn/ui 컴포넌트 문서](https://ui.shadcn.com/docs/components)
- [Base UI Select 문서](https://base-ui.com/react/components/select)
