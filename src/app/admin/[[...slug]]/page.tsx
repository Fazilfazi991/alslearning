import {redirect} from 'next/navigation';
import {AdminPortal} from '@/components/admin/admin-portal';
export default async function AdminPage({params}:{params:Promise<{slug?:string[]}>}){
 const {slug=[]}=await params;
 const redirects:Record<string,string>={'question-bank':'questions',assessments:'tests',batches:'academic'};
 if(redirects[slug[0]])redirect(`/admin/${redirects[slug[0]]}`);
 if(['students','teachers','courses'].includes(slug[0])&&slug.length>1)redirect(`/admin/${slug[0]}`);
 return <AdminPortal/>;
}
