import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TeacherShell } from "./teacher-shell";

it("puts real Teacher workflows in desktop and mobile navigation without fake class actions", () => {
  const html=renderToStaticMarkup(<TeacherShell title="Teacher Dashboard"><div>Real workspace</div></TeacherShell>);
  for(const path of ["/teacher/courses","/teacher/students","/teacher/question-bank","/teacher/assessments","/teacher/content","/teacher/profile"])
    expect(html).toContain(`href="${path}"`);
  expect(html).toContain("Mobile teacher navigation");
  expect(html).not.toContain("Schedule Class");
  expect(html).not.toContain("Clinical Enzyme Interpretation");
});
