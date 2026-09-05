import{LogOut}from"lucide-react";
export function LogoutButton({className="",redirectTo="/login"}:{className?:string;redirectTo?:string}){return <form action="/auth/logout" method="post"><input type="hidden" name="redirectTo" value={redirectTo}/><button className={className} type="submit"><LogOut size={18}/>Logout</button></form>}
