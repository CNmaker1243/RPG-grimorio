import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSheetUpdates(id: string) {
  const qc=useQueryClient();
  useEffect(()=>{
    const channel=supabase.channel(`sheets-${id}-${crypto.randomUUID()}`);
    for(const table of ["sheet_templates","sheet_skills","member_template_limits","success_tests","characters","campaign_members","campaigns","items","character_items","combats"]) channel.on("postgres_changes",{event:"*",schema:"public",table},()=>{
      for(const key of ["sheets","characters","members","campaign","items","roster","combats"]) void qc.invalidateQueries({queryKey:[key,id]});
      void qc.invalidateQueries({queryKey:["my-characters"]});
    });
    channel.subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[id,qc]);
}