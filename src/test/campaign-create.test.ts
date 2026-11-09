import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
import { createCampaign } from "@/lib/rpg";

describe("Campaign creation regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({data:{user:{id:"creator"}}});
    mocks.insert.mockResolvedValue({error:null});
    mocks.from.mockReturnValue({insert:mocks.insert});
  });
  it("creates a campaign without requesting a row before membership exists", async () => {
    const id = await createCampaign("  Minha campanha  ");
    expect(mocks.from).toHaveBeenCalledWith("campaigns");
    expect(mocks.insert).toHaveBeenCalledWith({id,name:"Minha campanha",owner_id:"creator"});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("does not create a campaign without a signed-in creator", async () => {
    mocks.getUser.mockResolvedValue({data:{user:null}});
    await expect(createCampaign("Minha campanha")).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("propagates failure without reporting success", async () => {
    mocks.insert.mockResolvedValue({error:new Error("Denied")});
    await expect(createCampaign("Minha campanha")).rejects.toThrow("Denied");
  });
});