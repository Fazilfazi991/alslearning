import React from "react";
import {act, create} from "react-test-renderer";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {newQuestion, type CoreData} from "@/lib/core-repository";
import {QuestionForm} from "./core-manager";

const data: CoreData = {exams:[],programs:[],subjects:[],chapters:[],topics:[],batches:[],questions:[],tests:[],content:[],role:"admin",assignments:[],mappings:[]};
beforeEach(()=>vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true));
afterEach(()=>vi.unstubAllGlobals());

describe("question answer options",()=>{
  it("saves two filled options without sending unused blank rows",async()=>{
    const save=vi.fn(async()=>{});
    const q={...newQuestion(),options:[{content:"Four",correct:true},{content:"Five",correct:false},{content:"",correct:false},{content:"  ",correct:false}]};
    let renderer!:ReturnType<typeof create>;
    await act(async()=>{renderer=create(<QuestionForm value={q} data={data} busy={false} save={save}/>)});
    await act(async()=>{renderer.root.findByType("form").props.onSubmit({preventDefault(){}})});
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith({...q,options:q.options.slice(0,2)});
    await act(async()=>renderer.unmount());
  });
  it("rejects a selected blank correct option rather than changing the answer",async()=>{
    const save=vi.fn(async()=>{});
    const q={...newQuestion(),options:[{content:"",correct:true},{content:"Five",correct:false},{content:"Six",correct:false},{content:"",correct:false}]};
    let renderer!:ReturnType<typeof create>;
    await act(async()=>{renderer=create(<QuestionForm value={q} data={data} busy={false} save={save}/>)});
    await act(async()=>{renderer.root.findByType("form").props.onSubmit({preventDefault(){}})});
    expect(save).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({role:"alert"}).children.join("")).toBe("Select a correct answer with text.");
    await act(async()=>renderer.unmount());
  });
  it("offers optional fields when reopening a two-answer question",async()=>{
    const q={...newQuestion(),options:[{content:"Yes",correct:true},{content:"No",correct:false}]};
    let renderer!:ReturnType<typeof create>;
    await act(async()=>{renderer=create(<QuestionForm value={q} data={data} busy={false} save={async()=>{}}/>)});
    expect(renderer.root.findAllByProps({"aria-label":"Option 3"}).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({"aria-label":"Option 4"}).length).toBeGreaterThan(0);
    await act(async()=>renderer.unmount());
  });
  it("requires at least two nonempty answers",async()=>{
    const save=vi.fn(async()=>{});
    const q={...newQuestion(),options:[{content:"Only one",correct:true},{content:"",correct:false}]};
    let renderer!:ReturnType<typeof create>;
    await act(async()=>{renderer=create(<QuestionForm value={q} data={data} busy={false} save={save}/>)});
    await act(async()=>{renderer.root.findByType("form").props.onSubmit({preventDefault(){}})});
    expect(save).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({role:"alert"}).children.join("")).toBe("Enter at least two answer options.");
    await act(async()=>renderer.unmount());
  });
});
