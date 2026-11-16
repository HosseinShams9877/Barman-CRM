import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JalaliDateInput } from "./JalaliDateInput";
describe("JalaliDateInput",()=>{
  it("updates from external values without remounting the focused input",()=>{const change=vi.fn();const view=render(<JalaliDateInput label="date" value="1405/08/01" onChange={change}/>);const input=screen.getByLabelText("date");input.focus();view.rerender(<JalaliDateInput label="date" value="1405/08/25" onChange={change}/>);expect(input).toHaveValue("۱۴۰۵/۰۸/۲۵");expect(input).toHaveFocus();});
  it("preserves an incomplete typed draft and emits a normalized complete date",()=>{const change=vi.fn();const view=render(<JalaliDateInput label="date" value="" onChange={change}/>);const input=screen.getByLabelText("date");input.focus();fireEvent.change(input,{target:{value:"1405/08/"}});view.rerender(<JalaliDateInput label="date" value="1405/08/" onChange={change}/>);expect(input).toHaveValue("1405/08/");fireEvent.change(input,{target:{value:"1405/08/25"}});expect(change).toHaveBeenLastCalledWith("1405/08/25");});
});
