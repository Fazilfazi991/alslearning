import React from "react";
import {describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
vi.mock("next/navigation",()=>({useSearchParams:()=>new URLSearchParams()}));
import {QuestionBank} from "./question-bank";
import {AuthorIdentityProvider} from "./author-identity";
describe("progressive question bank shell",()=>{
 it("shows controls and separate loading states before results, never a false empty state",()=>{const html=renderToStaticMarkup(<AuthorIdentityProvider value={{id:"admin",role:"admin"}}><QuestionBank/></AuthorIdentityProvider>);expect(html).toContain("Question Bank");expect(html).toContain("Search questions");expect(html).toContain("Loading academic filters");expect(html).toContain("Loading questions");expect(html).toContain("Counting results");expect(html).not.toContain("No matching questions");expect(html).not.toContain("0 matching questions");expect(html).toContain('aria-label="Question pages"');expect(html).toContain('aria-busy="true"');expect(html).toContain("min-w-0");});
 it("denies the Admin shell to a Student",()=>{const html=renderToStaticMarkup(<AuthorIdentityProvider value={{id:"student",role:"student"}}><QuestionBank/></AuthorIdentityProvider>);expect(html).toContain("Admin access required");expect(html).not.toContain("Add question");});
});
