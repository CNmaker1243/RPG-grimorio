import { useQuery,useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { sheetsQuery } from "@/lib/sheets";
import { errMsg } from "@/lib/rpg";
export function TemplatePermissions({id,memberId}:{id:string;memberId:string}){
 const {data}=useQuery(sheetsQuery(id));const qc=useQueryClient();
 async function update(templateId:string,max:number){const {error}=await supabase.from("member_template_limits").upsert({member_id:memberId,template_id:templateId,max_characters:max},{onConflict:"member_id,template_id"});if(error){toast.error(errMsg(error));return;}void qc.invalidateQueries({queryKey:["sheets",id]});}
 return <div className="w-full space-y-2">{data?.templates.map(t=>{const limit=data.limits.find(l=>l.member_id===memberId&&l.template_id===t.id);return <div key={t.id} className="flex flex-wrap items-center gap-3 text-sm"><Switch aria-label={`Permitir ${t.name}`} checked={(limit?.max_characters??0)>0} onCheckedChange={v=>update(t.id,v?1:0)}/><span className="min-w-0 flex-1 break-words">{t.name}</span><label className="flex items-center gap-2">Máximo deste tipo<Input aria-label={`Máximo de ${t.name}`} className="w-20" type="number" min={0} max={50} key={limit?.max_characters??0} defaultValue={limit?.max_characters??0} onBlur={e=>{const v=e.target.valueAsNumber;if(Number.isInteger(v)&&v>=0&&v<=50&&v!==limit?.max_characters)void update(t.id,v);}}/></label></div>;})}</div>;
}
