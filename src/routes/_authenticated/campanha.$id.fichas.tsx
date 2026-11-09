import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { campaignQuery, charactersQuery, membersQuery, errMsg, type Character } from "@/lib/rpg";
import { sheetsQuery,readFields,readSheet,canCreateType,type Template,type Skill } from "@/lib/sheets";
import { useSheetUpdates } from "@/hooks/use-sheet-updates";
import { CharacterItems } from "@/components/Items";

export const Route = createFileRoute("/_authenticated/campanha/$id/fichas")({
  head: () => ({ meta: [
    { title: "Fichas da campanha — Grimório" },
    { name: "description", content: "Personagens e anotações da sua campanha de RPG." },
    { property: "og:title", content: "Fichas da campanha — Grimório" },
    { property: "og:description", content: "Personagens e anotações da sua campanha de RPG." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Fichas,
});

function Fichas() {
 const {id}=Route.useParams();const qc=useQueryClient();const camp=useQuery(campaignQuery(id));const chars=useQuery(charactersQuery(id));const members=useQuery(membersQuery(id));const sheets=useQuery(sheetsQuery(id));useSheetUpdates(id);
 const [name,setName]=useState("");const [template,setTemplate]=useState("");const [busy,setBusy]=useState(false);
 const master=camp.data?.me?.role==='mestra';const me=camp.data?.me;const mine=chars.data?.filter(c=>c.owner_id===camp.data?.userId)??[];const limit=me?.max_characters??camp.data?.campaign.max_characters_per_player??0;
 const templates=sheets.data?.templates??[];
 const allowed=templates.filter(t=>master||canCreateType(mine.length,limit,mine.filter(c=>c.template_id===t.id).length,sheets.data?.limits.find(l=>l.member_id===me?.id&&l.template_id===t.id)?.max_characters));
 const canCreate=!!camp.data&&(master||!!me?.can_create_characters&&mine.length<limit)&&(!templates.length||allowed.some(t=>t.id===template));
 async function create(e:React.FormEvent){e.preventDefault();if(!camp.data||!canCreate||busy)return;setBusy(true);const {error}=await supabase.from("characters").insert({campaign_id:id,owner_id:camp.data.userId,name:name.trim(),template_id:template||null,data:{values:{},skills:{}}});setBusy(false);if(error){toast.error(errMsg(error));return;}setName("");void qc.invalidateQueries({queryKey:["characters",id]});void qc.invalidateQueries({queryKey:["my-characters"]});}
 return <div className="space-y-6"><form onSubmit={create} className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-1"><Label htmlFor="cn">Nova ficha</Label><Input id="cn" required maxLength={120} placeholder="Nome do personagem" value={name} onChange={e=>setName(e.target.value)}/>{!master&&<p className="text-xs text-muted-foreground">{me?.can_create_characters?`Você usou ${mine.length} de ${limit} fichas permitidas.`:"A mestra desativou a criação de fichas para você."}</p>}</div>{templates.length>0&&<div className="space-y-1 sm:w-56"><Label>Tipo de ficha</Label><Select value={template} onValueChange={setTemplate}><SelectTrigger aria-label="Tipo de ficha"><SelectValue placeholder="Selecionar modelo"/></SelectTrigger><SelectContent>{allowed.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>}<Button disabled={!canCreate||!name.trim()||busy}><Plus className="h-4 w-4"/>Criar</Button></form>{templates.length>0&&!allowed.length&&!master&&<p className="text-muted-foreground">Nenhum tipo de ficha disponível nas suas permissões atuais.</p>}{chars.isError||sheets.isError?<p className="text-destructive">Não foi possível carregar as fichas.</p>:!chars.data?.length?<p className="text-muted-foreground">Nenhuma ficha.</p>:<div className="grid min-w-0 gap-5 lg:grid-cols-2">{chars.data.map(c=><CharacterCard key={c.id} c={c} master={master} owner={master?members.data?.find(m=>m.user_id===c.owner_id)?.name??"":""} templates={templates} skills={sheets.data?.skills??[]}/>)}</div>}</div>;
}
function CharacterCard({c,master,owner,templates,skills}:{c:Character;master:boolean;owner:string;templates:Template[];skills:Skill[]}){
 const qc=useQueryClient();const [name,setName]=useState(c.name);const [notes,setNotes]=useState(c.notes);const [templateId,setTemplateId]=useState(c.template_id??"");const [data,setData]=useState(readSheet(c.data));const [busy,setBusy]=useState(false);
 useEffect(()=>{setName(c.name);setNotes(c.notes);setData(readSheet(c.data));setTemplateId(c.template_id??"");},[c.name,c.notes,c.data,c.template_id]);
 const template=templates.find(t=>t.id===templateId);const fields=template?readFields(template.fields):[];const mySkills=skills.filter(s=>s.template_id===templateId);const dirty=name!==c.name||notes!==c.notes||templateId!==(c.template_id??"")||JSON.stringify(data)!==JSON.stringify(readSheet(c.data));
 async function save(){setBusy(true);const {error}=await supabase.from("characters").update({name:name.trim(),notes,template_id:templateId||null,...templateId?{data}:{}}).eq("id",c.id);setBusy(false);if(error){toast.error(errMsg(error));return;}toast.success("Ficha salva");void qc.invalidateQueries({queryKey:["characters",c.campaign_id]});void qc.invalidateQueries({queryKey:["my-characters"]});}
 async function remove(){if(!confirm(`Excluir a ficha "${c.name}"?`))return;const {error}=await supabase.from("characters").delete().eq("id",c.id);if(error){toast.error(errMsg(error));return;}void qc.invalidateQueries({queryKey:["characters",c.campaign_id]});void qc.invalidateQueries({queryKey:["my-characters"]});}
 return <article className="min-w-0 space-y-5 rounded-lg border border-border bg-card p-5">{owner&&<p className="text-xs text-muted-foreground">Jogador: {owner}</p>}<div className="space-y-2"><Label>Nome do personagem</Label><Input aria-label={`Nome de ${c.name}`} value={name} maxLength={120} onChange={e=>setName(e.target.value)} className="font-display text-2xl"/>{master?<Select value={templateId||"legacy"} onValueChange={v=>{setTemplateId(v==='legacy'?"":v);setData({values:{},skills:{}});}}><SelectTrigger aria-label={`Modelo de ${c.name}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="legacy">Ficha livre</SelectItem>{templates.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>:<p className="text-sm text-primary">{template?.name??"Ficha livre"}</p>}</div>{fields.length>0&&<div className="grid gap-3 sm:grid-cols-2">{fields.map(f=><div key={f.id} className={`space-y-1 ${f.kind==='textarea'?'sm:col-span-2':''}`}><Label htmlFor={`${c.id}-${f.id}`}>{f.name}</Label>{f.kind==='textarea'?<Textarea id={`${c.id}-${f.id}`} value={data.values[f.id]??""} onChange={e=>setData(d=>({...d,values:{...d.values,[f.id]:e.target.value}}))}/>:<Input id={`${c.id}-${f.id}`} type={f.kind==='attribute'||f.kind==='number'?'number':'text'} min={0} max={100} step={1} value={data.values[f.id]??(f.kind==='text'?"":0)} onChange={e=>setData(d=>({...d,values:{...d.values,[f.id]:f.kind==='text'?e.target.value:e.target.valueAsNumber}}))}/>}</div>)}</div>}{mySkills.length>0&&<div className="space-y-3 border-t border-border pt-4"><h3 className="text-2xl">Perícias</h3>{mySkills.map(s=><div key={s.id} className="flex items-start gap-3"><div className="min-w-0 flex-1"><Label htmlFor={`${c.id}-${s.id}`}>{s.name}</Label><p className="break-words text-xs text-muted-foreground">{fields.find(f=>f.id===s.attribute_id)?.name} · máximo {s.max_level}</p>{s.description&&<p className="break-words text-sm text-muted-foreground">{s.description}</p>}</div><Input id={`${c.id}-${s.id}`} className="w-20 shrink-0" type="number" min={0} max={s.max_level} step={1} value={data.skills[s.id]??0} onChange={e=>setData(d=>({...d,skills:{...d.skills,[s.id]:e.target.valueAsNumber}}))}/></div>)}</div>}<CharacterItems campaignId={c.campaign_id} characterId={c.id}/><div className="space-y-1"><Label htmlFor={`notes-${c.id}`}>Anotações</Label><Textarea id={`notes-${c.id}`} value={notes} onChange={e=>setNotes(e.target.value)} rows={4}/></div><div className="flex justify-between gap-3"><Button variant="ghost" size="sm" onClick={remove}><Trash2 className="h-4 w-4"/>Excluir</Button><Button onClick={save} disabled={busy||!dirty||!name.trim()}>Salvar ficha</Button></div></article>;
}
