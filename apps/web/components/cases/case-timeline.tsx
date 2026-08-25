import { ActivityList } from "@/components/activity/activity-list";
import { caseApi } from "./case-api";

export function CaseTimeline({ caseId }: { caseId: string }) {
  return <ActivityList load={(page) => caseApi.getCaseActivities(caseId, page)} />;
}
