import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Swords, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { charactersQuery, errMsg } from "@/lib/rpg";
import { itemsQuery, parseDamageFormula, readBonuses, readEntries, type Bonus, type Entry, type Item } from "@/lib/combat";
import { diceExpression } from "@/lib/dice";

type Draft = { name: string; category: string; description: string; damage_formula: string; bonuses: Bonus[]; attributes: Entry[]; properties: Entry[] };
const empty: Draft = { name: "", category: "", description: "", damage_formula: "", bonuses: [], attributes: [], properties: [] };
const toDraft = (i: Item): Draft => ({ name: i.name, category: i.category, description: i.description, damage_formula: i.damage_formula, bonuses: readBonuses(i.bonuses), attributes: readEntries(i.attributes), properties: readEntries(i.properties) });

export function ItemDetails({ item }: { item: Item }) {
  const bonuses = readBonuses(item.bonuses), attrs = readEntries(item.attributes), props = readEntries(item.properties);
  return <div className="space-y-2 text-sm">
    <div className="flex flex-wrap items-baseline gap-2"><strong className="text-base">{item.name}</strong>{item.category && <span className="rounded border border-border px-2 text-xs text-muted-foreground">{item.category}</span>}{item.damage_formula && <span className="flex items-center gap-1 font-mono text-primary"><Swords className="h-3 w-3" />{item.damage_formula}</span>}</div>
    {item.description && <p className="whitespace-pre-wrap break-words text-muted-foreground">{item.description}</p>}
    {bonuses.length > 0 && <ul className="space-y-0.5">{bonuses.map((b, i) => <li key={i}><span className="text-primary">Bônus {b.value}</span> · {b.description}</li>)}</ul>}
    {[...attrs, ...props].length > 0 && <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">{[...attrs, ...props].map((e, i) => <div key={i} className="contents"><dt className="text-muted-foreground">{e.name}</dt><dd className="break-words">{e.value}</dd></div>)}</dl>}
  </div>;
}

function EntryList<T extends Record<string, string>>({ title, rows, keys, labels, onChange }: { title: string; rows: T[]; keys: [keyof T & string, keyof T & string]; labels: [string, string]; onChange: (r: T[]) => void }) {
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><Label>{title}</Label><Button type="button" size="sm" variant="ghost" onClick={() => onChange([...rows, { [keys[0]]: "", [keys[1]]: "" } as T])}><Plus className="h-4 w-4" />Adicionar</Button></div>
    {rows.map((r, i) => <div key={i} className="flex gap-2">
      <Input aria-label={`${title}: ${labels[0]} ${i + 1}`} placeholder={labels[0]} maxLength={200} value={r[keys[0]]} onChange={e => onChange(rows.map((x, j) => j === i ? { ...x, [keys[0]]: e.target.value } : x))} />
      <Input aria-label={`${title}: ${labels[1]} ${i + 1}`} placeholder={labels[1]} maxLength={60} className="w-36" value={r[keys[1]]} onChange={e => onChange(rows.map((x, j) => j === i ? { ...x, [keys[1]]: e.target.value } : x))} />
      <Button type="button" size="icon" variant="ghost" aria-label={`Remover linha ${i + 1} de ${title}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
    </div>)}
  </div>;
}

function ItemForm({ campaignId, item, categories, done }: { campaignId: string; item?: Item; categories: string[]; done: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(item ? toDraft(item) : empty);
  const [busy, setBusy] = useState(false);
  const parsed = d.damage_formula.trim() ? parseDamageFormula(d.damage_formula) : null;
  const formulaError = typeof parsed === "string" ? parsed : null;
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy || formulaError) return; setBusy(true);
    const clean = { ...d, name: d.name.trim(), bonuses: d.bonuses.filter(b => b.description.trim() || b.value.trim()), attributes: d.attributes.filter(a => a.name.trim()), properties: d.properties.filter(a => a.name.trim()) };
    const { error } = item ? await supabase.from("items").update(clean).eq("id", item.id) : await supabase.from("items").insert({ ...clean, campaign_id: campaignId });
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(item ? "Item salvo" : "Item criado");
    if (!item) setD(empty);
    await qc.invalidateQueries({ queryKey: ["items", campaignId] }); done();
  }
  const fid = item?.id ?? "new";
  return <form onSubmit={save} className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor={`in-${fid}`}>Nome do item</Label><Input id={`in-${fid}`} required maxLength={120} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`ic-${fid}`}>Categoria</Label><Input id={`ic-${fid}`} list={`cats-${fid}`} maxLength={60} placeholder="Arma, poção, armadura…" value={d.category} onChange={e => setD({ ...d, category: e.target.value })} /><datalist id={`cats-${fid}`}>{categories.map(c => <option key={c} value={c} />)}</datalist></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor={`id-${fid}`}>Descrição</Label><Textarea id={`id-${fid}`} maxLength={4000} value={d.description} onChange={e => setD({ ...d, description: e.target.value })} /></div>
      <div className="space-y-1 sm:col-span-2"><Label htmlFor={`if-${fid}`}>Fórmula de dano (opcional)</Label><Input id={`if-${fid}`} className="font-mono" maxLength={60} placeholder="1d6 + 2" value={d.damage_formula} onChange={e => setD({ ...d, damage_formula: e.target.value })} />
        {formulaError ? <p className="text-xs text-destructive">{formulaError}</p> : parsed && typeof parsed !== "string" ? <p className="text-xs text-muted-foreground">Rolagem: {diceExpression(parsed.dice, parsed.modifier)}</p> : <p className="text-xs text-muted-foreground">Dados aceitos: d4, d6, d8, d10, d12, d20, d100.</p>}</div>
    </div>
    <EntryList title="Bônus" rows={d.bonuses} keys={["description", "value"]} labels={["Descrição e como se aplica", "Valor"]} onChange={bonuses => setD({ ...d, bonuses })} />
    <EntryList title="Atributos do item" rows={d.attributes} keys={["name", "value"]} labels={["Nome", "Valor"]} onChange={attributes => setD({ ...d, attributes })} />
    <EntryList title="Outras propriedades" rows={d.properties} keys={["name", "value"]} labels={["Propriedade", "Valor"]} onChange={properties => setD({ ...d, properties })} />
    <div className="flex gap-2"><Button disabled={busy || !d.name.trim() || !!formulaError}>{item ? "Salvar item" : "Criar item"}</Button>{item && <Button type="button" variant="ghost" onClick={done}>Cancelar</Button>}</div>
  </form>;
}

export function ItemsManager({ id }: { id: string }) {
  const qc = useQueryClient();
  const items = useQuery(itemsQuery(id));
  const chars = useQuery(charactersQuery(id));
  const [editing, setEditing] = useState<string | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});
  const list = items.data?.items ?? [];
  const categories = [...new Set(list.map(i => i.category).filter(Boolean))];
  const refresh = () => qc.invalidateQueries({ queryKey: ["items", id] });
  async function remove(i: Item) {
    if (!confirm(`Excluir o item ${i.name}? Ele sairá de todas as fichas.`)) return;
    const { error } = await supabase.from("items").delete().eq("id", i.id); if (error) { toast.error(errMsg(error)); return; } await refresh();
  }
  async function give(i: Item) {
    const character_id = assign[i.id]; if (!character_id) return;
    const { error } = await supabase.from("character_items").insert({ campaign_id: id, character_id, item_id: i.id });
    if (error) { toast.error(error.code === "23505" ? "Esse personagem já tem este item." : errMsg(error)); return; }
    toast.success("Item entregue"); setAssign(a => ({ ...a, [i.id]: "" })); await refresh();
  }
  async function take(linkId: string) { const { error } = await supabase.from("character_items").delete().eq("id", linkId); if (error) { toast.error(errMsg(error)); return; } await refresh(); }
  async function setQty(linkId: string, quantity: number) { if (!Number.isInteger(quantity) || quantity < 1) return; const { error } = await supabase.from("character_items").update({ quantity }).eq("id", linkId); if (error) toast.error(errMsg(error)); else await refresh(); }
  return <div className="space-y-8">
    <section className="space-y-4 rounded-lg border border-border bg-card p-5"><h2 className="text-2xl font-semibold">Novo item</h2><ItemForm campaignId={id} categories={categories} done={() => {}} /></section>
    <section className="space-y-4"><h2 className="text-2xl font-semibold">Itens da campanha</h2>
      {items.isError ? <p className="text-destructive">Não foi possível carregar os itens.</p> : !list.length ? <p className="text-muted-foreground">Nenhum item criado.</p> :
      <ul className="space-y-4">{list.map(i => { const links = items.data!.links.filter(l => l.item_id === i.id); return <li key={i.id} className="space-y-4 rounded-lg border border-border bg-card p-5">
        {editing === i.id ? <ItemForm campaignId={id} item={i} categories={categories} done={() => setEditing(null)} /> : <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><ItemDetails item={i} /></div><Button size="sm" variant="secondary" onClick={() => setEditing(i.id)}>Editar</Button><Button size="icon" variant="ghost" aria-label={`Excluir ${i.name}`} onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button></div>}
        <div className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">Nas fichas</p>
          {links.length ? <ul className="space-y-1">{links.map(l => <li key={l.id} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-words">{chars.data?.find(c => c.id === l.character_id)?.name ?? "Personagem"}</span><Input aria-label="Quantidade" type="number" min={1} max={9999} className="h-8 w-20" defaultValue={l.quantity} onBlur={e => e.target.valueAsNumber !== l.quantity && setQty(l.id, e.target.valueAsNumber)} /><Button size="sm" variant="ghost" onClick={() => take(l.id)}>Retirar</Button></li>)}</ul> : <p className="text-xs text-muted-foreground">Ainda não entregue a nenhum personagem.</p>}
          <div className="flex gap-2"><Select value={assign[i.id] ?? ""} onValueChange={v => setAssign(a => ({ ...a, [i.id]: v }))}><SelectTrigger aria-label={`Entregar ${i.name} para`}><SelectValue placeholder="Entregar para…" /></SelectTrigger><SelectContent>{chars.data?.filter(c => !links.some(l => l.character_id === c.id)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Button variant="secondary" disabled={!assign[i.id]} onClick={() => give(i)}>Entregar</Button></div>
        </div>
      </li>; })}</ul>}
    </section>
  </div>;
}

export function CharacterItems({ campaignId, characterId }: { campaignId: string; characterId: string }) {
  const items = useQuery(itemsQuery(campaignId));
  const links = items.data?.links.filter(l => l.character_id === characterId) ?? [];
  return <div className="space-y-3 border-t border-border pt-4"><h3 className="text-2xl">Itens</h3>
    {!links.length ? <p className="text-sm text-muted-foreground">Nenhum item nesta ficha.</p> : <ul className="space-y-3">{links.map(l => { const it = items.data!.items.find(i => i.id === l.item_id); return it ? <li key={l.id} className="rounded-md border border-border p-3">{l.quantity > 1 && <p className="text-xs text-muted-foreground">Quantidade: {l.quantity}</p>}<ItemDetails item={it} /></li> : null; })}</ul>}
  </div>;
}
