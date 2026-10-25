import {Clock3} from 'lucide-react';
export default function SubscriptionNotice({notice}:any){
 if(!notice)return null;
 return <div className="subscriptionExpiryNotice" role="status"><Clock3 size={20} aria-hidden="true"/><div><b>{notice.title}</b><p>{notice.message}</p></div><a className="outline" href="/admin?tab=Plan">Ver mi plan</a></div>;
}
