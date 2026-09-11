"use client";
import { createContext, useContext } from "react";
export type AuthorIdentity = {id:string;role:string};
const Context = createContext<AuthorIdentity | undefined>(undefined);
// UI identity from the existing server role guard. Database reads and writes
// still authorize every request through the current session and RLS.
export function AuthorIdentityProvider({value,children}:{value:AuthorIdentity;children:React.ReactNode}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuthorIdentity() {return useContext(Context);}
