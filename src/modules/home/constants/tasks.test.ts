import { describe, expect, it } from "vitest";
import { matchesTask, ROLE_TASKS, type TaskOrder } from "./tasks";
const order:TaskOrder={id:"PF-1",stage:1,ownerId:"other",customer:"customer",due:20,incompleteCheques:0};
describe("Demo role queues",()=>{
  it("manager draft excludes another employee's order",()=>{const draft=ROLE_TASKS.salesManager.find((t)=>t.key==="draft")!;expect(matchesTask(order,draft,"me",30)).toBe(false);expect(matchesTask({...order,ownerId:"me"},draft,"me",30)).toBe(true);});
  it("incomplete cheque queue requires a confirmed order",()=>{const task=ROLE_TASKS.finance.find((t)=>t.key==="nochq")!;expect(matchesTask({...order,incompleteCheques:1},task,"me",30)).toBe(false);expect(matchesTask({...order,stage:6,incompleteCheques:1},task,"me",30)).toBe(true);});
  it("overdue informational queue excludes future deadlines",()=>{const late=ROLE_TASKS.salesManager.find((t)=>t.key==="late")!;expect(matchesTask(order,late,"me",30)).toBe(true);expect(matchesTask({...order,due:40},late,"me",30)).toBe(false);});
});
