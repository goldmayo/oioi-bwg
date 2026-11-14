import { analyticsNumber } from "../_lib/analytics";

import { DashboardNotificationsLink } from "./dashboard-notifications-link";

export function DashboardContent({ publishedGuideCount }: { publishedGuideCount: number }) {
  return (
    <table aria-labelledby="dashboard-widget-content" className="w-full text-sm">
      <thead className="text-muted-foreground text-xs">
        <tr className="border-border border-b">
          <th scope="col" className="py-1.5 text-left font-medium">
            항목
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            공개 수
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" className="py-1.5 text-left font-medium">
            응원법
          </th>
          <td className="py-1.5 text-right font-semibold tabular-nums">
            {analyticsNumber.format(publishedGuideCount)}개
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function DashboardJobs() {
  return <DashboardNotificationsLink />;
}
