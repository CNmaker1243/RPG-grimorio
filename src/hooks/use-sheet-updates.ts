import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSheetUpdates(id: string) {
  const qc=useQueryClient();
  useEffect(()=>{
    const channel=supabase.channel(`sheets-${id}-${crypto.randomUUID()}`);
    const refresh = () => {
      for(const key of ["sheets","characters","members","campaign","items","roster","combats"]) void qc.invalidateQueries({queryKey:[key,id]});
      void qc.invalidateQueries({queryKey:["my-characters"]});
      void qc.invalidateQueries({queryKey:["my-campaigns"]});
    };
    for(const table of ["sheet_templates","sheet_skills","member_template_limits","success_tests","characters","campaign_members","campaigns","items","character_items","combats"]) {
      const filter = table === "campaigns" ? {filter:`id=eq.${id}`} : table === "sheet_skills" || table === "member_template_limits" ? {} : {filter:`campaign_id=eq.${id}`};
      for (const event of ["INSERT", "UPDATE"] as const) channel.on("postgres_changes",{event,schema:"public",table,...filter},refresh);
      // DELETE payloads only contain primary keys under RLS; campaign filters cannot match them.
      channel.on("postgres_changes",{event:"DELETE",schema:"public",table},refresh);
    }
    channel.subscribe(status => { if (status === "SUBSCRIBED") refresh(); });
    return ()=>{void supabase.removeChannel(channel);};
  },[id,qc]);
}