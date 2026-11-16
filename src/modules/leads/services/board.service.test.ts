import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@core/database/client",()=>({prisma:{lead:{findMany:vi.fn(),findUnique:vi.fn()},list:{findMany:vi.fn(),upsert:vi.fn()}}}));
vi.mock("@modules/admin/services/leadcols.service",()=>({getLeadCols:vi.fn(async()=>[{stage:"raw",key:"new",label:"new"},{stage:"raw",key:"retry",label:"retry"}])}));
import { prisma } from "@core/database/client";
import { automaticColumn, getLeadBoard, setLeadColumn } from "./board.service";
beforeEach(()=>vi.clearAllMocks());
describe("Demo automatic lead columns",()=>{
  it("raw: new, retry, conversation",()=>{expect(automaticColumn("raw",null)).toBe("new");expect(automaticColumn("raw","مشغول بود / بعداً تماس")).toBe("retry");expect(automaticColumn("raw","اطلاعات اولیه گرفته شد")).toBe("talk");});
  it("opportunity results choose sample, visit and ready",()=>{expect(automaticColumn("opp","کاتالوگ / نمونه خواست")).toBe("sample");expect(automaticColumn("opp","بازدید یا جلسه هماهنگ شد")).toBe("visit");expect(automaticColumn("opp","متراژ و نیاز مشخص شد")).toBe("ready");});
  it("invoice columns follow its actual stage",()=>{expect(automaticColumn("pf",null,3)).toBe("inside");expect(automaticColumn("pf",null,4)).toBe("sent");expect(automaticColumn("pf",null,5)).toBe("pay");});
});
describe("board ownership and column changes",()=>{
  it("sales board reads only owned leads",async()=>{
    vi.mocked(prisma.lead.findMany).mockResolvedValue([]);
    vi.mocked(prisma.list.findMany).mockResolvedValue([]);
    await getLeadBoard({restrictToOwner:true,userId:"sales-1"});
    expect(prisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{ownerId:"sales-1"}}));
  });
  it("another employee's lead cannot be moved",async()=>{
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({id:"LD-1",ownerId:"other",stage:"raw"} as never);
    await expect(setLeadColumn("LD-1","raw","retry",{restrictToOwner:true,userId:"me"})).rejects.toMatchObject({status:403});
    expect(prisma.list.upsert).not.toHaveBeenCalled();
  });
  it("a column outside the current stage is rejected",async()=>{
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({id:"LD-1",ownerId:"me",stage:"opp"} as never);
    await expect(setLeadColumn("LD-1","raw","retry",{restrictToOwner:true,userId:"me"})).rejects.toMatchObject({status:400});
    expect(prisma.list.upsert).not.toHaveBeenCalled();
  });
  it("valid move stores the stable lead/stage position",async()=>{
    vi.mocked(prisma.lead.findUnique).mockResolvedValue({id:"LD-1",ownerId:"me",stage:"raw"} as never);
    await setLeadColumn("LD-1","raw","retry",{restrictToOwner:true,userId:"me"});
    expect(prisma.list.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{key:"lead-position:LD-1:raw"},update:expect.objectContaining({items:{key:"retry"},rev:{increment:1}})}));
  });
});
