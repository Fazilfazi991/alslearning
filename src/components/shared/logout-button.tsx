import{LogOut}from"lucide-react";
export function LogoutButton({className=""}:{className?:string}){return <form action="/auth/logout" method="post"><button className={className} type="submit"><LogOut size={18}/>Logout</button></form>}
