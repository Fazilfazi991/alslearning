import { NativeClassroom } from "./native-classroom";
import type { getClassroomData } from "@/lib/live-class/classroom-data";

export function ClassroomScreen({ data }: { data: NonNullable<Awaited<ReturnType<typeof getClassroomData>>> }) {
  return <NativeClassroom
    session={data.session as never}
    user={data.user}
    participant={data.participant}
    participants={data.participants as never}
    initialMessages={data.messages as never}
    initialPolls={data.polls as never}
    availableQuestions={data.availableQuestions}
    recordings={data.recordings}
    configuration={data.configuration}
    entryEnabled={data.entryEnabled}
    testingWindow={data.testingWindow}
    mode={data.mode}
    timeZone={data.timeZone}
  />;
}
