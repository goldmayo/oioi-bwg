# OCI Email Delivery 운영 설정

## 현재 운영 상태

- Region: `ap-osaka-1`
- Email Domain: `oioibawige.com`
- Approved Sender: `no-reply@oioibawige.com`
- DKIM: `ACTIVE`
- 인증: OCI Compute Instance Principal
- Dynamic Group: `oioi-bawige-email-senders`
- IAM policy: `Allow dynamic-group oioi-bawige-email-senders to use email-family in compartment oioi-bawige-prod`
- 실제 HTTPS Submission API 호출 및 외부 수신 검증 완료

## Production runtime

```env
EMAIL_DELIVERY_MODE=oci
OCI_EMAIL_REGION=ap-osaka-1
OCI_EMAIL_COMPARTMENT_OCID=ocid1.compartment.oc1..aaaaaaaavs5y44txsstgn5px5zfwynupw3m4mvlgndaje6q3lyi3hi65ucbq
OCI_EMAIL_SENDER_ADDRESS=no-reply@oioibawige.com
OCI_EMAIL_SENDER_NAME=oioibawige
```

`AUTH_SECRET`만 secret으로 취급하며 실제 값은 secret store/runtime에만 둔다. OCI API key, private key, SMTP credential, DKIM OCID는 사용하지 않는다.

## 변경·장애 대응

- Dynamic Group과 IAM policy는 OCI Console/IaC 운영 영역에서 관리한다.
- 애플리케이션은 Instance Principal로만 Email Delivery HTTPS API를 호출한다.
- 응답의 `messageId`, `envelopeId`, `suppressedRecipients`, `opcRequestId`를 서로 다른 의미로 취급한다.
- timeout·connection reset 등 제출 여부가 불명확한 오류에는 자동 재발송하지 않는다.
