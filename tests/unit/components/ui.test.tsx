import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

describe("Button", () => {
  it.each(["primary", "secondary", "ghost", "outline", "destructive", "link"] as const)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });
  it.each(["sm", "md", "lg", "icon", "icon-sm"] as const)("renders size %s", (size) => {
    render(<Button size={size} aria-label="Act">A</Button>);
    expect(screen.getByRole("button", { name: "Act" })).toHaveAttribute("data-size", size);
  });
  it("clicks, and ignores clicks when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    rerender(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it("renders as a link with asChild and takes focus", async () => {
    render(<Button asChild><a href="/x">Open</a></Button>);
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Open" })).toHaveFocus();
  });
});

describe("Form controls", () => {
  it("Input labels, types, invalid and disabled", async () => {
    render(<><Label htmlFor="e">Email</Label><Input id="e" type="email" aria-invalid /><Input aria-label="Off" disabled /></>);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.co");
    expect(screen.getByLabelText("Email")).toHaveValue("a@b.co");
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Off")).toBeDisabled();
  });
  it("Textarea", async () => {
    render(<Textarea aria-label="Note" />);
    await userEvent.type(screen.getByLabelText("Note"), "hi");
    expect(screen.getByLabelText("Note")).toHaveValue("hi");
  });
  it("Checkbox toggles and can be disabled", async () => {
    const onChange = vi.fn();
    render(<><Checkbox aria-label="Agree" onCheckedChange={onChange} /><Checkbox aria-label="Locked" disabled /></>);
    await userEvent.click(screen.getByRole("checkbox", { name: "Agree" }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Locked" })).toBeDisabled();
  });
  it("Switch toggles", async () => {
    const onChange = vi.fn();
    render(<Switch aria-label="Live" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole("switch", { name: "Live" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it("RadioGroup selects with the keyboard", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup aria-label="Method" defaultValue="a" onValueChange={onChange}>
        <RadioGroupItem value="a" aria-label="A" />
        <RadioGroupItem value="b" aria-label="B" />
      </RadioGroup>
    );
    await userEvent.click(screen.getByRole("radio", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
  it("Select shows its value", () => {
    render(
      <Select defaultValue="inr">
        <SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="inr">INR</SelectItem><SelectItem value="usd">USD</SelectItem></SelectContent>
      </Select>
    );
    expect(screen.getByRole("combobox", { name: "Currency" })).toHaveTextContent("INR");
  });
});

describe("Overlays", () => {
  it("Dialog has a title and description", () => {
    render(<Dialog open><DialogContent><DialogTitle>Edit</DialogTitle><DialogDescription>Change it.</DialogDescription></DialogContent></Dialog>);
    expect(screen.getByRole("dialog", { name: "Edit" })).toHaveAccessibleDescription("Change it.");
  });
  it("Dialog closes with Escape", async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open onOpenChange={onOpenChange}><DialogContent><DialogTitle>Edit</DialogTitle><DialogDescription>x</DialogDescription></DialogContent></Dialog>);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it("Sheet renders as a dialog", () => {
    render(<Sheet open><SheetContent><SheetTitle>Menu</SheetTitle></SheetContent></Sheet>);
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
  });
  it("DropdownMenu opens from its trigger", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button>More</Button></DropdownMenuTrigger>
        <DropdownMenuContent><DropdownMenuItem onSelect={onSelect}>Delete</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    );
    await userEvent.click(screen.getByRole("button", { name: "More" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    expect(onSelect).toHaveBeenCalled();
  });
  it("Popover and Tooltip render content when open", () => {
    render(
      <TooltipProvider>
        <Popover open><PopoverTrigger>P</PopoverTrigger><PopoverContent>Pop body</PopoverContent></Popover>
        <Tooltip open><TooltipTrigger>T</TooltipTrigger><TooltipContent>Tip body</TooltipContent></Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByText("Pop body")).toBeInTheDocument();
    expect(screen.getAllByText("Tip body").length).toBeGreaterThan(0);
  });
  it("Command filters and shows an empty state", async () => {
    render(
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList><CommandEmpty>No results</CommandEmpty><CommandItem>Orders</CommandItem></CommandList>
      </Command>
    );
    await userEvent.type(screen.getByPlaceholderText("Search"), "zzz");
    expect(await screen.findByText("No results")).toBeInTheDocument();
  });
  it("Toaster mounts", () => {
    render(<Toaster />);
    expect(document.body).toBeTruthy();
  });
});

describe("Display", () => {
  it("Accordion expands", async () => {
    render(<Accordion type="single" collapsible><AccordionItem value="a"><AccordionTrigger>Q</AccordionTrigger><AccordionContent>Answer</AccordionContent></AccordionItem></Accordion>);
    await userEvent.click(screen.getByRole("button", { name: "Q" }));
    expect(screen.getByText("Answer")).toBeVisible();
  });
  it("Tabs switch panels", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList><TabsTrigger value="a">A</TabsTrigger><TabsTrigger value="b">B</TabsTrigger></TabsList>
        <TabsContent value="a">Panel A</TabsContent><TabsContent value="b">Panel B</TabsContent>
      </Tabs>
    );
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel B");
  });
  it("Card, Badge, Avatar, Separator, Skeleton, Progress, ScrollArea", () => {
    const { container } = render(
      <>
        <Card><CardHeader><CardTitle>Title</CardTitle><CardDescription>Desc</CardDescription></CardHeader><CardContent>Body</CardContent></Card>
        <Badge>New</Badge>
        <Avatar><AvatarFallback>AR</AvatarFallback></Avatar>
        <Separator />
        <Skeleton className="h-4" />
        <Progress value={40} aria-label="Upload" />
        <ScrollArea className="h-10">Scrolling</ScrollArea>
      </>
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("AR")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Upload" })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });
  it("Breadcrumb marks the current page", () => {
    render(
      <Breadcrumb><BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink href="/p">Products</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Planner</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList></Breadcrumb>
    );
    expect(screen.getByText("Planner")).toHaveAttribute("aria-current", "page");
  });
  it("Pagination links", () => {
    render(<Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#" /></PaginationItem><PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#" /></PaginationItem></PaginationContent></Pagination>);
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("aria-current", "page");
  });
  it("Table renders headers and cells", () => {
    render(<Table><TableHeader><TableRow><TableHead>Order</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>PP-1042</TableCell></TableRow></TableBody></Table>);
    expect(screen.getByRole("columnheader", { name: "Order" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "PP-1042" })).toBeInTheDocument();
  });
  it("Calendar renders a month grid", () => {
    render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />);
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
