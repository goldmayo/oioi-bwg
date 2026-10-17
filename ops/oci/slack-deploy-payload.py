import json
import os

phase = os.environ["PHASE"]
publish_result = os.environ.get("PUBLISH_RESULT", "")
candidate_result = os.environ.get("CANDIDATE_RESULT", "")
deploy_result = os.environ.get("DEPLOY_RESULT", "")
exit_code = os.environ.get("DEPLOY_EXIT_CODE", "")
digest = os.environ.get("IMAGE_DIGEST", "")
run_url = os.environ["RUN_URL"]
sha = os.environ.get("SOURCE_SHA", "")
short_sha = sha[:7]


def short_digest(value):
    if value.startswith("sha256:") and len(value) >= 24:
        return f"sha256:{value[7:19]}…{value[-8:]}"
    return "unknown"


if phase == "candidate":
    title = "✅ OCI 배포 후보 검증 완료" if candidate_result == "success" else "❌ OCI 배포 후보 검증 실패"
    detail = "후보 이미지 게시·검증 결과입니다. OCI 배포는 아직 실행하지 않았습니다."
    color = "#2EB67D" if candidate_result == "success" else "#E01E5A"
    result_lines = (
        f"Web 게시: {publish_result or '미실행'} / "
        f"Console 게시: {os.environ.get('CONSOLE_PUBLISH_RESULT') or '미실행'} / "
        f"후보 검증: {candidate_result}"
    )
    stage = "Candidate"
elif os.environ.get("DEPLOYMENT_BLOCKED") == "true":
    title = "⛔ OCI 두 앱 배포 보류"
    detail = "후보 검증은 완료했지만 P06-B2와 승인된 host upgrade가 필요합니다."
    color = "#ECB22E"
    result_lines = "두 앱 배포 차단: Run Command 미실행"
    stage = "Paired deployment gate"
elif candidate_result != "success":
    title = "❌ OCI 개발 배포 실패"
    detail = "병합한 PR의 검증된 후보 기록을 확인하지 못했습니다. 이미지를 다시 build/publish하지 않습니다."
    color = "#E01E5A"
    result_lines = "❌ 후보 기록 확인 실패"
    stage = "Candidate lookup"
elif deploy_result == "success" and exit_code == "0":
    title = "✅ OCI 개발 배포 완료"
    detail = "새 릴리즈가 정상 배포되었습니다."
    color = "#2EB67D"
    result_lines = "✅ Health   ✅ Readiness   ✅ Smoke"
    stage = "Complete"
elif exit_code == "20":
    title = "↩️ OCI 개발 배포 롤백 완료"
    detail = "새 릴리즈 검증에 실패하여 직전 릴리즈로 자동 복구했습니다."
    color = "#ECB22E"
    result_lines = "⚠️ 새 릴리즈 검증 실패   ✅ 이전 릴리즈 복구 완료"
    stage = "Rollback"
elif exit_code == "21":
    title = "🚨 OCI 개발 배포 롤백 실패"
    detail = "새 릴리즈 배포와 이전 릴리즈 복구가 모두 실패했습니다. 즉시 확인이 필요합니다."
    color = "#A30200"
    result_lines = "❌ 새 릴리즈 실패   ❌ 자동 롤백 실패"
    stage = "Rollback"
else:
    title = "❌ OCI 개발 배포 실패"
    detail = "OCI 배포 파이프라인을 완료하지 못했습니다."
    color = "#E01E5A"
    result_lines = "❌ 배포 실패"
    stage = "Deploy"

fields = [
    {"type": "mrkdwn", "text": "*환경*\nOCI Development"},
    {"type": "mrkdwn", "text": "*브랜치*\n`migration_develop`"},
    {"type": "mrkdwn", "text": f"*소스 커밋*\n`{short_sha}`"},
    {"type": "mrkdwn", "text": f"*Web*\n`{short_digest(digest)}`"},
    {"type": "mrkdwn", "text": f"*Console*\n`{short_digest(os.environ.get('CONSOLE_IMAGE_DIGEST', ''))}`"},
]

if phase == "candidate":
    fields.append({
        "type": "mrkdwn",
        "text": f"*후보 run/attempt*\n{os.environ.get('GITHUB_RUN_ID', '')}/{os.environ.get('GITHUB_RUN_ATTEMPT', '')}",
    })

if phase == "deploy":
    fields.append({"type": "mrkdwn", "text": f"*병합 커밋*\n`{os.environ.get('GITHUB_SHA', '')[:7]}`"})

if stage != "Complete":
    fields.append({"type": "mrkdwn", "text": f"*단계*\n{stage}"})

payload = {
    "text": title,
    "attachments": [
        {
            "color": color,
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": title, "emoji": True},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": detail},
                },
                {
                    "type": "section",
                    "fields": fields,
                },
                {"type": "divider"},
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*결과*\n{result_lines}"},
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "GitHub Actions에서 보기", "emoji": True},
                            "url": run_url,
                            "action_id": "open_github_actions",
                        }
                    ],
                },
            ],
        }
    ],
}

print(json.dumps(payload, ensure_ascii=False))
