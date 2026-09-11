// Client document data, deliberately outside the frontend. No implicit taxonomy creation.
export const clientRecordings = [
  {subject:"Biochemistry",canonicalTopic:"BIO 1 — Biochemistry of Major Biomolecules",topic:"Biochemistry of Major Biomolecules",subtopic:"CARBOHYDRATES",title:"Carbohydrates II",videoId:"xNBduyugQSc",key:"client-carbohydrates-ii"},
  {subject:"Pathology",canonicalTopic:"PATHO 1 - Haemopoiesis, Anaemia, Leukemia, Hemostasis",topic:"Clinical Haematology",subtopic:null,title:"Hemostasis",videoId:null,key:"client-hemostasis"},
  {subject:"Pathology",canonicalTopic:"PATHO 6 - Blood Banking",topic:"Blood Banking and Transfusion Medicine",subtopic:null,title:"Donor selection",videoId:"pprnhTi86pA",key:"client-donor-selection"},
  {subject:"Microbiology",canonicalTopic:"MICRO 5 - Virology",topic:"Virology",subtopic:null,title:"Influenza Parainfluenza Mumps RSV",videoId:"sgbJTyco26g",key:"client-influenza"},
  {subject:"Microbiology",canonicalTopic:"MICRO 4 - Parasitology",topic:"Parasitology",subtopic:null,title:"Trematodes I",videoId:"-oF7W3AvhmU",key:"client-trematodes-i"},
];
export async function importClientRecordings(db) {
  const ok = r => { if(r.error) throw r.error; return r.data; };
  const subjects = ok(await db.from("subjects").select("id,name"));
  const topics = ok(await db.from("chapters").select("id,name,subject_id,program_id"));
  const results = [];
  for (const [index,source] of clientRecordings.entries()) {
    const subject = subjects.filter(s => s.name.toLowerCase() === source.subject.toLowerCase());
    if(subject.length !== 1) throw Error("Ambiguous or missing Subject: "+source.subject);
    const topic = topics.filter(t => t.subject_id === subject[0].id && t.name.toLowerCase() === source.canonicalTopic.toLowerCase() && !t.program_id);
    if(topic.length !== 1) throw Error("Ambiguous or missing canonical Topic: "+source.canonicalTopic);
    const existing = ok(await db.from("recorded_classes").select("id").eq("import_key",source.key).maybeSingle());
    // Re-runs preserve Admin edits and publication status.
    const id = existing?.id ?? ok(await db.rpc("save_recorded_class",{value:{subject_id:subject[0].id,chapter_id:topic[0].id,topic_label:source.topic,subtopic:source.subtopic,title:source.title,provider:"youtube",provider_video_id:source.videoId,original_source_url:source.videoId ? `https://studio.youtube.com/video/${source.videoId}/edit?theme=dark` : null,status:"draft",sort_order:index,import_key:source.key}}));
    results.push({...source,id,subject_id:subject[0].id,chapter_id:topic[0].id});
  }
  return results;
}
