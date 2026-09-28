"use client";import{ErrorState}from"@/components/ui/states";export default function Error({retry}:{retry:()=>void}){return <ErrorState title="We couldn't load live classes." onRetry={retry}/>}
