import { analyticsNumber } from "../_lib/analytics";

import { DashboardNotificationsLink } from "./dashboard-notifications-link";

export function DashboardContent({ publishedGuideCount }: { publishedGuideCount: number }) {
  return (
    <table aria-labelledby="dashboard-widget-content" className="w-full text-sm">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-border border-b">
          <th scope="col" className="py-2 text-left font-medium">
            항목
          </th>
          <th scope="col" className="py-2 text-right font-medium">
            공개 수
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" className="py-3 text-left font-medium">
            응원법
          </th>
          <td className="py-3 text-right font-semibold tabular-nums">
            {analyticsNumber.format(publishedGuideCount)}개
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function DashboardJobs() {
  return (
    <div>
      <p className="text-muted-foreground max-w-prose text-sm leading-7">
        오래 걸리는 작업의 완료·실패 결과는 알림 내역에 남습니다. 놓친 알림도 다시 확인할 수
        있습니다.
      </p>
      <DashboardNotificationsLink />
    </div>
  );
}
