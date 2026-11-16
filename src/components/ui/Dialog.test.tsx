import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog focus lifecycle", () => {
  it("unmounting nested dialogs restores page scrolling regardless of cleanup order", () => {
    document.body.style.overflow = "";
    const view = render(<Dialog open title="outer" onClose={() => {}}><Dialog open title="inner" onClose={() => {}}><input /></Dialog></Dialog>);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("");
  });
  it("retains the active input and node while the inline close callback changes on every key", () => {
    function Form() { const [text,setText]=useState(""); const [open,setOpen]=useState(false); return <><button onClick={()=>setOpen(true)}>open</button><Dialog open={open} title="form" onClose={()=>setOpen(false)}><input aria-label="name" value={text} onChange={(e)=>setText(e.target.value)} /></Dialog></>; }
    render(<Form />);
    const trigger=screen.getByText("open"); trigger.focus(); fireEvent.click(trigger);
    const input=screen.getByLabelText("name"); input.focus();
    let value="";
    for(const ch of "بارمان") { value+=ch;fireEvent.change(input,{target:{value}});expect(screen.getByLabelText("name")).toBe(input);expect(input).toHaveFocus(); }
    expect(input).toHaveValue("بارمان");
    fireEvent.keyDown(window,{key:"Escape"});expect(trigger).toHaveFocus();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("Escape invokes the latest callback instead of a stale callback", () => {
    const old=vi.fn(),current=vi.fn();
    const view=render(<Dialog open title="form" onClose={old}><input /></Dialog>);
    view.rerender(<Dialog open title="form" onClose={current}><input /></Dialog>);
    fireEvent.keyDown(window,{key:"Escape"});expect(current).toHaveBeenCalledOnce();expect(old).not.toHaveBeenCalled();
  });
  it("a nested dialog closes alone and restores focus to the outer form", () => {
    const outer=vi.fn();
    function Form() {const [nested,setNested]=useState(false);return <Dialog open title="outer" onClose={outer}><button onClick={()=>setNested(true)}>nested</button>{nested ? <Dialog open title="inner" onClose={()=>setNested(false)}><input /></Dialog> : null}</Dialog>;}
    render(<Form/>);const trigger=screen.getByText("nested");trigger.focus();fireEvent.click(trigger);fireEvent.keyDown(window,{key:"Escape"});expect(outer).not.toHaveBeenCalled();expect(trigger).toHaveFocus();expect(document.body.style.overflow).toBe("hidden");
  });
});
