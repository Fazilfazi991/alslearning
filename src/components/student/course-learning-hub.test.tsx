import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseLearningHub } from "./course-learning-hub";
import { DashboardMetrics } from "./dashboard-metrics";
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams(navigation.query)}));
beforeEach(() => { navigation.query = ""; });
const data = {
  program: {id:"p",name:"Program",slug:"program"}, enrollment: {id:"e",status:"active",programs:null,batches:null,batch_id:null,access_starts_at:null,access_expires_at:null},
  subjects:[{id:"s",name:"Subject"}],selected:{id:"s",name:"Subject"},counts:[{subjectId:"s",count:1}],resources:[],
  recordings:[{id:"r",title:"Published lesson",subject_id:"s",chapter_id:"c",topic_label:"Topic",subtopic:"Subtopic",provider_video_id:"abcdefghijk",duration_seconds:null,chapters:{name:"Chapter"}}],
};
describe("Student Courses and metrics", () => {
  it("filters the same authorized payload immediately as URL selection changes, without any fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request"));
    const allData = {...data, subjects:[...data.subjects,{id:"t",name:"Other subject"}], counts:[...data.counts,{subjectId:"t",count:1}], recordings:[...data.recordings,{...data.recordings[0],id:"other",subject_id:"t",title:"Other lesson"}]};
    try {
      for (const subject of ["s","t","s","t","s"]) {
        navigation.query = `subject=${subject}`;
        const html = renderToStaticMarkup(<CourseLearningHub data={allData} basePath="/student/courses"/>);
        expect(html).toContain(subject === "s" ? "Published lesson" : "Other lesson");
        expect(html).not.toContain(subject === "s" ? "Other lesson" : "Published lesson");
        expect(html).toContain(`?subject=${subject}" aria-current="page"`);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
  it("shows recordings, hierarchy and canonical player links instead of a false empty state", () => {
    const html=renderToStaticMarkup(<CourseLearningHub data={data} basePath="/student/courses"/>);
    expect(html).toContain("Published lesson");expect(html).toContain("Topic");expect(html).toContain("Subtopic");expect(html).toContain("/student/recorded-classes/r");expect(html).toContain("1 recording");expect(html).not.toContain("No learning content");expect(html).not.toContain("iframe");
  });
  it("only shows the generic empty state if both content collections are empty", () => {
    const html=renderToStaticMarkup(<CourseLearningHub data={{...data,recordings:[]}} basePath="/student/courses"/>);
    expect(html).toContain("No learning content is available for this subject yet.");
  });
  it("keeps subject navigation accessible and horizontally contained", () => {
    const html=renderToStaticMarkup(<CourseLearningHub data={data} basePath="/student/courses"/>);
    expect(html).toContain('aria-current="page"');expect(html).toContain("?subject=s");expect(html).toContain("overflow-x-auto");
  });
  it("renders four real metrics in a compact two-column grid", () => {
    const html=renderToStaticMarkup(<DashboardMetrics programs={1} sessions={0} tests={2} recordings={4}/>);
    expect(html).toContain("grid-cols-2");expect(html).toContain("lg:grid-cols-4");expect(html.match(/<strong/g)).toHaveLength(4);expect(html).toContain("Recorded classes");expect(html).not.toContain("Completed");
  });
});

